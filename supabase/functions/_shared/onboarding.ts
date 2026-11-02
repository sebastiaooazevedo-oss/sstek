/**
 * Regras do cadastro de empresas e do assistente de nova empresa.
 *
 * Arquivo PURO (sem Deno, sem banco): roda na função de servidor e também é
 * testado pelo `npm test` do projeto (onboarding.test.ts).
 */

export const RESERVED_SUBDOMAINS = new Set([
  "admin", "www", "api", "app", "painel", "sistema", "suporte", "sstek",
  "mail", "status", "test", "dev", "staging", "plataforma", "login", "auth",
]);

/** Chaves de módulos contratáveis aceitas no cadastro (iguais às do app). */
export const MODULE_KEYS = [
  "cipa", "dds", "epi", "apr", "assinaturas", "sentimento", "veiculos", "qrcodes", "treinamentos",
] as const;

export const PLANS = ["S1", "S2", "S3"] as const;
export type Plan = (typeof PLANS)[number];

export function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizeSubdomain(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateSubdomain(value: string): string | null {
  if (value.length < 3 || value.length > 30) return "O subdomínio deve ter entre 3 e 30 caracteres.";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return "Use apenas letras minúsculas, números e hífen (sem começar ou terminar com hífen).";
  }
  if (RESERVED_SUBDOMAINS.has(value)) return "Este subdomínio é reservado para a plataforma.";
  return null;
}

/** Valida CNPJ pelos dígitos verificadores (aceita com ou sem máscara). */
export function isValidCnpj(value: unknown): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const d1 = digit(cnpj.slice(0, 12), w1);
  const d2 = digit(cnpj.slice(0, 12) + d1, w2);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function formatCnpj(value: unknown): string {
  const d = onlyDigits(value);
  if (d.length !== 14) return String(value ?? "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function isValidEmail(value: string): boolean {
  return value.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Mantém só chaves de módulo conhecidas com valor booleano. */
export function sanitizeModules(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of MODULE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

/** Mantém só permissões no formato "area.acao" com valor booleano. */
export function sanitizePermissions(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (/^[a-zA-Z]+\.[a-zA-Z]+$/.test(key) && typeof value === "boolean") out[key] = value;
  }
  return out;
}

export interface OnboardingProfile {
  name: string;
  description: string;
  icon: string;
  permissions: Record<string, boolean>;
}

export interface OnboardingInput {
  company: { name: string; legalName: string; cnpj: string; subdomain: string; plan: Plan; notes: string | null };
  modules: Record<string, boolean>;
  establishment: { code: string; name: string; city: string | null; state: string | null; riskGrade: string | null };
  settings: { technicalResponsible: string; technicalRegistration: string; sesmtPhone: string };
  profiles: OnboardingProfile[];
  admin: { name: string; email: string; phone: string | null; mode: "invite" | "password"; password: string };
  license: { monthlyValue: number; seats: number; billingCycle: "monthly" | "yearly" };
  template: string;
}

export type OnboardingResult = { ok: true; value: OnboardingInput } | { ok: false; errors: Record<string, string> };

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Valida e normaliza o pedido do assistente de nova empresa.
 * Devolve todos os problemas de uma vez, por campo, para a tela mostrar juntos.
 */
export function validateOnboarding(body: unknown, checkPassword?: (pwd: string, email: string) => string | null): OnboardingResult {
  const b = obj(body);
  const c = obj(b.company);
  const e = obj(b.establishment);
  const s = obj(b.settings);
  const a = obj(b.admin);
  const l = obj(b.license);
  const errors: Record<string, string> = {};

  const name = str(c.name, 120);
  if (name.length < 2) errors["company.name"] = "Informe o nome da empresa.";
  const legalName = str(c.legalName, 200);
  if (legalName.length < 2) errors["company.legalName"] = "Informe a razão social.";
  const cnpjDigits = onlyDigits(c.cnpj);
  if (!isValidCnpj(cnpjDigits)) errors["company.cnpj"] = "CNPJ inválido. Confira os números.";
  const subdomain = normalizeSubdomain(c.subdomain);
  const subError = validateSubdomain(subdomain);
  if (subError) errors["company.subdomain"] = subError;
  const plan = (PLANS as readonly string[]).includes(String(c.plan)) ? (String(c.plan) as Plan) : "S2";

  const estName = str(e.name, 120) || "Matriz";
  const estCode = (str(e.code, 30) || "MATRIZ").toUpperCase().replace(/[^A-Z0-9-]/g, "-");
  const riskGrade = str(e.riskGrade, 20) || null;
  if (riskGrade && !/^[1-4]$/.test(riskGrade)) errors["establishment.riskGrade"] = "Grau de risco deve ser de 1 a 4.";
  const state = str(e.state, 2).toUpperCase() || null;
  if (state && !/^[A-Z]{2}$/.test(state)) errors["establishment.state"] = "Use a sigla do estado (ex.: SP).";

  const adminName = str(a.name, 120);
  if (adminName.length < 2) errors["admin.name"] = "Informe o nome do administrador da empresa.";
  const adminEmail = str(a.email, 160).toLowerCase();
  if (!isValidEmail(adminEmail)) errors["admin.email"] = "Informe um e-mail válido.";
  const mode = a.mode === "password" ? "password" : "invite";
  const password = String(a.password ?? "");
  if (mode === "password") {
    const problem = checkPassword ? checkPassword(password, adminEmail) : password.length < 8 ? "A senha deve ter pelo menos 8 caracteres." : null;
    if (problem) errors["admin.password"] = problem;
  }

  const monthlyValue = Number(l.monthlyValue ?? 0);
  if (!Number.isFinite(monthlyValue) || monthlyValue < 0) errors["license.monthlyValue"] = "Informe um valor mensal válido.";
  const seats = Math.round(Number(l.seats ?? 0));
  if (!Number.isFinite(seats) || seats < 0) errors["license.seats"] = "Informe um número de usuários válido.";

  const profilesRaw = Array.isArray(b.profiles) ? b.profiles.slice(0, 10) : [];
  const profiles: OnboardingProfile[] = profilesRaw
    .map((p) => obj(p))
    .map((p) => ({
      name: str(p.name, 80),
      description: str(p.description, 400),
      icon: str(p.icon, 60) || "ri-shield-user-line",
      permissions: sanitizePermissions(p.permissions),
    }))
    .filter((p) => p.name.length >= 2);

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      company: { name, legalName, cnpj: formatCnpj(cnpjDigits), subdomain, plan, notes: str(c.notes, 1000) || null },
      modules: sanitizeModules(b.modules),
      establishment: { code: estCode, name: estName, city: str(e.city, 80) || null, state, riskGrade },
      settings: {
        technicalResponsible: str(s.technicalResponsible, 120),
        technicalRegistration: str(s.technicalRegistration, 60),
        sesmtPhone: str(s.sesmtPhone, 30),
      },
      profiles,
      admin: { name: adminName, email: adminEmail, phone: str(a.phone, 30) || null, mode, password },
      license: {
        monthlyValue: Number(monthlyValue.toFixed(2)),
        seats,
        billingCycle: l.billingCycle === "yearly" ? "yearly" : "monthly",
      },
      template: str(b.template, 40) || "padrao",
    },
  };
}
