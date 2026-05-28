import React from "react";
import { Shield, GitCommit, GitBranch, Terminal, Cpu, Database } from "lucide-react";

export default function BlueprintTab() {
  const components = [
    {
      name: "Emissary",
      role: "Orchestrierung & Workflow",
      desc: "Nimmt Rohdaten (Dateien, Netzwerkverkehr) entgegen und verteilt sie per Workflow an Ghidra und andere Analyse-Engines.",
      color: "border-blue-500 text-blue-400 bg-blue-950/20"
    },
    {
      name: "Ghidra",
      role: "Analyse-Engine (Reversing)",
      desc: "Dekompiliert verdächtige Binärdateien und Firmware-Bibliotheken, um versteckte Backdoors und bösartige API-Aufrufe freizulegen.",
      color: "border-yellow-600 text-yellow-400 bg-yellow-950/20"
    },
    {
      name: "Datawave",
      role: "Sicherheits-Backend & Index",
      desc: "Dient als ultraschnelle Zeitreihen-Logdatenbank, indiziert alle einlaufenden System- und Netzwerkereignisse über flexible Shards.",
      color: "border-teal-500 text-teal-400 bg-teal-950/20"
    },
    {
      name: "LemonGraph",
      role: "Beziehungs-Graphenmodellierung",
      desc: "Korreliert die Ingest-Objekte, IP-Adressen und Prozesse grafisch in einer hochperformanten, gerichteten NoSQL-Graphdatenbank.",
      color: "border-emerald-500 text-emerald-400 bg-emerald-950/20"
    },
    {
      name: "Elitewolf",
      role: "Regelwerk-Auswertung (Sigma)",
      desc: "Analysiert den Datawave Index in Echtzeit mittels standardisierter Sigma-Erkennungsregeln und wirft sofort Alarme aus.",
      color: "border-red-600 text-red-400 bg-red-950/20"
    }
  ];

  return (
    <div className="space-y-6" id="blueprint_container">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-theme-blue" />
          Die Architektur des Sicherheits-Analyse-Frameworks
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl">
          Dieses Framework ist als hoch-integrierte, autonome Pipeline für Incident Response und Threat Hunting konzipiert. Jede Teilkomponente greift lückenlos ineinander, um Bedrohungen von der Signatur bis zum visuellen Beziehungs-Graphen aufzubereiten.
        </p>
      </div>

      {/* Visual Workflow Connections diagram */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
        {components.map((comp, idx) => (
          <div 
            key={comp.name} 
            className={`border rounded-xl p-5 flex flex-col justify-between shadow-md relative group hover:scale-[1.02] transition-transform duration-150 ${comp.color}`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Modul 0{idx+1}</span>
                <span className="text-[10px] bg-black/45 px-1.5 py-0.5 rounded font-mono">ONLINE</span>
              </div>
              <h4 className="text-lg font-bold font-sans tracking-tight mb-1">{comp.name}</h4>
              <p className="text-[11px] font-semibold text-neutral-300 mb-3">{comp.role}</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed mb-4">{comp.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Embedded Data flows description card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg space-y-4">
        <h4 className="text-sm font-semibold text-neutral-200">Datenfluss-Pipeline</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-neutral-400">
          <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-lg">
            <span className="text-theme-blue font-bold block mb-1">1. Datenerfassung (Ingest)</span>
            Emissary liest den Firmware-Stream aus und meldet neue Audit-Logs an den Datawave Cluster.
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-lg">
            <span className="text-yellow-500 font-bold block mb-1">2. Tiefenanalyse & Verknüpfung</span>
            Ghidra extrahiert C-Dekompilate, während LemonGraph IPs und Dateitypen lückenlos korreliert.
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-lg">
            <span className="text-red-400 font-bold block mb-1">3. Alarmierung (SIGMA)</span>
            Elitewolf kompilierte Signaturen werden auf Datawave Log-Shards ausgeführt, um bösartige Verbindungen zu blockieren.
          </div>
        </div>
      </div>
    </div>
  );
}
