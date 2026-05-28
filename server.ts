import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Shared function for lazy initialization of Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please set it in the Settings panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // Real-time server-side API endpoint for Gemini-powered Forensic Analysis & Decompilation
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { prompt, activeScenarioTitle, contextCode, contextLogs, schemaRules } = req.body;

      if (!prompt) {
        res.status(400).json({ error: "No prompt provided" });
        return;
      }

      // Lazy check key
      let ai;
      try {
        ai = getGeminiClient();
      } catch (keyError: any) {
        res.status(503).json({
          error: "API key error found dynamically.",
          details: keyError.message || "Please provide your GEMINI_API_KEY in Settings."
        });
        return;
      }

      // Build context boundaries
      let contextString = `Szenario-Kontext:\nAktives Szenario: ${activeScenarioTitle || "Unbekannt"}\n\n`;
      if (contextCode) {
        contextString += `Dekompilierter C-Code aus Ghidra:\n\`\`\`c\n${contextCode}\n\`\`\`\n\n`;
      }
      if (contextLogs && contextLogs.length > 0) {
        contextString += `Aktuell indizierte Logbucheinträge (Datawave):\n${JSON.stringify(contextLogs, null, 2)}\n\n`;
      }
      if (schemaRules) {
        contextString += `Aktives Elitewolf Sigma-Regelwerk (YAML):\n\`\`\`yaml\n${schemaRules}\n\`\`\`\n\n`;
      }

      const systemInstruction = 
        "Du bist der leitende Forensik-Experte und Incident Responder für das 'Integrierte Sicherheits-Analyse-Framework'. " +
        "Nutze deine tiefgreifenden Kenntnisse über Malware-Analyse, Firmware-Reverse-Engineering, Systemaufrufe, Sigma-Erkennungsregeln " +
        "und Netzwerk-Beziehungen (LemonGraph) um dem Analysten präzise Erläuterungen und Empfehlungen zu geben. " +
        "Antworte auf Deutsch und verfasse gut formatierte Markdown-Berichte.";

      // Use standard gemini-3.5-flash for basic/medium forensic text advisory
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${contextString}Analysten-Abfrage:\n${prompt}`,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini proxy handler error:", err);
      res.status(500).json({ 
        error: "Fehler bei der Kommunikation mit der Gemini-Sicherheits-API", 
        details: err.message || "Timeout oder Dienstunterbrechung."
      });
    }
  });

  // Serve static UI assets or let Vite proxy development mode
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode with standard static server...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Standalone Security analysis server is running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Critical server startup crash:", e);
});
