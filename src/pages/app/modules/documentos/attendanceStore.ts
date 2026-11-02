import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { DocumentRecord } from "@/mocks/documents";
import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import { sealPrintHtml, type SealDisplay } from "@/pages/app/signature/authenticitySeal";
import { attendanceSeal } from "@/pages/app/modules/documentos/attendanceSeal";
import { addDocument, getDocuments } from "@/pages/app/modules/documentos/documentsStore";

/**
 * Store das Fichas de Presença persistidas no Supabase (tabela
 * `attendance_sheets`).
 *
 * Guarda o conteúdo operacional de cada ficha (dados da atividade,
 * participantes e assinaturas) e reconstrói o registro correspondente em
 * Documentos, de modo que as fichas geradas continuem disponíveis após
 * recarregar a página.
 */

export interface AttendanceParticipant {
  id: string;
  name: string;
  role: string;
  document: string;
  signature: string;
  /** Id do colaborador da base, quando o nome corresponder a um cadastro. */
  collaboratorId: string;
}

export interface AttendanceSheet {
  id: string;
  title: string;
  facilitator: string;
  facilitatorDoc: string;
  facilitatorSignature: string;
  date: string;
  place: string;
  /** Unidade/estabelecimento ao qual a ficha está vinculada. */
  establishment: string;
  participants: AttendanceParticipant[];
}

