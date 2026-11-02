import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { DocumentRecord } from "@/mocks/documents";
import { addDocument, removeDocument } from "@/pages/app/modules/documentos/documentsStore";
import { buildStructuredPdfBody, toBrDate } from "@/pages/app/modules/documentos/structured/structuredPdf";
import {
  countChecklist,
  structuredKindLabel,
  structuredKindTypeId,
  type StructuredKind,
} from "@/pages/app/modules/documentos/structured/structuredData";
import type {
  CatPayload,
  StructuredPayload,
  StructuredRecord,
} from "@/pages/app/modules/documentos/structured/structuredTypes";

/**
 * Store dos documentos estruturados criados dentro de Documentos:
 * Investigação de Acidente, Aferições e Permissão de Trabalho.
 *
 * Um único registro por documento (tabela `structured_documents`, com o
 * conteúdo em JSON), que reconstitui o documento correspondente em Documentos
 * com o PDF já anexado — então ele aparece na lista, pode ser visualizado,
 * baixado e impresso em lote como qualquer outro documento.
 */

interface StructuredStoreState {
  records: StructuredRecord[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: StructuredStoreState = {
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

function setState(patch: Partial<StructuredStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setStructuredCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, records: [] };
  void loadStructuredDocuments();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(row: Record<string, unknown>): StructuredRecord {
  const payload: StructuredPayload =
    (row.payload as StructuredPayload | null) ??
    ({ protocol: "", notes: "", checklist: [], photos: [] } as unknown as StructuredPayload);
  return {
    id: String(row.ref),
    kind: (row.kind as StructuredKind) ?? "investigacao-acidente",
    title: (row.title as string) ?? "",
    date: (row.doc_date as string) ?? "",
    establishment: (row.establishment as string) ?? "",
    payload,
  };
}

function toRow(record: StructuredRecord, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: record.id,
    kind: record.kind,
    title: record.title,
    doc_date: record.date || null,
    establishment: record.establishment || null,
    payload: record.payload,
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------- Documento em Documentos ------------------ */

/** Resumo curto que aparece abaixo do nome do documento na lista. */
function summaryOf(record: StructuredRecord): string {
  if (record.kind === "cat") {
    const cat = record.payload as CatPayload;
    return [
      cat.accidentType,
      cat.cid ? `CID ${cat.cid}` : "CID pendente",
      cat.receiptName ? "recibo de entrega anexado" : "recibo de entrega pendente",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const counts = countChecklist(record.payload.checklist ?? []);
  const photos = (record.payload.photos ?? []).length;
  const parts = [`${counts.total} item(ns) verificado(s)`];
  if (counts.naoConforme) parts.push(`${counts.naoConforme} não conforme(s)`);
  if (photos) parts.push(`${photos} foto(s)`);
  return parts.join(" · ");
}

/** Converte o documento estruturado em um registro da lista de Documentos. */
export function buildStructuredDocument(record: StructuredRecord): DocumentRecord {
  return {
    id: `structured-${record.id}`,
    name: `${structuredKindLabel[record.kind]} — ${record.title.trim()}`,
    typeId: structuredKindTypeId[record.kind],
    typeName: structuredKindLabel[record.kind],
    scope: "empresa",
    issuedAt: toBrDate(record.date),
    expiresAt: "—",
    status: "Em dia",
    size: summaryOf(record),
    fileType: "pdf",
    visibleToCollaborator: false,
    establishment: record.establishment || undefined,
    attachedPdfHtml: buildStructuredPdfBody(record),
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
      .from("structured_documents")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const records = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    // Reconstrói os documentos na lista (idempotente por id).
    records.forEach((record) => addDocument(buildStructuredDocument(record)));
    setState({ records, companyId, loaded: true, loading: false, error: null });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar os documentos estruturados." });
  }
}

export async function loadStructuredDocuments(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadStructuredDocuments();
  return () => {
    listeners.delete(listener);
  };
}

export function getStructuredRecords(): StructuredRecord[] {
  return state.records;
}

export function getStructuredStoreState(): StructuredStoreState {
  return state;
}

/** Hook dos documentos estruturados (dispara o carregamento pela sessão). */
export function useStructuredDocuments(): StructuredRecord[] {
  const { subdomain } = useAppSession();
  setStructuredCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getStructuredRecords, getStructuredRecords);
}

/* -------------------------------- CRUD ------------------------------ */

/** Persiste o documento e o publica na lista de Documentos. */
export async function saveStructuredDocument(record: StructuredRecord): Promise<boolean> {
  try {
    const companyId = await ensureCompanyId();
    const { error } = await supabase
      .from("structured_documents")
      .upsert(toRow(record, companyId), { onConflict: "company_ref,ref" });
    if (error) throw error;
    addDocument(buildStructuredDocument(record));
    await refresh();
    return true;
  } catch {
    setState({ error: "Não foi possível salvar o documento." });
    return false;
  }
}

/** Remove o documento estruturado e o registro correspondente em Documentos. */
export function removeStructuredDocument(id: string): void {
  setState({ records: state.records.filter((r) => r.id !== id) });
  removeDocument(`structured-${id}`);
  void (async () => {
    try {
      await ensureCompanyId();
      const { error } = await supabase.from("structured_documents").delete().eq("company_ref", companyRef).eq("ref", id);
      if (error) throw error;
      await refresh();
    } catch {
      setState({ error: "Não foi possível remover o documento." });
    }
  })();
}