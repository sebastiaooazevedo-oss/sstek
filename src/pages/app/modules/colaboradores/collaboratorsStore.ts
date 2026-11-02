import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { Collaborator, CollaboratorStatus } from "@/mocks/collaborators";

/**
 * Cadastro de colaboradores persistido no Supabase (tabela `company_collaborators`).
 *
 * O `ref` do cadastro é usado como identificador estável no app (é o mesmo id
 * referenciado por gestor/líder, EPI, assinaturas, QR-Codes e pela base
 * eleitoral da CIPA). Por isso o `id` do modelo continua sendo o `ref`.
 *
 * Cada colaborador pertence a um `establishment` (unidade), o que permite
 * segregar a base eleitoral da CIPA por estabelecimento.
 */

const fallbackPhoto =
  "/images/9d3b7f9b9b.jpg";

export interface CollaboratorStoreState {
  collaborators: Collaborator[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: CollaboratorStoreState = {
  collaborators: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<CollaboratorStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setCollaboratorCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null };
  void loadCollaborators();
}

/* ---------------------------- Mapeadores ---------------------------- */

/** Data ISO do banco → DD/MM/AAAA (vazio quando o banco não informa). */
function formatStoreDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function mapRow(r: Record<string, unknown>): Collaborator {
  return {
    id: String(r.ref),
    name: (r.name as string) ?? "",
    role: (r.role_function as string) ?? "",
    area: (r.area as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    cpf: (r.cpf as string) ?? "",
    matricula: (r.matricula as string) ?? "",
    rg: (r.rg as string) ?? "",
    pis: (r.pis as string) ?? "",
    ctps: (r.ctps as string) ?? "",
    admissionDate: (r.admission_date as string) ?? "",
    updatedAt: formatStoreDate(r.updated_at ?? r.created_at),
    birthDate: (r.birth_date as string) ?? "",
    phone: (r.phone as string) ?? "",
    email: (r.email as string) ?? "",
    city: (r.city as string) ?? "",
    status: (r.status as CollaboratorStatus) ?? "Ativo",
    managerId: (r.manager_ref as string) ?? undefined,
    technicalResponsible: Boolean(r.is_technical_responsible),
    allergies: Array.isArray(r.allergies) ? (r.allergies as string[]) : [],
    photo: (r.photo_url as string) || fallbackPhoto,
    documentsOk: Number(r.documents_ok) || 0,
    documentsTotal: Number(r.documents_total) || 9,
    trainingsActive: Number(r.trainings_active) || 0,
    trainingsExpired: Number(r.trainings_expired) || 0,
    episInUse: Number(r.epis_in_use) || 0,
  };
}

function toRow(c: Collaborator, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    ref: c.id,
    name: c.name,
    cpf: c.cpf,
    matricula: c.matricula || null,
    role_function: c.role || null,
    area: c.area || null,
    establishment: c.establishment || null,
    rg: c.rg || null,
    pis: c.pis || null,
    ctps: c.ctps || null,
    admission_date: c.admissionDate || null,
    birth_date: c.birthDate || null,
    phone: c.phone || null,
    email: c.email || null,
    city: c.city || null,
    status: c.status,
    manager_ref: c.managerId || null,
    is_technical_responsible: Boolean(c.technicalResponsible),
    allergies: (c.allergies ?? []).map((item) => item.trim()).filter(Boolean),
    photo_url: c.photo || null,
    documents_ok: c.documentsOk,
    documents_total: c.documentsTotal,
    trainings_active: c.trainingsActive,
    trainings_expired: c.trainingsExpired,
    epis_in_use: c.episInUse,
    active: c.status === "Ativo",
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

/* ------------------------------- Load ------------------------------- */

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    const { data, error } = await supabase
      .from("company_collaborators")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    if (error) throw error;
    setState({
      collaborators: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({
      loaded: true,
      loading: false,
      error: "Não foi possível carregar os colaboradores.",
    });
  }
}

export async function loadCollaborators(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadCollaborators(): Promise<void> {
  return loadCollaborators();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadCollaborators();
  return () => {
    listeners.delete(listener);
  };
}

export function getCollaboratorStoreState(): CollaboratorStoreState {
  return state;
}

/** Hook do cadastro de colaboradores (fixando a empresa da sessão). */
export function useCollaborators(company: string): CollaboratorStoreState {
  setCollaboratorCompanyRef(company);
  return useSyncExternalStore(subscribe, getCollaboratorStoreState, getCollaboratorStoreState);
}

/**
 * Atalho para módulos que só precisam da lista de colaboradores do cadastro
 * real (EPI, DDS, Assinaturas...). Resolve a empresa pela sessão da aplicação.
 */
export function useCollaboratorsList(): Collaborator[] {
  const { subdomain } = useAppSession();
  const store = useCollaborators(subdomain);
  return store.collaborators;
}

/* -------------------------------- CRUD ------------------------------ */

async function ensureCompanyId(): Promise<string> {
  if (state.companyId) return state.companyId;
  const companyId = await resolveCompanyId(companyRef);
  setState({ companyId });
  return companyId;
}

/**
 * Só existe um Responsável Técnico por empresa: ao marcar um colaborador como
 * RT, os demais são desmarcados para respeitar o índice único do banco.
 */
async function clearOtherTechnicalResponsible(companyId: string, keepRef: string | null): Promise<void> {
  let query = supabase
    .from("company_collaborators")
    .update({ is_technical_responsible: false })
    .eq("company_id", companyId)
    .eq("is_technical_responsible", true);
  if (keepRef) query = query.neq("ref", keepRef);
  await query;
}

export async function addCollaborator(collaborator: Collaborator): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    if (collaborator.technicalResponsible) await clearOtherTechnicalResponsible(companyId, null);
    const { error } = await supabase.from("company_collaborators").insert(toRow(collaborator, companyId));
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível cadastrar o colaborador." });
    return false;
  }
}

export async function updateCollaborator(collaborator: Collaborator): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    if (collaborator.technicalResponsible) await clearOtherTechnicalResponsible(companyId, collaborator.id);
    const row = toRow(collaborator, companyId);
    delete row.ref;
    delete row.company_id;
    const { error } = await supabase
      .from("company_collaborators")
      .update(row)
      .eq("company_id", companyId)
      .eq("ref", collaborator.id);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível salvar as alterações." });
    return false;
  }
}

export async function removeCollaborator(id: string): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("company_collaborators")
      .delete()
      .eq("company_id", companyId)
      .eq("ref", id);
    if (error) throw error;
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível excluir o colaborador." });
    return false;
  }
}

export async function importCollaborators(collaborators: Collaborator[]): Promise<number> {
  if (!collaborators.length) return 0;
  try {
    const companyId = await ensureCompanyId();
    const existing = new Set(state.collaborators.map((c) => c.id));
    const rows = collaborators.filter((c) => !existing.has(c.id)).map((c) => toRow(c, companyId));
    if (!rows.length) return 0;
    const { error } = await supabase.from("company_collaborators").insert(rows);
    if (error) throw error;
    await refresh();
    return rows.length;
  } catch {
    setState({ error: "Não foi possível importar os colaboradores." });
    return 0;
  }
}

/* ------------------------------ Helpers ----------------------------- */

/** Colaboradores filtráveis por estabelecimento. */
export function collaboratorsByEstablishment(store: CollaboratorStoreState, establishment: string): Collaborator[] {
  if (!establishment) return store.collaborators;
  return store.collaborators.filter((c) => c.establishment === establishment);
}