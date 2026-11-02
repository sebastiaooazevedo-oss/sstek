export type QrItemStatus = "Ativo" | "Vencendo" | "Vencido";

export interface QrTraining {
  id: string;
  name: string;
  load: string;
  issued: string;
  expires: string;
  status: QrItemStatus;
}

export interface QrEpi {
  id: string;
  epi: string;
  ca: string;
  delivered: string;
  expires: string;
  status: QrItemStatus;
}

export interface QrProfile {
  trainings: QrTraining[];
  epis: QrEpi[];
}

export const fiscalCompany = {
  name: "Metalúrgica Vega",
  subdomain: "vega",
  cnpj: "12.345.678/0001-90",
  city: "São Bernardo do Campo/SP",
};

export const fiscalAudit = {
  responsible: "Eng.ª Marina Alves",
  registration: "CREA-SP 5070123456",
};

export const defaultQrProfile: QrProfile = {
  trainings: [
    { id: "t-def-1", name: "NR-06 · Uso de EPI", load: "4h", issued: "02/02/2026", expires: "02/02/2027", status: "Ativo" },
  ],
  epis: [
    { id: "e-def-1", epi: "Botina de segurança", ca: "42.185", delivered: "15/01/2026", expires: "15/01/2027", status: "Ativo" },
  ],
};

