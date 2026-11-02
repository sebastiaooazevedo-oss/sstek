import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/base/BrandLogo";
import { useAuth } from "@/pages/app/auth/authProvider";

/**
 * Definição de nova senha a partir do link enviado por e-mail.
 *
 * O Supabase Auth valida o token do link e cria a sessão de recuperação. Se não
 * houver sessão, o link está expirado/inválido e a tela informa isso — sem
 * liberar nenhuma área do sistema.
 */
export default function RedefinirSenha() {
  const navigate = useNavigate();
  const { updatePassword, userId, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setSubmitting(true);
    const message = await updatePassword(password);
    setSubmitting(false);
    if (message) {
      setError(
        message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid")
          ? "O link de redefinição expirou. Solicite um novo link na tela de login."
          : message
      );
      return;
    }
    navigate("/app", { replace: true });
  };

  const invalidLink = !loading && !userId;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-50 px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex">
          <BrandLogo />
        </Link>

        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
          Definir nova senha
        </h1>

        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            Validando o link de redefinição…
          </p>
        ) : invalidLink ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-foreground-600">
              Este link de redefinição é inválido ou expirou. Solicite um novo link na tela de login.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
              >
                <i className="ri-arrow-left-line"></i>
                Ir para o login
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-foreground-600">
              Escolha uma nova senha com pelo menos 8 caracteres. Ela passa a valer imediatamente.
            </p>
            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-foreground-800">
                  Nova senha
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-3 text-sm text-foreground-900 outline-none focus:border-primary-400"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-foreground-800">
                  Repita a nova senha
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-md border border-background-300 bg-background-50 px-3.5 py-3 text-sm text-foreground-900 outline-none focus:border-primary-400"
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
                className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-base"></i>
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className="ri-shield-keyhole-line text-base"></i>
                    Salvar nova senha
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}