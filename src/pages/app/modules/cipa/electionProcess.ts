/**
 * Domínio do processo eleitoral da CIPA.
 *
 * Concentra a máquina de estados do processo (fases obrigatórias em sequência),
 * o cronograma eleitoral com os marcos da NR-5, os controles de prazo
 * (atendido / próximo / vencido / não aplicável), a comissão eleitoral, as
 * comunicações (ex.: comunicação ao sindicato da categoria preponderante) e os
 * tipos da trilha de auditoria.
 *
 * IMPORTANTE (adequação legal): o sistema NÃO embute prazos numéricos da NR-5
 * como verdade normativa. As datas e antecedências mínimas são informadas e
 * conferidas pela empresa/comissão; o motor apenas calcula a situação a partir
 * das datas registradas e dos comprovantes anexados. Toda regra que dependa de
 * interpretação da NR-5 vigente deve ser validada por responsável humano.
 */

/* ------------------------------------------------------------------ */
/* Máquina de estados do processo                                      */
/* ------------------------------------------------------------------ */

export type ElectionProcessStatus =
  | "planejamento"
  | "convocacao"
  | "inscricoes"
  | "candidaturas-encerradas"
  | "eleicao-programada"
  | "votacao-aberta"
  | "apuracao"
  | "resultado"
  | "posse"
  | "processo-concluido";

export interface ProcessPhase {
  id: ElectionProcessStatus;
  label: string;
  icon: string;
  /** Fase em que a urna/votação está aberta (resultado parcial proibido). */
  voting?: boolean;
}

/** Fluxo oficial do processo eleitoral, na ordem obrigatória. */
export const ELECTION_PROCESS_FLOW: ProcessPhase[] = [
  { id: "planejamento", label: "Planejamento", icon: "ri-draft-line" },
  { id: "convocacao", label: "Convocação", icon: "ri-megaphone-line" },
  { id: "inscricoes", label: "Inscrições", icon: "ri-user-add-line" },
  { id: "candidaturas-encerradas", label: "Candidaturas encerradas", icon: "ri-lock-line" },
  { id: "eleicao-programada", label: "Eleição programada", icon: "ri-calendar-check-line" },
  { id: "votacao-aberta", label: "Votação aberta", icon: "ri-checkbox-multiple-line", voting: true },
  { id: "apuracao", label: "Apuração", icon: "ri-scales-3-line" },
  { id: "resultado", label: "Resultado", icon: "ri-award-line" },
  { id: "posse", label: "Posse", icon: "ri-user-star-line" },
  { id: "processo-concluido", label: "Processo concluído", icon: "ri-checkbox-circle-line" },
];

export function processPhase(status: ElectionProcessStatus): ProcessPhase {
  return ELECTION_PROCESS_FLOW.find((p) => p.id === status) || ELECTION_PROCESS_FLOW[0];
}

export function processPhaseIndex(status: ElectionProcessStatus): number {
  return ELECTION_PROCESS_FLOW.findIndex((p) => p.id === status);
}

export function nextProcessStatus(status: ElectionProcessStatus): ElectionProcessStatus | null {
  const idx = processPhaseIndex(status);
  if (idx < 0 || idx >= ELECTION_PROCESS_FLOW.length - 1) return null;
  return ELECTION_PROCESS_FLOW[idx + 1].id;
}

const processStatusTone: Record<ElectionProcessStatus, string> = {
  planejamento: "bg-background-200 text-foreground-700",
  convocacao: "bg-secondary-100 text-secondary-800",
  inscricoes: "bg-secondary-100 text-secondary-800",
  "candidaturas-encerradas": "bg-background-200 text-foreground-700",
  "eleicao-programada": "bg-accent-100 text-accent-800",
  "votacao-aberta": "bg-accent-200 text-accent-900",
  apuracao: "bg-primary-100 text-primary-700",
  resultado: "bg-primary-100 text-primary-700",
  posse: "bg-primary-100 text-primary-700",
  "processo-concluido": "bg-primary-500 text-background-50",
};

export function processStatusClass(status: ElectionProcessStatus): string {
  return processStatusTone[status] || "bg-background-200 text-foreground-700";
}

/* ------------------------------------------------------------------ */
/* Cronograma eleitoral (marcos NR-5)                                  */
/* ------------------------------------------------------------------ */

export type ComplianceStatus = "atendido" | "proximo" | "vencido" | "nao-aplicavel";

export interface ScheduleTemplateItem {
  itemKey: string;
  label: string;
  /** Orientação sobre o marco (o número exato da NR-5 deve ser conferido). */
  hint: string;
  sortOrder: number;
}

/**
 * Marcos do processo eleitoral derivados da NR-5. As datas são informadas pela
 * empresa/comissão; o sistema calcula a situação. Os textos de orientação
 * apontam a necessidade de conferir o prazo vigente na norma.
 */
