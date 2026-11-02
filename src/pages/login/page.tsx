import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/base/BrandLogo";
import { useAuth } from "@/pages/app/auth/authProvider";
import { NETWORK_ERROR_MESSAGE, checkSupabaseReachability } from "@/lib/supabaseErrors";

type Mode = "login" | "reset";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { from?: string; expired?: boolean } | null) ?? null;
  const { signIn, sendPasswordReset, userId, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "ok" | "fail">("idle");

  const networkIssue = error === NETWORK_ERROR_MESSAGE;

  const handleConnectionCheck = async () => {
    setCheckingConnection(true);
    setConnectionStatus("idle");
    const reachable = await checkSupabaseReachability();
    setConnectionStatus(reachable ? "ok" : "fail");
    if (reachable) {
      setError("");
    }
    setCheckingConnection(false);
  };

  if (userId) {
    return <Navigate to="/app" replace />;
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    const message = await signIn(cleanEmail, password);
    setSubmitting(false);
    setConnectionStatus("idle");
    if (message) {
      setError(
        message.toLowerCase().includes("invalid login")
          ? "E-mail ou senha incorretos."
          : message
      );
      return;
    }
    navigate(state?.from && state.from.startsWith("/app") ? state.from : "/app", { replace: true });
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Informe o e-mail cadastrado para receber o link de redefinição.");
      return;
    }
    setSubmitting(true);
    const message = await sendPasswordReset(cleanEmail);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    setNotice(
      "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha. Verifique a caixa de entrada e o spam."
    );
  };

  const busy = submitting || loading;

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="relative hidden w-full overflow-hidden lg:flex lg:w-[46%]">
        <img
          src="/images/e34bb5f816.jpg"
          alt="Painel SSTEK"
          title="SSTEK · Acesso ao sistema"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/85 via-foreground-950/75 to-secondary-950/90"></div>

        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <Link to="/">
            <BrandLogo variant="light" size="lg" />
          </Link>

          <div>
            <h2 className="max-w-md font-heading text-3xl font-extrabold leading-tight text-background-50 xl:text-4xl">
              Bem-vindo de volta à sua central de segurança do trabalho
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-background-200">
              Documentos, EPIs, treinamentos e avaliações em um só lugar. O acesso é individual e vinculado à sua
              empresa.
            </p>

            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: "ri-lock-2-line", text: "Dados isolados por empresa (multi-tenant)" },
                { icon: "ri-qr-scan-2-line", text: "Fiscalização por QR-Code com log de leitura" },
                { icon: "ri-shield-check-line", text: "Permissões validadas no servidor" },
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
            {mode === "login" ? "Entrar no SSTEK" : "Redefinir senha"}
          </h1>
          <p className="mt-2 text-sm text-foreground-600">
            {mode === "login"
              ? "Use o e-mail corporativo e a senha da sua conta. Sua empresa é identificada automaticamente."
              : "Informe o e-mail da sua conta para receber um link seguro de redefinição."}
          </p>

          {state?.expired && mode === "login" && !error && (
            <div className="mt-5 flex items-center gap-2 rounded-md border border-secondary-300 bg-secondary-100 px-3.5 py-2.5 text-sm text-secondary-900">
              <i className="ri-time-line text-base"></i>
              Sua sessão expirou. Entre novamente para continuar.
            </div>
          )}

          <form onSubmit={mode === "login" ? handleLogin : handleReset} className="mt-7 flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground-800">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-3 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
              />
            </div>

            {mode === "login" && (
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground-800">
                  Senha
                </label>
                <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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
            )}

            {mode === "login" && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError("");
                    setNotice("");
                  }}
                  className="cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-sm text-accent-900">
                <i className="ri-error-warning-line mt-0.5 text-base"></i>
                <div className="min-w-0">
                  <span>{error}</span>
                  {networkIssue && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleConnectionCheck}
                        disabled={checkingConnection}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-400 bg-background-50 px-2.5 py-1.5 text-xs font-semibold text-accent-900 hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <i className={checkingConnection ? "ri-loader-4-line animate-spin" : "ri-wifi-line"}></i>
                        {checkingConnection ? "Testando..." : "Testar conexão"}
                      </button>
                      {connectionStatus === "ok" && (
                        <span className="text-xs font-medium text-primary-700">
                          Servidor acessível. Tente entrar novamente.
                        </span>
                      )}
                      {connectionStatus === "fail" && (
                        <span className="text-xs font-medium text-accent-800">
                          Ainda sem conexão com o servidor. Verifique a rede ou desative bloqueadores.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {notice && (
              <div className="flex items-start gap-2 rounded-md border border-primary-300 bg-primary-50 px-3.5 py-2.5 text-sm text-primary-900">
                <i className="ri-mail-check-line mt-0.5 text-base"></i>
                <span>{notice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-base"></i>
                  {mode === "login" ? "Entrando..." : "Enviando..."}
                </>
              ) : mode === "login" ? (
                <>
                  <i className="ri-login-box-line text-base"></i>
                  Entrar no sistema
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line text-base"></i>
                  Enviar link de redefinição
                </>
              )}
            </button>

            {mode === "reset" && (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setNotice("");
                }}
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground-600 hover:text-foreground-900"
              >
                <i className="ri-arrow-left-line"></i>
                Voltar para o login
              </button>
            )}
          </form>

          <div className="mt-8 rounded-lg border border-background-200 bg-background-100 px-4 py-3.5">
            <p className="text-sm text-foreground-700">
              <span className="font-semibold text-foreground-900">Primeiro acesso?</span> Sua empresa já liberou seu
              e-mail?{" "}
              <Link to="/primeiro-acesso" className="font-semibold text-primary-600 hover:text-primary-700">
                Ative sua conta e escolha a senha
              </Link>
              .
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-foreground-600">
            Ainda não tem acesso?{" "}
            <Link to="/#planos" className="font-semibold text-primary-600 hover:text-primary-700">
              Conheça os planos
            </Link>
          </p>

          <div className="mt-8 flex items-center justify-center border-t border-background-200 pt-5">
            <Link
              to="/app/empresas"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-400 transition-colors hover:text-foreground-700"
            >
              <i className="ri-shield-star-line"></i>
              Acesso da plataforma
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}