import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { DocumentRecord } from "@/mocks/documents";
import { updateDocumentValidity } from "@/pages/app/modules/documentos/documentsStore";
import { canRequestRenewal } from "@/pages/app/modules/documentos/documentUtils";
import { getSettings } from "@/pages/app/settings/settingsStore";

/**
 * Solicitações de renovação de documentos.
 *
 * Documento de segurança não se "renova" trocando uma data: é preciso
 * providenciar um documento novo (ASO, treinamento, laudo...). Este store
 * conduz essa tratativa em etapas, com responsável obrigatório, delegação,
 * prazo (SLA) por tipo de documento, tarefas concluídas com dia e hora e
 * conclusão sem volta.
 *
 * A persistência é feita no Supabase (tabela `document_renewal_requests`), por
 * empresa, então a equipe acompanha a mesma fila de qualquer dispositivo. O
 * localStorage continua sendo usado apenas como cache de leitura offline.
 */

export type RenewalStatus =
  | "aberta"
  | "em-tratativa"
  | "aguardando-exames"
  | "documento-recebido"
  | "concluida";

export interface RenewalTask {
  id: string;
  label: string;
  done: boolean;
  /** Momento da conclusão (ISO). Uma vez concluída, não é editável. */
  doneAt?: string;
  doneBy?: string;
}

export interface RenewalExam {
  id: string;
  name: string;
  instructions: string;
}

export interface RenewalAttachment {
  id: string;
  name: string;
  size: string;
  at: string;
}

export interface RenewalLogEntry {
  at: string;
  label: string;
  by?: string;
  /**
   * Evento automático do sistema que NÃO representa movimentação da tratativa
   * (ex.: aviso de prazo por e-mail). Não renova o relógio de tratativa parada.
   */
  system?: boolean;
}

/** Público de um aviso de prazo por e-mail. */
export type RenewalNoticeAudience = "gestor" | "responsavel" | "escalonamento";

/**
 * Aviso de prazo efetivamente enviado para uma tratativa.
 *
 * Fica gravado dentro da própria solicitação (além do controle na tabela de
 * notificações), para que o modal mostre destinatário, público e data sem
 * depender de uma consulta extra.
 */
export interface RenewalDeadlineNotice {
  id: string;
  audience: RenewalNoticeAudience;
  /** E-mail que recebeu o aviso. */
  recipient: string;
  /** Nome de quem recebeu (gestor ou responsável). */
  recipientName?: string;
  /** Data-limite considerada no aviso. */
  dueAt: string;
  /** Dias restantes no momento do envio (negativo = atrasada). */
  remainingDays: number;
  sentAt: string;
  sentBy?: string;
}

export type RenewalEmailStatus = "" | "sent" | "not-configured" | "error";

export interface RenewalRequest {
  id: string;
  /**
   * Número público da solicitação (ex.: RS-2026-0001).
   * Gerado automaticamente na abertura e usado nas buscas e no atendimento.
   */
  code: string;
  companyRef: string;
  documentId: string;
  documentName: string;
  documentTypeId: string;
  documentTypeName: string;
  collaboratorId?: string;
  collaboratorName?: string;
  collaboratorRole?: string;
  /** CPF do colaborador (usado na busca por CPF e no modal). */
  collaboratorCpf?: string;
  collaboratorEmail?: string;
  managerName?: string;
  managerEmail?: string;
  unit?: string;
  currentExpiresAt: string;
  status: RenewalStatus;
  createdAt: string;
  createdBy: string;

  /** Prazo (SLA) definido por tipo de documento, em dias. */
  slaDays: number;
  /** Data-limite para concluir a renovação (ISO). */
  dueAt: string;

  /** Responsável atual pela tratativa. Obrigatório em toda solicitação. */
  ownerName?: string;
  ownerEmail?: string;
  ownerAt?: string;
  /** Quem delegou a tratativa (segue acompanhando o andamento). */
  delegatedFromName?: string;
  delegatedAt?: string;

  /** Dados do agendamento/tratativa. */
  clinicName: string;
  clinicContact: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  examsRequired: boolean;
  exams: RenewalExam[];
  notes: string;
  scheduleSavedAt?: string;

  /** Comunicação por e-mail ao colaborador e ao gestor. */
  notifiedAt?: string;
  emailStatus: RenewalEmailStatus;
  emailFeedback: string;

  /** Documentos e exames recebidos (todos vinculados ao documento principal). */
  attachments: RenewalAttachment[];
  receivedAt?: string;

  completedAt?: string;
  newExpiresAt?: string;
  updatedDocumentName?: string;

  tasks: RenewalTask[];
  log: RenewalLogEntry[];
  /** Avisos de prazo enviados por e-mail (rastreáveis no modal). */
  deadlineNotices?: RenewalDeadlineNotice[];
}

export interface RenewalRequestContext {
  createdBy: string;
  /** Pessoa que assume a tratativa. Quando ausente, usa quem abriu. */
  ownerName?: string;
  ownerEmail?: string;
  unit?: string;
  collaboratorCpf?: string;
  collaboratorEmail?: string;
  managerName?: string;
  managerEmail?: string;
}

