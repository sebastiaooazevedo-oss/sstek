export interface EpiCatalogItem {
  id: string;
  name: string;
  ca: string;
  category: string;
  manufacturer: string;
  norm: string;
  approvalValidity: string;
  sizes: string;
  description: string;
  restriction: string;
  active: boolean;
  inactiveReason?: string;
}

export interface EpiDeliveryItem {
  name: string;
  ca: string;
  quantity: number;
}

export interface EpiDelivery {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  area: string;
  date: string;
  reason: string;
  items: EpiDeliveryItem[];
  signature: string;
  status: "Assinada" | "Pendente";
  notes: string;
  photo?: string;
  /** Unidade / estabelecimento do colaborador (preenchido automaticamente). */
  establishment?: string;
}

export const epiCatalog: EpiCatalogItem[] = [
  {
    id: "epi-01",
    name: "Capacete de segurança classe B",
    ca: "31.469",
    category: "Cabeça",
    manufacturer: "Brasfort",
    norm: "NBR 8221",
    approvalValidity: "12/05/2027",
    sizes: "Ajustável (52–64 cm)",
    description:
      "Capacete de segurança com suspensão de catraca e aba frontal, resistente a impactos e ao contato elétrico (classe B).",
    restriction: "Substituir imediatamente após qualquer impacto, trinca ou deformação da carcaça.",
    active: true,
  },
  {
    id: "epi-02",
    name: "Óculos de proteção incolor",
    ca: "28.774",
    category: "Visão",
    manufacturer: "ProSafety",
    norm: "NBR 16645",
    approvalValidity: "03/09/2026",
    sizes: "Único",
    description:
      "Óculos de proteção incolor com lente antiembaçante, proteção contra partículas volantes e respingos leves.",
    restriction: "Não substitui óculos de grau; verificar compatibilidade antes do uso sobre lentes corretivas.",
    active: true,
  },
  {
    id: "epi-03",
    name: "Protetor auricular tipo plug",
    ca: "9.876",
    category: "Audição",
    manufacturer: "Sonora",
    norm: "ANSI S3.19",
    approvalValidity: "20/01/2027",
    sizes: "Único",
    description:
      "Protetor auricular de inserção em silicone macio, reutilizável, com atenuação de ruído (NRRsf) de 21 dB.",
    restriction: "Higienizar antes de cada uso e descartar ao primeiro sinal de deformação ou endurecimento.",
    active: true,
  },
  {
    id: "epi-04",
    name: "Luva de vaqueta",
    ca: "35.110",
    category: "Mãos",
    manufacturer: "Guanti",
    norm: "NBR 12740",
    approvalValidity: "15/11/2026",
    sizes: "8, 9, 10",
    description:
      "Luva de vaqueta/raspa para proteção das mãos contra agentes abrasivos, escoriantes e cortes leves.",
    restriction: "Não indicada para contato com eletricidade, calor intenso ou produtos químicos agressivos.",
    active: true,
  },
  {
    id: "epi-05",
    name: "Luva isolante classe 2",
    ca: "38.902",
    category: "Mãos",
    manufacturer: "Elasto",
    norm: "ASTM D120",
    approvalValidity: "08/02/2027",
    sizes: "8, 9, 10, 11",
    description:
      "Luva isolante de borracha classe 2, para trabalhos em tensão até 17 kV, com ensaio dielétrico periódico.",
    restriction:
      "Realizar teste dielétrico a cada 6 meses e usar sempre com luva de cobertura (vaqueta) por cima.",
    active: true,
  },
  {
    id: "epi-06",
    name: "Botina de segurança bico composite",
    ca: "42.185",
    category: "Pés",
    manufacturer: "Bico Forte",
    norm: "NBR 16605",
    approvalValidity: "30/06/2027",
    sizes: "38 a 44",
    description:
      "Botina de segurança em couro com biqueira composite, solado antiderrapante e resistência ao impacto de 200 J.",
    restriction: "Inspecionar solado e costuras antes de cada uso; substituir se houver descolamento.",
    active: true,
  },
  {
    id: "epi-07",
    name: "Cinto paraquedista com talabarte",
    ca: "39.221",
    category: "Altura",
    manufacturer: "AlturaMax",
    norm: "NBR 15836",
    approvalValidity: "22/04/2026",
    sizes: "Ajustável",
    description:
      "Cinto paraquedista tipo 2 pontos de ancoragem, com talabarte duplo e absorvedor de energia para trabalho em altura.",
    restriction: "Retirar de uso imediatamente após qualquer queda, mesmo sem dano aparente.",
    active: false,
    inactiveReason: "CA vencido — validade do certificado encerrada em 22/04/2026.",
  },
  {
    id: "epi-08",
    name: "Máscara de solda automática",
    ca: "44.500",
    category: "Face",
    manufacturer: "WeldaVision",
    norm: "NBR 11810",
    approvalValidity: "05/09/2027",
    sizes: "Único",
    description:
      "Máscara de solda automática com sensor solar, escurecimento de DIN 9 a 13 e tempo de resposta de 1/25.000 s.",
    restriction: "Não utilizar sobre superfície molhada e verificar o funcionamento do sensor antes de soldar.",
    active: true,
  },
  {
    id: "epi-09",
    name: "Avental de raspa de couro",
    ca: "36.118",
    category: "Tronco",
    manufacturer: "CouroPro",
    norm: "NBR 12890",
    approvalValidity: "18/12/2026",
    sizes: "Único / G / GG",
    description:
      "Avental de raspa de couro para proteção do tronco contra respingos de solda, fagulhas e calor irradiado.",
    restriction: "Manter seco e limpo; substituir ao perder a espessura ou apresentar furos.",
    active: true,
  },
  {
    id: "epi-10",
    name: "Respirador semifacial PFF2",
    ca: "27.334",
    category: "Respiratória",
    manufacturer: "AeroSafe",
    norm: "NBR 13698",
    approvalValidity: "10/07/2026",
    sizes: "Único",
    description:
      "Respirador semifacial PFF2 com filtro para partículas, eficiência de filtragem mínima de 94%.",
    restriction: "Descartar quando estiver sujo, úmido ou quando houver dificuldade para respirar.",
    active: false,
    inactiveReason: "CA cancelado — certificado suspenso junto ao órgão competente.",
  },
  {
    id: "epi-11",
    name: "Perneira de raspa",
    ca: "37.002",
    category: "Pernas",
    manufacturer: "CouroPro",
    norm: "NBR 12917",
    approvalValidity: "21/03/2027",
    sizes: "Único",
    description:
      "Perneira de raspa de couro com fechamento em velcro para proteção das pernas contra respingos e escórias.",
    restriction: "Substituir quando o velcro perder a fixação ou a raspa apresentar desgaste excessivo.",
    active: true,
  },
  {
    id: "epi-12",
    name: "Protetor facial incolor",
    ca: "33.845",
    category: "Face",
    manufacturer: "ProSafety",
    norm: "NBR 12892",
    approvalValidity: "14/10/2026",
    sizes: "Único",
    description:
      "Protetor facial incolor com suporte e carneira ajustável, para proteção contra respingos e impacto de partículas.",
    restriction: "Usar conjuntamente com óculos de proteção e substituir a viseira quando riscada ou trincada.",
    active: true,
  },
];

