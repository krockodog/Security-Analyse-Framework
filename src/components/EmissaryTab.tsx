import React, { useState, useEffect } from "react";
import { Scenario } from "../types";
import { Cpu, HardDrive, FileCheck, Layers, ShieldCheck, Download, UploadCloud, Play, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { calculateShannonEntropy } from "../utils";
import { jsPDF } from "jspdf";

interface EmissaryTabProps {
  scenario: Scenario;
}

export default function EmissaryTab({ scenario }: EmissaryTabProps) {
  // Mode selection: "scenario" (standard firmwares) vs "local" (analyzer workspace)
  const [sourceMode, setSourceMode] = useState<"scenario" | "local">("scenario");

  // Local file scan state parameters
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepMsg, setScanStepMsg] = useState("");
  const [localFile, setLocalFile] = useState<{
    name: string;
    size: string;
    type: string;
    hash: string;
    entropy: number;
    byteDistribution: number[];
    isEncrypted: boolean;
    malwareSignals: string[];
  } | null>(null);

  const [dragOver, setDragOver] = useState(false);

  // Sync state or reset local file when switching scenarios
  useEffect(() => {
    // If scenario changes, default back to scenario mode for consistency
    setSourceMode("scenario");
  }, [scenario.id]);

  const getByteFrequenciesScenario = () => {
    const seed = scenario.id === 'szenario_a' ? 0.9 : scenario.id === 'szenario_b' ? 0.4 : 0.65;
    const freqs: number[] = [];
    for (let i = 0; i < 32; i++) {
      const baseFreq = Math.abs(Math.sin(i * 0.25)) * 60 + 10;
      const noise = Math.random() * 20;
      const entropyMod = seed > 0.8 ? (40 + Math.random() * 30) : (baseFreq + noise);
      freqs.push(Math.round(Math.min(100, entropyMod)));
    }
    return freqs;
  };

  const byteDistributionScenario = getByteFrequenciesScenario();

  // Active metrics depending on the chosen mode
  const activeName = sourceMode === "scenario" ? scenario.ingestFile.name : (localFile ? localFile.name : "Keine Datei geladen");
  const activeSize = sourceMode === "scenario" ? scenario.ingestFile.size : (localFile ? localFile.size : "n/a");
  const activeType = sourceMode === "scenario" ? scenario.ingestFile.type : (localFile ? localFile.type : "n/a");
  const activeSource = sourceMode === "scenario" ? scenario.ingestFile.source : "Manueller lokaler System- & Virenscan.";
  const activeHash = sourceMode === "scenario" ? scenario.ingestFile.hash : (localFile ? localFile.hash : "n/a");
  const activeEntropy = sourceMode === "scenario" ? scenario.ingestFile.entropy : (localFile ? localFile.entropy : 0);
  const activeByteDistribution = sourceMode === "scenario" ? byteDistributionScenario : (localFile ? localFile.byteDistribution : Array(32).fill(10));

  const handleLocalFileUpload = async (file: File) => {
    setIsScanning(true);
    setScanProgress(5);
    setScanStepMsg("Initialisiere lokalen Ingestion-Port...");

    try {
      // 1. Array buffer extraction
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Simulation steps to show full cybersecurity pipeline diagnostic
      setTimeout(async () => {
        setScanProgress(25);
        setScanStepMsg("Berechne kryptografische SHA-256 Prüfsumme...");

        const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const realHash = "sha256:" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        setTimeout(() => {
          setScanProgress(55);
          setScanStepMsg("Berechne Shannon-Entropie (Zufälligkeitsgrad)...");
          const entropyValue = calculateShannonEntropy(uint8Array);

          setTimeout(() => {
            setScanProgress(80);
            setScanStepMsg("Indiziere Byte-Frequenz-Spektrum (Visualisierung)...");

            // Group 256 byte values into 32 SVG-friendly buckets
            const freqs = new Uint32Array(32);
            for (let i = 0; i < uint8Array.length; i++) {
              const bucket = Math.floor(uint8Array[i] / 8);
              freqs[bucket]++;
            }
            const maxVal = Math.max(...Array.from(freqs)) || 1;
            const liveDistribution = Array.from(freqs).map(val => Math.round((val / maxVal) * 100));

            // Run mock signature analysis
            const malSignals: string[] = [];
            if (entropyValue > 7.3) {
              malSignals.push("Hohe Entropie: Eventuell gepackt, verschleiert oder verschlüsselt.");
            }
            const nameLower = file.name.toLowerCase();
            if (nameLower.includes("patched") || nameLower.includes("backdoor") || nameLower.includes("mirai") || nameLower.includes("ransom") || nameLower.includes("malware") || nameLower.includes("exe")) {
              malSignals.push("Namens-Indikator: Verdächtige Dateierweiterung oder Patch-Signatur.");
            }
            if (file.size > 20 * 1024 * 1024) {
              malSignals.push("Anomalie: Ungewöhnlich große Firmware für Embedded Targets.");
            }

            setTimeout(() => {
              setScanProgress(100);
              setIsScanning(false);
              setScanStepMsg("Lokaler Scan erfolgreich abgeschlossen!");

              setLocalFile({
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(3) + " MB",
                type: file.type || "Binärdatei / Unbekannte Partition",
                hash: realHash,
                entropy: entropyValue,
                byteDistribution: liveDistribution,
                isEncrypted: entropyValue > 7.3,
                malwareSignals: malSignals
              });
            }, 800);
          }, 800);
        }, 800);
      }, 600);

    } catch (err) {
      console.error(err);
      setIsScanning(false);
      setScanStepMsg("Fehler beim Verarbeiten.");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => {
    setDragOver(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleLocalFileUpload(file);
    }
  };

  const handleDownloadReport = () => {
    // Generate an enterprise ready crisp looking PDF Report
    const doc = new jsPDF();

    // Dark slate banner header on top page
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, "F");

    // Corporate style Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246); // theme blue
    doc.text("SICHERHEITS-ANALYSE-RAHMENWERK", 14, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("FORENSISCHER SYSTEM- & EMISSARY-INGESTIONSBERICHT // ENTERPRISE CORE", 14, 26);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(239, 68, 68); // Red class
    doc.text("KLASSIFIKATION: STRENG VERTRAULICH", 14, 32);

    // Meta blocks on top right
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Generiert am: ${new Date().toLocaleString("de-DE")}`, 135, 18);
    doc.text(`Scenario Context: ${scenario.title}`, 135, 24);
    doc.text(`Erfassungsart: ${sourceMode === "scenario" ? "SZR-FLASH" : "LOKALER SCAN"}`, 135, 30);

    // Grid divider
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 45, 196, 45);

    let y = 54;

    const printHeader = (title: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, y);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, y + 2, 196, y + 2);
      y += 10;
    };

    const printLine = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(label, 14, y);
      doc.setFont("helvetica", "normal");
      
      // Split value if it is too long to prevent overflowing PDF borders
      const valWrapStr = doc.splitTextToSize(value, 130);
      doc.text(valWrapStr, 60, y);
      y += 8 + (valWrapStr.length - 1) * 4;
    };

    // Module 1: Source Specific payload details
    printHeader("1. Technische Ingest-Daten & Metadaten");
    printLine("Analysierter Dateiname:", activeName);
    printLine("Dateigröße (Bytes/MB):", activeSize);
    printLine("Identifizierter Typ:", activeType);
    printLine("Kryptografischer Hash:", activeHash);
    printLine("Shannon-Entropiewert:", `${activeEntropy} bits/Byte`);
    printLine("Quelle / Logist-Pfad:", activeSource);

    y += 4;

    // Module 2: Firmware & Binary partition specifics (if firmware selected)
    printHeader("2. Partitionierung & Dateisystem-Informationen");
    if (sourceMode === "scenario" && scenario.firmwareDetails) {
      printLine("Dateisystem-Standard:", scenario.firmwareDetails.fileSystem);
      printLine("Erkannte Partitionen:", scenario.firmwareDetails.partitions.join(" | "));
      printLine("Extrahierte Programme:", scenario.firmwareDetails.unpackedBinaries.join(", "));
    } else if (sourceMode === "local" && localFile) {
      printLine("Dateisystem-Analyse:", "Lokale Hochgeladene Nutzdatei (Binärdaten segmentsunabhängig).");
      printLine("Bedrohungsmerkmale:", localFile.malwareSignals.length > 0 ? localFile.malwareSignals.join(", ") : "Keine direkten Bedrohungsmerkmale gefunden.");
    } else {
      printLine("Strukturelle Analyse:", "Keine direkt entpackbaren Partitionen vorhanden (PE/ELF ausführbarer Dateityp).");
    }

    y += 4;

    // Module 3: System correlation stats
    printHeader("3. Korrelierte Pipeline-Kennzahlen");
    printLine("Ghidra Reversing-Berichte:", `${scenario.ghidraReports.length} kompilierte Binärdateien`);
    printLine("LemonGraph Bedrohungs-Knoten:", `${scenario.graphData.nodes.length} Knotenpunkte vorhanden`);
    printLine("Datawave Log-Datensätze:", `${scenario.datawaveLogs.length} auditierte Systemprotokolle`);
    printLine("Elitewolf Erkennungsregeln:", `${scenario.elitewolfAlerts.length} aktive Bedrohungs-Rules`);

    y += 4;

    // Module 4: Live forensic risk assessment summary
    printHeader("4. Statische Risikobewertung des Analysten");
    let riskLabel = "MITTEL-GEFÄHRLICH";
    let riskDesc = "Der Entropiewert zeigt eine normale Verteilung. Eine manuelle Überprüfung der Strings und exportierten API-Funktionen im Ghidra-Decompiler-Tab wird dringenst empfohlen.";
    let rColor = [217, 119, 6]; // Yellow-amber-600

    if (activeEntropy > 7.3) {
      riskLabel = "EMISSARY KRITISCH (HOHE ENTROPIE)";
      riskDesc = "Achtung! Extrem hohe Entropie weist mit über 95%iger Wahrscheinlichkeit auf Verschlüsselung, Kompression oder Malware-Anti-Analyse-Packing (wie UPX) hin. Suchen Sie in Ghidra nach unverschlüsselten Dekomprimierroutinen.";
      rColor = [220, 38, 38]; // Red-600
    } else if (activeEntropy < 4.0) {
      riskLabel = "UNVERFÄLSCHTER CODE / STANDARD SCHRIFT";
      riskDesc = "Normale Entropie. Es handelt sich wahrscheinlich um nicht-obfuszierte Skripte, Logdateien oder Klartextkonfiguratoren.";
      rColor = [5, 150, 105]; // Emerald-600
    }

    // Draw solid state badge background block
    doc.setFillColor(rColor[0], rColor[1], rColor[2]);
    doc.rect(14, y - 2, 100, 8, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`RISIKOSTUFE: ${riskLabel}`, 18, y + 3);

    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const wrapDesc = doc.splitTextToSize(riskDesc, 180);
    doc.text(wrapDesc, 14, y);

    // Base copyright footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Sicherheits-Analyse-Framework Enterprise Core // Emissary v3.2 // Bericht ist für behördliche Einstufung freigegeben", 14, 282);

    // Save/Download operation
    doc.save(`Forensik_Systembericht_${activeName.replace(/\.[^/.]+$/, "")}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="emissary_container">
      {/* File metadata info */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg relative">
          <div className="absolute top-0 right-0 h-1 text-blue-500 font-mono text-[9px] px-2 py-0.5 bg-blue-500/20 rounded-bl-lg border-l border-b border-neutral-800">
            INGEST PORTAL
          </div>
          
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-theme-blue" />
            Emissary Ingest-Details
          </h3>

          {/* Source Selection segmented tab switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-850 mb-4 text-xs font-mono">
            <button
              id="btn_mode_scenario"
              onClick={() => setSourceMode("scenario")}
              className={`py-1.5 rounded-md text-center transition-all cursor-pointer font-semibold ${
                sourceMode === "scenario"
                  ? "bg-theme-blue text-white shadow"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Szenario-Daten
            </button>
            <button
              id="btn_mode_local_scan"
              onClick={() => setSourceMode("local")}
              className={`py-1.5 rounded-md text-center transition-all cursor-pointer font-semibold flex items-center justify-center gap-0.5 ${
                sourceMode === "local"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-neutral-400 hover:text-emerald-500"
              }`}
            >
              Lokaler Scan
            </button>
          </div>

          <div className="space-y-4 text-xs font-mono">
            {sourceMode === "scenario" ? (
              <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-neutral-500 text-[10px]">Dateiname</span>
                  <span className="text-neutral-200 font-bold truncate select-all">{scenario.ingestFile.name}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-900 pt-1.5 font-mono">
                  <span className="text-neutral-500">Größe:</span>
                  <span className="text-neutral-300">{scenario.ingestFile.size}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-neutral-500">Dateityp:</span>
                  <span className="text-neutral-300">{scenario.ingestFile.type}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Custom uploader workspace */}
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    dragOver 
                      ? "border-emerald-500 bg-emerald-950/10" 
                      : "border-neutral-800 bg-neutral-950 hover:border-emerald-600/60"
                  }`}
                >
                  <label className="cursor-pointer flex flex-col items-center justify-center w-full">
                    <UploadCloud className={`w-8 h-8 mb-2 ${dragOver ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    <span className="text-[11px] font-bold text-neutral-300">Nutzdatei auswählen oder ablegen</span>
                    <span className="text-[9px] text-neutral-500 mt-1 block">Berechnet reale Entropie, Hashes & Muster</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      id="emissary_local_file_input"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLocalFileUpload(file);
                      }} 
                    />
                  </label>
                </div>

                {/* Progress bar scanner animation */}
                {isScanning && (
                  <div className="p-3 bg-neutral-950 border border-emerald-900/40 rounded-lg space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-emerald-500 font-bold flex items-center gap-1 animate-pulse">
                        <span className="animate-spin text-xs">⚙</span> {scanStepMsg}
                      </span>
                      <span className="text-neutral-400">{scanProgress}%</span>
                    </div>
                    <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {localFile ? (
                  <div className="p-3 bg-neutral-950 border border-emerald-950/50 rounded-lg space-y-2">
                    <div className="flex justify-between border-b border-neutral-900 pb-1 text-[11px] text-emerald-500 font-bold">
                      <span>Analysiert:</span>
                      <span className="truncate max-w-[120px]">{localFile.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Dateigröße:</span>
                      <span className="text-neutral-300">{localFile.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Shannon-Entropie:</span>
                      <span className={`font-semibold ${localFile.entropy > 7.3 ? 'text-red-400' : 'text-emerald-400'}`}>{localFile.entropy} bits</span>
                    </div>
                    {localFile.malwareSignals.length > 0 && (
                      <div className="border-t border-neutral-900/80 pt-1.5 mt-1 space-y-1">
                        <span className="text-red-500 text-[9px] font-bold block flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          Gefundene Signaturen:
                        </span>
                        {localFile.malwareSignals.map((sig, sidx) => (
                          <span key={sidx} className="text-[10px] text-zinc-400 block leading-tight font-mono">✓ {sig}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  !isScanning && (
                    <div className="p-3 bg-neutral-950/60 border border-neutral-900/40 rounded-lg text-center py-5 text-neutral-500 text-[10px]">
                      Ergebnis-Pipeline bereit zur lokalen Erstellung.
                    </div>
                  )
                )}
              </div>
            )}

            <div className="space-y-1">
              <span className="text-neutral-500 text-[10px] block">Erfassungsmethode</span>
              <p className="text-[11px] text-neutral-400 font-sans leading-relaxed bg-neutral-950 p-3 rounded-lg border border-neutral-900">
                {activeSource}
              </p>
            </div>

            <div className="space-y-1 border-t border-neutral-900 pt-3 col-span-1">
              <span className="text-neutral-500 text-[10px] block">Prüfsumme (SHA-256)</span>
              <span className="text-[10px] text-zinc-400 break-all bg-neutral-950 p-2 border border-neutral-850 rounded block select-all">
                {activeHash}
              </span>
            </div>

            <div className="pt-3 border-t border-neutral-900">
              <button
                id="btn_download_emissary_report"
                onClick={handleDownloadReport}
                className="w-full bg-theme-blue hover:bg-theme-blue/80 text-white font-sans font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Bericht herunterladen (PDF)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Unpacking and Byte Distribution Graph */}
      <div className="lg:col-span-8 space-y-6">
        {sourceMode === "scenario" && scenario.firmwareDetails ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-theme-blue animate-pulse" />
              Firmware Partitionstabelle & Entpackung
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-1.5">
                <span className="text-neutral-500 text-[10px]">Identifiziertes Dateisystem</span>
                <span className="text-theme-blue font-bold block">{scenario.firmwareDetails.fileSystem}</span>
                <span className="text-neutral-500 text-[10px] block pt-1 border-t border-neutral-900 font-bold">Partitionen</span>
                <div className="flex flex-wrap gap-1">
                  {scenario.firmwareDetails.partitions.map(part => (
                    <span key={part} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[9px] text-neutral-400">
                      {part}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-1.5">
                <span className="text-neutral-500 text-[10px]">Extrahierte ausführbare Programme</span>
                <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                  {scenario.firmwareDetails.unpackedBinaries.map(bin => (
                    <div key={bin} className="flex items-center gap-1.5 text-neutral-300 text-[11px]">
                      <span className="text-emerald-500">⚙</span>
                      <span>{bin}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg flex items-center justify-center py-10 text-neutral-500 text-xs font-mono">
            <Layers className="w-5 h-5 mr-2 text-neutral-600 animate-pulse" />
            {sourceMode === "local" 
              ? "Einleseliste: Analysiere hochgeladene Binärpakete direkt im Zwischenspeicher (Lokaler Modus aktiv)."
              : "Keine direkt entpackbaren Dateisystem-Partitionen (PE/ELF-Binärdatei)."}
          </div>
        )}

        {/* Real-time looking Byte Dist Frequency Plot */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">
              Byte-Frequenz-Spektrum (Visualisierte Signal-Dichte)
            </h3>
            <p className="text-xs text-neutral-400">Verteilungsmuster der 256 möglichen Byte-Werte (gruppiert in 32 Buckets). Indikator für Kompression/Verschlüsselung.</p>
          </div>

          <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-4">
            {/* Inline SVG Bar Chart */}
            <svg viewBox="0 0 400 100" className="w-full h-24 select-none">
              <g className={`fill-theme-blue/30 ${sourceMode === "local" ? 'stroke-emerald-500 fill-emerald-500/20' : 'stroke-theme-blue'} border-neutral-800`} strokeWidth="0.5">
                {activeByteDistribution.map((freq, idx) => {
                  const x = idx * 12 + 10;
                  const h = freq * 0.8;
                  const y = 90 - h;
                  return (
                    <rect 
                      key={idx}
                      x={x}
                      y={y}
                      width="8"
                      height={h}
                      rx="1"
                      className="hover:fill-red-500/50 transition-colors pointer-events-auto cursor-help"
                    />
                  );
                })}
              </g>
              <line x1="0" y1="90" x2="400" y2="90" stroke="#1f1f1f" strokeWidth="1" />
            </svg>
            <div className="flex justify-between text-[9px] font-mono text-neutral-600 mt-2">
              <span>Niedrige Byte-Werte (0x00)</span>
              <span>
                Verteilungs-Entropie: <span className={sourceMode === "local" ? "text-emerald-500 font-bold" : "text-theme-blue font-bold"}>{sourceMode === "scenario" ? (scenario.firmwareDetails ? scenario.firmwareDetails.entropyScore : scenario.ingestFile.entropy || 5.9) : activeEntropy} bits/Byte</span>
              </span>
              <span>Hohe Byte-Werte (0xFF)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
