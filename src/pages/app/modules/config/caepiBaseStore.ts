import { useSyncExternalStore } from "react";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { buildErrorReportCsv } from "@/pages/app/modules/config/caepiImport/caepiCsv";
import type {
  CaepiAnalysis,
  CaepiErrorRow,
  CaepiFieldKey,
  CaepiMapping,
  CaepiSampleRow,
} from "@/pages/app/modules/config/caepiImport/types";

/**
 * Store da Base de dados do CAEPI.
 *
 * O arquivo oficial (CSV ou CSV.GZ) hoje é preparado no NAVEGADOR: o .gz é descompactado
 * (multi-membro) e o CSV é dividido em partes de 20 MB. O servidor lê essas partes por faixa
 * de bytes, valida linha a linha, grava em lotes e devolve a contagem exata de inseridos,
 * atualizados e rejeitados. Assim nenhuma etapa depende de descompactar 151 MB dentro de um
 * worker com memória limitada — que era a causa real das falhas anteriores.
 */

export interface CaepiImportBatch {
  id: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  status: "processing" | "completed" | "failed";
  stage: string | null;
  isActive: boolean;
  errorMessage: string | null;
  hasBackupFile: boolean;
  partsTotal: number;
  canResume: boolean;
  encoding: string | null;
  delimiter: string | null;
  uploadedByName: string | null;
  createdAt: string;
  completedAt: string | null;
  heartbeatAt: string | null;
  totalBytes: number;
}

export interface CaepiImportLog {
  id: number;
  batchId: string | null;
  action: string;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
}

export type CaepiJobPhase =
  | "idle"
  | "uploading"
  | "starting"
  | "importing"
  | "done"
  | "error";

export interface CaepiImportJob {
  phase: CaepiJobPhase;
  message: string;
  pct: number | null;
  inserted: number;
  updated: number;
  rejected: number;
  rowCount: number;
  batchId: string | null;
  fileName: string | null;
  sample: CaepiSampleRow[];
  error: string | null;
}

interface CaepiBaseState {
  batches: CaepiImportBatch[];
  logs: CaepiImportLog[];
  loaded: boolean;
  loading: boolean;
  job: CaepiImportJob;
  cancelling: boolean;
  cleanupRunning: boolean;
}

const idleJob: CaepiImportJob = {
  phase: "idle",
  message: "",
  pct: null,
  inserted: 0,
  updated: 0,
  rejected: 0,
  rowCount: 0,
  batchId: null,
  fileName: null,
  sample: [],
  error: null,
};

let state: CaepiBaseState = {
  batches: [],
  logs: [],
  loaded: false,
  loading: false,
  job: idleJob,
  cancelling: false,
  cleanupRunning: false,
};

const listeners = new Set<() => void>();
let cancelRequested = false;
let currentXhr: XMLHttpRequest | null = null;
let currentBatchId: string | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<CaepiBaseState>): void {
  state = { ...state, ...patch };
  emit();
}

function setJob(patch: Partial<CaepiImportJob>): void {
  setState({ job: { ...state.job, ...patch } });
}

interface BatchDbRow {
  id: string;
  file_name: string;
  file_size: number | null;
  row_count: number | null;
  inserted_count: number | null;
  updated_count: number | null;
  rejected_count: number | null;
  status: string;
  stage: string | null;
  is_active: boolean;
  error_message: string | null;
  parts: { path: string; size: number }[] | null;
  total_bytes: number | null;
  encoding: string | null;
  delimiter_char: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  heartbeat_at: string | null;
}

interface LogDbRow {
  id: number;
  batch_id: string | null;
  action: string;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
}

