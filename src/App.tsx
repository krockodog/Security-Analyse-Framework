import React, { useState, useEffect } from "react";
import { SCENARIOS } from "./data";
import { Scenario, SecurityLog, ElitewolfAlert } from "./types";

// Modular tab panels imports
import BlueprintTab from "./components/BlueprintTab";
import EmissaryTab from "./components/EmissaryTab";
import GhidraTab from "./components/GhidraTab";
import LemonGraphTab from "./components/LemonGraphTab";
import DatawaveTab from "./components/DatawaveTab";
import ElitewolfTab from "./components/ElitewolfTab";
import ConsultantTab from "./components/ConsultantTab";

// Firebase and Firestore integrations
import { auth, db, handleFirestoreError, OperationType, performGoogleLogin, performLogout } from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot, setDoc, doc } from "firebase/firestore";

// Icon imports
import { 
  ShieldAlert, Compass, Cpu, Binary, Database, GitBranch, Shield, 
  HelpCircle, Moon, Sun, Play, Activity, Sparkles, AlertCircle
} from "lucide-react";

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState("szenario_a");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeTab, setActiveTab] = useState("blueprint");
  
  // Pipeline interactive tracker simulation step
  const [pipelineStep, setPipelineStep] = useState(0);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState("Bereit zur Ingestion.");

  // Cache states for consultant context sending
  const [codeContext, setCodeContext] = useState("");
  const [ruleContext, setRuleContext] = useState("");

  // Deep-copy logs in state so log ingestion updates are synchronized automatically
  const [currentLogs, setCurrentLogs] = useState<SecurityLog[]>([]);
  const [currentAlerts, setCurrentAlerts] = useState<ElitewolfAlert[]>([]);

  // Firebase auth state tracking
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);

  const activeScenario = SCENARIOS.find(s => s.id === activeScenarioId) || SCENARIOS[0];

  // Auth subscriber
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsFirebaseLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  // Initialize logs and scenarios
  useEffect(() => {
    setCurrentLogs([...activeScenario.datawaveLogs]);
    if (!currentUser) {
      setCurrentAlerts([...activeScenario.elitewolfAlerts]);
    }
    setPipelineStep(0);
    setIsPipelineRunning(false);
    setPipelineMessage("Bereit zur Ingestion (Modul 01: Emissary).");
  }, [activeScenarioId, currentUser]);

  // Persist and load from Firestore when logged in
  useEffect(() => {
    if (!currentUser) return;

    // Load custom alert statuses from Firestore in real-time
    const qAlerts = query(
      collection(db, "alert_statuses"),
      where("scenarioId", "==", activeScenarioId)
    );

    const unsubscribeAlerts = onSnapshot(
      qAlerts,
      (snapshot) => {
        const statusMap: Record<string, 'Neu' | 'Eskaliert' | 'Fehlalarm' | 'Gelöst'> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          statusMap[data.id] = data.status;
        });

        // Override status on scenario elitewolfAlerts
        const updatedAlerts = activeScenario.elitewolfAlerts.map(alert => ({
          ...alert,
          status: statusMap[alert.id] || alert.status
        }));
        setCurrentAlerts(updatedAlerts);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "alert_statuses");
      }
    );

    // Load custom binaries from Firestore in real-time
    const qBinaries = query(
      collection(db, "custom_binaries"),
      where("scenarioId", "==", activeScenarioId)
    );

    const unsubscribeBinaries = onSnapshot(
      qBinaries,
      (snapshot) => {
        const loadedBinaries: any[] = [];
        snapshot.forEach((doc) => {
          loadedBinaries.push(doc.data());
        });

        const originalScenario = SCENARIOS.find(s => s.id === activeScenarioId);
        if (!originalScenario) return;

        const combinedReports = [...originalScenario.ghidraReports];
        loadedBinaries.forEach((bin) => {
          if (!combinedReports.some(r => r.binaryName === bin.binaryName)) {
            combinedReports.unshift({
              binaryName: bin.binaryName,
              functions: bin.functions || [],
              strings: bin.strings || [],
              symbols: bin.symbols || []
            });
          }
        });
        
        activeScenario.ghidraReports = combinedReports;
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "custom_binaries");
      }
    );

    return () => {
      unsubscribeAlerts();
      unsubscribeBinaries();
    };
  }, [activeScenarioId, currentUser]);

  // Handle global high-contrast light theme toggle dynamically
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light-theme");
    } else {
      root.classList.remove("light-theme");
    }
  }, [theme]);

  // Handle customized scenario custom binaries additions
  const handleAddCustomBinary = async (binary: any) => {
    if (!currentUser) {
      // Local list update
      activeScenario.ghidraReports = [binary, ...activeScenario.ghidraReports];
      alert(`Erfolg (Nur lokal): ${binary.binaryName} wurde in das Ghidra Binärdaten-Verzeichnis injiziert. Melde dich an, um in Cloud Firestore zu speichern.`);
      return;
    }

    try {
      const binaryId = `bin_${Math.floor(Math.random() * 100000)}`;
      await setDoc(doc(db, "custom_binaries", binaryId), {
        id: binaryId,
        scenarioId: activeScenarioId,
        binaryName: binary.binaryName,
        functions: binary.functions || [],
        strings: binary.strings || [],
        symbols: binary.symbols || [],
        createdAt: new Date().toISOString()
      });
      alert(`Erfolg (Firestore Cloud): ${binary.binaryName} wurde sicher in der Cloud-Datenbank hinterlegt und synchronisiert.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `custom_binaries`);
    }
  };

  // Run the full visual framework pipeline simulator
  const handleStartPipeline = () => {
    if (isPipelineRunning) return;
    setIsPipelineRunning(true);
    setPipelineStep(1);
    setPipelineMessage("Schritt 1: Emissary liest Ingest-Payload und analysiert Dateientropie...");

    setTimeout(() => {
      setPipelineStep(2);
      setPipelineMessage("Schritt 2: Binary wurde an Ghidra übermittelt. Extrahiere Code-Segmente...");
      setSelectedTab("ghidra");
      
      setTimeout(() => {
        setPipelineStep(3);
        setPipelineMessage("Schritt 3: LemonGraph korreliert Bedrohungs-Entitäten und Kommunikationspfade...");
        setSelectedTab("lemongraph");

        setTimeout(() => {
          setPipelineStep(4);
          setPipelineMessage("Schritt 4: Datawave indiziert Netzwerkströme und auditierte Systemereignisse...");
          setSelectedTab("datawave");

          setTimeout(() => {
            setPipelineStep(5);
            setPipelineMessage("Schritt 5: Elitewolf scannt Log-Einträge auf verdächtige Sigma-Signaturen!");
            setSelectedTab("elitewolf");
            setIsPipelineRunning(false);

            // Dynamically play sound on complete if matches are found
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              osc.frequency.value = 660;
              osc.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.1);
            } catch {}

          }, 1800);
        }, 1800);
      }, 1800);
    }, 1800);
  };

  const setSelectedTab = (tab: string) => {
    setActiveTab(tab);
    // Auto focus corresponding sections if needed
  };

  return (
    <div className="min-h-screen bg-[#070708] text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Light-theme overrides styles block inline */}
      <style>{`
        .light-theme {
          background-color: #f8fafc !important;
          color: #0f172a !important;
        }
        .light-theme .bg-neutral-900 {
          background-color: #ffffff !important;
          border-color: #cbd5e1 !important;
        }
        .light-theme .bg-neutral-950 {
          background-color: #f1f5f9 !important;
          border-color: #e2e8f0 !important;
          color: #1e293b !important;
        }
        .light-theme .border-neutral-800,
        .light-theme .border-neutral-850,
        .light-theme .border-neutral-900 {
          border-color: #cbd5e1 !important;
        }
        .light-theme .text-neutral-400 {
          color: #475569 !important;
        }
        .light-theme .text-neutral-300 {
          color: #334155 !important;
        }
        .light-theme .text-neutral-200 {
          color: #1e293b !important;
        }
        .light-theme .text-zinc-400 {
          color: #475569 !important;
        }
        .light-theme .font-mono {
          color: #0f172a !important;
        }
        .light-theme .text-emerald-500,
        .light-theme pre.text-emerald-550 {
          color: #047857 !important;
        }
        .light-theme select,
        .light-theme textarea,
        .light-theme input {
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
      `}</style>

      {/* Primary Header Layout */}
      <header className="border-b border-neutral-900 bg-[#0c0c0e]/95 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-theme-blue/15 border border-theme-blue/35 rounded-xl flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-5 h-5 text-theme-blue" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-neutral-100 flex items-center gap-2">
              Sicherheits-Analyse-Framework
              <span className="text-[10px] font-mono tracking-wider bg-theme-blue/20 text-theme-blue px-2 py-0.5 rounded-full border border-theme-blue/30 font-semibold uppercase">
                Enterprise Core
              </span>
            </h1>
            <p className="text-[11px] text-neutral-400">Verteilte forensische Anomalieerkennung & Reverse Engineering Orchestrator</p>
          </div>
        </div>

        {/* Action controllers: Scenario Selecor, Theme Toggle, and Google Login status */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Login Status */}
          {isFirebaseLoaded && (
            currentUser ? (
              <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 text-xs">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full border border-neutral-700" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-5 h-5 bg-theme-blue/20 rounded-full flex items-center justify-center text-[10px] text-theme-blue font-bold">
                    {currentUser.email?.[0].toUpperCase() || "A"}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <span className="text-[10px] text-neutral-400 block leading-tight truncate max-w-[100px]">{currentUser.displayName || currentUser.email}</span>
                  <span className="text-[8px] font-mono text-emerald-500 block leading-tight font-semibold">ACTIVE ANALYST</span>
                </div>
                <button
                  id="btn_google_logout"
                  onClick={performLogout}
                  className="bg-transparent hover:text-red-400 text-[10px] text-neutral-500 font-semibold font-mono border-l border-neutral-800 pl-2 cursor-pointer transition-colors"
                >
                  Abmelden
                </button>
              </div>
            ) : (
              <button
                id="btn_google_login"
                onClick={performGoogleLogin}
                className="bg-theme-blue/15 hover:bg-theme-blue/25 text-theme-blue text-xs font-semibold py-1.5 px-3 rounded-lg border border-theme-blue/30 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Login mit Google"
              >
                <Shield className="w-3.5 h-3.5 fill-current text-theme-blue" />
                Login
              </button>
            )
          )}

          <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-850 w-full sm:w-auto">
            <span className="text-xs text-neutral-500 font-medium whitespace-nowrap">Szenario:</span>
            <select
              id="scenario_select"
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="bg-transparent text-xs font-semibold font-sans outline-none cursor-pointer text-theme-blue w-full sm:w-48 appearance-none"
            >
              <option value="szenario_a">Mirai-Clone (IoT Firmware)</option>
              <option value="szenario_b">Ransomware (Phishing-PE)</option>
              <option value="szenario_c">DNS Tunneling (APT-DLL)</option>
            </select>
          </div>

          <button
            id="theme_switcher_btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-lg border border-neutral-850 hover:bg-neutral-900 flex items-center justify-center text-neutral-450 transition-colors flex-shrink-0 cursor-pointer"
            title="Theme umschalten (Dark / High-Contrast Light)"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-theme-blue" />}
          </button>
        </div>
      </header>

      {/* Sub Header - Pipeline Stage Indicator */}
      <section className="bg-neutral-950 border-b border-neutral-900 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-2.5">
          <Activity className={`w-4 h-4 ${isPipelineRunning ? 'text-red-500 animate-spin' : 'text-neutral-500'}`} />
          <div>
            <span className="text-xs font-mono font-bold uppercase block text-neutral-500">Pipeline-Orchestrierung</span>
            <span className="text-xs text-neutral-300 font-mono italic">{pipelineMessage}</span>
          </div>
        </div>

        {/* Step Track timeline */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((step) => {
              const stepColor = 
                pipelineStep >= step 
                  ? step === 5 ? "bg-red-500" : "bg-theme-blue" 
                  : "bg-neutral-800";
              return (
                <div 
                  key={step} 
                  className={`w-5 h-1.5 rounded-full transition-colors duration-200 ${stepColor}`} 
                />
              );
            })}
          </div>

          <button
            id="pipeline_start_btn"
            onClick={handleStartPipeline}
            disabled={isPipelineRunning}
            className={`font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-md border transition-all flex items-center gap-1 cursor-pointer ${
              isPipelineRunning
                ? "bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-theme-blue/15 hover:bg-theme-blue/35 text-theme-blue border-theme-blue/40"
            }`}
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            Vollscan simulieren
          </button>
        </div>
      </section>

      {/* Main Grid View Controller with left tab sidebar */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Navigation Sidebar */}
        <nav className="md:w-56 space-y-1.5 flex-shrink-0 select-none" id="tabs_sidebar">
          <span className="text-[10px] font-mono tracking-wider font-bold text-neutral-500 uppercase block px-3 mb-2">Module</span>
          {[
            { id: "blueprint", label: "01. Blueprint", icon: Compass },
            { id: "emissary", label: "02. Emissary Ingest", icon: Cpu },
            { id: "ghidra", label: "03. Ghidra Reversing", icon: Binary },
            { id: "lemongraph", label: "04. LemonGraph Map", icon: GitBranch },
            { id: "datawave", label: "05. Datawave Index", icon: Database },
            { id: "elitewolf", label: "06. Elitewolf Rules", icon: ShieldAlert }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab_btn_${tab.id}`}
                onClick={() => setSelectedTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isSelected 
                    ? "bg-theme-blue/10 border border-theme-blue/40 text-theme-blue font-bold shadow-inner" 
                    : "bg-transparent hover:bg-neutral-900/40 text-neutral-450 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-theme-blue' : 'text-neutral-500'}`} />
                {tab.label}
              </button>
            );
          })}

          <div className="pt-4 border-t border-neutral-900/60 mt-4">
            <span className="text-[10px] font-mono tracking-wider font-bold text-neutral-500 uppercase block px-3 mb-2">KI-Assistent</span>
            <button
              id="tab_btn_consultant"
              onClick={() => setSelectedTab("consultant")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                activeTab === "consultant" 
                  ? "bg-yellow-600/10 border border-yellow-600/40 text-yellow-500 font-bold shadow-inner" 
                  : "bg-transparent hover:bg-neutral-900/40 text-neutral-450 border border-transparent"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === "consultant" ? 'text-yellow-500 animate-pulse' : 'text-neutral-500'}`} />
              07. KI-Berater
            </button>
          </div>
        </nav>

        {/* Active Tab Panel routing */}
        <section className="flex-1 min-w-0" id="active_tab_panel">
          {activeTab === "blueprint" && <BlueprintTab />}
          {activeTab === "emissary" && <EmissaryTab scenario={activeScenario} />}
          {activeTab === "ghidra" && (
            <GhidraTab 
              scenario={activeScenario} 
              onAddCustomBinary={handleAddCustomBinary}
              onSelectCodeContext={(code) => setCodeContext(code)}
            />
          )}
          {activeTab === "lemongraph" && (
            <LemonGraphTab 
              initialNodes={activeScenario.graphData.nodes} 
              initialEdges={activeScenario.graphData.edges}
            />
          )}
          {activeTab === "datawave" && (
            <DatawaveTab 
              initialLogs={activeScenario.datawaveLogs} 
              onLogsUpdated={(logs) => setCurrentLogs(logs)}
            />
          )}
          {activeTab === "elitewolf" && (
            <ElitewolfTab 
              alerts={currentAlerts} 
              onAlertsUpdated={(alerts) => setCurrentAlerts(alerts)}
              datawaveLogs={currentLogs}
              onSelectRuleContext={(rule) => setRuleContext(rule)}
              scenarioId={activeScenarioId}
            />
          )}
          {activeTab === "consultant" && (
            <ConsultantTab 
              activeScenarioTitle={activeScenario.title}
              codeContext={codeContext}
              ruleContext={ruleContext}
              currentLogs={currentLogs}
            />
          )}
        </section>
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-neutral-900 bg-[#09090b] px-6 py-4 mt-auto select-none">
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-neutral-500 font-mono">
          <span>Integrierter Sicherheits-Analyse-Engine (SIEM Sandbox)</span>
          <span>© 2026 Autonomes Cyber-Sicherheits-Labor</span>
        </div>
      </footer>
    </div>
  );
}
