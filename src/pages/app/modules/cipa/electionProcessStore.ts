import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import {
  ELECTION_SCHEDULE_TEMPLATE,
  type ElectionProcessStatus,
} from "@/pages/app/modules/cipa/electionProcess";

/**
 * Store persistente do processo eleitoral da CIPA (governança) no Supabase.
 * Guarda, por empresa (company_ref) e por processo (election_ref): o registro do
 * processo (status/máquina de estados), o cronograma (prazos NR-5), a comissão
 * eleitoral, as comunicações (ex.: sindicato) e a trilha de auditoria.
 *
 * IMPORTANTE: esta camada trata APENAS da governança do processo. Ela NÃO
 * armazena voto, eleitor nem qualquer dado de urna (fases seguintes).
 */

export interface ElectionProcessRecord {
  id: string;
  electionRef: string;
  cipaRef: string | null;
  status: ElectionProcessStatus;
  responsible: string;
  responsibleRegistration: string;
  establishment: string;
  exercise: string;
  mandateStart: string;
  mandateEnd: string;
  employeesCount: number | null;
  riskGrade: string;
  titulares: number | null;
  suplentes: number | null;
  notes: string;
}

export interface ScheduleRecord {
  id: string;
  electionRef: string;
  itemKey: string;
  label: string;
  dueDate: string | null;
  baseDate: string | null;
  minDays: number | null;
  notApplicable: boolean;
  done: boolean;
  proofRef: string;
  notes: string;
  sortOrder: number;
}

export interface CommitteeMemberRecord {
  id: string;
  electionRef: string;
  name: string;
  cpf: string;
  matricula: string;
  roleFunction: string;
  constitutedAt: string | null;
  documentRef: string;
  signatureRef: string;
}

export interface CommunicationRecord {
  id: string;
  electionRef: string;
  kind: string;
  channel: string;
  sentAt: string | null;
  recipient: string;
  proofRef: string;
  protocolNumber: string;
  confirmed: boolean;
  notes: string;
}

export interface ElectionEventRecord {
  id: string;
  electionRef: string;
  action: string;
  actor: string;
  detail: string;
  createdAt: string;
}

interface StoreState {
  processes: ElectionProcessRecord[];
  schedule: ScheduleRecord[];
  committee: CommitteeMemberRecord[];
  communications: CommunicationRecord[];
  events: ElectionEventRecord[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

const defaultActor = "Administrador";

let companyRef = "vega";
let state: StoreState = {
  processes: [],
  schedule: [],
  committee: [],
  communications: [],
  events: [],
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setElectionCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false };
  void loadElectionProcess();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapProcess(r: Record<string, unknown>): ElectionProcessRecord {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    cipaRef: (r.cipa_ref as string) ?? null,
    status: (r.status as ElectionProcessStatus) ?? "planejamento",
    responsible: (r.responsible as string) ?? "",
    responsibleRegistration: (r.responsible_registration as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    exercise: (r.exercise as string) ?? "",
    mandateStart: (r.mandate_start as string) ?? "",
    mandateEnd: (r.mandate_end as string) ?? "",
    employeesCount: (r.employees_count as number) ?? null,
    riskGrade: (r.risk_grade as string) ?? "",
    titulares: (r.titulares as number) ?? null,
    suplentes: (r.suplentes as number) ?? null,
    notes: (r.notes as string) ?? "",
  };
}

function mapSchedule(r: Record<string, unknown>): ScheduleRecord {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    itemKey: String(r.item_key),
    label: String(r.label),
    dueDate: (r.due_date as string) ?? null,
    baseDate: (r.base_date as string) ?? null,
    minDays: (r.min_days as number) ?? null,
    notApplicable: Boolean(r.not_applicable),
    done: Boolean(r.done),
    proofRef: (r.proof_ref as string) ?? "",
    notes: (r.notes as string) ?? "",
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

function mapCommittee(r: Record<string, unknown>): CommitteeMemberRecord {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    name: String(r.name),
    cpf: (r.cpf as string) ?? "",
    matricula: (r.matricula as string) ?? "",
    roleFunction: (r.role_function as string) ?? "",
    constitutedAt: (r.constituted_at as string) ?? null,
    documentRef: (r.document_ref as string) ?? "",
    signatureRef: (r.signature_ref as string) ?? "",
  };
}

function mapCommunication(r: Record<string, unknown>): CommunicationRecord {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    kind: (r.kind as string) ?? "sindicato",
    channel: (r.channel as string) ?? "",
    sentAt: (r.sent_at as string) ?? null,
    recipient: (r.recipient as string) ?? "",
    proofRef: (r.proof_ref as string) ?? "",
    protocolNumber: (r.protocol_number as string) ?? "",
    confirmed: Boolean(r.confirmed),
    notes: (r.notes as string) ?? "",
  };
}

function mapEvent(r: Record<string, unknown>): ElectionEventRecord {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    action: (r.action as string) ?? "",
    actor: (r.actor as string) ?? "",
    detail: (r.detail as string) ?? "",
    createdAt: String(r.created_at),
  };
}