function mapBatch(row: BatchDbRow): CaepiImportBatch {
  const parts = Array.isArray(row.parts) ? row.parts : [];
  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size ?? 0,
    rowCount: row.row_count ?? 0,
    insertedCount: row.inserted_count ?? 0,
    updatedCount: row.updated_count ?? 0,
    rejectedCount: row.rejected_count ?? 0,
    status: (row.status as CaepiImportBatch["status"]) ?? "processing",
    stage: row.stage,
    isActive: Boolean(row.is_active),
    errorMessage: row.error_message,
    hasBackupFile: parts.length > 0,
    partsTotal: parts.length,
    canResume: parts.length > 0 && row.status !== "completed",
    encoding: row.encoding,
    delimiter: row.delimiter_char,
    uploadedByName: row.uploaded_by_name,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    heartbeatAt: row.heartbeat_at,
    totalBytes: Number(row.total_bytes ?? row.file_size ?? 0),
  };
}

const BATCH_COLUMNS =
  "id, file_name, file_size, row_count, inserted_count, updated_count, rejected_count, status, stage, is_active, error_message, parts, total_bytes, encoding, delimiter_char, uploaded_by_name, created_at, completed_at, heartbeat_at";

const HEARTBEAT_STALE_MS = 3 * 60 * 1000;

async function fetchBatches(): Promise<CaepiImportBatch[]> {
  const { data } = await supabase
    .from("caepi_import_batches")
    .select(BATCH_COLUMNS)
    .order("created_at", { ascending: false });
  return ((data as BatchDbRow[] | null) ?? []).map(mapBatch);
}

async function fetchLogs(): Promise<CaepiImportLog[]> {
  const { data } = await supabase
    .from("caepi_import_logs")
    .select("id, batch_id, action, detail, actor_name, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data as LogDbRow[] | null) ?? []).map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    action: row.action,
    detail: row.detail,
    actorName: row.actor_name,
    createdAt: row.created_at,
  }));
}

/**
 * Encerra lotes travados em "processing" (a função do servidor foi interrompida). As partes
 * do arquivo são mantidas, então o lote aparece com a opção de RETOMAR — nada é perdido.
 */
async function sweepStaleBatches(batches: CaepiImportBatch[]): Promise<boolean> {
  // A escrita no lote agora acontece SOMENTE no servidor (RLS bloqueia o cliente).
  // Lotes travados sao encerrados pela propria funcao `caepi-import` quando uma nova
  // operacao comeca, entao aqui apenas sinalizamos para a tela que eles podem ser retomados.
  void batches;
  return false;
}

export async function loadCaepiBase(force = false): Promise<void> {
  if (state.loading) return;
  if (state.loaded && !force) return;
  setState({ loading: true });
  try {
    const batches = await fetchBatches();
    const swept = await sweepStaleBatches(batches);
    const freshBatches = swept ? await fetchBatches() : batches;
    const logs = await fetchLogs();
    setState({ batches: freshBatches, logs, loaded: true, loading: false });
  } catch {
    setState({ loading: false });
  }
}

export function subscribeCaepiBase(listener: () => void): () => void {
  listeners.add(listener);
  void loadCaepiBase();
  return () => {
    listeners.delete(listener);
  };
}

export function getCaepiBaseState(): CaepiBaseState {
  return state;
}

export function useCaepiBase(): CaepiBaseState {
  return useSyncExternalStore(subscribeCaepiBase, getCaepiBaseState, getCaepiBaseState);
}

