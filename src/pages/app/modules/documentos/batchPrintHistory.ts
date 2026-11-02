import { supabase } from "@/lib/supabase";

/**
 * Leitura do rastro auditável da Impressão em Lote.
 *
 * Os PDFs não são armazenados: o banco guarda apenas quem gerou cada dossiê,
 * quais documentos/versões entraram, quantas páginas e quando. Esta camada
 * expõe esses registros para a tela "Lotes gerados", sempre restrita à
 * empresa da sessão (RLS + filtro explícito por `company_ref`).
 */

export interface BatchHistoryItem {
  ref: string;
  name: string;
  typeId: string;
  typeName: string;
  version: string;
  issuedAt: string;
  expiresAt: string;
  source: string;
  pages: number;
}

export interface BatchHistoryRow {
  id: string;
  batchRef: string;
  collaboratorId: string;
  collaboratorName: string;
  fileName: string;
  pageCount: number;
  status: string;
  items: BatchHistoryItem[];
  pendencies: string[];
  generatedByName: string;
  generatedByEmail: string;
  generatedAt: string;
}

export interface BatchHistoryGroup {
  batchRef: string;
  generatedAt: string;
  generatedByName: string;
  generatedByEmail: string;
  totalPages: number;
  rows: BatchHistoryRow[];
}

interface RawRow {
  id: string;
  batch_ref: string;
  collaborator_ref: string;
  collaborator_name: string;
  file_name: string;
  page_count: number | null;
  status: string | null;
  items: unknown;
  pendencies: unknown;
  generated_by_name: string | null;
  generated_by_email: string | null;
  generated_at: string;
}

function toItems(value: unknown): BatchHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      ref: String(item.ref ?? ""),
      name: String(item.name ?? ""),
      typeId: String(item.type_id ?? ""),
      typeName: String(item.type_name ?? ""),
      version: String(item.version ?? ""),
      issuedAt: String(item.issued_at ?? ""),
      expiresAt: String(item.expires_at ?? ""),
      source: String(item.source ?? ""),
      pages: Number(item.pages ?? 0) || 0,
    };
  });
}

function toPendencies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "")).filter(Boolean);
}

function normalize(row: RawRow): BatchHistoryRow {
  return {
    id: row.id,
    batchRef: row.batch_ref,
    collaboratorId: row.collaborator_ref,
    collaboratorName: row.collaborator_name,
    fileName: row.file_name,
    pageCount: Number(row.page_count ?? 0) || 0,
    status: row.status ?? "gerado",
    items: toItems(row.items),
    pendencies: toPendencies(row.pendencies),
    generatedByName: row.generated_by_name ?? "",
    generatedByEmail: row.generated_by_email ?? "",
    generatedAt: row.generated_at,
  };
}

const SELECT_COLUMNS =
  "id,batch_ref,collaborator_ref,collaborator_name,file_name,page_count,status,items,pendencies,generated_by_name,generated_by_email,generated_at";

/**
 * Busca o rastro da empresa. `fromIso` limita o período no banco; o restante
 * dos filtros (colaborador, busca) é aplicado na tela.
 */
export async function fetchBatchHistory(companyRef: string, fromIso: string | null): Promise<BatchHistoryRow[]> {
  if (!companyRef) return [];
  let query = supabase
    .from("document_batch_prints")
    .select(SELECT_COLUMNS)
    .eq("company_ref", companyRef)
    .order("generated_at", { ascending: false })
    .limit(1000);

  if (fromIso) query = query.gte("generated_at", fromIso);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Não foi possível carregar os lotes gerados.");
  return ((data ?? []) as RawRow[]).map(normalize);
}

/** Agrupa as linhas (um colaborador por linha) pelo lote que as originou. */
export function groupHistoryByBatch(rows: BatchHistoryRow[]): BatchHistoryGroup[] {
  const groups = new Map<string, BatchHistoryGroup>();
  rows.forEach((row) => {
    const current = groups.get(row.batchRef);
    if (current) {
      current.rows.push(row);
      current.totalPages += row.pageCount;
      if (!current.generatedByName && row.generatedByName) current.generatedByName = row.generatedByName;
      if (!current.generatedByEmail && row.generatedByEmail) current.generatedByEmail = row.generatedByEmail;
      return;
    }
    groups.set(row.batchRef, {
      batchRef: row.batchRef,
      generatedAt: row.generatedAt,
      generatedByName: row.generatedByName,
      generatedByEmail: row.generatedByEmail,
      totalPages: row.pageCount,
      rows: [row],
    });
  });
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
  );
}

export function formatHistoryDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatHistoryDay(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-BR");
}