export interface RenewalSyncInfo {
  loaded: boolean;
  loading: boolean;
  pending: number;
  error: string | null;
}

interface RenewalStoreState {
  companyRef: string;
  requests: RenewalRequest[];
  loaded: boolean;
  loading: boolean;
  pending: number;
  error: string | null;
}

const STORAGE_PREFIX = "sstek:renewal-requests:";
const TABLE = "document_renewal_requests";

/** Prazo padrão de conclusão de uma renovação, em dias. */
export const DEFAULT_RENEWAL_SLA_DAYS = 30;

let state: RenewalStoreState = {
  companyRef: "vega",
  requests: [],
  loaded: false,
  loading: false,
  pending: 0,
  error: null,
};
let syncInfo: RenewalSyncInfo = { loaded: false, loading: false, pending: 0, error: null };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function refreshSync(): void {
  syncInfo = {
    loaded: state.loaded,
    loading: state.loading,
    pending: state.pending,
    error: state.error,
  };
}

function setState(patch: Partial<RenewalStoreState>): void {
  state = { ...state, ...patch };
  refreshSync();
  emit();
}

function storageKey(ref: string): string {
  return `${STORAGE_PREFIX}${ref || "vega"}`;
}

function readStored(ref: string): RenewalRequest[] {
  try {
    const raw = localStorage.getItem(storageKey(ref));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RenewalRequest[];
    if (!Array.isArray(parsed)) return [];
    const requests = parsed
      .filter((item) => item && typeof item.id === "string")
      .map(normalizeRequest);
    // O cache offline também recebe número, para a fila nunca aparecer sem ele.
    return ensureRenewalCodes(requests).requests;
  } catch {
    return [];
  }
}

function persistLocal(): void {
  try {
    localStorage.setItem(storageKey(state.companyRef), JSON.stringify(state.requests));
  } catch {
    /* cache offline opcional */
  }
}

/**
 * Troca a empresa da sessão e limpa a fila em memória. A recarga vem do banco
 * (RLS já isola por empresa). Roda durante a renderização, então o carregamento
 * é agendado fora do ciclo para não emitir evento no meio do render.
 */
export function setRenewalCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (state.companyRef === next) return;
  state = {
    companyRef: next,
    requests: readStored(next),
    loaded: false,
    loading: false,
    pending: 0,
    error: null,
  };
  refreshSync();
  window.setTimeout(() => void loadRequests(), 0);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadRequests();
  return () => {
    listeners.delete(listener);
  };
}

export function getRenewalRequests(): RenewalRequest[] {
  return state.requests;
}

/** Hook das solicitações da empresa da sessão. */
export function useRenewalRequests(): RenewalRequest[] {
  const { subdomain } = useAppSession();
  setRenewalCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getRenewalRequests, getRenewalRequests);
}

/** Estado de sincronização (carregando / salvando / erro). */
export function useRenewalSync(): RenewalSyncInfo {
  return useSyncExternalStore(subscribe, () => syncInfo, () => syncInfo);
}