export const qrProfiles: Record<string, QrProfile> = {
  "c-001": {
    trainings: [
      { id: "t-001a", name: "NR-35 · Trabalho em Altura", load: "8h", issued: "05/10/2024", expires: "05/10/2026", status: "Vencendo" },
      { id: "t-001b", name: "NR-11 · Operação de Empilhadeira", load: "16h", issued: "12/01/2025", expires: "12/01/2027", status: "Ativo" },
      { id: "t-001c", name: "NR-12 · Segurança em Máquinas", load: "8h", issued: "10/01/2024", expires: "10/01/2026", status: "Vencido" },
    ],
    epis: [
      { id: "e-001a", epi: "Capacete classe B", ca: "31.469", delivered: "12/01/2026", expires: "12/01/2028", status: "Ativo" },
      { id: "e-001b", epi: "Botina de segurança", ca: "42.185", delivered: "12/01/2026", expires: "12/07/2026", status: "Vencido" },
      { id: "e-001c", epi: "Óculos de proteção", ca: "28.774", delivered: "03/03/2026", expires: "03/03/2027", status: "Ativo" },
      { id: "e-001d", epi: "Luva de vaqueta", ca: "35.110", delivered: "15/08/2026", expires: "15/02/2027", status: "Ativo" },
      { id: "e-001e", epi: "Protetor auricular", ca: "9.876", delivered: "20/06/2026", expires: "20/12/2026", status: "Vencendo" },
    ],
  },
  "c-002": {
    trainings: [
      { id: "t-002a", name: "NR-35 · Trabalho em Altura", load: "8h", issued: "05/10/2024", expires: "05/10/2026", status: "Vencendo" },
      { id: "t-002b", name: "NR-10 · Segurança em Eletricidade", load: "40h", issued: "18/03/2025", expires: "18/03/2027", status: "Ativo" },
      { id: "t-002c", name: "NR-33 · Espaço Confinado", load: "16h", issued: "07/07/2025", expires: "07/07/2027", status: "Ativo" },
      { id: "t-002d", name: "NR-05 · CIPA", load: "20h", issued: "01/02/2026", expires: "01/02/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-002a", epi: "Capacete classe B", ca: "31.469", delivered: "12/01/2026", expires: "12/01/2028", status: "Ativo" },
      { id: "e-002b", epi: "Botina de segurança", ca: "42.185", delivered: "12/01/2026", expires: "12/01/2027", status: "Ativo" },
      { id: "e-002c", epi: "Óculos de proteção", ca: "28.774", delivered: "12/01/2026", expires: "12/01/2027", status: "Ativo" },
      { id: "e-002d", epi: "Luva isolante", ca: "38.902", delivered: "18/03/2026", expires: "18/09/2026", status: "Vencendo" },
    ],
  },
  "c-003": {
    trainings: [
      { id: "t-003a", name: "NR-11 · Operação de Empilhadeira", load: "16h", issued: "18/07/2025", expires: "18/07/2027", status: "Ativo" },
      { id: "t-003b", name: "NR-12 · Segurança em Máquinas", load: "8h", issued: "09/02/2024", expires: "09/02/2026", status: "Vencido" },
      { id: "t-003c", name: "NR-06 · Uso de EPI", load: "4h", issued: "02/02/2026", expires: "02/02/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-003a", epi: "Capacete classe B", ca: "31.469", delivered: "18/07/2025", expires: "18/07/2027", status: "Ativo" },
      { id: "e-003b", epi: "Botina de segurança", ca: "42.185", delivered: "18/07/2025", expires: "18/01/2027", status: "Ativo" },
      { id: "e-003c", epi: "Luva de vaqueta", ca: "35.110", delivered: "20/01/2026", expires: "20/07/2026", status: "Vencido" },
      { id: "e-003d", epi: "Colete refletivo", ca: "30.221", delivered: "20/01/2026", expires: "20/01/2028", status: "Ativo" },
    ],
  },
  "c-004": {
    trainings: [
      { id: "t-004a", name: "NR-10 · Segurança em Eletricidade", load: "40h", issued: "14/10/2024", expires: "14/10/2026", status: "Vencendo" },
      { id: "t-004b", name: "NR-35 · Trabalho em Altura", load: "8h", issued: "14/10/2024", expires: "14/10/2026", status: "Vencendo" },
      { id: "t-004c", name: "NR-18 · Construção Civil", load: "6h", issued: "12/03/2025", expires: "12/03/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-004a", epi: "Capacete classe B", ca: "31.469", delivered: "05/09/2025", expires: "05/09/2027", status: "Ativo" },
      { id: "e-004b", epi: "Luva isolante", ca: "38.902", delivered: "14/10/2025", expires: "14/04/2026", status: "Vencido" },
      { id: "e-004c", epi: "Botina de segurança", ca: "42.185", delivered: "14/10/2025", expires: "14/10/2026", status: "Vencendo" },
      { id: "e-004d", epi: "Óculos de proteção", ca: "28.774", delivered: "14/10/2025", expires: "14/10/2026", status: "Vencendo" },
    ],
  },
  "c-005": {
    trainings: [
      { id: "t-005a", name: "NR-06 · Uso de EPI", load: "4h", issued: "11/04/2025", expires: "11/04/2027", status: "Ativo" },
      { id: "t-005b", name: "NR-12 · Segurança em Máquinas", load: "8h", issued: "01/08/2025", expires: "01/08/2027", status: "Ativo" },
      { id: "t-005c", name: "NR-05 · CIPA", load: "20h", issued: "01/02/2026", expires: "01/02/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-005a", epi: "Botina de segurança", ca: "42.185", delivered: "11/04/2025", expires: "11/04/2027", status: "Ativo" },
      { id: "e-005b", epi: "Óculos de proteção", ca: "28.774", delivered: "11/04/2025", expires: "11/04/2027", status: "Ativo" },
    ],
  },
  "c-006": {
    trainings: [
      { id: "t-006a", name: "NR-12 · Segurança em Máquinas", load: "8h", issued: "27/06/2025", expires: "27/06/2027", status: "Ativo" },
      { id: "t-006b", name: "NR-06 · Uso de EPI", load: "4h", issued: "10/01/2024", expires: "10/01/2026", status: "Vencido" },
    ],
    epis: [
      { id: "e-006a", epi: "Luva de vaqueta", ca: "35.110", delivered: "27/06/2025", expires: "27/12/2026", status: "Vencendo" },
      { id: "e-006b", epi: "Botina de segurança", ca: "42.185", delivered: "27/06/2025", expires: "27/06/2027", status: "Ativo" },
      { id: "e-006c", epi: "Óculos de proteção", ca: "28.774", delivered: "27/06/2025", expires: "27/06/2027", status: "Ativo" },
      { id: "e-006d", epi: "Protetor auricular", ca: "9.876", delivered: "27/06/2025", expires: "27/12/2026", status: "Vencendo" },
    ],
  },
  "c-007": {
    trainings: [
      { id: "t-007a", name: "NR-06 · Uso de EPI", load: "4h", issued: "14/02/2026", expires: "14/02/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-007a", epi: "Botina de segurança", ca: "42.185", delivered: "14/02/2026", expires: "14/02/2027", status: "Ativo" },
    ],
  },
  "c-008": {
    trainings: [
      { id: "t-008a", name: "NR-35 · Trabalho em Altura", load: "8h", issued: "09/10/2025", expires: "09/10/2027", status: "Ativo" },
      { id: "t-008b", name: "NR-10 · Segurança em Eletricidade", load: "40h", issued: "09/10/2025", expires: "09/10/2027", status: "Ativo" },
      { id: "t-008c", name: "NR-11 · Operação de Empilhadeira", load: "16h", issued: "09/10/2025", expires: "09/10/2027", status: "Ativo" },
      { id: "t-008d", name: "NR-12 · Segurança em Máquinas", load: "8h", issued: "09/10/2025", expires: "09/10/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-008a", epi: "Capacete classe B", ca: "31.469", delivered: "09/02/2026", expires: "09/02/2028", status: "Ativo" },
      { id: "e-008b", epi: "Botina de segurança", ca: "42.185", delivered: "09/02/2026", expires: "09/02/2027", status: "Ativo" },
      { id: "e-008c", epi: "Óculos de proteção", ca: "28.774", delivered: "09/02/2026", expires: "09/02/2027", status: "Ativo" },
      { id: "e-008d", epi: "Protetor auricular", ca: "9.876", delivered: "09/02/2026", expires: "09/08/2026", status: "Vencendo" },
    ],
  },
  "c-009": {
    trainings: [
      { id: "t-009a", name: "NR-11 · Operação de Empilhadeira", load: "16h", issued: "22/08/2025", expires: "22/08/2027", status: "Ativo" },
      { id: "t-009b", name: "NR-12 · Segurança em Máquinas", load: "8h", issued: "12/01/2024", expires: "12/01/2026", status: "Vencido" },
      { id: "t-009c", name: "NR-06 · Uso de EPI", load: "4h", issued: "02/02/2026", expires: "02/02/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-009a", epi: "Capacete classe B", ca: "31.469", delivered: "22/08/2025", expires: "22/08/2027", status: "Ativo" },
      { id: "e-009b", epi: "Botina de segurança", ca: "42.185", delivered: "22/08/2025", expires: "22/02/2027", status: "Ativo" },
      { id: "e-009c", epi: "Luva de vaqueta", ca: "35.110", delivered: "22/08/2025", expires: "22/02/2026", status: "Vencido" },
      { id: "e-009d", epi: "Protetor auricular", ca: "9.876", delivered: "22/08/2025", expires: "22/02/2027", status: "Ativo" },
    ],
  },
  "c-010": {
    trainings: [
      { id: "t-010a", name: "NR-11 · Operação de Empilhadeira", load: "16h", issued: "30/01/2025", expires: "30/01/2027", status: "Ativo" },
      { id: "t-010b", name: "NR-06 · Uso de EPI", load: "4h", issued: "30/01/2025", expires: "30/01/2027", status: "Ativo" },
      { id: "t-010c", name: "NR-35 · Trabalho em Altura", load: "8h", issued: "30/01/2025", expires: "30/01/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-010a", epi: "Capacete classe B", ca: "31.469", delivered: "30/01/2025", expires: "30/01/2027", status: "Ativo" },
      { id: "e-010b", epi: "Botina de segurança", ca: "42.185", delivered: "30/01/2025", expires: "30/01/2027", status: "Ativo" },
      { id: "e-010c", epi: "Luva de vaqueta", ca: "35.110", delivered: "30/01/2025", expires: "30/07/2026", status: "Vencendo" },
      { id: "e-010d", epi: "Colete refletivo", ca: "30.221", delivered: "30/01/2025", expires: "30/01/2028", status: "Ativo" },
    ],
  },
  "c-011": {
    trainings: [
      { id: "t-011a", name: "NR-35 · Trabalho em Altura", load: "8h", issued: "06/05/2025", expires: "06/05/2027", status: "Ativo" },
      { id: "t-011b", name: "NR-10 · Segurança em Eletricidade", load: "40h", issued: "06/05/2025", expires: "06/05/2027", status: "Ativo" },
      { id: "t-011c", name: "NR-33 · Espaço Confinado", load: "16h", issued: "06/05/2025", expires: "06/05/2027", status: "Ativo" },
      { id: "t-011d", name: "NR-05 · CIPA", load: "20h", issued: "01/02/2026", expires: "01/02/2027", status: "Ativo" },
    ],
    epis: [
      { id: "e-011a", epi: "Capacete classe B", ca: "31.469", delivered: "06/05/2025", expires: "06/05/2027", status: "Ativo" },
      { id: "e-011b", epi: "Botina de segurança", ca: "42.185", delivered: "06/05/2025", expires: "06/05/2027", status: "Ativo" },
      { id: "e-011c", epi: "Óculos de proteção", ca: "28.774", delivered: "06/05/2025", expires: "06/05/2027", status: "Ativo" },
    ],
  },
  "c-012": {
    trainings: [
      { id: "t-012a", name: "NR-11 · Operação de Empilhadeira", load: "16h", issued: "16/03/2024", expires: "16/03/2026", status: "Vencido" },
      { id: "t-012b", name: "NR-06 · Uso de EPI", load: "4h", issued: "16/03/2024", expires: "16/03/2026", status: "Vencido" },
    ],
    epis: [],
  },
};

