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
 * Helper to check if a value matches a pattern supporting wildcards (*) and field suffixes.
 */
function matchValue(text: string, pattern: string): boolean {
  if (!pattern) return false;
  
  let cleanPattern = pattern;
  // Strip surrounding quotes
  if ((cleanPattern.startsWith("'") && cleanPattern.endsWith("'")) || (cleanPattern.startsWith('"') && cleanPattern.endsWith('"'))) {
    cleanPattern = cleanPattern.substring(1, cleanPattern.length - 1);
  }
  cleanPattern = cleanPattern.trim().toLowerCase();
  
  if (cleanPattern.includes("*")) {
    const escaped = cleanPattern.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
    const regexStr = escaped.replace(/\*/g, '.*');
    try {
      const regex = new RegExp(regexStr, 'i');
      return regex.test(text);
    } catch (err) {
      return text.includes(cleanPattern.replace(/\*/g, ""));
    }
  }
  
  return text.includes(cleanPattern);
}

/**
 * Standalone browser-side Sigma matching evaluator.
 * It searches the rule's detection lines and matches values against log fields/messages.
 */
export function matchSigmaRuleAgainstLog(log: SecurityLog, sigmaText: string): boolean {
  if (!sigmaText || !log) return false;
  
  const msgLower = log.message.toLowerCase();
  const srcLower = log.source.toLowerCase();
  const catLower = log.category.toLowerCase();
  const codeLower = (log.eventCode || "").toLowerCase();
  
  // Extract and compile nested selection blocks under "detection" in YAML
  const lines = sigmaText.split("\n");
  let currentSelection = "default";
  
  // Keep key-value pairs grouped by selection identifier
  const selections: Record<string, { field: string; value: string }[]> = {};
  
  lines.forEach(line => {
    // Safely strip inline comments while respecting quotes
    let lineWithoutComment = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      else if (char === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      else if (char === "#" && !inSingleQuote && !inDoubleQuote) {
        break;
      }
      lineWithoutComment += char;
    }
    
    const trimmed = lineWithoutComment.trim();
    if (!trimmed) return;
    
    // Detect selection headers (e.g., selection_dest:, selection_proc:, selection:)
    if (trimmed.endsWith(":") && (trimmed.toLowerCase().startsWith("selection") || trimmed.toLowerCase().includes("_proc") || trimmed.toLowerCase().includes("_dest"))) {
      currentSelection = trimmed.substring(0, trimmed.length - 1).trim().toLowerCase();
      return;
    }
    
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
      let val = trimmed.substring(colonIdx + 1).trim();
      
      // Strip outer quotes if any
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
         val = val.substring(1, val.length - 1);
      }
      val = val.trim();
      
      // Prevent parsing non-detection descriptors
      const metaKeys = ["title", "id", "status", "description", "level", "logsource", "category", "product", "condition", "detection"];
      if (metaKeys.some(m => key === m || key.startsWith(m + "."))) {
        return;
      }
      
      if (val) {
        if (!selections[currentSelection]) {
          selections[currentSelection] = [];
        }
        selections[currentSelection].push({ field: key, value: val });
      }
    }
  });

  const selectionNames = Object.keys(selections);
  if (selectionNames.length === 0) {
    return false;
  }

  // Check if this log matches at least one selection defined in the Sigma rule
  for (const name of selectionNames) {
    const conditions = selections[name];
    if (!conditions || conditions.length === 0) continue;
    
    let selectionMatch = true;
    for (const cond of conditions) {
      const ruleVal = cond.value;
      const cleanField = cond.field.replace("|endswith", "").replace("|startswith", "").replace("|contains", "").replace("|gt", "").replace("|lt", "");
      
      let fieldMatched = false;
      
      if (cleanField === "image" || cleanField === "process" || cleanField === "command") {
        fieldMatched = matchValue(msgLower, ruleVal) || matchValue(srcLower, ruleVal);
      } else if (cleanField === "destinationip" || cleanField === "ip") {
        fieldMatched = matchValue(msgLower, ruleVal);
      } else if (cleanField === "destinationport" || cleanField === "port") {
        fieldMatched = matchValue(msgLower, ruleVal) || matchValue(msgLower, `port ${ruleVal}`) || msgLower.includes(`:${ruleVal}`);
      } else if (cleanField === "targetfilename" || cleanField === "filename" || cleanField === "file") {
        fieldMatched = matchValue(msgLower, ruleVal);
      } else if (cleanField === "category") {
        fieldMatched = catLower.includes(ruleVal.toLowerCase());
      } else if (cleanField === "querylength") {
        // Human threshold check for DNS Exfiltration (subdomain lengths / logs)
        fieldMatched = msgLower.includes("subdomain") || msgLower.includes("länge") || msgLower.includes("length");
      } else if (cleanField === "count" || cleanField === "timeframe") {
        // Heuristic mapping for frequency thresholds
        fieldMatched = msgLower.includes("abfragen") || msgLower.includes("sekunden") || msgLower.includes("seconds") || /\d+/.test(msgLower);
      } else {
        // Fallback generic substring match
        fieldMatched = matchValue(msgLower, ruleVal) || matchValue(srcLower, ruleVal) || matchValue(codeLower, ruleVal);
      }
      
      if (!fieldMatched) {
        selectionMatch = false;
        break;
      }
    }
    
    if (selectionMatch) {
      return true; // This log satisfies this selection cluster!
    }
  }

  return false;
}

