// Edge Function: fiscalizacao-termo
//
// Parametrização do termo LGPD da consulta externa, com trilha de auditoria.
//
// Por que no servidor: a tabela `system_audit_logs` nega escrita pelo cliente
// (RLS deny-all) — é proposital. Então a alteração do termo e o registro de
// auditoria acontecem aqui, com a chave de serviço.
//
// Ações:
// - `salvar`    → valida o usuário logado, confere se ele é administrador da
//                 empresa, grava o texto e registra QUEM alterou e o TEXTO
//                 ANTERIOR completo no log de auditoria do sistema.
// - `historico` → devolve as últimas alterações do termo (autor, data/hora,
//                 texto anterior e texto novo).
//
// O token do usuário é validado com um cliente ANON; as operações de banco
// usam um cliente SERVICE ROLE separado. Nunca o contrário.

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

const CAMPO = "fiscalizacao_termo_lgpd";
const MAX_CHARS = 6000;
const MIN_CHARS = 40;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return jsonResponse({ ok: false, error: "service_unavailable" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ ok: false, error: "nao_autenticado", detail: "É preciso estar logado." }, 401);
  }

  try {
    // Cliente ANON: usado somente para identificar o usuário do token.
    const anon = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await anon.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ ok: false, error: "nao_autenticado", detail: "Sessão expirada." }, 401);
    }

    // Cliente SERVICE ROLE: só para banco/auditoria.
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, name, company_id")
      .eq("auth_user_id", user.id)
      .not("company_id", "is", null)
      .limit(1);

    const profile = Array.isArray(profileRows) ? profileRows[0] : null;
    const companyId = profile?.company_id ? String(profile.company_id) : "";
    if (!companyId) {
      return jsonResponse(
        { ok: false, error: "sem_empresa", detail: "Usuário sem empresa vinculada." },
        403,
      );
    }

    const { data: isAdmin } = await anon.rpc("is_company_admin", { p_company: companyId });
    if (isAdmin !== true) {
      return jsonResponse(
        {
          ok: false,
          error: "sem_permissao",
          detail: "Somente administradores da empresa podem alterar o termo de consulta.",
        },
        403,
      );
    }

    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const acao = String(payload?.acao ?? "salvar").trim().toLowerCase();
    const actorName = String(profile?.name ?? user.email ?? "").trim() || "Usuário do sistema";

    /* ---------------------------- Salvar o termo ---------------------------- */
    if (acao === "salvar") {
      const texto = String(payload?.texto ?? "").trim().slice(0, MAX_CHARS);
      if (texto.length > 0 && texto.length < MIN_CHARS) {
        return jsonResponse(
          {
            ok: false,
            error: "texto_curto",
            detail: `O termo precisa ter pelo menos ${MIN_CHARS} caracteres para ser compreensível.`,
          },
          400,
        );
      }

      const { data: current, error: readError } = await admin
        .from("company_settings")
        .select(CAMPO)
        .eq("company_id", companyId)
        .maybeSingle();
      if (readError) {
        return jsonResponse({ ok: false, error: "leitura_falhou", detail: readError.message }, 500);
      }

      const anterior = String((current as Record<string, unknown> | null)?.[CAMPO] ?? "").trim();
      const now = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from("company_settings")
        .update({ [CAMPO]: texto, updated_at: now })
        .eq("company_id", companyId)
        .select("company_id")
        .maybeSingle();

      if (updateError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: updateError.message }, 500);
      }
      if (!updated) {
        return jsonResponse(
          {
            ok: false,
            error: "configuracao_ausente",
            detail: "A configuração da empresa não foi encontrada. Abra Configurações novamente.",
          },
          409,
        );
      }

      const alterado = anterior !== texto;

      if (alterado) {
        const { error: auditError } = await admin.from("system_audit_logs").insert({
          company_id: companyId,
          module: "config",
          area: "qrcodes",
          action: texto ? "updated" : "deleted",
          entity: "company_settings",
          entity_id: companyId,
          field: CAMPO,
          // Texto anterior íntegro: é isso que permite auditar o que mudou.
          old_value: anterior || null,
          new_value: texto || null,
          detail: texto
            ? `Termo LGPD da consulta externa alterado por ${actorName}${anterior ? "" : " (antes valia o texto padrão do sistema)"}`
            : `Termo LGPD da consulta externa restaurado ao padrão por ${actorName}`,
          actor_id: user.id,
          actor_name: actorName,
        });
        if (auditError) {
          // O texto já foi gravado; avisamos que a trilha não foi registrada em
          // vez de fingir sucesso completo.
          return jsonResponse({
            ok: true,
            texto,
            atualizadoEm: now,
            alterado: true,
            auditoria: false,
            detail: `Termo salvo, mas o registro de auditoria falhou: ${auditError.message}`,
          });
        }
      }

      return jsonResponse({
        ok: true,
        texto,
        atualizadoEm: now,
        alterado,
        auditoria: alterado,
        detail: alterado ? "Termo salvo e alteração registrada na auditoria." : "Nenhuma alteração de texto.",
      });
    }

    /* ------------------------- Histórico de alterações ------------------------- */
    if (acao === "historico") {
      const { data, error } = await admin
        .from("system_audit_logs")
        .select("id, action, old_value, new_value, detail, actor_name, created_at")
        .eq("company_id", companyId)
        .eq("field", CAMPO)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        return jsonResponse({ ok: false, error: "historico_falhou", detail: error.message }, 500);
      }

      return jsonResponse({
        ok: true,
        registros: (data ?? []).map((row: any) => ({
          id: String(row.id),
          action: String(row.action ?? ""),
          textoAnterior: row.old_value === null ? "" : String(row.old_value),
          textoNovo: row.new_value === null ? "" : String(row.new_value),
          actorName: row.actor_name === null ? "" : String(row.actor_name),
          detail: String(row.detail ?? ""),
          createdAt: String(row.created_at ?? ""),
        })),
      });
    }

    return jsonResponse({ ok: false, error: "acao_invalida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
