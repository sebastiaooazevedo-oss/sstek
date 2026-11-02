// Edge Function: consulta-ca
// Consulta o Certificado de Aprovação (CA) de EPI no portal oficial do CAEPI
// (Secretaria de Inspeção do Trabalho / MTE): https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx
//
// Fluxo: primeiro verifica o CACHE LOCAL (tabela caepi_ca_cache) — CAs já consultados
// antes retornam na hora, sem bater no portal do governo de novo. Se não estiver em
// cache, faz a consulta ao vivo no portal (best-effort: busca a página, extrai os campos
// ocultos do formulário ASP.NET WebForms, envia o postback e interpreta o HTML de
// resposta) e, se encontrar o CA, grava o resultado no cache para as próximas consultas.
// Se o portal mudar de estrutura ou estiver fora do ar, a função retorna "found: false"
// com uma mensagem de erro honesta — nunca inventa dados do equipamento.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PORTAL_URL = "https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx";
const TIMEOUT_MS = 12000;
const CACHE_MAX_AGE_DAYS = 30;

interface CaField {
  label: string;
  value: string;
}

interface CaConsultaResult {
  found: boolean;
  ca: string;
  active: boolean | null;
  name: string;
  fields: CaField[];
  validity?: string;
  rawText?: string;
  source: "oficial";
  portalUrl: string;
  error?: string;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function emptyResult(ca: string): CaConsultaResult {
  return {
    found: false,
    ca,
    active: null,
    name: "",
    fields: [],
    source: "oficial",
    portalUrl: PORTAL_URL,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

/** Extrai todos os <input> (ocultos e visíveis) de um HTML de formulário ASP.NET. */
function extractInputs(html: string): Array<{ name: string; value: string; type: string }> {
  const inputs: Array<{ name: string; value: string; type: string }> = [];
  const re = /<input\b[^>]*>/gi;
  const matches = html.match(re) || [];
  for (const tag of matches) {
    const nameMatch = tag.match(/name="([^"]*)"/i);
    if (!nameMatch) continue;
    const valueMatch = tag.match(/value="([^"]*)"/i);
    const typeMatch = tag.match(/type="([^"]*)"/i);
    inputs.push({
      name: nameMatch[1],
      value: valueMatch ? decodeEntities(valueMatch[1]) : "",
      type: typeMatch ? typeMatch[1].toLowerCase() : "text",
    });
  }
  return inputs;
}

/** Localiza o campo de texto onde o número do CA deve ser digitado. */
function findCaTextField(inputs: Array<{ name: string; value: string; type: string }>): string | null {
  const candidates = inputs.filter((i) => i.type === "text");
  const byName =
    candidates.find((i) => /n[uú]mero.*ca|ca.*n[uú]mero|txtca$|txtnumeroca/i.test(i.name.replace(/\s/g, ""))) ||
    candidates.find((i) => /ca/i.test(i.name));
  return byName ? byName.name : candidates[0]?.name || null;
}

/** Localiza o botão/elemento de postback usado para disparar a consulta. */
function findSubmitField(
  inputs: Array<{ name: string; value: string; type: string }>
): { name: string; value: string } | null {
  const submit = inputs.find(
    (i) =>
      (i.type === "submit" || i.type === "image" || i.type === "button") &&
      /consult|pesquis|buscar/i.test(`${i.name} ${i.value}`)
  );
  if (submit) return { name: submit.name, value: submit.value || "Consultar" };
  const anySubmit = inputs.find((i) => i.type === "submit" || i.type === "image");
  return anySubmit ? { name: anySubmit.name, value: anySubmit.value || "Consultar" } : null;
}

/** Monta os pares de campos ocultos padrão do ASP.NET WebForms (__VIEWSTATE etc.). */
function hiddenPayload(inputs: Array<{ name: string; value: string; type: string }>): Record<string, string> {
  const payload: Record<string, string> = {};
  inputs
    .filter((i) => i.type === "hidden")
    .forEach((i) => {
      payload[i.name] = i.value;
    });
  return payload;
}

/** Extrai pares rótulo/valor de uma tabela de resultado (GridView) buscando por linhas <tr>. */
function extractResultFields(html: string): CaField[] {
  const fields: CaField[] = [];
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi) || []).map((c) => stripTags(c));
    if (cells.length === 2 && cells[0] && cells[1] && cells[0].length < 60) {
      fields.push({ label: cells[0].replace(/:$/, "").trim(), value: cells[1].trim() });
    }
  }
  return fields;
}

function guessActive(fields: CaField[], rawText: string): boolean | null {
  const situacao = fields.find((f) => /situa[cç][aã]o/i.test(f.label));
  const text = (situacao?.value || rawText).toUpperCase();
  if (!text) return null;
  if (/VENCID|CANCELAD|SUSPENS|INATIV|EXPIRAD/.test(text)) return false;
  if (/V[AÁ]LID|ATIV|VIGENTE/.test(text)) return true;
  return null;
}

function guessName(fields: CaField[]): string {
  const equip = fields.find((f) => /equipamento|descri[cç][aã]o do equipamento|nome/i.test(f.label));
  return equip?.value || "";
}

function guessValidity(fields: CaField[]): string | undefined {
  const validade = fields.find((f) => /validade/i.test(f.label));
  if (!validade) return undefined;
  const match = validade.value.match(/\d{2}\/\d{2}\/\d{4}/);
  return match ? match[0] : validade.value;
}

function getAdminClient(): ReturnType<typeof createClient> | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface CacheRow {
  ca: string;
  cnpj: string | null;
  razao_social: string | null;
  equipamento: string | null;
  descricao: string | null;
  situacao: string | null;
  ativo: boolean | null;
  validade: string | null;
  fields: CaField[] | null;
  queried_at: string;
}

