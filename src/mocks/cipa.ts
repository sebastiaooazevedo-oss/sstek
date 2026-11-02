/**
 * Dados de demonstração do módulo CIPA (Comissão Interna de Prevenção de
 * Acidentes e Assédio). Atende empresas com mais de uma CIPA (matriz e
 * filiais), com composição, mandato, reuniões/agenda, atas, plano de
 * ações, eleições e inspeções com registro fotográfico.
 *
 * Os itens seguem a estrutura da NR-5 (dimensionamento, mandato,
 * representação) e servem de roteiro real para as telas do módulo.
 */

export type CipaStatus = "Ativa" | "Em eleição" | "Encerrada";
export type CipaRepresentation = "Empregador" | "Empregado";
export type CipaMemberRole =
  | "Presidente"
  | "Vice-Presidente"
  | "Secretário"
  | "Titular"
  | "Suplente";

export interface CipaMember {
  id: string;
  name: string;
  roleFunction: string;
  area: string;
  registration: string;
  representation: CipaRepresentation;
  memberRole: CipaMemberRole;
  since: string;
}

export interface Cipa {
  id: string;
  name: string;
  unit: string;
  city: string;
  cnpj: string;
  riskGrade: string;
  employeesCount: number;
  mandateNumber: string;
  mandateStart: string;
  mandateEnd: string;
  status: CipaStatus;
  members: CipaMember[];
}

export type MeetingType = "Ordinária" | "Extraordinária" | "Evento / Campanha";
export type MeetingStatus = "Agendada" | "Realizada" | "Cancelada";

export interface CipaMeeting {
  id: string;
  cipaId: string;
  title: string;
  type: MeetingType;
  date: string;
  time: string;
  location: string;
  agenda: string[];
  notes: string;
  status: MeetingStatus;
}

export interface CipaPhoto {
  id: string;
  url: string;
  name: string;
}

export interface CipaAtaSignature {
  id: string;
  role: "Presidente" | "Secretário" | "Responsável Técnico";
  name: string;
  collaboratorId: string | null;
  signedAt: string | null;
  signatureUid: string | null;
  representationSnapshot: string | null;
}

export interface CipaAta {
  id: string;
  cipaId: string;
  meetingId: string;
  number: string;
  date: string;
  title: string;
  content: string;
  decisions: string[];
  participants: string[];
  photos: CipaPhoto[];
  approvals: CipaAtaSignature[];
}

export type ActionStatus = "Pendente" | "Em andamento" | "Concluída" | "Atrasada";
export type ActionPriority = "Baixa" | "Média" | "Alta" | "Crítica";

export interface CipaAction {
  id: string;
  cipaId: string;
  title: string;
  description: string;
  origin: string;
  responsible: string;
  dueDate: string;
  priority: ActionPriority;
  status: ActionStatus;
}

export type ElectionStatus = "Inscrições" | "Em votação" | "Apurada" | "Publicada";

export interface ElectionCandidate {
  id: string;
  name: string;
  roleFunction: string;
  area: string;
  votes: number;
  /** Matrícula do colaborador candidato. */
  registration?: string;
  /** Contato (e-mail ou telefone) informado na ficha. */
  contact?: string;
  /** Foto 3x4 com fundo branco (data URL ou URL). */
  photoUrl?: string;
  /** Data do cadastro da ficha (dd/mm/aaaa). */
  declaredAt?: string;
}

export interface CipaElection {
  id: string;
  cipaId: string;
  title: string;
  year: string;
  processNumber: string;
  registrationStart: string;
  registrationEnd: string;
  voteDate: string;
  /** Hora de início do período de votação, no formato HH:mm. */
  voteStartTime?: string;
  /** Hora de encerramento do período de votação, no formato HH:mm. */
  voteEndTime?: string;
  /** Estabelecimento/unidade a que a eleição pertence. */
  establishment?: string;
  status: ElectionStatus;
  eligibleVoters: number;
  /** Número de vagas de titular a preencher no processo eleitoral. */
  titularVacancies?: number;
  /** Número de vagas de suplente a preencher no processo eleitoral. */
  suplenteVacancies?: number;
  /** Texto do aviso público de inscrições exibido a todos. */
  notice?: string;
  candidates: ElectionCandidate[];
}

