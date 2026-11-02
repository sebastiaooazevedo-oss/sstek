import { collaborators } from "@/mocks/collaborators";
import type {
  ActionPriority,
  ActionStatus,
  Cipa,
  CipaAta,
  CipaAtaSignature,
  CipaElection,
  CipaMemberRole,
  CipaStatus,
  ElectionCandidate,
  ElectionStatus,
  MeetingStatus,
} from "@/mocks/cipa";

/** Converte uma data "dd/mm/aaaa" em timestamp para ordenação. */
export function brDateToTime(value: string): number {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 0;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Compara duas datas no formato "dd/mm/aaaa"; positivo se a > b. */
export function compareBrDates(a: string, b: string): number {
  return brDateToTime(a) - brDateToTime(b);
}

/** Converte datas em "dd/mm/aaaa" ou "aaaa-mm-dd" em timestamp (0 se inválida). */
export function parseFlexibleDate(value: string): number {
  if (!value) return 0;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  return 0;
}

/** Converte uma data "dd/mm/aaaa" ou "aaaa-mm-dd" para o formato ISO (aaaa-mm-dd). */
export function toIsoDate(value: string): string {
  if (!value) return "";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

export interface ElectionWindowIso {
  /** Início do período de votação em ISO local (aaaa-mm-ddThh:mm:ss). */
  startAt: string | null;
  /** Fim do período de votação em ISO local (aaaa-mm-ddThh:mm:ss). */
  endAt: string | null;
}

/**
 * Combina a data da votação com os horários de início e fim informados,
 * produzindo a janela de votação em ISO (usada pela urna e pelos e-mails).
 */
export function electionWindowIso(election: {
  voteDate: string;
  voteStartTime?: string;
  voteEndTime?: string;
}): ElectionWindowIso {
  const day = toIsoDate(election.voteDate);
  if (!day) return { startAt: null, endAt: null };
  return {
    startAt: election.voteStartTime ? `${day}T${election.voteStartTime}:00` : null,
    endAt: election.voteEndTime ? `${day}T${election.voteEndTime}:59` : null,
  };
}

/** Descreve, para exibição, a janela de votação de uma eleição. */
export function electionWindowLabel(election: {
  voteDate: string;
  voteStartTime?: string;
  voteEndTime?: string;
}): string {
  const date = toDisplayDate(election.voteDate);
  if (!election.voteStartTime && !election.voteEndTime) return date;
  return `${date} · ${election.voteStartTime || "00:00"} às ${election.voteEndTime || "23:59"}`;
}

/** Exibe uma data sempre como "dd/mm/aaaa", aceitando os dois formatos. */
export function toDisplayDate(value: string): string {
  if (!value) return "—";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${day}/${month}/${year}`;
  }
  return value;
}

export type CandidacyPhase = "nao-iniciada" | "aberta" | "encerrada";

export interface CandidacyState {
  phase: CandidacyPhase;
  /** Dias restantes até o fim das inscrições (negativo quando já passou). */
  daysLeft: number;
  /** Data de abertura das inscrições (dd/mm/aaaa). */
  start: string;
  /** Data limite das inscrições (dd/mm/aaaa). */
  end: string;
}

/** Situação do prazo de candidatura de um processo eleitoral. */
export function candidacyState(election: { registrationStart: string; registrationEnd: string }): CandidacyState {
  const start = parseFlexibleDate(election.registrationStart);
  const end = parseFlexibleDate(election.registrationEnd);
  const today = todayTime();
  const daysLeft = end ? Math.round((end - today) / 86400000) : 0;
  let phase: CandidacyPhase = "aberta";
  if (start && today < start) phase = "nao-iniciada";
  else if (end && today > end) phase = "encerrada";
  return {
    phase,
    daysLeft,
    start: toDisplayDate(election.registrationStart),
    end: toDisplayDate(election.registrationEnd),
  };
}

const memberRoleTone: Record<CipaMemberRole, string> = {
  Presidente: "bg-primary-100 text-primary-700",
  "Vice-Presidente": "bg-secondary-100 text-secondary-800",
  Secretário: "bg-accent-100 text-accent-800",
  Titular: "bg-background-200 text-foreground-700",
  Suplente: "bg-background-100 text-foreground-600",
};

export function memberRoleClass(role: CipaMemberRole): string {
  return memberRoleTone[role] || "bg-background-200 text-foreground-700";
}

const cipaStatusTone: Record<CipaStatus, string> = {
  Ativa: "bg-primary-100 text-primary-700",
  "Em eleição": "bg-accent-100 text-accent-800",
  Encerrada: "bg-background-200 text-foreground-600",
};

export function cipaStatusClass(status: CipaStatus): string {
  return cipaStatusTone[status] || "bg-background-200 text-foreground-700";
}

const meetingStatusTone: Record<MeetingStatus, string> = {
  Agendada: "bg-secondary-100 text-secondary-800",
  Realizada: "bg-primary-100 text-primary-700",
  Cancelada: "bg-accent-100 text-accent-800",
};

export function meetingStatusClass(status: MeetingStatus): string {
  return meetingStatusTone[status] || "bg-background-200 text-foreground-700";
}

const actionStatusTone: Record<ActionStatus, string> = {
  Pendente: "bg-secondary-100 text-secondary-800",
  "Em andamento": "bg-accent-100 text-accent-800",
  Concluída: "bg-primary-100 text-primary-700",
  Atrasada: "bg-accent-200 text-accent-900",
};

export function actionStatusClass(status: ActionStatus): string {
  return actionStatusTone[status] || "bg-background-200 text-foreground-700";
}

const priorityTone: Record<ActionPriority, string> = {
  Baixa: "bg-background-200 text-foreground-700",
  Média: "bg-secondary-100 text-secondary-800",
  Alta: "bg-accent-100 text-accent-800",
  Crítica: "bg-accent-200 text-accent-900",
};

export function priorityClass(priority: ActionPriority): string {
  return priorityTone[priority] || "bg-background-200 text-foreground-700";
}

const electionStatusTone: Record<ElectionStatus, string> = {
  Inscrições: "bg-secondary-100 text-secondary-800",
  "Em votação": "bg-accent-100 text-accent-800",
  Apurada: "bg-primary-100 text-primary-700",
  Publicada: "bg-primary-100 text-primary-700",
};

export function electionStatusClass(status: ElectionStatus): string {
  return electionStatusTone[status] || "bg-background-200 text-foreground-700";
}

/** Ordena compromissos pela data (mais próximos primeiro). */
export function sortByDateAsc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => brDateToTime(a.date) - brDateToTime(b.date));
}

/** Timestamp de hoje (meia-noite), para comparar prazos. */
export function todayTime(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Dias entre hoje e uma data "dd/mm/aaaa" (negativo quando já passou). */
export function daysUntilBrDate(value: string): number {
  const target = brDateToTime(value);
  if (!target) return 0;
  return Math.round((target - todayTime()) / 86400000);
}

/** Gera um identificador de assinatura (UUID) para o ato de aprovação. */
export function generateSignatureUid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** Localiza o colaborador da base pelo nome (para a assinatura pessoal). */
export function collaboratorIdByName(name: string): string | null {
  const target = name.trim().toLowerCase();
  const found = collaborators.find((c) => c.name.trim().toLowerCase() === target);
  return found ? found.id : null;
}

export interface AtaApprover {
  role: CipaAtaSignature["role"];
  name: string;
  collaboratorId: string | null;
}

/**
 * Presidente e secretário da comissão, responsáveis por aprovar a ata, mais o
 * Responsável Técnico de Segurança do Trabalho (quando designado no cadastro
 * do colaborador ou na parametrização da empresa).
 */
export function ataApprovers(cipa?: Cipa, technicalResponsible?: AtaApprover | null): AtaApprover[] {
  const approvers: AtaApprover[] = [];
  if (cipa) {
    const roles: CipaAtaSignature["role"][] = ["Presidente", "Secretário"];
    roles.forEach((role) => {
      const member = cipa.members.find((m) => m.memberRole === role);
      if (!member) return;
      approvers.push({
        role,
        name: member.name,
        collaboratorId: collaboratorIdByName(member.name),
      });
    });
  }
  if (technicalResponsible && technicalResponsible.name.trim()) {
    approvers.push({
      role: "Responsável Técnico",
      name: technicalResponsible.name.trim(),
      collaboratorId: technicalResponsible.collaboratorId,
    });
  }
  return approvers;
}

/**
 * Devolve a ata já com todos os signatários obrigatórios (presidente,
 * secretário e responsável técnico), incluindo os que ainda não assinaram.
 * É usado na tela para evidenciar quem está pendente — a gravação acontece
 * quando a aprovação é coletada.
 */
export function ensureRequiredApprovers(
  ata: CipaAta,
  cipa?: Cipa,
  technicalResponsible?: AtaApprover | null
): CipaAta {
  const required = ataApprovers(cipa, technicalResponsible);
  const missing = required.filter((r) => !ata.approvals.some((a) => a.role === r.role));
  if (missing.length === 0) return ata;
  return {
    ...ata,
    approvals: [
      ...ata.approvals,
      ...missing.map((r) => ({
        id: generateId("ataappr"),
        role: r.role,
        name: r.name,
        collaboratorId: r.collaboratorId,
        signedAt: null,
        signatureUid: null,
        representationSnapshot: null,
      })),
    ],
  };
}

export function isAtaSignatureCollected(signature: CipaAtaSignature): boolean {
  return Boolean(signature.representationSnapshot || signature.signedAt);
}

export type ElectionSeat = "titular" | "suplente" | "nao-eleito";

export interface RankedCandidate {
  candidate: ElectionCandidate;
  /** Posição no ranking de votação (1 = mais votado). */
  position: number;
  /** Vaga obtida conforme o número de vagas configurado no painel. */
  seat: ElectionSeat;
}

/**
 * Classifica os candidatos de um processo eleitoral em eleitos (titulares),
 * suplentes e não eleitos, conforme o número de vagas informado no painel.
 * Quando nenhuma vaga é configurada, todos os candidatos com votos são
 * tratados como eleitos titulares (comportamento anterior preservado).
 */
export function rankCandidates(election: CipaElection): RankedCandidate[] {
  const titularSeats = Math.max(0, Number(election.titularVacancies) || 0);
  const suplenteSeats = Math.max(0, Number(election.suplenteVacancies) || 0);
  const configured = titularSeats > 0 || suplenteSeats > 0;
  const ranked = election.candidates
    .filter((c) => c.name.trim())
    .sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
  return ranked.map((candidate, index) => {
    const votes = Number(candidate.votes) || 0;
    let seat: ElectionSeat = "nao-eleito";
    if (votes > 0) {
      if (!configured || index < titularSeats) seat = "titular";
      else if (index < titularSeats + suplenteSeats) seat = "suplente";
    }
    return { candidate, position: index + 1, seat };
  });
}

/** Rótulo legível da situação de um candidato na apuração. */
export function electionSeatLabel(seat: ElectionSeat): string {
  if (seat === "titular") return "Eleito(a) — Titular";
  if (seat === "suplente") return "Eleito(a) — Suplente";
  return "Não eleito(a)";
}

export interface NrsDimensioning {
  /** Nº de representantes efetivos (titulares) por parte. */
  titulares: number;
  /** Nº de suplentes por parte. */
  suplentes: number;
  /** Se o Quadro I exige a constituição de CIPA para o porte informado. */
  required: boolean;
  /** Grau de risco interpretado (ex.: "Grau de risco 3"). */
  group: string;
  /** Faixa de empregados aplicada (ex.: "141 a 300 empregados"). */
  rangeLabel: string;
}

/** Interpreta o grau de risco (1 a 4) a partir de um texto como "Grau 3". */
export function parseRiskGrade(riskGrade: string): 1 | 2 | 3 | 4 {
  const match = riskGrade.match(/(\d)/);
  const grade = match ? Number(match[1]) : 0;
  if (grade >= 1 && grade <= 4) return grade as 1 | 2 | 3 | 4;
  return 3;
}

interface NrsRow {
  min: number;
  max: number;
  label: string;
  seats: Record<1 | 2 | 3 | 4, [number, number] | null>;
}

/**
 * Quadro I da NR-5: nº de efetivos (titulares) e suplentes por parte, cruzando
 * a faixa de empregados do estabelecimento com o grau de risco da atividade.
 * Faixas com "null" indicam dispensa de CIPA (trabalhador designado).
 */
const NRS_TABLE: NrsRow[] = [
  { min: 0, max: 19, label: "0 a 19 empregados", seats: { 1: null, 2: null, 3: null, 4: null } },
  { min: 20, max: 29, label: "20 a 29 empregados", seats: { 1: null, 2: null, 3: [1, 1], 4: [1, 1] } },
  { min: 30, max: 50, label: "30 a 50 empregados", seats: { 1: null, 2: [1, 1], 3: [1, 1], 4: [2, 1] } },
  { min: 51, max: 80, label: "51 a 80 empregados", seats: { 1: null, 2: [2, 1], 3: [2, 2], 4: [3, 2] } },
  { min: 81, max: 100, label: "81 a 100 empregados", seats: { 1: [2, 1], 2: [2, 2], 3: [3, 2], 4: [4, 3] } },
  { min: 101, max: 125, label: "101 a 125 empregados", seats: { 1: [3, 2], 2: [3, 2], 3: [4, 3], 4: [5, 4] } },
  { min: 126, max: 140, label: "126 a 140 empregados", seats: { 1: [3, 2], 2: [4, 3], 3: [5, 4], 4: [6, 5] } },
  { min: 141, max: 300, label: "141 a 300 empregados", seats: { 1: [4, 3], 2: [5, 4], 3: [6, 5], 4: [7, 5] } },
  { min: 301, max: 500, label: "301 a 500 empregados", seats: { 1: [5, 4], 2: [6, 5], 3: [7, 5], 4: [8, 6] } },
  { min: 501, max: 1000, label: "501 a 1.000 empregados", seats: { 1: [6, 5], 2: [7, 5], 3: [8, 6], 4: [9, 7] } },
  { min: 1001, max: Number.POSITIVE_INFINITY, label: "acima de 1.000 empregados", seats: { 1: [9, 7], 2: [10, 8], 3: [11, 8], 4: [12, 9] } },
];

/**
 * Calcula o dimensionamento sugerido da CIPA pelo Quadro I da NR-5 a partir
 * do nº de empregados do estabelecimento e do grau de risco da atividade.
 * Usado para pré-sugerir as vagas de titulares/suplentes no formulário da
 * eleição (as vagas dos representantes dos empregados correspondem aos
 * efetivos/suplentes de cada parte).
 */
export function nrsDimensioning(employeesCount: number, riskGrade: string): NrsDimensioning {
  const grade = parseRiskGrade(riskGrade);
  const count = Math.max(0, Math.floor(employeesCount || 0));
  const row = NRS_TABLE.find((r) => count >= r.min && count <= r.max) || NRS_TABLE[NRS_TABLE.length - 1];
  const seats = row.seats[grade];
  return {
    titulares: seats ? seats[0] : 0,
    suplentes: seats ? seats[1] : 0,
    required: seats !== null,
    group: `Grau de risco ${grade}`,
    rangeLabel: row.label,
  };
}

/**
 * Localiza a ata da comissão eleitoral de um processo. Prefere a ata cujo
 * título/conteúdo menciona a eleição; na ausência, usa a ata mais recente da
 * CIPA — assim o dossiê sempre consegue reunir a ata relacionada.
 */
export function electionCommitteeAta(election: CipaElection, atas: CipaAta[]): CipaAta | undefined {
  const pool = atas.filter((a) => a.cipaId === election.cipaId);
  if (!pool.length) return undefined;
  const flagged = pool.find((a) => /elei[çc]|eleitoral|posse/i.test(`${a.title} ${a.content}`));
  if (flagged) return flagged;
  return [...pool].sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date))[0];
}

/** Quantidade de assinaturas já coletadas na ata. */
export function ataSignedCount(ata: CipaAta): number {
  return ata.approvals.filter(isAtaSignatureCollected).length;
}

/**
 * Uma ata é considerada aprovada por completo quando todos os aprovadores
 * registrados (presidente e secretário, conforme a composição da comissão)
 * já coletaram a assinatura pessoal.
 */
export function isAtaFullyApproved(ata: CipaAta): boolean {
  if (!ata.approvals.length) return false;
  return ata.approvals.every(isAtaSignatureCollected);
}

/** Situação textual da ata para exibição na lista e nos filtros. */
export function ataApprovalStatus(ata: CipaAta): "aprovada" | "aguardando" {
  return isAtaFullyApproved(ata) ? "aprovada" : "aguardando";
}