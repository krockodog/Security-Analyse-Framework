import React, { useState, useEffect } from "react";
import { SecurityLog } from "../types";
import { parseUploadedLogs } from "../utils";
import { Search, Database, Terminal, Plus, Sliders, RefreshCw, AlertTriangle, FileText } from "lucide-react";

interface DatawaveTabProps {
  initialLogs: SecurityLog[];
  onLogsUpdated: (logs: SecurityLog[]) => void;
}

export default function DatawaveTab({ initialLogs, onLogsUpdated }: DatawaveTabProps) {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("All");
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string>("All");
  
  // Custom manual entry fields
  const [customMessage, setCustomMessage] = useState("");
  const [customCategory, setCustomCategory] = useState<'Network' | 'System' | 'Audit' | 'Firmware'>('System');
  const [customSource, setCustomSource] = useState("Manual_Analyst");
  const [customSeverity, setCustomSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  // Real-time live log ticker state
  const [isTickerActive, setIsTickerActive] = useState(false);

  // Sync state with scenario selection
  useEffect(() => {
    setLogs([...initialLogs]);
  }, [initialLogs]);

  // Sync local changes back to the main app scope so other modules like Sigma parser can read them
  useEffect(() => {
    onLogsUpdated(logs);
  }, [logs]);

  // File logs uploading and parsing
  const handleLogImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const newLogs = parseUploadedLogs(text);
      if (newLogs.length > 0) {
        setLogs(prev => [...newLogs, ...prev]);
        alert(`Erfolgreich: ${newLogs.length} echte Protokolleinträge aus ${file.name} extrahiert und in Datawave indiziert.`);
      } else {
        alert("Es wurden keine kompatiblen Textzeilen oder JSON-Logobjekte gefunden.");
      }
    } catch (err: any) {
      alert("Fehler beim Verarbeiten der Logdatei: " + err.message);
    }
  };

  // Inject a manual system level alert log
  const handleInjectManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMessage.trim()) return;

    const newLogEntry: SecurityLog = {
      id: `log_man_${Math.floor(Math.random() * 100000)}`,
      timestamp: new Date().toISOString(),
      category: customCategory,
      source: customSource,
      message: customMessage.trim(),
      severity: customSeverity
    };

    setLogs(prev => [newLogEntry, ...prev]);
    setCustomMessage("");
  };

  // Ticker simulation effect - continuously inserts fresh mock threat vectors into the system Log database
  useEffect(() => {
    let timer: any = null;
    if (isTickerActive) {
      const attackTemplates = [
        { c: "Network", s: "Router_Gate", m: "Inbound SSH connection attempt from IP: 185.195.234.12 on suspicious port 52312.", sev: "medium" },
        { c: "System", s: "System-Audit", m: "Kernel Module mod_kexec loaded containing unverified symbols. Potential rootkit behavior.", sev: "high" },
        { c: "Firmware", s: "SquashFS_Core", m: "Unpacked dynamic binary execution detected from path: /tmp/reverse_loop.", sev: "high" },
        { c: "Audit", s: "Windows_Security", m: "Registry Autostart Key modified 'RunOnce' pointing to system-updater32.exe", sev: "high" },
        { c: "Network", s: "Core-Switch-Flow", m: "Outbound HTTP request to dynamic DNS host: c2-server.malice.su with Content-Length: 0.", sev: "medium" },
        { c: "System", s: "LSASS_Shield", m: "Process LSASS.exe memory accessed with permissions PROCESS_VM_READ by taskmgr.exe.", sev: "high" }
      ];

      timer = setInterval(() => {
        const randIndex = Math.floor(Math.random() * attackTemplates.length);
        const randAttack = attackTemplates[randIndex];
        const tickerEntry: SecurityLog = {
          id: `log_tick_${Math.floor(Math.random() * 1000000)}`,
          timestamp: new Date().toISOString(),
          category: randAttack.c as any,
          source: randAttack.s,
          message: randAttack.m,
          severity: randAttack.sev as any
        };
        setLogs(prev => [tickerEntry, ...prev]);
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [isTickerActive]);

  // Simple and Advanced Search Filter processing
  const filteredLogs = logs.filter(log => {
    const isCategoryMatch = activeCategoryFilter === "All" || log.category === activeCategoryFilter;
    const isSeverityMatch = activeSeverityFilter === "All" || log.severity === activeSeverityFilter;
    
    let isSearchMatch = true;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      // Enable basic regex searching natively!
      if (q.startsWith("/") && q.endsWith("/")) {
        try {
          const regexPattern = q.substring(1, q.length - 1);
          const regex = new RegExp(regexPattern, "i");
          isSearchMatch = regex.test(log.message) || regex.test(log.source);
        } catch {
          // Fallback if regex is broken
          isSearchMatch = log.message.toLowerCase().includes(q) || log.source.toLowerCase().includes(q);
        }
      } else {
        isSearchMatch = log.message.toLowerCase().includes(q) ||
                          log.source.toLowerCase().includes(q) ||
                          (log.eventCode || "").toLowerCase().includes(q);
      }
    }

    return isCategoryMatch && isSeverityMatch && isSearchMatch;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="datawave_container">
      {/* Search filters & real log uploading sidebar */}
      <div className="lg:col-span-4 space-y-6">
        {/* Dynamic Log uploading */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg relative" id="datawave_importer">
          <div className="absolute top-0 right-0 h-1 text-teal-500 font-mono text-[9px] px-2 py-0.5 bg-teal-500/20 rounded-bl-lg border-l border-b border-neutral-800">
            LOG INGESTION
          </div>
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-theme-blue" />
            Externe logs indizieren
          </h3>
          <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
            Importiere Protokolle direkt von deinem Desktop (.log, .txt, .csv oder JSON-Format), die du z.B. aus echten Routern oder Servern exportiert hast.
          </p>

          <label className="flex flex-col items-center justify-center border border-dashed border-neutral-800 hover:border-teal-500 rounded-lg p-5 cursor-pointer bg-neutral-950 transition-colors">
            <FileText className="w-5 h-5 text-neutral-500 mb-1.5" />
            <span className="text-xs text-neutral-300 font-medium">Logdatei hochladen...</span>
            <input type="file" className="hidden" onChange={handleLogImport} accept=".log,.txt,.csv,.json" />
          </label>

          <div className="mt-4 border-t border-neutral-800/60 pt-4 flex items-center justify-between">
            <span className="text-xs font-mono text-neutral-400">Echtzeit Log-Ticker</span>
            <button
              id="btn_toggle_log_generator"
              onClick={() => setIsTickerActive(!isTickerActive)}
              className={`font-mono text-[10px] px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                isTickerActive
                  ? "bg-teal-500/10 border-teal-500 text-teal-300 shadow-inner font-bold animate-pulse"
                  : "bg-neutral-950 border-neutral-805 text-neutral-450 hover:text-neutral-300"
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${isTickerActive ? 'animate-spin' : ''}`} />
              {isTickerActive ? "AKTIV (SOC Sim)" : "INAKTIV SCHALTEN"}
            </button>
          </div>
        </div>

        {/* Manual query filter selectors */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-theme-blue" />
            Datawave Abfrage-Filter
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono font-semibold text-neutral-400 block mb-1.5">Nach Bereich filtern</label>
              <div className="flex flex-wrap gap-1.5">
                {["All", "Network", "System", "Audit", "Firmware"].map(cat => (
                  <button
                    key={cat}
                    id={`filter_cat_${cat}`}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`font-mono text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      activeCategoryFilter === cat
                        ? "bg-theme-blue/20 text-theme-blue border border-theme-blue/40 font-semibold"
                        : "bg-neutral-950 text-neutral-500 hover:bg-neutral-900 border border-neutral-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-semibold text-neutral-400 block mb-1.5">Schweregrad begrenzen</label>
              <div className="flex flex-wrap gap-1.5">
                {["All", "high", "medium", "low"].map(sev => (
                  <button
                    key={sev}
                    id={`filter_sev_${sev}`}
                    onClick={() => setActiveSeverityFilter(sev)}
                    className={`font-mono text-[10px] px-2.5 py-1 rounded transition-colors uppercase cursor-pointer ${
                      activeSeverityFilter === sev
                        ? "bg-red-500/25 text-red-400 border border-red-500/30 font-semibold"
                        : "bg-neutral-950 text-neutral-500 hover:bg-neutral-900 border border-neutral-800"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Form: Inject manual Single system alert */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-yellow-500" />
            Einzelnes Log injizieren
          </h3>
          <form onSubmit={handleInjectManualLog} className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-neutral-500 block">Protokolleintrag / Ereignis</label>
              <input
                type="text"
                placeholder="z.B. SSH login failed for invalid user 'admin'"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-2.5 py-1.5 rounded text-xs text-neutral-300 font-mono outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Gruppe</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1.5 rounded text-xs text-neutral-300 outline-none"
                >
                  <option value="System">System</option>
                  <option value="Network">Netzwerk</option>
                  <option value="Audit">Audit</option>
                  <option value="Firmware">Firmware</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Dringlichkeit</label>
                <select
                  value={customSeverity}
                  onChange={(e) => setCustomSeverity(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1.5 rounded text-xs text-neutral-300 outline-none"
                >
                  <option value="medium">Mittel</option>
                  <option value="high">Kritisch</option>
                  <option value="low">Niedrig</option>
                </select>
              </div>
            </div>

            <button
              id="btn_inject_user_log"
              type="submit"
              className="w-full bg-yellow-600/20 hover:bg-yellow-600/35 text-yellow-500 border border-yellow-600/55 p-1.5 rounded text-xs font-semibold font-mono flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Ereignis senden
            </button>
          </form>
        </div>
      </div>

      {/* Database core logs viewer panel */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-theme-blue" />
                Datawave Logbucheinträge ({filteredLogs.length} geladen)
              </h3>
              <p className="text-xs text-neutral-400">Suchen via Regular-Expressions unterstützt, zum Beispiel `/failed|malicious/`</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Logeintrag / Quelle filtern..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="font-mono text-xs w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 pl-9 pr-3 py-2 rounded-lg text-neutral-300 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs text-neutral-300">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500 select-none">
                  <th className="pb-3 font-semibold w-24">Code</th>
                  <th className="pb-3 font-semibold w-40 font-sans">Timestamp (UTC)</th>
                  <th className="pb-3 font-semibold w-28">Kategorie</th>
                  <th className="pb-3 font-semibold">Protokollnachricht</th>
                  <th className="pb-3 font-semibold w-16">Prio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const sevColor = 
                      log.severity === "high" ? "text-red-400" :
                      log.severity === "medium" ? "text-amber-400" : "text-neutral-500";

                    return (
                      <tr key={log.id} className="hover:bg-neutral-950/45 transition-colors">
                        <td className="py-2.5 font-bold font-mono text-neutral-500 text-[10px] break-all max-w-[80px]">
                          {log.eventCode || "EXEC_HEX"}
                        </td>
                        <td className="py-2.5 font-sans text-[11px] text-neutral-450 pr-2">
                          {log.timestamp.replace("T", " ").replace("Z", "")}
                        </td>
                        <td className="py-2.5">
                          <span className="text-[10px] bg-neutral-950 px-2 py-0.5 rounded text-neutral-400 border border-neutral-805">
                            {log.category}
                          </span>
                        </td>
                        <td className="py-2.5 text-neutral-200 text-[11px] select-all max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl truncate" title={log.message}>
                          {log.message}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[10px] font-bold ${sevColor}`}>
                            {log.severity.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-500">
                      <Terminal className="w-5 h-5 mx-auto mb-2 text-neutral-600" />
                      Keine Protokolldatensätze gefunden. Ändere die Suchfilter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