export const ELECTION_SCHEDULE_TEMPLATE: ScheduleTemplateItem[] = [
  {
    itemKey: "convocacao",
    label: "Convocação da eleição",
    hint: "Publicação do edital de convocação observando a antecedência mínima prevista na NR-5 vigente.",
    sortOrder: 1,
  },
  {
    itemKey: "sindicato",
    label: "Comunicação ao sindicato",
    hint: "Comunicação do início do processo eleitoral ao sindicato da categoria profissional preponderante, com comprovação de entrega.",
    sortOrder: 2,
  },
  {
    itemKey: "inscricoes",
    label: "Abertura e prazo das inscrições",
    hint: "Prazo mínimo de inscrição de chapas, conforme a NR-5 vigente.",
    sortOrder: 3,
  },
  {
    itemKey: "votacao",
    label: "Realização da votação",
    hint: "Data da eleição, dentro do prazo aplicável ao término do mandato vigente.",
    sortOrder: 4,
  },
  {
    itemKey: "termino-mandato",
    label: "Término do mandato vigente",
    hint: "Marco temporal que orienta a antecedência do processo eleitoral.",
    sortOrder: 5,
  },
  {
    itemKey: "posse",
    label: "Posse da nova CIPA",
    hint: "Posse dos eleitos após a publicação do resultado.",
    sortOrder: 6,
  },
];

export const scheduleItemLabel = (itemKey: string): string =>
  ELECTION_SCHEDULE_TEMPLATE.find((i) => i.itemKey === itemKey)?.label || itemKey;

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoToTime(value?: string | null): number {
  if (!value) return 0;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!br) return 0;
    return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])).getTime();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

export function isoToBr(value?: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export interface ScheduleComplianceInput {
  itemKey?: string;
  dueDate?: string | null;
  notApplicable?: boolean;
  done?: boolean;
}

/**
 * Situação do prazo de um marco do cronograma:
 * - "nao-aplicavel": marco dispensado;
 * - "atendido": etapa cumprida/comprovada;
 * - "vencido": sem comprovação e data-limite já passou;
 * - "proximo": sem comprovação e dentro do prazo (ou sem data definida).
 * Nunca marca "atendido" sem evidência (etapa concluída/comprovante).
 */
export function scheduleCompliance(item: ScheduleComplianceInput): ComplianceStatus {
  if (item.notApplicable) return "nao-aplicavel";
  if (item.done) return "atendido";
  const due = isoToTime(item.dueDate);
  if (!due) return "proximo";
  return due < isoToTime(todayIso()) ? "vencido" : "proximo";
}

export const complianceLabel: Record<ComplianceStatus, string> = {
  atendido: "Prazo atendido",
  proximo: "Prazo próximo",
  vencido: "Prazo vencido",
  "nao-aplicavel": "Não aplicável",
};

const complianceTone: Record<ComplianceStatus, string> = {
  atendido: "bg-primary-100 text-primary-700",
  proximo: "bg-secondary-100 text-secondary-800",
  vencido: "bg-accent-200 text-accent-900",
  "nao-aplicavel": "bg-background-200 text-foreground-600",
};

export function complianceClass(status: ComplianceStatus): string {
  return complianceTone[status] || "bg-background-200 text-foreground-700";
}

/* ------------------------------------------------------------------ */
/* Comunicação ao sindicato                                            */
/* ------------------------------------------------------------------ */

export type CommunicationKind = "sindicato" | "convocacao" | "outros";

export const communicationKinds: { id: CommunicationKind; label: string }[] = [
  { id: "sindicato", label: "Comunicação ao sindicato" },
  { id: "convocacao", label: "Comunicação de convocação" },
  { id: "outros", label: "Outras comunicações" },
];

export const communicationChannels = ["E-mail", "Carta registrada", "Protocolo presencial", "Sistema do sindicato", "Outro"];

/* ------------------------------------------------------------------ */
/* Avanço de fase (bloqueios)                                          */
/* ------------------------------------------------------------------ */

/**
 * Marcos que precisam estar cumpridos para avançar para determinada fase.
 * Garante que não haja avanço incompatível com as etapas obrigatórias.
 */
const ADVANCE_GATES: Partial<Record<ElectionProcessStatus, string[]>> = {
  "votacao-aberta": ["convocacao", "sindicato", "inscricoes"],
  apuracao: ["votacao"],
  posse: ["resultado"],
  "processo-concluido": ["posse"],
};

export interface AdvanceCheckInput {
  currentStatus: ElectionProcessStatus;
  target: ElectionProcessStatus;
  schedule: ScheduleComplianceInput[];
}

export interface AdvanceCheck {
  allowed: boolean;
  /** Motivos que impedem o avanço (prazos vencidos / marcos pendentes). */
  blockers: string[];
}

/**
 * Verifica se o processo pode avançar da fase atual para a fase seguinte.
 * Regras: (1) o avanço é sequencial (apenas para a próxima fase do fluxo);
 * (2) nenhum marco obrigatório pode estar com "prazo vencido";
 * (3) os marcos exigidos pela fase de destino precisam estar cumpridos.
 */
export function checkAdvance(input: AdvanceCheckInput): AdvanceCheck {
  const blockers: string[] = [];
  const next = nextProcessStatus(input.currentStatus);
  if (!next || next !== input.target) {
    return { allowed: false, blockers: ["Só é possível avançar para a próxima fase do fluxo do processo."] };
  }

  const overdue = input.schedule.filter((s) => scheduleCompliance(s) === "vencido");
  if (overdue.length > 0) {
    blockers.push(`${overdue.length} marco(s) do cronograma com prazo vencido — regularize antes de avançar.`);
  }

  const required = ADVANCE_GATES[input.target] || [];
  required.forEach((key) => {
    const item = input.schedule.find((s) => s.itemKey === key);
    if (!item) return;
    const status = scheduleCompliance(item);
    if (status !== "atendido" && status !== "nao-aplicavel") {
      blockers.push(`Marco obrigatório pendente: ${scheduleItemLabel(key)}.`);
    }
  });

  return { allowed: blockers.length === 0, blockers };
}