export interface ScanLog {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  scannedAt: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  source: string;
  result: "OK" | "Alerta";
}

export const scanLogs: ScanLog[] = [
  { id: "s-001", collaboratorId: "c-001", collaboratorName: "Carlos Menezes", scannedAt: "29/09/2026 09:14:22", device: "Samsung Galaxy A54", browser: "Chrome 128 · Android 14", ip: "191.36.14.72", location: "São Bernardo do Campo/SP", source: "Fiscalização MTE", result: "Alerta" },
  { id: "s-002", collaboratorId: "c-002", collaboratorName: "Juliana Prado", scannedAt: "29/09/2026 08:52:07", device: "Apple iPhone 13", browser: "Safari 18 · iOS 18.1", ip: "191.36.14.72", location: "Santo André/SP", source: "Auditoria interna", result: "OK" },
  { id: "s-003", collaboratorId: "c-004", collaboratorName: "Roberto Lima", scannedAt: "28/09/2026 17:41:33", device: "Motorola Moto G84", browser: "Chrome 127 · Android 13", ip: "177.92.201.9", location: "São Paulo/SP", source: "Fiscalização MTE", result: "Alerta" },
  { id: "s-004", collaboratorId: "c-008", collaboratorName: "Marcos Oliveira", scannedAt: "28/09/2026 15:20:11", device: "Samsung Galaxy S23", browser: "Chrome 128 · Android 14", ip: "177.92.201.9", location: "São Bernardo do Campo/SP", source: "Portaria — turno B", result: "OK" },
  { id: "s-005", collaboratorId: "c-003", collaboratorName: "Diego Farias", scannedAt: "28/09/2026 14:03:58", device: "Xiaomi Redmi Note 12", browser: "Chrome 126 · Android 12", ip: "189.44.110.31", location: "Diadema/SP", source: "Auditoria interna", result: "Alerta" },
  { id: "s-006", collaboratorId: "c-001", collaboratorName: "Carlos Menezes", scannedAt: "27/09/2026 10:47:19", device: "Samsung Galaxy A54", browser: "Chrome 128 · Android 14", ip: "191.36.14.72", location: "São Bernardo do Campo/SP", source: "Portaria — turno A", result: "OK" },
  { id: "s-007", collaboratorId: "c-011", collaboratorName: "Larissa Martins", scannedAt: "27/09/2026 09:11:44", device: "Apple iPhone 15", browser: "Safari 18 · iOS 18.0", ip: "191.36.14.72", location: "Santo André/SP", source: "Fiscalização MTE", result: "OK" },
  { id: "s-008", collaboratorId: "c-009", collaboratorName: "Tatiane Costa", scannedAt: "26/09/2026 16:38:02", device: "LG K62", browser: "Chrome 125 · Android 11", ip: "189.44.110.31", location: "Diadema/SP", source: "Auditoria interna", result: "Alerta" },
  { id: "s-009", collaboratorId: "c-005", collaboratorName: "Patrícia Gomes", scannedAt: "26/09/2026 11:22:37", device: "Samsung Galaxy A34", browser: "Chrome 128 · Android 14", ip: "191.36.14.72", location: "São Caetano do Sul/SP", source: "Portaria — turno A", result: "OK" },
  { id: "s-010", collaboratorId: "c-010", collaboratorName: "Rafael Nunes", scannedAt: "25/09/2026 15:09:51", device: "Motorola Moto G54", browser: "Chrome 127 · Android 13", ip: "177.92.201.9", location: "São Paulo/SP", source: "Auditoria interna", result: "OK" },
  { id: "s-011", collaboratorId: "c-006", collaboratorName: "André Souza", scannedAt: "25/09/2026 08:45:16", device: "Xiaomi Redmi 13C", browser: "Chrome 126 · Android 12", ip: "189.44.110.31", location: "São Bernardo do Campo/SP", source: "Fiscalização MTE", result: "Alerta" },
  { id: "s-012", collaboratorId: "c-002", collaboratorName: "Juliana Prado", scannedAt: "24/09/2026 13:27:40", device: "Apple iPhone 13", browser: "Safari 18 · iOS 18.1", ip: "191.36.14.72", location: "Santo André/SP", source: "Auditoria interna", result: "OK" },
  { id: "s-013", collaboratorId: "c-007", collaboratorName: "Fernanda Ribeiro", scannedAt: "24/09/2026 09:58:03", device: "Samsung Galaxy A15", browser: "Chrome 128 · Android 14", ip: "177.92.201.9", location: "São Paulo/SP", source: "Portaria — turno A", result: "OK" },
  { id: "s-014", collaboratorId: "c-001", collaboratorName: "Carlos Menezes", scannedAt: "23/09/2026 14:12:29", device: "Samsung Galaxy A54", browser: "Chrome 128 · Android 14", ip: "191.36.14.72", location: "São Bernardo do Campo/SP", source: "Auditoria interna", result: "Alerta" },
];

export const scanSources = ["Fiscalização MTE", "Auditoria interna", "Portaria — turno A", "Portaria — turno B"];