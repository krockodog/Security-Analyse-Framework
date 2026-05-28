import React, { useState, useEffect } from "react";
import { GraphNode, GraphEdge } from "../types";
import { PlusCircle, Shield, Edit2, Zap, ArrowRight, Trash2, Palette, Check } from "lucide-react";

export const COLOR_PRESETS = [
  { key: "default", name: "Standard (Alarm)", fill: "fill-neutral-900", stroke: "stroke-neutral-500", border: "border-neutral-800", text: "text-neutral-400", bg: "bg-neutral-950", dot: "bg-neutral-500" },
  { key: "red", name: "Gefahr / C2 (Rot)", fill: "fill-red-950/80", stroke: "stroke-red-500", border: "border-red-900/50", text: "text-red-400", bg: "bg-red-950/40", dot: "bg-red-500" },
  { key: "amber", name: "Verdächtig (Gelb)", fill: "fill-amber-950/80", stroke: "stroke-amber-500", border: "border-amber-900/50", text: "text-amber-400", bg: "bg-amber-950/40", dot: "bg-amber-500" },
  { key: "emerald", name: "Sicher / Whitelist (Grün)", fill: "fill-emerald-950/80", stroke: "stroke-emerald-500", border: "border-emerald-900/50", text: "text-emerald-400", bg: "bg-emerald-950/40", dot: "bg-emerald-500" },
  { key: "blue", name: "Info / Analyse (Blau)", fill: "fill-blue-950/80", stroke: "stroke-blue-500", border: "border-blue-900/50", text: "text-blue-400", bg: "bg-blue-950/40", dot: "bg-blue-500" },
  { key: "purple", name: "Malware / Exploit (Lila)", fill: "fill-purple-950/80", stroke: "stroke-purple-500", border: "border-purple-900/50", text: "text-purple-400", bg: "bg-purple-950/40", dot: "bg-purple-500" },
  { key: "pink", name: "Exfiltration (Pink)", fill: "fill-pink-950/80", stroke: "stroke-pink-500", border: "border-pink-900/50", text: "text-pink-400", bg: "bg-pink-950/40", dot: "bg-pink-500" },
  { key: "cyan", name: "Gateway / Transit (Cyan)", fill: "fill-cyan-950/80", stroke: "stroke-cyan-500", border: "border-cyan-900/50", text: "text-cyan-400", bg: "bg-cyan-950/40", dot: "bg-cyan-500" }
];

interface LemonGraphTabProps {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
}

