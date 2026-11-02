// Edge Function: fiscalizacao-consulta
//
// Camada pública da ficha de verificação (QR-Code). Quatro ações:
//
// 1. `contexto`  — devolve o TERMO LGPD vigente da empresa.
// 2. `solicitar` — registra a consulta (nome, órgão, CPF, finalidade, aceite,
//                  data/hora) e abre uma SESSÃO AUTORIZADA de curta duração.
// 3. `ficha`     — valida o token da sessão no servidor e devolve o RESUMO
//                  REDUZIDO da ficha. É aqui que o fluxo deixa de terminar no
//                  protocolo.
// 4. `encerrar`  — revoga a sessão imediatamente.
//
// Regras de privacidade:
// - O token da sessão só existe no servidor como hash. Ele não é gravado em
//   banco em texto puro, nem em URL, nem em log.
// - A ficha devolvida é sempre reduzida: CPF mascarado, PIS/CTPS/admissão como
//   `***`, nenhum atestado, exame ou documento pessoal.
// - `fiscalizacao_consultas` e `fiscalizacao_sessoes` não têm policy de INSERT:
//   só esta função (chave de serviço) grava. O navegador não forja registro.

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

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Mesma regra do frontend: valida os dois dígitos verificadores. */
function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return checkDigit(digits, 9) === Number(digits[9]) && checkDigit(digits, 10) === Number(digits[10]);
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

