// Edge Function: fiscalizacao-publica
//
// Entrega os dados da ficha de fiscalização de UM colaborador para quem
// escaneia o QR-Code do capacete, sem exigir login (o fiscal não é usuário do
// sistema). Como a página é pública, o RLS do banco bloquearia a leitura
// anônima — por isso a consulta é feita aqui, com a chave de serviço.
//
// Regras de privacidade (importantes):
// - Só devolve o necessário para a fiscalização em campo.
// - CPF sai MASCARADO; PIS, CTPS, e-mail e telefone do trabalhador NUNCA saem.
// - Exige subdomínio + ref exatos da empresa, sem fallback para outra empresa.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function dateToTime(value: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value || "").trim());
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}

/** Mostra apenas os dois últimos dígitos do CPF — o fiscal confere a pessoa sem expor o documento. */
function maskCpf(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return "";
  return `***.***.***-${digits.slice(8)}`;
}

type EpiStatus = "Ativo" | "Vencendo" | "Vencido";

function epiStatus(expires: string): EpiStatus {
  const time = dateToTime(expires);
  if (!time) return "Ativo";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (time < today) return "Vencido";
  const limit = today + 60 * 24 * 60 * 60 * 1000;
  if (time <= limit) return "Vencendo";
  return "Ativo";
}

interface DeliveryItem {
  name?: string;
  ca?: string;
  quantity?: number;
}

/*
 * TRAVA TEMPORÁRIA DE ACESSO PÚBLICO (reversível)
 * --------------------------------------------------------------------------
 * Enquanto não existir identificador aleatório e revogável por QR, a ficha
 * pública NÃO entrega nenhum dado: nem pessoal, nem photo_url, nem timbrado,
 * nem link assinado.
 *
 * Por que no servidor: qualquer bloqueio só no frontend/CORS é contornável
 * chamando a função diretamente. A checagem abaixo ocorre antes de qualquer
 * leitura no banco ou geração de URL assinada.
 *
 * Para reativar (somente após aprovar o mecanismo definitivo por QR):
 * trocar para `true` e republicar a função. Nenhum cadastro ou QR é alterado.
 */
