import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Collaborator } from "@/mocks/collaborators";
import type { DocumentRecord } from "@/mocks/documents";
import { getSettings } from "@/pages/app/settings/settingsStore";
import { signDocumentPath } from "@/pages/app/modules/documentos/documentsStore";
import type { BatchCollaboratorPlan, BatchDocItem } from "@/pages/app/modules/documentos/batchPrintTypes";

/**
 * Montagem do dossiê de impressão de UM colaborador.
 *
 * - Capa com a lista de documentos na ordem escolhida, pendências e avisos.
 * - Documentos com arquivo digital entram como páginas originais (mescladas
 *   com pdf-lib), preservando orientação, assinaturas visuais e QR Codes.
 * - Registros sem arquivo digital entram como página de registro cadastral,
 *   sempre rotulada como tal (nunca substituindo o original em silêncio).
 *
 * O resultado é uma CÓPIA para apresentação/impressão. O arquivo original
 * permanece intacto e acessível no cadastro do colaborador.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 42;

const INK = rgb(0.09, 0.16, 0.19);
const BRAND = rgb(0.09, 0.26, 0.23);
const MUTED = rgb(0.36, 0.42, 0.45);
const LINE = rgb(0.78, 0.83, 0.85);
const SOFT = rgb(0.96, 0.975, 0.97);
const WHITE = rgb(1, 1, 1);
const HEAD_TEXT = rgb(0.85, 0.92, 0.89);
const WARN_BG = rgb(0.996, 0.965, 0.925);
const WARN = rgb(0.71, 0.45, 0.04);

/** Helvetica padrão usa WinAnsi: normaliza caracteres tipográficos. */
function safe(value: string): string {
  return (value || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "-");
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Writer {
  page: PDFPage;
  fonts: Fonts;
  y: number;
}

function text(
  writer: Writer,
  value: string,
  options: {
    size?: number;
    bold?: boolean;
    color?: typeof INK;
    x?: number;
    maxWidth?: number;
    lineHeight?: number;
  } = {}
): void {
  const size = options.size ?? 10;
  const font = options.bold ? writer.fonts.bold : writer.fonts.regular;
  const color = options.color ?? INK;
  const x = options.x ?? MARGIN;
  const maxWidth = options.maxWidth ?? A4[0] - MARGIN * 2;
  const lineHeight = options.lineHeight ?? size * 1.4;
  wrapLines(value, font, size, maxWidth).forEach((line) => {
    writer.page.drawText(line, { x, y: writer.y, size, font, color });
    writer.y -= lineHeight;
  });
}

function band(page: PDFPage, label: string, subtitle: string, fonts: Fonts) {
  const height = 68;
  page.drawRectangle({ x: 0, y: A4[1] - height, width: A4[0], height, color: BRAND });
  page.drawText(safe(label), { x: MARGIN, y: A4[1] - 32, size: 14, font: fonts.bold, color: WHITE });
  page.drawText(safe(subtitle), { x: MARGIN, y: A4[1] - 50, size: 8, font: fonts.regular, color: HEAD_TEXT });
}

function sectionTitle(writer: Writer, value: string) {
  writer.page.drawRectangle({ x: MARGIN, y: writer.y - 2, width: 3, height: 12, color: BRAND });
  text(writer, value, { size: 10, bold: true, x: MARGIN + 9, color: BRAND });
  writer.y -= 4;
}

function fieldRow(writer: Writer, label: string, value: string) {
  text(writer, label, { size: 7.5, bold: true, color: MUTED });
  text(writer, value || "—", { size: 9.5 });
  writer.y -= 2;
}

function footer(page: PDFPage, fonts: Fonts, note: string) {
  page.drawLine({
    start: { x: MARGIN, y: 50 },
    end: { x: A4[0] - MARGIN, y: 50 },
    thickness: 0.5,
    color: LINE,
  });
  const lines = wrapLines(note, fonts.regular, 7, A4[0] - MARGIN * 2 - 100);
  lines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, { x: MARGIN, y: 38 - index * 9, size: 7, font: fonts.regular, color: MUTED });
  });
}

