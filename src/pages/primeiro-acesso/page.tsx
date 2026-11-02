import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/base/BrandLogo";
import { supabase } from "@/lib/supabase";

/**
 * Primeiro acesso.
 *
 * O usuário informa o e-mail corporativo PRÉ-AUTORIZADO pelo administrador e
 * escolhe a própria senha. A validação de autorização e a criação da conta
 * acontecem no servidor (`account-activation`), que recusa qualquer e-mail que
 * não exista como perfil ativo e ainda não vinculado.
 *
 * Nada aqui define empresa, papel ou permissão: isso continua sendo resolvido
 * no banco por `session_context()` no primeiro login.
 */

interface ActivationResponse {
  ok?: boolean;
  error?: string;
  detail?: string;
}

export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setDone("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Informe o e-mail corporativo autorizado pela sua empresa.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<ActivationResponse>(
        "account-activation",
        { body: { email: cleanEmail, password } }
      );

      if (invokeError) {
        setError(
          "Não foi possível concluir a ativação agora. Verifique sua conexão e tente novamente."
        );
        return;
      }

      if (!data?.ok) {
        setError(data?.detail ?? "Não foi possível ativar o acesso com este e-mail.");
        return;
      }

      setDone(data.detail ?? "Conta criada. Você já pode entrar.");
      setPassword("");
      setConfirm("");
      window.setTimeout(() => navigate("/login", { replace: true }), 2200);
    } catch {
      setError("Falha de conexão com o servidor. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="relative hidden w-full overflow-hidden lg:flex lg:w-[46%]">
        <img
          src="/images/0fb07bd0da.jpg"
          alt="Ativação de acesso"
          title="SSTEK · Primeiro acesso"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/85 via-foreground-950/75 to-secondary-950/90"></div>

        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <Link to="/">
            <BrandLogo variant="light" size="lg" />
          </Link>

          <div>
            <h2 className="max-w-md font-heading text-3xl font-extrabold leading-tight text-background-50 xl:text-4xl">
              Ative seu acesso e escolha sua própria senha
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-background-200">
              Sua empresa já liberou seu e-mail. Você define a senha agora — ninguém da plataforma tem acesso a ela.
            </p>

            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: "ri-shield-user-line", text: "Só ativa e-mails liberados pela empresa" },
                { icon: "ri-key-2-line", text: "A senha é escolhida por você, aqui no navegador" },
                { icon: "ri-building-2-line", text: "A empresa é vinculada automaticamente" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-sm text-background-100">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background-50/10">
                    <i className={`${item.icon} text-lg text-accent-400`}></i>
                  </span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-background-400">
            © 2026 SSTEK Tecnologia · Plataforma de Segurança do Trabalho
          </p>
        </div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-background-50 px-5 py-12 md:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex lg:hidden">
            <BrandLogo />
          </Link>

          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Primeiro acesso
          </h1>
          <p className="mt-2 text-sm text-foreground-600">
            Use o e-mail corporativo que sua empresa cadastrou e defina a senha que você vai usar daqui pra frente.
          </p>

          {done ? (
            <div className="mt-7 flex flex-col gap-5">
              <div className="flex items-start gap-2 rounded-md border border-primary-300 bg-primary-50 px-3.5 py-3 text-sm text-primary-900">
                <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
                <span>{done}</span>
              </div>
              <Link
                to="/login"
                className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-login-box-line text-base"></i>
                Ir para o login
              </Link>
              <p className="flex items-center gap-2 text-xs text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                Redirecionando automaticamente…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
              <div>
                <label htmlFor="activation-email" className="mb-1.5 block text-sm font-medium text-foreground-800">
                  E-mail corporativo
                </label>
                <input
                  id="activation-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-3 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                />
              </div>

              <div>
                <label htmlFor="activation-password" className="mb-1.5 block text-sm font-medium text-foreground-800">
                  Senha
                </label>
                <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
                  <input
                    id="activation-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    className="w-full rounded-md bg-transparent px-3.5 py-3 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center text-foreground-500 hover:text-foreground-800"
                  >
                    <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="activation-confirm" className="mb-1.5 block text-sm font-medium text-foreground-800">
                  Repita a senha
                </label>
                <input
                  id="activation-confirm"
                  name="password-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Digite novamente"
                  className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-3 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-sm text-accent-900">
                  <i className="ri-error-warning-line mt-0.5 text-base"></i>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-base"></i>
                    Ativando...
                  </>
                ) : (
                  <>
                    <i className="ri-shield-check-line text-base"></i>
                    Ativar meu acesso
                  </>
                )}
              </button>

              <Link
                to="/login"
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground-600 hover:text-foreground-900"
              >
                <i className="ri-arrow-left-line"></i>
                Já tenho conta, ir para o login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}