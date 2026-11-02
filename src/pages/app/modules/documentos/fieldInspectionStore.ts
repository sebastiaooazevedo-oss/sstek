import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { DocumentRecord } from "@/mocks/documents";
import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import {
  countNonConforming,
  inspectionChecklist,
  type ChecklistEntry,
  type InspectionKind,
  type InspectionPhoto,
  type InspectedPerson,
  type RiskLevel,
} from "@/pages/app/modules/documentos/components/inspectionData";
import { addDocument, removeDocument } from "@/pages/app/modules/documentos/documentsStore";

/**
 * Store das Inspeções de Campo persistidas no Supabase (tabela
 * `field_inspections`).
 *
 * Guarda o conteúdo operacional de cada inspeção (identificação, itens
 * verificados, não conformidades, ação corretiva, colaboradores vistoriados e
 * registro fotográfico) e reconstrói o documento correspondente em Documentos,
 * de modo que as inspeções geradas continuem disponíveis — com o PDF anexado —
 * após recarregar a página.
 */

export interface FieldInspectionRecord {
  id: string;
  title: string;
  kind: InspectionKind;
  date: string;
  time: string;
  shift: string;
  area: string;
  location: string;
  /** Unidade/estabelecimento onde a inspeção foi realizada. */
  establishment: string;
  scope: string;
  inspectorName: string;
  inspectorRegistration: string;
  inspectorRole: string;
  checklist: Record<string, ChecklistEntry>;
  nonConformities: string;
  risk: RiskLevel;
  action: string;
  actionOwner: string;
  actionDue: string;
  inspected: InspectedPerson[];
  photos: InspectionPhoto[];
  notes: string;
}

