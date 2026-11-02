import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Vehicle } from "@/pages/app/modules/veiculos/vehicleTypes";

/**
 * Gera PDFs fictícios de CRLV-e e apólice para demonstração do módulo Veículos.
 *
 * Os arquivos são criados no navegador (pdf-lib) e enviados pelo mesmo caminho
 * de upload real usado pelo formulário de documento — assim o link assinado do
 * bucket privado é exercitado de verdade, e não simulado.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const ink = rgb(0.09, 0.12, 0.14);
const muted = rgb(0.42, 0.47, 0.51);
const line = rgb(0.85, 0.87, 0.86);
const band = rgb(0.05, 0.34, 0.3);
const bandInk = rgb(0.98, 0.99, 0.98);
const alertInk = rgb(0.68, 0.25, 0.12);

export interface DemoDocumentField {
  label: string;
  value: string;
}

export interface DemoDocumentContent {
  title: string;
  subtitle: string;
  fields: DemoDocumentField[];
  clauses: string[];
  fileName: string;
}

const onlyAsciiSafe = (value: string): string => value.replace(/\s+/g, " ").trim();

function breakLines(text: string, maxChars: number): string[] {
  const words = onlyAsciiSafe(text).split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = candidate;
  });
  if (current) lines.push(current);
  return lines;
}

function formatNow(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} às ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

export function buildCrlvContent(vehicle: Vehicle): DemoDocumentContent {
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veículo da frota";
  return {
    title: "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO",
    subtitle: "CRLV-e · documento eletrônico (via de demonstração)",
    fileName: `crlv-${vehicle.plate.toLowerCase()}.pdf`,
    fields: [
      { label: "Placa", value: vehicle.plate },
      { label: "Renavam", value: vehicle.renavam || "01234567890" },
      { label: "Chassi", value: vehicle.chassis || "9BWZZZ377VT004251" },
      { label: "Marca / Modelo", value: model },
      { label: "Ano fabricação / modelo", value: vehicle.year ? `${vehicle.year}/${vehicle.year}` : "2024/2024" },
      { label: "Categoria", value: vehicle.category || "Leve" },
      { label: "Combustível", value: vehicle.fuel || "Gasolina" },
      { label: "Exercício", value: "2026" },
      { label: "Emitido em", value: "28/08/2026" },
      { label: "Válido até", value: "28/08/2027" },
    ],
    clauses: [
      "Este documento comprova o licenciamento anual do veículo e deve permanecer com o condutor enquanto o veículo circular.",
      "Arquivo gerado apenas para demonstração do módulo Veículos. Não corresponde a um documento oficial e não tem validade legal.",
    ],
  };
}

export function buildInsuranceContent(vehicle: Vehicle): DemoDocumentContent {
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veículo da frota";
  return {
    title: "APÓLICE DE SEGURO DE AUTOMÓVEL",
    subtitle: "Ramo 0531 · casco e responsabilidade civil (via de demonstração)",
    fileName: `apolice-${vehicle.plate.toLowerCase()}.pdf`,
    fields: [
      { label: "Seguradora", value: "Seguradora Modelo S.A." },
      { label: "Número da apólice", value: `0531.2026.${vehicle.plate.slice(-5)}` },
      { label: "Segurado", value: "Metalúrgica Vega Ltda. (empresa de demonstração)" },
      { label: "Veículo segurado", value: `${model} · ${vehicle.plate}` },
      { label: "Vigência", value: "20/05/2026 a 20/05/2027" },
      { label: "Cobertura", value: "Casco, RCF-V e RCF-DM com assistência 24h" },
      { label: "Franquia", value: "R$ 3.500,00 (casco)" },
      { label: "Corretor", value: "Corretora Horizonte · SUSEP 123456" },
      { label: "Emissão", value: "20/05/2026" },
      { label: "Status", value: "Apólice vigente" },
    ],
    clauses: [
      "A cobertura é válida somente para os condutores autorizados descritos no contrato social e na relação de condutores.",
      "Arquivo gerado apenas para demonstração do módulo Veículos. Não corresponde a uma apólice real e não tem validade legal.",
    ],
  };
}

export async function buildDemoDocumentPdf(content: DemoDocumentContent): Promise<File> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 44;

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 118,
    width: PAGE_WIDTH,
    height: 118,
    color: band,
  });
  page.drawText("DEMONSTRAÇÃO", {
    x: margin,
    y: PAGE_HEIGHT - 38,
    size: 9,
    font: bold,
    color: bandInk,
  });
  page.drawText(content.title, {
    x: margin,
    y: PAGE_HEIGHT - 62,
    size: 15,
    font: bold,
    color: bandInk,
  });
  page.drawText(content.subtitle, {
    x: margin,
    y: PAGE_HEIGHT - 82,
    size: 9.5,
    font: regular,
    color: bandInk,
  });
  page.drawText(`Emitido em ${formatNow()}`, {
    x: margin,
    y: PAGE_HEIGHT - 100,
    size: 8.5,
    font: regular,
    color: bandInk,
  });

  let cursor = PAGE_HEIGHT - 152;

  page.drawText("DADOS DO DOCUMENTO", {
    x: margin,
    y: cursor,
    size: 9,
    font: bold,
    color: muted,
  });
  cursor -= 16;

  content.fields.forEach((field) => {
    page.drawLine({
      start: { x: margin, y: cursor + 10 },
      end: { x: PAGE_WIDTH - margin, y: cursor + 10 },
      thickness: 0.5,
      color: line,
    });
    page.drawText(field.label, {
      x: margin,
      y: cursor,
      size: 9,
      font: regular,
      color: muted,
    });
    const valueLines = breakLines(field.value, 52);
    valueLines.forEach((textLine, index) => {
      page.drawText(textLine, {
        x: margin + 168,
        y: cursor - index * 11,
        size: 10,
        font: bold,
        color: ink,
      });
    });
    cursor -= Math.max(24, 14 + valueLines.length * 11);
  });

  cursor -= 14;
  page.drawLine({
    start: { x: margin, y: cursor + 12 },
    end: { x: PAGE_WIDTH - margin, y: cursor + 12 },
    thickness: 0.5,
    color: line,
  });
  cursor -= 6;

  page.drawText("OBSERVAÇÕES", {
    x: margin,
    y: cursor,
    size: 9,
    font: bold,
    color: muted,
  });
  cursor -= 16;

  content.clauses.forEach((clause) => {
    breakLines(clause, 92).forEach((textLine) => {
      page.drawText(textLine, {
        x: margin,
        y: cursor,
        size: 9,
        font: regular,
        color: ink,
      });
      cursor -= 13;
    });
    cursor -= 6;
  });

  const footerY = 74;
  page.drawLine({
    start: { x: margin, y: footerY + 24 },
    end: { x: PAGE_WIDTH - margin, y: footerY + 24 },
    thickness: 0.5,
    color: line,
  });
  page.drawText("DOCUMENTO FICTÍCIO PARA TESTE DE VISUALIZAÇÃO — SEM VALIDADE LEGAL", {
    x: margin,
    y: footerY + 8,
    size: 8.5,
    font: bold,
    color: alertInk,
  });
  page.drawText("Gerado pelo módulo Veículos para validar o link assinado do arquivo privado.", {
    x: margin,
    y: footerY - 4,
    size: 8,
    font: regular,
    color: muted,
  });

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  return new File([blob], content.fileName, { type: "application/pdf" });
}