interface AttendanceStoreState {
  sheets: AttendanceSheet[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: AttendanceStoreState = {
  sheets: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<AttendanceStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setAttendanceCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null };
  void loadAttendanceSheets();
}

/* ------------------------------ Helpers ----------------------------- */

export function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function filledOf(sheet: AttendanceSheet): AttendanceParticipant[] {
  return sheet.participants.filter((p) => p.name.trim().length > 1);
}

function signedCountOf(sheet: AttendanceSheet): number {
  return sheet.participants.filter((p) => p.signature).length + (sheet.facilitatorSignature ? 1 : 0);
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): AttendanceSheet {
  return {
    id: String(r.ref),
    title: (r.title as string) ?? "",
    facilitator: (r.facilitator as string) ?? "",
    facilitatorDoc: (r.facilitator_doc as string) ?? "",
    facilitatorSignature: (r.facilitator_signature as string) ?? "",
    date: (r.sheet_date as string) ?? "",
    place: (r.place as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    participants: (r.participants as AttendanceParticipant[]) ?? [],
  };
}

function toRow(sheet: AttendanceSheet, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: sheet.id,
    title: sheet.title,
    facilitator: sheet.facilitator,
    facilitator_doc: sheet.facilitatorDoc || null,
    facilitator_signature: sheet.facilitatorSignature || null,
    sheet_date: sheet.date,
    place: sheet.place || null,
    establishment: sheet.establishment || null,
    participants: sheet.participants,
    participant_count: filledOf(sheet).length,
    signature_count: signedCountOf(sheet),
    updated_at: new Date().toISOString(),
  };
}

/* --------------------------- PDF / documento ------------------------ */

/** Monta o corpo HTML da Ficha de Presença (PDF/impressão). */
export function buildAttendancePdfBody(sheet: AttendanceSheet, seal?: SealDisplay | null): string {
  const rows = sheet.participants
    .map(
      (p, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(p.name.trim()) || "—"}</td>
        <td>${escapeHtml(p.role.trim()) || "—"}</td>
        <td>${escapeHtml(p.document.trim()) || "—"}</td>
        <td class="sign">${
          p.signature
            ? `<img src="${p.signature}" alt="Assinatura de ${escapeHtml(p.name)}" />`
            : '<span class="empty">(sem assinatura)</span>'
        }</td>
      </tr>`
    )
    .join("");

  return `${pdfHeader("Ficha de Presença")}
    <h1>${escapeHtml(sheet.title.trim())}</h1>
    <p class="muted">Registro de participação em atividade de segurança do trabalho.</p>
    <div class="grid">
      <div><strong>Facilitador:</strong> ${escapeHtml(sheet.facilitator.trim()) || "—"}</div>
      <div><strong>Documento do facilitador:</strong> ${escapeHtml(sheet.facilitatorDoc.trim()) || "—"}</div>
      <div><strong>Data:</strong> ${toBrDate(sheet.date)}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(sheet.establishment.trim()) || "—"}</div>
      <div><strong>Local:</strong> ${escapeHtml(sheet.place.trim()) || "—"}</div>
      <div><strong>Participantes:</strong> ${filledOf(sheet).length}</div>
      <div><strong>Assinaturas coletadas:</strong> ${signedCountOf(sheet)}</div>
    </div>
    <h2>Lista de participantes e coleta de assinaturas</h2>
    <table>
      <thead>
        <tr><th>#</th><th>Nome</th><th>Função</th><th>CPF / Matrícula</th><th>Assinatura</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:26px;font-size:13px">
      <strong>Assinatura do facilitador</strong><br/>
      ${
        sheet.facilitatorSignature
          ? `<img src="${sheet.facilitatorSignature}" alt="Assinatura do facilitador" style="height:46px;margin-top:6px" />`
          : '<span class="empty" style="color:#9aa6ac;font-style:italic">(sem assinatura)</span>'
      }
    </div>
    ${pdfFooter(sealPrintHtml(seal ?? null))}`;
}

/** Converte uma ficha persistida em um registro de documento da empresa. */
export function buildAttendanceDocument(sheet: AttendanceSheet, seal?: SealDisplay | null): DocumentRecord {
  return {
    id: `ficha-${sheet.id}`,
    name: `Ficha de Presença — ${sheet.title.trim()}`,
    typeId: "ficha-presenca",
    typeName: "Ficha de Presença",
    scope: "empresa",
    issuedAt: toBrDate(sheet.date),
    expiresAt: "—",
    status: "Em dia",
    establishment: sheet.establishment || undefined,
    size: `${filledOf(sheet).length} participante(s) · ${signedCountOf(sheet)} assinatura(s)`,
    fileType: "pdf",
    visibleToCollaborator: true,
    attachedPdfHtml: buildAttendancePdfBody(sheet, seal),
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
      .from("attendance_sheets")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const sheets = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    // Reconstrói os registros em Documentos (idempotente por id). O PDF já
    // chancelado de uma ficha existente é preservado (nunca reemitido sem selo).
    const existing = new Map(getDocuments().map((doc) => [doc.id, doc]));
    sheets.forEach((sheet) => {
      const record = buildAttendanceDocument(sheet);
      if (existing.get(record.id)?.attachedPdfHtml) return;
      addDocument(record);
    });
    setState({
      sheets,
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar as fichas de presença." });
  }
}

export async function loadAttendanceSheets(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadAttendanceSheets(): Promise<void> {
  return loadAttendanceSheets();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadAttendanceSheets();
  return () => {
    listeners.delete(listener);
  };
}

export function getAttendanceStoreState(): AttendanceStoreState {
  return state;
}

export function getAttendanceSheets(): AttendanceSheet[] {
  return state.sheets;
}

/** Hook das Fichas de Presença (dispara o carregamento pela sessão). */
export function useAttendanceSheets(): AttendanceSheet[] {
  const { subdomain } = useAppSession();
  setAttendanceCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getAttendanceSheets, getAttendanceSheets);
}

/* -------------------------------- CRUD ------------------------------ */

/** Persiste uma ficha e reconstrói o documento correspondente em Documentos. */
export async function saveAttendanceSheet(sheet: AttendanceSheet): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("attendance_sheets")
      .upsert(toRow(sheet, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    // A chancela só é emitida quando existe assinatura coletada, e o mesmo selo
    // é reaproveitado na prévia e no PDF anexado ao documento.
    const seal = await attendanceSeal(sheet);
    addDocument(buildAttendanceDocument(sheet, seal));
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível salvar a ficha de presença." });
    return false;
  }
}