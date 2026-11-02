export type CaepiFieldKey =
  | "ca"
  | "numero_processo"
  | "cnpj"
  | "razao_social"
  | "equipamento"
  | "descricao"
  | "situacao"
  | "validade";

export interface CaepiFieldDef {
  key: CaepiFieldKey;
  label: string;
  hint?: string;
}

export const CAEPI_FIELDS: CaepiFieldDef[] = [
  { key: "ca", label: "Número do CA", hint: "Obrigatório — identifica o Certificado de Aprovação." },
  { key: "numero_processo", label: "Nº do processo", hint: "Usado na chave de identificação." },
  { key: "cnpj", label: "CNPJ do fabricante/importador" },
  { key: "razao_social", label: "Razão social" },
  { key: "equipamento", label: "Equipamento" },
  { key: "descricao", label: "Descrição" },
  { key: "situacao", label: "Situação do CA" },
  { key: "validade", label: "Validade" },
];

export type CaepiMapping = Partial<Record<CaepiFieldKey, number>>;

export interface CaepiPart {
  blob: Blob;
  size: number;
}

export interface CaepiAnalysis {
  fileName: string;
  fileSize: number;
  isGzip: boolean;
  encoding: "utf-8" | "windows-1252";
  encodingWarning: string | null;
  delimiter: string;
  headers: string[];
  headerLine: string;
  previewRows: string[][];
  /** Primeiras linhas brutas (cabeçalho + amostra), para reprocessar quando o separador muda. */
  rawLines: string[];
  totalBytes: number;
  parts: CaepiPart[];
}

export interface CaepiSampleRow {
  ca: string;
  numero_processo: string | null;
  cnpj: string | null;
  razao_social: string | null;
  equipamento: string | null;
  situacao: string | null;
  validade: string | null;
}

export interface CaepiErrorRow {
  line_no: number | null;
  column_name: string | null;
  value_text: string | null;
  reason: string;
  row_preview: string | null;
}

export const DELIMITER_OPTIONS: { value: string; label: string }[] = [
  { value: ";", label: "Ponto e vírgula ( ; )" },
  { value: ",", label: "Vírgula ( , )" },
  { value: "\t", label: "Tabulação ( TAB )" },
  { value: "|", label: "Pipe ( | )" },
];