/* ------------------------------ utilidades ------------------------------ */

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `rn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(baseIso: string, days: number): string {
  const date = new Date(baseIso);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Math.max(1, Math.round(days)));
  return date.toISOString();
}

/** Prefixo do número público das solicitações (RS = renovação de solicitação). */
const CODE_PREFIX = "RS";

function formatRenewalCode(year: number, sequence: number): string {
  return `${CODE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Próximo número livre da série anual (RS-AAAA-0001, 0002...).
 * O número é público: a equipe usa no atendimento e na busca da fila.
 */
export function nextRenewalCode(): string {
  const year = new Date().getFullYear();
  let highest = 0;
  state.requests.forEach((request) => {
    const match = (request.code || "").match(/^RS-(\d{4})-(\d+)$/);
    if (!match) return;
    if (Number(match[1]) !== year) return;
    highest = Math.max(highest, Number(match[2]));
  });
  return formatRenewalCode(year, highest + 1);
}

/**
 * Numera solicitações antigas (criadas antes do número existir), em ordem de
 * abertura, sem repetir séries já usadas.
 */
function ensureRenewalCodes(requests: RenewalRequest[]): {
  requests: RenewalRequest[];
  numbered: RenewalRequest[];
} {
  const used = new Set(requests.map((request) => request.code).filter(Boolean));
  const highestByYear = new Map<number, number>();
  requests.forEach((request) => {
    const match = (request.code || "").match(/^RS-(\d{4})-(\d+)$/);
    if (!match) return;
    const year = Number(match[1]);
    highestByYear.set(year, Math.max(highestByYear.get(year) || 0, Number(match[2])));
  });

  const pending = requests
    .filter((request) => !request.code)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (pending.length === 0) return { requests, numbered: [] };

  const assigned = new Map<string, string>();
  pending.forEach((request) => {
    const parsed = new Date(request.createdAt);
    const year = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
    let sequence = (highestByYear.get(year) || 0) + 1;
    let code = formatRenewalCode(year, sequence);
    while (used.has(code)) {
      sequence += 1;
      code = formatRenewalCode(year, sequence);
    }
    highestByYear.set(year, sequence);
    used.add(code);
    assigned.set(request.id, code);
  });

  const next = requests.map((request) =>
    assigned.has(request.id) ? { ...request, code: assigned.get(request.id) || "" } : request
  );
  return { requests: next, numbered: next.filter((request) => assigned.has(request.id)) };
}

/**
 * Converte "24/10/2026" (formato usado nas validades) em timestamp do início
 * do dia. Retorna null quando não há data válida (ex.: documento permanente).
 */
export function parseBrDate(value?: string): number | null {
  if (!value) return null;
  const br = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso.getTime();
}

/** Data de vencimento do documento vinculado à solicitação (timestamp). */
export function renewalExpiryTs(request: RenewalRequest): number | null {
  return parseBrDate(request.currentExpiresAt);
}

/** "24/10/2026 às 14:32" — usado nas conclusões que ficam travadas. */
export function formatStamp(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()} às ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

/** "24/10/2026" — usado para prazos e datas de validade. */
export function formatDay(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function toBrDate(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function toDateInputValue(value: string): string {
  if (!value) return "";
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return value;
}

/* ------------------------------ SLA / prazo ----------------------------- */

/** Prazo (dias) parametrizado para o tipo de documento. */
export function getRenewalSlaDays(documentTypeId: string): number {
  const map = getSettings().documentRenewalSlaDays || {};
  const value = Number(map[documentTypeId]);
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  return DEFAULT_RENEWAL_SLA_DAYS;
}

export interface RenewalSlaInfo {
  days: number;
  dueAt: string;
  /** Dias restantes (negativo = atrasada). */
  remainingDays: number;
  late: boolean;
  dueToday: boolean;
}

export function renewalSlaInfo(request: RenewalRequest, now = new Date()): RenewalSlaInfo | null {
  if (!request.dueAt) return null;
  const due = new Date(request.dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const remainingDays = Math.round((startOfDue - startOfToday) / 86400000);
  return {
    days: request.slaDays,
    dueAt: request.dueAt,
    remainingDays,
    late: remainingDays < 0,
    dueToday: remainingDays === 0,
  };
}

/** Dias de antecedência parametrizados para o aviso de prazo próximo. 0 = desligado. */
export function getRenewalSlaWarningDays(): number {
  const value = Number(getSettings().documentRenewalSlaWarningDays);
  if (!Number.isFinite(value) || value < 0) return 3;
  return Math.min(60, Math.round(value));
}

/**
 * Janela de aviso do GESTOR (dias antes do vencimento).
 * É independente da janela do responsável da tratativa. 0 = desligado.
 */
export function getRenewalManagerWarningDays(): number {
  const value = Number(getSettings().documentRenewalManagerWarningDays);
  if (!Number.isFinite(value) || value < 0) return 7;
  return Math.min(60, Math.round(value));
}

/**
 * Escalonamento: dias, após um aviso de prazo sem movimentação, para reavisar
 * o gestor. 0 = desligado.
 */
export function getRenewalEscalationDays(): number {
  const value = Number(getSettings().documentRenewalEscalationDays);
  if (!Number.isFinite(value) || value < 0) return 5;
  return Math.min(60, Math.round(value));
}

export interface RenewalDueSoonInfo {
  /** Dias restantes até a data-limite (0 = vence hoje). */
  remainingDays: number;
  /** Janela de antecedência parametrizada. */
  warningDays: number;
  /** true quando está dentro da janela de aviso e ainda não estourou. */
  dueSoon: boolean;
}
/**
 * Tratativa com prazo próximo do vencimento (ainda dentro do SLA).
 * Serve para avisar a equipe ANTES de o prazo estourar.
 */
export function renewalDueSoonInfo(
  request: RenewalRequest,
  warningDays = getRenewalSlaWarningDays(),
  now = new Date()
): RenewalDueSoonInfo | null {
  if (request.status === "concluida") return null;
  const window = Math.max(0, Math.round(warningDays));
  if (window === 0) return null;
  const sla = renewalSlaInfo(request, now);
  if (!sla || sla.late) return null;
  return {
    remainingDays: sla.remainingDays,
    warningDays: window,
    dueSoon: sla.remainingDays <= window,
  };
}

/** Dias corridos entre a abertura e a conclusão (usado no relatório). */
export function renewalDurationDays(request: RenewalRequest): number | null {
  if (!request.completedAt) return null;
  const start = new Date(request.createdAt).getTime();
  const end = new Date(request.completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 86400000;
}

/**
 * Momento da última movimentação da tratativa.
 *
 * Considera tudo que move a solicitação: abertura, assunção/delegação,
 * agendamento, comunicação por e-mail, anexos recebidos, tarefas concluídas e
 * o histórico. Serve para detectar tratativa parada.
 */
export function renewalLastActivity(request: RenewalRequest): string {
  const stamps: string[] = [
    request.createdAt,
    request.ownerAt || "",
    request.delegatedAt || "",
    request.scheduleSavedAt || "",
    request.notifiedAt || "",
    request.receivedAt || "",
    request.completedAt || "",
    ...request.log.map((entry) => (entry.system ? "" : entry.at)),
    ...request.tasks.map((task) => task.doneAt || ""),
  ].filter(Boolean);

  let latest = "";
  let latestTime = -Infinity;
  stamps.forEach((stamp) => {
    const time = new Date(stamp).getTime();
    if (!Number.isNaN(time) && time > latestTime) {
      latestTime = time;
      latest = stamp;
    }
  });
  return latest;
}

export interface RenewalIdleInfo {
  lastAt: string;
  /** Dias corridos sem movimentação. */
  idleDays: number;
  /** Limite parametrizado (dias). */
  limitDays: number;
  /** true quando já passou do limite configurado. */
  idle: boolean;
}

/** Detecta tratativa sem movimentação há X dias (solicitações concluídas ficam de fora). */
export function renewalIdleInfo(
  request: RenewalRequest,
  limitDays: number,
  now = new Date()
): RenewalIdleInfo | null {
  if (request.status === "concluida") return null;
  const lastAt = renewalLastActivity(request);
  if (!lastAt) return null;
  const last = new Date(lastAt);
  if (Number.isNaN(last.getTime())) return null;
  const idleDays = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 86400000));
  const limit = Math.max(1, Math.round(limitDays));
  return { lastAt, idleDays, limitDays: limit, idle: idleDays >= limit };
}

/** Compara nomes de pessoas ignorando caixa, acentos e espaços extras. */
export function samePerson(a?: string | null, b?: string | null): boolean {
  const normalize = (value?: string | null) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(left) && left === right;
}

/** Tratativas em que a pessoa é o responsável atual. */
export function isOwnedBy(request: RenewalRequest, personName?: string | null): boolean {
  return samePerson(request.ownerName, personName);
}

/**
 * Tratativas que foram delegadas PARA a pessoa.
 *
 * A delegação troca o responsável e guarda quem delegou. Então a solicitação
 * é "delegada a mim" quando eu sou o responsável atual e ela veio de uma
 * delegação feita por outra pessoa.
 */
export function isDelegatedTo(request: RenewalRequest, personName?: string | null): boolean {
  if (!request.delegatedFromName) return false;
  if (!isOwnedBy(request, personName)) return false;
  return !samePerson(request.delegatedFromName, personName);
}

/** Concluída dentro do prazo? */
export function renewalOnTime(request: RenewalRequest): boolean | null {
  if (!request.completedAt) return null;
  const end = new Date(request.completedAt).getTime();
  const due = new Date(request.dueAt || "").getTime();
  if (Number.isNaN(end) || Number.isNaN(due)) return null;
  return end <= due;
}

/* --------------------------- modelos de tarefa -------------------------- */

const HEALTH_TYPES = new Set(["aso", "atestado-medico"]);
const TRAINING_TYPES = new Set(["certificado-treinamento", "ordem-servico"]);

function taskTemplate(typeId: string): string[] {
  if (HEALTH_TYPES.has(typeId)) {
    return [
      "Contatar a clínica e agendar a consulta",
      "Confirmar o agendamento com o colaborador",
      "Registrar exames complementares e orientações",
      "Comunicar colaborador e gestor por e-mail",
      "Receber e anexar todos os exames ao ASO",
      "Anexar o novo documento e concluir a renovação",
    ];
  }
  if (TRAINING_TYPES.has(typeId)) {
    return [
      "Programar nova turma ou reciclagem",
      "Informar o colaborador e o gestor",
      "Realizar o treinamento",
      "Anexar o novo certificado e concluir a renovação",
    ];
  }
  if (typeId === "ficha-epi") {
    return [
      "Conferir a necessidade de reposição de EPI",
      "Realizar a nova entrega e colher assinatura",
      "Anexar a nova ficha e concluir a renovação",
    ];
  }
  return [
    "Solicitar o novo documento ao responsável/fornecedor",
    "Conferir o documento recebido",
    "Anexar o documento novo e concluir a renovação",
  ];
}

function buildTasks(typeId: string): RenewalTask[] {
  return taskTemplate(typeId).map((label) => ({
    id: uid(),
    label,
    done: false,
  }));
}

/* ----------------------------- status meta ------------------------------ */

export const renewalStatusMeta: Record<
  RenewalStatus,
  { label: string; icon: string; chip: string; dot: string }
> = {
  aberta: {
    label: "Aberta",
    icon: "ri-inbox-unarchive-line",
    chip: "bg-danger-100 text-danger-800 ring-1 ring-danger-200",
    dot: "bg-danger-500",
  },
  "em-tratativa": {
    label: "Em tratativa",
    icon: "ri-user-follow-line",
    chip: "bg-secondary-100 text-secondary-900",
    dot: "bg-secondary-500",
  },
  "aguardando-exames": {
    label: "Aguardando exames",
    icon: "ri-flask-line",
    chip: "bg-accent-100 text-accent-900",
    dot: "bg-accent-500",
  },
  "documento-recebido": {
    label: "Documento recebido",
    icon: "ri-file-check-line",
    chip: "bg-primary-100 text-primary-800",
    dot: "bg-primary-500",
  },
  concluida: {
    label: "Concluída",
    icon: "ri-checkbox-circle-line",
    chip: "bg-primary-100 text-primary-800",
    dot: "bg-primary-600",
  },
};

export function openTasks(request: RenewalRequest): RenewalTask[] {
  return request.tasks.filter((task) => !task.done);
}

export function renewalProgress(request: RenewalRequest): number {
  if (request.tasks.length === 0) return 0;
  return Math.round((request.tasks.filter((task) => task.done).length / request.tasks.length) * 100);
}

/* ------------------------------- consultas ------------------------------ */

export function getRenewalForDocument(documentId: string): RenewalRequest | null {
  return (
    state.requests.find(
      (request) => request.documentId === documentId && request.status !== "concluida"
    ) || null
  );
}

export function getRequestById(id: string): RenewalRequest | null {
  return state.requests.find((request) => request.id === id) || null;
}

/* ------------------------------ persistência ---------------------------- */

/** Normaliza o payload lido do banco (registros antigos podem não ter SLA). */
function normalizeRequest(raw: Partial<RenewalRequest> | null | undefined): RenewalRequest {
  const base = (raw ?? {}) as RenewalRequest;
  const slaDays =
    Number.isFinite(Number(base.slaDays)) && Number(base.slaDays) > 0
      ? Math.round(Number(base.slaDays))
      : DEFAULT_RENEWAL_SLA_DAYS;
  const createdAt = base.createdAt || nowIso();
  return {
    ...base,
    id: base.id || uid(),
    code: base.code || "",
    companyRef: base.companyRef || state.companyRef,
    createdAt,
    createdBy: base.createdBy || "Sistema",
    status: base.status || "aberta",
    slaDays,
    dueAt: base.dueAt || addDaysIso(createdAt, slaDays),
    tasks: Array.isArray(base.tasks) ? base.tasks : [],
    exams: Array.isArray(base.exams) ? base.exams : [],
    attachments: Array.isArray(base.attachments) ? base.attachments : [],
    log: Array.isArray(base.log) ? base.log : [],
    deadlineNotices: Array.isArray(base.deadlineNotices) ? base.deadlineNotices : [],
    emailStatus: base.emailStatus || "",
    emailFeedback: base.emailFeedback || "",
    clinicName: base.clinicName || "",
    clinicContact: base.clinicContact || "",
    appointmentDate: base.appointmentDate || "",
    appointmentTime: base.appointmentTime || "",
    appointmentLocation: base.appointmentLocation || "",
    examsRequired: Boolean(base.examsRequired),
    notes: base.notes || "",
  };
}

function toRow(request: RenewalRequest): Record<string, unknown> {
  return {
    id: request.id,
    company_ref: request.companyRef || state.companyRef,
    document_ref: request.documentId,
    document_name: request.documentName,
    document_type_id: request.documentTypeId,
    document_type_name: request.documentTypeName,
    collaborator_name: request.collaboratorName ?? null,
    unit: request.unit ?? null,
    status: request.status,
    owner_name: request.ownerName ?? null,
    delegated_from_name: request.delegatedFromName ?? null,
    sla_days: request.slaDays,
    due_at: request.dueAt || null,
    created_at: request.createdAt,
    completed_at: request.completedAt ?? null,
    payload: request,
    updated_at: nowIso(),
  };
}

async function persistRequest(request: RenewalRequest): Promise<void> {
  setState({ pending: state.pending + 1 });
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(toRow(request), { onConflict: "id" });
    if (error) throw error;
    setState({ pending: Math.max(0, state.pending - 1), error: null });
  } catch {
    setState({
      pending: Math.max(0, state.pending - 1),
      error: "Não foi possível salvar a solicitação no banco. Os dados ficaram salvos neste dispositivo.",
    });
  }
}

async function loadRequests(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("payload")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as { payload: RenewalRequest | null }[];
    let requests = rows
      .map((row) => row.payload)
      .filter((payload): payload is RenewalRequest => Boolean(payload))
      .map(normalizeRequest);

    // Numera solicitações antigas (abertas antes do número existir) em ordem
    // cronológica e grava de volta, para o número nunca mudar depois.
    const numbered = ensureRenewalCodes(requests);
    requests = numbered.requests;

    // Primeira sincronização: sobe o que existia apenas no navegador.
    if (requests.length === 0) {
      const legacy = readStored(state.companyRef);
      if (legacy.length > 0) {
        requests = legacy;
        requests.forEach((request) => void persistRequest(request));
      }
    }

    setState({ requests, loaded: true, loading: false, error: null });
    persistLocal();
    numbered.numbered.forEach((request) => void persistRequest(request));
  } catch {
    setState({
      requests: readStored(state.companyRef),
      loaded: true,
      loading: false,
      error: "Não foi possível carregar as solicitações do banco. Exibindo os dados deste dispositivo.",
    });
  }
}

export function reloadRenewalRequests(): Promise<void> {
  state = { ...state, loaded: false };
  return loadRequests();
}

/** Grava a solicitação em memória e persiste no banco. */
function saveRequest(next: RenewalRequest): void {
  const exists = state.requests.some((request) => request.id === next.id);
  setState({
    requests: exists
      ? state.requests.map((request) => (request.id === next.id ? next : request))
      : [next, ...state.requests],
  });
  persistLocal();
  void persistRequest(next);
}

function patchRequest(id: string, patch: Partial<RenewalRequest>, log?: RenewalLogEntry): void {
  const request = getRequestById(id);
  if (!request) return;
  saveRequest({
    ...request,
    ...patch,
    log: log ? [...request.log, log] : request.log,
  });
}

/* -------------------------------- ações -------------------------------- */

function logEntry(label: string, by?: string): RenewalLogEntry {
  return { at: nowIso(), label, by };
}

/**
 * Abre (ou reaproveita) a solicitação de renovação de um documento.
 * Documentos de segurança nunca renovam por edição de data: sempre por aqui.
 * Toda solicitação nasce com responsável e prazo definidos.
 */
export function createRenewalRequest(
  doc: DocumentRecord,
  context: RenewalRequestContext
): RenewalRequest {
  const existing = getRenewalForDocument(doc.id);
  if (existing) return existing;

  const createdAt = nowIso();
  const slaDays = getRenewalSlaDays(doc.typeId);
  const ownerName = (context.ownerName || context.createdBy || "").trim() || "SESMT";
  const code = nextRenewalCode();

  const request: RenewalRequest = {
    id: uid(),
    code,
    companyRef: state.companyRef,
    documentId: doc.id,
    documentName: doc.name,
    documentTypeId: doc.typeId,
    documentTypeName: doc.typeName,
    collaboratorId: doc.collaboratorId,
    collaboratorName: doc.collaboratorName,
    collaboratorRole: doc.collaboratorRole,
    collaboratorCpf: context.collaboratorCpf,
    collaboratorEmail: context.collaboratorEmail,
    managerName: context.managerName,
    managerEmail: context.managerEmail,
    unit: context.unit || doc.establishment,
    currentExpiresAt: doc.expiresAt,
    status: "em-tratativa",
    createdAt,
    createdBy: context.createdBy || "Sistema",
    slaDays,
    dueAt: addDaysIso(createdAt, slaDays),
    ownerName,
    ownerEmail: context.ownerEmail,
    ownerAt: createdAt,
    clinicName: "",
    clinicContact: "",
    appointmentDate: "",
    appointmentTime: "",
    appointmentLocation: "",
    examsRequired: HEALTH_TYPES.has(doc.typeId),
    exams: [],
    notes: "",
    emailStatus: "",
    emailFeedback: "",
    attachments: [],
    tasks: buildTasks(doc.typeId),
    log: [
      logEntry(
        `Solicitação ${code} aberta com prazo de ${slaDays} dia(s)`,
        context.createdBy
      ),
      logEntry(`Responsável definido: ${ownerName}`, context.createdBy),
    ],
  };

  saveRequest(request);
  return request;
}

/**
 * Garante uma solicitação aberta para cada documento vencido. É idempotente:
 * documentos que já têm solicitação em andamento ou concluída são ignorados.
 */
export function ensureRenewalRequestsForExpired(
  docs: DocumentRecord[],
  resolveContext: (doc: DocumentRecord) => RenewalRequestContext
): void {
  if (!state.loaded) return;
  // Peças de processo eleitoral (edital de convocação da CIPA) não entram na
  // fila de renovação: o pleito tem prazo próprio e a próxima edição é um novo
  // edital, em um novo processo eleitoral.
  const expired = docs.filter((doc) => doc.status === "Vencido" && canRequestRenewal(doc));
  if (expired.length === 0) return;

  expired.forEach((doc) => {
    // Só considera solicitações em andamento: um ciclo futuro (novo vencimento
    // depois de uma renovação concluída) deve abrir uma nova tratativa.
    const already = state.requests.some(
      (request) => request.documentId === doc.id && request.status !== "concluida"
    );
    if (already) return;
    const context = resolveContext(doc);
    createRenewalRequest(doc, { ...context, unit: context.unit || doc.establishment });
  });
}

/** Assume a solicitação (usado em registros antigos sem responsável). */
export function assumeRenewalRequest(id: string, by: string, email?: string): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  if (request.ownerName) return;
  patchRequest(
    id,
    {
      ownerName: by,
      ownerEmail: email || request.ownerEmail,
      ownerAt: nowIso(),
      status: "em-tratativa",
    },
    logEntry(`Tratativa assumida por ${by}`, by)
  );
}