export function activeBatch(): CaepiImportBatch | null {
  return state.batches.find((batch) => batch.isActive) ?? null;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function sanitizeFileName(name: string): string {
  const parts = name.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop() : "csv";
  const base =
    parts
      .join(".")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "base-caepi";
  return `${base}.${ext}`;
}

/** Token do usuário logado — o bucket do CAEPI só aceita escrita de super usuário. */
async function resolveAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

/** Envia um bloco do arquivo reportando progresso real (byte a byte). */
async function uploadPart(
  path: string,
  blob: Blob,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  const accessToken = await resolveAccessToken();
  if (!accessToken) {
    throw new Error("Sessão expirada: entre novamente para importar a base do CAEPI.");
  }
  return new Promise((resolve, reject) => {
    const url = `${supabaseUrl}/storage/v1/object/caepi-base/${path}`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("apikey", supabaseAnonKey);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("Content-Type", "text/csv");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
      else onProgress(event.loaded, blob.size);
    };
    xhr.onload = () => {
      if (currentXhr === xhr) currentXhr = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(blob.size, blob.size);
        resolve();
        return;
      }
      let message = `Falha ao enviar a parte do arquivo (HTTP ${xhr.status}).`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
      } catch {
        // mantém a mensagem padrão
      }
      if (new RegExp("maximum size|too large|413", "i").test(`${message} ${xhr.status}`)) {
        message =
          "A parte do arquivo excedeu o limite de tamanho do armazenamento. Fale com o suporte para aumentar o limite do bucket caepi-base.";
      }
      reject(new Error(message));
    };
    xhr.onerror = () => {
      if (currentXhr === xhr) currentXhr = null;
      reject(new Error("Falha de rede ao enviar a parte do arquivo. Verifique a conexão e tente novamente."));
    };
    xhr.onabort = () => {
      if (currentXhr === xhr) currentXhr = null;
      reject(new Error("Importação cancelada."));
    };

    currentXhr = xhr;
    xhr.send(blob);
  });
}

interface ImportPayload {
  ok?: boolean;
  error?: string;
  detail?: string;
  batchId?: string;
  finished?: boolean;
  stage?: string;
  inserted?: number;
  updated?: number;
  rejected?: number;
  rowCount?: number;
  bytesRead?: number;
  totalBytes?: number;
  partIndex?: number;
  partsTotal?: number;
  sample?: CaepiSampleRow[];
}

function abortIfCancelled(): void {
  if (cancelRequested) {
    const error = new Error("Importação cancelada.");
    error.name = "CancelledError";
    throw error;
  }
}

/** Percorre as rodadas do servidor até concluir, atualizando o progresso. */
async function runRemaining(initial: ImportPayload, actor: { id?: string | null; name?: string | null }): Promise<void> {
  let payload = initial;
  let guard = 0;

  while (!payload.finished && guard < 2000) {
    abortIfCancelled();
    guard += 1;
    const completed = Number(payload.bytesRead ?? 0);
    const total = Number(payload.totalBytes ?? 0);
    setJob({
      phase: "importing",
      message: "Validando e gravando os registros em lotes…",
      pct: total > 0 ? Math.min(99, Math.round((completed / total) * 100)) : null,
      inserted: Number(payload.inserted ?? 0),
      updated: Number(payload.updated ?? 0),
      rejected: Number(payload.rejected ?? 0),
      rowCount: Number(payload.rowCount ?? 0),
    });

    const batchId = String(payload.batchId ?? currentBatchId ?? "");
    const { data, error } = await supabase.functions.invoke("caepi-import", {
      body: { action: "continue", batchId, actorId: actor.id ?? null, actorName: actor.name ?? null },
    });
    if (error) throw new Error(error.message || "Falha ao continuar o processamento no servidor.");
    payload = (data ?? {}) as ImportPayload;
    if (!payload.ok) throw new Error(payload.detail || payload.error || "Não foi possível importar a base.");
  }

  abortIfCancelled();
  if (!payload.finished) {
    throw new Error(
      "A importação não terminou nesta sessão. O progresso foi salvo: use Retomar importação para continuar do ponto onde parou."
    );
  }

  setJob({
    phase: "done",
    message: "Importação concluída e validada no banco.",
    pct: 100,
    inserted: Number(payload.inserted ?? 0),
    updated: Number(payload.updated ?? 0),
    rejected: Number(payload.rejected ?? 0),
    rowCount: Number(payload.rowCount ?? 0),
    sample: Array.isArray(payload.sample) ? payload.sample : [],
    batchId: payload.batchId ?? currentBatchId,
  });
  await loadCaepiBase(true);
}

