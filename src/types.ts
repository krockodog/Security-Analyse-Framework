export interface Scenario {
  id: string;
  title: string;
  category: string;
  description: string;
  targetDevice: string;
  ingestFile: {
    name: string;
    size: string;
    type: string;
    source: string;
    hash: string;
    entropy: number;
    hexDump?: string;
  };
  firmwareDetails?: {
    fileSystem: string;
    partitions: string[];
    entropyScore: number;
    unpackedBinaries: string[];
  };
  ghidraReports: {
    binaryName: string;
    functions: {
      name: string;
      address: string;
      decompiled: string;
      description: string;
    }[];
    strings: { value: string; address: string; classification: string }[];
    symbols: { name: string; type: string; address: string }[];
  }[];
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  datawaveLogs: SecurityLog[];
  elitewolfAlerts: ElitewolfAlert[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'ip' | 'process' | 'fw' | 'user';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'none';
  x?: number;
  y?: number;
  customColor?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface SecurityLog {
  id: string;
  timestamp: string;
  category: 'Network' | 'System' | 'Audit' | 'Firmware';
  source: string;
  eventCode?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ElitewolfAlert {
  id: string;
  timestamp: string;
  ruleName: string;
  mitreTactics: string[];
  mitreIds: string[];
  description: string;
  status: 'Neu' | 'Eskaliert' | 'Fehlalarm' | 'Gelöst';
  severity: 'low' | 'medium' | 'high';
  sigmaRule: string;
}
