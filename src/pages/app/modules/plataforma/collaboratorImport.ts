import * as XLSX from "xlsx";

/**
 * Leitura, validação e modelo da planilha de colaboradores usada pelo
 * Superadministrador para subir uma base inteira para uma empresa.
 *
 * O arquivo pode ser `.csv` (separado por `;`, `,` ou tabulação) ou `.xlsx`.
 * A primeira linha é sempre o cabeçalho. O reconhecimento das colunas aceita
 * variações em português (com ou sem acento) e os nomes em inglês.
 */

export type ImportFieldKey =
  | "name"
  | "cpf"
  | "matricula"
  | "roleFunction"
  | "area"
  | "establishment"
  | "rg"
  | "pis"
  | "ctps"
  | "admissionDate"
  | "birthDate"
  | "phone"
  | "email"
  | "city"
  | "status"
  | "ref";

export interface ImportFieldDefinition {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  description: string;
  example: string;
}

export const importFields: ImportFieldDefinition[] = [
  { key: "name", label: "Nome completo", required: true, description: "Nome do colaborador como aparece na ficha.", example: "Marcos Aurélio Ferraz" },
  { key: "cpf", label: "CPF", required: true, description: "Chave de deduplicação da base. Pode vir com ou sem pontuação.", example: "412.887.930-05" },
  { key: "matricula", label: "Matrícula", required: false, description: "Código interno do colaborador na empresa.", example: "001284" },
  { key: "roleFunction", label: "Função", required: false, description: "Cargo exercido pelo colaborador.", example: "Operador de empilhadeira" },
  { key: "area", label: "Área / setor", required: false, description: "Setor ao qual o colaborador pertence.", example: "Logística" },
  { key: "establishment", label: "Estabelecimento", required: false, description: "Unidade/filial usada nas eleições e relatórios da CIPA.", example: "Matriz — Guarulhos" },
  { key: "rg", label: "RG", required: false, description: "Documento de identidade.", example: "38.224.115-7" },
  { key: "pis", label: "PIS / NIS", required: false, description: "Número do PIS ou NIS.", example: "120.88471.22-9" },
  { key: "ctps", label: "CTPS", required: false, description: "Carteira de trabalho e previdência social.", example: "44102/0231" },
  { key: "admissionDate", label: "Admissão", required: false, description: "Data em texto (DD/MM/AAAA).", example: "12/03/2024" },
  { key: "birthDate", label: "Nascimento", required: false, description: "Data em texto (DD/MM/AAAA).", example: "07/09/1991" },
  { key: "phone", label: "Celular", required: false, description: "Telefone com DDD.", example: "(11) 98842-7710" },
  { key: "email", label: "E-mail", required: false, description: "E-mail corporativo ou pessoal.", example: "marcos.ferraz@empresa.com.br" },
  { key: "city", label: "Cidade / UF", required: false, description: "Cidade e estado.", example: "Guarulhos/SP" },
  { key: "status", label: "Situação", required: false, description: "Ativo por padrão. Inativo/Desligado entra como colaborador inativo.", example: "Ativo" },
  { key: "ref", label: "Código (ref)", required: false, description: "Identificador livre. Se vazio, geramos um código pelo CPF.", example: "colab-0001" },
];

/** Cabeçalhos aceitos além do rótulo padrão do modelo. */
const headerAliases: Record<ImportFieldKey, string[]> = {
  name: ["nomecompleto", "nome", "colaborador", "name", "nomedocolaborador"],
  cpf: ["cpf", "cpfdocolaborador"],
  matricula: ["matricula", "mat", "matriculafuncional"],
  roleFunction: ["funcao", "funcaoexercida", "cargo", "cargofuncao", "role", "rolefunction"],
  area: ["area", "setor", "departamento", "areasetor"],
  establishment: ["estabelecimento", "unidade", "filial", "estabelecimentounidade"],
  rg: ["rg", "rggeral", "identidade"],
  pis: ["pis", "nis", "pispasep", "pisnis"],
  ctps: ["ctps", "carteiraprofissional"],
  admissionDate: ["admissao", "datadeadmissao", "admissiondate", "admissaodata", "dataadmissao"],
  birthDate: ["nascimento", "datadenascimento", "birthdate", "datanascimento"],
  phone: ["celular", "telefone", "phone", "fone", "telefonecelular"],
  email: ["email", "emailcorporativo", "e-mail"],
  city: ["cidade", "municipio", "city", "cidadeuf"],
  status: ["situacao", "status", "situacaocolaborador", "statuscolaborador"],
  ref: ["ref", "codigo", "codigoref", "codigocolaborador", "id"],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export interface ParsedImportRow {
  line: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ParsedImportFile {
  rows: ParsedImportRow[];
  detectedColumns: string[];
  ignoredColumns: string[];
}

/** Detecta o separador mais provável da primeira linha do CSV. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  candidates.forEach((candidate) => {
    let count = 0;
    let quoted = false;
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === candidate) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  });
  return best;
}

/** Lê um CSV respeitando campos entre aspas (inclusive com quebra de linha). */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

function mapHeaders(headerRow: string[]): { columns: Partial<Record<ImportFieldKey, number>>; ignored: string[] } {
  const columns: Partial<Record<ImportFieldKey, number>> = {};
  const ignored: string[] = [];
  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header ?? "");
    if (!normalized) return;
    const match = (Object.keys(headerAliases) as ImportFieldKey[]).find((key) => {
      if (columns[key] !== undefined) return false;
      return headerAliases[key].some((alias) => normalizeHeader(alias) === normalized);
    });
    if (match) columns[match] = index;
    else ignored.push(header);
  });
  return { columns, ignored };
}