interface FieldInspectionStoreState {
  inspections: FieldInspectionRecord[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: FieldInspectionStoreState = {
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

function setState(patch: Partial<FieldInspectionStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setFieldInspectionCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, inspections: [] };
  void loadFieldInspections();
}

/* ------------------------------ Helpers ----------------------------- */

function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): FieldInspectionRecord {
  return {
    id: String(r.ref),
    title: (r.title as string) ?? "",
    kind: (r.kind as InspectionKind) ?? "Rotina",
    date: (r.inspection_date as string) ?? "",
    time: (r.inspection_time as string) ?? "",
    shift: (r.shift as string) ?? "",
    area: (r.area as string) ?? "",
    location: (r.location as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    scope: (r.scope as string) ?? "",
    inspectorName: (r.inspector_name as string) ?? "",
    inspectorRegistration: (r.inspector_registration as string) ?? "",
    inspectorRole: (r.inspector_role as string) ?? "",
    checklist: (r.checklist as Record<string, ChecklistEntry>) ?? {},
    nonConformities: (r.non_conformities as string) ?? "",
    risk: (r.risk as RiskLevel) ?? "Baixo",
    action: (r.action as string) ?? "",
    actionOwner: (r.action_owner as string) ?? "",
    actionDue: (r.action_due as string) ?? "",
    inspected: (r.inspected as InspectedPerson[]) ?? [],
    photos: (r.photos as InspectionPhoto[]) ?? [],
    notes: (r.notes as string) ?? "",
  };
}

function toRow(record: FieldInspectionRecord, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: record.id,
    title: record.title,
    kind: record.kind,
    inspection_date: record.date || null,
    inspection_time: record.time || null,
    shift: record.shift || null,
    area: record.area || null,
    location: record.location || null,
    establishment: record.establishment || null,
    scope: record.scope || null,
    inspector_name: record.inspectorName || null,
    inspector_registration: record.inspectorRegistration || null,
    inspector_role: record.inspectorRole || null,
    checklist: record.checklist,
    non_conformities: record.nonConformities || null,
    risk: record.risk,
    action: record.action || null,
    action_owner: record.actionOwner || null,
    action_due: record.actionDue || null,
    inspected: record.inspected,
    photos: record.photos,
    notes: record.notes || null,
    updated_at: new Date().toISOString(),
  };
}

/* --------------------------- PDF / documento ------------------------ */

/** Monta o corpo HTML da Inspeção de Campo (PDF/impressão). */
export function buildFieldInspectionPdfBody(record: FieldInspectionRecord): string {
  const nonConforming = countNonConforming(record.checklist);
  const conforming = inspectionChecklist.filter((i) => record.checklist[i.id]?.status === "Conforme").length;

  const validationRows = inspectionChecklist
    .map((item) => {
      const entry = record.checklist[item.id] || { status: "", note: "" };
      const status = entry.status || "Não avaliado";
      return `<tr>
        <td>${escapeHtml(item.label)}</td>
        <td>${escapeHtml(item.ref)}</td>
        <td>${escapeHtml(status)}</td>
        <td>${escapeHtml(entry.note.trim()) || "—"}</td>
      </tr>`;
    })
    .join("");

  const inspectedRows = record.inspected.length
    ? record.inspected
        .map(
          (p) => `<tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.cpf) || "—"}</td>
        <td>${escapeHtml(p.matricula) || "—"}</td>
        <td>${escapeHtml([p.role, p.area].filter(Boolean).join(" · ")) || "—"}</td>
        <td>${escapeHtml(p.situation)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5">Nenhum colaborador registrado.</td></tr>`;

  const photoBlock = record.photos.length
    ? `<div class="photo-grid">${record.photos
        .map(
          (p) =>
            `<figure><img src="${p.url}" alt="Registro fotográfico da inspeção" /><figcaption>${escapeHtml(
              p.name
            )}</figcaption></figure>`
        )
        .join("")}</div>`
    : `<p class="muted">Sem registro fotográfico anexado.</p>`;

  return `${pdfHeader("Inspeção de Campo")}
    <h1>${escapeHtml(record.title.trim())}</h1>
    <p class="muted">Registro de inspeção de segurança de campo (NR-1 / PGR).</p>
    <div class="grid">
      <div><strong>Tipo:</strong> ${escapeHtml(record.kind)}</div>
      <div><strong>Data:</strong> ${toBrDate(record.date)}${record.time ? ` às ${escapeHtml(record.time)}` : ""}</div>
      <div><strong>Turno:</strong> ${escapeHtml(record.shift) || "—"}</div>
      <div><strong>Área / Setor:</strong> ${escapeHtml(record.area) || "—"}</div>
      <div><strong>Local:</strong> ${escapeHtml(record.location) || "—"}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(record.establishment) || "—"}</div>
      <div><strong>Responsável:</strong> ${escapeHtml(record.inspectorName) || "—"}</div>
      <div><strong>Registro:</strong> ${escapeHtml(record.inspectorRegistration) || "—"}</div>
      <div><strong>Função:</strong> ${escapeHtml(record.inspectorRole) || "—"}</div>
    </div>
    <h2>Objeto / Escopo da inspeção</h2>
    <p>${escapeHtml(record.scope.trim()) || "—"}</p>
    <h2>Itens verificados</h2>
    <div class="kpis">
      <div class="kpi"><b>${conforming}</b><span>Itens conformes</span></div>
      <div class="kpi"><b>${nonConforming}</b><span>Itens não conformes</span></div>
      <div class="kpi"><b>${record.inspected.length}</b><span>Colaboradores vistoriados</span></div>
      <div class="kpi"><b>${record.photos.length}</b><span>Registros fotográficos</span></div>
    </div>
    <table>
      <thead><tr><th>Item verificado</th><th>Referência</th><th>Situação</th><th>Observação</th></tr></thead>
      <tbody>${validationRows}</tbody>
    </table>
    <h2>Não conformidades e ações</h2>
    <div class="grid">
      <div><strong>Grau de risco:</strong> ${escapeHtml(record.risk)}</div>
      <div><strong>Responsável pela ação:</strong> ${escapeHtml(record.actionOwner) || "—"}</div>
      <div><strong>Prazo:</strong> ${toBrDate(record.actionDue)}</div>
    </div>
    <p><strong>Desvios identificados:</strong> ${escapeHtml(record.nonConformities.trim()) || "—"}</p>
    <p><strong>Ação corretiva / recomendação:</strong> ${escapeHtml(record.action.trim()) || "—"}</p>
    <h2>Colaboradores vistoriados (${record.inspected.length})</h2>
    <table>
      <thead><tr><th>Nome</th><th>CPF</th><th>Matrícula</th><th>Função / Área</th><th>Situação</th></tr></thead>
      <tbody>${inspectedRows}</tbody>
    </table>
    <h2>Registro fotográfico</h2>
    ${photoBlock}
    <h2>Observações gerais</h2>
    <p>${escapeHtml(record.notes.trim()) || "—"}</p>
    ${pdfFooter()}`;
}

/** Converte uma inspeção persistida em um registro de documento da empresa. */
export function buildFieldInspectionDocument(record: FieldInspectionRecord): DocumentRecord {
  const nonConforming = countNonConforming(record.checklist);
  return {
    id: `inspecao-${record.id}`,
    name: `Inspeção de Campo — ${record.title.trim()}`,
    typeId: "inspecao-campo",
    typeName: "Inspeção de Campo",
    scope: "empresa",
    issuedAt: toBrDate(record.date),
    expiresAt: "—",
    status: "Em dia",
    size: `${record.inspected.length} vistoriado(s) · ${nonConforming} não conformidade(s) · ${record.photos.length} foto(s)`,
    fileType: "pdf",
    visibleToCollaborator: false,
    establishment: record.establishment || undefined,
    attachedPdfHtml: buildFieldInspectionPdfBody(record),
    attachedAt: new Date().toISOString(),
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
      .from("field_inspections")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const inspections = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    // Reconstrói os registros em Documentos (idempotente por id).
    inspections.forEach((record) => addDocument(buildFieldInspectionDocument(record)));
    setState({ inspections, companyId, loaded: true, loading: false, error: null });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar as inspeções de campo." });
  }
}

export async function loadFieldInspections(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadFieldInspections(): Promise<void> {
  return loadFieldInspections();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadFieldInspections();
  return () => {
    listeners.delete(listener);
  };
}

export function getFieldInspectionStoreState(): FieldInspectionStoreState {
  return state;
}

export function getFieldInspections(): FieldInspectionRecord[] {
  return state.inspections;
}

/** Hook das Inspeções de Campo (dispara o carregamento pela sessão). */
export function useFieldInspections(): FieldInspectionRecord[] {
  const { subdomain } = useAppSession();
  setFieldInspectionCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getFieldInspections, getFieldInspections);
}

/* -------------------------------- CRUD ------------------------------ */

/** Persiste a inspeção e reconstrói o documento correspondente em Documentos. */
export async function saveFieldInspection(record: FieldInspectionRecord): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("field_inspections")
      .upsert(toRow(record, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    addDocument(buildFieldInspectionDocument(record));
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível salvar a inspeção de campo." });
    return false;
  }
}

/** Remove a inspeção persistida e o documento correspondente em Documentos. */
export function removeFieldInspection(id: string): void {
  setState({ inspections: state.inspections.filter((i) => i.id !== id) });
  removeDocument(`inspecao-${id}`);
  void (async () => {
    try {
      await ensureCompanyId();
      const { error } = await supabase.from("field_inspections").delete().eq("company_ref", companyRef).eq("ref", id);
      if (error) throw error;
      await refresh();
    } catch {
      setState({ error: "Não foi possível remover a inspeção de campo." });
    }
  })();
}