export interface SigmaValidationResult {
  isValidYaml: boolean;
  errors: { line?: number; message: string; severity: 'critical' | 'warning' | 'info' }[];
  detectedSections: string[];
}

/**
 * Validates a custom Sigma rule in real-time, checking for common YAML issues or 
 * structural Sigma specification errors (missing condition, tabs instead of spaces, etc.).
 */
export function validateSigmaRule(text: string): SigmaValidationResult {
  const result: SigmaValidationResult = {
    isValidYaml: true,
    errors: [],
    detectedSections: []
  };

  if (!text || !text.trim()) {
    result.errors.push({ message: "Die Sigma-Regel ist leer.", severity: "critical" });
    result.isValidYaml = false;
    return result;
  }

  const lines = text.split("\n");
  
  // Tab check (classic YAML error)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("\t")) {
      result.errors.push({
        line: i + 1,
        message: "Tabulator-Zeichen gefunden! YAML verbietet Tabs zur Einrückung. Verwende stattdessen Leerzeichen.",
        severity: "critical"
      });
      result.isValidYaml = false;
    }
  }

  let hasTitle = false;
  let hasId = false;
  let hasStatus = false;
  let hasLogsource = false;
  let hasDetection = false;
  let hasCondition = false;
  let hasLevel = false;

  const definedSelections: string[] = [];
  let currentBlock: "root" | "logsource" | "detection" | "other" = "root";

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    // Single/double quotes balance checks
    const singleQuotes = (trimmed.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      result.errors.push({
        line: lineNum,
        message: "Ungleiche Anzahl an einfachen Anführungszeichen (').",
        severity: "warning"
      });
    }

    const doubleQuotes = (trimmed.match(/"/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
      result.errors.push({
        line: lineNum,
        message: "Ungleiche Anzahl an doppelten Anführungszeichen (\").",
        severity: "warning"
      });
    }

    // Space after colon validation
    if (trimmed.includes(":") && !trimmed.endsWith(":")) {
      const colonIdx = trimmed.indexOf(":");
      const afterColon = trimmed.substring(colonIdx + 1);
      if (afterColon.length > 0 && !afterColon.startsWith(" ") && !trimmed.startsWith("-") && !afterColon.startsWith("/")) {
        const key = trimmed.substring(0, colonIdx).trim();
        if (!key.toLowerCase().includes("http") && !key.toLowerCase().includes("url")) {
          result.errors.push({
            line: lineNum,
            message: `Format-Fehler: Schlüssel "${key}" benötigt ein Leerzeichen nach dem Doppelpunkt (z. B. 'key: value').`,
            severity: "critical"
          });
        }
      }
    }

    // Header validations
    if (trimmed.startsWith("title:")) {
      hasTitle = true;
      const titleVal = trimmed.replace("title:", "").trim();
      if (!titleVal) {
        result.errors.push({ line: lineNum, message: "Der Titel-Wert ('title:') darf nicht leer sein.", severity: "critical" });
      }
    }
    if (trimmed.startsWith("id:")) {
      hasId = true;
      const uuidVal = trimmed.replace("id:", "").trim().replace(/['"]/g, "");
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidVal && !uuidRegex.test(uuidVal)) {
        result.errors.push({ line: lineNum, message: "ID entspricht keinem gültigen v4 UUID Format.", severity: "info" });
      }
    }
    if (trimmed.startsWith("status:")) hasStatus = true;
    if (trimmed.startsWith("level:")) hasLevel = true;

    // Sections
    if (trimmed.startsWith("logsource:")) {
      hasLogsource = true;
      currentBlock = "logsource";
      result.detectedSections.push("logsource");
    } else if (trimmed.startsWith("detection:")) {
      hasDetection = true;
      currentBlock = "detection";
      result.detectedSections.push("detection");
    } else if (line.match(/^\S/)) {
      if (!trimmed.startsWith("logsource:") && !trimmed.startsWith("detection:")) {
        currentBlock = "root";
      }
    }

    if (currentBlock === "detection") {
      if (trimmed.endsWith(":") && !trimmed.startsWith("condition:")) {
        const selectionName = trimmed.slice(0, -1).trim();
        if (selectionName !== "detection" && selectionName !== "condition") {
          definedSelections.push(selectionName);
        }
      }
      
      if (trimmed.startsWith("condition:")) {
        hasCondition = true;
        const condVal = trimmed.replace("condition:", "").trim();
        if (!condVal) {
          result.errors.push({ line: lineNum, message: "Die Bedingung ('condition:') darf nicht leer sein.", severity: "critical" });
        } else {
          // Check if references are defined
          const words = condVal.replace(/[()]/g, " ").split(/\s+/).filter(w => {
            const lw = w.toLowerCase();
            return lw && lw !== "and" && lw !== "or" && lw !== "not" && lw !== "1" && lw !== "all" && lw !== "of";
          });
          
          words.forEach(word => {
            const cleanWord = word.replace(/['"\*]/g, "");
            if (cleanWord && !definedSelections.includes(cleanWord) && !definedSelections.some(s => s.startsWith(cleanWord)) && cleanWord.toLowerCase() !== "them") {
              if (cleanWord.includes("_") || cleanWord.length > 4) {
                result.errors.push({
                  line: lineNum,
                  message: `Bedingungsverweis '${cleanWord}' ist im 'detection'-Block nicht als Selektor definiert.`,
                  severity: "warning"
                });
              }
            }
          });
        }
      }
    }
  });

  if (!hasTitle) {
    result.errors.push({ message: "Pflichtfeld fehlt: 'title' (Name der Regel)", severity: "critical" });
    result.isValidYaml = false;
  }
  if (!hasLogsource) {
    result.errors.push({ message: "Pflichtblock fehlt: 'logsource' (Ziel-Plattform, z.B. linux/windows)", severity: "critical" });
    result.isValidYaml = false;
  }
  if (!hasDetection) {
    result.errors.push({ message: "Pflichtblock fehlt: 'detection' (Beschreibt Signaturen)", severity: "critical" });
    result.isValidYaml = false;
  } else if (!hasCondition) {
    result.errors.push({ message: "Bedingung fehlt: 'condition' im detection-Block für den logischen Abgleich.", severity: "critical" });
    result.isValidYaml = false;
  }

  if (!hasId) {
    result.errors.push({ message: "Regel besitzt keine eindeutige globale 'id: [UUID]'.", severity: "info" });
  }
  if (!hasStatus) {
    result.errors.push({ message: "Reifegrad ('status: stable/experimental') wird empfohlen.", severity: "info" });
  }
  if (!hasLevel) {
    result.errors.push({ message: "Prioritätsniveau ('level: low/medium/high/critical') wird empfohlen.", severity: "info" });
  }

  // Sort: Critical, then Warning, then Info, then by line index
  result.errors.sort((a, b) => {
    const sevMap = { critical: 0, warning: 1, info: 2 };
    const diff = sevMap[a.severity] - sevMap[b.severity];
    if (diff !== 0) return diff;
    return (a.line || 0) - (b.line || 0);
  });

  return result;
}

/**
 * Automatically formats and fixes indentation, tabs, and layout spacing inside Sigma YAML rules.
 * All tabs are replaced with exactly two spaces, block keys are standardized, 
 * and hierarchy levels are aligned according to the official Sigma specification.
 */
export function formatAndFixSigmaRule(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  let currentBlock: "root" | "logsource" | "detection" = "root";

  const rootKeys = [
    "title", "id", "status", "description", "author", "date", 
    "references", "logsource", "detection", "fields", "falsepositives", "level", "tags"
  ];

  const formattedLines = lines.map((line) => {
    // 1. Replace all tabs with two spaces
    let cleanLine = line.replace(/\t/g, "  ");
    // 2. Trim trailing whitespace
    cleanLine = cleanLine.trimEnd();

    const trimmed = cleanLine.trim();

    // Preserve empty lines or comments
    if (!trimmed) {
      return "";
    }
    if (trimmed.startsWith("#")) {
      return cleanLine;
    }

    // 3. Spacing after colon autofix (e.g., selection:value -> selection: value)
    let processedLine = cleanLine;
    if (trimmed.includes(":") && !trimmed.endsWith(":") && !trimmed.startsWith("-")) {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIdx).trim();
      const after = trimmed.substring(colonIdx + 1);
      if (after.length > 0 && !after.startsWith(" ") && !after.startsWith("/")) {
        if (!key.toLowerCase().includes("http") && !key.toLowerCase().includes("url")) {
          processedLine = `${key}: ${after.trim()}`;
        }
      }
    }

    const currentTrimmed = processedLine.trim();

    // 4. Block Detection & Auto-Indentation logic
    const matchKey = currentTrimmed.match(/^([a-zA-Z_0-9|#-]+)\s*:/);
    if (matchKey) {
      const keyCandidate = matchKey[1].toLowerCase();
      if (rootKeys.includes(keyCandidate)) {
        if (keyCandidate === "logsource") currentBlock = "logsource";
        else if (keyCandidate === "detection") currentBlock = "detection";
        else currentBlock = "root";
        return currentTrimmed;
      }
    }

    // Apply indentation levels
    if (currentBlock === "logsource") {
      const logsourceSubKeys = ["category", "product", "service", "definition"];
      if (matchKey && logsourceSubKeys.includes(matchKey[1].toLowerCase())) {
        return "  " + currentTrimmed;
      }
      return "    " + currentTrimmed;
    }

    if (currentBlock === "detection") {
      if (currentTrimmed.startsWith("condition:")) {
        return "  " + currentTrimmed;
      }
      
      if (currentTrimmed.endsWith(":")) {
        return "  " + currentTrimmed;
      }

      if (currentTrimmed.startsWith("-")) {
        return "    " + currentTrimmed;
      }

      return "    " + currentTrimmed;
    }

    return currentTrimmed;
  });

  return formattedLines.join("\n");
}


