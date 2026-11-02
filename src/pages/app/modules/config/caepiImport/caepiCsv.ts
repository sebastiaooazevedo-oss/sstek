import { Inflate } from "fflate";
import type { CaepiAnalysis, CaepiErrorRow, CaepiFieldKey, CaepiMapping, CaepiPart } from "./types";
import { CAEPI_FIELDS } from "./types";

/** Tamanho de cada parte enviada ao armazenamento (bem abaixo do limite de objeto). */
const PART_SIZE = 20 * 1024 * 1024;
/** Quantidade de bytes usada na prévia/mapeamento (só o começo do arquivo). */
const PREVIEW_BYTES = 512 * 1024;
const MEMBER_CHUNK = 1 << 18;

function sleep(ms = 0): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Parser CSV com suporte a aspas e separador configurável. Preserva o valor original. */
export function parseCsvLine(line: string, delimiter: string): string[] {
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

function countOutsideQuotes(line: string, delimiter: string): number {
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') i += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

/** Identifica o separador com base no cabeçalho (o usuário confirma no passo de mapeamento). */
export function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ";";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = countOutsideQuotes(headerLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return bestCount === 0 ? ";" : best;
}

/** Detecta se o arquivo realmente está em UTF-8 (e avisa quando não está). */
export function detectEncoding(preview: Uint8Array): { encoding: "utf-8" | "windows-1252"; warning: string | null } {
  if (preview.length === 0) return { encoding: "utf-8", warning: null };
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(preview);
    return { encoding: "utf-8", warning: null };
  } catch {
    const trimmed = preview.subarray(0, Math.max(0, preview.length - 8));
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(trimmed);
      return { encoding: "utf-8", warning: null };
    } catch {
      return {
        encoding: "windows-1252",
        warning:
          "O arquivo não está em UTF-8 (provavelmente ISO-8859-1/Windows-1252). Vamos ler usando Windows-1252 para não corromper acentos. Se possível, salve novamente como CSV UTF-8.",
      };
    }
  }
}

function gzipHeaderLength(bytes: Uint8Array, off: number): number {
  if (off + 3 > bytes.length || bytes[off] !== 0x1f || bytes[off + 1] !== 0x8b || bytes[off + 2] !== 8) {
    throw new Error("Assinatura gzip ausente no início do bloco compactado.");
  }
  const flg = bytes[off + 3];
  let st = 10;
  if (flg & 4) {
    if (off + 12 > bytes.length) throw new Error("Cabeçalho gzip incompleto.");
    st += (bytes[off + 10] | (bytes[off + 11] << 8)) + 2;
  }
  for (let zs = ((flg >> 3) & 1) + ((flg >> 4) & 1); zs > 0; zs -= bytes[off + st++] === 0 ? 1 : 0) {
    if (off + st > bytes.length) throw new Error("Cabeçalho gzip incompleto.");
  }
  return st + (flg & 2);
}

/**
 * Descompacta o ".gz" oficial (que é um gzip com vários blocos concatenados) e já monta as
 * partes de 20 MB que serão enviadas ao servidor. Feito no navegador de propósito: assim o
 * servidor nunca precisa descompactar 151 MB dentro de um worker com memória limitada.
 */