/** Normaliza "vega", "vega.sstek.com.br" ou "https://vega.sstek.com.br" para "vega". */
function normalizeSubdomain(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  const withoutScheme = raw.replace(/^https?:\/\//, "");
  const host = withoutScheme.split("/")[0];
  return host.split(".")[0].replace(/[^a-z0-9-]/g, "");
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO → DD/MM/AAAA (data do banco, sem inventar valor). */
function formatDateBr(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function initials(name: string): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** `412.887.305-11` → `***.***.305-**`: confere a pessoa sem expor o documento. */
function maskCpfMiddle(cpf: string): string {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return "***.***.***-**";
  return `***.***.${digits.slice(6, 9)}-**`;
}

interface CompanyRow {
  id: string;
  name: string | null;
  subdomain: string | null;
}

/** Localiza a empresa pelo subdomínio e, sem ele, pelo próprio código do QR. */
async function resolveCompany(admin: any, empresa: string, codigo: string): Promise<CompanyRow | null> {
  if (empresa) {
    const { data } = await admin
      .from("companies")
      .select("id, name, subdomain")
      .eq("subdomain", empresa)
      .maybeSingle();
    if (data) return data as CompanyRow;
  }

  // Adesivos opacos antigos podem não carregar o subdomínio na URL. Nesse caso
  // o código só é aceito quando aponta para exatamente uma empresa.
  if (!codigo) return null;
  const { data: matches } = await admin
    .from("company_collaborators")
    .select("company_id")
    .eq("ref", codigo)
    .limit(2);

  const rows = (matches ?? []) as Array<{ company_id: string }>;
  if (rows.length !== 1) return null;

  const { data: company } = await admin
    .from("companies")
    .select("id, name, subdomain")
    .eq("id", rows[0].company_id)
    .maybeSingle();

  return (company as CompanyRow) ?? null;
}

interface DeliveryItem {
  name?: string;
  ca?: string;
}

/**
 * Monta o RESUMO REDUZIDO da ficha a partir do banco.
 *
 * Nada aqui é inventado: identidade vem de `company_collaborators`, EPIs das
 * entregas registradas e o resumo dos contadores reais de capacitação. O que
 * não existe no cadastro aparece como pendência de conferência, nunca como
 * dado preenchido à mão.
 */
async function buildFicha(admin: any, companyId: string, colaboradorRef: string) {
  const [{ data: collaborator }, { data: deliveries }, { data: company }] = await Promise.all([
    admin
      .from("company_collaborators")
      .select(
        "ref, name, cpf, role_function, area, status, active, photo_url, admission_date, updated_at, created_at, trainings_active, trainings_expired",
      )
      .eq("company_id", companyId)
      .eq("ref", colaboradorRef)
      .maybeSingle(),
    admin
      .from("epi_deliveries")
      .select("ref, delivery_date, items")
      .eq("company_id", companyId)
      .eq("collaborator_ref", colaboradorRef)
      .order("created_at", { ascending: false })
      .limit(40),
    admin.from("companies").select("name, subdomain").eq("id", companyId).maybeSingle(),
  ]);

  if (!collaborator) return null;

  const { data: settings } = await admin
    .from("company_settings")
    .select("company_legal_name")
    .eq("company_id", companyId)
    .maybeSingle();

  const epis: Array<{
    id: string;
    nome: string;
    ca: string;
    entrega: string;
    controleTroca: string;
    situacao: string;
  }> = [];

  (deliveries ?? []).forEach((delivery: any) => {
    const items = Array.isArray(delivery?.items) ? (delivery.items as DeliveryItem[]) : [];
    items.forEach((item, index) => {
      const nome = String(item?.name ?? "").trim();
      const ca = String(item?.ca ?? "").trim();
      if (!nome && !ca) return;
      epis.push({
        id: `${String(delivery?.ref ?? "dep")}-${index}`,
        nome: nome || "EPI sem descrição",
        ca,
        entrega: String(delivery?.delivery_date ?? ""),
        // A entrega registrada não informa controle de troca/inspeção. Nada é
        // marcado como vencido a partir da validade do CA.
        controleTroca: "",
        situacao: "conferir",
      });
    });
  });

  const ativos = Number(collaborator.trainings_active) || 0;
  const vencidos = Number(collaborator.trainings_expired) || 0;

  const cursos: Array<{ id: string; nome: string; criterio: string; situacao: string }> = [];
  if (ativos > 0) {
    cursos.push({
      id: "capacitacoes-ativas",
      nome: "Capacitações com registro ativo",
      criterio: `${ativos} registro(s)`,
      situacao: "vigente",
    });
  }
  if (vencidos > 0) {
    cursos.push({
      id: "capacitacoes-pendentes",
      nome: "Capacitações com atualização pendente",
      criterio: `${vencidos} registro(s) para renovar`,
      situacao: "pendente",
    });
  }

  const ref = String(collaborator.ref ?? colaboradorRef);
  const tail = ref.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  const companyName = String(settings?.company_legal_name ?? "").trim() || String(company?.name ?? "");
  const subdomain = String(company?.subdomain ?? "");

  return {
    empresa: {
      nome: companyName,
      enderecoWeb: subdomain ? `${subdomain}.sstek.com.br` : "",
    },
    colaborador: {
      nome: String(collaborator.name ?? ""),
      funcao: String(collaborator.role_function ?? "") || "Função não informada",
      setor: String(collaborator.area ?? "") || "Setor não informado",
      foto: String(collaborator.photo_url ?? ""),
      identificacao: `${initials(String(collaborator.name ?? ""))}-${tail || "SST"}`,
      cadastroAtivo: collaborator.active !== false,
      atualizadoEm: formatDateBr(String(collaborator.updated_at ?? collaborator.created_at ?? "")),
      cpf: maskCpfMiddle(String(collaborator.cpf ?? "")),
      pis: "***",
      ctps: "***",
      admissao: "***",
    },
    resumo: {
      capacitacaoPendente: vencidos,
      epiRevisao: 0,
      epiRegistrados: epis.length,
    },
    cursos,
    epis,
    conferenciaPresencial: true,
  };
}

function protocolFromId(id: string): string {
  return String(id ?? "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const acao = clean(payload?.acao, 24) || "contexto";
    const empresa = normalizeSubdomain(payload?.empresa);
    const codigo = clean(payload?.codigo, 64);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return jsonResponse({ ok: false, error: "service_unavailable" }, 500);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const company = acao === "ficha" || acao === "encerrar" ? null : await resolveCompany(admin, empresa, codigo);

    /* --------------------------- Termo vigente --------------------------- */
    if (acao === "contexto") {
      if (!company) {
        // Sem empresa identificada a resposta não expõe nada: o visitante
        // continua vendo o texto padrão do sistema.
        return jsonResponse({ ok: true, empresa: null, termo: "", termoPersonalizado: false });
      }

      const { data: settings } = await admin
        .from("company_settings")
        .select("fiscalizacao_termo_lgpd, updated_at")
        .eq("company_id", company.id)
        .maybeSingle();

      const termo = String(settings?.fiscalizacao_termo_lgpd ?? "").trim();

      return jsonResponse({
        ok: true,
        empresa: { nome: String(company.name ?? ""), subdominio: String(company.subdomain ?? "") },
        termo,
        termoPersonalizado: termo.length > 0,
        termoHash: termo ? await sha256Hex(termo) : "",
        atualizadoEm: String(settings?.updated_at ?? ""),
      });
    }

    /* ---------------------- Registro da solicitação ---------------------- */
    if (acao === "solicitar") {
      const nome = clean(payload?.consulenteNome ?? payload?.nome, 120);
      const orgao = clean(payload?.orgao, 120);
      const cpf = onlyDigits(clean(payload?.cpf, 20));
      const finalidade = clean(payload?.finalidade, 160);
      const termoAceito = payload?.termoAceito === true;

      if (!company) {
        return jsonResponse(
          {
            ok: false,
            error: "empresa_nao_identificada",
            detail:
              "Não foi possível identificar a empresa desta ficha pelo código lido. Escaneie novamente o QR-Code completo do adesivo.",
          },
          422,
        );
      }
      if (nome.length < 3) {
        return jsonResponse({ ok: false, error: "nome_invalido", detail: "Informe o nome completo." }, 400);
      }
      if (orgao.length < 2) {
        return jsonResponse({ ok: false, error: "orgao_invalido", detail: "Informe o órgão ou empresa." }, 400);
      }
      if (!isValidCpf(cpf)) {
        return jsonResponse(
          { ok: false, error: "cpf_invalido", detail: "CPF inválido. Confira os números digitados." },
          400,
        );
      }
      if (!termoAceito) {
        return jsonResponse(
          {
            ok: false,
            error: "termo_nao_aceito",
            detail: "É necessário aceitar o termo de tratamento de dados para registrar a consulta.",
          },
          400,
        );
      }

      // Freio simples de abuso: 5 solicitações por minuto por CPF/empresa.
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await admin
        .from("fiscalizacao_consultas")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("consultante_cpf", cpf)
        .gte("created_at", since);

      if (typeof count === "number" && count >= 5) {
        return jsonResponse(
          {
            ok: false,
            error: "muitas_solicitacoes",
            detail: "Muitas solicitações em sequência. Aguarde um minuto e tente novamente.",
          },
          429,
        );
      }

      const { data: settings } = await admin
        .from("company_settings")
        .select("fiscalizacao_termo_lgpd")
        .eq("company_id", company.id)
        .maybeSingle();

      const termo = String(settings?.fiscalizacao_termo_lgpd ?? "").trim();

      const { data: person } = await admin
        .from("company_collaborators")
        .select("ref")
        .eq("company_id", company.id)
        .eq("ref", codigo)
        .maybeSingle();

      const { data: inserted, error: insertError } = await admin
        .from("fiscalizacao_consultas")
        .insert({
          company_id: company.id,
          codigo_qr: codigo || "(vazio)",
          colaborador_ref: person?.ref ? String(person.ref) : null,
          consultante_nome: nome,
          consultante_orgao: orgao,
          consultante_cpf: cpf,
          finalidade,
          termo_aceito: true,
          termo_hash: termo ? await sha256Hex(termo) : "padrao-sistema",
          termo_personalizado: termo.length > 0,
          origem: "ficha_externa",
          cliente: clean(req.headers.get("user-agent"), 180),
        })
        .select("id, created_at")
        .maybeSingle();

      if (insertError) {
        return jsonResponse({ ok: false, error: "registro_falhou", detail: insertError.message }, 500);
      }

      const protocolo = protocolFromId(String(inserted?.id ?? ""));

      // Sem colaborador não há ficha para liberar: a sessão não é aberta.
      if (!person?.ref) {
        return jsonResponse({
          ok: true,
          protocolo,
          registradoEm: String(inserted?.created_at ?? new Date().toISOString()),
          sessao: null,
          detail:
            "Solicitação registrada. Este código não está vinculado a um colaborador ativo desta empresa, então nenhuma ficha é exibida.",
        });
      }

      /* ------------------ Sessão autorizada de curta duração ------------------ */
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      const { error: sessionError } = await admin.from("fiscalizacao_sessoes").insert({
        company_id: company.id,
        consulta_id: inserted?.id ?? null,
        colaborador_ref: String(person.ref),
        token_hash: tokenHash,
        escopo: "ficha_resumida",
        expires_at: expiresAt.toISOString(),
      });

      if (sessionError) {
        return jsonResponse({
          ok: true,
          protocolo,
          registradoEm: String(inserted?.created_at ?? new Date().toISOString()),
          sessao: null,
          detail:
            "Solicitação registrada, mas a sessão de consulta não pôde ser aberta agora. Tente novamente em instantes.",
        });
      }

      return jsonResponse({
        ok: true,
        protocolo,
        registradoEm: String(inserted?.created_at ?? new Date().toISOString()),
        sessao: { token, expiraEm: expiresAt.toISOString(), escopo: "ficha_resumida" },
        detail: "Solicitação registrada e sessão de consulta autorizada por 30 minutos.",
      });
    }

    /* ----------------------- Ficha com sessão válida ----------------------- */
    if (acao === "ficha") {
      const token = clean(payload?.token, 128);
      if (token.length < 32) {
        return jsonResponse({ ok: false, error: "sessao_invalida", detail: "Sessão inválida." }, 400);
      }

      const tokenHash = await sha256Hex(token);
      const { data: session } = await admin
        .from("fiscalizacao_sessoes")
        .select("id, company_id, consulta_id, colaborador_ref, expires_at, revoked_at, access_count")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!session) {
        return jsonResponse(
          { ok: false, error: "sessao_invalida", detail: "Sessão não encontrada. Faça a consulta novamente." },
          404,
        );
      }
      if (session.revoked_at) {
        return jsonResponse(
          { ok: false, error: "sessao_encerrada", detail: "Esta sessão de consulta foi encerrada." },
          410,
        );
      }
      if (new Date(String(session.expires_at)).getTime() <= Date.now()) {
        return jsonResponse(
          {
            ok: false,
            error: "sessao_expirada",
            detail: "A sessão de 30 minutos expirou. Registre uma nova consulta para ver a ficha.",
          },
          410,
        );
      }
      if (Number(session.access_count) >= 120) {
        return jsonResponse(
          { ok: false, error: "limite_de_acessos", detail: "Limite de acessos desta sessão atingido." },
          429,
        );
      }

      const ref = String(session.colaborador_ref ?? "");
      if (!ref) {
        return jsonResponse({ ok: false, error: "sem_colaborador", detail: "Ficha sem colaborador vinculado." }, 422);
      }

      const ficha = await buildFicha(admin, String(session.company_id), ref);
      if (!ficha) {
        return jsonResponse(
          {
            ok: false,
            error: "colaborador_nao_encontrado",
            detail: "O colaborador deste adesivo não está mais cadastrado nesta empresa.",
          },
          404,
        );
      }

      await admin
        .from("fiscalizacao_sessoes")
        .update({
          access_count: Number(session.access_count) + 1,
          last_access_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      const { data: consulta } = await admin
        .from("fiscalizacao_consultas")
        .select("id, created_at")
        .eq("id", session.consulta_id)
        .maybeSingle();

      return jsonResponse({
        ok: true,
        protocolo: protocolFromId(String(consulta?.id ?? session.consulta_id ?? session.id)),
        consultadoEm: String(consulta?.created_at ?? new Date().toISOString()),
        expiraEm: String(session.expires_at),
        escopo: "ficha_resumida",
        ficha,
      });
    }

    /* ---------------------------- Encerrar sessão ---------------------------- */
    if (acao === "encerrar") {
      const token = clean(payload?.token, 128);
      if (token.length < 32) {
        return jsonResponse({ ok: false, error: "sessao_invalida", detail: "Sessão inválida." }, 400);
      }
      const tokenHash = await sha256Hex(token);
      const { error } = await admin
        .from("fiscalizacao_sessoes")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null);
      if (error) {
        return jsonResponse({ ok: false, error: "falha_ao_encerrar", detail: error.message }, 500);
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "acao_invalida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});