/**
 * Define/troca o responsável pela tratativa. Serve tanto para atribuir logo na
 * abertura quanto para repassar a condução — o responsável anterior passa a
 * constar como quem delegou e continua acompanhando o andamento.
 */
export function delegateRenewalRequest(
  id: string,
  payload: { toName: string; toEmail?: string; note?: string },
  by: string
): { ok: boolean; reason?: string } {
  const request = getRequestById(id);
  if (!request) return { ok: false, reason: "Solicitação não encontrada." };
  if (request.status === "concluida") {
    return { ok: false, reason: "Solicitação concluída não pode ser delegada." };
  }
  const toName = payload.toName.trim();
  if (!toName) return { ok: false, reason: "Informe para quem a tratativa será delegada." };

  const previousOwner = request.ownerName;
  const note = payload.note?.trim();
  saveRequest({
    ...request,
    ownerName: toName,
    ownerEmail: payload.toEmail?.trim() || undefined,
    ownerAt: nowIso(),
    delegatedFromName: previousOwner || request.delegatedFromName,
    delegatedAt: nowIso(),
    status: request.status === "aberta" ? "em-tratativa" : request.status,
    log: [
      ...request.log,
      logEntry(
        previousOwner
          ? `${by} delegou a tratativa de ${previousOwner} para ${toName}${note ? ` · ${note}` : ""}`
          : `${by} definiu ${toName} como responsável${note ? ` · ${note}` : ""}`,
        by
      ),
    ],
  });
  return { ok: true };
}