export async function startCaepiImport(params: {
  analysis: CaepiAnalysis;
  mapping: CaepiMapping;
  dedupeFields: CaepiFieldKey[];
  actor: { id?: string | null; name?: string | null };
}): Promise<void> {
  const { analysis, mapping, dedupeFields, actor } = params;
  cancelRequested = false;
  currentBatchId = null;

  if (mapping.ca === undefined || mapping.ca < 0) {
    setJob({ ...idleJob, phase: "error", error: "Selecione qual coluna do arquivo contém o número do CA." });
    return;
  }

  setJob({
    ...idleJob,
    phase: "uploading",
    message: `Enviando ${analysis.parts.length} parte(s) do arquivo…`,
    pct: 0,
    fileName: analysis.fileName,
  });

  const prefix = `uploads/${Date.now()}-${sanitizeFileName(analysis.fileName).replace(/\.(csv|csv\.gz|gz)$/i, "")}`;

  try {
    const uploaded: { path: string; size: number }[] = [];
    const totalBytes = analysis.parts.reduce((sum, part) => sum + part.size, 0);
    let sentBefore = 0;

    for (let index = 0; index < analysis.parts.length; index += 1) {
      abortIfCancelled();
      const part = analysis.parts[index];
      const path = `${prefix}/part-${String(index).padStart(3, "0")}.csv`;
      setJob({ message: `Enviando parte ${index + 1} de ${analysis.parts.length}…` });
      await uploadPart(path, part.blob, (loaded) => {
        const done = sentBefore + loaded;
        setJob({
          pct: totalBytes > 0 ? Math.min(100, Math.round((done / totalBytes) * 100)) : null,
          message: `Enviando parte ${index + 1} de ${analysis.parts.length}… (${formatBytes(done)} de ${formatBytes(
            totalBytes
          )})`,
        });
      });
      sentBefore += part.size;
      uploaded.push({ path, size: part.size });
    }

    abortIfCancelled();
    setJob({ phase: "starting", pct: null, message: "Enviando o mapa de colunas e as instruções de validação…" });

    const { data, error } = await supabase.functions.invoke("caepi-import", {
      body: {
        action: "start",
        parts: uploaded,
        mapping,
        dedupeFields,
        delimiter: analysis.delimiter,
        encoding: analysis.encoding,
        header: analysis.headerLine,
        fileName: analysis.fileName,
        totalBytes,
        actorId: actor.id ?? null,
        actorName: actor.name ?? null,
      },
    });
    if (error) throw new Error(error.message || "Falha ao iniciar a importação no servidor.");

    const payload = (data ?? {}) as ImportPayload;
    if (!payload.ok) throw new Error(payload.detail || payload.error || "Não foi possível iniciar a importação.");
    currentBatchId = payload.batchId ?? null;

    await runRemaining(payload, actor);
    currentBatchId = null;
  } catch (err) {
    const cancelled = err instanceof Error && err.name === "CancelledError";
    const message = err instanceof Error ? err.message : "Falha inesperada ao importar a base do CAEPI.";
    if (cancelled) {
      setJob({ ...idleJob });
    } else {
      setJob({ phase: "error", message: "", error: message, batchId: currentBatchId });
    }
    currentBatchId = null;
    currentXhr = null;
    await loadCaepiBase(true);
  }
}

/** Retoma um lote que parou no meio, sem duplicar registros. */
export async function resumeCaepiImport(
  batch: CaepiImportBatch,
  actor: { id?: string | null; name?: string | null }
): Promise<void> {
  cancelRequested = false;
  currentBatchId = batch.id;
  setJob({
    ...idleJob,
    phase: "importing",
    message: "Retomando do ponto onde a importação parou…",
    batchId: batch.id,
    fileName: batch.fileName,
    inserted: batch.insertedCount,
    updated: batch.updatedCount,
    rejected: batch.rejectedCount,
    rowCount: batch.rowCount,
  });

  try {
    const { data, error } = await supabase.functions.invoke("caepi-import", {
      body: { action: "resume", batchId: batch.id },
    });
    if (error) throw new Error(error.message || "Falha ao retomar a importação.");

    const payload = (data ?? {}) as ImportPayload;
    if (!payload.ok) throw new Error(payload.detail || payload.error || "Não foi possível retomar a importação.");
    await runRemaining(payload, actor);
    currentBatchId = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha inesperada ao retomar a importação.";
    setJob({ phase: "error", message: "", error: message, batchId: batch.id });
    currentBatchId = null;
    await loadCaepiBase(true);
  }
}

