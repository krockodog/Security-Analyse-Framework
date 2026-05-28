import React, { useState, useEffect } from "react";
import { ElitewolfAlert, SecurityLog } from "../types";
import { matchSigmaRuleAgainstLog } from "../utils";
import { Play, ShieldAlert, Terminal, Eye, CheckCircle, RefreshCw, Volume2, Edit3, Trash } from "lucide-react";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

interface ElitewolfTabProps {
  alerts: ElitewolfAlert[];
  onAlertsUpdated: (alerts: ElitewolfAlert[]) => void;
  datawaveLogs: SecurityLog[];
  onSelectRuleContext: (rules: string) => void;
  scenarioId: string;
}

export default function ElitewolfTab({ alerts, onAlertsUpdated, datawaveLogs, onSelectRuleContext, scenarioId }: ElitewolfTabProps) {
  const [activeAlerts, setActiveAlerts] = useState<ElitewolfAlert[]>([]);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [sigmaEditorText, setSigmaEditorText] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "done" | "matched">("idle");
  const [matchCount, setMatchCount] = useState(0);

  // Sound generator using native Web Audio API to bypass external dependencies sound clips safely
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch notification beep
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.16);
    } catch {}
  };

  // Sync state with scenario parameters
  useEffect(() => {
    setActiveAlerts([...alerts]);
    if (alerts.length > 0) {
      setSigmaEditorText(alerts[0].sigmaRule);
      setSelectedAlertIndex(0);
    }
  }, [alerts]);

  // Sync back live alerts to parent layout scope
  useEffect(() => {
    onAlertsUpdated(activeAlerts);
  }, [activeAlerts]);

  const currentAlert = activeAlerts[selectedAlertIndex] || activeAlerts[0];

  // Stand-alone rule compiler and evaluation loop matches YAML attributes against Datawave logs
  const handleCompileAndScan = () => {
    if (!sigmaEditorText) return;

    setScanStatus("running");
    setMatchCount(0);

    // Simulate scanning iteration cycle delay
    setTimeout(() => {
      let foundMatches = 0;
      const matchedLogs: SecurityLog[] = [];

      // Scan all logs in current Datawave cache for signatures
      datawaveLogs.forEach((log) => {
        const isMatched = matchSigmaRuleAgainstLog(log, sigmaEditorText);
        if (isMatched) {
          foundMatches++;
          matchedLogs.push(log);
        }
      });

      if (foundMatches > 0) {
        setScanStatus("matched");
        setMatchCount(foundMatches);
        playAlertSound();

        // Spawn actual alert warnings based on matches dynamically!
        const generatedRuleName = sigmaEditorText.split("\n")
          .find(line => line.toLowerCase().includes("title:"))
          ?.split(":")[1]?.trim() || "Dynamic_Sigma_Trigger";

        const generatedDesc = `Echtzeit-Treffer (${foundMatches}) auf Logbuch-Indexen detektiert. Beispielhafter Auslöser: "${matchedLogs[0].message}"`;

        const newAlert: ElitewolfAlert = {
          id: `alert_dyn_${Math.floor(Math.random() * 10000)}`,
          timestamp: new Date().toISOString(),
          ruleName: generatedRuleName,
          mitreTactics: ["Real-time Detection", "Tactical Rule"],
          mitreIds: ["T1059", "T1048"],
          description: generatedDesc,
          status: "Neu",
          severity: "high",
          sigmaRule: sigmaEditorText
        };

        setActiveAlerts(prev => [newAlert, ...prev]);
        setSelectedAlertIndex(0);
        
        alert(`Alarme ausgelöst! ${foundMatches} Protokollzeilen entsprechen der geänderten Sigma-Erkennungsregel.`);
      } else {
        setScanStatus("done");
        alert("Kompilierung erfolgreich: Die Regel hat keine treffenden Signaturen in den aktuellen Datawave-Logs gefunden.");
      }
    }, 1205);
  };

  const updateAlertStatus = async (id: string, status: any) => {
    setActiveAlerts(prev =>
      prev.map(a => (a.id === id ? { ...a, status } : a))
    );

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "alert_statuses", id), {
          id: id,
          scenarioId: scenarioId,
          status: status,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `alert_statuses/${id}`);
      }
    }
  };

  const deleteAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
    setSelectedAlertIndex(0);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="elitewolf_container">
      {/* Sidebar: Active rules / Alerts index */}
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
              Aktive Sigma-Regeln
            </h3>
            <span className="text-[10px] font-mono font-bold bg-neutral-950 px-2 py-0.5 rounded text-neutral-400 border border-neutral-800">
              YAML FORMAT
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {activeAlerts.map((alert, idx) => (
              <button
                key={alert.id}
                id={`alert_rule_btn_${idx}`}
                onClick={() => {
                  setSelectedAlertIndex(idx);
                  setSigmaEditorText(alert.sigmaRule);
                }}
                className={`w-full text-left p-3 rounded-lg border font-mono text-xs flex items-center justify-between transition-colors ${
                  selectedAlertIndex === idx
                    ? "bg-red-500/10 border-red-500/80 text-red-400"
                    : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                }`}
              >
                <div className="truncate">
                  <div className="font-bold truncate text-[11px]">{alert.ruleName}</div>
                  <div className="text-[10px] text-neutral-500 mt-1">{alert.timestamp.split("T")[0]}</div>
                </div>
                <Eye className={`w-3.5 h-3.5 flex-shrink-0 ${selectedAlertIndex === idx ? 'text-red-400' : 'text-neutral-700'}`} />
              </button>
            ))}
          </div>

          {currentAlert && (
            <div className="mt-6 border-t border-neutral-800 pt-4 text-xs font-mono space-y-1.5 text-neutral-400">
              <div className="flex justify-between">
                <span>Mitre IDs:</span>
                <span className="text-red-300">{currentAlert.mitreIds.join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span>Taktiken:</span>
                <span className="text-neutral-300 font-sans text-[11px] text-right truncate max-w-[150px]">{currentAlert.mitreTactics.join(", ")}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center & Right column: YAML Editor & Compile Scan Actions */}
      <div className="xl:col-span-8 space-y-6">
        {/* Real Dynamic Sigma YAML compiler */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-theme-blue" />
                Elitewolf: Sigma Rule Editor & Compiler
              </h3>
              <p className="text-xs text-neutral-400">Passe Erkennungsmuster im laufenden Betrieb an und klicke auf scannen.</p>
            </div>

            <div className="flex gap-2">
              <button
                id="btn_share_rule_consultant"
                onClick={() => {
                  onSelectRuleContext(sigmaEditorText);
                  alert("Die Sigma-Regel wurde temporär im KI-Sicherheitsberater zwischengespeichert.");
                }}
                className="text-[11px] font-mono bg-neutral-800 border border-neutral-700 hover:bg-neutral-750 text-neutral-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                Regel an KI senden
              </button>

              <button
                id="btn_scan_sigma_rules"
                onClick={handleCompileAndScan}
                disabled={scanStatus === "running"}
                className={`text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer min-w-[130px] justify-center ${
                  scanStatus === "running"
                    ? "bg-neutral-800 text-neutral-500 border-neutral-750 cursor-not-allowed"
                    : "bg-red-650 hover:bg-red-700 text-white border-red-600 shadow"
                }`}
              >
                {scanStatus === "running" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Kompiliere...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Scannen starten
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              id="sigma_yml_textarea"
              rows={12}
              value={sigmaEditorText}
              onChange={(e) => setSigmaEditorText(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 p-4 rounded-lg text-emerald-500 font-mono text-xs outline-none resize-none select-all leading-relaxed"
            />
            {scanStatus === "running" && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                <div className="text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-red-500 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-300 font-mono">Prüfe YAML Syntax & fahre Suchloop über Logdatenbank...</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500 min-h-[16px]">
            <span>Direkt editierbare Sigma-Syntax</span>
            <div className="font-mono text-[10px] text-right">
              {scanStatus === "running" && (
                <span className="text-amber-500 animate-pulse">Analysiere Logs...</span>
              )}
              {scanStatus === "matched" && (
                <span className="text-red-400 font-bold animate-pulse">● Alarme ausgelöst! {matchCount} Treffer indiziert.</span>
              )}
              {scanStatus === "done" && (
                <span className="text-emerald-400 font-bold">✓ Suche abgeschlossen (0 Treffer).</span>
              )}
              {scanStatus === "idle" && (
                <span className="text-neutral-500">Bereit für Scan-Abgleich</span>
              )}
            </div>
          </div>
        </div>

        {/* Selected Alert attributes / Operational classification */}
        {currentAlert && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  Alarmierung: <span className="text-red-400 font-mono">{currentAlert.ruleName}</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">Sicherheitsereignis zur Bewertung und Einstufung freigegeben</p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-neutral-500">Klassifikation:</span>
                <select
                  value={currentAlert.status}
                  onChange={(e) => updateAlertStatus(currentAlert.id, e.target.value as any)}
                  className="bg-neutral-950 text-neutral-200 border border-neutral-850 px-2.5 py-1 rounded text-xs outline-none font-bold"
                >
                  <option value="Neu">Neu</option>
                  <option value="Eskaliert">Eskaliert</option>
                  <option value="Fehlalarm">Fehlalarm</option>
                  <option value="Gelöst">Gelöst</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-neutral-300 space-y-3 leading-relaxed">
              <div className="p-3 bg-neutral-950 border border-neutral-850 rounded min-h-[72px]">
                <span className="font-bold text-red-400 block mb-1">Details:</span>
                {currentAlert.description}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1 font-mono text-[11px] text-neutral-550 border-t border-neutral-900">
                <div>
                  <span className="block text-neutral-500 text-[10px] uppercase">Zeitstempel</span>
                  <span className="text-neutral-300">{currentAlert.timestamp.replace("T", " ").replace("Z", "")}</span>
                </div>
                <div>
                  <span className="block text-neutral-500 text-[10px] uppercase">Gefahrenklasse</span>
                  <span className="text-red-400 font-bold">CRITICAL</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-900">
              <button
                id="btn_delete_active_alert"
                onClick={() => deleteAlert(currentAlert.id)}
                className="bg-red-950/40 hover:bg-neutral-800 text-red-400 hover:text-red-300 border border-red-900/40 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono flex items-center gap-1 cursor-pointer"
              >
                <Trash className="w-3.5 h-3.5" />
                Meldung verwerfen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
