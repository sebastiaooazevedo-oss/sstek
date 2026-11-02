import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import {
  initialActions,
  initialAtas,
  initialCipas,
  initialMeetings,
  type Cipa,
  type CipaAction,
  type CipaAta,
  type CipaMember,
  type CipaMeeting,
  type CipaPhoto,
} from "@/mocks/cipa";

/**
 * Store persistente do núcleo da CIPA no Supabase.
 *
 * Antes as comissões, a agenda de reuniões, as atas e o plano de ações viviam
 * apenas em memória durante a sessão; agora ficam salvos de verdade (tabelas
 * `cipa_committees`, `cipa_meetings`, `cipa_minutes` e `cipa_actions`) e um
 * registro criado em qualquer tela sobrevive a recarregar a página.
 *
 * A API pública é a mesma de antes (`useCipas`, `addCipa`, `updateCipa`,
 * `useMeetings`, `useAtas`, `useActions`, ...) para não impactar os
 * consumidores (página, visão geral, alertas, topbar e Documentos). As
 * gravações atualizam o estado na hora (otimista) e persistem em segundo plano.
 * A empresa é resolvida pela sessão da aplicação.
 */

interface CipaCoreState {
  cipas: Cipa[];
  meetings: CipaMeeting[];
  atas: CipaAta[];
  actions: CipaAction[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: CipaCoreState = {
  cipas: [],
  meetings: [],
  atas: [],
  actions: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

let seeding = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<CipaCoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setCipaCoreCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, cipas: [], meetings: [], atas: [], actions: [] };
  void loadCipaCore();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapCommittee(r: Record<string, unknown>): Cipa {
  return {
    id: String(r.ref),
    name: (r.name as string) ?? "",
    unit: (r.unit as string) ?? "",
    city: (r.city as string) ?? "",
    cnpj: (r.cnpj as string) ?? "",
    riskGrade: (r.risk_grade as string) ?? "",
    employeesCount: Number(r.employees_count) || 0,
    mandateNumber: (r.mandate_number as string) ?? "",
    mandateStart: (r.mandate_start as string) ?? "",
    mandateEnd: (r.mandate_end as string) ?? "",
    status: (r.status as Cipa["status"]) ?? "Ativa",
    members: (r.members as CipaMember[]) ?? [],
  };
}

function toCommitteeRow(c: Cipa, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: c.id,
    name: c.name,
    unit: c.unit || null,
    city: c.city || null,
    cnpj: c.cnpj || null,
    risk_grade: c.riskGrade || null,
    employees_count: c.employeesCount || 0,
    mandate_number: c.mandateNumber || null,
    mandate_start: c.mandateStart || null,
    mandate_end: c.mandateEnd || null,
    status: c.status,
    members: c.members,
    updated_at: new Date().toISOString(),
  };
}

function mapMeeting(r: Record<string, unknown>): CipaMeeting {
  return {
    id: String(r.ref),
    cipaId: (r.cipa_ref as string) ?? "",
    title: (r.title as string) ?? "",
    type: (r.meeting_type as CipaMeeting["type"]) ?? "Ordinária",
    date: (r.meeting_date as string) ?? "",
    time: (r.meeting_time as string) ?? "",
    location: (r.location as string) ?? "",
    agenda: (r.agenda as string[]) ?? [],
    notes: (r.notes as string) ?? "",
    status: (r.status as CipaMeeting["status"]) ?? "Agendada",
  };
}

function toMeetingRow(m: CipaMeeting, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: m.id,
    cipa_ref: m.cipaId || null,
    title: m.title,
    meeting_type: m.type,
    meeting_date: m.date || null,
    meeting_time: m.time || null,
    location: m.location || null,
    agenda: m.agenda,
    notes: m.notes || null,
    status: m.status,
    updated_at: new Date().toISOString(),
  };
}

function mapAta(r: Record<string, unknown>): CipaAta {
  return {
    id: String(r.ref),
    cipaId: (r.cipa_ref as string) ?? "",
    meetingId: (r.meeting_ref as string) ?? "",
    number: (r.number as string) ?? "",
    date: (r.minute_date as string) ?? "",
    title: (r.title as string) ?? "",
    content: (r.content as string) ?? "",
    decisions: (r.decisions as string[]) ?? [],
    participants: (r.participants as string[]) ?? [],
    photos: (r.photos as CipaPhoto[]) ?? [],
    approvals: (r.approvals as CipaAta["approvals"]) ?? [],
  };
}