export interface InspectionItem {
  id: string;
  label: string;
  status: string;
  note: string;
}

export interface CipaInspection {
  id: string;
  cipaId: string;
  title: string;
  date: string;
  area: string;
  location: string;
  /** Unidade/estabelecimento onde a inspeção foi realizada. */
  establishment: string;
  responsible: string;
  checklist: InspectionItem[];
  nonConformities: string;
  risk: string;
  action: string;
  actionOwner: string;
  actionDue: string;
  photos: CipaPhoto[];
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Catálogos                                                            */
/* ------------------------------------------------------------------ */

export const cipaStatuses: CipaStatus[] = ["Ativa", "Em eleição", "Encerrada"];
export const cipaRepresentations: CipaRepresentation[] = ["Empregador", "Empregado"];
export const cipaMemberRoles: CipaMemberRole[] = [
  "Presidente",
  "Vice-Presidente",
  "Secretário",
  "Titular",
  "Suplente",
];
export const meetingTypes: MeetingType[] = ["Ordinária", "Extraordinária", "Evento / Campanha"];
export const meetingStatuses: MeetingStatus[] = ["Agendada", "Realizada", "Cancelada"];
export const actionStatuses: ActionStatus[] = ["Pendente", "Em andamento", "Concluída", "Atrasada"];
export const actionPriorities: ActionPriority[] = ["Baixa", "Média", "Alta", "Crítica"];
export const electionStatuses: ElectionStatus[] = ["Inscrições", "Em votação", "Apurada", "Publicada"];

/** Requisitos de elegibilidade para concorrer às vagas (NR-5). */
export const candidateRequirements: string[] = [
  "Ser empregado(a) da empresa e estar no pleno gozo dos direitos trabalhistas;",
  "Ter no mínimo 18 anos completos na data da posse;",
  "Não ocupar cargo de direção, chefia ou gerência (para representantes dos empregados);",
  "Não ter sido candidato(a) a cargo eletivo sindical no mesmo período;",
  "Estar apto(a) a cumprir o mandato de 1 ano, podendo ser reeleito(a) uma única vez consecutiva;",
  "Apresentar ficha de inscrição completa, com foto 3x4 conforme as recomendações do edital;",
  "Estar em situação regular junto ao processo eleitoral e respeitar o prazo de inscrição.",
];

/** Recomendações técnicas para a foto 3x4 de candidatura. */
export const candidatePhotoGuidelines: string[] = [
  "Fundo branco, uniforme, sem sombras nem objetos ao fundo;",
  "Foto 3x4 recente (últimos 6 meses) e colorida;",
  "Rosto centralizado, de frente, com expressão neutra e olhos abertos;",
  "Sem óculos escuros, boné, chapéu ou acessórios que cubram o rosto;",
  "Cabelos afastados do rosto, sem filtros e sem efeitos de edição;",
  "Boa iluminação e enquadramento do rosto do ombro para cima;",
  "Arquivo em JPG ou PNG, com no máximo 5 MB.",
];
export const actionOrigins = ["Ata de reunião", "Reunião ordinária", "Inspeção de campo", "Denúncia/canal", "Solicitação do SESMT"];

export const inspectionItems: Omit<InspectionItem, "status" | "note">[] = [
  { id: "epi", label: "Uso correto de EPIs" },
  { id: "ordem", label: "Ordem e limpeza do ambiente (5S)" },
  { id: "protecao", label: "Proteções de máquinas e equipamentos" },
  { id: "eletrica", label: "Instalações elétricas e quadros" },
  { id: "sinalizacao", label: "Sinalização de segurança" },
  { id: "incendio", label: "Extintores e combate a incêndio" },
  { id: "circulacao", label: "Vias de circulação e acessos" },
  { id: "ergonomia", label: "Ergonomia dos postos de trabalho" },
];

export const inspectionItemStatuses = ["Conforme", "Não conforme", "Não aplicável"];
export const inspectionRiskLevels = ["Baixo", "Médio", "Alto", "Crítico"];

/* ------------------------------------------------------------------ */
/* Dados iniciais                                                       */
/* ------------------------------------------------------------------ */

export const initialCipas: Cipa[] = [
  {
    id: "cipa-1",
    name: "CIPA Matriz",
    unit: "Unidade Matriz — São Bernardo do Campo",
    city: "São Bernardo do Campo/SP",
    cnpj: "12.345.678/0001-90",
    riskGrade: "Grau 3",
    employeesCount: 248,
    mandateNumber: "2026/2027",
    mandateStart: "01/01/2026",
    mandateEnd: "31/12/2027",
    status: "Ativa",
    members: [
      { id: "m-1", name: "Carlos Menezes", roleFunction: "Soldador", area: "Produção", registration: "100234", representation: "Empregado", memberRole: "Presidente", since: "01/01/2026" },
      { id: "m-2", name: "Larissa Martins", roleFunction: "Engenheira de Segurança", area: "SESMT", registration: "100233", representation: "Empregador", memberRole: "Vice-Presidente", since: "01/01/2026" },
      { id: "m-3", name: "Tatiane Costa", roleFunction: "Operadora de Máquinas", area: "Produção", registration: "100688", representation: "Empregado", memberRole: "Secretário", since: "01/01/2026" },
      { id: "m-4", name: "Roberto Lima", roleFunction: "Eletricista", area: "Manutenção", registration: "100342", representation: "Empregado", memberRole: "Titular", since: "01/01/2026" },
      { id: "m-5", name: "Diego Farias", roleFunction: "Operador de Empilhadeira", area: "Logística", registration: "100877", representation: "Empregado", memberRole: "Titular", since: "01/01/2026" },
      { id: "m-6", name: "Patrícia Gomes", roleFunction: "Analista de Qualidade", area: "Qualidade", registration: "100120", representation: "Empregador", memberRole: "Titular", since: "01/01/2026" },
      { id: "m-7", name: "Rafael Nunes", roleFunction: "Almoxarife", area: "Logística", registration: "100455", representation: "Empregado", memberRole: "Suplente", since: "01/01/2026" },
      { id: "m-8", name: "Fernanda Ribeiro", roleFunction: "Auxiliar Administrativo", area: "Administrativo", registration: "101204", representation: "Empregador", memberRole: "Suplente", since: "01/01/2026" },
    ],
  },
  {
    id: "cipa-2",
    name: "CIPA Filial Campinas",
    unit: "Filial Campinas",
    city: "Campinas/SP",
    cnpj: "12.345.678/0002-71",
    riskGrade: "Grau 3",
    employeesCount: 96,
    mandateNumber: "2026/2027",
    mandateStart: "01/03/2026",
    mandateEnd: "28/02/2028",
    status: "Ativa",
    members: [
      { id: "m-9", name: "Bruno Carvalho", roleFunction: "Supervisor de Logística", area: "Logística", registration: "201188", representation: "Empregado", memberRole: "Presidente", since: "01/03/2026" },
      { id: "m-10", name: "Aline Ferraz", roleFunction: "Técnica de Segurança", area: "SESMT", registration: "201044", representation: "Empregador", memberRole: "Vice-Presidente", since: "01/03/2026" },
      { id: "m-11", name: "Jonas Ribeiro", roleFunction: "Auxiliar de Armazém", area: "Logística", registration: "201320", representation: "Empregado", memberRole: "Secretário", since: "01/03/2026" },
      { id: "m-12", name: "Sofia Andrade", roleFunction: "Analista de RH", area: "Administrativo", registration: "201009", representation: "Empregador", memberRole: "Titular", since: "01/03/2026" },
      { id: "m-13", name: "Pedro Antunes", roleFunction: "Empilhadeirista", area: "Logística", registration: "201455", representation: "Empregado", memberRole: "Suplente", since: "01/03/2026" },
    ],
  },
  {
    id: "cipa-3",
    name: "CIPA Filial Recife",
    unit: "Filial Recife",
    city: "Recife/PE",
    cnpj: "12.345.678/0003-52",
    riskGrade: "Grau 2",
    employeesCount: 54,
    mandateNumber: "2025/2026",
    mandateStart: "01/06/2025",
    mandateEnd: "31/05/2026",
    status: "Em eleição",
    members: [
      { id: "m-14", name: "Camila Torres", roleFunction: "Assistente Administrativo", area: "Administrativo", registration: "301002", representation: "Empregado", memberRole: "Presidente", since: "01/06/2025" },
      { id: "m-15", name: "Eduardo Lins", roleFunction: "Técnico de Manutenção", area: "Manutenção", registration: "301088", representation: "Empregado", memberRole: "Titular", since: "01/06/2025" },
    ],
  },
];

export const initialMeetings: CipaMeeting[] = [
  {
    id: "mt-1",
    cipaId: "cipa-1",
    title: "Reunião Ordinária — Outubro/2026",
    type: "Ordinária",
    date: "08/10/2026",
    time: "14:00",
    location: "Sala de Treinamento 1 — Matriz",
    agenda: [
      "Leitura e aprovação da ata anterior",
      "Análise das inspeções de campo do mês",
      "Andamento do mapa de risco e do PGR",
      "Campanha de prevenção ao assédio (NR-5)",
      "Definição de ações e responsáveis",
    ],
    notes: "Reunião mensal ordinária prevista no calendário anual da CIPA.",
    status: "Agendada",
  },
  {
    id: "mt-2",
    cipaId: "cipa-2",
    title: "Reunião Ordinária — Outubro/2026",
    type: "Ordinária",
    date: "15/10/2026",
    time: "09:30",
    location: "Auditório — Filial Campinas",
    agenda: [
      "Indicadores de acidentes e quase-acidentes",
      "Revisão dos EPIs entregues",
      "Organização da SIPAT",
    ],
    notes: "",
    status: "Agendada",
  },
  {
    id: "mt-3",
    cipaId: "cipa-1",
    title: "SIPAT 2026 — Semana de Prevenção",
    type: "Evento / Campanha",
    date: "10/11/2026",
    time: "08:00",
    location: "Pátio central — Matriz",
    agenda: [
      "Abertura oficial com liderança",
      "Palestra: saúde mental e assédio no trabalho",
      "Simulado de evacuação",
      "Dinâmicas de segurança e premiações",
    ],
    notes: "Evento aberto a todos os colaboradores. Estrutura a definir.",
    status: "Agendada",
  },
  {
    id: "mt-4",
    cipaId: "cipa-1",
    title: "Reunião Ordinária — Setembro/2026",
    type: "Ordinária",
    date: "10/09/2026",
    time: "14:00",
    location: "Sala de Treinamento 1 — Matriz",
    agenda: ["Leitura da ata anterior", "Relatório de inspeções", "Ações em aberto"],
    notes: "",
    status: "Realizada",
  },
  {
    id: "mt-5",
    cipaId: "cipa-3",
    title: "Reunião Extraordinária — Eleição 2026",
    type: "Extraordinária",
    date: "22/09/2026",
    time: "16:00",
    location: "Sala de Reuniões — Filial Recife",
    agenda: ["Formação da comissão eleitoral", "Calendário do processo eleitoral", "Regras de inscrição e votação"],
    notes: "",
    status: "Realizada",
  },
];

export const initialAtas: CipaAta[] = [
  {
    id: "ata-1",
    cipaId: "cipa-1",
    meetingId: "mt-4",
    number: "012/2026",
    date: "10/09/2026",
    title: "Ata da Reunião Ordinária de Setembro/2026",
    content:
      "Aos dez dias do mês de setembro de dois mil e vinte e seis, reuniram-se os membros da CIPA da unidade Matriz, em primeira convocação, na Sala de Treinamento 1. A presidente em exercício abriu a reunião e submeteu à aprovação a ata anterior, aprovada por unanimidade. Em seguida foram apresentados os resultados das inspeções de campo realizadas no período, com destaque para o uso irregular de EPIs no setor de solda e a ausência de sinalização em duas rotas de fuga. O SESMT apresentou o andamento do plano de ação do PGR.",
    decisions: [
      "Reforçar a fiscalização do uso de EPIs no setor de solda.",
      "Repor a sinalização das rotas de fuga até 30/09/2026.",
      "Incluir tema de prevenção ao assédio na SIPAT.",
    ],
    participants: ["Carlos Menezes", "Larissa Martins", "Tatiane Costa", "Roberto Lima", "Diego Farias", "Patrícia Gomes"],
    photos: [
      {
        id: "ph-a1-1",
        url: "/images/3463135c02.jpg",
        name: "reuniao-setembro.jpg",
      },
    ],
    approvals: [
      {
        id: "apr-ata1-1",
        role: "Presidente",
        name: "Carlos Menezes",
        collaboratorId: "c-001",
        signedAt: "2026-09-10T17:12:44.000Z",
        signatureUid: "6f1c9a2e-4b7d-4c33-9f7a-2d5e8b1a0c94",
        representationSnapshot: null,
      },
      {
        id: "apr-ata1-2",
        role: "Secretário",
        name: "Tatiane Costa",
        collaboratorId: "c-009",
        signedAt: "2026-09-10T17:14:02.000Z",
        signatureUid: "b2a7f0d1-8e34-4a6c-b1d9-7c3f5e2a8b06",
        representationSnapshot: null,
      },
    ],
  },
  {
    id: "ata-2",
    cipaId: "cipa-3",
    meetingId: "mt-5",
    number: "005/2026",
    date: "22/09/2026",
    title: "Ata da Reunião Extraordinária — Processo Eleitoral 2026",
    content:
      "Aos vinte e dois dias do mês de setembro de dois mil e vinte e seis, a CIPA da Filial Recife reuniu-se extraordinariamente para tratar da eleição da nova composição. Foi nomeada a comissão eleitoral, definido o calendário de inscrições e votação e aprovado o edital do processo, que será publicado no quadro de avisos e comunicado por e-mail a todos os empregados.",
    decisions: [
      "Publicar o edital de eleição até 25/09/2026.",
      "Abrir inscrições de chapas conforme calendário aprovado.",
      "Garantir voto secreto e apuração pública.",
    ],
    participants: ["Camila Torres", "Eduardo Lins", "Comissão Eleitoral"],
    photos: [],
    approvals: [
      {
        id: "apr-ata2-1",
        role: "Presidente",
        name: "Camila Torres",
        collaboratorId: null,
        signedAt: null,
        signatureUid: null,
        representationSnapshot: null,
      },
    ],
  },
];

export const initialActions: CipaAction[] = [
  {
    id: "ac-1",
    cipaId: "cipa-1",
    title: "Repor sinalização das rotas de fuga",
    description: "Instalar e renovar a sinalização das rotas de fuga dos setores de produção e expedição.",
    origin: "Ata de reunião",
    responsible: "Manutenção / SESMT",
    dueDate: "30/09/2026",
    priority: "Alta",
    status: "Atrasada",
  },
  {
    id: "ac-2",
    cipaId: "cipa-1",
    title: "Reforçar fiscalização de EPIs no setor de solda",
    description: "Definir escala de fiscalização e comunicação com as lideranças da produção.",
    origin: "Inspeção de campo",
    responsible: "Larissa Martins",
    dueDate: "15/10/2026",
    priority: "Alta",
    status: "Em andamento",
  },
  {
    id: "ac-3",
    cipaId: "cipa-1",
    title: "Organizar a SIPAT 2026",
    description: "Formar comissão organizadora, definir programação e orçamento do evento.",
    origin: "Reunião ordinária",
    responsible: "Comissão CIPA",
    dueDate: "30/10/2026",
    priority: "Média",
    status: "Em andamento",
  },
  {
    id: "ac-4",
    cipaId: "cipa-2",
    title: "Treinamento de uso de extintores",
    description: "Programar treinamento prático de combate a incêndio para as equipes do armazém.",
    origin: "Ata de reunião",
    responsible: "Aline Ferraz",
    dueDate: "20/10/2026",
    priority: "Média",
    status: "Pendente",
  },
  {
    id: "ac-5",
    cipaId: "cipa-1",
    title: "Ajuste da iluminação do posto de embalagem",
    description: "Corrigir o nível de iluminamento conforme laudo de ergonomia.",
    origin: "Inspeção de campo",
    responsible: "Manutenção",
    dueDate: "05/09/2026",
    priority: "Baixa",
    status: "Concluída",
  },
];

export const initialElections: CipaElection[] = [
  {
    id: "el-1",
    cipaId: "cipa-3",
    title: "Eleição da CIPA — Gestão 2026/2027",
    year: "2026",
    processNumber: "PROC-CIPA-RE-2026",
    registrationStart: "25/09/2026",
    registrationEnd: "20/10/2026",
    voteDate: "30/10/2026",
    status: "Inscrições",
    eligibleVoters: 54,
    titularVacancies: 2,
    suplenteVacancies: 2,
    notice:
      "Estão abertas as inscrições de chapas para a eleição da CIPA da Filial Recife, gestão 2026/2027. Podem se candidatar todos os empregados que atendam aos requisitos do edital. As inscrições devem ser feitas presencialmente na Comissão Eleitoral ou por meio da ficha eletrônica, acompanhadas de foto 3x4 com fundo branco. Divulgue seu interesse: a lista de candidatos inscritos fica disponível a todos.",
    candidates: [
      {
        id: "ca-1",
        name: "Camila Torres",
        roleFunction: "Assistente Administrativo",
        area: "Administrativo",
        votes: 0,
        registration: "301002",
        contact: "camila.torres@empresa.com.br",
        photoUrl:
          "/images/5f4110c9d1.jpg",
        declaredAt: "29/09/2026",
      },
      {
        id: "ca-2",
        name: "Eduardo Lins",
        roleFunction: "Técnico de Manutenção",
        area: "Manutenção",
        votes: 0,
        registration: "301088",
        contact: "eduardo.lins@empresa.com.br",
        photoUrl:
          "/images/5c4fefd28d.jpg",
        declaredAt: "01/10/2026",
      },
      {
        id: "ca-3",
        name: "Marina Barros",
        roleFunction: "Auxiliar de Serviços",
        area: "Administrativo",
        votes: 0,
        registration: "301233",
        contact: "marina.barros@empresa.com.br",
        photoUrl:
          "/images/da79485986.jpg",
        declaredAt: "02/10/2026",
      },
    ],
  },
  {
    id: "el-2",
    cipaId: "cipa-2",
    title: "Eleição da CIPA — Gestão 2026/2027",
    year: "2026",
    processNumber: "PROC-CIPA-CPS-2026",
    registrationStart: "01/02/2026",
    registrationEnd: "12/02/2026",
    voteDate: "26/02/2026",
    status: "Publicada",
    eligibleVoters: 96,
    titularVacancies: 2,
    suplenteVacancies: 1,
    candidates: [
      { id: "ca-4", name: "Bruno Carvalho", roleFunction: "Supervisor de Logística", area: "Logística", votes: 44 },
      { id: "ca-5", name: "Jonas Ribeiro", roleFunction: "Auxiliar de Armazém", area: "Logística", votes: 31 },
      { id: "ca-6", name: "Pedro Antunes", roleFunction: "Empilhadeirista", area: "Logística", votes: 15 },
    ],
  },
];

export const initialInspections: CipaInspection[] = [
  {
    id: "ins-1",
    cipaId: "cipa-1",
    title: "Inspeção de rotina — Setor de Solda",
    date: "28/09/2026",
    area: "Produção",
    location: "Galpão 2 — linha de solda",
    establishment: "Unidade Matriz — São Bernardo do Campo",
    responsible: "Larissa Martins",
    checklist: [
      { id: "epi", label: "Uso correto de EPIs", status: "Não conforme", note: "Dois colaboradores sem protetor facial." },
      { id: "ordem", label: "Ordem e limpeza do ambiente (5S)", status: "Conforme", note: "" },
      { id: "protecao", label: "Proteções de máquinas e equipamentos", status: "Conforme", note: "" },
      { id: "eletrica", label: "Instalações elétricas e quadros", status: "Não conforme", note: "Quadro sem identificação dos circuitos." },
      { id: "sinalizacao", label: "Sinalização de segurança", status: "Conforme", note: "" },
      { id: "incendio", label: "Extintores e combate a incêndio", status: "Conforme", note: "" },
      { id: "circulacao", label: "Vias de circulação e acessos", status: "Conforme", note: "" },
      { id: "ergonomia", label: "Ergonomia dos postos de trabalho", status: "Não aplicável", note: "" },
    ],
    nonConformities: "Uso irregular de EPI (protetor facial) e quadro elétrico sem identificação dos circuitos.",
    risk: "Alto",
    action: "Reforçar fiscalização de EPIs e identificar os circuitos do quadro elétrico.",
    actionOwner: "SESMT / Manutenção",
    actionDue: "15/10/2026",
    photos: [
      {
        id: "ph-i1-1",
        url: "/images/ed6ee3e197.jpg",
        name: "solda-epi.jpg",
      },
      {
        id: "ph-i1-2",
        url: "/images/5cdad348ed.jpg",
        name: "quadro-eletrico.jpg",
      },
    ],
    notes: "Reinspeção prevista para a primeira quinzena de outubro.",
  },
  {
    id: "ins-2",
    cipaId: "cipa-2",
    title: "Inspeção de rotina — Armazém e Expedição",
    date: "02/10/2026",
    area: "Logística",
    location: "Armazém central",
    establishment: "Filial Campinas",
    responsible: "Aline Ferraz",
    checklist: [
      { id: "epi", label: "Uso correto de EPIs", status: "Conforme", note: "" },
      { id: "ordem", label: "Ordem e limpeza do ambiente (5S)", status: "Conforme", note: "" },
      { id: "protecao", label: "Proteções de máquinas e equipamentos", status: "Não aplicável", note: "" },
      { id: "eletrica", label: "Instalações elétricas e quadros", status: "Conforme", note: "" },
      { id: "sinalizacao", label: "Sinalização de segurança", status: "Não conforme", note: "Faixa de pedestre interna desgastada." },
      { id: "incendio", label: "Extintores e combate a incêndio", status: "Conforme", note: "" },
      { id: "circulacao", label: "Vias de circulação e acessos", status: "Não conforme", note: "Corredor obstruído por paletes." },
      { id: "ergonomia", label: "Ergonomia dos postos de trabalho", status: "Conforme", note: "" },
    ],
    nonConformities: "Sinalização interna desgastada e corredor de circulação obstruído.",
    risk: "Médio",
    action: "Renovar a sinalização e liberar as vias de circulação.",
    actionOwner: "Supervisão de Logística",
    actionDue: "12/10/2026",
    photos: [
      {
        id: "ph-i2-1",
        url: "/images/0f22b8d111.jpg",
        name: "corredor-obstruido.jpg",
      },
    ],
    notes: "",
  },
];