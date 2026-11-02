export interface AprRisk {
  id: string;
  hazard: string;
  risk: string;
  severity: number;
  probability: number;
  control: string;
}

export interface AprSignature {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  signature: string;
}

export interface AprRecord {
  id: string;
  title: string;
  /** Número da solicitação que a APR representa (obrigatório). */
  requestNumber: string;
  /** Colaborador que cadastrou a APR (quando enviada pelo colaborador). */
  createdByRef?: string;
  createdByName?: string;
  /** Origem do cadastro: painel da gestão ou envio do próprio colaborador. */
  origin?: "admin" | "colaborador";
  activity: string;
  area: string;
  /** Estabelecimento/unidade ao qual a APR está vinculada. */
  establishment: string;
  location: string;
  date: string;
  responsible: string;
  risks: AprRisk[];
  signatures: AprSignature[];
  notes: string;
  status: "Concluída" | "Pendente";
}

export const aprAreas = [
  "Produção",
  "Manutenção",
  "Logística",
  "Administrativo",
  "Qualidade",
  "SESMT",
  "Obra externa",
];

export const aprActivities = [
  "Trabalho em altura",
  "Solda e corte a quente",
  "Intervenção elétrica",
  "Movimentação de cargas",
  "Espaço confinado",
  "Manutenção mecânica",
  "Operação de empilhadeira",
];

export const aprSeverityScale = [1, 2, 3, 4, 5];

export const initialAprs: AprRecord[] = [
  {
    id: "apr-001",
    title: "Trabalho em altura na linha de pintura",
    requestNumber: "SOL-2026-0148",
    activity: "Trabalho em altura",
    area: "Manutenção",
    establishment: "Unidade Matriz — São Bernardo do Campo",
    location: "Galpão B — Linha de pintura",
    date: "28/09/2026",
    responsible: "Juliana Prado",
    risks: [
      { id: "r-1", hazard: "Altura superior a 2 metros", risk: "Queda de nível", severity: 5, probability: 3, control: "Cinto paraquedista com talabarte duplo e linha de vida; ancoragem verificada." },
      { id: "r-2", hazard: "Ferramentas em altura", risk: "Queda de objetos sobre terceiros", severity: 4, probability: 2, control: "Amarração das ferramentas e isolamento da área sob a atividade." },
      { id: "r-3", hazard: "Superfície escorregadia", risk: "Perda de equilíbrio", severity: 3, probability: 2, control: "Limpeza prévia e calçado antiderrapante." },
    ],
    signatures: [
      { collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", signature: "" },
      { collaboratorId: "c-006", collaboratorName: "André Souza", collaboratorRole: "Mecânico Industrial", signature: "" },
      { collaboratorId: "c-001", collaboratorName: "Carlos Menezes", collaboratorRole: "Soldador", signature: "" },
    ],
    notes: "Atividade executada com plataforma elevatória e supervisão do SESMT.",
    status: "Concluída",
  },
  {
    id: "apr-002",
    title: "Intervenção elétrica no painel QGBT",
    requestNumber: "SOL-2026-0141",
    activity: "Intervenção elétrica",
    area: "Manutenção",
    establishment: "Unidade Matriz — São Bernardo do Campo",
    location: "Subestação — Painel QGBT",
    date: "26/09/2026",
    responsible: "Roberto Lima",
    risks: [
      { id: "r-1", hazard: "Contato com partes energizadas", risk: "Choque elétrico", severity: 5, probability: 2, control: "Bloqueio e etiquetagem (LOTO) e uso de EPI isolante." },
      { id: "r-2", hazard: "Arco elétrico", risk: "Queimaduras", severity: 5, probability: 2, control: "Vestimenta antichama e protetor facial." },
      { id: "r-3", hazard: "Ferramenta isolada inadequada", risk: "Choque por falha de isolamento", severity: 4, probability: 2, control: "Teste dielétrico das luvas e ferramentas certificadas." },
    ],
    signatures: [
      { collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", signature: "" },
      { collaboratorId: "c-006", collaboratorName: "André Souza", collaboratorRole: "Mecânico Industrial", signature: "" },
    ],
    notes: "Intervenção realizada com a rede desenergizada e aterramento temporário.",
    status: "Concluída",
  },
  {
    id: "apr-003",
    title: "Movimentação de carga com ponte rolante",
    requestNumber: "SOL-2026-0137",
    activity: "Movimentação de cargas",
    area: "Logística",
    establishment: "Filial Campinas",
    location: "Pátio de expedição",
    date: "24/09/2026",
    responsible: "Marcos Oliveira",
    risks: [
      { id: "r-1", hazard: "Carga suspensa", risk: "Queda de material", severity: 4, probability: 2, control: "Inspeção das cintas e cabos; proibido permanecer sob a carga." },
      { id: "r-2", hazard: "Falha de comunicação", risk: "Movimentação incorreta da carga", severity: 3, probability: 3, control: "Sinaleiro capacitado e uso de rádio comunicador." },
    ],
    signatures: [
      { collaboratorId: "c-003", collaboratorName: "Diego Farias", collaboratorRole: "Operador de Empilhadeira", signature: "" },
      { collaboratorId: "c-010", collaboratorName: "Rafael Nunes", collaboratorRole: "Almoxarife", signature: "" },
      { collaboratorId: "c-008", collaboratorName: "Marcos Oliveira", collaboratorRole: "Supervisor de Produção", signature: "" },
    ],
    notes: "Aguardando coleta das assinaturas dos executantes.",
    status: "Pendente",
  },
  {
    id: "apr-004",
    title: "Solda e corte no setor de caldeiraria",
    requestNumber: "SOL-2026-0129",
    activity: "Solda e corte a quente",
    area: "Produção",
    establishment: "Unidade Matriz — São Bernardo do Campo",
    location: "Galpão A — Caldeiraria",
    date: "22/09/2026",
    responsible: "Larissa Martins",
    risks: [
      { id: "r-1", hazard: "Radiação não ionizante", risk: "Queimadura ocular", severity: 4, probability: 3, control: "Máscara de solda automática e biombos de proteção." },
      { id: "r-2", hazard: "Fagulhas e respingos", risk: "Queimaduras e princípio de incêndio", severity: 4, probability: 3, control: "Avental de raspa, extintor próximo e cone de contenção de fagulhas." },
      { id: "r-3", hazard: "Fumos metálicos", risk: "Intoxicação respiratória", severity: 4, probability: 3, control: "Respirador PFF2 e ventilação local exaustora." },
    ],
    signatures: [
      { collaboratorId: "c-001", collaboratorName: "Carlos Menezes", collaboratorRole: "Soldador", signature: "" },
      { collaboratorId: "c-009", collaboratorName: "Tatiane Costa", collaboratorRole: "Operadora de Máquinas", signature: "" },
    ],
    notes: "Área sinalizada e isolada durante toda a execução da atividade.",
    status: "Concluída",
  },
];