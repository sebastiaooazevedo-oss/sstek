import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";

/**
 * Acompanhamento do afastamento prolongado.
 *
 * O atestado em si é permanente e imutável (sem UPDATE/DELETE por política do
 * banco). O acompanhamento vive em tabela própria, ligado ao atestado por
 * `certificate_id`, e guarda o retorno previsto e a observação da gestão.
 * Assim o documento original nunca é alterado, mas o caso continua sendo
 * acompanhado e reimpresso com o mesmo histórico.
 */

export interface MedicalLeaveFollowup {
  id: string;
  certificateId: string;
  collaboratorRef: string;
  /** Data prevista de retorno ao trabalho no formato YYYY-MM-DD. */
  expectedReturn: string;
  note: string;
  updatedBy: string;
  updatedAt: string;
}

export interface FollowupInput {
  certificateId: string;
  collaboratorRef: string;
  expectedReturn: string;
  note: string;
  updatedBy: string;
}

interface FollowupState {
  followups: MedicalLeaveFollowup[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: FollowupState = {
  followups: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<FollowupState>): void {
  state = { ...state, ...patch };
  emit();
}

const SELECT_COLUMNS =
  "id, certificate_id, collaborator_ref, expected_return, note, updated_by, updated_at";

function mapRow(r: Record<string, unknown>): MedicalLeaveFollowup {
  return {
    id: String(r.id),
    certificateId: String(r.certificate_id ?? ""),
    collaboratorRef: (r.collaborator_ref as string) ?? "",
    expectedReturn: (r.expected_return as string) ?? "",
    note: (r.note as string) ?? "",
    updatedBy: (r.updated_by as string) ?? "",
    updatedAt: (r.updated_at as string) ?? "",
  };
}

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

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    const { data, error } = await supabase
      .from("medical_certificate_followups")
      .select(SELECT_COLUMNS)
      .eq("company_ref", companyRef)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    setState({
      followups: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({
      loaded: true,
      loading: false,
      error: "Não foi possível carregar os acompanhamentos de afastamento.",
    });
  }
}

export async function loadFollowups(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function setFollowupCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, followups: [] };
  void loadFollowups();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadFollowups();
  return () => {
    listeners.delete(listener);
  };
}

/** Acompanhamentos já carregados da empresa. */
export function useMedicalFollowups(): MedicalLeaveFollowup[] {
  const { subdomain } = useAppSession();
  setFollowupCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, () => state.followups, () => state.followups);
}

export function getFollowupFor(certificateId: string): MedicalLeaveFollowup | undefined {
  return state.followups.find((item) => item.certificateId === certificateId);
}

/**
 * Leitura pontual, usada pelo PDF (que pode ser emitido de qualquer tela,
 * inclusive antes de o store terminar de carregar).
 */
export async function fetchFollowup(certificateId: string): Promise<MedicalLeaveFollowup | null> {
  const cached = getFollowupFor(certificateId);
  if (cached) return cached;
  try {
    const { data, error } = await supabase
      .from("medical_certificate_followups")
      .select(SELECT_COLUMNS)
      .eq("certificate_id", certificateId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRow(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Grava (ou atualiza) o acompanhamento do atestado. */
export async function saveFollowup(input: FollowupInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.expectedReturn) return { ok: false, error: "Informe o retorno previsto." };
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase.from("medical_certificate_followups").upsert(
      {
        company_id: companyId,
        company_ref: companyRef,
        certificate_id: input.certificateId,
        collaborator_ref: input.collaboratorRef,
        expected_return: input.expectedReturn,
        note: input.note.trim() || null,
        updated_by: input.updatedBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "certificate_id" }
    );
    if (error) throw error;
    await refresh();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Não foi possível salvar o acompanhamento. Tente novamente.",
    };
  }
}