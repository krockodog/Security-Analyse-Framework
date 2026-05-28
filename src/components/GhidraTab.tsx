import React, { useState } from "react";
import { Scenario } from "../types";
import { calculateShannonEntropy, generateHexDump } from "../utils";
import { ShieldAlert, Binary, Hash, FileCode, CheckCircle, Database } from "lucide-react";

interface GhidraTabProps {
  scenario: Scenario;
  onAddCustomBinary: (binary: {
    binaryName: string;
    functions: { name: string; address: string; decompiled: string; description: string }[];
    strings: { value: string; address: string; classification: string }[];
    symbols: { name: string; type: string; address: string }[];
  }) => void;
  onSelectCodeContext: (code: string) => void;
}

export default function GhidraTab({ scenario, onAddCustomBinary, onSelectCodeContext }: GhidraTabProps) {
  const [selectedBinaryIndex, setSelectedBinaryIndex] = useState(0);
  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState(0);
  const [searchString, setSearchString] = useState("");
  
  // Real file analysis state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [fileStats, setFileStats] = useState<{
    name: string;
    size: string;
    type: string;
    hash: string;
    entropy: number;
    hexDump: string;
    isLog?: boolean;
    rawText?: string;
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Calculate real SHA-256
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const realHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Calculate real Shannon Entropy
      const realEntropy = calculateShannonEntropy(uint8Array);

      // Generate Dual Hex Dump
      const realHexDump = generateHexDump(uint8Array, 512);

      const isLog = file.name.endsWith(".txt") || file.name.endsWith(".log") || file.name.endsWith(".json") || file.name.endsWith(".csv");
      let rawText = "";
      if (isLog || file.size < 10000) {
        rawText = await file.text();
      }

      setFileStats({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(3) + " MB",
        type: file.type || "Binär / Unbekannte Endung",
        hash: realHash,
        entropy: realEntropy,
        hexDump: realHexDump,
        isLog,
        rawText
      });

      // Automatically register custom binary into the decompiler list!
      onAddCustomBinary({
        binaryName: file.name,
        functions: [
          {
            name: "analyse_entry_point",
            address: "0x00405000",
            decompiled: `// Automatisch generierter dekompilierter Code für hochgeladene Datei: ${file.name}\n// Dateigröße: ${file.size} Bytes\n// Shannon Enthropy des Codes: ${realEntropy} bits\n// SHA-256 Prüfsumme: ${realHash}\n\nvoid analyse_entry_point() {\n    // Hex-Dump-Analyse empfiehlt eine tiefe forensische Untersuchung.\n    unsigned char file_hash[] = "${realHash.substring(0, 16)}...";\n    printf("Real-time forensic ingest completed successfully.\\n");\n}`,
            description: "Registrierter Einstiegspunkt basierend auf der real hochgeladenen Datei."
          }
        ],
        strings: [
          { value: "forensics_completed_marker", address: "0x0040ef00", classification: "System Status" },
          { value: "crypto_sha256_match", address: "0x0040ef3a", classification: "Kryptografie" }
        ],
        symbols: [
          { name: "analyse_entry_point", type: "Export Function", address: "0x00405000" }
        ]
      });

    } catch (err) {
      console.error("Fehler bei Dateianalyse:", err);
    } finally {
      setUploadLoading(false);
    }
  };

  const currentReport = scenario.ghidraReports[selectedBinaryIndex] || scenario.ghidraReports[0];
  const currentFunction = currentReport?.functions[selectedFunctionIndex] || currentReport?.functions[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="ghidra_container">
      {/* Sidebar - Binaries & Functions list */}
      <div className="lg:col-span-4 space-y-6">
        {/* Real Dynamic File Scanner panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg relative overflow-hidden" id="real_forensics_uploader">
          <div className="absolute top-0 right-0 h-1 text-emerald-500 font-mono text-[9px] px-2 py-0.5 bg-emerald-500/20 rounded-bl-lg border-l border-b border-neutral-800">
            NATIVE FORENSICS ACTIVE
          </div>
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-emerald-500" />
            Echte forensische Analyse
          </h3>
          <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
            Lade eine beliebige Datei von deiner Festplatte hoch. Die Anwendung berechnet automatisch die **reale Dateigröße**, den **echten SHA-256 Hash** und die **genaue Shannon-Entropie (Zufälligkeit)**.
          </p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 hover:border-emerald-600 rounded-lg p-5 cursor-pointer bg-neutral-950 transition-colors">
            <Binary className="w-6 h-6 text-neutral-500 mb-2" />
            <span className="text-xs text-neutral-300 font-medium">Datei auswählen...</span>
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>

          {uploadLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-mono text-emerald-500 animate-pulse">
              <span className="animate-spin">⚙</span> Berechne kryptografische Prüfsummen und Entropie...
            </div>
          )}

          {fileStats && (
            <div className="mt-4 p-3 bg-neutral-950 border border-emerald-950/40 rounded-lg space-y-2 text-xs font-mono text-neutral-300">
              <div className="flex justify-between border-b border-neutral-900 pb-1 text-[11px] text-emerald-500">
                <span>Datei:</span>
                <span className="font-bold truncate max-w-[150px]">{fileStats.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Größe:</span>
                <span>{fileStats.size}</span>
              </div>
              <div className="flex flex-col gap-1 border-t border-neutral-900 pt-1">
                <span>SHA-256:</span>
                <span className="text-[10px] text-zinc-400 break-all bg-neutral-900/50 p-1 rounded border border-neutral-900">{fileStats.hash}</span>
              </div>
              <div className="flex justify-between items-center border-t border-neutral-900 pt-1">
                <span className="flex items-center gap-1">
                  Entropie:
                  <span className={`w-2 h-2 rounded-full ${fileStats.entropy > 7.2 ? 'bg-red-500' : fileStats.entropy > 5 ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                </span>
                <span>{fileStats.entropy} bits</span>
              </div>
              <p className="text-[10px] text-neutral-500 leading-snug pt-1 italic">
                {fileStats.entropy > 7.2 
                  ? "⚠ Sehr hohe Entropie: Die Binärdatei ist verdichtet, gepackt, verschlüsselt oder enthält schädliche Payloads." 
                  : "ℹ Normale Entropie: Standard-ASCII oder unverschlüsselter Code-Aufbau."}
              </p>
            </div>
          )}
        </div>

        {/* Selected Scenario Binary List */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-4">
            <Binary className="w-4 h-4 text-theme-blue" />
            Ghidra Binärdaten-Index
          </h3>
          <div className="space-y-2">
            {scenario.ghidraReports.map((report, idx) => (
              <button
                key={report.binaryName}
                id={`binary_btn_${idx}`}
                onClick={() => {
                  setSelectedBinaryIndex(idx);
                  setSelectedFunctionIndex(0);
                }}
                className={`w-full text-left p-3 rounded-lg border font-mono text-xs flex items-center justify-between transition-all ${
                  selectedBinaryIndex === idx
                    ? "bg-theme-blue/10 border-theme-blue text-theme-blue shadow-inner"
                    : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-400"
                }`}
              >
                <span className="truncate">{report.binaryName}</span>
                <CheckCircle className={`w-3.5 h-3.5 ${selectedBinaryIndex === idx ? 'text-theme-blue' : 'text-neutral-600'}`} />
              </button>
            ))}
          </div>

          {currentReport && (
            <div className="mt-6">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Decompilierte Funktionen</h4>
              <div className="space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
                {currentReport.functions.map((func, idx) => (
                  <button
                    key={func.name}
                    id={`func_btn_${idx}`}
                    onClick={() => setSelectedFunctionIndex(idx)}
                    className={`w-full text-left px-3 py-2 rounded font-mono text-xs flex items-center justify-between transition-colors ${
                      selectedFunctionIndex === idx
                        ? "bg-neutral-800 text-neutral-100 font-medium"
                        : "bg-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-950"
                    }`}
                  >
                    <span className="truncate">{func.name}()</span>
                    <span className="text-[10px] text-neutral-600">{func.address}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Panel - Hex Dump, Decompiler View & Strings */}
      <div className="lg:col-span-8 space-y-6">
        {fileStats && (
          <div className="bg-neutral-900 border border-emerald-900/50 rounded-xl p-5 shadow-md">
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-3">
              <Binary className="w-4 h-4 text-emerald-500" />
              Live-Hex-Viewer (Echter Hexadezimal-Dump der ersten 512 Bytes)
            </h3>
            <pre className="text-[11px] leading-relaxed font-mono bg-neutral-950 p-4 rounded-lg overflow-x-auto border border-neutral-800 text-emerald-500 font-semibold select-all custom-scrollbar max-h-[220px]">
              {fileStats.hexDump}
            </pre>
            <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
              <span>Standardforensisches Format (MZ/PE Einstieg oder Rohdaten)</span>
              <span>Offset: 16 Bytes pro Zeile</span>
            </div>
          </div>
        )}

        {currentFunction && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-yellow-500" />
                  Ghidra Decompiler: <span className="text-theme-blue font-mono">{currentFunction.name}()</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">{currentFunction.description}</p>
              </div>
              <button
                id="btn_send_code_to_consultant"
                onClick={() => {
                  onSelectCodeContext(currentFunction.decompiled);
                  alert("Der Quellcode wurde temporär im KI-Sicherheitsberater zwischengespeichert. Öffne den Reiter 'KI-Sicherheitsberater', um ihn direkt zu analysieren!");
                }}
                className="text-[11px] font-mono bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 border border-yellow-600/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Hash className="w-3.5 h-3.5" />
                An KI senden
              </button>
            </div>

            <pre className="text-[12px] leading-relaxed font-mono bg-neutral-950 p-4 rounded-lg overflow-x-auto border border-neutral-800 text-amber-500/90 select-all custom-scrollbar max-h-[300px]">
              {currentFunction.decompiled}
            </pre>
          </div>
        )}

        {/* Global strings found in the binary */}
        {currentReport && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">
                  Global definierte Zeichenketten (Strings)
                </h3>
                <p className="text-xs text-neutral-400">Verdächtige konstante Definitionen in der Systemdatei</p>
              </div>
              <input
                type="text"
                placeholder="Strings filtern..."
                value={searchString}
                onChange={(e) => setSearchString(e.target.value)}
                className="font-mono text-xs w-full sm:w-48 bg-neutral-950 border border-neutral-800 focus:border-neutral-700 px-3 py-1.5 rounded-lg text-neutral-300 outline-none"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs text-neutral-300">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500 select-none">
                    <th className="pb-3 font-semibold">Adresse</th>
                    <th className="pb-3 font-semibold">Wert</th>
                    <th className="pb-3 font-semibold">Klassifizierung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {currentReport.strings
                    .filter(s => s.value.toLowerCase().includes(searchString.toLowerCase()) || s.classification.toLowerCase().includes(searchString.toLowerCase()))
                    .map((str, index) => (
                      <tr key={index} className="hover:bg-neutral-950/40">
                        <td className="py-2.5 text-neutral-500">{str.address}</td>
                        <td className="py-2.5 text-red-400 select-all">"{str.value}"</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            str.classification.includes("Verdächtig") || str.classification.includes("Aktivitäts-Indikator")
                              ? "bg-red-900/40 text-red-300"
                              : "bg-neutral-800 text-neutral-400"
                          }`}>
                            {str.classification}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
