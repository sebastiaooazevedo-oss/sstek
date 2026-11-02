import type { DocumentStatus } from "@/mocks/documents";

export type FileKind = "pdf" | "docx" | "xlsx" | "img";

export const PERMANENT_EXPIRY = "—";

/** Janela (em dias) em que o documento passa a ser sinalizado como "Vencendo". */
export const EXPIRY_WARNING_DAYS = 30;

/** Janela (em dias) considerada pelo painel de alertas de vencimento. */
export const EXPIRY_ALERT_DAYS = 60;

/**
 * Interpreta datas de validade nos formatos usados no sistema:
 * "dd/mm/aaaa" (padrão de exibição) e "aaaa-mm-dd" (input de data).
 * Devolve null para vazio, "—" ou data inválida.
 */
export function parseValidityDate(value: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === PERMANENT_EXPIRY) return null;

  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]) - 1;
    const year = Number(br[3]);
    const date = new Date(year, month, day);
    const valid =
      date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
    return valid ? date : null;
  }

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const date = new Date(year, month, day);
    const valid =
      date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
    return valid ? date : null;
  }

  return null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Dias restantes até o vencimento (negativo quando já venceu).
 * Devolve null quando o documento não tem validade (permanente).
 */
export function daysUntilExpiry(expiresAt: string): number | null {
  const target = parseValidityDate(expiresAt);
  if (!target) return null;
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end.getTime() - startOfToday().getTime()) / (1000 * 60 * 60 * 24));
}

export function computeStatus(
  expiresAt: string,
  warningDays: number = EXPIRY_WARNING_DAYS
): DocumentStatus {
  const days = daysUntilExpiry(expiresAt);
  if (days === null) return "Em dia";
  if (days < 0) return "Vencido";
  const windowDays = Number.isFinite(warningDays) ? Math.max(1, Math.round(warningDays)) : EXPIRY_WARNING_DAYS;
  if (days <= windowDays) return "Vencendo";
  return "Em dia";
}