export async function decompressGzipToParts(
  bytes: Uint8Array,
  onProgress: (pct: number) => void
): Promise<{ parts: CaepiPart[]; preview: Uint8Array; totalBytes: number }> {
  const parts: CaepiPart[] = [];
  const previewChunks: Uint8Array[] = [];
  let previewSize = 0;
  let pending: Uint8Array[] = [];
  let pendingSize = 0;
  let totalBytes = 0;

  const sink = (chunk: Uint8Array): void => {
    if (!chunk || chunk.byteLength === 0) return;
    const copy = chunk.slice();
    pending.push(copy);
    pendingSize += copy.byteLength;
    totalBytes += copy.byteLength;
    if (previewSize < PREVIEW_BYTES) {
      const take = copy.subarray(0, Math.min(copy.byteLength, PREVIEW_BYTES - previewSize));
      previewChunks.push(take.slice());
      previewSize += take.byteLength;
    }
    if (pendingSize >= PART_SIZE) {
      parts.push({ blob: new Blob(pending, { type: "text/csv" }), size: pendingSize });
      pending = [];
      pendingSize = 0;
    }
  };

  let pos = 0;
  let members = 0;
  while (pos + 3 <= bytes.length) {
    if (!(bytes[pos] === 0x1f && bytes[pos + 1] === 0x8b && bytes[pos + 2] === 8)) break;
    const headerLen = gzipHeaderLength(bytes, pos);
    const dataStart = pos + headerLen;
    const inflate = new Inflate((chunk: Uint8Array) => sink(chunk));
    let fed = 0;
    let deflateEnd = -1;

    for (let i = dataStart; i < bytes.length; i += MEMBER_CHUNK) {
      const slice = bytes.subarray(i, Math.min(i + MEMBER_CHUNK, bytes.length));
      fed += slice.byteLength;
      inflate.push(slice, false);

      const state = (inflate as unknown as { s: { f?: number; l?: unknown; p?: number } }).s;
      if (state.f && !state.l) {
        const leftover = (inflate as unknown as { p: Uint8Array }).p.length;
        const residue = (state.p ?? 0) & 7;
        deflateEnd = dataStart + (fed - leftover) + (residue ? 1 : 0);
        break;
      }
      if ((i / MEMBER_CHUNK) % 32 === 0) {
        onProgress(Math.min(99, Math.round((i / bytes.length) * 100)));
        await sleep(0);
      }
    }

    if (deflateEnd < 0) {
      throw new Error(
        "Não foi possível descompactar o arquivo: o bloco DEFLATE terminou de forma inesperada (arquivo truncado?). Baixe novamente o arquivo do portal do CAEPI."
      );
    }
    pos = deflateEnd + 8;
    members += 1;
  }

  if (members === 0) {
    throw new Error("O arquivo .gz não contém nenhum bloco gzip válido.");
  }
  if (pendingSize > 0) {
    parts.push({ blob: new Blob(pending, { type: "text/csv" }), size: pendingSize });
  }
  if (parts.length === 0) {
    throw new Error("O arquivo compactado está vazio.");
  }
  onProgress(100);

  let totalPreview = 0;
  for (const chunk of previewChunks) totalPreview += chunk.byteLength;
  const preview = new Uint8Array(totalPreview);
  let offset = 0;
  for (const chunk of previewChunks) {
    preview.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { parts, preview, totalBytes };
}

function sliceFileIntoParts(file: File): CaepiPart[] {
  const parts: CaepiPart[] = [];
  for (let offset = 0; offset < file.size; offset += PART_SIZE) {
    const end = Math.min(offset + PART_SIZE, file.size);
    parts.push({ blob: file.slice(offset, end), size: end - offset });
  }
  return parts;
}

/** Sugere o mapeamento coluna do arquivo -> campo do sistema a partir do cabeçalho. */
export function autoMapping(headers: string[]): CaepiMapping {
  const normalized = headers.map(normalizeHeader);
  const find = (test: (header: string) => boolean, exclude?: (header: string) => boolean): number => {
    for (let i = 0; i < normalized.length; i += 1) {
      const header = normalized[i];
      if (test(header) && !(exclude ? exclude(header) : false)) return i;
    }
    return -1;
  };

  const caNoise = (header: string) => /VALIDADE|SITUACAO|PROCESSO|OBSERVACAO/.test(header);
  let ca = find((header) => header === "CA");
  if (ca === -1) ca = find((header) => /\bCA\b/.test(header), caNoise);

  return {
    ca,
    numero_processo: find((header) => /PROCESSO/.test(header)),
    cnpj: find((header) => /CNPJ/.test(header)),
    razao_social: find((header) => /RAZAO/.test(header)),
    equipamento: find((header) => /EQUIPAMENTO|EQUIPTO/.test(header) && !/DESCRICAO/.test(header)),
    descricao: find((header) => /DESCRICAO/.test(header)),
    situacao: find((header) => /SITUACAO/.test(header)),
    validade: find((header) => /VALIDADE|VENCIMENTO/.test(header)),
  };
}

export interface CaepiAnalyzeProgress {
  message: string;
  pct: number | null;
}

/** Lê o começo do arquivo, identifica encoding/separador e prepara as partes do envio. */
export async function analyzeCaepiFile(
  file: File,
  onProgress: (progress: CaepiAnalyzeProgress) => void
): Promise<CaepiAnalysis> {
  const lower = file.name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  const isGzip =
    lower.endsWith(".gz") || (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b);

  let parts: CaepiPart[];
  let preview: Uint8Array;
  let totalBytes: number;

  if (isGzip) {
    onProgress({ message: "Descompactando o arquivo .gz no navegador…", pct: 0 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await decompressGzipToParts(bytes, (pct) =>
      onProgress({ message: "Descompactando o arquivo .gz no navegador…", pct })
    );
    parts = result.parts;
    preview = result.preview;
    totalBytes = result.totalBytes;
  } else {
    onProgress({ message: "Preparando as partes do arquivo…", pct: null });
    parts = sliceFileIntoParts(file);
    preview = new Uint8Array(await file.slice(0, PREVIEW_BYTES).arrayBuffer());
    totalBytes = file.size;
  }

  const { encoding, warning } = detectEncoding(preview);
  const text = new TextDecoder(encoding).decode(preview).replace(/^\uFEFF/, "");
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0] ?? "";
  const delimiter = detectDelimiter(headerLine);
  const headers = parseCsvLine(headerLine, delimiter);
  const previewRows = lines.slice(1, 6).map((line) => parseCsvLine(line, delimiter));
  return {
    fileName: file.name,
    fileSize: file.size,
    isGzip,
    encoding,
    encodingWarning: warning,
    delimiter,
    headers,
    headerLine,
    previewRows,
    rawLines: lines.slice(0, 6),
    totalBytes,
    parts,
  };
}

/** Gera o CSV do relatório de erros (para download). */
export function buildErrorReportCsv(rows: CaepiErrorRow[]): string {
  const escape = (value: string): string => `"${(value ?? "").replace(/"/g, '""')}"`;
  const lines = ["Linha;Coluna;Valor;Motivo;Conteudo da linha"];
  for (const row of rows) {
    lines.push(
      [
        escape(String(row.line_no ?? "")),
        escape(row.column_name ?? ""),
        escape(row.value_text ?? ""),
        escape(row.reason ?? ""),
        escape(row.row_preview ?? ""),
      ].join(";")
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export const CAEPI_FIELD_KEYS: CaepiFieldKey[] = CAEPI_FIELDS.map((field) => field.key);