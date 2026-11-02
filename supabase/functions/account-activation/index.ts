import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Ativação de primeiro acesso (usuário convidado).
 *
 * Regras de segurança:
 * - A senha é escolhida pelo próprio usuário no navegador. Nunca é gerada aqui.
 * - Só ativa e-mails JÁ PRÉ-AUTORIZADOS em `profiles` (auth_user_id nulo,
 *   status ativo) e de empresa ativa. Qualquer outro e-mail é recusado.
 * - Não cria perfil, não define empresa, não define papel. O vínculo continua
 *   sendo resolvido exclusivamente por `session_context()` no banco.
 * - Nenhum parâmetro do corpo permite escolher empresa, papel ou identidade.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function validatePassword(password: string, email: string): string | null {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (password.length > 72) return "A senha deve ter no máximo 72 caracteres.";
  const local = email.split("@")[0] ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local.toLowerCase())) {
    return "A senha não pode conter o seu e-mail.";
  }
  const weak = ["12345678", "123456789", "senha123", "password", "qwerty123", "admin123"];
  if (weak.includes(password.toLowerCase())) return "Esta senha é muito comum. Escolha outra.";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, error: "SERVER_NOT_CONFIGURED" }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  if (!email || !email.includes("@") || email.length > 160) {
    return jsonResponse({ ok: false, error: "INVALID_EMAIL", detail: "Informe um e-mail válido." });
  }

  const passwordError = validatePassword(password, email);
  if (passwordError) {
    return jsonResponse({ ok: false, error: "WEAK_PASSWORD", detail: passwordError });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, name, email, role, status, company_id, auth_user_id")
    .ilike("email", email);

  if (profileError) {
    return jsonResponse({ ok: false, error: "LOOKUP_FAILED", detail: "Não foi possível validar o e-mail agora." });
  }

  const matches = (profiles ?? []).filter((row) => String(row.email ?? "").toLowerCase() === email);

  if (matches.length === 0) {
    return jsonResponse({
      ok: false,
      error: "EMAIL_NOT_AUTHORIZED",
      detail: "Este e-mail não está pré-autorizado por nenhuma empresa. Peça ao administrador para liberar o acesso.",
    });
  }

  if (matches.length > 1) {
    return jsonResponse({
      ok: false,
      error: "AMBIGUOUS_PROFILE",
      detail: "Existe mais de um perfil autorizado com este e-mail. O administrador precisa corrigir o cadastro antes da ativação.",
    });
  }

  const profile = matches[0];

  if (profile.auth_user_id) {
    return jsonResponse({
      ok: false,
      error: "ALREADY_ACTIVE",
      detail: "Esta conta já foi ativada. Use a tela de login ou recupere a senha.",
    });
  }

  if (String(profile.status ?? "") !== "active") {
    return jsonResponse({
      ok: false,
      error: "PROFILE_INACTIVE",
      detail: "Seu vínculo com a empresa está inativo. Fale com o administrador para reativar o acesso.",
    });
  }

  const { data: company } = await admin
    .from("companies")
    .select("id, name, status")
    .eq("id", String(profile.company_id ?? ""))
    .maybeSingle();

  if (!company) {
    return jsonResponse({
      ok: false,
      error: "NO_COMPANY",
      detail: "Seu perfil não está associado a uma empresa válida. Regularize o cadastro com o administrador.",
    });
  }

  if (String(company.status ?? "") !== "active") {
    return jsonResponse({
      ok: false,
      error: "COMPANY_INACTIVE",
      detail: "O acesso desta empresa está suspenso. Nenhum dado foi excluído. Procure o administrador da plataforma.",
    });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: profile.name ?? null },
  });

  if (createError || !created?.user) {
    const message = String(createError?.message ?? "").toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return jsonResponse({
        ok: false,
        error: "ALREADY_REGISTERED",
        detail: "Já existe uma conta de acesso com este e-mail. Use a tela de login ou recupere a senha.",
      });
    }
    return jsonResponse({
      ok: false,
      error: "CREATE_FAILED",
      detail: "Não foi possível criar a conta de acesso. Tente novamente em instantes.",
    });
  }

  await admin.from("platform_audit_logs").insert({
    actor_auth_id: created.user.id,
    actor_name: profile.name ?? null,
    actor_email: email,
    action: "account_activated",
    target_company_id: company.id,
    target_company_name: company.name ?? null,
    target_user_id: profile.id,
    detail: {
      flow: "first_access",
      role: profile.role,
      email_confirmed_at_creation: true,
      ip,
    },
  });

  return jsonResponse({
    ok: true,
    detail: "Conta criada. Entre com o e-mail e a senha que você acabou de definir.",
  });
});