/* ------------------------------- Load ------------------------------- */

export async function loadElectionProcess(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  try {
    const [proc, sched, comm, comms, evts] = await Promise.all([
      supabase.from("cipa_elections").select("*").eq("company_ref", companyRef),
      supabase.from("cipa_election_schedule").select("*").eq("company_ref", companyRef).order("sort_order"),
      supabase.from("cipa_election_committee").select("*").eq("company_ref", companyRef).order("created_at"),
      supabase.from("cipa_election_communications").select("*").eq("company_ref", companyRef).order("created_at", { ascending: false }),
      supabase.from("cipa_election_events").select("*").eq("company_ref", companyRef).order("created_at", { ascending: false }).limit(500),
    ]);
    if (proc.error || sched.error || comm.error || comms.error || evts.error) throw new Error("load failed");
    setState({
      processes: (proc.data ?? []).map(mapProcess),
      schedule: (sched.data ?? []).map(mapSchedule),
      committee: (comm.data ?? []).map(mapCommittee),
      communications: (comms.data ?? []).map(mapCommunication),
      events: (evts.data ?? []).map(mapEvent),
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar o processo eleitoral." });
  }
}

export function reloadElectionProcess(): Promise<void> {
  setState({ loaded: false });
  return loadElectionProcess();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadElectionProcess();
  return () => {
    listeners.delete(listener);
  };
}

export function getElectionProcessState(): StoreState {
  return state;
}

/** Hook do processo eleitoral (já fixando a empresa da sessão). */
export function useElectionProcess(company: string): StoreState {
  setElectionCompanyRef(company);
  return useSyncExternalStore(subscribe, getElectionProcessState, getElectionProcessState);
}

/* ---------------------------- Auditoria ----------------------------- */

export async function logElectionEvent(
  electionRef: string,
  action: string,
  detail = "",
  payload?: Record<string, unknown>,
  actor = defaultActor
): Promise<void> {
  try {
    await supabase.from("cipa_election_events").insert({
      company_ref: companyRef,
      election_ref: electionRef,
      action,
      actor,
      detail,
      payload: payload ?? null,
    });
  } catch {
    /* auditoria é best-effort; não interrompe o fluxo */
  }
}

/* ---------------------------- Processo ------------------------------ */

export interface ProcessSeed {
  cipaRef?: string;
  establishment?: string;
  exercise?: string;
  mandateStart?: string;
  mandateEnd?: string;
  employeesCount?: number | null;
  riskGrade?: string;
  titulares?: number | null;
  suplentes?: number | null;
}

/**
 * Garante que exista o registro do processo e o cronograma (marcos NR-5)
 * para a eleição informada. Cria apenas o que faltar, preservando o que já
 * existe (não sobrescreve datas/situações já registradas).
 */
export async function ensureElectionProcess(electionRef: string, seed: ProcessSeed = {}): Promise<void> {
  if (!electionRef) return;
  const existing = state.processes.find((p) => p.electionRef === electionRef);
  if (!existing) {
    try {
      await supabase.from("cipa_elections").insert({
        company_ref: companyRef,
        election_ref: electionRef,
        cipa_ref: seed.cipaRef ?? null,
        status: "planejamento",
        establishment: seed.establishment ?? null,
        exercise: seed.exercise ?? null,
        mandate_start: seed.mandateStart ?? null,
        mandate_end: seed.mandateEnd ?? null,
        employees_count: seed.employeesCount ?? null,
        risk_grade: seed.riskGrade ?? null,
        titulares: seed.titulares ?? null,
        suplentes: seed.suplentes ?? null,
      });
      await logElectionEvent(electionRef, "processo_criado", "Processo eleitoral iniciado no planejamento.");
    } catch {
      /* ignore */
    }
  }

  const existingKeys = new Set(state.schedule.filter((s) => s.electionRef === electionRef).map((s) => s.itemKey));
  const missing = ELECTION_SCHEDULE_TEMPLATE.filter((t) => !existingKeys.has(t.itemKey));
  if (missing.length) {
    try {
      await supabase.from("cipa_election_schedule").insert(
        missing.map((t) => ({
          company_ref: companyRef,
          election_ref: electionRef,
          item_key: t.itemKey,
          label: t.label,
          sort_order: t.sortOrder,
        }))
      );
    } catch {
      /* ignore */
    }
  }
  await reloadElectionProcess();
}

export async function saveElectionProcess(electionRef: string, patch: Partial<ElectionProcessRecord>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.cipaRef !== undefined) payload.cipa_ref = patch.cipaRef;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.responsible !== undefined) payload.responsible = patch.responsible;
  if (patch.responsibleRegistration !== undefined) payload.responsible_registration = patch.responsibleRegistration;
  if (patch.establishment !== undefined) payload.establishment = patch.establishment;
  if (patch.exercise !== undefined) payload.exercise = patch.exercise;
  if (patch.mandateStart !== undefined) payload.mandate_start = patch.mandateStart;
  if (patch.mandateEnd !== undefined) payload.mandate_end = patch.mandateEnd;
  if (patch.employeesCount !== undefined) payload.employees_count = patch.employeesCount;
  if (patch.riskGrade !== undefined) payload.risk_grade = patch.riskGrade;
  if (patch.titulares !== undefined) payload.titulares = patch.titulares;
  if (patch.suplentes !== undefined) payload.suplentes = patch.suplentes;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  try {
    await supabase.from("cipa_elections").update(payload).eq("company_ref", companyRef).eq("election_ref", electionRef);
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

/** Avança a fase do processo, registrando o evento na auditoria. */
export async function setProcessStatus(
  electionRef: string,
  prev: ElectionProcessStatus,
  next: ElectionProcessStatus
): Promise<void> {
  await saveElectionProcess(electionRef, { status: next });
  await logElectionEvent(electionRef, "fase_alterada", `Fase alterada de "${prev}" para "${next}".`, { prev, next });
  await reloadElectionProcess();
}

/* ---------------------------- Cronograma ---------------------------- */

export async function saveScheduleItem(
  electionRef: string,
  itemKey: string,
  patch: Partial<ScheduleRecord>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate || null;
  if (patch.baseDate !== undefined) payload.base_date = patch.baseDate || null;
  if (patch.minDays !== undefined) payload.min_days = patch.minDays;
  if (patch.notApplicable !== undefined) payload.not_applicable = patch.notApplicable;
  if (patch.done !== undefined) payload.done = patch.done;
  if (patch.proofRef !== undefined) payload.proof_ref = patch.proofRef;
  if (patch.notes !== undefined) payload.notes = patch.notes;
  try {
    await supabase
      .from("cipa_election_schedule")
      .update(payload)
      .eq("company_ref", companyRef)
      .eq("election_ref", electionRef)
      .eq("item_key", itemKey);
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

/* --------------------------- Comissão ------------------------------- */

export async function addCommitteeMember(electionRef: string, member: Omit<CommitteeMemberRecord, "id" | "electionRef">): Promise<void> {
  try {
    await supabase.from("cipa_election_committee").insert({
      company_ref: companyRef,
      election_ref: electionRef,
      name: member.name,
      cpf: member.cpf || null,
      matricula: member.matricula || null,
      role_function: member.roleFunction || null,
      constituted_at: member.constitutedAt || null,
      document_ref: member.documentRef || null,
      signature_ref: member.signatureRef || null,
    });
    await logElectionEvent(electionRef, "comissao_membro_adicionado", `Integrante incluído: ${member.name}.`);
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

export async function updateCommitteeMember(id: string, electionRef: string, member: Omit<CommitteeMemberRecord, "id" | "electionRef">): Promise<void> {
  try {
    await supabase
      .from("cipa_election_committee")
      .update({
        name: member.name,
        cpf: member.cpf || null,
        matricula: member.matricula || null,
        role_function: member.roleFunction || null,
        constituted_at: member.constitutedAt || null,
        document_ref: member.documentRef || null,
        signature_ref: member.signatureRef || null,
      })
      .eq("id", id);
    await logElectionEvent(electionRef, "comissao_membro_alterado", `Integrante alterado: ${member.name}.`);
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

export async function removeCommitteeMember(id: string, electionRef: string, name: string): Promise<void> {
  try {
    await supabase.from("cipa_election_committee").delete().eq("id", id);
    await logElectionEvent(electionRef, "comissao_membro_removido", `Integrante removido: ${name}.`);
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

/* -------------------------- Comunicações ---------------------------- */

export async function addCommunication(electionRef: string, comm: Omit<CommunicationRecord, "id" | "electionRef">): Promise<void> {
  try {
    await supabase.from("cipa_election_communications").insert({
      company_ref: companyRef,
      election_ref: electionRef,
      kind: comm.kind,
      channel: comm.channel || null,
      sent_at: comm.sentAt || null,
      recipient: comm.recipient || null,
      proof_ref: comm.proofRef || null,
      protocol_number: comm.protocolNumber || null,
      confirmed: comm.confirmed,
      notes: comm.notes || null,
    });
    await logElectionEvent(electionRef, "comunicacao_registrada", `Comunicação (${comm.kind}) registrada.`);
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

export async function updateCommunication(id: string, electionRef: string, comm: Partial<CommunicationRecord>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (comm.kind !== undefined) payload.kind = comm.kind;
  if (comm.channel !== undefined) payload.channel = comm.channel;
  if (comm.sentAt !== undefined) payload.sent_at = comm.sentAt || null;
  if (comm.recipient !== undefined) payload.recipient = comm.recipient;
  if (comm.proofRef !== undefined) payload.proof_ref = comm.proofRef;
  if (comm.protocolNumber !== undefined) payload.protocol_number = comm.protocolNumber;
  if (comm.confirmed !== undefined) payload.confirmed = comm.confirmed;
  if (comm.notes !== undefined) payload.notes = comm.notes;
  try {
    await supabase.from("cipa_election_communications").update(payload).eq("id", id);
    await logElectionEvent(electionRef, "comunicacao_alterada", "Comunicação alterada.");
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}

export async function removeCommunication(id: string, electionRef: string): Promise<void> {
  try {
    await supabase.from("cipa_election_communications").delete().eq("id", id);
    await logElectionEvent(electionRef, "comunicacao_removida", "Comunicação removida.");
  } catch {
    /* ignore */
  }
  await reloadElectionProcess();
}