export const epiReasons = [
  "Admissional",
  "Periódica",
  "Substituição",
  "Troca por dano",
  "Troca por desgaste",
  "Devolução de desligamento",
];

export const initialEpiDeliveries: EpiDelivery[] = [
  {
    id: "dep-001",
    collaboratorId: "c-001",
    collaboratorName: "Carlos Menezes",
    collaboratorRole: "Soldador",
    area: "Produção",
    date: "28/09/2026",
    reason: "Admissional",
    items: [
      { name: "Capacete de segurança classe B", ca: "31.469", quantity: 1 },
      { name: "Botina de segurança bico composite", ca: "42.185", quantity: 1 },
      { name: "Óculos de proteção incolor", ca: "28.774", quantity: 2 },
      { name: "Protetor auricular tipo plug", ca: "9.876", quantity: 3 },
    ],
    signature: "",
    status: "Assinada",
    notes: "Orientado sobre guarda e conservação dos equipamentos.",
  },
  {
    id: "dep-002",
    collaboratorId: "c-003",
    collaboratorName: "Diego Farias",
    collaboratorRole: "Operador de Empilhadeira",
    area: "Logística",
    date: "27/09/2026",
    reason: "Substituição",
    items: [
      { name: "Botina de segurança bico composite", ca: "42.185", quantity: 1 },
      { name: "Luva de vaqueta", ca: "35.110", quantity: 2 },
    ],
    signature: "",
    status: "Assinada",
    notes: "Botina anterior apresentava desgaste no solado.",
  },
  {
    id: "dep-003",
    collaboratorId: "c-004",
    collaboratorName: "Roberto Lima",
    collaboratorRole: "Eletricista",
    area: "Manutenção",
    date: "25/09/2026",
    reason: "Periódica",
    items: [
      { name: "Luva isolante classe 2", ca: "38.902", quantity: 1 },
      { name: "Óculos de proteção incolor", ca: "28.774", quantity: 1 },
      { name: "Protetor facial incolor", ca: "33.845", quantity: 1 },
    ],
    signature: "",
    status: "Assinada",
    notes: "Teste dielétrico da luva agendado para a próxima semana.",
  },
  {
    id: "dep-004",
    collaboratorId: "c-009",
    collaboratorName: "Tatiane Costa",
    collaboratorRole: "Operadora de Máquinas",
    area: "Produção",
    date: "24/09/2026",
    reason: "Admissional",
    items: [
      { name: "Protetor auricular tipo plug", ca: "9.876", quantity: 3 },
      { name: "Botina de segurança bico composite", ca: "42.185", quantity: 1 },
      { name: "Óculos de proteção incolor", ca: "28.774", quantity: 1 },
    ],
    signature: "",
    status: "Pendente",
    notes: "Aguardando assinatura do aceite no sistema.",
  },
  {
    id: "dep-005",
    collaboratorId: "c-010",
    collaboratorName: "Rafael Nunes",
    collaboratorRole: "Almoxarife",
    area: "Logística",
    date: "23/09/2026",
    reason: "Troca por dano",
    items: [
      { name: "Capacete de segurança classe B", ca: "31.469", quantity: 1 },
      { name: "Luva de vaqueta", ca: "35.110", quantity: 2 },
    ],
    signature: "",
    status: "Assinada",
    notes: "Capacete danificado por impacto. Substituído no mesmo dia.",
  },
  {
    id: "dep-006",
    collaboratorId: "c-007",
    collaboratorName: "Fernanda Ribeiro",
    collaboratorRole: "Auxiliar Administrativo",
    area: "Administrativo",
    date: "22/09/2026",
    reason: "Admissional",
    items: [{ name: "Óculos de proteção incolor", ca: "28.774", quantity: 1 }],
    signature: "",
    status: "Pendente",
    notes: "Entrega de EPI para visitas à área fabril.",
  },
  {
    id: "dep-007",
    collaboratorId: "c-001",
    collaboratorName: "Carlos Menezes",
    collaboratorRole: "Soldador",
    area: "Produção",
    date: "29/09/2026",
    reason: "Substituição",
    items: [
      { name: "Avental de raspa de couro", ca: "36.118", quantity: 1 },
      { name: "Máscara de solda automática", ca: "44.500", quantity: 1 },
    ],
    signature: "",
    status: "Pendente",
    notes: "Aguardando aceite eletrônico do colaborador pelo portal.",
  },
];