function toAtaRow(a: CipaAta, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: a.id,
    cipa_ref: a.cipaId || null,
    meeting_ref: a.meetingId || null,
    number: a.number || null,
    minute_date: a.date || null,
    title: a.title,
    content: a.content,
    decisions: a.decisions,
    participants: a.participants,
    photos: a.photos,
    approvals: a.approvals,
    updated_at: new Date().toISOString(),
  };
}

function mapAction(r: Record<string, unknown>): CipaAction {
  return {
    id: String(r.ref),
    cipaId: (r.cipa_ref as string) ?? "",
    title: (r.title as string) ?? "",
    description: (r.description as string) ?? "",
    origin: (r.origin as string) ?? "",
    responsible: (r.responsible as string) ?? "",
    dueDate: (r.due_date as string) ?? "",
    priority: (r.priority as CipaAction["priority"]) ?? "Média",
    status: (r.status as CipaAction["status"]) ?? "Pendente",
  };
}

function toActionRow(a: CipaAction, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: a.id,
    cipa_ref: a.cipaId || null,
    title: a.title,
    description: a.description || null,
    origin: a.origin || null,
    responsible: a.responsible || null,
    due_date: a.dueDate || null,
    priority: a.priority,
    status: a.status,
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------ Empresa ----------------------------- */

async function resolveCompanyId(ref: string): Promise<string> {
  if (!ref) throw new Error("company not resolved");
  const { data, error } = await supabase.from("companies").select("id").eq("subdomain", ref).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("company not resolved");
  return String(data.id);
}

async function ensureCompanyId(): Promise<string> {
  if (state.companyId) return state.companyId;
  const companyId = await resolveCompanyId(companyRef);
  setState({ companyId });
  return companyId;
}

/* ------------------------------- Load ------------------------------- */

async function seedIfEmpty(companyId: string): Promise<void> {
  if (seeding) return;
  seeding = true;
  try {
    await supabase.from("cipa_committees").upsert(
      initialCipas.map((c) => toCommitteeRow(c, companyId)),
      { onConflict: "company_ref,ref" }
    );
    await supabase.from("cipa_meetings").upsert(
      initialMeetings.map((m) => toMeetingRow(m, companyId)),
      { onConflict: "company_ref,ref" }
    );
    await supabase.from("cipa_minutes").upsert(
      initialAtas.map((a) => toAtaRow(a, companyId)),
      { onConflict: "company_ref,ref" }
    );
    await supabase.from("cipa_actions").upsert(
      initialActions.map((a) => toActionRow(a, companyId)),
      { onConflict: "company_ref,ref" }
    );
  } finally {
    seeding = false;
  }
}

async function fetchAll() {
  return Promise.all([
    supabase.from("cipa_committees").select("*").eq("company_ref", companyRef).order("created_at", { ascending: true }),
    supabase.from("cipa_meetings").select("*").eq("company_ref", companyRef).order("created_at", { ascending: false }),
    supabase.from("cipa_minutes").select("*").eq("company_ref", companyRef).order("created_at", { ascending: false }),
    supabase.from("cipa_actions").select("*").eq("company_ref", companyRef).order("created_at", { ascending: false }),
  ]);
}

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    let [committees, meetings, minutes, actions] = await fetchAll();
    if (committees.error || meetings.error || minutes.error || actions.error) throw new Error("load failed");
    if ((committees.data ?? []).length === 0) {
      await seedIfEmpty(companyId);
      [committees, meetings, minutes, actions] = await fetchAll();
      if (committees.error || meetings.error || minutes.error || actions.error) throw new Error("seed failed");
    }
    setState({
      cipas: (committees.data ?? []).map((r) => mapCommittee(r as Record<string, unknown>)),
      meetings: (meetings.data ?? []).map((r) => mapMeeting(r as Record<string, unknown>)),
      atas: (minutes.data ?? []).map((r) => mapAta(r as Record<string, unknown>)),
      actions: (actions.data ?? []).map((r) => mapAction(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar os dados da CIPA." });
  }
}

export async function loadCipaCore(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadCipaCore(): Promise<void> {
  return loadCipaCore();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadCipaCore();
  return () => {
    listeners.delete(listener);
  };
}

export function getCipaCoreState(): CipaCoreState {
  return state;
}

/* ------------------------------- Getters ---------------------------- */

export function getCipas(): Cipa[] {
  return state.cipas;
}
export function getMeetings(): CipaMeeting[] {
  return state.meetings;
}
export function getAtas(): CipaAta[] {
  return state.atas;
}
export function getActions(): CipaAction[] {
  return state.actions;
}

/* -------------------------------- Hooks ----------------------------- */

export function useCipas(): Cipa[] {
  const { subdomain } = useAppSession();
  setCipaCoreCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getCipas, getCipas);
}

export function useMeetings(): CipaMeeting[] {
  const { subdomain } = useAppSession();
  setCipaCoreCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getMeetings, getMeetings);
}

export function useAtas(): CipaAta[] {
  const { subdomain } = useAppSession();
  setCipaCoreCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getAtas, getAtas);
}

export function useActions(): CipaAction[] {
  const { subdomain } = useAppSession();
  setCipaCoreCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getActions, getActions);
}