function matrixToParsed(matrix: string[][]): ParsedImportFile {
  if (matrix.length === 0) throw new Error("O arquivo está vazio.");
  const headerRow = matrix[0] ?? [];
  const { columns, ignored } = mapHeaders(headerRow);
  if (columns.name === undefined) {
    throw new Error(
      "Não encontramos a coluna obrigatória \"Nome completo\". Baixe o modelo e mantenha a primeira linha como cabeçalho."
    );
  }
  if (columns.cpf === undefined) {
    throw new Error("Não encontramos a coluna obrigatória \"CPF\". Baixe o modelo e mantenha o cabeçalho.");
  }

  const seenCpf = new Set<string>();
  const rows: ParsedImportRow[] = [];

  matrix.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const isEmpty = cells.every((cell) => !String(cell ?? "").trim());
    if (isEmpty) return;

    const data: Record<string, string> = {};
    (Object.keys(columns) as ImportFieldKey[]).forEach((key) => {
      const position = columns[key];
      if (position === undefined) return;
      data[key] = String(cells[position] ?? "").trim();
    });

    const errors: string[] = [];
    if (!data.name || data.name.length < 3) errors.push("Informe o nome completo (mínimo 3 caracteres).");
    const cpfDigits = normalizeCpf(data.cpf ?? "");
    if (cpfDigits.length !== 11) errors.push("CPF deve ter 11 dígitos.");
    else if (/^(\d)\1{10}$/.test(cpfDigits)) errors.push("CPF inválido.");
    else if (seenCpf.has(cpfDigits)) errors.push("CPF repetido dentro do arquivo.");
    if (cpfDigits.length === 11 && !seenCpf.has(cpfDigits)) seenCpf.add(cpfDigits);
    if (data.email && (!data.email.includes("@") || !data.email.includes("."))) {
      errors.push("E-mail inválido.");
    }

    rows.push({ line, data, errors });
  });

  return {
    rows,
    detectedColumns: Object.keys(columns).map(
      (key) => importFields.find((field) => field.key === key)?.label ?? key
    ),
    ignoredColumns: ignored,
  };
}

/** Lê um arquivo CSV ou XLSX escolhido pelo usuário. */
export async function parseCollaboratorFile(file: File): Promise<ParsedImportFile> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    const raw = await file.text();
    const text = raw.replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(text);
    return matrixToParsed(parseDelimited(text, delimiter));
  }
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("A planilha não tem nenhuma aba com dados.");
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: "",
    });
    return matrixToParsed(matrix as string[][]);
  }
  throw new Error("Formato não aceito. Envie um arquivo .csv ou .xlsx.");
}

export const templateExampleRows: Record<ImportFieldKey, string>[] = [
  {
    name: "Marcos Aurélio Ferraz",
    cpf: "412.887.930-05",
    matricula: "001284",
    roleFunction: "Operador de empilhadeira",
    area: "Logística",
    establishment: "Matriz — Guarulhos",
    rg: "38.224.115-7",
    pis: "120.88471.22-9",
    ctps: "44102/0231",
    admissionDate: "12/03/2024",
    birthDate: "07/09/1991",
    phone: "(11) 98842-7710",
    email: "marcos.ferraz@empresa.com.br",
    city: "Guarulhos/SP",
    status: "Ativo",
    ref: "colab-0001",
  },
  {
    name: "Tatiane Souza Braga",
    cpf: "304.552.180-42",
    matricula: "001285",
    roleFunction: "Analista de segurança do trabalho",
    area: "SESMT",
    establishment: "Filial — Campinas",
    rg: "42.117.882-0",
    pis: "208.44112.09-3",
    ctps: "44102/0232",
    admissionDate: "01/07/2025",
    birthDate: "22/01/1994",
    phone: "(19) 99114-2088",
    email: "tatiane.braga@empresa.com.br",
    city: "Campinas/SP",
    status: "Ativo",
    ref: "colab-0002",
  },
  {
    name: "Jorge Nascimento Lima",
    cpf: "188.774.630-71",
    matricula: "001286",
    roleFunction: "Auxiliar de produção",
    area: "Produção",
    establishment: "Filial — Campinas",
    rg: "29.884.001-3",
    pis: "166.22874.55-1",
    ctps: "44102/0233",
    admissionDate: "05/08/2023",
    birthDate: "13/12/1988",
    phone: "(19) 99720-4481",
    email: "jorge.lima@empresa.com.br",
    city: "Campinas/SP",
    status: "Inativo",
    ref: "colab-0003",
  },
];

/** Modelo em CSV (separador `;`, compatível com Excel em português). */
export function downloadTemplateCsv(fileName = "modelo-colaboradores-sstek.csv"): void {
  const escape = (value: string) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = importFields.map((field) => escape(field.label)).join(";");
  const body = templateExampleRows.map((row) =>
    importFields.map((field) => escape(row[field.key] ?? "")).join(";")
  );
  const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Modelo em XLSX com cabeçalho, exemplos e largura de coluna ajustada. */
export function downloadTemplateXlsx(fileName = "modelo-colaboradores-sstek.xlsx"): void {
  const header = importFields.map((field) => field.label);
  const body = templateExampleRows.map((row) => importFields.map((field) => row[field.key] ?? ""));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet["!cols"] = importFields.map((field) => ({ wch: Math.min(Math.max(field.label.length + 8, 16), 34) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Colaboradores");
  XLSX.writeFile(workbook, fileName);
}