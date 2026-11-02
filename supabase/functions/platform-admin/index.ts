import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  RESERVED_SUBDOMAINS,
  normalizeSubdomain,
  type OnboardingInput,
  sanitizeModules,
  validateOnboarding,
  validateSubdomain,
} from "../_shared/onboarding.ts";

/** Domínio raiz da plataforma (secret PLATFORM_ROOT_DOMAIN no Supabase). */
const ROOT_DOMAIN = (Deno.env.get("PLATFORM_ROOT_DOMAIN") ?? "sstek.com.br").trim().toLowerCase();

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

function passwordProblem(password: string, email: string): string | null {
  if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (password.length > 72) return "A senha deve ter no máximo 72 caracteres.";
  const local = email.split("@")[0] ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local.toLowerCase())) {
    return "A senha não pode conter o e-mail do usuário.";
  }
  const weak = ["12345678", "123456789", "senha123", "password", "qwerty123", "admin123"];
  if (weak.includes(password.toLowerCase())) return "Esta senha é muito comum. Escolha outra.";
  return null;
}

function validateDomain(value: string): string | null {
  const clean = value.trim().toLowerCase();
  if (clean.length < 4 || clean.length > 120) return "Informe um dominio valido.";
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])$/.test(clean) || !clean.includes(".")) {
    return `Informe um dominio valido (ex.: empresa.${ROOT_DOMAIN}).`;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse({ ok: false, error: "SERVER_NOT_CONFIGURED" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ ok: false, error: "AUTH_REQUIRED", detail: "Entre com uma conta real." }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(
    authHeader.replace(/^bearer\s+/i, "")
  );
  const user = userData?.user ?? null;
  if (userError || !user) {
    return jsonResponse({ ok: false, error: "INVALID_SESSION", detail: "Sessao invalida ou expirada." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: platformAdmin } = await admin
    .from("platform_admins")
    .select("auth_user_id, name, email, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!platformAdmin || platformAdmin.status !== "active") {
    await admin.from("platform_audit_logs").insert({
      actor_auth_id: user.id,
      actor_email: user.email ?? null,
      action: "access_denied",
      detail: { reason: "Usuario sem vinculo ativo de Superadministrador da plataforma." },
    });
    return jsonResponse({
      ok: false,
      error: "NOT_PLATFORM_ADMIN",
      detail: "Esta conta nao possui vinculo ativo de Superadministrador da plataforma. Administradores de empresa nao acessam funcoes globais.",
    }, 403);
  }

  const actor = {
    id: user.id,
    name: platformAdmin.name ?? user.email ?? "Superadministrador",
    email: platformAdmin.email ?? user.email ?? null,
  };

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  }

  const action = String(body.action ?? "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

  async function audit(params: {
    action: string;
    companyId?: string | null;
    companyName?: string | null;
    targetUserId?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await admin.from("platform_audit_logs").insert({
      actor_auth_id: actor.id,
      actor_name: actor.name,
      actor_email: actor.email,
      action: params.action,
      target_company_id: params.companyId ?? null,
      target_company_name: params.companyName ?? null,
      target_user_id: params.targetUserId ?? null,
      detail: { ...(params.detail ?? {}), ip },
    });
  }

  /**
   * Cria a conta de login (auth.users) já com senha e e-mail confirmado.
   * Devolve o auth user id ou uma resposta de erro pronta.
   */
  async function createLoginAccount(email: string, password: string, name: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || null },
    });
    if (error || !data?.user) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
        return {
          userId: null,
          response: jsonResponse({
            ok: false,
            error: "LOGIN_ALREADY_EXISTS",
            detail: "Já existe uma conta de login com este e-mail. Use outro e-mail ou redefina a senha da conta existente em Editar administrador principal.",
          }),
        };
      }
      if (message.includes("password")) {
        return {
          userId: null,
          response: jsonResponse({
            ok: false,
            error: "WEAK_PASSWORD",
            detail: "A senha informada foi recusada pelo serviço de autenticação. Use pelo menos 8 caracteres, com letras e números.",
          }),
        };
      }
      return {
        userId: null,
        response: jsonResponse({
          ok: false,
          error: "CREATE_USER_FAILED",
          detail: "Não foi possível criar a conta de login do usuário. Tente novamente em instantes.",
        }),
      };
    }
    return { userId: data.user.id as string, response: null };
  }

  async function companyById(id: string) {
    const { data } = await admin
      .from("companies")
      .select("id, name, legal_name, cnpj, subdomain, plan, status, suspended_at, suspension_reason, notes, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    return data;
  }

  try {
    if (action === "me") return jsonResponse({ ok: true, admin: actor });

    if (action === "overview") {
      const { data: companies, error } = await admin
        .from("companies")
        .select("id, name, legal_name, cnpj, subdomain, plan, status, suspended_at, suspension_reason, notes, created_at, updated_at")
        .order("name", { ascending: true });
      if (error) throw new Error(error.message);

      const ids = (companies ?? []).map((c) => String(c.id));
      const safeIds = ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
      const { data: domains } = await admin
        .from("company_domains")
        .select("id, company_id, domain, kind, is_primary, dns_status, https_status, dns_checked_at, notes")
        .order("domain", { ascending: true });
      const { data: admins } = await admin
        .from("profiles")
        .select("id, company_id, role, name, email, phone, status, auth_user_id, is_primary_admin, created_at")
        .in("company_id", safeIds)
        .order("created_at", { ascending: true });
      const { data: collaborators } = await admin
        .from("company_collaborators")
        .select("company_id")
        .in("company_id", safeIds);

      const collabCount = new Map<string, number>();
      for (const row of collaborators ?? []) {
        const key = String(row.company_id);
        collabCount.set(key, (collabCount.get(key) ?? 0) + 1);
      }

      const { data: auditRows } = await admin
        .from("platform_audit_logs")
        .select("id, actor_name, actor_email, action, target_company_id, target_company_name, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(60);

      const { data: batch } = await admin
        .from("caepi_import_batches")
        .select("id, file_name, row_count, rejected_count, is_active, status, created_at, encoding, delimiter_char")
        .eq("is_active", true)
        .maybeSingle();

      const { count: catalogRows } = await admin
        .from("caepi_catalog_entries")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch?.id ?? "00000000-0000-0000-0000-000000000000");

      return jsonResponse({
        ok: true,
        admin: actor,
        companies: (companies ?? []).map((c) => ({ ...c, collaborators: collabCount.get(String(c.id)) ?? 0 })),
        domains: domains ?? [],
        companyAdmins: admins ?? [],
        audit: auditRows ?? [],
        activeCatalog: batch ? { ...batch, catalogRows: catalogRows ?? 0 } : null,
        reservedSubdomains: [...RESERVED_SUBDOMAINS],
      });
    }

    if (action === "upsert_company") {
      const companyId = body.companyId ? String(body.companyId) : null;
      const name = String(body.name ?? "").trim();
      if (name.length < 2) return jsonResponse({ ok: false, error: "INVALID_NAME", detail: "Informe o nome da empresa." });
      const subdomain = normalizeSubdomain(body.subdomain);
      const subdomainError = validateSubdomain(subdomain);
      if (subdomainError) return jsonResponse({ ok: false, error: "INVALID_SUBDOMAIN", detail: subdomainError });

      const { data: existing } = await admin
        .from("companies")
        .select("id, name, subdomain")
        .ilike("subdomain", subdomain)
        .maybeSingle();
      if (existing && existing.id !== companyId) {
        return jsonResponse({ ok: false, error: "SUBDOMAIN_TAKEN", detail: "Este subdominio ja esta em uso por outra empresa." });
      }

      // Subdominio imutavel: enquanto nao houver procedimento seguro de migracao
      // de arquivos e dominios, o fluxo normal NAO altera o subdominio de uma
      // empresa existente. A troca precisa ser tratada como operacao planejada.
      if (companyId) {
        const current = await companyById(companyId);
        if (!current) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
        if (String(current.subdomain ?? "").toLowerCase() !== subdomain) {
          return jsonResponse(
            {
              ok: false,
              error: "SUBDOMAIN_IMMUTABLE",
              detail:
                "O subdominio da empresa nao pode ser alterado por este fluxo. A troca exige um procedimento planejado e nao move arquivos automaticamente.",
            },
            409,
          );
        }
      }

      const payload = {
        name,
        subdomain,
        legal_name: body.legalName ? String(body.legalName).trim() : null,
        cnpj: body.cnpj ? String(body.cnpj).trim() : null,
        plan: body.plan ? String(body.plan) : "S2",
        notes: body.notes ? String(body.notes) : null,
      };

      const primaryRaw = body.primaryAdmin && typeof body.primaryAdmin === "object"
        ? (body.primaryAdmin as Record<string, unknown>)
        : null;
      const adminName = String(primaryRaw?.name ?? "").trim();
      const adminEmail = String(primaryRaw?.email ?? "").trim().toLowerCase();
      const adminPhone = String(primaryRaw?.phone ?? "").trim();
      const adminPassword = String(primaryRaw?.password ?? "");
      const wantsAdmin = Boolean(adminName || adminEmail);

      let currentPrimary: { id: string; email: string | null; auth_user_id: string | null } | null = null;
      if (companyId) {
        const { data } = await admin
          .from("profiles")
          .select("id, email, auth_user_id")
          .eq("company_id", companyId)
          .eq("is_primary_admin", true)
          .maybeSingle();
        currentPrimary = (data as { id: string; email: string | null; auth_user_id: string | null } | null) ?? null;
      }

      if (!companyId && (!adminName || !adminEmail)) {
        return jsonResponse({
          ok: false,
          error: "PRIMARY_ADMIN_REQUIRED",
          detail: "Informe o nome e o e-mail do administrador responsavel pelo primeiro acesso da empresa.",
        });
      }

      if (wantsAdmin) {
        if (adminName.length < 2) {
          return jsonResponse({ ok: false, error: "INVALID_ADMIN_NAME", detail: "Informe o nome do administrador responsavel." });
        }
        if (!adminEmail.includes("@") || adminEmail.length > 160) {
          return jsonResponse({ ok: false, error: "INVALID_ADMIN_EMAIL", detail: "Informe um e-mail valido para o administrador responsavel." });
        }
        if (adminPassword) {
          const problem = passwordProblem(adminPassword, adminEmail);
          if (problem) return jsonResponse({ ok: false, error: "WEAK_PASSWORD", detail: problem });
        }
        if (!currentPrimary && !adminPassword) {
          return jsonResponse({
            ok: false,
            error: "PASSWORD_REQUIRED",
            detail: "Informe a senha de acesso do administrador responsavel (minimo 8 caracteres).",
          });
        }
        const { data: clash } = await admin
          .from("profiles")
          .select("id, company_id")
          .ilike("email", adminEmail)
          .maybeSingle();
        if (clash && clash.id !== currentPrimary?.id) {
          const otherCompany = Boolean(clash.company_id) && clash.company_id !== companyId;
          return jsonResponse({
            ok: false,
            error: otherCompany ? "ADMIN_EMAIL_IN_OTHER_COMPANY" : "ADMIN_EMAIL_TAKEN",
            detail: otherCompany
              ? "Este e-mail ja esta vinculado a outra empresa. Use outro e-mail para o administrador responsavel."
              : "Este e-mail ja esta em uso por outro perfil. Use outro e-mail para o administrador responsavel.",
          });
        }
        if (currentPrimary?.auth_user_id && currentPrimary.email && currentPrimary.email.toLowerCase() !== adminEmail) {
          return jsonResponse({
            ok: false,
            error: "ADMIN_EMAIL_LOCKED",
            detail: "A conta do administrador principal ja foi ativada. O e-mail de login nao pode ser trocado por aqui.",
          });
        }
      }

      if (companyId) {
        const before = await companyById(companyId);
        const { error } = await admin.from("companies").update(payload).eq("id", companyId);
        if (error) throw new Error(error.message);

        if (wantsAdmin) {
          if (currentPrimary) {
            let authUserId = currentPrimary.auth_user_id ?? null;
            let passwordReset = false;

            if (adminPassword) {
              if (authUserId) {
                const { error: passwordError } = await admin.auth.admin.updateUserById(authUserId, {
                  password: adminPassword,
                });
                if (passwordError) {
                  return jsonResponse({
                    ok: false,
                    error: "PASSWORD_UPDATE_FAILED",
                    detail: "Não foi possível atualizar a senha do administrador principal. Tente novamente.",
                  });
                }
                passwordReset = true;
              } else {
                const created = await createLoginAccount(adminEmail, adminPassword, adminName);
                if (created.response) return created.response;
                authUserId = created.userId;
              }
            }

            const { error: adminError } = await admin
              .from("profiles")
              .update({
                name: adminName,
                email: adminEmail,
                phone: adminPhone || null,
                role: "admin",
                status: "active",
                ...(authUserId ? { auth_user_id: authUserId } : {}),
              })
              .eq("id", currentPrimary.id);
            if (adminError) throw new Error(adminError.message);

            if (passwordReset) {
              await admin.from("system_audit_logs").insert({
                company_id: companyId,
                module: "plataforma",
                area: "usuarios",
                action: "password_reset",
                entity: "Administrador principal",
                entity_id: currentPrimary.id,
                detail: `Senha de acesso do administrador principal ${adminEmail} redefinida pelo superadministrador.`,
                actor_id: actor.id,
                actor_name: actor.name,
              });
            }
          } else {
            const created = await createLoginAccount(adminEmail, adminPassword, adminName);
            if (created.response) return created.response;
            const { error: adminError } = await admin.from("profiles").insert({
              company_id: companyId,
              name: adminName,
              email: adminEmail,
              phone: adminPhone || null,
              role: "admin",
              status: "active",
              is_primary_admin: true,
              auth_user_id: created.userId,
            });
            if (adminError) {
              if (created.userId) await admin.auth.admin.deleteUser(created.userId);
              throw new Error(adminError.message);
            }
          }
        }

        await audit({
          action: "company_updated",
          companyId,
          companyName: name,
          detail: { before, after: payload, primaryAdminEmail: adminEmail || currentPrimary?.email || null },
        });
      } else {
        const { data, error } = await admin
          .from("companies")
          .insert({ ...payload, status: "active", created_by: actor.id })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "Nao foi possivel cadastrar a empresa.");
        await admin.from("company_domains").insert({
          company_id: data.id,
          domain: `${subdomain}.${ROOT_DOMAIN}`,
          kind: "subdomain",
          is_primary: true,
          dns_status: "pending",
          https_status: "pending",
          notes: "Registro criado no cadastro da empresa. Configuracao de DNS/HTTPS e externa.",
        });

        const created = await createLoginAccount(adminEmail, adminPassword, adminName);
        if (created.response) {
          await admin.from("company_domains").delete().eq("company_id", data.id);
          await admin.from("companies").delete().eq("id", data.id);
          return created.response;
        }

        const { error: adminError } = await admin.from("profiles").insert({
          company_id: data.id,
          name: adminName,
          email: adminEmail,
          phone: adminPhone || null,
          role: "admin",
          status: "active",
          is_primary_admin: true,
          auth_user_id: created.userId,
        });
        if (adminError) {
          if (created.userId) await admin.auth.admin.deleteUser(created.userId);
          await admin.from("company_domains").delete().eq("company_id", data.id);
          await admin.from("companies").delete().eq("id", data.id);
          return jsonResponse({
            ok: false,
            error: "PRIMARY_ADMIN_FAILED",
            detail: "Nao foi possivel cadastrar o administrador responsavel. A empresa nao foi criada.",
          });
        }

        await audit({
          action: "company_created",
          companyId: String(data.id),
          companyName: name,
          detail: { subdomain, plan: payload.plan, primaryAdminName: adminName, primaryAdminEmail: adminEmail },
        });
      }
      return jsonResponse({
        ok: true,
        detail: companyId ? "Empresa atualizada." : "Empresa cadastrada com administrador responsavel.",
      });
    }

    if (action === "set_company_status") {
      const companyId = String(body.companyId ?? "");
      const status = String(body.status ?? "");
      if (!["active", "suspended", "trial"].includes(status)) {
        return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 400);
      }
      const before = await companyById(companyId);
      if (!before) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);

      const patch = status === "suspended"
        ? { status, suspended_at: new Date().toISOString(), suspension_reason: body.reason ? String(body.reason) : "Suspensao administrativa." }
        : { status, suspended_at: null, suspension_reason: null };

      const { error } = await admin.from("companies").update(patch).eq("id", companyId);
      if (error) throw new Error(error.message);

      await audit({
        action: status === "suspended" ? "company_suspended" : "company_reactivated",
        companyId,
        companyName: String(before.name),
        detail: { before: before.status, after: status, reason: patch.suspension_reason ?? null },
      });

      return jsonResponse({
        ok: true,
        detail: status === "suspended" ? "Empresa suspensa. O acesso fica bloqueado e nenhum dado foi excluido." : "Empresa reativada.",
      });
    }

    if (action === "upsert_domain") {
      const companyId = String(body.companyId ?? "");
      const rawDomain = String(body.domain ?? "").trim().toLowerCase();
      const domainError = validateDomain(rawDomain);
      if (domainError) return jsonResponse({ ok: false, error: "INVALID_DOMAIN", detail: domainError });
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);

      const { data: clash } = await admin
        .from("company_domains")
        .select("id, company_id")
        .ilike("domain", rawDomain)
        .maybeSingle();
      const domainId = body.domainId ? String(body.domainId) : null;
      if (clash && clash.id !== domainId) {
        return jsonResponse({ ok: false, error: "DOMAIN_TAKEN", detail: "Este dominio/subdominio ja esta vinculado a outra empresa." });
      }

      const payload = {
        company_id: companyId,
        domain: rawDomain,
        kind: rawDomain.endsWith(`.${ROOT_DOMAIN}`) ? "subdomain" : "custom",
        is_primary: Boolean(body.isPrimary),
        dns_status: String(body.dnsStatus ?? "pending"),
        https_status: String(body.httpsStatus ?? "pending"),
        notes: body.notes ? String(body.notes) : null,
      };

      if (domainId) {
        const { error } = await admin.from("company_domains").update(payload).eq("id", domainId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from("company_domains").insert(payload);
        if (error) throw new Error(error.message);
      }

      await audit({
        action: "domain_saved",
        companyId,
        companyName: String(company.name),
        detail: { domain: rawDomain, kind: payload.kind, dns: payload.dns_status, https: payload.https_status },
      });
      return jsonResponse({ ok: true });
    }

    if (action === "upsert_company_admin") {
      const companyId = String(body.companyId ?? "");
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const role = body.role ? String(body.role) : "admin";
      if (!name) return jsonResponse({ ok: false, error: "INVALID_NAME" }, 400);
      if (!email.includes("@")) return jsonResponse({ ok: false, error: "INVALID_EMAIL" }, 400);
      if (!["admin", "collaborator"].includes(role)) {
        return jsonResponse({ ok: false, error: "ROLE_NOT_ALLOWED", detail: "Somente Administrador e Colaborador podem ser vinculados a uma empresa por aqui." });
      }
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);

      const { data: existing } = await admin
        .from("profiles")
        .select("id, company_id, role, name, email, status, is_primary_admin, auth_user_id")
        .ilike("email", email)
        .maybeSingle();

      const password = String(body.password ?? "");
      const alreadyActive = Boolean(existing?.auth_user_id);
      if (!alreadyActive) {
        if (!password) {
          return jsonResponse({
            ok: false,
            error: "PASSWORD_REQUIRED",
            detail: "Informe a senha de acesso do usuário (mínimo 8 caracteres).",
          });
        }
        const problem = passwordProblem(password, email);
        if (problem) return jsonResponse({ ok: false, error: "WEAK_PASSWORD", detail: problem });
      } else if (password) {
        const problem = passwordProblem(password, email);
        if (problem) return jsonResponse({ ok: false, error: "WEAK_PASSWORD", detail: problem });
      }

      if (existing?.is_primary_admin) {
        return jsonResponse({
          ok: false,
          error: "PRIMARY_ADMIN_PROTECTED",
          detail: "Este e-mail pertence ao administrador principal da empresa. Alteracoes desse vinculo sao feitas exclusivamente na edicao do administrador principal.",
        });
      }

      if (existing) {
        if (existing.company_id && existing.company_id !== companyId) {
          return jsonResponse({ ok: false, error: "ADMIN_IN_OTHER_COMPANY", detail: "Este e-mail ja esta vinculado a outra empresa. Revise antes de transferir." });
        }

        let authUserId = (existing.auth_user_id as string | null) ?? null;
        if (password) {
          if (authUserId) {
            const { error: passwordError } = await admin.auth.admin.updateUserById(authUserId, { password });
            if (passwordError) {
              return jsonResponse({ ok: false, error: "PASSWORD_UPDATE_FAILED", detail: "Não foi possível atualizar a senha deste usuário." });
            }
          } else {
            const created = await createLoginAccount(email, password, name);
            if (created.response) return created.response;
            authUserId = created.userId;
          }
        }

        const { error } = await admin
          .from("profiles")
          .update({
            company_id: companyId,
            name,
            role,
            status: "active",
            ...(authUserId ? { auth_user_id: authUserId } : {}),
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        await audit({ action: "company_admin_updated", companyId, companyName: String(company.name), targetUserId: String(existing.id), detail: { email, role, passwordSet: Boolean(password) } });
      } else {
        const created = await createLoginAccount(email, password, name);
        if (created.response) return created.response;
        const { data, error } = await admin
          .from("profiles")
          .insert({
            company_id: companyId,
            name,
            email,
            role,
            status: "active",
            is_primary_admin: false,
            auth_user_id: created.userId,
          })
          .select("id")
          .single();
        if (error || !data) {
          if (created.userId) await admin.auth.admin.deleteUser(created.userId);
          throw new Error(error?.message ?? "Nao foi possivel vincular o administrador.");
        }
        await audit({ action: "company_admin_linked", companyId, companyName: String(company.name), targetUserId: String(data.id), detail: { email, role } });
      }
      return jsonResponse({ ok: true, detail: "Usuário vinculado com senha de acesso ativa." });
    }

    if (action === "update_primary_admin") {
      const companyId = String(body.companyId ?? "");
      const profileId = body.profileId ? String(body.profileId) : null;
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
      if (name.length < 2) {
        return jsonResponse({ ok: false, error: "INVALID_ADMIN_NAME", detail: "Informe o nome do administrador principal." });
      }
      if (!email.includes("@") || email.length > 160) {
        return jsonResponse({ ok: false, error: "INVALID_ADMIN_EMAIL", detail: "Informe um e-mail valido para o administrador principal." });
      }

      let profileQuery = admin
        .from("profiles")
        .select("id, name, email, phone, auth_user_id")
        .eq("company_id", companyId)
        .eq("is_primary_admin", true);
      if (profileId) profileQuery = profileQuery.eq("id", profileId);
      const { data: profile } = await profileQuery.maybeSingle();
      if (!profile) return jsonResponse({ ok: false, error: "PRIMARY_ADMIN_NOT_FOUND" }, 404);

      if (profile.auth_user_id && profile.email && String(profile.email).toLowerCase() !== email) {
        return jsonResponse({
          ok: false,
          error: "ADMIN_EMAIL_LOCKED",
          detail: "A conta do administrador principal ja foi ativada. O e-mail de login nao pode ser trocado por aqui.",
        });
      }

      const { data: clash } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
      if (clash && clash.id !== profile.id) {
        return jsonResponse({
          ok: false,
          error: "ADMIN_EMAIL_TAKEN",
          detail: "Este e-mail ja esta em uso por outro perfil. Use outro e-mail.",
        });
      }

      const password = String(body.password ?? "");
      if (password) {
        const problem = passwordProblem(password, email);
        if (problem) return jsonResponse({ ok: false, error: "WEAK_PASSWORD", detail: problem });
      }

      const { error } = await admin
        .from("profiles")
        .update({ name, email, phone: phone || null, role: "admin", status: "active" })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);

      let passwordChanged = false;
      if (password) {
        if (profile.auth_user_id) {
          const { error: passwordError } = await admin.auth.admin.updateUserById(String(profile.auth_user_id), { password });
          if (passwordError) {
            return jsonResponse({
              ok: false,
              error: "PASSWORD_UPDATE_FAILED",
              detail: "Não foi possível redefinir a senha do administrador principal.",
            });
          }
        } else {
          const created = await createLoginAccount(email, password, name);
          if (created.response) return created.response;
          await admin.from("profiles").update({ auth_user_id: created.userId }).eq("id", profile.id);
        }
        passwordChanged = true;

        await admin.from("system_audit_logs").insert({
          company_id: companyId,
          module: "plataforma",
          area: "usuarios",
          action: "password_reset",
          entity: "Administrador principal",
          entity_id: profile.id,
          detail: `Senha de acesso do administrador principal ${email} redefinida pelo superadministrador.`,
          actor_id: actor.id,
          actor_name: actor.name,
        });
      }

      await audit({
        action: "primary_admin_updated",
        companyId,
        companyName: String(company.name),
        targetUserId: String(profile.id),
        detail: {
          before: { name: profile.name, email: profile.email, phone: profile.phone },
          after: { name, email, phone: phone || null },
          passwordChanged,
        },
      });

      return jsonResponse({
        ok: true,
        detail: passwordChanged
          ? "Administrador principal atualizado e senha de acesso redefinida."
          : "Administrador principal atualizado.",
      });
    }

    if (action === "revoke_primary_admin") {
      const companyId = String(body.companyId ?? "");
      const profileId = String(body.profileId ?? "");
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, name, email")
        .eq("company_id", companyId)
        .eq("id", profileId)
        .eq("is_primary_admin", true)
        .maybeSingle();
      if (!profile) return jsonResponse({ ok: false, error: "PRIMARY_ADMIN_NOT_FOUND" }, 404);

      const { error } = await admin
        .from("profiles")
        .update({ is_primary_admin: false, status: "inactive", sessions_invalidated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);

      await audit({
        action: "primary_admin_revoked",
        companyId,
        companyName: String(company.name),
        targetUserId: String(profile.id),
        detail: { name: profile.name, email: profile.email },
      });

      return jsonResponse({
        ok: true,
        detail: "Acesso do administrador principal revogado. Nenhum dado da empresa foi excluido.",
      });
    }

    if (action === "support_access") {
      const companyId = String(body.companyId ?? "");
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 8) {
        return jsonResponse({ ok: false, error: "REASON_REQUIRED", detail: "Descreva o motivo do acesso de suporte (minimo 8 caracteres). O acesso e registrado em auditoria." });
      }
      await audit({ action: "support_access", companyId, companyName: String(company.name), detail: { reason, explicit: true } });
      return jsonResponse({ ok: true, detail: "Acesso de suporte registrado na auditoria." });
    }

    if (action === "caepi_history") {
      const { data: batches } = await admin
        .from("caepi_import_batches")
        .select("id, file_name, file_size, row_count, inserted_count, updated_count, rejected_count, status, is_active, encoding, delimiter_char, uploaded_by_name, error_message, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(30);
      const { data: logs } = await admin
        .from("caepi_import_logs")
        .select("id, batch_id, action, detail, actor_name, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      return jsonResponse({ ok: true, batches: batches ?? [], logs: logs ?? [] });
    }

    if (action === "caepi_activate") {
      const batchId = String(body.batchId ?? "");
      const { data: batch } = await admin
        .from("caepi_import_batches")
        .select("id, file_name, row_count, rejected_count, status")
        .eq("id", batchId)
        .maybeSingle();
      if (!batch) return jsonResponse({ ok: false, error: "BATCH_NOT_FOUND" }, 404);

      const { data, error } = await admin.rpc("caepi_activate_batch", { p_batch_id: batchId });
      if (error) return jsonResponse({ ok: false, error: "ACTIVATION_FAILED", detail: error.message }, 400);
      const result = (Array.isArray(data) ? data[0] : data) as { activated_id: string; records: number; previous_id: string | null } | null;

      await audit({
        action: "caepi_batch_activated",
        detail: {
          batchId,
          fileName: batch.file_name,
          records: result?.records ?? batch.row_count,
          rejected: batch.rejected_count,
          previousBatchId: result?.previous_id ?? null,
        },
      });

      return jsonResponse({
        ok: true,
        detail: `Base ativada com ${Number(result?.records ?? 0).toLocaleString("pt-BR")} registros.`,
        records: result?.records ?? 0,
      });
    }

    if (action === "caepi_errors") {
      const batchId = String(body.batchId ?? "");
      const limit = Math.min(Number(body.limit ?? 200), 1000);
      const { data } = await admin
        .from("caepi_import_errors")
        .select("line_no, column_name, value_text, reason, row_preview")
        .eq("batch_id", batchId)
        .order("line_no", { ascending: true })
        .limit(limit);
      return jsonResponse({ ok: true, errors: data ?? [] });
    }

    if (action === "log_access") {
      const screen = String(body.screen ?? "overview");
      await audit({
        action: "platform_panel_access",
        detail: {
          screen,
          path: body.path ? String(body.path) : null,
          user_agent: req.headers.get("user-agent") ?? null,
        },
      });
      return jsonResponse({ ok: true });
    }

    if (action === "settings_get") {
      const { data } = await admin
        .from("platform_settings")
        .select("parameters, role_permissions, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (!data) {
        await admin.from("platform_settings").insert({ id: 1 });
        return jsonResponse({ ok: true, parameters: {}, rolePermissions: {}, updatedAt: null });
      }
      return jsonResponse({
        ok: true,
        parameters: data.parameters ?? {},
        rolePermissions: data.role_permissions ?? {},
        updatedAt: data.updated_at ?? null,
      });
    }

    if (action === "settings_save") {
      const kind = String(body.kind ?? "");
      const value = body.value;
      if (!["parameters", "role_permissions"].includes(kind)) {
        return jsonResponse({ ok: false, error: "INVALID_KIND" }, 400);
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return jsonResponse({ ok: false, error: "INVALID_VALUE", detail: "Payload invalido." }, 400);
      }
      const patch: Record<string, unknown> = {
        id: 1,
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      };
      if (kind === "parameters") patch.parameters = value;
      else patch.role_permissions = value;

      const { error } = await admin.from("platform_settings").upsert(patch, { onConflict: "id" });
      if (error) throw new Error(error.message);

      await audit({
        action: kind === "parameters" ? "platform_parameters_saved" : "platform_permissions_saved",
        detail: { keys: Object.keys(value as Record<string, unknown>).length },
      });
      return jsonResponse({
        ok: true,
        detail: kind === "parameters" ? "Parametrizacao por perfil salva." : "Perfil e permissoes salvos.",
      });
    }

    if (action === "modules_get") {
      const { data } = await admin
        .from("system_settings")
        .select("enabled_modules, updated_at")
        .eq("id", 1)
        .maybeSingle();
      return jsonResponse({
        ok: true,
        modules: data?.enabled_modules ?? {},
        updatedAt: data?.updated_at ?? null,
      });
    }

    // Modulos contratados sao definidos AQUI (plataforma). O cliente so le.
    if (action === "modules_save") {
      const modules = body.modules;
      if (!modules || typeof modules !== "object" || Array.isArray(modules)) {
        return jsonResponse({ ok: false, error: "INVALID_VALUE", detail: "Payload invalido." }, 400);
      }
      const normalized: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(modules as Record<string, unknown>)) {
        if (typeof key === "string" && typeof value === "boolean") normalized[key] = value;
      }
      const { error } = await admin
        .from("system_settings")
        .upsert(
          { id: 1, enabled_modules: normalized, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
      if (error) throw new Error(error.message);

      await audit({
        action: "platform_modules_saved",
        detail: { disabled: Object.entries(normalized).filter(([, on]) => !on).map(([id]) => id) },
      });
      return jsonResponse({ ok: true, detail: "Modulos da plataforma salvos." });
    }

    if (action === "licenses_overview") {
      const { data: companies, error: companyError } = await admin
        .from("companies")
        .select("id, name, subdomain, plan, status, created_at")
        .order("name", { ascending: true });
      if (companyError) throw new Error(companyError.message);

      const { data: licenses } = await admin.from("company_licenses").select("*");
      const { data: collabs } = await admin.from("company_collaborators").select("company_id");

      const counts = new Map<string, number>();
      for (const row of collabs ?? []) {
        const key = String(row.company_id);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const licenseByCompany = new Map<string, Record<string, unknown>>();
      for (const row of licenses ?? []) {
        licenseByCompany.set(String(row.company_id), row as Record<string, unknown>);
      }

      const rows = (companies ?? []).map((company) => {
        const lic = licenseByCompany.get(String(company.id));
        return {
          companyId: company.id,
          companyName: company.name,
          subdomain: company.subdomain,
          companyPlan: company.plan,
          companyStatus: company.status,
          collaborators: counts.get(String(company.id)) ?? 0,
          plan: lic?.plan ?? company.plan,
          seats: lic?.seats ?? 0,
          monthlyValue: Number(lic?.monthly_value ?? 0),
          billingCycle: lic?.billing_cycle ?? "monthly",
          status: lic?.status ?? "active",
          startedAt: lic?.started_at ?? null,
          nextDueDate: lic?.next_due_date ?? null,
          notes: lic?.notes ?? null,
        };
      });

      return jsonResponse({ ok: true, licenses: rows });
    }

    if (action === "license_save") {
      const companyId = String(body.companyId ?? "");
      if (!companyId) return jsonResponse({ ok: false, error: "COMPANY_REQUIRED" }, 400);
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);

      const monthlyValue = Number(body.monthlyValue ?? 0);
      const seats = Number(body.seats ?? 0);
      if (!Number.isFinite(monthlyValue) || monthlyValue < 0) {
        return jsonResponse({ ok: false, error: "INVALID_VALUE", detail: "Informe um valor mensal valido." }, 400);
      }
      if (!Number.isFinite(seats) || seats < 0) {
        return jsonResponse({ ok: false, error: "INVALID_SEATS", detail: "Informe um numero de assentos valido." }, 400);
      }

      const payload = {
        company_id: companyId,
        plan: String(body.plan ?? "S2"),
        seats: Math.round(seats),
        monthly_value: Number(monthlyValue.toFixed(2)),
        billing_cycle: String(body.billingCycle ?? "monthly"),
        status: String(body.status ?? "active"),
        next_due_date: body.nextDueDate ? String(body.nextDueDate) : null,
        notes: body.notes ? String(body.notes) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await admin.from("company_licenses").upsert(payload, { onConflict: "company_id" });
      if (error) throw new Error(error.message);

      await audit({
        action: "license_saved",
        companyId,
        companyName: String(company.name),
        detail: {
          plan: payload.plan,
          seats: payload.seats,
          monthlyValue: payload.monthly_value,
          billingCycle: payload.billing_cycle,
          status: payload.status,
        },
      });
      return jsonResponse({ ok: true, detail: "Licenca atualizada." });
    }

    if (action === "payments_overview") {
      const { data: invoices, error: invoiceError } = await admin
        .from("platform_invoices")
        .select("id, company_id, reference_month, amount, status, due_date, paid_at, method, notes, created_at")
        .order("due_date", { ascending: false })
        .limit(400);
      if (invoiceError) throw new Error(invoiceError.message);

      const ids = Array.from(new Set((invoices ?? []).map((row) => String(row.company_id))));
      const safeIds = ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
      const { data: companies } = await admin
        .from("companies")
        .select("id, name, subdomain, plan, status")
        .in("id", safeIds)
        .order("name", { ascending: true });

      const companyMap = new Map<string, Record<string, unknown>>();
      for (const company of companies ?? []) companyMap.set(String(company.id), company as Record<string, unknown>);

      return jsonResponse({
        ok: true,
        companies: companies ?? [],
        invoices: (invoices ?? []).map((row) => {
          const company = companyMap.get(String(row.company_id));
          return {
            ...row,
            amount: Number(row.amount),
            company_name: company?.name ?? null,
            company_subdomain: company?.subdomain ?? null,
            company_plan: company?.plan ?? null,
          };
        }),
      });
    }

    if (action === "invoice_update") {
      const invoiceId = String(body.invoiceId ?? "");
      const status = String(body.status ?? "");
      if (!["pending", "paid", "overdue", "canceled"].includes(status)) {
        return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 400);
      }
      const { data: invoice } = await admin
        .from("platform_invoices")
        .select("id, company_id, reference_month, amount, status")
        .eq("id", invoiceId)
        .maybeSingle();
      if (!invoice) return jsonResponse({ ok: false, error: "INVOICE_NOT_FOUND" }, 404);

      const patch: Record<string, unknown> = { status };
      if (status === "paid") {
        patch.paid_at = new Date().toISOString();
        patch.method = body.method ? String(body.method) : "manual";
      } else {
        patch.paid_at = null;
      }

      const { error } = await admin.from("platform_invoices").update(patch).eq("id", invoiceId);
      if (error) throw new Error(error.message);

      const company = await companyById(String(invoice.company_id));
      await audit({
        action: "invoice_status_changed",
        companyId: String(invoice.company_id),
        companyName: company ? String(company.name) : null,
        detail: {
          invoiceId,
          referenceMonth: invoice.reference_month,
          from: invoice.status,
          to: status,
          amount: Number(invoice.amount),
        },
      });
      return jsonResponse({ ok: true, detail: "Cobranca atualizada." });
    }

    if (action === "import_context") {
      const { data: companies } = await admin
        .from("companies")
        .select("id, name, subdomain, plan, status")
        .order("name", { ascending: true });
      const { data: collabs } = await admin.from("company_collaborators").select("company_id");
      const counts = new Map<string, number>();
      for (const row of collabs ?? []) {
        const key = String(row.company_id);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const { data: history } = await admin
        .from("platform_audit_logs")
        .select("id, actor_name, target_company_id, target_company_name, detail, created_at")
        .eq("action", "collaborators_imported")
        .order("created_at", { ascending: false })
        .limit(20);
      return jsonResponse({
        ok: true,
        companies: (companies ?? []).map((c) => ({ ...c, collaborators: counts.get(String(c.id)) ?? 0 })),
        history: history ?? [],
      });
    }

    if (action === "collaborators_import") {
      const companyId = String(body.companyId ?? "");
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);

      const rawRows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
      if (rawRows.length === 0) {
        return jsonResponse({ ok: false, error: "EMPTY_FILE", detail: "Nenhum colaborador encontrado no arquivo." }, 400);
      }
      if (rawRows.length > 3000) {
        return jsonResponse({ ok: false, error: "FILE_TOO_LARGE", detail: "Limite de 3.000 linhas por importacao." }, 400);
      }

      const fileName = body.fileName ? String(body.fileName).slice(0, 140) : null;
      const { data: existingRows } = await admin
        .from("company_collaborators")
        .select("ref, cpf")
        .eq("company_id", companyId);

      const existingCpf = new Set<string>();
      const existingRef = new Set<string>();
      for (const row of existingRows ?? []) {
        const digits = String(row.cpf ?? "").replace(/\D/g, "");
        if (digits) existingCpf.add(digits);
        if (row.ref) existingRef.add(String(row.ref));
      }

      const formatCpf = (digits: string) =>
        `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;

      const errors: { line: number; message: string }[] = [];
      const payload: Record<string, unknown>[] = [];
      const seenCpf = new Set<string>();
      let skipped = 0;

      rawRows.forEach((row, index) => {
        const line = Number(row.line ?? index + 2) || index + 2;
        const name = String(row.name ?? "").trim();
        const cpfDigits = String(row.cpf ?? "").replace(/\D/g, "");
        if (name.length < 3) {
          errors.push({ line, message: "Nome ausente ou com menos de 3 caracteres." });
          return;
        }
        if (cpfDigits.length !== 11) {
          errors.push({ line, message: "CPF invalido: informe os 11 digitos." });
          return;
        }
        if (seenCpf.has(cpfDigits)) {
          errors.push({ line, message: "CPF repetido dentro do arquivo." });
          return;
        }
        seenCpf.add(cpfDigits);
        if (existingCpf.has(cpfDigits)) {
          skipped += 1;
          return;
        }

        const refBase = String(row.ref ?? "").trim() || `imp-${cpfDigits}`;
        let ref = refBase;
        let suffix = 1;
        while (existingRef.has(ref)) {
          ref = `${refBase}-${suffix}`;
          suffix += 1;
        }
        existingRef.add(ref);
        existingCpf.add(cpfDigits);

        const status = String(row.status ?? "Ativo").trim() || "Ativo";
        const email = String(row.email ?? "").trim();
        payload.push({
          company_id: companyId,
          ref,
          name,
          cpf: formatCpf(cpfDigits),
          matricula: row.matricula ? String(row.matricula).trim() : null,
          role_function: row.roleFunction ? String(row.roleFunction).trim() : null,
          area: row.area ? String(row.area).trim() : null,
          establishment: row.establishment ? String(row.establishment).trim() : null,
          rg: row.rg ? String(row.rg).trim() : null,
          pis: row.pis ? String(row.pis).trim() : null,
          ctps: row.ctps ? String(row.ctps).trim() : null,
          admission_date: row.admissionDate ? String(row.admissionDate).trim() : null,
          birth_date: row.birthDate ? String(row.birthDate).trim() : null,
          phone: row.phone ? String(row.phone).trim() : null,
          email: email.includes("@") ? email : null,
          city: row.city ? String(row.city).trim() : null,
          status,
          active: !/inativ|deslig|afast/i.test(status),
        });
      });

      let inserted = 0;
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200);
        const { error } = await admin.from("company_collaborators").insert(chunk);
        if (error) {
          errors.push({ line: 0, message: `Falha ao gravar o lote: ${error.message}` });
          break;
        }
        inserted += chunk.length;
      }

      await audit({
        action: "collaborators_imported",
        companyId,
        companyName: String(company.name),
        detail: { fileName, total: rawRows.length, inserted, skipped, failed: errors.length },
      });

      await admin.from("system_audit_logs").insert({
        company_id: companyId,
        module: "colaboradores",
        area: "collaborators",
        action: "imported",
        entity: "Importacao de colaboradores",
        entity_id: fileName,
        detail: `Importacao em lote (${fileName ?? "planilha"}): ${inserted} adicionados, ${skipped} ja existentes, ${errors.length} com erro.`,
        actor_id: actor.id,
        actor_name: actor.name,
      });

      return jsonResponse({
        ok: true,
        inserted,
        skipped,
        failed: errors.length,
        errors: errors.slice(0, 60),
        detail: `${inserted} colaborador(es) adicionado(s) em ${company.name}.`,
      });
    }

    if (action === "seals_overview") {
      const companyId = body.companyId ? String(body.companyId) : null;
      const from = body.from ? String(body.from) : null;
      const to = body.to ? String(body.to) : null;
      const search = String(body.search ?? "").trim().toLowerCase();
      const scope = body.scope ? String(body.scope) : null;
      const issuerFilter = String(body.issuer ?? "").trim().toLowerCase();
      const limit = Math.min(Math.max(Number(body.limit ?? 400), 20), 1000);

      let sealQuery = admin
        .from("document_seals")
        .select("id, company_id, scope, reference_ref, reference_label, content_hash, signer_count, signers, validation_token, sealed_at, created_by_profile_id, created_at")
        .order("sealed_at", { ascending: false })
        .limit(limit);
      if (companyId) sealQuery = sealQuery.eq("company_id", companyId);
      if (scope) sealQuery = sealQuery.eq("scope", scope);
      if (from) sealQuery = sealQuery.gte("sealed_at", from);
      if (to) sealQuery = sealQuery.lte("sealed_at", to);
      const { data: seals, error: sealsError } = await sealQuery;
      if (sealsError) throw new Error(sealsError.message);

      const { data: companies } = await admin
        .from("companies")
        .select("id, name, subdomain, plan, status")
        .order("name", { ascending: true });
      const companyMap = new Map<string, Record<string, unknown>>();
      for (const company of companies ?? []) companyMap.set(String(company.id), company as Record<string, unknown>);

      const codeOf = (token: unknown) =>
        String(token ?? "")
          .toUpperCase()
          .replace(/[^0-9A-F]/g, "")
          .slice(0, 12)
          .replace(/(.{4})(?=.)/g, "$1-");

      // Quem emitiu a chancela: nos relatorios consolidados o emissor e gravado
      // como signatario com papel de gestor/emissor. Nos documentos assinados
      // nao existe emissor (quem assina e o colaborador), entao fica nulo.
      const issuerOf = (signers: unknown): string | null => {
        const list = Array.isArray(signers) ? signers : [];
        for (const raw of list) {
          if (!raw || typeof raw !== "object") continue;
          const row = raw as Record<string, unknown>;
          const role = String(row.role ?? "").toLowerCase();
          if (!role.includes("gestor") && !role.includes("emissor")) continue;
          const name = String(row.name ?? "").trim();
          if (name) return name;
        }
        return null;
      };

      const creatorIds = Array.from(
        new Set((seals ?? []).map((row) => row.created_by_profile_id).filter((id): id is string => Boolean(id)))
      );
      const creatorName = new Map<string, string>();
      if (creatorIds.length > 0) {
        const { data: creators } = await admin.from("profiles").select("id, name").in("id", creatorIds);
        for (const profile of creators ?? []) {
          if (profile.name) creatorName.set(String(profile.id), String(profile.name));
        }
      }

      const rows = (seals ?? []).map((row) => {
        const company = companyMap.get(String(row.company_id));
        return {
          id: row.id,
          company_id: row.company_id,
          company_name: company?.name ?? null,
          company_subdomain: company?.subdomain ?? null,
          scope: row.scope,
          reference_ref: row.reference_ref,
          reference_label: row.reference_label,
          content_hash: row.content_hash,
          signer_count: row.signer_count,
          signers: row.signers ?? [],
          issuer:
            issuerOf(row.signers) ??
            (row.created_by_profile_id ? creatorName.get(String(row.created_by_profile_id)) ?? null : null),
          validation_token: row.validation_token,
          code: codeOf(row.validation_token),
          sealed_at: row.sealed_at,
          created_at: row.created_at,
        };
      });

      // Lista de emissores disponiveis no recorte atual (empresa/tipo/periodo),
      // para o filtro "Emitido por" nao oferecer nomes sem nenhuma chancela.
      const issuers = Array.from(
        new Set(rows.map((row) => (row.issuer ? String(row.issuer) : "")).filter((name) => name.trim() !== ""))
      ).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

      const filtered = rows.filter((row) => {
        if (issuerFilter && String(row.issuer ?? "").trim().toLowerCase() !== issuerFilter) return false;
        if (!search) return true;
        return [
          row.company_name,
          row.company_subdomain,
          row.reference_label,
          row.reference_ref,
          row.scope,
          row.issuer,
          row.code,
          row.validation_token,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });

      return jsonResponse({ ok: true, seals: filtered, companies: companies ?? [], issuers });
    }

    if (action === "system_logs") {
      const companyId = body.companyId ? String(body.companyId) : null;
      const roleFilter = body.role ? String(body.role) : "all";
      const limit = Math.min(Math.max(Number(body.limit ?? 200), 20), 500);
      const from = body.from ? String(body.from) : null;
      const to = body.to ? String(body.to) : null;

      const { data: companies } = await admin
        .from("companies")
        .select("id, name, subdomain, plan, status")
        .order("name", { ascending: true });
      const companyMap = new Map<string, Record<string, unknown>>();
      for (const company of companies ?? []) companyMap.set(String(company.id), company as Record<string, unknown>);

      let systemQuery = admin
        .from("system_audit_logs")
        .select("id, company_id, module, area, action, entity, entity_id, field, old_value, new_value, detail, actor_id, actor_name, created_at")
        .order("created_at", { ascending: false })
        .limit(limit * 2);
      if (companyId) systemQuery = systemQuery.eq("company_id", companyId);
      if (from) systemQuery = systemQuery.gte("created_at", from);
      if (to) systemQuery = systemQuery.lte("created_at", to);
      const { data: systemRows } = await systemQuery;

      let platformQuery = admin
        .from("platform_audit_logs")
        .select("id, action, target_company_id, target_company_name, detail, actor_name, actor_email, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (companyId) platformQuery = platformQuery.eq("target_company_id", companyId);
      if (from) platformQuery = platformQuery.gte("created_at", from);
      if (to) platformQuery = platformQuery.lte("created_at", to);
      const { data: platformRows } = await platformQuery;

      let voteQuery = admin
        .from("cipa_voter_participation")
        .select("id, company_ref, election_ref, collaborator_ref, has_voted, voted_at, created_at")
        .eq("has_voted", true)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit, 300));
      if (from) voteQuery = voteQuery.gte("created_at", from);
      if (to) voteQuery = voteQuery.lte("created_at", to);
      const { data: votes } = await voteQuery;

      let signatureQuery = admin
        .from("signature_audit_log")
        .select("id, company_id, profile_id, actor_profile_id, event_type, entity, entity_id, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (companyId) signatureQuery = signatureQuery.eq("company_id", companyId);
      if (from) signatureQuery = signatureQuery.gte("created_at", from);
      if (to) signatureQuery = signatureQuery.lte("created_at", to);
      const { data: signatureRows } = await signatureQuery;

      const actorIds = Array.from(
        new Set(
          [
            ...(systemRows ?? []).map((row) => row.actor_id),
            ...(signatureRows ?? []).flatMap((row) => [row.actor_profile_id, row.profile_id]),
          ].filter((id): id is string => Boolean(id))
        )
      );
      const roleById = new Map<string, string>();
      const nameById = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: byId } = await admin.from("profiles").select("id, auth_user_id, role, name").in("id", actorIds);
        const { data: byAuth } = await admin
          .from("profiles")
          .select("id, auth_user_id, role, name")
          .in("auth_user_id", actorIds);
        for (const profile of [...(byId ?? []), ...(byAuth ?? [])]) {
          if (profile.role) roleById.set(String(profile.id), String(profile.role));
          if (profile.role && profile.auth_user_id) roleById.set(String(profile.auth_user_id), String(profile.role));
          if (profile.name) nameById.set(String(profile.id), String(profile.name));
          if (profile.name && profile.auth_user_id) nameById.set(String(profile.auth_user_id), String(profile.name));
        }
      }

      const voteRefs = Array.from(
        new Set((votes ?? []).map((row) => row.collaborator_ref).filter((ref): ref is string => Boolean(ref)))
      );
      const collaboratorName = new Map<string, string>();
      if (voteRefs.length > 0) {
        const { data: collabRows } = await admin
          .from("company_collaborators")
          .select("company_id, ref, name")
          .in("ref", voteRefs);
        for (const row of collabRows ?? []) {
          collaboratorName.set(`${row.company_id}:${row.ref}`, String(row.name));
        }
      }

      const summarize = (detail: Record<string, unknown> | null): string => {
        if (!detail) return "";
        const parts = Object.entries(detail)
          .filter(([key, value]) => !["ip", "user_agent", "path"].includes(key) && value !== null && value !== undefined && value !== "")
          .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
        if (typeof detail.ip === "string" && detail.ip) parts.push(`IP ${detail.ip}`);
        return parts.join(" · ").slice(0, 420);
      };

      type LogEntry = {
        uid: string;
        source: string;
        companyId: string | null;
        companyName: string | null;
        module: string;
        area: string | null;
        action: string;
        entity: string | null;
        detail: string;
        actorName: string | null;
        actorRole: string | null;
        createdAt: string;
        secret: boolean;
      };

      const entries: LogEntry[] = [];

      for (const row of systemRows ?? []) {
        const company = row.company_id ? companyMap.get(String(row.company_id)) : null;
        entries.push({
          uid: `sys-${row.id}`,
          source: "tenant",
          companyId: row.company_id ? String(row.company_id) : null,
          companyName: company ? String(company.name) : null,
          module: String(row.module ?? "sistema"),
          area: row.area ? String(row.area) : null,
          action: String(row.action ?? "updated"),
          entity: row.entity ? String(row.entity) : null,
          detail: String(row.detail ?? row.action ?? ""),
          actorName: row.actor_name ?? (row.actor_id ? nameById.get(String(row.actor_id)) ?? null : null),
          actorRole: row.actor_id ? roleById.get(String(row.actor_id)) ?? null : null,
          createdAt: String(row.created_at),
          secret: false,
        });
      }

      for (const row of platformRows ?? []) {
        const company = row.target_company_id ? companyMap.get(String(row.target_company_id)) : null;
        const detail = (row.detail ?? {}) as Record<string, unknown>;
        entries.push({
          uid: `plat-${row.id}`,
          source: "platform",
          companyId: row.target_company_id ? String(row.target_company_id) : null,
          companyName: row.target_company_name ? String(row.target_company_name) : company ? String(company.name) : null,
          module: "plataforma",
          area: "plataforma",
          action: String(row.action ?? "platform"),
          entity: "Administracao da plataforma",
          detail: summarize(detail) || String(row.action ?? ""),
          actorName: row.actor_name ?? row.actor_email ?? null,
          actorRole: "super",
          createdAt: String(row.created_at),
          secret: false,
        });
      }

      for (const row of signatureRows ?? []) {
        const company = row.company_id ? companyMap.get(String(row.company_id)) : null;
        const detail = (row.metadata ?? {}) as Record<string, unknown>;
        const actorProfileId = row.actor_profile_id ?? row.profile_id;
        entries.push({
          uid: `sig-${row.id}`,
          source: "signature",
          companyId: row.company_id ? String(row.company_id) : null,
          companyName: company ? String(company.name) : null,
          module: "assinaturas",
          area: "signatures",
          action: String(row.event_type ?? "signature_event"),
          entity: row.entity ? String(row.entity) : "Assinatura eletronica",
          detail:
            summarize(detail) ||
            `${row.event_type ?? "Evento de assinatura"} · ${row.entity ?? "documento"} ${row.entity_id ?? ""}`.trim(),
          actorName: actorProfileId ? nameById.get(String(actorProfileId)) ?? null : null,
          actorRole: actorProfileId ? roleById.get(String(actorProfileId)) ?? null : null,
          createdAt: String(row.created_at),
          secret: false,
        });
      }

      for (const row of votes ?? []) {
        const companyEntry = Array.from(companyMap.values()).find(
          (company) => String(company.subdomain) === String(row.company_ref)
        );
        const companyIdValue = companyEntry ? String(companyEntry.id) : null;
        const person = companyIdValue
          ? collaboratorName.get(`${companyIdValue}:${row.collaborator_ref}`)
          : undefined;
        entries.push({
          uid: `vote-${row.id}`,
          source: "vote",
          companyId: companyIdValue,
          companyName: companyEntry ? String(companyEntry.name) : String(row.company_ref ?? ""),
          module: "cipa",
          area: "cipa",
          action: "secret_vote_recorded",
          entity: "Voto sigiloso",
          detail: `Voto registrado na eleicao ${row.election_ref ?? "-"} · sigilo preservado: a escolha nao e gravada na trilha.`,
          actorName: person ?? (row.collaborator_ref ? String(row.collaborator_ref) : "Eleitor"),
          actorRole: "colaborador",
          createdAt: String(row.voted_at ?? row.created_at),
          secret: true,
        });
      }

      const filtered = entries
        .filter((entry) => (roleFilter === "all" ? true : entry.actorRole === roleFilter))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const counts = {
        total: filtered.length,
        created: filtered.filter((entry) => entry.action === "created" || entry.action === "imported").length,
        deleted: filtered.filter((entry) => entry.action === "deleted").length,
        secret: filtered.filter((entry) => entry.secret).length,
      };

      return jsonResponse({
        ok: true,
        logs: filtered.slice(0, limit),
        counts,
        companies: companies ?? [],
      });
    }

    // -----------------------------------------------------------------
    // Catálogo de empresas e assistente de nova empresa
    // -----------------------------------------------------------------

    if (action === "check_subdomain") {
      const subdomain = normalizeSubdomain(body.subdomain);
      const problem = validateSubdomain(subdomain);
      if (problem) return jsonResponse({ ok: true, subdomain, available: false, detail: problem });
      const { data: taken } = await admin.from("companies").select("id").ilike("subdomain", subdomain).maybeSingle();
      return jsonResponse({
        ok: true,
        subdomain,
        host: `${subdomain}.${ROOT_DOMAIN}`,
        available: !taken,
        detail: taken ? "Este subdomínio já está em uso por outra empresa." : "Disponível.",
      });
    }

    if (action === "company_modules_get") {
      const companyId = String(body.companyId ?? "");
      const { data, error } = await admin
        .from("companies")
        .select("id, name, enabled_modules")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
      return jsonResponse({ ok: true, modules: data.enabled_modules ?? {} });
    }

    if (action === "company_modules_save") {
      const companyId = String(body.companyId ?? "");
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
      const modules = sanitizeModules(body.modules);
      const { error } = await admin.from("companies").update({ enabled_modules: modules }).eq("id", companyId);
      if (error) throw new Error(error.message);
      await audit({
        action: "company_modules_saved",
        companyId,
        companyName: String(company.name),
        detail: { disabled: Object.entries(modules).filter(([, on]) => !on).map(([key]) => key) },
      });
      return jsonResponse({ ok: true, detail: "Módulos da empresa salvos." });
    }

    // Novo link de acesso para o administrador principal (convite expirado,
    // senha esquecida). O link leva à tela de criar/redefinir senha da empresa.
    if (action === "admin_access_link") {
      const companyId = String(body.companyId ?? "");
      const company = await companyById(companyId);
      if (!company) return jsonResponse({ ok: false, error: "COMPANY_NOT_FOUND" }, 404);
      const { data: primary } = await admin
        .from("profiles")
        .select("id, email, auth_user_id")
        .eq("company_id", companyId)
        .eq("is_primary_admin", true)
        .maybeSingle();
      if (!primary?.email || !primary.auth_user_id) {
        return jsonResponse({
          ok: false,
          error: "NO_PRIMARY_LOGIN",
          detail: "A empresa não tem administrador principal com conta de acesso. Cadastre-o em Editar.",
        });
      }
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: String(primary.email),
        options: { redirectTo: `https://${String(company.subdomain)}.${ROOT_DOMAIN}/redefinir-senha` },
      });
      if (linkError || !link?.properties?.action_link) {
        return jsonResponse({ ok: false, error: "LINK_FAILED", detail: "Não foi possível gerar o link agora. Tente novamente." });
      }
      await audit({
        action: "admin_access_link_generated",
        companyId,
        companyName: String(company.name),
        targetUserId: String(primary.auth_user_id),
        detail: { email: primary.email },
      });
      return jsonResponse({ ok: true, link: link.properties.action_link, email: primary.email });
    }

    if (action === "onboard_company") {
      const parsed = validateOnboarding(body.payload, passwordProblem);
      if (parsed.ok === false) {
        return jsonResponse({ ok: false, error: "INVALID_FIELDS", detail: "Revise os campos destacados.", fields: parsed.errors });
      }
      const input = (parsed as { ok: true; value: OnboardingInput }).value;

      // Conflitos que só o banco sabe responder
      const { data: subTaken } = await admin.from("companies").select("id").ilike("subdomain", input.company.subdomain).maybeSingle();
      if (subTaken) {
        return jsonResponse({ ok: false, error: "INVALID_FIELDS", detail: "Revise os campos destacados.", fields: { "company.subdomain": "Este subdomínio já está em uso." } });
      }
      const { data: cnpjTaken } = await admin.from("companies").select("id, name").eq("cnpj", input.company.cnpj).maybeSingle();
      if (cnpjTaken) {
        return jsonResponse({
          ok: false,
          error: "INVALID_FIELDS",
          detail: "Revise os campos destacados.",
          fields: { "company.cnpj": `Este CNPJ já está cadastrado (${cnpjTaken.name}).` },
        });
      }
      const { data: emailTaken } = await admin.from("profiles").select("id").ilike("email", input.admin.email).maybeSingle();
      if (emailTaken) {
        return jsonResponse({
          ok: false,
          error: "INVALID_FIELDS",
          detail: "Revise os campos destacados.",
          fields: { "admin.email": "Este e-mail já está vinculado a outro usuário da plataforma." },
        });
      }

      // Cada passo registra como desfazer. Se algo falhar no meio, desfaz tudo
      // na ordem inversa: nada de empresa "pela metade".
      const undo: Array<() => PromiseLike<unknown>> = [];
      const rollback = async () => {
        for (const step of undo.reverse()) {
          try {
            await step();
          } catch {
            /* segue desfazendo o restante */
          }
        }
      };

      try {
        const now = new Date().toISOString();
        const { data: company, error: companyError } = await admin
          .from("companies")
          .insert({
            name: input.company.name,
            legal_name: input.company.legalName,
            cnpj: input.company.cnpj,
            subdomain: input.company.subdomain,
            plan: input.company.plan,
            notes: input.company.notes,
            status: "active",
            created_by: actor.id,
            enabled_modules: input.modules,
            onboarding: { template: input.template, started_at: now, steps: {} },
          })
          .select("id")
          .single();
        if (companyError || !company) throw new Error(companyError?.message ?? "Falha ao criar a empresa.");
        const companyId = String(company.id);
        undo.push(() => admin.from("companies").delete().eq("id", companyId));

        const steps: Record<string, boolean> = {};

        const { error: domainError } = await admin.from("company_domains").insert({
          company_id: companyId,
          domain: `${input.company.subdomain}.${ROOT_DOMAIN}`,
          kind: "subdomain",
          is_primary: true,
          // O curinga *.dominio já atende todos os subdomínios: nada a configurar por empresa.
          dns_status: "configured",
          https_status: "configured",
          notes: "Criado pelo assistente de nova empresa (coberto pelo domínio curinga).",
        });
        if (domainError) throw new Error(domainError.message);
        undo.push(() => admin.from("company_domains").delete().eq("company_id", companyId));
        steps.domain = true;

        const { error: settingsError } = await admin.from("company_settings").upsert(
          {
            company_id: companyId,
            company_legal_name: input.company.legalName,
            company_cnpj: input.company.cnpj,
            technical_responsible: input.settings.technicalResponsible,
            technical_registration: input.settings.technicalRegistration,
            sesmt_phone: input.settings.sesmtPhone,
          },
          { onConflict: "company_id" },
        );
        if (settingsError) throw new Error(settingsError.message);
        undo.push(() => admin.from("company_settings").delete().eq("company_id", companyId));
        steps.settings = true;

        const { error: estError } = await admin.from("establishments").insert({
          company_id: companyId,
          code: input.establishment.code,
          name: input.establishment.name,
          cnpj: input.company.cnpj,
          city: input.establishment.city,
          state: input.establishment.state,
          risk_grade: input.establishment.riskGrade,
        });
        if (estError) throw new Error(estError.message);
        undo.push(() => admin.from("establishments").delete().eq("company_id", companyId));
        steps.establishment = true;

        if (input.profiles.length) {
          const { error: profError } = await admin.from("company_access_profiles").insert(
            input.profiles.map((p) => ({
              company_id: companyId,
              name: p.name,
              description: p.description,
              icon: p.icon,
              permissions: p.permissions,
            })),
          );
          if (profError) throw new Error(profError.message);
          undo.push(() => admin.from("company_access_profiles").delete().eq("company_id", companyId));
          steps.profiles = true;
        }

        const { error: licenseError } = await admin.from("company_licenses").upsert(
          {
            company_id: companyId,
            plan: input.company.plan,
            seats: input.license.seats,
            monthly_value: input.license.monthlyValue,
            billing_cycle: input.license.billingCycle,
            status: "active",
            started_at: now.slice(0, 10),
            updated_at: now,
          },
          { onConflict: "company_id" },
        );
        if (licenseError) throw new Error(licenseError.message);
        undo.push(() => admin.from("company_licenses").delete().eq("company_id", companyId));
        steps.license = true;

        // Administrador principal: convite (padrão) ou senha definida agora.
        let authUserId: string | null = null;
        let inviteLink: string | null = null;
        if (input.admin.mode === "password") {
          const created = await createLoginAccount(input.admin.email, input.admin.password, input.admin.name);
          if (created.response) {
            await rollback();
            return created.response;
          }
          authUserId = created.userId;
        } else {
          const { data: link, error: linkError } = await admin.auth.admin.generateLink({
            type: "invite",
            email: input.admin.email,
            options: {
              data: { name: input.admin.name },
              redirectTo: `https://${input.company.subdomain}.${ROOT_DOMAIN}/redefinir-senha`,
            },
          });
          if (linkError || !link?.user) throw new Error(linkError?.message ?? "Falha ao gerar o convite.");
          authUserId = link.user.id;
          inviteLink = link.properties?.action_link ?? null;
        }
        if (authUserId) {
          const uid = authUserId;
          undo.push(() => admin.auth.admin.deleteUser(uid));
        }

        const { error: adminError } = await admin.from("profiles").insert({
          company_id: companyId,
          name: input.admin.name,
          email: input.admin.email,
          phone: input.admin.phone,
          role: "admin",
          status: "active",
          is_primary_admin: true,
          auth_user_id: authUserId,
        });
        if (adminError) throw new Error(adminError.message);
        steps.admin = true;

        await admin
          .from("companies")
          .update({ onboarding: { template: input.template, started_at: now, steps, admin_mode: input.admin.mode } })
          .eq("id", companyId);

        await audit({
          action: "company_onboarded",
          companyId,
          companyName: input.company.name,
          detail: {
            subdomain: input.company.subdomain,
            plan: input.company.plan,
            template: input.template,
            modulesOff: Object.entries(input.modules).filter(([, on]) => !on).map(([k]) => k),
            profiles: input.profiles.map((p) => p.name),
            adminEmail: input.admin.email,
            adminMode: input.admin.mode,
          },
        });

        return jsonResponse({
          ok: true,
          companyId,
          host: `${input.company.subdomain}.${ROOT_DOMAIN}`,
          inviteLink,
          detail: "Empresa criada e pronta para o primeiro acesso.",
        });
      } catch (err) {
        await rollback();
        return jsonResponse({
          ok: false,
          error: "ONBOARDING_FAILED",
          detail: `A empresa não foi criada e nada ficou gravado. Motivo: ${err instanceof Error ? err.message : "falha inesperada"}.`,
        });
      }
    }

    return jsonResponse({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: "UNEXPECTED", detail: err instanceof Error ? err.message : "Falha inesperada." }, 200);
  }
});