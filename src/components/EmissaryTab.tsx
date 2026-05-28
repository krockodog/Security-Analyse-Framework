import React from "react";
import { Scenario } from "../types";
import { Cpu, HardDrive, FileCheck, Layers, ShieldCheck, Download } from "lucide-react";

interface EmissaryTabProps {
  scenario: Scenario;
}

export default function EmissaryTab({ scenario }: EmissaryTabProps) {
  const fw = scenario.firmwareDetails;

  // Generate a mock binary byte distribution frequency array based on scenario entropy for the inline SVG histogram
  const getByteFrequencies = () => {
    // Highly randomized distribution for Mirai (encrypted firmware) vs focused spikes for standard DLLs
    const seed = scenario.id === 'szenario_a' ? 0.9 : scenario.id === 'szenario_b' ? 0.4 : 0.65;
    const freqs: number[] = [];
    for (let i = 0; i < 32; i++) {
      // Simulate frequency peaks
      const baseFreq = Math.abs(Math.sin(i * 0.25)) * 60 + 10;
      const noise = Math.random() * 20;
      const entropyMod = seed > 0.8 ? (40 + Math.random() * 30) : (baseFreq + noise);
      freqs.push(Math.round(Math.min(100, entropyMod)));
    }
    return freqs;
  };

  const byteDistribution = getByteFrequencies();

  const handleDownloadReport = () => {
    const reportData = {
      report_generated_at: new Date().toISOString(),
      generated_by: "Sicherheits-Analyse-Framework",
      module: "Emissary Ingest Engine",
      scenario: {
        id: scenario.id,
        title: scenario.title,
        category: scenario.category,
        description: scenario.description,
        target_device: scenario.targetDevice
      },
      file_details: {
        name: scenario.ingestFile.name,
        size: scenario.ingestFile.size,
        type: scenario.ingestFile.type,
        source: scenario.ingestFile.source,
        sha255_hash: scenario.ingestFile.hash,
        entropy: scenario.ingestFile.entropy
      },
      firmware_analysis: scenario.firmwareDetails ? {
        file_system: scenario.firmwareDetails.fileSystem,
        partitions: scenario.firmwareDetails.partitions,
        entropy_score: scenario.firmwareDetails.entropyScore,
        unpacked_binaries: scenario.firmwareDetails.unpackedBinaries
      } : "n/a (PE/ELF executable)",
      forensic_statistics: {
        total_ghidra_binaries: scenario.ghidraReports.length,
        total_graph_nodes: scenario.graphData.nodes.length,
        total_graph_edges: scenario.graphData.edges.length,
        total_datawave_logs: scenario.datawaveLogs.length,
        total_elitewolf_alerts: scenario.elitewolfAlerts.length
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `forensic_report_${scenario.ingestFile.name.replace(/\.[^/.]+$/, "")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-neutral-500 text-[10px]">Dateiname</span>
                <span className="text-neutral-200 font-bold truncate select-all">{scenario.ingestFile.name}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-900 pt-1.5">
                <span className="text-neutral-500">Größe:</span>
                <span className="text-neutral-300">{scenario.ingestFile.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Dateityp:</span>
                <span className="text-neutral-300">{scenario.ingestFile.type}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-neutral-500 text-[10px] block">Datenquelle (Emissary Erfassung)</span>
              <p className="text-[11px] text-neutral-400 font-sans leading-relaxed bg-neutral-950 p-3 rounded-lg border border-neutral-900">
                {scenario.ingestFile.source}
              </p>
            </div>

            <div className="space-y-1 border-t border-neutral-900 pt-3 col-span-1">
              <span className="text-neutral-500 text-[10px] block">Digitale Prüfsumme (SHA-256)</span>
              <span className="text-[10px] text-zinc-400 break-all bg-neutral-950 p-2 border border-neutral-850 rounded block select-all">
                {scenario.ingestFile.hash}
              </span>
            </div>

            <div className="pt-3 border-t border-neutral-900">
              <button
                id="btn_download_emissary_report"
                onClick={handleDownloadReport}
                className="w-full bg-theme-blue hover:bg-theme-blue/80 text-white font-sans font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Bericht herunterladen (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Unpacking and Byte Distribution Graph */}
      <div className="lg:col-span-8 space-y-6">
        {fw ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-theme-blue animate-pulse" />
              Firmware Partitionstabelle & Entpackung
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-1.5">
                <span className="text-neutral-500 text-[10px]">Identifiziertes Dateisystem</span>
                <span className="text-theme-blue font-bold block">{fw.fileSystem}</span>
                <span className="text-neutral-500 text-[10px] block pt-1 border-t border-neutral-900">Partitionen</span>
                <div className="flex flex-wrap gap-1">
                  {fw.partitions.map(part => (
                    <span key={part} className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-[9px] text-neutral-400">
                      {part}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-1.5">
                <span className="text-neutral-500 text-[10px]">Extrahierte ausführbare Programme</span>
                <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                  {fw.unpackedBinaries.map(bin => (
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
            <Layers className="w-5 h-5 mr-2 text-neutral-600" />
            Keine direkt entpackbaren Dateisystem-Partitionen (PE/ELF-Binärdatei).
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
              <g className="fill-theme-blue/30 stroke-theme-blue border-neutral-800" strokeWidth="0.5">
                {byteDistribution.map((freq, idx) => {
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
                Verteilungs-Entropie: <span className="text-theme-blue">{fw ? fw.entropyScore : scenario.ingestFile.entropy || 5.9} bits/Byte</span>
              </span>
              <span>Hohe Byte-Werte (0xFF)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