export function saveRenewalSchedule(
  id: string,
  patch: {
    clinicName: string;
    clinicContact: string;
    appointmentDate: string;
    appointmentTime: string;
    appointmentLocation: string;
    examsRequired: boolean;
    exams: RenewalExam[];
    notes: string;
  },
  by: string
): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  patchRequest(
    id,
    { ...patch, scheduleSavedAt: nowIso() },
    logEntry("Agendamento e orientações atualizados", by)
  );
}

/** Completa e-mails/gestor que faltavam quando a solicitação foi aberta. */
export function enrichRenewalContacts(
  id: string,
  patch: { collaboratorCpf?: string; collaboratorEmail?: string; managerName?: string; managerEmail?: string }
): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  const next = {
    collaboratorCpf: request.collaboratorCpf || patch.collaboratorCpf,
    collaboratorEmail: request.collaboratorEmail || patch.collaboratorEmail,
    managerName: request.managerName || patch.managerName,
    managerEmail: request.managerEmail || patch.managerEmail,
  };
  if (
    next.collaboratorCpf === request.collaboratorCpf &&
    next.collaboratorEmail === request.collaboratorEmail &&
    next.managerName === request.managerName &&
    next.managerEmail === request.managerEmail
  ) {
    return;
  }
  patchRequest(id, next);
}