async function readFromCache(
  admin: ReturnType<typeof createClient>,
  caNormalized: string
): Promise<CaConsultaResult | null> {
  const { data, error } = await admin
    .from("caepi_ca_cache")
    .select("ca, cnpj, razao_social, equipamento, descricao, situacao, ativo, validade, fields, queried_at")
    .eq("ca_normalized", caNormalized)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as CacheRow;
  const ageMs = Date.now() - new Date(row.queried_at).getTime();
  if (ageMs > CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return null; // cache antigo, revalida no portal
  return {
    found: true,
    ca: row.ca,
    active: row.ativo,
    name: row.equipamento || row.descricao || "",
    fields: Array.isArray(row.fields) ? row.fields : [],
    validity: row.validade || undefined,
    source: "oficial",
    portalUrl: PORTAL_URL,
  };
}

async function saveToCache(
  admin: ReturnType<typeof createClient>,
  caNormalized: string,
  result: CaConsultaResult
): Promise<void> {
  const cnpjField = result.fields.find((f) => /cnpj/i.test(f.label));
  const razaoField = result.fields.find((f) => /raz[aã]o/i.test(f.label));
  const descricaoField = result.fields.find((f) => /descri[cç][aã]o/i.test(f.label));
  const situacaoField = result.fields.find((f) => /situa[cç][aã]o/i.test(f.label));
  try {
    await admin.from("caepi_ca_cache").upsert(
      {
        ca: result.ca,
        ca_normalized: caNormalized,
        cnpj: cnpjField?.value || null,
        razao_social: razaoField?.value || null,
        equipamento: result.name || null,
        descricao: descricaoField?.value || null,
        situacao: situacaoField?.value || null,
        ativo: result.active,
        validade: result.validity || null,
        fields: result.fields,
        source: "oficial",
        queried_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ca_normalized" }
    );
  } catch {
    // Falha ao gravar cache não deve impedir a resposta ao usuário.
  }
}

async function consultarPortal(ca: string): Promise<CaConsultaResult> {
  const result = emptyResult(ca);

  // 1) Carrega o formulário inicial para capturar os campos de postback (__VIEWSTATE etc.)
  const getResp = await fetchWithTimeout(PORTAL_URL, {
    method: "GET",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SSTEK/1.0; +sstek)" },
  });
  if (!getResp.ok) {
    return { ...result, error: `Portal oficial retornou status ${getResp.status} ao abrir a página de consulta.` };
  }
  const cookie = getResp.headers.get("set-cookie") || "";
  const formHtml = await getResp.text();
  const inputs = extractInputs(formHtml);
  if (inputs.length === 0) {
    return { ...result, error: "Não foi possível interpretar o formulário do portal oficial (estrutura inesperada)." };
  }

  const caField = findCaTextField(inputs);
  const submitField = findSubmitField(inputs);
  if (!caField) {
    return { ...result, error: "Não foi possível localizar o campo de nº do CA no portal oficial." };
  }

  // 2) Monta o postback com o número do CA preenchido
  const payload = hiddenPayload(inputs);
  payload[caField] = ca;
  payload["__EVENTTARGET"] = submitField ? submitField.name : "";
  payload["__EVENTARGUMENT"] = "";
  if (submitField) payload[submitField.name] = submitField.value;

  const body = Object.entries(payload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const postResp = await fetchWithTimeout(PORTAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; SSTEK/1.0; +sstek)",
      Referer: PORTAL_URL,
      ...(cookie ? { Cookie: cookie.split(";")[0] } : {}),
    },
    body,
  });
  if (!postResp.ok) {
    return { ...result, error: `Portal oficial retornou status ${postResp.status} ao consultar o CA.` };
  }
  const resultHtml = await postResp.text();
  const rawText = stripTags(resultHtml);

  if (new RegExp(`\\b${ca.replace(/\D/g, "")}\\b`).test(rawText.replace(/\D/g, " ")) === false) {
    // número não reaparece em lugar nenhum do retorno — provável "não encontrado"
    if (/nenhum registro|n[aã]o encontrad|n[aã]o foi localizado/i.test(rawText)) {
      return { ...result, found: false };
    }
  }

  const fields = extractResultFields(resultHtml);
  if (fields.length === 0 || /nenhum registro|n[aã]o encontrad|n[aã]o foi localizado/i.test(rawText)) {
    return { ...result, found: false };
  }

  const active = guessActive(fields, rawText);
  const name = guessName(fields);
  const validity = guessValidity(fields);

  return {
    found: true,
    ca,
    active,
    name,
    fields,
    validity,
    rawText: rawText.slice(0, 4000),
    source: "oficial",
    portalUrl: PORTAL_URL,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const body = await req.json().catch(() => ({}));
    const ca = String(body?.ca || "").trim();
    if (!ca) return jsonResponse({ ...emptyResult(""), error: "Informe o número do CA para consultar." }, 400);

    const normalized = ca.replace(/[^\d.]/g, "");
    const normalizedDigits = normalized.replace(/\D/g, "");
    const admin = getAdminClient();

    if (admin && normalizedDigits) {
      const cached = await readFromCache(admin, normalizedDigits);
      if (cached) return jsonResponse(cached);
    }

    const result = await consultarPortal(normalized);
    if (admin && normalizedDigits && result.found) {
      await saveToCache(admin, normalizedDigits, result);
    }
    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha inesperada ao consultar o portal oficial do CAEPI.";
    const isAbort = message.toLowerCase().includes("abort");
    return jsonResponse(
      {
        ...emptyResult(""),
        error: isAbort
          ? "O portal oficial do CAEPI demorou demais para responder. Tente novamente em instantes."
          : message,
      },
      200
    );
  }
});
