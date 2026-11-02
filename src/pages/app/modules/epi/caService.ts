import { supabase } from "@/lib/supabase";
import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import { findEpiByCa } from "@/pages/app/modules/epi/epiUtils";
import type { EpiCatalogItem } from "@/mocks/epi";

/** Endereço público do portal oficial de consulta de CA (CAEPI / MTE). */
export const CA_PORTAL_URL = "https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx";

export interface CaField {
  label: string;
  value: string;
}

export interface CaConsultaResult {
  found: boolean;
  ca: string;
  active: boolean | null;
  name: string;
  fields: CaField[];
  /** Data de validade do CA (DD/MM/AAAA), quando a consulta oficial retornar esse dado. */
  validity?: string;
  rawText?: string;
  source: "oficial" | "catalogo" | "base-local";
  portalUrl?: string;
  error?: string;
}

function emptyResult(ca: string): CaConsultaResult {
  return { found: false, ca, active: null, name: "", fields: [], source: "oficial" };
}

interface LocalCaRow {
  ca: string;
  cnpj: string | null;
  razao_social: string | null;
  equipamento: string | null;
  descricao: string | null;
  situacao: string | null;
  ativo: boolean | null;
  validade: string | null;
}

/**
 * Consulta o CA na base local do CAEPI, importada em Configurações (arquivo oficial
 * completo). Retorna null quando essa base não tem esse CA (ou ainda não foi importada),
 * para então cair na consulta ao vivo com cache.
 */
async function consultarCaBaseLocal(ca: string): Promise<CaConsultaResult | null> {
  const normalized = ca.replace(/\D/g, "");
  if (!normalized) return null;
  try {
    const { data, error } = await supabase
      .from("caepi_active_catalog")
      .select("ca, cnpj, razao_social, equipamento, descricao, situacao, ativo, validade")
      .eq("ca_normalized", normalized)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as LocalCaRow;
    const fields: CaField[] = [
      { label: "Equipamento", value: row.equipamento || "" },
      { label: "Descrição", value: row.descricao || "" },
      { label: "Situação", value: row.situacao || "" },
      { label: "Validade do CA", value: row.validade || "" },
      { label: "Razão social", value: row.razao_social || "" },
      { label: "CNPJ", value: row.cnpj || "" },
    ].filter((f) => f.value);
    return {
      found: true,
      ca: row.ca,
      active: row.ativo,
      name: row.equipamento || row.descricao || "",
      fields,
      validity: row.validade || undefined,
      source: "base-local",
      portalUrl: CA_PORTAL_URL,
    };
  } catch {
    return null;
  }
}

/**
 * Consulta o Certificado de Aprovação (CA), priorizando a base local do CAEPI
 * (importada em Configurações) e, quando não encontrado nela, caindo para a
 * consulta ao vivo com cache por meio de uma função de servidor (o navegador
 * não consegue acessar o portal oficial direto por CORS).
 */
export async function consultarCaOficial(ca: string): Promise<CaConsultaResult> {
  const base = emptyResult(ca);

  const local = await consultarCaBaseLocal(ca);
  if (local) return local;

  try {
    const { data, error } = await supabase.functions.invoke("consulta-ca", { body: { ca } });
    if (error) throw new Error(error.message || "Falha na consulta ao portal oficial.");
    if (!data) throw new Error("Resposta vazia do serviço oficial.");
    const payload = data as Partial<CaConsultaResult>;
    return {
      ...base,
      ...payload,
      ca: payload.ca || ca,
      name: payload.name || "",
      fields: Array.isArray(payload.fields) ? payload.fields : [],
      source: "oficial",
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Não foi possível consultar o portal oficial.",
    };
  }
}

/** Converte um item do catálogo interno no mesmo formato da consulta oficial. */
export function catalogoCaResult(ca: string): CaConsultaResult | null {
  const item: EpiCatalogItem | undefined = findEpiByCa(ca);
  if (!item) return null;
  const fields: CaField[] = [
    { label: "Equipamento", value: item.name },
    { label: "Categoria", value: item.category },
    { label: "Fabricante", value: item.manufacturer },
    { label: "Norma técnica", value: item.norm },
    { label: "Validade do CA", value: item.approvalValidity },
    { label: "Tamanhos", value: item.sizes },
    { label: "Descrição", value: item.description },
    { label: "Restrição de uso", value: item.restriction },
  ];
  if (!item.active && item.inactiveReason) {
    fields.push({ label: "Motivo da inativação", value: item.inactiveReason });
  }
  return {
    found: true,
    ca: item.ca,
    active: item.active,
    name: item.name,
    fields,
    source: "catalogo",
  };
}

/** Monta o laudo técnico em PDF a partir de um resultado de consulta de CA. */
export function buildOfficialCaReport(result: CaConsultaResult): string {
  const status =
    result.active === true
      ? '<span style="color:#1f8a5b;font-weight:700;">ATIVO</span>'
      : result.active === false
      ? '<span style="color:#b45309;font-weight:700;">INATIVO</span>'
      : "Não informado";
  const origem =
    result.source === "base-local"
      ? "base local do CAEPI importada no sistema"
      : result.source === "oficial"
      ? "banco oficial do CAEPI (MTE)"
      : "catálogo interno do sistema";
  const rows = result.fields
    .map((field) => `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(field.value)}</td></tr>`)
    .join("");

  return `${pdfHeader(`Consulta de CA · ${escapeHtml(result.ca)}`)}
    <h1>Laudo técnico do Certificado de Aprovação (CA)</h1>
    <p class="muted">
      Documento emitido a partir da consulta ao ${escapeHtml(origem)}, reunindo as informações de
      identificação, aplicação e situação do equipamento de proteção individual.
    </p>
    <h2>Identificação do equipamento</h2>
    <table>
      <tbody>
        <tr><th>Equipamento</th><td>${escapeHtml(result.name || "—")}</td></tr>
        <tr><th>Número do CA</th><td>${escapeHtml(result.ca)}</td></tr>
        <tr><th>Situação do CA</th><td>${status}</td></tr>
        <tr><th>Origem da consulta</th><td>${escapeHtml(origem)}</td></tr>
      </tbody>
    </table>
    <h2>Dados do certificado</h2>
    <table>
      <tbody>${rows || '<tr><td>Nenhum dado detalhado retornado na consulta.</td></tr>'}</tbody>
    </table>
    ${pdfFooter()}`;
}