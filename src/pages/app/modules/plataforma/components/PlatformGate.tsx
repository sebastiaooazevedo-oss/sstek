import { useState, type FormEvent } from "react";
import BrandLogo from "@/components/base/BrandLogo";

interface PlatformGateProps {
  loading: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

/**
 * Portão do painel global. Exige autenticação real (Supabase Auth) — nada de perfil
 * simulado em localStorage. Também explica o provisionamento seguro do primeiro
 * Superadministrador, sem criar credenciais padrão.
 */
export default function PlatformGate({ loading, error, onSignIn }: PlatformGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!email.includes("@")) {
      setFormError("Informe o e-mail da conta de Superadministrador.");
      return;
    }
    if (password.length < 6) {
      setFormError("Informe a senha da conta.");
      return;
    }
    setSubmitting(true);
    const message = await onSignIn(email, password);
    setSubmitting(false);
    if (message) setFormError(message);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:flex-row lg:items-start">
      <section className="w-full rounded-lg border border-background-200 bg-background-50 p-6 lg:w-[52%] lg:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-star-line text-xl"></i>
          </span>
          <div>
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-foreground-950">
              Administração da plataforma
            </h1>
            <p className="text-xs text-foreground-500">Acesso restrito ao Superadministrador do SSTEK.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="superadmin@sstek.com"
              className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-2.5 text-sm text-foreground-900 outline-none focus:border-primary-400"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">Senha</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-2.5 text-sm text-foreground-900 outline-none focus:border-primary-400"
            />
          </label>

          {(formError || error) && (
            <p className="flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-xs leading-relaxed text-accent-900">
              <i className="ri-error-warning-line mt-0.5"></i>
              <span>{formError || error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            <i className={submitting ? "ri-loader-4-line animate-spin" : "ri-lock-unlock-line"}></i>
            {submitting ? "Validando acesso…" : "Entrar no painel global"}
          </button>
        </form>

        <div className="mt-6 flex items-start gap-2.5 rounded-md bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
          <i className="ri-information-line mt-0.5 text-sm"></i>
          <span>
            O login demonstrativo do app (seleção de perfil) <strong>não</strong> abre este painel. A permissão é
            conferida no servidor pelo vínculo em <strong>platform_admins</strong>.
          </span>
        </div>
      </section>

      <section className="w-full rounded-lg border border-background-200 bg-background-100 p-6 lg:w-[48%] lg:p-7">
        <div className="flex items-center gap-2">
          <i className="ri-key-2-line text-lg text-secondary-700"></i>
          <h2 className="font-heading text-base font-bold text-foreground-950">Primeiro Superadministrador</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-foreground-600">
          Não existe credencial padrão. O primeiro acesso é provisionado manualmente, em duas etapas:
        </p>
        <ol className="mt-4 space-y-3 text-xs leading-relaxed text-foreground-700">
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-background-50">
              1
            </span>
            <span>
              Crie a conta em <strong>Supabase → Authentication → Users</strong> (e-mail e senha próprios). Não
              reutilize a senha do dia a dia.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-background-50">
              2
            </span>
            <span>
              Copie o <strong>UUID</strong> do usuário e rode no SQL editor:
              <code className="mt-2 block overflow-x-auto rounded-md bg-foreground-950 px-3 py-2 text-[10px] leading-relaxed text-background-100">
                insert into public.platform_admins (auth_user_id, name, email) values
                (&apos;UUID-DO-USUARIO&apos;, &apos;Seu nome&apos;, &apos;seu@email&apos;);
              </code>
            </span>
          </li>
        </ol>
        <p className="mt-4 flex items-start gap-2 rounded-md bg-background-50 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-600">
          <i className="ri-shield-check-line mt-0.5 text-sm text-primary-600"></i>
          <span>
            Só quem está nessa tabela executa ações globais. Administradores de empresa não conseguem se promover:
            o papel permitido no vínculo empresarial é apenas Administrador ou Colaborador.
          </span>
        </p>
        <div className="mt-5 flex items-center gap-2 border-t border-background-200 pt-4">
          <BrandLogo className="h-8" />
          <span className="text-[11px] text-foreground-500">SSTEK · administração central</span>
        </div>
      </section>
    </div>
  );
}