/** Registra o envio do agendamento por e-mail (colaborador + gestor). */export interface RenewalNoticeInput {
  requestId: string;
  audience: RenewalNoticeAudience;
  recipient: string;
  recipientName?: string;
  dueAt?: string;
  remainingDays?: number;
  sentAt?: string;
}

/** Rótulo curto do público do aviso (usado no modal e no histórico). */
export const renewalNoticeAudienceMeta: Record<
  RenewalNoticeAudience,
  { label: string; icon: string; chip: string }
> = {
  gestor: {
    label: "Gestor",
    icon: "ri-user-star-line",
    chip: "bg-secondary-100 text-secondary-900",
  },
  responsavel: {
    label: "Responsável da tratativa",
    icon: "ri-user-follow-line",
    chip: "bg-accent-100 text-accent-900",
  },
  escalonamento: {
    label: "Escalonamento ao gestor",
    icon: "ri-alarm-warning-line",
    chip: "bg-danger-100 text-danger-800",
  },
};

/**
 * Registra no histórico de cada tratativa os avisos de prazo enviados por
 * e-mail: destinatário, público e data. Também entra no histórico cronológico,
 * para ficar rastreável no modal.
 */
export function registerRenewalDeadlineNotices(
  inputs: RenewalNoticeInput[],
  sentBy = "Sistema"
): void {
  if (!Array.isArray(inputs) || inputs.length === 0) return;

  const byRequest = new Map<string, RenewalNoticeInput[]>();
  inputs.forEach((input) => {
    if (!input?.requestId || !input.recipient) return;
    const list = byRequest.get(input.requestId);
    if (list) list.push(input);
    else byRequest.set(input.requestId, [input]);
  });

  byRequest.forEach((entries, requestId) => {
    const request = getRequestById(requestId);
    if (!request) return;

    const existing = request.deadlineNotices ?? [];
    const additions: RenewalDeadlineNotice[] = [];
    const logs: RenewalLogEntry[] = [];

    entries.forEach((entry) => {
      const sentAt = entry.sentAt || nowIso();
      const recipient = String(entry.recipient).trim().toLowerCase();
      const duplicated = [...existing, ...additions].some(
        (notice) =>
          notice.audience === entry.audience &&
          notice.recipient.toLowerCase() === recipient &&
          notice.sentAt === sentAt
      );
      if (duplicated) return;

      const audienceLabel = renewalNoticeAudienceMeta[entry.audience]?.label ?? entry.audience;
      additions.push({
        id: uid(),
        audience: entry.audience,
        recipient,
        recipientName: entry.recipientName,
        dueAt: entry.dueAt || request.dueAt,
        remainingDays: Number.isFinite(Number(entry.remainingDays))
          ? Math.round(Number(entry.remainingDays))
          : 0,
        sentAt,
        sentBy,
      });
      logs.push({
        at: sentAt,
        system: true,
        label:
          entry.audience === "escalonamento"
            ? `Escalonamento enviado ao gestor por falta de movimentação · ${recipient}`
            : `Aviso de prazo enviado · ${audienceLabel} · ${recipient}`,
        by: sentBy,
      });
    });

    if (additions.length === 0) return;

    // Avisos de prazo NÃO contam como movimentação da tratativa: eles entram no
    // histórico, mas não renovam o relógio de "tratativa parada"/escalonamento.
    saveRequest({
      ...request,
      deadlineNotices: [...existing, ...additions],
      log: [...request.log, ...logs],
    });
  });
}