const PUBLIC_FICHA_ENABLED = false;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  if (!PUBLIC_FICHA_ENABLED) {
    // 503 com código estável. Não retorna empresa, colaborador, EPIs nem URLs.
    return jsonResponse(
      {
        ok: false,
        error: "public_access_temporarily_disabled",
        detail:
          "A consulta pública por QR-Code está temporariamente desativada. Os cadastros e os adesivos continuam válidos e nenhum dado foi apagado.",
      },
      503,
    );
  }

  try {
    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const subdomain = String(payload?.subdomain ?? "").trim().toLowerCase();
    const ref = String(payload?.ref ?? "").trim();
    if (!subdomain || !ref) return jsonResponse({ ok: false, error: "invalid_request" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return jsonResponse({ ok: false, error: "service_unavailable" }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: company } = await admin
      .from("companies")
      .select("id, name, subdomain, cnpj, legal_name")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (!company) return jsonResponse({ ok: false, error: "company_not_found" }, 404);

    // Configuração PRIVADA da empresa. A leitura é feita com a chave de serviço
    // porque a ficha é pública, mas só os campos de identificação institucional
    // saem na resposta — nada de PIS, CTPS, e-mail ou telefone.
    const { data: settings } = await admin
      .from("company_settings")
      .select(
        "company_legal_name, company_cnpj, technical_responsible, technical_registration, sesmt_phone, letterhead_path",
      )
      .eq("company_id", company.id)
      .maybeSingle();

    // O papel timbrado mora em bucket privado: geramos um link assinado curto
    // apenas para esta ficha, em vez de expor o arquivo publicamente.
    let letterheadUrl = "";
    const letterheadPath = (settings?.letterhead_path as string | null) ?? null;
    if (letterheadPath) {
      const { data: signed } = await admin.storage.from("branding").createSignedUrl(letterheadPath, 3600);
      letterheadUrl = signed?.signedUrl ?? "";
    }

    const { data: person } = await admin
      .from("company_collaborators")
      .select(
        "ref, name, role_function, area, establishment, status, photo_url, admission_date, cpf, documents_ok, documents_total, trainings_active, trainings_expired, epis_in_use",
      )
      .eq("company_id", company.id)
      .eq("ref", ref)
      .maybeSingle();

    const companyBlock = {
      name: (settings?.company_legal_name as string)?.trim() || String(company.name ?? ""),
      subdomain: String(company.subdomain ?? subdomain),
      cnpj: (settings?.company_cnpj as string)?.trim() || String(company.cnpj ?? ""),
      legalName: (company.legal_name as string) ?? "",
      technicalResponsible: (settings?.technical_responsible as string) ?? "",
      technicalRegistration: (settings?.technical_registration as string) ?? "",
      sesmtPhone: (settings?.sesmt_phone as string) ?? "",
      letterheadUrl,
    };

    if (!person) {
      return jsonResponse({ ok: true, company: companyBlock, collaborator: null, epis: [] });
    }

    /* ----------------------------- Ficha de EPI ---------------------------- */

    const { data: deliveries } = await admin
      .from("epi_deliveries")
      .select("ref, delivery_date, items, status")
      .eq("company_id", company.id)
      .eq("collaborator_ref", ref)
      .order("created_at", { ascending: false });

    const flatItems: Array<{ id: string; epi: string; ca: string; delivered: string }> = [];
    (deliveries ?? []).forEach((delivery) => {
      const items = Array.isArray(delivery.items) ? (delivery.items as DeliveryItem[]) : [];
      items.forEach((item, index) => {
        const ca = String(item?.ca ?? "");
        const name = String(item?.name ?? "");
        if (!name && !ca) return;
        flatItems.push({
          id: `${String(delivery.ref ?? "dep")}-${index}`,
          epi: name,
          ca,
          delivered: String(delivery.delivery_date ?? ""),
        });
      });
    });

    // Validade real do CA vem do catálogo CAEPI ativo (mesma base usada no app).
    const caNumbers = Array.from(new Set(flatItems.map((item) => onlyDigits(item.ca)).filter(Boolean)));
    const validityByCa = new Map<string, string>();
    if (caNumbers.length > 0) {
      const { data: catalog } = await admin
        .from("caepi_active_catalog")
        .select("ca_normalized, validade, situacao, ativo")
        .in("ca_normalized", caNumbers);
      (catalog ?? []).forEach((row) => {
        const key = String(row.ca_normalized ?? "");
        const validity = String(row.validade ?? "");
        if (!key || !validity) return;
        if (row.ativo === false) return;
        validityByCa.set(key, validity);
      });
    }

    const epis = flatItems.map((item) => {
      const expires = validityByCa.get(onlyDigits(item.ca)) ?? "";
      return { ...item, expires, status: epiStatus(expires) };
    });

    return jsonResponse({
      ok: true,
      company: companyBlock,
      collaborator: {
        ref: String(person.ref ?? ref),
        name: String(person.name ?? ""),
        role: String(person.role_function ?? ""),
        area: String(person.area ?? ""),
        establishment: String(person.establishment ?? ""),
        status: String(person.status ?? "Ativo"),
        photo: String(person.photo_url ?? ""),
        admissionDate: String(person.admission_date ?? ""),
        cpfMasked: maskCpf(String(person.cpf ?? "")),
        documentsOk: Number(person.documents_ok) || 0,
        documentsTotal: Number(person.documents_total) || 0,
        trainingsActive: Number(person.trainings_active) || 0,
        trainingsExpired: Number(person.trainings_expired) || 0,
        episInUse: Number(person.epis_in_use) || 0,
      },
      epis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
