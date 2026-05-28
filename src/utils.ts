import { SecurityLog } from "./types";

/**
 * Calculates the exact Shannon Entropy (0-8 bits) of a given Uint8Array.
 * Entropy of 8 means completely random/encrypted data. Extremely low means simple text or empty bytes.
 */
export function calculateShannonEntropy(data: Uint8Array): number {
  if (data.length === 0) return 0;
  
  const frequencies = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) {
    frequencies[data[i]]++;
  }
  
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / data.length;
      entropy -= p * Math.log2(p);
    }
  }
  
  return parseFloat(entropy.toFixed(3));
}

/**
 * Generates an elegant, aligned hex and ASCII representation of the first active chunks (up to limit bytes).
 */
export function generateHexDump(data: Uint8Array, limit = 512): string {
  let result = "";
  const len = Math.min(data.length, limit);
  
  for (let i = 0; i < len; i += 16) {
    // Offset label
    const offset = i.toString(16).padStart(8, "0");
    result += `${offset}: `;
    
    // Hex values
    let hexPart = "";
    let asciiPart = "";
    for (let j = 0; j < 16; j++) {
      if (i + j < len) {
        const byte = data[i + j];
        hexPart += byte.toString(16).padStart(2, "0") + " ";
        // ASCII characters
        if (byte >= 32 && byte <= 126) {
          asciiPart += String.fromCharCode(byte);
        } else {
          asciiPart += ".";
        }
      } else {
        hexPart += "   ";
      }
      
      // Separate intermediate block
      if (j === 7) {
        hexPart += " ";
      }
    }
    
    result += `${hexPart.padEnd(50, " ")} |${asciiPart}|\n`;
  }
  
  if (data.length > limit) {
    result += `\n[... Truncated. Hex viewer displays first ${limit} bytes. Total size: ${data.length} bytes ...]`;
  }
  
  return result;
}

/**
 * Parse any custom CSV or text log into structured log entries.
 */
export function parseUploadedLogs(text: string): SecurityLog[] {
  const lines = text.split("\n");
  const logs: SecurityLog[] = [];
  const now = new Date();
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Attempt parsing as JSON first
    try {
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const parsed = JSON.parse(trimmed);
        logs.push({
          id: `log_UploadedJ_${index}_${Math.floor(Math.random() * 1000)}`,
          timestamp: parsed.timestamp || now.toISOString(),
          category: parsed.category || "System",
          source: parsed.source || "User_Upload",
          eventCode: parsed.eventCode || parsed.id || undefined,
          message: parsed.message || JSON.stringify(parsed),
          severity: parsed.severity || "medium"
        });
        return;
      }
    } catch {}
    
    // Fallback to unstructured text line parser
    logs.push({
      id: `log_UploadedT_${index}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date(now.getTime() - index * 60000).toISOString(),
      category: trimmed.toLowerCase().includes("port") || trimmed.toLowerCase().includes("traffic") ? "Network" : "System",
      source: "Manual_Log_Source",
      message: trimmed,
      severity: trimmed.toLowerCase().includes("fail") || trimmed.toLowerCase().includes("alert") || trimmed.toLowerCase().includes("critical") ? "high" : "medium"
    });
  });
  
  return logs;
}

/**
 * Standalone browser-side Sigma matching evaluator.
 * It searches the rule's detection lines and matches values against log fields/messages.
 */
export function matchSigmaRuleAgainstLog(log: SecurityLog, sigmaText: string): boolean {
  if (!sigmaText || !log) return false;
  
  const textLower = sigmaText.toLowerCase();
  const msgLower = log.message.toLowerCase();
  const srcLower = log.source.toLowerCase();
  const catLower = log.category.toLowerCase();
  const codeLower = (log.eventCode || "").toLowerCase();
  
  // Extract simple YAML key definitions dynamically
  const lines = sigmaText.split("\n");
  const rulesList: { key: string; val: string }[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
      // Clean string values
      let val = trimmed.substring(colonIdx + 1).trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.substring(1, val.length - 1);
      }
      val = val.trim().toLowerCase();
      
      if (val && !key.startsWith("title") && !key.startsWith("id") && !key.startsWith("status") && !key.startsWith("description") && !key.startsWith("level")) {
        rulesList.push({ key, val });
      }
    }
  });

  if (rulesList.length === 0) {
    // If no complex keys are found, check if keywords appear in logs
    // Look in log message or category
    return false;
  }

  // Evaluate simple matching criteria (requires ALL specified search keys to match - AND logic)
  let allMatched = true;
  for (const rule of rulesList) {
    let keyMatched = false;
    
    // Check if key is general search keyword
    if (rule.key === "selection" || rule.key === "detection" || rule.key === "condition") {
       continue;
    }
    
    const cleanKey = rule.key.replace("|endswith", "").replace("|startswith", "").replace("|contains", "");
    
    // Match fields
    if (cleanKey === "image" || cleanKey === "process" || cleanKey === "command") {
      if (msgLower.includes(rule.val) || srcLower.includes(rule.val)) keyMatched = true;
    } else if (cleanKey === "destinationip" || cleanKey === "ip") {
      if (msgLower.includes(rule.val)) keyMatched = true;
    } else if (cleanKey === "destinationport" || cleanKey === "port") {
      if (msgLower.includes(rule.val) || msgLower.includes(`port ${rule.val}`)) keyMatched = true;
    } else if (cleanKey === "targetfilename" || cleanKey === "filename" || cleanKey === "file") {
      if (msgLower.includes(rule.val)) keyMatched = true;
    } else if (cleanKey === "category") {
      if (catLower.includes(rule.val)) keyMatched = true;
    } else {
      // Generic content check on any rule value
      if (msgLower.includes(rule.val) || srcLower.includes(rule.val) || codeLower.includes(rule.val)) {
        keyMatched = true;
      }
    }
    
    if (!keyMatched) {
      allMatched = false;
      break;
    }
  }

  return allMatched;
}
