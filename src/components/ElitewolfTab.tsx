import React, { useState, useEffect } from "react";
import { ElitewolfAlert, SecurityLog } from "../types";
import { matchSigmaRuleAgainstLog, validateSigmaRule, formatAndFixSigmaRule } from "../utils";
import { Play, ShieldAlert, Terminal, Eye, CheckCircle, RefreshCw, Volume2, Edit3, Trash, AlertTriangle, Info, Check, Copy } from "lucide-react";
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
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);
  const [sigmaEditorText, setSigmaEditorText] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "done" | "matched">("idle");
  const [matchCount, setMatchCount] = useState(0);
  const [lastLoadedAlertId, setLastLoadedAlertId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const validation = validateSigmaRule(sigmaEditorText);

  const handleCopyToClipboard = () => {
    const formatted = formatAndFixSigmaRule(sigmaEditorText);
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Kopieren fehlgeschlagen: ", err);
    });
  };

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

  // Reset selectedAlertIndex to 0 on scenario change
  useEffect(() => {
    setSelectedAlertIndex(0);
  }, [scenarioId]);

  const currentAlert = alerts[selectedAlertIndex] || alerts[0];

  // Synchronize rule editor text based on the active alert's unique ID
  useEffect(() => {
    if (currentAlert) {
      if (currentAlert.id !== lastLoadedAlertId) {
        setSigmaEditorText(currentAlert.sigmaRule);
        setLastLoadedAlertId(currentAlert.id);
      }
    } else {
      setSigmaEditorText("");
      setLastLoadedAlertId(null);
    }
  }, [currentAlert, lastLoadedAlertId]);

  // Stand-alone rule compiler and evaluation loop matches YAML attributes against Datawave logs
  const handleCompileAndScan = () => {
    if (!sigmaEditorText) return;

    // Auto-fix indentation, tabs and colons prior to running the compiler / scan!
    const formatted = formatAndFixSigmaRule(sigmaEditorText);
    setSigmaEditorText(formatted);

    // Also update current active alert in alerts list as part of saving
    const updatedAlerts = alerts.map((a, idx) => 
      idx === selectedAlertIndex ? { ...a, sigmaRule: formatted } : a
    );
    onAlertsUpdated(updatedAlerts);

    setScanStatus("running");
    setMatchCount(0);

    // Simulate scanning iteration cycle delay
    setTimeout(() => {
      let foundMatches = 0;
      const matchedLogs: SecurityLog[] = [];

      // Scan all logs in current Datawave cache for signatures
      datawaveLogs.forEach((log) => {
        const isMatched = matchSigmaRuleAgainstLog(log, formatted);
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
        const generatedRuleName = formatted.split("\n")
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
          sigmaRule: formatted
        };

        onAlertsUpdated([newAlert, ...updatedAlerts]);
        setSelectedAlertIndex(0);
        
        alert(`Alarme ausgelöst! ${foundMatches} Protokollzeilen entsprechen der geänderten Sigma-Erkennungsregel.`);
      } else {
        setScanStatus("done");
        alert("Kompilierung erfolgreich: Die Regel hat keine treffenden Signaturen in den aktuellen Datawave-Logs gefunden.");
      }
    }, 1205);
  };

  const updateAlertStatus = async (id: string, status: any) => {
    const updated = alerts.map(a => (a.id === id ? { ...a, status } : a));
    onAlertsUpdated(updated);

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
    onAlertsUpdated(alerts.filter(a => a.id !== id));
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
            {alerts.map((alert, idx) => (
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative">
            {/* Left side: Editor TextArea */}
            <div className="lg:col-span-7 flex flex-col relative">
              {/* Header bar controls directly above the textarea */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                {/* Real-time Validation Status Indicator */}
                <div 
                  id="sigma_validation_indicator"
                  className={`flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    validation.isValidYaml && !validation.errors.some(e => e.severity === "critical" || e.severity === "warning")
                      ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400"
                      : "bg-red-950/30 border-red-500/30 text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className={`w-2 h-2 rounded-full ${validation.isValidYaml && !validation.errors.some(e => e.severity === "critical" || e.severity === "warning") ? "bg-emerald-400 animate-pulse" : "bg-red-500"} shadow`} />
                    <span>STATUS: <span className="font-bold">{validation.isValidYaml && !validation.errors.some(e => e.severity === "critical" || e.severity === "warning") ? "GRÜN (VALID)" : "ROT (FEHLERHAFT)"}</span></span>
                  </div>
                  <span className="text-[10px] text-neutral-500">
                    {validation.errors.length === 0 ? "Keine Fehler" : `${validation.errors.length} Befunde`}
                  </span>
                </div>

                {/* Clipboard Copy Action */}
                <button
                  id="btn_copy_sigma_rule"
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="flex items-center justify-center gap-1 border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer select-none transition-all"
                  title="In die Zwischenablage kopieren"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3px]" />
                      <span className="text-emerald-400 font-bold">Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      <span>In Zwischenablage kopieren</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                id="sigma_yml_textarea"
                rows={15}
                value={sigmaEditorText}
                onChange={(e) => setSigmaEditorText(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 p-4 rounded-lg text-emerald-400 font-mono text-xs outline-none resize-none select-all leading-relaxed h-[350px] custom-scrollbar"
              />
            </div>

            {/* Right side: Real-time Validator Panel */}
            <div className="lg:col-span-5 bg-neutral-950/70 border border-neutral-850 rounded-lg p-4 font-mono text-xs flex flex-col justify-between h-[350px] overflow-y-auto custom-scrollbar">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">Syntaktische Analyse</span>
                  {validation.isValidYaml ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Syntax OK
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/40 text-[10px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      Syntax Fehler
                    </span>
                  )}
                </div>

                {/* Progress / Schema components check status dots */}
                <div className="grid grid-cols-2 gap-2 mb-4 bg-neutral-900/60 p-2.5 rounded border border-neutral-850 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${validation.errors.some(e => e.message.includes("title")) ? "bg-neutral-700" : "bg-emerald-400"}`} />
                    <span className="text-neutral-400">title</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${validation.errors.some(e => e.message.includes("id")) ? "bg-neutral-700" : "bg-emerald-400"}`} />
                    <span className="text-neutral-400">id (UUIDv4)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${validation.errors.some(e => e.message.includes("logsource")) ? "bg-neutral-700" : "bg-emerald-400"}`} />
                    <span className="text-neutral-400">logsource</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${validation.errors.some(e => e.message.includes("detection")) || validation.errors.some(e => e.message.includes("condition")) ? "bg-neutral-700" : "bg-emerald-400"}`} />
                    <span className="text-neutral-400">detection / condition</span>
                  </div>
                </div>

                {/* Validation checklist status */}
                <div className="space-y-2">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase pb-1 border-b border-neutral-900">
                    Befund-Diagnose ({validation.errors.length})
                  </div>
                  {validation.errors.length === 0 ? (
                    <div className="text-neutral-400 py-6 text-center text-[11px] leading-relaxed flex flex-col items-center justify-center gap-2">
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                      <div>
                        <p className="text-emerald-400 font-bold">Schema vollständig</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Diese Erkennungsregel entspricht allen Richtlinien.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {validation.errors.map((err, i) => (
                        <div key={i} className={`p-2 rounded border text-[11px] leading-tight flex items-start gap-1.5 ${
                          err.severity === "critical"
                            ? "bg-red-950/20 border-red-950/30 text-red-400"
                            : err.severity === "warning"
                            ? "bg-amber-950/20 border-amber-950/30 text-amber-500"
                            : "bg-blue-950/20 border-blue-950/30 text-blue-400"
                        }`}>
                          {err.severity === "critical" ? (
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          ) : err.severity === "warning" ? (
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                          ) : (
                            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400" />
                          )}
                          <div className="text-[10px] leading-relaxed">
                            {err.line && <span className="font-bold mr-1 underline">Z. {err.line}:</span>}
                            {err.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions / Auto-fix options */}
              <div className="mt-3 pt-3 border-t border-neutral-900 flex justify-between items-center text-[10px] text-neutral-500">
                <span>Abschnitte: {validation.detectedSections.join(", ") || "-"}</span>
                <button
                  id="btn_format_autofix_yml"
                  onClick={() => {
                    const formatted = formatAndFixSigmaRule(sigmaEditorText);
                    setSigmaEditorText(formatted);
                    
                    // Also save/update the currently selected alert's rule text in parent state
                    if (alerts.length > 0) {
                      const updatedAlerts = alerts.map((a, idx) => 
                        idx === selectedAlertIndex ? { ...a, sigmaRule: formatted } : a
                      );
                      onAlertsUpdated(updatedAlerts);
                    }
                  }}
                  className="bg-neutral-900 border border-neutral-805 hover:bg-neutral-800 text-amber-500 hover:text-amber-400 font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer select-none"
                  title="Ersetzt Tabulatoren durch zwei Leerzeichen und korrigiert YAML-Einrückungen."
                >
                  <RefreshCw className="w-3 h-3 text-amber-500 animate-pulse" />
                  Format-Autofix
                </button>
              </div>
            </div>

            {scanStatus === "running" && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg z-10">
                <div className="text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-red-500 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-300 font-mono font-medium">Validierung & Suchabgleich läuft...</p>
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