/* ------------------------------ Escritas ---------------------------- */

async function upsert(table: string, row: Record<string, unknown>): Promise<void> {
  try {
    const companyId = await ensureCompanyId();
    const payload = { ...row, company_id: companyId };
    const { error } = await supabase.from(table).upsert(payload, { onConflict: "company_ref,ref" });
    if (error) throw error;
    await refresh();
  } catch {
    setState({ error: "Não foi possível salvar as alterações da CIPA." });
  }
}

/* CIPAs */

export function addCipa(cipa: Cipa): void {
  setState({ cipas: [cipa, ...state.cipas.filter((c) => c.id !== cipa.id)] });
  void upsert("cipa_committees", toCommitteeRow(cipa, state.companyId || ""));
}

export function updateCipa(cipa: Cipa): void {
  setState({ cipas: state.cipas.map((c) => (c.id === cipa.id ? cipa : c)) });
  void upsert("cipa_committees", toCommitteeRow(cipa, state.companyId || ""));
}

/* Reuniões */

export function addMeeting(meeting: CipaMeeting): void {
  setState({ meetings: [meeting, ...state.meetings.filter((m) => m.id !== meeting.id)] });
  void upsert("cipa_meetings", toMeetingRow(meeting, state.companyId || ""));
}

export function updateMeeting(meeting: CipaMeeting): void {
  setState({ meetings: state.meetings.map((m) => (m.id === meeting.id ? meeting : m)) });
  void upsert("cipa_meetings", toMeetingRow(meeting, state.companyId || ""));
}

/* Atas */

export function addAta(ata: CipaAta): void {
  setState({ atas: [ata, ...state.atas.filter((a) => a.id !== ata.id)] });
  void upsert("cipa_minutes", toAtaRow(ata, state.companyId || ""));
}

export function updateAta(ata: CipaAta): void {
  setState({ atas: state.atas.map((a) => (a.id === ata.id ? ata : a)) });
  void upsert("cipa_minutes", toAtaRow(ata, state.companyId || ""));
}

/* Ações */

export function addAction(action: CipaAction): void {
  setState({ actions: [action, ...state.actions.filter((a) => a.id !== action.id)] });
  void upsert("cipa_actions", toActionRow(action, state.companyId || ""));
}

export function updateAction(action: CipaAction): void {
  setState({ actions: state.actions.map((a) => (a.id === action.id ? action : a)) });
  void upsert("cipa_actions", toActionRow(action, state.companyId || ""));
}

/* -------------------------------- Remover --------------------------- */

async function removeRow(table: string, id: string): Promise<void> {
  try {
    await ensureCompanyId();
    const { error } = await supabase.from(table).delete().eq("company_ref", companyRef).eq("ref", id);
    if (error) throw error;
    await refresh();
  } catch {
    setState({ error: "Não foi possível remover o registro da CIPA." });
  }
}

export function removeCipa(id: string): void {
  setState({ cipas: state.cipas.filter((c) => c.id !== id) });
  void removeRow("cipa_committees", id);
}

export function removeMeeting(id: string): void {
  setState({ meetings: state.meetings.filter((m) => m.id !== id) });
  void removeRow("cipa_meetings", id);
}

export function removeAta(id: string): void {
  setState({ atas: state.atas.filter((a) => a.id !== id) });
  void removeRow("cipa_minutes", id);
}

export function removeAction(id: string): void {
  setState({ actions: state.actions.filter((a) => a.id !== id) });
  void removeRow("cipa_actions", id);
}