export async function cancelCaepiImport(actor: { id?: string | null; name?: string | null }): Promise<void> {
  if (state.cancelling) return;
  cancelRequested = true;
  setState({ cancelling: true });
  setJob({ message: "Cancelando…" });
  if (currentXhr) {
    try {
      currentXhr.abort();
    } catch {
      // ignora
    }
  }
  const batchId = currentBatchId;
  if (batchId) {
    try {
      await supabase.functions.invoke("caepi-import", {
        body: { action: "cancel", batchId },
      });
    } catch {
      // melhor esforço
    }
  }
  await loadCaepiBase(true);
  setState({ cancelling: false });
}

export function resetCaepiJob(): void {
  currentBatchId = null;
  cancelRequested = false;
  setState({ job: { ...idleJob } });
}

/** Conta quantas linhas foram rejeitadas na validação (para o aviso do relatório). */
export async function countCaepiErrors(batchId: string): Promise<number> {
  const { count } = await supabase
    .from("caepi_import_errors")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  return count ?? 0;
}

export async function fetchCaepiErrors(batchId: string, max = 20000): Promise<CaepiErrorRow[]> {
  const pageSize = 1000;
  const rows: CaepiErrorRow[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await supabase
      .from("caepi_import_errors")
      .select("line_no, column_name, value_text, reason, row_preview")
      .eq("batch_id", batchId)
      .order("line_no", { ascending: true })
      .range(from, Math.min(from + pageSize - 1, max - 1));
    if (error) throw new Error(error.message);
    const page = (data as CaepiErrorRow[] | null) ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** Baixa o relatório de erros do lote em CSV (abre o download no navegador). */
export async function downloadCaepiErrorReport(batchId: string, fileName: string): Promise<number> {
  const rows = await fetchCaepiErrors(batchId);
  const csv = buildErrorReportCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relatorio-erros-caepi-${fileName.replace(/\.[^.]+$/, "")}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return rows.length;
}

/** Amostra consultada direto do banco (confirmação de que os registros foram gravados). */
export async function fetchBatchSample(batchId: string, limit = 5): Promise<CaepiSampleRow[]> {
  const { data } = await supabase
    .from("caepi_catalog_entries")
    .select("ca, numero_processo, cnpj, razao_social, equipamento, situacao, validade")
    .eq("batch_id", batchId)
    .order("id", { ascending: true })
    .limit(limit);
  return (data as CaepiSampleRow[] | null) ?? [];
}

/** Quantidade efetivamente gravada no banco para o lote (conferência pós-importação). */
export async function countBatchRows(batchId: string): Promise<number> {
  const { count } = await supabase
    .from("caepi_catalog_entries")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  return count ?? 0;
}

/** Remove arquivos órfãos de tentativas antigas (falhas/cancelamentos). */
export async function cleanupOrphanCaepiFiles(
  actor: { id?: string | null; name?: string | null }
): Promise<{ ok: boolean; removed?: number; error?: string }> {
  setState({ cleanupRunning: true });
  try {
    const { data, error } = await supabase.functions.invoke("caepi-import", {
      body: { action: "cleanup_orphans", actorId: actor.id ?? null, actorName: actor.name ?? null },
    });
    if (error) throw new Error(error.message || "Falha ao limpar os arquivos órfãos.");
    const payload = (data ?? {}) as { ok?: boolean; removed?: number; detail?: string };
    if (!payload.ok) throw new Error(payload.detail || "Não foi possível limpar os arquivos órfãos.");
    await loadCaepiBase(true);
    return { ok: true, removed: payload.removed ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao limpar os arquivos órfãos." };
  } finally {
    setState({ cleanupRunning: false });
  }
}