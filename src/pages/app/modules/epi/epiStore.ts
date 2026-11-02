import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { EpiDelivery } from "@/mocks/epi";
import { addDocument, buildEpiDocument } from "@/pages/app/modules/documentos/documentsStore";

/**
 * Store das entregas de EPI persistido no Supabase (tabela `epi_deliveries`).
 *
 * Mantém a MESMA API usada pelos consumidores (página do módulo, portal do
 * Colaborador, dashboards e topbar): `useEpis`, `getEpis`, `addEpiDelivery` e
 * `signEpiDelivery`. A empresa é resolvida pela sessão da aplicação.
 *
 * Quando o colaborador assina o aceite pelo portal, a ficha reflete a assinatura
 * imediatamente e o documento correspondente é gerado em Documentos.
 */

interface EpiStoreState {
  deliveries: EpiDelivery[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: EpiStoreState = {
  deliveries: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<EpiStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setEpiCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null };
  void loadEpis();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): EpiDelivery {
  return {
    id: String(r.ref),
    collaboratorId: (r.collaborator_ref as string) ?? "",
    collaboratorName: (r.collaborator_name as string) ?? "",
    collaboratorRole: (r.collaborator_role as string) ?? "",
    area: (r.area as string) ?? "",
    date: (r.delivery_date as string) ?? "",
    reason: (r.reason as string) ?? "",
    items: (r.items as EpiDelivery["items"]) ?? [],
    signature: (r.signature as string) ?? "",
    status: (r.status as EpiDelivery["status"]) ?? "Pendente",
    notes: (r.notes as string) ?? "",
    photo: (r.photo as string) || undefined,
    establishment: (r.establishment as string) || undefined,
  };
}

function toRow(d: EpiDelivery, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: d.id,
    collaborator_ref: d.collaboratorId || null,
    collaborator_name: d.collaboratorName || null,
    collaborator_role: d.collaboratorRole || null,
    area: d.area || null,
    delivery_date: d.date || null,
    reason: d.reason || null,
    items: d.items,
    signature: d.signature || null,
    status: d.status,
    notes: d.notes || null,
    photo: d.photo || null,
    establishment: d.establishment || null,
  };
}

/* ------------------------------ Empresa ----------------------------- */

/**
 * Resolve a empresa da sessão pelo subdomínio.
 *
 * Não existe fallback para "primeira empresa": se o subdomínio não for o da
 * empresa do usuário autenticado, a consulta falha em vez de abrir dados de
 * outra empresa.
 */
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
      .from("epi_deliveries")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setState({
      deliveries: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar as entregas de EPI." });
  }
}

export async function loadEpis(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadEpis(): Promise<void> {
  return loadEpis();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadEpis();
  return () => {
    listeners.delete(listener);
  };
}

export function getEpiStoreState(): EpiStoreState {
  return state;
}

export function getEpis(): EpiDelivery[] {
  return state.deliveries;
}

/** Hook das entregas de EPI (resolvendo a empresa pela sessão). */
export function useEpis(): EpiDelivery[] {
  const { subdomain } = useAppSession();
  setEpiCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getEpis, getEpis);
}

/* -------------------------------- CRUD ------------------------------ */

export async function addEpiDelivery(delivery: EpiDelivery): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("epi_deliveries")
      .upsert(toRow(delivery, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    if (delivery.status === "Assinada") addDocument(buildEpiDocument(delivery));
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível registrar a entrega de EPI." });
    return false;
  }
}

/** Registra o aceite eletrônico do colaborador e marca a entrega como assinada. */
export async function signEpiDelivery(deliveryId: string, signature: string): Promise<void> {
  const current = state.deliveries.find((d) => d.id === deliveryId);
  if (!current) return;
  const next: EpiDelivery = { ...current, signature, status: "Assinada" };
  // Atualização otimista para o portal refletir na hora.
  setState({ deliveries: state.deliveries.map((d) => (d.id === deliveryId ? next : d)) });
  try {
    // O aceite passa por uma função no banco que confere a empresa e o vínculo do
    // colaborador e altera SOMENTE assinatura/status — nunca o conteúdo da ficha.
    const { data, error } = await supabase.rpc("epi_acknowledge_delivery", {
      p_ref: deliveryId,
      p_signature: signature,
    });
    if (error) throw new Error(error.message);
    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok) throw new Error(result?.reason ?? "ack_failed");
    if (current.status !== "Assinada") addDocument(buildEpiDocument(next));
    await refresh();
  } catch {
    // Reverte a atualização otimista: nada é confirmado sem gravação válida.
    setState({
      deliveries: state.deliveries.map((d) => (d.id === deliveryId ? current : d)),
      error: "Não foi possível registrar o aceite da ficha de EPI.",
    });
  }
}

/** Remove uma entrega de EPI (exclusão administrativa). */
export async function removeEpiDelivery(deliveryId: string): Promise<boolean> {
  try {
    await ensureCompanyId();
    const { error } = await supabase
      .from("epi_deliveries")
      .delete()
      .eq("company_ref", companyRef)
      .eq("ref", deliveryId);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível excluir a entrega de EPI." });
    return false;
  }
}