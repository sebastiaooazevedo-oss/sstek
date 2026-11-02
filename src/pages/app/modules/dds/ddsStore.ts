import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { DdsRecord } from "@/mocks/dds";

/**
 * Store dos Diálogos Diários de Segurança (DDS) persistido no Supabase
 * (tabela `dds_records`).
 *
 * Centraliza os registros para que a página do módulo e o painel do
 * Administrador enxerguem sempre os mesmos dados. A empresa é resolvida pela
 * sessão da aplicação.
 */

interface DdsStoreState {
  records: DdsRecord[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: DdsStoreState = {
  records: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<DdsStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setDdsCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null };
  void loadDds();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): DdsRecord {
  return {
    id: String(r.ref),
    title: (r.title as string) ?? "",
    date: (r.record_date as string) ?? "",
    time: (r.record_time as string) ?? "",
    theme: (r.theme as string) ?? "",
    trainingId: (r.training_id as string) ?? "",
    trainingName: (r.training_name as string) ?? "",
    facilitator: (r.facilitator as string) ?? "",
    area: (r.area as string) ?? "",
    location: (r.location as string) ?? "",
    duration: (r.duration as string) ?? "",
    participants: Number(r.participant_count) || 0,
    participantIds: (r.participant_ids as string[]) ?? [],
    participantNames: (r.participant_names as string[]) ?? [],
    topics: (r.topics as string[]) ?? [],
    notes: (r.notes as string) ?? "",
    status: (r.status as DdsRecord["status"]) ?? "Realizado",
    cover: (r.cover as string) ?? "",
    photos: (r.photos as string[]) ?? [],
    establishment: (r.establishment as string) || undefined,
  };
}

function toRow(record: DdsRecord, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: record.id,
    title: record.title,
    record_date: record.date || null,
    record_time: record.time || null,
    theme: record.theme || null,
    training_id: record.trainingId || null,
    training_name: record.trainingName || null,
    facilitator: record.facilitator || null,
    area: record.area || null,
    location: record.location || null,
    duration: record.duration || null,
    participant_count: record.participants,
    participant_ids: record.participantIds,
    participant_names: record.participantNames,
    topics: record.topics,
    notes: record.notes || null,
    status: record.status,
    cover: record.cover || null,
    photos: record.photos,
    establishment: record.establishment || null,
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

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    const { data, error } = await supabase
      .from("dds_records")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setState({
      records: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar os registros de DDS." });
  }
}

export async function loadDds(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadDds(): Promise<void> {
  return loadDds();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadDds();
  return () => {
    listeners.delete(listener);
  };
}

export function getDdsStoreState(): DdsStoreState {
  return state;
}

export function getDdsRecords(): DdsRecord[] {
  return state.records;
}

/** Hook dos registros de DDS (resolvendo a empresa pela sessão). */
export function useDds(): DdsRecord[] {
  const { subdomain } = useAppSession();
  setDdsCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getDdsRecords, getDdsRecords);
}

/* -------------------------------- CRUD ------------------------------ */

export async function addDds(record: DdsRecord): Promise<void> {
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("dds_records")
      .upsert(toRow(record, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    await refresh();
  } catch {
    setState({ error: "Não foi possível registrar o DDS." });
  }
}

/** Remove um registro de DDS (exclusão administrativa). */
export async function removeDds(recordId: string): Promise<boolean> {
  try {
    await ensureCompanyId();
    const { error } = await supabase.from("dds_records").delete().eq("company_ref", companyRef).eq("ref", recordId);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível excluir o DDS." });
    return false;
  }
}