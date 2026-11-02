import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { AprRecord, AprRisk, AprSignature } from "@/mocks/apr";
import { addDocument, buildAprDocument } from "@/pages/app/modules/documentos/documentsStore";

/**
 * Store das Análises Preliminares de Risco (APR) persistido no Supabase
 * (tabela `apr_records`).
 *
 * Centraliza os registros (análises, riscos e aceites por assinatura) para que
 * o dashboard do Administrador, o portal do Colaborador, os alertas e a página
 * do módulo enxerguem sempre os mesmos dados. A empresa é resolvida pela sessão
 * da aplicação. Quando uma APR é concluída, o registro dela é gerado
 * automaticamente em Documentos.
 */

interface AprStoreState {
  records: AprRecord[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: AprStoreState = {
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

function setState(patch: Partial<AprStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setAprCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null };
  void loadAprs();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): AprRecord {
  return {
    id: String(r.ref),
    title: (r.title as string) ?? "",
    requestNumber: (r.request_number as string) ?? "",
    createdByRef: (r.created_by_ref as string) ?? undefined,
    createdByName: (r.created_by_name as string) ?? undefined,
    origin: (r.origin as AprRecord["origin"]) ?? "admin",
    activity: (r.activity as string) ?? "",
    area: (r.area as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    location: (r.location as string) ?? "",
    date: (r.apr_date as string) ?? "",
    responsible: (r.responsible as string) ?? "",
    risks: (r.risks as AprRisk[]) ?? [],
    signatures: (r.signatures as AprSignature[]) ?? [],
    notes: (r.notes as string) ?? "",
    status: (r.status as AprRecord["status"]) ?? "Pendente",
  };
}

function toRow(record: AprRecord, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: record.id,
    title: record.title,
    request_number: record.requestNumber || null,
    created_by_ref: record.createdByRef ?? null,
    created_by_name: record.createdByName ?? null,
    origin: record.origin ?? "admin",
    activity: record.activity,
    area: record.area,
    establishment: record.establishment || null,
    location: record.location,
    apr_date: record.date,
    responsible: record.responsible,
    risks: record.risks,
    signatures: record.signatures,
    notes: record.notes || null,
    status: record.status,
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

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    const { data, error } = await supabase
      .from("apr_records")
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
    setState({ loaded: true, loading: false, error: "Não foi possível carregar as APRs." });
  }
}

export async function loadAprs(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadAprs(): Promise<void> {
  return loadAprs();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadAprs();
  return () => {
    listeners.delete(listener);
  };
}

export function getAprStoreState(): AprStoreState {
  return state;
}

export function getAprs(): AprRecord[] {
  return state.records;
}

export function subscribeAprs(listener: () => void): () => void {
  return subscribe(listener);
}

/** Hook das APRs (resolvendo a empresa pela sessão). */
export function useAprs(): AprRecord[] {
  const { subdomain } = useAppSession();
  setAprCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getAprs, getAprs);
}

/* -------------------------------- CRUD ------------------------------ */

function isFullySigned(record: AprRecord): boolean {
  return record.signatures.length > 0 && record.signatures.every((s) => s.signature);
}

export async function addApr(record: AprRecord): Promise<void> {
  const concluded: AprRecord = { ...record, status: isFullySigned(record) ? "Concluída" : record.status };
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("apr_records")
      .upsert(toRow(concluded, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    // APR enviada pelo colaborador vive no painel da gestão; o registro em
    // Documentos é gerado pela gestão (evita escrita bloqueada pela RLS).
    if (concluded.status === "Concluída" && concluded.origin !== "colaborador") {
      addDocument(buildAprDocument(concluded));
    }
    await refresh();
  } catch {
    setState({ error: "Não foi possível registrar a APR." });
  }
}

/** Registra a assinatura de um executante e conclui a APR quando todos assinarem. */
export async function signApr(aprId: string, collaboratorId: string, signature: string): Promise<void> {
  const current = state.records.find((r) => r.id === aprId);
  if (!current) return;

  const signatures = current.signatures.map((s) =>
    s.collaboratorId === collaboratorId ? { ...s, signature } : s
  );
  const allSigned = signatures.length > 0 && signatures.every((s) => s.signature);
  const next: AprRecord = {
    ...current,
    signatures,
    status: allSigned ? "Concluída" : "Pendente",
  };

  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("apr_records")
      .upsert(toRow(next, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    if (allSigned && current.status !== "Concluída" && next.origin !== "colaborador") {
      addDocument(buildAprDocument(next));
    }
    await refresh();
  } catch {
    setState({ error: "Não foi possível registrar a assinatura da APR." });
  }
}

/** Remove uma APR (exclusão administrativa). */
export async function removeApr(aprId: string): Promise<boolean> {
  try {
    await ensureCompanyId();
    const { error } = await supabase.from("apr_records").delete().eq("company_ref", companyRef).eq("ref", aprId);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível excluir a APR." });
    return false;
  }
}