export interface EpiExpiryAlert {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  epi: string;
  ca: string;
  delivered: string;
  expires: string;
  days: number;
  status: "Vencendo" | "Vencido";
}

/** Itens de EPI com validade do CA próxima do vencimento ou já vencidos. */
export const epiExpiryAlerts: EpiExpiryAlert[] = [
  { id: "ea-01", collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", epi: "Luva isolante classe 2", ca: "38.902", delivered: "14/10/2025", expires: "14/04/2026", days: -169, status: "Vencido" },
  { id: "ea-02", collaboratorId: "c-001", collaboratorName: "Carlos Menezes", collaboratorRole: "Soldador", epi: "Botina de segurança bico composite", ca: "42.185", delivered: "12/01/2026", expires: "12/07/2026", days: -80, status: "Vencido" },
  { id: "ea-03", collaboratorId: "c-003", collaboratorName: "Diego Farias", collaboratorRole: "Operador de Empilhadeira", epi: "Luva de vaqueta", ca: "35.110", delivered: "20/01/2026", expires: "20/07/2026", days: -72, status: "Vencido" },
  { id: "ea-04", collaboratorId: "c-008", collaboratorName: "Marcos Oliveira", collaboratorRole: "Supervisor de Produção", epi: "Protetor auricular tipo plug", ca: "9.876", delivered: "09/02/2026", expires: "09/08/2026", days: -52, status: "Vencido" },
  { id: "ea-05", collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", epi: "Botina de segurança bico composite", ca: "42.185", delivered: "14/10/2025", expires: "14/10/2026", days: 14, status: "Vencendo" },
  { id: "ea-06", collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", epi: "Óculos de proteção incolor", ca: "28.774", delivered: "14/10/2025", expires: "14/10/2026", days: 14, status: "Vencendo" },
];