export function markRenewalNotified(
  id: string,
  payload: { emailStatus: RenewalEmailStatus; feedback: string; by: string; manual?: boolean }
): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  const advanced = payload.emailStatus === "sent" || Boolean(payload.manual);
  const alreadyReceived = request.status === "documento-recebido";
  patchRequest(
    id,
    {
      emailStatus: payload.emailStatus,
      emailFeedback: payload.feedback,
      notifiedAt: advanced ? nowIso() : request.notifiedAt,
      status: advanced && !alreadyReceived ? "aguardando-exames" : request.status,
    },
    advanced
      ? logEntry(
          payload.manual
            ? "Comunicação ao colaborador e ao gestor registrada manualmente"
            : "Agendamento comunicado ao colaborador e ao gestor por e-mail",
          payload.by
        )
      : undefined
  );
}

/** Conclui uma tarefa. Ação definitiva: não há como desmarcar. */
export function completeRenewalTask(id: string, taskId: string, by: string): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  const task = request.tasks.find((item) => item.id === taskId);
  if (!task || task.done) return;
  patchRequest(
    id,
    {
      tasks: request.tasks.map((item) =>
        item.id === taskId ? { ...item, done: true, doneAt: nowIso(), doneBy: by } : item
      ),
    },
    logEntry(`Tarefa concluída: ${task.label}`, by)
  );
}

