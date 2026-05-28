import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Bot, User, Trash2, Cpu, FileCode, Shield, RefreshCw } from "lucide-react";
import { SecurityLog } from "../types";

interface ConsultantTabProps {
  activeScenarioTitle: string;
  codeContext: string;
  ruleContext: string;
  currentLogs: SecurityLog[];
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

export default function ConsultantTab({ activeScenarioTitle, codeContext, ruleContext, currentLogs }: ConsultantTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize with a friendly guidance message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome_msg",
          sender: "bot",
          text: `**Willkommen beim integrierten KI-Sicherheitsberater!**\n\nIch bin über das Backend sicher mit der **Gemini-Sicherheits-API** verbunden. Ich besitze vollen forensischen Kontext über dein aktuell selektiertes Szenario und die indizierten Logdateien.\n\n* **Tipp:** Wenn du auf den anderen Reitern (Ghidra, Elitewolf) Code oder Regeln siehst, klicke dort einfach auf **"An KI senden"**, um den Kontext direkt hierher zu übertragen!`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }
  }, []);

  // Scroll to bottom helper
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || loading) return;

    const userText = inputVal.trim();
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal("");
    setLoading(true);

    try {
      // Direct full-stack Express API proxy endpoint call
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: userText,
          activeScenarioTitle,
          contextCode: codeContext || undefined,
          contextLogs: currentLogs.slice(0, 30), // Sent first 30 log records to bypass context chunk overflows
          schemaRules: ruleContext || undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.text) {
        setMessages(prev => [
          ...prev,
          {
            id: `msg_b_${Date.now()}`,
            sender: "bot",
            text: data.text,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
      } else {
        // Handle API key configuration dynamic notifications elegantly
        const errMsg = data.details || data.error || "Unerwarteter Serverfehler.";
        setMessages(prev => [
          ...prev,
          {
            id: `msg_b_${Date.now()}`,
            sender: "bot",
            text: `### ⚠ API-Verbindungsfehler\n\nWir haben deine Gemini API-Abfragen für die voll-integrierte Analyse vorbereitet. Du kannst deinen **GEMINI_API_KEY** komfortabel in der Seitenleiste unter **Settings > Secrets** für dieses Workspace einrichten.\n\n**Server-Fehlermeldung:** ${errMsg}`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
      }
    } catch (err: any) {
      console.error("Fehler im Berater-Chat:", err);
      setMessages(prev => [
        ...prev,
        {
          id: `msg_b_${Date.now()}`,
          sender: "bot",
          text: `### ⚠ Netzwerk-Fehler\n\nEs konnte keine Verbindung zum Backend auf Port 3000 hergestellt werden. Möglicherweise baut der Entwicklungsserver gerade neu auf. Bitte lade die Seite in wenigen Augenblicken neu.\n\n**Details:** ${err.message}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "cleared_welcome",
        sender: "bot",
        text: "Verlauf zurückgesetzt. Ich bin bereit für neue forensische Abfragen.",
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="consultant_container">
      {/* Sidebar: Active Forensic Context variables in cache */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-theme-blue" />
            Echtzeit-Sicherheitskontext
          </h3>
          <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
            Folgende Daten werden automatisch bei deiner nächsten Frage an die Gemini-Engine im Hintergrund mitgesendet, um einen präzisen Bericht zu erstellen:
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg flex items-center justify-between">
              <span className="text-neutral-500">Szenario:</span>
              <span className="text-theme-blue font-bold">{activeScenarioTitle}</span>
            </div>

            <div className={`p-3 bg-neutral-950 border rounded-lg flex items-center justify-between ${
              codeContext ? 'border-yellow-600/40 text-yellow-500' : 'border-neutral-850 text-neutral-450'
            }`}>
              <span className="flex items-center gap-1.5 font-sans">
                <FileCode className="w-3.5 h-3.5" />
                Ghidra C-Code:
              </span>
              <span className="font-bold text-[10px]">{codeContext ? "GELADEN (1 Function)" : "KEINE"}</span>
            </div>

            <div className={`p-3 bg-neutral-950 border rounded-lg flex items-center justify-between ${
              ruleContext ? 'border-red-650/40 text-red-400' : 'border-neutral-850 text-neutral-450'
            }`}>
              <span className="flex items-center gap-1.5 font-sans">
                <Shield className="w-3.5 h-3.5" />
                Sigma Regel:
              </span>
              <span className="font-bold text-[10px]">{ruleContext ? "GELADEN (YAML)" : "KEINE"}</span>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-sans">
                <Cpu className="w-3.5 h-3.5 text-teal-400" />
                Logs (Datawave):
              </span>
              <span className="text-teal-400 font-bold font-mono">{currentLogs.length} Einträge</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel: Message history & Chat Interface */}
      <div className="lg:col-span-8 flex flex-col h-[540px] bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg relative">
        <div className="flex justify-between items-center border-b border-neutral-800 px-5 py-4 select-none">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-theme-blue" />
            <span className="text-sm font-semibold text-neutral-200">Incident-Berater Terminal</span>
            <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40">
              REAL-TIME ASSISTANT
            </span>
          </div>

          <button
            id="btn_clear_consult_chat"
            onClick={clearChat}
            className="text-[11px] font-mono text-neutral-500 hover:text-red-400 cursor-pointer flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Chat leeren
          </button>
        </div>

        {/* Message Logs */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => {
            const isBot = msg.sender === "bot";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isBot ? "mr-auto" : "ml-auto flex-row-reverse"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 select-none ${
                    isBot ? "bg-theme-blue/20 text-theme-blue border border-theme-blue/40" : "bg-neutral-800 text-neutral-200"
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div className={`p-4 rounded-xl text-xs leading-relaxed font-sans shadow-md border ${
                    isBot 
                      ? "bg-neutral-950 text-neutral-300 border-neutral-850" 
                      : "bg-theme-blue text-white border-theme-blue/40"
                  }`}
                >
                  {/* Handle inline Markdown lists or headings simply and safely */}
                  <div className="prose prose-invert prose-xs max-w-none text-[12px] break-words whitespace-pre-wrap select-all">
                    {msg.text}
                  </div>
                  <div className="text-[9px] text-neutral-500 font-mono mt-1.5 text-right select-none">{msg.timestamp}</div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-[85%] mr-auto items-center animate-pulse">
              <div className="w-8 h-8 rounded-full bg-theme-blue/20 text-theme-blue border border-theme-blue/40 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-neutral-950 border border-neutral-850 text-neutral-500 rounded-xl text-xs font-mono">
                Gemini-3.5-flash analysiert dekompilierten Code und Logdateien...
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Send message form */}
        <form onSubmit={handleSendMessage} className="border-t border-neutral-800 p-4 flex gap-2">
          <input
            id="consultant_chat_input"
            type="text"
            placeholder="Frage den KI-Sicherheitsberater nach dem aktuellen Szenario oder Logmustern..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={loading}
            className="flex-1 bg-neutral-950 border border-neutral-850 focus:border-neutral-750 px-4 py-2.5 rounded-lg text-xs font-sans text-neutral-300 outline-none placeholder:text-neutral-550"
            required
            autoComplete="off"
          />
          <button
            id="btn_submit_consult_chat"
            type="submit"
            disabled={loading || !inputVal.trim()}
            className={`px-4 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              loading || !inputVal.trim()
                ? "bg-neutral-800 text-neutral-500 border border-neutral-850 cursor-not-allowed"
                : "bg-theme-blue hover:bg-theme-blue/80 text-white"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Senden
          </button>
        </form>
      </div>
    </div>
  );
}
