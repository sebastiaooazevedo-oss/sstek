import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { CipaInspection, CipaPhoto, InspectionItem } from "@/mocks/cipa";

/**
 * Store persistente das inspeções da CIPA (tabela `cipa_inspections`).
 *
 * Guarda o conteúdo operacional de cada inspeção (itens verificados, não
 * conformidades, ação corretiva e registro fotográfico) para que as inspeções
 * registradas continuem disponíveis após recarregar a página. A empresa é
 * resolvida pela sessão da aplicação.
 */

interface InspectionsStoreState {
  inspections: CipaInspection[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: InspectionsStoreState = {
  inspections: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<InspectionsStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setCipaInspectionsCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, inspections: [] };
  void loadInspections();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): CipaInspection {
  return {
    id: String(r.ref),
    cipaId: (r.cipa_ref as string) ?? "",
    title: (r.title as string) ?? "",
    date: (r.inspection_date as string) ?? "",
    area: (r.area as string) ?? "",
    location: (r.location as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    responsible: (r.responsible as string) ?? "",
    checklist: (r.checklist as InspectionItem[]) ?? [],
    nonConformities: (r.non_conformities as string) ?? "",
    risk: (r.risk as string) ?? "Baixo",
    action: (r.action as string) ?? "",
    actionOwner: (r.action_owner as string) ?? "",
    actionDue: (r.action_due as string) ?? "",
    photos: (r.photos as CipaPhoto[]) ?? [],
    notes: (r.notes as string) ?? "",
  };
}

function toRow(inspection: CipaInspection, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: inspection.id,
    cipa_ref: inspection.cipaId || null,
    title: inspection.title,
    inspection_date: inspection.date || null,
    area: inspection.area || null,
    location: inspection.location || null,
    establishment: inspection.establishment || null,
    responsible: inspection.responsible || null,
    checklist: inspection.checklist,
    non_conformities: inspection.nonConformities || null,
    risk: inspection.risk,
    action: inspection.action || null,
    action_owner: inspection.actionOwner || null,
    action_due: inspection.actionDue || null,
    photos: inspection.photos,
    notes: inspection.notes || null,
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
      .from("cipa_inspections")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setState({
      inspections: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar as inspeções da CIPA." });
  }
}

export async function loadInspections(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadInspections(): Promise<void> {
  return loadInspections();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadInspections();
  return () => {
    listeners.delete(listener);
  };
}

export function getInspectionsStoreState(): InspectionsStoreState {
  return state;
}

export function getInspections(): CipaInspection[] {
  return state.inspections;
}

/** Hook das inspeções da CIPA (resolvendo a empresa pela sessão). */
export function useInspections(): CipaInspection[] {
  const { subdomain } = useAppSession();
  setCipaInspectionsCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getInspections, getInspections);
}

/* -------------------------------- CRUD ------------------------------ */

export function addInspection(inspection: CipaInspection): void {
  const exists = state.inspections.some((i) => i.id === inspection.id);
  setState({
    inspections: exists
      ? state.inspections.map((i) => (i.id === inspection.id ? inspection : i))
      : [inspection, ...state.inspections],
  });
  void (async () => {
    try {
      const companyId = await ensureCompanyId();
      const { error } = await supabase
        .from("cipa_inspections")
        .upsert(toRow(inspection, companyId), { onConflict: "company_ref,ref" });
      if (error) throw error;
      await refresh();
    } catch {
      setState({ error: "Não foi possível salvar a inspeção da CIPA." });
    }
  })();
}

export function removeInspection(id: string): void {
  setState({ inspections: state.inspections.filter((i) => i.id !== id) });
  void (async () => {
    try {
      await ensureCompanyId();
      const { error } = await supabase.from("cipa_inspections").delete().eq("company_ref", companyRef).eq("ref", id);
      if (error) throw error;
      await refresh();
    } catch {
      setState({ error: "Não foi possível remover a inspeção da CIPA." });
    }
  })();
}