export function addRenewalTask(id: string, label: string, by: string): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  const clean = label.trim();
  if (!clean) return;
  patchRequest(
    id,
    { tasks: [...request.tasks, { id: uid(), label: clean, done: false }] },
    logEntry(`Tarefa adicionada: ${clean}`, by)
  );
}

/** Anexa documentos/exames recebidos. Todos ficam vinculados ao documento. */
export function addRenewalAttachments(
  id: string,
  files: { name: string; size: string }[],
  by: string
): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida" || files.length === 0) return;
  const additions: RenewalAttachment[] = files.map((file) => ({
    id: uid(),
    name: file.name,
    size: file.size,
    at: nowIso(),
  }));
  patchRequest(
    id,
    {
      attachments: [...request.attachments, ...additions],
      receivedAt: nowIso(),
      status: request.status === "documento-recebido" ? request.status : "documento-recebido",
    },
    logEntry(
      `${additions.length} arquivo(s) anexado(s) ao documento: ${additions
        .map((file) => file.name)
        .join(", ")}`,
      by
    )
  );
}

/** Remove um anexo recebido por engano (antes da conclusão). */
export function removeRenewalAttachment(id: string, attachmentId: string, by: string): void {
  const request = getRequestById(id);
  if (!request || request.status === "concluida") return;
  const target = request.attachments.find((file) => file.id === attachmentId);
  if (!target) return;
  const remaining = request.attachments.filter((file) => file.id !== attachmentId);
  patchRequest(
    id,
    {
      attachments: remaining,
      status: remaining.length === 0 ? "aguardando-exames" : request.status,
    },
    logEntry(`Anexo removido: ${target.name}`, by)
  );
}

/**
 * Conclui a renovação: exige todas as tarefas concluídas, ao menos um arquivo
 * recebido e a nova validade. Atualiza o documento real e trava a solicitação.
 */
export function concludeRenewal(
  id: string,
  payload: { newExpiresAt: string; updatedDocumentName: string; by: string }
): { ok: boolean; reason?: string } {
  const request = getRequestById(id);
  if (!request) return { ok: false, reason: "Solicitação não encontrada." };
  if (request.status === "concluida") return { ok: false, reason: "Solicitação já concluída." };
  if (!request.ownerName) {
    return { ok: false, reason: "Defina um responsável antes de concluir a renovação." };
  }
  if (openTasks(request).length > 0) {
    return { ok: false, reason: "Ainda há tarefas abertas nesta solicitação." };
  }
  if (request.attachments.length === 0) {
    return { ok: false, reason: "Anexe o novo documento (e os exames) antes de concluir." };
  }
  if (!payload.newExpiresAt) {
    return { ok: false, reason: "Informe a nova validade do documento." };
  }

  updateDocumentValidity(request.documentId, payload.newExpiresAt);
  patchRequest(
    id,
    {
      status: "concluida",
      completedAt: nowIso(),
      newExpiresAt: payload.newExpiresAt,
      updatedDocumentName: payload.updatedDocumentName || request.documentName,
    },
    logEntry(
      `Renovação concluída · novo documento: ${payload.updatedDocumentName || request.documentName} · validade ${payload.newExpiresAt}`,
      payload.by
    )
  );
  return { ok: true };
}

/**
 * Encerra a solicitação de renovação de um documento quando ele é substituído
 * pelo envio de um documento novo. Evita uma tratativa órfã na fila, já que a
 * troca foi registrada diretamente no acervo.
 */
export function concludeRenewalByReplacement(
  documentId: string,
  replacementName: string,
  by: string
): void {
  const request = getRenewalForDocument(documentId);
  if (!request) return;
  patchRequest(
    request.id,
    {
      status: "concluida",
      completedAt: nowIso(),
      updatedDocumentName: replacementName,
    },
    logEntry(`Renovação concluída por substituição · novo documento: ${replacementName}`, by)
  );
}