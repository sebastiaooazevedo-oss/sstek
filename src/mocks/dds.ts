export interface DdsRecord {
  id: string;
  title: string;
  date: string;
  time: string;
  theme: string;
  trainingId: string;
  trainingName: string;
  facilitator: string;
  area: string;
  location: string;
  duration: string;
  participants: number;
  participantIds: string[];
  participantNames: string[];
  topics: string[];
  notes: string;
  status: "Realizado" | "Agendado";
  cover: string;
  photos: string[];
  /** Unidade / estabelecimento dos participantes (preenchido automaticamente). */
  establishment?: string;
}

export const ddsThemes = [
  "Trabalho em Altura (NR-35)",
  "Segurança Elétrica (NR-10)",
  "Uso de EPI",
  "Ergonomia e Movimentação de Cargas",
  "Prevenção e Combate a Incêndio",
  "Máquinas e Equipamentos (NR-12)",
  "Espaços Confinados (NR-33)",
  "Sinalização de Segurança",
  "Primeiros Socorros",
];

export const ddsAreas = [
  "Produção",
  "Manutenção",
  "Elétrica",
  "Logística",
  "Qualidade",
  "Administrativo",
  "SESMT",
];

export const ddsTrainings = [
  { id: "tr-01", name: "NR-35 · Trabalho em Altura" },
  { id: "tr-02", name: "NR-10 · Segurança em Instalações Elétricas" },
  { id: "tr-03", name: "NR-12 · Segurança em Máquinas e Equipamentos" },
  { id: "tr-04", name: "NR-33 · Espaços Confinados" },
  { id: "tr-05", name: "NR-06 · Uso de EPI" },
  { id: "tr-06", name: "NR-23 · Prevenção e Combate a Incêndio" },
  { id: "tr-07", name: "NR-17 · Ergonomia" },
  { id: "tr-08", name: "Primeiros Socorros" },
];