/** Rótulo humano dos dias restantes (ou em atraso). */
export function expiryDaysLabel(days: number): string {
  if (days < 0) return `Vencido há ${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"}`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

/** Documentos sem data de validade são tratados como permanentes. */
export function isPermanentDocument(expiresAt: string): boolean {
  return daysUntilExpiry(expiresAt) === null;
}

/**
 * Tipos de documento que são REGISTRO DE UM FATO DATADO: não possuem data de
 * validade e não podem ser substituídos por uma versão nova.
 *
 * Uma ata, um edital de resultado, um termo de posse, um dossiê eleitoral, uma
 * ordem de serviço, uma aferição, um DDS, uma ficha de presença, uma inspeção
 * de campo ou um atestado médico atestam algo que aconteceu numa data. Trocar
 * o arquivo por outro descaracteriza o registro — o caminho é emitir um novo
 * documento, não substituir o anterior.
 */
export const NO_VALIDITY_TYPE_IDS: readonly string[] = [
  "ata-cipa",
  "ata-resultado-cipa",
  "edital-resultado-cipa",
  "termo-posse-cipa",
  "dossie-cipa",
  "ordem-servico",
  "afericoes",
  "dds",
  "ficha-presenca",
  "inspecao-campo",
  "atestado-medico",
];

/** Pistas de nome usadas para reconhecer registros antigos pelo título. */
const NO_VALIDITY_NAME_HINTS: RegExp[] = [
  /^ata\b/,
  /^edital de resultado/,
  /^termo de posse/,
  /^dossi[eê]/, 
  /^ordem de servi[çc]o/,
  /^aferi/,
  /^dds\b/,
  /^ficha de presen/,
  /^inspe[çc][ãa]o de campo/,
  /^atestado m[ée]dico/,
];

/**
 * Indica se o tipo do documento é um registro datado — sem validade e sem
 * possibilidade de substituição.
 */
export function isTypeWithoutValidity(
  typeId?: string | null,
  typeName?: string | null
): boolean {
  if (typeId && NO_VALIDITY_TYPE_IDS.includes(typeId)) return true;
  if (!typeName) return false;
  const name = typeName.trim().toLowerCase();
  return NO_VALIDITY_NAME_HINTS.some((pattern) => pattern.test(name));
}

/**
 * Peças de um PROCESSO ELEITORAL da CIPA (pleito).
 *
 * O edital de convocação abre um pleito com data e hora para começar e
 * terminar: ele não é um documento que se renova nem que se troca. Encerrado o
 * pleito, o caminho é abrir um NOVO processo eleitoral e emitir um novo edital
 * — por isso essas peças não entram na fila de renovação nem na substituição.
 *
 * Diferente dos registros datados ({@link NO_VALIDITY_TYPE_IDS}), a peça de
 * pleito mantém a sua janela de validade (o prazo do processo), para continuar
 * aparecendo nos controles de prazo enquanto o pleito corre.
 */
export const ELECTION_DOSSIER_TYPE_IDS: readonly string[] = ["edital-cipa"];

/** Pistas de nome usadas para reconhecer peças de pleito antigas pelo título. */
const ELECTION_DOSSIER_NAME_HINTS: RegExp[] = [/^edital de convoca/];

/** Indica se o documento é uma peça de processo eleitoral da CIPA. */
export function isElectionDossierDocument(
  typeId?: string | null,
  typeName?: string | null
): boolean {
  if (typeId && ELECTION_DOSSIER_TYPE_IDS.includes(typeId)) return true;
  if (!typeName) return false;
  const name = typeName.trim().toLowerCase();
  return ELECTION_DOSSIER_NAME_HINTS.some((pattern) => pattern.test(name));
}

/**
 * O documento pode entrar na fila de renovação?
 *
 * Registros datados (sem validade) e peças de pleito da CIPA nunca renovam.
 */
export function canRequestRenewal(doc: {
  typeId: string;
  typeName?: string;
}): boolean {
  if (isTypeWithoutValidity(doc.typeId, doc.typeName)) return false;
  return !isElectionDossierDocument(doc.typeId, doc.typeName);
}

/** O documento aceita ser substituído por uma versão nova? */
export function canBeReplaced(doc: {
  typeId: string;
  typeName?: string;
  supersededByRef?: string;
}): boolean {
  if (doc.supersededByRef) return false;
  // Peça de pleito não é substituída: encerrado o processo, emite-se um novo
  // edital dentro de um novo processo eleitoral.
  if (isElectionDossierDocument(doc.typeId, doc.typeName)) return false;
  return !isTypeWithoutValidity(doc.typeId, doc.typeName);
}

export type ValidityBucket = "valido" | "vencido" | "permanente";

/** Classifica o documento para os filtros de validade (válidos/vencidos/permanentes). */
export function validityBucket(expiresAt: string, status: DocumentStatus): ValidityBucket {
  if (isPermanentDocument(expiresAt)) return "permanente";
  return status === "Vencido" ? "vencido" : "valido";
}

export function fileTypeFromName(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "docx";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xlsx";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "img";
  return "pdf";
}

export function formatDateInput(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Converte uma data de validade (dd/mm/aaaa) para o formato do input date. */
export function toDateInputValue(value: string): string {
  const date = parseValidityDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export const fileIcon: Record<FileKind, string> = {
  pdf: "ri-file-pdf-2-line",
  docx: "ri-file-word-2-line",
  xlsx: "ri-file-excel-2-line",
  img: "ri-image-line",
};

export const fileIconTone: Record<FileKind, string> = {
  pdf: "bg-accent-100 text-accent-700",
  docx: "bg-secondary-100 text-secondary-800",
  xlsx: "bg-primary-100 text-primary-700",
  img: "bg-background-200 text-foreground-600",
};