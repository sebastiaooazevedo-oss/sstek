import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Importacao da base oficial do CAEPI (Tabela de CA).
 *
 * DESENHO (cada etapa isolada e verificavel):
 *  1. O NAVEGADOR prepara o arquivo: descompacta o ".gz" (multi-membro) e divide o CSV em
 *     partes de 20 MB, enviadas como objetos separados no Storage. O servidor nunca
 *     descompacta nada, entao nao existe mais estouro de memoria por descompactacao.
 *  2. O servidor LE cada parte por faixa de bytes (Range), processa apenas linhas COMPLETAS
 *     e grava em lotes de 500 registros via RPC que devolve a contagem exata de inseridos e
 *     atualizados (chave de identificacao com indice unico).
 *  3. Linhas invalidas NUNCA sao gravadas: viram registro em `caepi_import_errors` com
 *     linha, coluna, valor e motivo (base do relatorio de erros para download).
 *  4. Posicao (parte + offset) e contadores sao persistidos a cada janela, entao uma
 *     interrupcao retoma do ponto anterior sem duplicar registros.
 *  5. A base ativa anterior so e trocada no final. Nada e apagado antes disso.
 *
 * ESCOPO: a Tabela de CA do CAEPI e publica e nacional, portanto a base e GLOBAL.
 */

const BUCKET = "caepi-base";
const CHUNK_ROWS = 500;
const MAX_ROWS_PER_CALL = 30000;
const TIME_BUDGET_MS = 45000;
const WINDOW_BYTES = 4 * 1024 * 1024;
const MAX_STORED_ERRORS = 50000;
const KEEP_VERSIONS = 3;
const HEARTBEAT_STALE_MS = 3 * 60 * 1000;

const FIELDS = [
  "ca",
  "numero_processo",
  "cnpj",
  "razao_social",
  "equipamento",
  "descricao",
  "situacao",
  "validade",
] as const;

type FieldKey = (typeof FIELDS)[number];
type Mapping = Partial<Record<FieldKey, number>>;