export const initialDds: DdsRecord[] = [
  {
    id: "dds-001",
    title: "Uso correto do cinto e linha de vida em altura",
    date: "30/09/2026",
    time: "07:10",
    theme: "Trabalho em Altura (NR-35)",
    trainingId: "tr-01",
    trainingName: "NR-35 · Trabalho em Altura",
    facilitator: "Juliana Prado",
    area: "Manutenção",
    location: "Pátio Industrial A",
    duration: "15 min",
    participants: 5,
    participantIds: ["c-001", "c-006", "c-004", "c-003", "c-008"],
    participantNames: ["Carlos Menezes", "André Souza", "Roberto Lima", "Diego Farias", "Marcos Oliveira"],
    topics: [
      "Inspeção do cinto paraquedista antes do uso",
      "Ponto de ancoragem correto e linha de vida",
      "Proibição de trabalho em altura sem autorização",
    ],
    notes: "Equipe questionou sobre validade do cinto. Reforçado o checklist de inspeção diária e registro na ficha.",
    status: "Realizado",
    cover:
      "/images/119d36fc9d.jpg",
    photos: [
      "/images/84c0670b81.jpg",
      "/images/8ec3138a7c.jpg",
    ],
  },
  {
    id: "dds-002",
    title: "Bloqueio e etiquetagem de painéis (LOTO)",
    date: "29/09/2026",
    time: "07:05",
    theme: "Segurança Elétrica (NR-10)",
    trainingId: "tr-02",
    trainingName: "NR-10 · Segurança em Instalações Elétricas",
    facilitator: "Roberto Lima",
    area: "Elétrica",
    location: "Subestação 02",
    duration: "12 min",
    participants: 3,
    participantIds: ["c-004", "c-006", "c-010"],
    participantNames: ["Roberto Lima", "André Souza", "Rafael Nunes"],
    topics: [
      "Sequência de bloqueio e etiquetagem",
      "Uso do detector de tensão e EPI isolante",
      "Responsabilidade de cada colaborador na liberação",
    ],
    notes: "Demonstração prática do cadeado de bloqueio no painel QD-04.",
    status: "Realizado",
    cover:
      "/images/9fa55715cc.jpg",
    photos: [
      "/images/3706136deb.jpg",
    ],
  },
  {
    id: "dds-003",
    title: "Postura correta no levantamento de caixas",
    date: "29/09/2026",
    time: "13:30",
    theme: "Ergonomia e Movimentação de Cargas",
    trainingId: "tr-07",
    trainingName: "NR-17 · Ergonomia",
    facilitator: "Larissa Martins",
    area: "Logística",
    location: "Área de Expedição",
    duration: "10 min",
    participants: 4,
    participantIds: ["c-003", "c-010", "c-012", "c-007"],
    participantNames: ["Diego Farias", "Rafael Nunes", "Gustavo Pereira", "Fernanda Ribeiro"],
    topics: [
      "Técnica de agachar com a coluna alinhada",
      "Limite de peso individual e uso de carrinho",
      "Alongamento antes da jornada",
    ],
    notes: "Grupo relatou dores lombares pontuais. Encaminhado para avaliação ergonômica.",
    status: "Realizado",
    cover:
      "/images/159d036876.jpg",
    photos: [
      "/images/3706136deb.jpg",
    ],
  },
  {
    id: "dds-004",
    title: "Rotas de fuga e ponto de encontro",
    date: "28/09/2026",
    time: "07:15",
    theme: "Prevenção e Combate a Incêndio",
    trainingId: "tr-06",
    trainingName: "NR-23 · Prevenção e Combate a Incêndio",
    facilitator: "Marcos Oliveira",
    area: "Produção",
    location: "Galpão de Produção 01",
    duration: "15 min",
    participants: 4,
    participantIds: ["c-001", "c-008", "c-009", "c-005"],
    participantNames: ["Carlos Menezes", "Marcos Oliveira", "Tatiane Costa", "Patrícia Gomes"],
    topics: [
      "Localização das saídas de emergência",
      "Sinalização e iluminação de emergência",
      "Ponto de encontro e contagem de pessoas",
    ],
    notes: "Simulação de abandono de área realizada ao final do diálogo.",
    status: "Realizado",
    cover:
      "/images/f3c9e6c2a3.jpg",
    photos: [
      "/images/3706136deb.jpg",
      "/images/3706136deb.jpg",
    ],
  },
  {
    id: "dds-005",
    title: "Proteções fixas e móveis nas prensas",
    date: "28/09/2026",
    time: "16:00",
    theme: "Máquinas e Equipamentos (NR-12)",
    trainingId: "tr-03",
    trainingName: "NR-12 · Segurança em Máquinas e Equipamentos",
    facilitator: "Tatiane Costa",
    area: "Produção",
    location: "Linha de Estamparia",
    duration: "12 min",
    participants: 3,
    participantIds: ["c-009", "c-008", "c-006"],
    participantNames: ["Tatiane Costa", "Marcos Oliveira", "André Souza"],
    topics: [
      "Não remover proteção das máquinas",
      "Botão de emergência e parada segura",
      "Bloqueio antes de manutenção",
    ],
    notes: "Reforçada a norma interna de jamais operar sem a proteção instalada.",
    status: "Realizado",
    cover:
      "/images/e85273676c.jpg",
    photos: [
      "/images/3706136deb.jpg",
    ],
  },
  {
    id: "dds-006",
    title: "Uso de EPI na soldagem e respingos",
    date: "01/10/2026",
    time: "07:00",
    theme: "Uso de EPI",
    trainingId: "tr-05",
    trainingName: "NR-06 · Uso de EPI",
    facilitator: "Carlos Menezes",
    area: "Manutenção",
    location: "Box de Solda 03",
    duration: "15 min",
    participants: 2,
    participantIds: ["c-001", "c-006"],
    participantNames: ["Carlos Menezes", "André Souza"],
    topics: [
      "Máscara de solda e lentes filtrantes",
      "Avental, perneira e luva de raspa",
      "Ventilação do ambiente e gases",
    ],
    notes: "Agendado após a identificação de respingos sem proteção na semana anterior.",
    status: "Agendado",
    cover:
      "/images/33f65b047a.jpg",
    photos: [],
  },
];