export default function LemonGraphTab({ initialNodes, initialEdges }: LemonGraphTabProps) {
  // Deep-copy initial arrays to live component states so details can be truly edited and persist
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  // Dragging states
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Inspector States
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Custom Node form states
  const [newNodeId, setNewNodeId] = useState("");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeType, setNewNodeType] = useState<'file' | 'ip' | 'process' | 'fw' | 'user'>('ip');
  const [newNodeSeverity, setNewNodeSeverity] = useState<'low' | 'medium' | 'high' | 'none'>('high');
  const [newNodeDesc, setNewNodeDesc] = useState("");

  // Custom Edge form states
  const [newEdgeSource, setNewEdgeSource] = useState("");
  const [newEdgeTarget, setNewEdgeTarget] = useState("");
  const [newEdgeLabel, setNewEdgeLabel] = useState("");

  // Sync state whenever scenario changes
  useEffect(() => {
    // Generate intelligent default spread layout grid coordinates so SVG nodes do not pile on top of each other
    const layoutNodes = initialNodes.map((n, idx) => ({
      ...n,
      x: n.x || (120 + (idx % 2) * 280 + Math.floor(idx / 2) * 50),
      y: n.y || (80 + Math.floor(idx / 2) * 120 + (idx % 2) * 30)
    }));
    setNodes(layoutNodes);
    setEdges([...initialEdges]);
    if (layoutNodes.length > 0) {
      setSelectedNodeId(layoutNodes[0].id);
    }
  }, [initialNodes, initialEdges]);

  // Click down starting the node drag
  const handleNodeStartDrag = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Find absolute offset relative to SVG viewport container
    const svgElement = document.getElementById("lemongraph_svg");
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setDraggedNodeId(nodeId);
    setDragOffset({
      x: mouseX - (node.x || 0),
      y: mouseY - (node.y || 0)
    });
    setSelectedNodeId(nodeId);
  };

  // Perform drag coordinates updating on cursor motion
  const handleSVGMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId) return;

    const svgElement = document.getElementById("lemongraph_svg");
    if (!svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Boundary constraints: Keep node within visual viewport
    const newX = Math.max(30, Math.min(rect.width - 30, mouseX - dragOffset.x));
    const newY = Math.max(30, Math.min(rect.height - 30, mouseY - dragOffset.y));

    setNodes(prev =>
      prev.map(n => (n.id === draggedNodeId ? { ...n, x: newX, y: newY } : n))
    );
  };

  const handleSVGMouseUp = () => {
    setDraggedNodeId(null);
  };

  // Add customized relation node
  const handleAddCustomNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeId || !newNodeLabel) return;

    // Check pre-existing
    if (nodes.some(n => n.id.toLowerCase() === newNodeId.toLowerCase())) {
      alert("Ein Netzelement mit dieser ID existiert bereits!");
      return;
    }

    const createdNode: GraphNode = {
      id: newNodeId.trim().toLowerCase().replace(/\s+/g, "_"),
      label: newNodeLabel.trim(),
      type: newNodeType,
      severity: newNodeSeverity,
      description: newNodeDesc.trim() || "Manuell injiziertes Netzelement",
      x: 350 + (Math.random() - 0.5) * 100,
      y: 200 + (Math.random() - 0.5) * 80
    };

    setNodes(prev => [...prev, createdNode]);
    setSelectedNodeId(createdNode.id);

    // Reset fields
    setNewNodeId("");
    setNewNodeLabel("");
    setNewNodeDesc("");
  };

  // Add customized directed edge link
  const handleAddCustomEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEdgeSource || !newEdgeTarget || !newEdgeLabel) return;

    const createdEdge: GraphEdge = {
      source: newEdgeSource,
      target: newEdgeTarget,
      label: newEdgeLabel.trim()
    };

    setEdges(prev => [...prev, createdEdge]);

    // Reset
    setNewEdgeLabel("");
  };

  // Delete node and its corresponding edges
  const handleDeleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  };

  // Help calculate midpoints for drawing clean edge labels
  const getEdgeCoordinates = (edge: GraphEdge) => {
    const sNode = nodes.find(n => n.id === edge.source);
    const tNode = nodes.find(n => n.id === edge.target);

    if (!sNode || !tNode) return { x1: 0, y1: 0, x2: 0, y2: 0, mx: 0, my: 0 };

    const x1 = sNode.x || 100;
    const y1 = sNode.y || 100;
    const x2 = tNode.x || 200;
    const y2 = tNode.y || 200;

    return {
      x1,
      y1,
      x2,
      y2,
      mx: (x1 + x2) / 2,
      my: (y1 + y2) / 2 - 8
    };
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="lemongraph_container">
      {/* Dynamic Interactive SVG Canvas */}
      <div className="xl:col-span-8 flex flex-col space-y-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg relative flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-theme-blue animate-pulse" />
                LemonGraph: Modellierungs-Interaktor
              </h3>
              <p className="text-xs text-neutral-400">Verhalten grafisch simulieren: Halte und dragge Knoten um Relationen neu auszurichten.</p>
            </div>
            <div className="flex gap-2 text-[10px] font-mono select-none">
              <span className="flex items-center gap-1 text-red-500">● Kritisch</span>
              <span className="flex items-center gap-1 text-amber-500">● Warnung</span>
              <span className="flex items-center gap-1 text-theme-blue">● Info</span>
            </div>
          </div>

          <div 
            className="w-full h-[460px] bg-neutral-950 border border-neutral-800 rounded-lg relative overflow-hidden select-none cursor-grab"
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleSVGMouseUp}
            onMouseLeave={handleSVGMouseUp}
          >
            {/* Real SVG Grid canvas */}
            <svg 
              id="lemongraph_svg"
              className="w-full h-full"
              style={{ background: 'radial-gradient(circle, #171717 1px, transparent 1px)', backgroundSize: '16px 16px' }}
            >
              {/* Definition of Arrow Marker */}
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#4B5563" />
                </marker>
                <marker
                  id="arrow-red"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
                </marker>
              </defs>

              {/* Render structural relationship paths (Edges) */}
              {edges.map((edge, idx) => {
                const { x1, y1, x2, y2, mx, my } = getEdgeCoordinates(edge);
                if (x1 === 0 && y1 === 0) return null;
                const isSelectedEdge = edge.source === selectedNodeId || edge.target === selectedNodeId;
                
                return (
                  <g key={`edge-${idx}`} className="transition-all select-none">
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isSelectedEdge ? "#EF4444" : "#4B5563"}
                      strokeWidth={isSelectedEdge ? 2.5 : 1.5}
                      strokeDasharray={edge.label.includes("dns") || edge.label.includes("exfil") ? "4 4" : undefined}
                      markerEnd={isSelectedEdge ? "url(#arrow-red)" : "url(#arrow)"}
                    />
                    <rect
                      x={mx - (edge.label.length * 4)}
                      y={my - 7}
                      width={edge.label.length * 8}
                      height={14}
                      fill="#0a0a0a"
                      rx={3}
                      stroke="#1f1f1f"
                      strokeWidth={1}
                    />
                    <text
                      x={mx}
                      y={my + 3}
                      textAnchor="middle"
                      className="text-[9px] font-mono fill-neutral-400 select-none pointer-events-none"
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}

              {/* Render dynamic customizable nodes */}
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const preset = COLOR_PRESETS.find(p => p.key === node.customColor);
                const nodeColor = preset && preset.key !== "default"
                  ? `${preset.fill} ${preset.stroke}`
                  : (node.severity === "high" ? "fill-red-950 stroke-red-500" :
                     node.severity === "medium" ? "fill-amber-950 stroke-amber-500" :
                     "fill-blue-950 stroke-blue-500");
                const textColor = preset && preset.key !== "default"
                  ? preset.text
                  : (node.severity === "high" ? "text-red-400" :
                     node.severity === "medium" ? "text-amber-400" :
                     "text-blue-400");

                return (
                  <g 
                    key={node.id}
                    id={`node-${node.id}`}
                    transform={`translate(${node.x || 100}, ${node.y || 100})`}
                    className="cursor-pointer group select-none"
                    onMouseDown={(e) => handleNodeStartDrag(e, node.id)}
                  >
                    {/* Visual node body */}
                    <circle
                      r="16"
                      className={`${nodeColor} stroke-2 transition-all duration-75 ${isSelected ? 'r-[18px] stroke-[3px] scale-110' : 'group-hover:scale-105'}`}
                      fillOpacity="0.85"
                    />
                    
                    {/* Node Type glyph helper */}
                    <text
                      textAnchor="middle"
                      y="4"
                      className="text-[10px] font-bold fill-neutral-200 pointer-events-none"
                    >
                      {node.type === "ip" ? "IP" :
                       node.type === "file" ? "FL" :
                       node.type === "process" ? "PC" :
                       node.type === "fw" ? "FW" : "US"}
                    </text>

                    {/* Node Text Label */}
                    <text
                      textAnchor="middle"
                      y="28"
                      className="text-[11px] font-mono font-medium fill-neutral-100 pointer-events-none bg-black/90"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="absolute bottom-3 left-3 bg-neutral-900/95 border border-neutral-800 rounded px-2.5 py-1 text-[10px] text-neutral-400 max-w-[200px]">
              Tipp: Dragge Kreise, um Beziehungen anzupassen. Klicke, um Details rechts zu editieren.
            </div>
          </div>
        </div>
      </div>

      {/* Editor & Manager sidebar panels */}
      <div className="xl:col-span-4 space-y-6">
        {/* Selected parameters inspector */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg relative" id="lemongraph_inspector">
          <div className="absolute top-0 right-0 h-1 text-theme-blue font-mono text-[9px] px-2 py-0.5 bg-theme-blue/20 rounded-bl-lg border-l border-b border-neutral-800">
            INSPECTOR
          </div>
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-theme-blue" />
            Metadaten-Inspektor
          </h3>

          {selectedNode ? (
            <div className="space-y-4">
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-mono">ID:</span>
                  <span className="text-neutral-300 font-mono font-bold break-all">{selectedNode.id}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-mono">Klassifikation:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedNode.type === 'ip' ? 'bg-blue-900/50 text-blue-300' :
                    selectedNode.type === 'file' ? 'bg-emerald-900/50 text-emerald-300' :
                    'bg-neutral-800 text-neutral-300'
                  }`}>
                    {selectedNode.type}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-500 font-mono">Schweregrad:</span>
                  <select
                    value={selectedNode.severity}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, severity: val } : n));
                    }}
                    className="bg-neutral-900 text-neutral-200 border border-neutral-800 px-2 py-0.5 rounded text-[11px] outline-none"
                  >
                    <option value="none">Keine</option>
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Kritisch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono font-semibold text-neutral-500 block mb-1">Anzeige-Etikett (Label)</label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, label: val } : n));
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 px-3 py-1.5 rounded text-xs text-neutral-200 font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono font-semibold text-neutral-500 block mb-1.5 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-neutral-400" />
                  Knoten-Farbe (Kategorie)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_PRESETS.map((preset) => {
                    const isPresetSelected = (selectedNode.customColor || "default") === preset.key;
                    const bgClass = preset.key === "default" 
                      ? "bg-neutral-800"
                      : preset.stroke.replace("stroke-", "bg-");
                    
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        id={`btn_color_preset_${preset.key}`}
                        onClick={() => {
                          setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, customColor: preset.key } : n));
                        }}
                        className={`group relative flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer h-12 ${
                          isPresetSelected 
                            ? "bg-neutral-800 border-neutral-600 text-neutral-100 font-bold" 
                            : "bg-neutral-950/40 border-neutral-900 text-neutral-400 hover:bg-neutral-900/60 hover:border-neutral-850"
                        }`}
                        title={preset.name}
                      >
                        {/* Swatch circle */}
                        <div className={`w-3.5 h-3.5 rounded-full ${bgClass} shadow-inner flex items-center justify-center transition-transform group-hover:scale-110`}>
                          {isPresetSelected && (
                            <Check className="w-2.5 h-2.5 text-neutral-950 stroke-[4px]" />
                          )}
                        </div>
                        <span className="text-[8px] font-mono mt-1 block truncate max-w-full leading-none scale-90">{preset.name.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono font-semibold text-neutral-500 block mb-1">Forensische Beschreibung</label>
                <textarea
                  rows={2}
                  value={selectedNode.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, description: val } : n));
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 p-2.5 rounded text-xs text-neutral-200 font-mono outline-none resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  id="btn_delete_inspect_node"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 py-1.5 rounded text-xs font-semibold font-mono flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Knoten löschen
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500 text-center py-6 font-mono">Wähle einen Knoten auf der Karte aus.</p>
          )}
        </div>

        {/* Form: Add Custom Threat Entity */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <PlusCircle className="w-4 h-4 text-emerald-500" />
            Netzelement hinzufügen
          </h3>
          <form onSubmit={handleAddCustomNode} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">ID (Unique)</label>
                <input
                  type="text"
                  placeholder="c2_host"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-300 font-mono outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Label Name</label>
                <input
                  type="text"
                  placeholder="IP (185.x.x)"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-300 font-mono outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Typ</label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-300 outline-none"
                >
                  <option value="ip">IPv4 / Netz</option>
                  <option value="file">Schaddatei</option>
                  <option value="process">Prozess</option>
                  <option value="fw">Firmware</option>
                  <option value="user">Benutzer</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Alarmierung</label>
                <select
                  value={newNodeSeverity}
                  onChange={(e) => setNewNodeSeverity(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-300 outline-none"
                >
                  <option value="high">Kritisch</option>
                  <option value="medium">Mittel</option>
                  <option value="low">Niedrig</option>
                  <option value="none">Keine</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-neutral-500 block">Beschreibung</label>
              <input
                type="text"
                placeholder="Details zur Aktivität..."
                value={newNodeDesc}
                onChange={(e) => setNewNodeDesc(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-400 font-mono outline-none"
              />
            </div>

            <button
              id="btn_add_node_diagram"
              type="submit"
              className="w-full bg-emerald-900/25 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/80 p-1.5 rounded text-xs font-semibold font-mono flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Knoten einfügen
            </button>
          </form>
        </div>

        {/* Form: Create Custom Directed Link */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-theme-blue animate-bounce" />
            Beziehung neu erstellen
          </h3>
          <form onSubmit={handleAddCustomEdge} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Quell-Knoten</label>
                <select
                  value={newEdgeSource}
                  onChange={(e) => setNewEdgeSource(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-300 outline-none"
                  required
                >
                  <option value="">Wählen...</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 block">Ziel-Knoten</label>
                <select
                  value={newEdgeTarget}
                  onChange={(e) => setNewEdgeTarget(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1 rounded text-xs text-neutral-300 outline-none"
                  required
                >
                  <option value="">Wählen...</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-neutral-500 block">Beziehungsname (z.B. sendet_daten)</label>
              <input
                type="text"
                placeholder="kontaktiert"
                value={newEdgeLabel}
                onChange={(e) => setNewEdgeLabel(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 px-2 py-1.5 rounded text-xs text-neutral-300 font-mono outline-none"
                required
              />
            </div>

            <button
              id="btn_add_edge_diagram"
              type="submit"
              className="w-full bg-theme-blue/20 hover:bg-theme-blue/35 text-theme-blue border border-theme-blue/50 p-1.5 rounded text-xs font-semibold font-mono flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Beziehung zeichnen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