interface PartRef {
  path: string;
  size: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function storageObjectUrl(path: string): string {
  return `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/${BUCKET}/${path}`;
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function shortBody(text: string, max = 500): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}...`;
}

function storageError(label: string, status: number, body: string): string {
  const detail = shortBody(body);
  return detail ? `${label} (status ${status}): ${detail}` : `${label} (status ${status}).`;
}

async function logEvent(
  admin: ReturnType<typeof createClient>,
  batchId: string | null,
  action: string,
  detail: string,
  actorId: string | null,
  actorName: string | null
): Promise<void> {
  await admin.from("caepi_import_logs").insert({
    batch_id: batchId,
    action,
    detail,
    actor_id: actorId,
    actor_name: actorName,
  });
}

function keyNormalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function hashKey(values: string[]): string {
  const source = values.join("\u0001");
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ code, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function guessAtivo(situacao: string): boolean | null {
  const text = situacao.toUpperCase();
  if (!text) return null;
  if (/VENCID|CANCELAD|SUSPENS|INATIV|EXPIRAD/.test(text)) return false;
  if (/V[AÁ]LID|ATIV|VIGENTE/.test(text)) return true;
  return null;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((value) => value.trim());
}

function splitHeader(headerText: string | null, delimiter: string): string[] {
  if (!headerText) return [];
  return parseCsvLine(headerText.replace(/^\uFEFF/, ""), delimiter);
}

async function readWindow(
  path: string,
  offset: number,
  length: number
): Promise<{ bytes: Uint8Array; ignoredRange: boolean }> {
  const res = await fetch(storageObjectUrl(path), {
    headers: serviceHeaders({ Range: `bytes=${offset}-${offset + length - 1}` }),
  });
  if (res.status === 416) return { bytes: new Uint8Array(0), ignoredRange: false };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(storageError("Falha ao ler a parte do arquivo no armazenamento", res.status, body));
  }
  const buffer = new Uint8Array(await res.arrayBuffer());
  const ignoredRange = res.status === 200 && offset > 0;
  if (ignoredRange) {
    return { bytes: buffer.subarray(Math.min(offset, buffer.length)), ignoredRange: true };
  }
  return { bytes: buffer, ignoredRange: false };
}

function buildDedupeKey(cols: string[], mapping: Mapping, dedupeFields: string[]): string {
  const values = dedupeFields.map((field) => {
    const index = mapping[field as FieldKey];
    if (index === undefined || index < 0) return "";
    return keyNormalize(cols[index] ?? "");
  });
  if (values.every((value) => value === "")) return "";
  return hashKey(values);
}

interface ErrorRow {
  line_no: number;
  column_name: string | null;
  value_text: string | null;
  reason: string;
  row_preview: string;
}

interface BatchRow {
  id: string;
  file_name: string;
  status: string;
  stage: string | null;
  parts: PartRef[] | null;
  part_index: number | null;
  part_offset: number | null;
  total_bytes: number | null;
  column_map: Mapping | null;
  delimiter_char: string | null;
  encoding: string | null;
  header_text: string | null;
  dedupe_fields: string[] | null;
  lines_seen: number | null;
  inserted_count: number | null;
  updated_count: number | null;
  rejected_count: number | null;
  row_count: number | null;
  is_active: boolean;
}

async function markBatchFailed(
  admin: ReturnType<typeof createClient>,
  batchId: string,
  message: string,
  actorId: string | null,
  actorName: string | null
): Promise<void> {
  await admin
    .from("caepi_import_batches")
    .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("status", "processing");
  await logEvent(admin, batchId, "import_failed", message, actorId, actorName);
}

async function failStaleBatches(
  admin: ReturnType<typeof createClient>,
  actorId: string | null,
  actorName: string | null
): Promise<void> {
  const cutoff = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();
  const { data } = await admin
    .from("caepi_import_batches")
    .select("id")
    .eq("status", "processing")
    .lt("heartbeat_at", cutoff);
  for (const batch of data ?? []) {
    const batchId = String(batch.id);
    await markBatchFailed(
      admin,
      batchId,
      "O processamento anterior foi interrompido antes de concluir e o lote foi encerrado. Os registros parciais serao descartados ao final da proxima importacao.",
      actorId,
      actorName
    );
  }
}

async function removeParts(
  admin: ReturnType<typeof createClient>,
  parts: PartRef[] | null,
  fallbackPath: string | null
): Promise<void> {
  const paths = (parts ?? []).map((part) => part.path).filter(Boolean);
  if (paths.length === 0 && fallbackPath) paths.push(fallbackPath);
  if (paths.length === 0) return;
  try {
    await admin.storage.from(BUCKET).remove(paths);
  } catch {
    // melhor esforco
  }
}

async function finalizeBatch(
  admin: ReturnType<typeof createClient>,
  batchId: string,
  fileRow: BatchRow,
  actorId: string | null,
  actorName: string | null
): Promise<Response> {
  const { count } = await admin
    .from("caepi_catalog_entries")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  const total = count ?? 0;
  if (total === 0) {
    const message =
      "A validacao terminou sem nenhum registro valido. A base ativa anterior foi preservada. Baixe o relatorio de erros para ver o motivo de cada linha rejeitada.";
    await markBatchFailed(admin, batchId, message, actorId, actorName);
    return jsonResponse({ ok: false, error: "NO_VALID_ROWS", detail: message, batchId }, 200);
  }

  await admin
    .from("caepi_import_batches")
    .update({
      status: "completed",
      stage: "completed",
      row_count: total,
      completed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  // Troca da base ativa em UMA transacao (funcao no banco). Se o lote nao estiver
  // concluido ou estiver vazio, a funcao aborta e a base anterior continua ativa.
  const { error: activateError } = await admin.rpc("caepi_activate_batch", { p_batch_id: batchId });
  if (activateError) {
    const message = `A base foi gravada e validada, mas nao pode ser ativada: ${activateError.message}`;
    await markBatchFailed(admin, batchId, message, actorId, actorName);
    return jsonResponse({ ok: false, error: "ACTIVATION_FAILED", detail: message, batchId }, 200);
  }

  await logEvent(
    admin,
    batchId,
    "activated",
    `Base validada e ativada: ${total} registros gravados (${fileRow.inserted_count ?? 0} inseridos, ${
      fileRow.updated_count ?? 0
    } atualizados, ${fileRow.rejected_count ?? 0} rejeitados na validacao).`,
    actorId,
    actorName
  );

  const { data: completed } = await admin
    .from("caepi_import_batches")
    .select("id, parts, storage_path, file_name")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const oldOnes = (completed ?? []).slice(KEEP_VERSIONS);
  for (const old of oldOnes) {
    const oldId = String(old.id);
    await removeParts(admin, (old.parts as PartRef[] | null) ?? null, old.storage_path ? String(old.storage_path) : null);
    await admin.from("caepi_catalog_entries").delete().eq("batch_id", oldId);
    await admin.from("caepi_import_batches").update({ parts: null, storage_path: "" }).eq("id", oldId);
    await logEvent(
      admin,
      oldId,
      "backup_removed",
      `Versao antiga "${old.file_name}" liberada (mantendo as ${KEEP_VERSIONS} versoes mais recentes).`,
      actorId,
      actorName
    );
  }

  const { data: failed } = await admin
    .from("caepi_import_batches")
    .select("id, parts")
    .neq("status", "completed")
    .eq("is_active", false);
  for (const broken of failed ?? []) {
    const brokenId = String(broken.id);
    await removeParts(admin, (broken.parts as PartRef[] | null) ?? null, null);
    await admin.from("caepi_catalog_entries").delete().eq("batch_id", brokenId);
    await admin
      .from("caepi_import_batches")
      .update({ parts: null, row_count: 0, inserted_count: 0, updated_count: 0 })
      .eq("id", brokenId);
  }

  const { data: sample } = await admin
    .from("caepi_catalog_entries")
    .select("ca, numero_processo, cnpj, razao_social, equipamento, situacao, validade")
    .eq("batch_id", batchId)
    .order("id", { ascending: true })
    .limit(5);

  return jsonResponse({
    ok: true,
    batchId,
    finished: true,
    stage: "completed",
    inserted: fileRow.inserted_count ?? 0,
    updated: fileRow.updated_count ?? 0,
    rejected: fileRow.rejected_count ?? 0,
    rowCount: total,
    bytesRead: fileRow.total_bytes ?? 0,
    totalBytes: fileRow.total_bytes ?? 0,
    partsTotal: (fileRow.parts ?? []).length,
    partIndex: (fileRow.parts ?? []).length,
    partOffset: 0,
    sample: sample ?? [],
  });
}

async function runChunk(
  admin: ReturnType<typeof createClient>,
  batchId: string,
  actorId: string | null,
  actorName: string | null
): Promise<Response> {
  const { data, error } = await admin.from("caepi_import_batches").select("*").eq("id", batchId).maybeSingle();
  const row = data as BatchRow | null;
  if (error || !row) return jsonResponse({ ok: false, error: "BATCH_NOT_FOUND", detail: "Lote nao encontrado." }, 200);

  const parts = Array.isArray(row.parts) ? row.parts : [];
  const mapping = (row.column_map ?? {}) as Mapping;
  const delimiter = row.delimiter_char || ";";
  const headers = splitHeader(row.header_text, delimiter);
  const dedupeFields = row.dedupe_fields && row.dedupe_fields.length > 0 ? row.dedupe_fields : ["ca"];

  if (row.status !== "processing") {
    return jsonResponse({
      ok: true,
      batchId,
      finished: true,
      stage: row.status,
      inserted: row.inserted_count ?? 0,
      updated: row.updated_count ?? 0,
      rejected: row.rejected_count ?? 0,
      rowCount: row.row_count ?? 0,
      bytesRead: row.total_bytes ?? 0,
      totalBytes: row.total_bytes ?? 0,
      partsTotal: parts.length,
      partIndex: row.part_index ?? 0,
      partOffset: Number(row.part_offset ?? 0),
    });
  }

  if (parts.length === 0) {
    const message = "As partes do arquivo nao estao mais disponiveis no armazenamento. Envie o arquivo novamente.";
    await markBatchFailed(admin, batchId, message, actorId, actorName);
    return jsonResponse({ ok: false, error: "PARTS_MISSING", detail: message, batchId }, 200);
  }

  const numericIndexes = Object.values(mapping).filter((v) => typeof v === "number" && v >= 0) as number[];
  const expectedCols = (numericIndexes.length > 0 ? Math.max(...numericIndexes) : 0) + 1;
  const caIndex = mapping.ca;
  const decoder = new TextDecoder(row.encoding || "utf-8");
  const startedAt = Date.now();

  let partIndex = Math.max(0, row.part_index ?? 0);
  let partOffset = Number(row.part_offset ?? 0);
  let lineNo = Number(row.lines_seen ?? 0);
  let inserted = row.inserted_count ?? 0;
  let updated = row.updated_count ?? 0;
  let rejected = row.rejected_count ?? 0;
  let rowsThisCall = 0;
  let dataBuffer: Record<string, unknown>[] = [];
  let errorBuffer: ErrorRow[] = [];
  let wroteSomething = false;
  let rowsFlushed = 0;

  const totalBytes = Number(row.total_bytes ?? parts.reduce((sum, part) => sum + (part.size || 0), 0));

  const pickFrom = (cols: string[], field: FieldKey): string => {
    const index = mapping[field];
    if (index === undefined || index < 0) return "";
    return cols[index] ?? "";
  };

  async function flush(): Promise<void> {
    if (dataBuffer.length > 0) {
      const payload = dataBuffer;
      dataBuffer = [];
      const { data: rpcData, error: rpcError } = await admin.rpc("caepi_upsert_entries", {
        p_batch_id: batchId,
        p_rows: payload,
      });
      if (rpcError) throw new Error(`Falha ao gravar os registros no banco: ${rpcError.message}`);
      const result = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
        | { inserted: number; updated: number; total: number }
        | null;
      inserted += Number(result?.inserted ?? 0);
      updated += Number(result?.updated ?? 0);
      wroteSomething = true;
    }
    if (errorBuffer.length > 0) {
      const errs = errorBuffer;
      errorBuffer = [];
      const { error: errError } = await admin
        .from("caepi_import_errors")
        .insert(errs.map((item) => ({ ...item, batch_id: batchId })));
      if (errError) throw new Error(`Falha ao registrar os erros de validacao: ${errError.message}`);
      wroteSomething = true;
    }
  }

  async function persistPosition(): Promise<void> {
    await admin
      .from("caepi_import_batches")
      .update({
        part_index: partIndex,
        part_offset: partOffset,
        lines_seen: lineNo,
        inserted_count: inserted,
        updated_count: updated,
        rejected_count: rejected,
        row_count: inserted + updated,
        resume_offset: partOffset,
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", batchId);
  }

  function registerError(cols: string[], reason: string, columnName: string | null, value: string): void {
    rejected += 1;
    if (rejected > MAX_STORED_ERRORS) return;
    errorBuffer.push({
      line_no: lineNo,
      column_name: columnName,
      value_text: value.slice(0, 300),
      reason,
      row_preview: cols.join(delimiter).slice(0, 300),
    });
  }

  function pushDataRow(cols: string[], dedupeKey: string): void {
    const situacao = pickFrom(cols, "situacao");
    const caRaw = caIndex !== undefined && caIndex >= 0 ? (cols[caIndex] ?? "") : "";
    dataBuffer.push({
      ca: caRaw,
      ca_normalized: digitsOnly(caRaw),
      numero_processo: pickFrom(cols, "numero_processo") || null,
      cnpj: pickFrom(cols, "cnpj") || null,
      razao_social: pickFrom(cols, "razao_social") || null,
      equipamento: pickFrom(cols, "equipamento") || null,
      descricao: pickFrom(cols, "descricao") || null,
      situacao: situacao || null,
      ativo: guessAtivo(situacao),
      validade: pickFrom(cols, "validade") || null,
      dedupe_key: dedupeKey,
    });
    rowsThisCall += 1;
  }

  try {
    while (rowsThisCall < MAX_ROWS_PER_CALL && Date.now() - startedAt < TIME_BUDGET_MS) {
      if (partIndex >= parts.length) break;
      const part = parts[partIndex];
      const partSize = Number(part.size || 0);
      if (partOffset >= partSize) {
        partIndex += 1;
        partOffset = 0;
        await persistPosition();
        continue;
      }

      let { bytes } = await readWindow(part.path, partOffset, WINDOW_BYTES);
      if (bytes.length === 0) {
        partIndex += 1;
        partOffset = 0;
        await persistPosition();
        continue;
      }

      let lastBreak = -1;
      for (let i = bytes.length - 1; i >= 0; i -= 1) {
        if (bytes[i] === 0x0a) {
          lastBreak = i;
          break;
        }
      }
      if (lastBreak === -1 && partOffset + bytes.length < partSize) {
        const rest = await readWindow(part.path, partOffset, Math.max(partSize - partOffset, WINDOW_BYTES));
        bytes = rest.bytes;
        lastBreak = bytes.length - 1;
      }
      const consume = lastBreak >= 0 ? lastBreak + 1 : bytes.length;
      const block = bytes.subarray(0, consume);
      const atVeryStart = partIndex === 0 && partOffset === 0;

      let start = 0;
      for (let pos = 0; pos < block.length; pos += 1) {
        if (block[pos] !== 0x0a) continue;
        let end = pos;
        if (end > start && block[end - 1] === 0x0d) end -= 1;
        const rawLine = decoder.decode(block.subarray(start, end));
        start = pos + 1;
        lineNo += 1;

        if (atVeryStart && lineNo === 1) continue;
        if (!rawLine.trim()) continue;
        const cols = parseCsvLine(rawLine, delimiter);

        if (cols.length < expectedCols) {
          registerError(
            cols,
            `Linha com ${cols.length} coluna(s); o mapeamento confirmado espera ${expectedCols}.`,
            null,
            ""
          );
          continue;
        }

        const caRaw = caIndex !== undefined && caIndex >= 0 ? (cols[caIndex] ?? "") : "";
        const caHeader = caIndex !== undefined && caIndex >= 0 ? headers[caIndex] : null;
        if (!caRaw) {
          registerError(cols, "Numero do CA vazio.", caHeader ?? "CA", "");
          continue;
        }
        if (digitsOnly(caRaw).length === 0) {
          registerError(cols, "Numero do CA sem nenhum digito - valor nao e um CA valido.", caHeader ?? "CA", caRaw);
          continue;
        }
        if (caHeader && keyNormalize(caRaw) === keyNormalize(caHeader)) {
          registerError(cols, "Linha de cabecalho repetida no meio do arquivo.", caHeader, caRaw);
          continue;
        }

        const dedupeKey = buildDedupeKey(cols, mapping, dedupeFields);
        if (!dedupeKey) {
          registerError(cols, `Chave de identificacao vazia (campos: ${dedupeFields.join(" + ")}).`, null, "");
          continue;
        }

        pushDataRow(cols, dedupeKey);
        if (dataBuffer.length >= CHUNK_ROWS) {
          rowsFlushed += dataBuffer.length;
          await flush();
        }
        if (rowsThisCall >= MAX_ROWS_PER_CALL) break;
      }

      if (start < block.length && partOffset + consume >= partSize) {
        const tail = decoder.decode(block.subarray(start));
        if (tail.trim()) {
          const cols = parseCsvLine(tail, delimiter);
          lineNo += 1;
          const caRaw = caIndex !== undefined && caIndex >= 0 ? (cols[caIndex] ?? "") : "";
          const dedupeKey = buildDedupeKey(cols, mapping, dedupeFields);
          if (!caRaw || !dedupeKey) {
            registerError(cols, !caRaw ? "Numero do CA vazio." : "Chave de identificacao vazia.", null, "");
          } else {
            pushDataRow(cols, dedupeKey);
          }
        }
      }

      partOffset += consume;
      if (partOffset >= partSize) {
        partIndex += 1;
        partOffset = 0;
      }
      rowsFlushed += dataBuffer.length;
      await flush();
      await persistPosition();
    }

    rowsFlushed += dataBuffer.length;
    await flush();
    await persistPosition();

    if (partIndex >= parts.length) {
      return await finalizeBatch(
        admin,
        batchId,
        { ...row, inserted_count: inserted, updated_count: updated, rejected_count: rejected },
        actorId,
        actorName
      );
    }

    if (!wroteSomething && rowsThisCall === 0) {
      const message =
        "O processamento nao avancou nesta rodada (nenhuma linha completa foi lida). O lote foi encerrado para evitar importacao incompleta. Verifique o separador e o encoding confirmados.";
      await markBatchFailed(admin, batchId, message, actorId, actorName);
      return jsonResponse({ ok: false, error: "IMPORT_STALLED", detail: message, batchId }, 200);
    }

    const consumedBefore = parts.slice(0, partIndex).reduce((sum, part) => sum + Number(part.size || 0), 0);
    return jsonResponse({
      ok: true,
      batchId,
      finished: false,
      stage: "importing",
      inserted,
      updated,
      rejected,
      rowCount: inserted + updated,
      bytesRead: consumedBefore + partOffset,
      totalBytes,
      partsTotal: parts.length,
      partIndex,
      partOffset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha inesperada durante a importacao.";
    await markBatchFailed(admin, batchId, message, actorId, actorName);
    return jsonResponse({ ok: false, error: "IMPORT_FAILED", detail: message, batchId }, 200);
  }
}

async function handleStart(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  actorId: string | null,
  actorName: string | null
): Promise<Response> {
  await failStaleBatches(admin, actorId, actorName);

  const rawParts = Array.isArray(body.parts) ? (body.parts as PartRef[]) : [];
  const parts = rawParts
    .filter((part) => part && typeof part.path === "string" && part.path.length > 0)
    .map((part) => ({ path: part.path, size: Number(part.size ?? 0) }));
  if (parts.length === 0) {
    return jsonResponse({ ok: false, error: "MISSING_PARTS", detail: "Nenhuma parte do arquivo foi enviada." }, 200);
  }
  if (parts.some((part) => !(part.size > 0))) {
    return jsonResponse({ ok: false, error: "EMPTY_PARTS", detail: "Alguma parte do arquivo chegou vazia." }, 200);
  }

  const mapping = (body.mapping ?? {}) as Mapping;
  if (mapping.ca === undefined || mapping.ca < 0) {
    return jsonResponse(
      {
        ok: false,
        error: "MISSING_CA_COLUMN",
        detail: "O mapeamento precisa indicar qual coluna contem o numero do CA.",
      },
      200
    );
  }

  const dedupeFields = (Array.isArray(body.dedupeFields) ? body.dedupeFields : ["ca"])
    .map((field) => String(field))
    .filter((field) => (FIELDS as readonly string[]).includes(field));
  if (dedupeFields.length === 0) dedupeFields.push("ca");

  const fileName = String(body.fileName ?? "base-caepi.csv");
  const totalBytes = Number(body.totalBytes ?? parts.reduce((sum, part) => sum + part.size, 0));
  const delimiter = String(body.delimiter ?? ";");
  const encoding = String(body.encoding ?? "utf-8");
  const headerText = body.header ? String(body.header) : null;

  const { data, error } = await admin
    .from("caepi_import_batches")
    .insert({
      file_name: fileName,
      file_size: totalBytes,
      storage_path: parts[0].path,
      status: "processing",
      stage: "importing",
      row_count: 0,
      resume_offset: 0,
      source_is_gzip: false,
      uploaded_by: actorId,
      uploaded_by_name: actorName,
      parts,
      part_index: 0,
      part_offset: 0,
      total_bytes: totalBytes,
      column_map: mapping,
      delimiter_char: delimiter,
      encoding,
      header_text: headerText,
      dedupe_fields: dedupeFields,
      mapping_confirmed: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return jsonResponse({ ok: false, error: "BATCH_CREATE_FAILED", detail: error?.message }, 200);
  }
  const batchId = String(data.id);

  await logEvent(
    admin,
    batchId,
    "upload_started",
    `Arquivo ${fileName} recebido em ${parts.length} parte(s) (${totalBytes} bytes). Encoding confirmado: ${encoding}; separador: ${
      delimiter === "\t" ? "TAB" : delimiter
    }; chave de identificacao: ${dedupeFields.join(" + ")}.`,
    actorId,
    actorName
  );

  return runChunk(admin, batchId, actorId, actorName);
}

async function listAllObjects(admin: ReturnType<typeof createClient>, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error || !data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        const children = await listAllObjects(admin, full);
        out.push(...children);
      } else {
        out.push(full);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function handleCleanup(
  admin: ReturnType<typeof createClient>,
  actorId: string | null,
  actorName: string | null
): Promise<Response> {
  const { data: batches } = await admin.from("caepi_import_batches").select("storage_path, parts, status, is_active");

  const referenced = new Set<string>();
  for (const batch of batches ?? []) {
    const protectedBatch = Boolean(batch.is_active) || batch.status === "processing" || batch.status === "completed";
    if (!protectedBatch) continue;
    if (batch.storage_path) referenced.add(String(batch.storage_path));
    for (const part of (batch.parts as PartRef[] | null) ?? []) {
      if (part?.path) referenced.add(String(part.path));
    }
  }

  const all = await listAllObjects(admin);
  const orphans = all.filter((path) => !referenced.has(path));

  const removed: string[] = [];
  for (let i = 0; i < orphans.length; i += 100) {
    const slice = orphans.slice(i, i + 100);
    const { error } = await admin.storage.from(BUCKET).remove(slice);
    if (!error) removed.push(...slice);
  }

  await admin.from("caepi_import_batches").update({ parts: null }).not("status", "in", "(completed,processing)");

  const detail =
    removed.length > 0
      ? `${removed.length} arquivo(s) orfao(s) removido(s) do armazenamento (tentativas anteriores que falharam/cancelaram).`
      : "Nenhum arquivo orfao encontrado no armazenamento - nada a remover.";
  await logEvent(admin, null, "cleanup_orphans", detail, actorId, actorName);

  return jsonResponse({ ok: true, removed: removed.length, detail });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: "SERVER_NOT_CONFIGURED" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
    }

    // ---- AUTORIZACAO REAL -------------------------------------------------
    // Somente o Superadministrador da plataforma pode importar, retomar, cancelar
    // ou ativar versoes do catalogo. O ator vem do JWT, nunca do corpo da requisicao.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ ok: false, error: "AUTH_REQUIRED", detail: "Entre com uma conta real." }, 401);
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) return jsonResponse({ ok: false, error: "SERVER_NOT_CONFIGURED" }, 500);

    // Cliente anon: usado APENAS para validar o JWT do chamador.
    const authClient = createClient(SUPABASE_URL, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.replace(/^bearer\s+/i, "");
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const user = userData?.user ?? null;
    if (userError || !user) {
      return jsonResponse({ ok: false, error: "INVALID_SESSION", detail: "Sessao invalida ou expirada." }, 401);
    }

    // Cliente de service role: checks privilegiados e gravacao.
    const { data: platformAdmin } = await admin
      .from("platform_admins")
      .select("auth_user_id, name, email, status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!platformAdmin || platformAdmin.status !== "active") {
      await admin.from("caepi_import_logs").insert({
        batch_id: null,
        action: "access_denied",
        detail: "Tentativa de operar a base CAEPI sem vinculo ativo de Superadministrador da plataforma.",
        actor_id: user.id,
        actor_name: user.email ?? "Conta sem permissao",
      });
      return jsonResponse({
        ok: false,
        error: "NOT_PLATFORM_ADMIN",
        detail: "A base CAEPI e central: somente o Superadministrador da plataforma pode importar, retomar, cancelar ou ativar versoes.",
      }, 403);
    }

    const action = String(body.action ?? "start");
    const actorId = user.id;
    const actorName = platformAdmin.name ?? platformAdmin.email ?? user.email ?? "Superadministrador";

    if (action === "continue") {
      const batchId = String(body.batchId ?? "");
      if (!batchId) return jsonResponse({ ok: false, error: "MISSING_BATCH_ID" }, 400);
      return await runChunk(admin, batchId, actorId, actorName);
    }
    if (action === "resume") {
      const batchId = String(body.batchId ?? "");
      if (!batchId) return jsonResponse({ ok: false, error: "MISSING_BATCH_ID" }, 400);
      await admin
        .from("caepi_import_batches")
        .update({ status: "processing", error_message: null, heartbeat_at: new Date().toISOString() })
        .eq("id", batchId);
      await logEvent(admin, batchId, "import_resumed", "Importacao retomada do ponto onde parou.", actorId, actorName);
      return await runChunk(admin, batchId, actorId, actorName);
    }
    if (action === "cancel") {
      const batchId = String(body.batchId ?? "");
      if (!batchId) return jsonResponse({ ok: false, error: "MISSING_BATCH_ID" }, 400);
      await admin
        .from("caepi_import_batches")
        .update({
          status: "failed",
          error_message: "Importacao cancelada pelo Superadministrador. As partes do arquivo foram mantidas para retomada.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", batchId)
        .eq("status", "processing");
      await logEvent(admin, batchId, "upload_cancelled", "Importacao cancelada antes de concluir.", actorId, actorName);
      return jsonResponse({ ok: true });
    }
    if (action === "cleanup_orphans") return await handleCleanup(admin, actorId, actorName);
    if (action === "start") return await handleStart(admin, body, actorId, actorName);

    return jsonResponse({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha inesperada ao processar o arquivo.";
    return jsonResponse({ ok: false, error: "UNEXPECTED", detail: message }, 200);
  }
});
