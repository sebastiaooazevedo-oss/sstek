import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";

/**
 * Pedidos de substituição de EPI persistidos no Supabase
 * (tabela `epi_replacement_requests`).
 *
 * O administrador vê todos os pedidos da empresa; o colaborador vê apenas os
 * seus (a separação é feita por RLS no banco, não na tela). A abertura do
 * pedido pode acontecer dos dois lados — o `origin` registra de onde veio.
 */

export const replacementReasons = [
  "CA vencido",
  "Desgaste",
  "Dano",
  "Perda",
  "Tamanho inadequado",
  "Outro",
] as const;

export type EpiReplacementReason = (typeof replacementReasons)[number];

export type EpiReplacementStatus = "Pendente" | "Em andamento" | "Concluída" | "Recusada";

export type EpiReplacementOrigin = "admin" | "colaborador";

export interface EpiReplacementRequest {
  /** Identificador estável usado no app (coluna `ref`). */
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  area: string;
  establishment: string;
  epiName: string;
  ca: string;
  validity: string;
  reason: string;
  lossDetail: string;
  photo: string;
  /** Foto do EPI antigo devolvido no atendimento (registrada pela gestão). */
  returnPhoto: string;
  notes: string;
  status: EpiReplacementStatus;
  origin: EpiReplacementOrigin;
  requestedBy: string;
  createdAt: string;
  resolvedAt: string;
  resolvedBy: string;
  resolutionNotes: string;
}

export interface NewEpiReplacementInput {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  area: string;
  establishment: string;
  epiName: string;
  ca: string;
  validity: string;
  reason: string;
  lossDetail: string;
  photo: string;
  notes: string;
  origin: EpiReplacementOrigin;
  requestedBy: string;
}

interface ReplacementStoreState {
  requests: EpiReplacementRequest[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: ReplacementStoreState = {
  requests: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<ReplacementStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setReplacementCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null };
  void loadEpiReplacementRequests();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(row: Record<string, unknown>): EpiReplacementRequest {
  return {
    id: String(row.ref),
    collaboratorId: (row.collaborator_ref as string) ?? "",
    collaboratorName: (row.collaborator_name as string) ?? "",
    collaboratorRole: (row.collaborator_role as string) ?? "",
    area: (row.area as string) ?? "",
    establishment: (row.establishment as string) ?? "",
    epiName: (row.epi_name as string) ?? "",
    ca: (row.ca as string) ?? "",
    validity: (row.validity as string) ?? "",
    reason: (row.reason as string) ?? "",
    lossDetail: (row.loss_detail as string) ?? "",
    photo: (row.photo as string) ?? "",
    returnPhoto: (row.return_photo as string) ?? "",
    notes: (row.notes as string) ?? "",
    status: (row.status as EpiReplacementStatus) ?? "Pendente",
    origin: (row.origin as EpiReplacementOrigin) ?? "admin",
    requestedBy: (row.requested_by as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    resolvedAt: (row.resolved_at as string) ?? "",
    resolvedBy: (row.resolved_by as string) ?? "",
    resolutionNotes: (row.resolution_notes as string) ?? "",
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
      .from("epi_replacement_requests")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setState({
      requests: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({
      loaded: true,
      loading: false,
      error: "Não foi possível carregar os pedidos de substituição de EPI.",
    });
  }
}

export async function loadEpiReplacementRequests(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadEpiReplacementRequests(): Promise<void> {
  return loadEpiReplacementRequests();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadEpiReplacementRequests();
  return () => {
    listeners.delete(listener);
  };
}

export function getEpiReplacementRequests(): EpiReplacementRequest[] {
  return state.requests;
}

/** Hook dos pedidos de substituição (a empresa vem da sessão). */
export function useEpiReplacementRequests(): EpiReplacementRequest[] {
  const { subdomain } = useAppSession();
  setReplacementCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getEpiReplacementRequests, getEpiReplacementRequests);
}

/* -------------------------------- CRUD ------------------------------ */

function newRef(): string {
  return `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createEpiReplacementRequest(
  input: NewEpiReplacementInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const companyId = await ensureCompanyId();
    const ref = newRef();
    const { error } = await supabase.from("epi_replacement_requests").insert({
      company_id: companyId,
      company_ref: companyRef,
      ref,
      collaborator_ref: input.collaboratorId || null,
      collaborator_name: input.collaboratorName,
      collaborator_role: input.collaboratorRole || null,
      area: input.area || null,
      establishment: input.establishment || null,
      epi_name: input.epiName,
      ca: input.ca || null,
      validity: input.validity || null,
      reason: input.reason,
      loss_detail: input.lossDetail || null,
      photo: input.photo,
      notes: input.notes || null,
      status: "Pendente",
      origin: input.origin,
      requested_by: input.requestedBy || null,
    });
    if (error) throw new Error(error.message);
    await refresh();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    setState({ error: "Não foi possível abrir o pedido de substituição." });
    return {
      ok: false,
      error: message.includes("loss_check")
        ? "O motivo Perda exige o registro de perda preenchido."
        : "Não foi possível abrir o pedido de substituição. Tente novamente.",
    };
  }
}

/**
 * Registra (ou substitui) a foto do EPI antigo devolvido no atendimento do
 * pedido. A gestão usa antes de concluir a substituição, para que o documento
 * em Documentos mostre o equipamento que voltou para o almoxarifado.
 */
export async function setEpiReplacementReturnPhoto(
  requestRef: string,
  photo: string
): Promise<boolean> {
  try {
    await ensureCompanyId();
    const { error } = await supabase
      .from("epi_replacement_requests")
      .update({ return_photo: photo || null, updated_at: new Date().toISOString() })
      .eq("company_ref", companyRef)
      .eq("ref", requestRef);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível salvar a foto do EPI devolvido." });
    return false;
  }
}

export async function setEpiReplacementStatus(
  requestRef: string,
  status: EpiReplacementStatus,
  resolutionNotes = "",
  resolvedBy = ""
): Promise<boolean> {
  try {
    await ensureCompanyId();
    const done = status === "Concluída" || status === "Recusada";
    const { error } = await supabase
      .from("epi_replacement_requests")
      .update({
        status,
        resolution_notes: resolutionNotes || null,
        resolved_by: resolvedBy || null,
        resolved_at: done ? new Date().toISOString() : null,
      })
      .eq("company_ref", companyRef)
      .eq("ref", requestRef);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível atualizar a situação do pedido." });
    return false;
  }
}