function drawCover(
  page: PDFPage,
  fonts: Fonts,
  options: {
    plan: BatchCollaboratorPlan;
    collaborator: Collaborator;
    fileName: string;
    batchRef: string;
    actor: string;
    generatedAt: string;
    pageCount: number;
  }
): void {
  const { plan, collaborator, fileName, batchRef, actor, generatedAt, pageCount } = options;
  const company = getSettings().companyLegalName.trim() || "SSTEK";

  band(page, company, "Impressão em lote · Documentos do colaborador", fonts);

  const writer: Writer = { page, fonts, y: A4[1] - 102 };

  text(writer, "Dossiê de documentos para impressão", { size: 9, bold: true, color: MUTED });
  writer.y -= 2;
  text(writer, collaborator.name, { size: 22, bold: true, color: BRAND });
  writer.y -= 2;
  text(
    writer,
    [
      collaborator.role || "—",
      collaborator.establishment || "Sem unidade",
      collaborator.matricula ? `Matrícula ${collaborator.matricula}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    { size: 9, color: MUTED }
  );
  writer.y -= 8;

  const kpis = [
    { label: "Documentos incluídos", value: String(plan.items.length) },
    { label: "Páginas (com a capa)", value: String(pageCount) },
    { label: "Pendências / avisos", value: String(plan.pendencies.length) },
  ];
  const boxWidth = (A4[0] - MARGIN * 2 - 20) / 3;
  kpis.forEach((kpi, index) => {
    const x = MARGIN + index * (boxWidth + 10);
    page.drawRectangle({
      x,
      y: writer.y - 40,
      width: boxWidth,
      height: 50,
      borderColor: LINE,
      borderWidth: 0.8,
      color: WHITE,
    });
    page.drawText(kpi.value, { x: x + 10, y: writer.y - 14, size: 16, font: fonts.bold, color: BRAND });
    page.drawText(safe(kpi.label), { x: x + 10, y: writer.y - 28, size: 7, font: fonts.regular, color: MUTED });
  });
  writer.y -= 64;

  sectionTitle(writer, `Documentos incluídos (${plan.items.length}) — nesta ordem`);
  const colX = [MARGIN, MARGIN + 78, MARGIN + 330, MARGIN + 402, MARGIN + 472];
  const headerY = writer.y;
  page.drawRectangle({ x: MARGIN, y: headerY - 4, width: A4[0] - MARGIN * 2, height: 16, color: SOFT });
  ["#", "Documento / tipo", "Emissão", "Versão", "Páginas"].forEach((label, index) => {
    page.drawText(label, { x: colX[index], y: headerY + 1, size: 7, font: fonts.bold, color: MUTED });
  });
  writer.y = headerY - 12;

  let drawnRows = 0;
  plan.items.forEach((item, index) => {
    if (writer.y < 190) return;
    const rowY = writer.y;
    page.drawText(String(index + 1), { x: colX[0], y: rowY, size: 8, font: fonts.regular, color: INK });
    const label = wrapLines(`${item.typeName} · ${item.name}`, fonts.regular, 8, 242);
    page.drawText(lineText(label), { x: colX[1], y: rowY, size: 8, font: fonts.regular, color: INK });
    page.drawText(safe(item.issuedAt), { x: colX[2], y: rowY, size: 8, font: fonts.regular, color: INK });
    page.drawText(safe(item.versionLabel), { x: colX[3], y: rowY, size: 7.5, font: fonts.regular, color: MUTED });
    page.drawText(String(item.pages), { x: colX[4], y: rowY, size: 8, font: fonts.regular, color: INK });
    page.drawLine({
      start: { x: MARGIN, y: rowY - 5 },
      end: { x: A4[0] - MARGIN, y: rowY - 5 },
      thickness: 0.3,
      color: LINE,
    });
    writer.y -= 15;
    drawnRows += 1;
  });

  if (drawnRows < plan.items.length) {
    page.drawText(
      safe(
        `... e mais ${plan.items.length - drawnRows} documento(s). A lista completa segue nas páginas de cada registro.`
      ),
      { x: MARGIN, y: writer.y, size: 7.5, font: fonts.regular, color: MUTED }
    );
    writer.y -= 14;
  }

  writer.y -= 6;
  const pendencies = plan.pendencies.length
    ? plan.pendencies
    : ["Nenhuma ausência identificada para os tipos selecionados."];
  const allPendencyLines = pendencies.flatMap((p) => wrapLines(`- ${p}`, fonts.regular, 8, A4[0] - MARGIN * 2 - 24));
  // A capa precisa continuar legível: avisos em excesso são resumidos aqui e
  // aparecem completos na Conferência da Impressão em Lote.
  const maxPendencyLines = Math.max(3, Math.floor((writer.y - 190) / 10.5));
  const pendencyLines =
    allPendencyLines.length > maxPendencyLines
      ? [
          ...allPendencyLines.slice(0, maxPendencyLines - 1),
          `- ... e mais ${allPendencyLines.length - (maxPendencyLines - 1)} linha(s) de aviso, detalhadas na conferência.`,
        ]
      : allPendencyLines;
  const boxHeight = 20 + pendencyLines.length * 10.5;
  page.drawRectangle({
    x: MARGIN,
    y: writer.y - boxHeight + 10,
    width: A4[0] - MARGIN * 2,
    height: boxHeight,
    color: plan.pendencies.length ? WARN_BG : SOFT,
    borderColor: LINE,
    borderWidth: 0.6,
  });
  page.drawText(plan.pendencies.length ? "Pendências e avisos informados" : "Pendências e avisos", {
    x: MARGIN + 10,
    y: writer.y - 2,
    size: 8,
    font: fonts.bold,
    color: plan.pendencies.length ? WARN : MUTED,
  });
  writer.y -= 18;
  pendencyLines.forEach((line) => {
    page.drawText(line, { x: MARGIN + 10, y: writer.y, size: 8, font: fonts.regular, color: INK });
    writer.y -= 10.5;
  });

  writer.y -= 14;
  const disclaimer =
    "Este PDF reúne cópias de documentos para conferência e impressão. Não é um documento novo, não substitui os originais e não preserva a validade criptográfica das assinaturas eletrônicas dos arquivos originais. A validade deve ser conferida no documento original, que permanece acessível no cadastro do colaborador.";
  const disclaimerLines = wrapLines(disclaimer, fonts.regular, 7.5, A4[0] - MARGIN * 2 - 20);
  const disclaimerHeight = 14 + disclaimerLines.length * 9.5;
  page.drawRectangle({
    x: MARGIN,
    y: writer.y - disclaimerHeight + 10,
    width: A4[0] - MARGIN * 2,
    height: disclaimerHeight,
    borderColor: LINE,
    borderWidth: 0.6,
    color: WHITE,
  });
  let disclaimerY = writer.y;
  disclaimerLines.forEach((line) => {
    page.drawText(line, { x: MARGIN + 10, y: disclaimerY, size: 7.5, font: fonts.regular, color: MUTED });
    disclaimerY -= 9.5;
  });

  page.drawText(safe(`Arquivo: ${fileName}`), { x: MARGIN, y: 80, size: 7.5, font: fonts.regular, color: MUTED });
  page.drawText(safe(`Gerado por ${actor} em ${generatedAt} · Lote ${batchRef}`), {
    x: MARGIN,
    y: 69,
    size: 7.5,
    font: fonts.regular,
    color: MUTED,
  });
  footer(page, fonts, "Cópia para apresentação e impressão. Originais preservados no cadastro do colaborador.");
}

function lineText(lines: string[]): string {
  if (lines.length <= 1) return lines[0] ?? "";
  return `${lines[0]}...`;
}

function drawRegistryPage(
  page: PDFPage,
  fonts: Fonts,
  plan: BatchCollaboratorPlan,
  item: BatchDocItem,
  index: number,
  total: number,
  company: string
): void {
  band(page, company, `Documento ${index} de ${total} · ${item.typeName}`, fonts);
  const writer: Writer = { page, fonts, y: A4[1] - 102 };

  text(writer, "REGISTRO CADASTRAL DO DOCUMENTO", { size: 8, bold: true, color: MUTED });
  writer.y -= 2;
  text(writer, item.name, { size: 16, bold: true, color: BRAND });
  writer.y -= 8;

  if (item.source === "sem-arquivo") {
    const warning = "ARQUIVO DIGITAL NAO ANEXADO - esta pagina reproduz apenas o registro do cadastro.";
    const lines = wrapLines(warning, fonts.bold, 8, A4[0] - MARGIN * 2 - 20);
    const height = 14 + lines.length * 11;
    page.drawRectangle({
      x: MARGIN,
      y: writer.y - height + 10,
      width: A4[0] - MARGIN * 2,
      height,
      color: WARN_BG,
      borderColor: WARN,
      borderWidth: 0.8,
    });
    let warningY = writer.y;
    lines.forEach((line) => {
      page.drawText(line, { x: MARGIN + 10, y: warningY, size: 8, font: fonts.bold, color: WARN });
      warningY -= 11;
    });
    writer.y -= height + 10;
  }

  sectionTitle(writer, "Dados do documento");
  fieldRow(writer, "Tipo de documento", item.typeName);
  fieldRow(
    writer,
    "Colaborador",
    `${plan.collaboratorName}${plan.matricula ? ` · Matrícula ${plan.matricula}` : ""}`
  );
  fieldRow(writer, "Unidade", plan.establishment || "Sem unidade");
  fieldRow(writer, "Emitido em", item.issuedAt);
  fieldRow(writer, "Validade", item.expiresAt);
  fieldRow(writer, "Situação", item.status);
  fieldRow(writer, "Versão utilizada", item.versionLabel);
  fieldRow(
    writer,
    "Origem do conteúdo",
    item.source === "cadastro"
      ? "Cadastro do colaborador"
      : item.source === "arquivo"
        ? "Arquivo digital anexado"
        : item.source === "imagem"
          ? "Imagem digitalizada anexada"
          : "Sem arquivo digital"
  );
  fieldRow(writer, "Identificador do registro", item.documentId);

  writer.y -= 12;
  sectionTitle(writer, "Observação");
  text(
    writer,
    "Esta página integra um dossiê de impressão em lote. Ela não substitui o documento original nem declara validade documental própria: serve para identificar, no papel, qual registro do sistema corresponde àquele item do lote.",
    { size: 9, color: MUTED, lineHeight: 12 }
  );

  footer(page, fonts, "Cópia para apresentação e impressão. Originais preservados no cadastro do colaborador.");
}

async function fetchDocumentBytes(doc: DocumentRecord): Promise<Uint8Array | null> {
  try {
    const url = doc.storagePath ? await signDocumentPath(doc.storagePath) : doc.fileUrl || "";
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; kind: "png" | "jpg" } | null {
  const match = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase().startsWith("pn") ? "png" : "jpg";
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, kind };
  } catch {
    return null;
  }
}

function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export interface BatchDossierResult {
  bytes: Uint8Array;
  pageCount: number;
  items: BatchDocItem[];
  pendencies: string[];
}

/**
 * Gera o PDF reunido de um colaborador.
 * Lança erro quando nenhum documento pôde ser incluído (nunca gera arquivo vazio).
 */
export async function buildCollaboratorDossier(options: {
  plan: BatchCollaboratorPlan;
  collaborator: Collaborator;
  documents: DocumentRecord[];
  fileName: string;
  batchRef: string;
  actor: string;
  generatedAt: string;
}): Promise<BatchDossierResult> {
  const { plan, collaborator, documents, fileName, batchRef, actor, generatedAt } = options;
  if (plan.items.length === 0) {
    throw new Error("Nenhum documento disponível para este colaborador.");
  }

  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const company = getSettings().companyLegalName.trim() || "SSTEK";

  const included: BatchDocItem[] = [];
  const pendencies = [...plan.pendencies];
  /** Páginas criadas por nós (não mescladas) e o item correspondente. */
  const registryPages: { page: PDFPage; item: BatchDocItem }[] = [];

  // Capa criada primeiro para ficar na frente; o conteúdo é desenhado depois.
  const cover = pdf.addPage(A4);

  for (const item of plan.items) {
    const record = documents.find((d) => d.id === item.documentId);
    let resolved = false;

    if (record) {
      const bytes = await fetchDocumentBytes(record);
      if (bytes && isPdf(bytes)) {
        try {
          const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const copied = await pdf.copyPages(source, source.getPageIndices());
          copied.forEach((page) => pdf.addPage(page));
          included.push({ ...item, pages: copied.length, source: "arquivo" });
          resolved = true;
        } catch {
          pendencies.push(`${item.typeName}: não foi possível ler o PDF original anexado.`);
        }
      }

      if (!resolved) {
        const imageData = bytes
          ? { bytes, kind: bytes[0] === 0x89 ? ("png" as const) : ("jpg" as const) }
          : record.previewDataUrl
            ? dataUrlBytes(record.previewDataUrl)
            : null;
        if (imageData) {
          try {
            const image =
              imageData.kind === "png" ? await pdf.embedPng(imageData.bytes) : await pdf.embedJpg(imageData.bytes);
            const page = pdf.addPage(A4);
            const maxWidth = A4[0] - MARGIN * 2;
            const maxHeight = A4[1] - 150;
            const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
            page.drawRectangle({ x: 0, y: A4[1] - 52, width: A4[0], height: 52, color: BRAND });
            page.drawText(safe(`${item.typeName} — ${item.name}`), {
              x: MARGIN,
              y: A4[1] - 30,
              size: 9,
              font: fonts.bold,
              color: WHITE,
              maxWidth: A4[0] - MARGIN * 2,
            });
            page.drawText(safe(`${plan.collaboratorName} · Emitido em ${item.issuedAt}`), {
              x: MARGIN,
              y: A4[1] - 45,
              size: 7,
              font: fonts.regular,
              color: HEAD_TEXT,
            });
            page.drawImage(image, {
              x: (A4[0] - image.width * scale) / 2,
              y: 70 + (maxHeight - image.height * scale) / 2,
              width: image.width * scale,
              height: image.height * scale,
            });
            footer(page, fonts, "Cópia para apresentação e impressão. Originais preservados no cadastro do colaborador.");
            included.push({ ...item, pages: 1, source: "imagem" });
            resolved = true;
          } catch {
            pendencies.push(`${item.typeName}: não foi possível embutir a imagem anexada.`);
          }
        }
      }
    }

    if (!resolved) {
      const page = pdf.addPage(A4);
      const normalized: BatchDocItem = {
        ...item,
        pages: 1,
        source: item.source === "cadastro" ? "cadastro" : "sem-arquivo",
      };
      included.push(normalized);
      registryPages.push({ page, item: normalized });
    }
  }

  if (included.length === 0) {
    throw new Error("Nenhum documento pôde ser incluído neste dossiê.");
  }

  registryPages.forEach(({ page, item }) => {
    const index = included.findIndex((entry) => entry === item);
    drawRegistryPage(page, fonts, plan, item, index + 1, included.length, company);
  });

  drawCover(cover, fonts, {
    plan,
    collaborator,
    fileName,
    batchRef,
    actor,
    generatedAt,
    pageCount: included.reduce((sum, entry) => sum + entry.pages, 0) + 1,
  });

  const pages = pdf.getPages();
  const total = pages.length;
  pages.forEach((page, index) => {
    page.drawText(safe(`Página ${index + 1} de ${total}`), {
      x: A4[0] - MARGIN - 72,
      y: 38,
      size: 7,
      font: fonts.regular,
      color: MUTED,
    });
  });

  const bytes = await pdf.save();
  return { bytes, pageCount: total, items: included, pendencies };
}