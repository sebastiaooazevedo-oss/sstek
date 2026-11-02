import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { friendlyAuthError } from "@/lib/supabaseErrors";

/**
 * Autenticação real da plataforma.
 *
 * Nenhuma autorização é lida do navegador: identidade vem do Supabase Auth e o
 * vínculo com empresa/perfil vem de `session_context()`, que resolve tudo no
 * banco a partir de `auth.uid()`. O front só exibe o resultado.
 */

export type TenantRole = "admin" | "colaborador";

export type SessionBlockReason =
  | "no_link"
  | "ambiguous"
  | "multiple_links"
  | "no_company"
  | "profile_inactive"
  | "email_unverified"
  | "concurrent"
  | "no_email"
  | "company_suspended"
  | "company_inactive";

export interface TenantSession {
  profileId: string;
  companyId: string;
  role: TenantRole;
  name: string;
  email: string;
  company: string;
  subdomain: string;
  companyStatus: string;
}

interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  session: TenantSession | null;
  blockReason: SessionBlockReason | null;
  /** Vínculo ativo em `platform_admins` — independe de empresa. */
  isPlatformAdmin: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
}

const EMPTY_STATE: AuthState = {
  loading: true,
  userId: null,
  email: null,
  session: null,
  blockReason: null,
  isPlatformAdmin: false,
  error: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Mensagens por retorno de `session_context()`. Nada aqui concede acesso. */
export const blockReasons: Record<SessionBlockReason, { title: string; message: string; icon: string }> = {
  no_link: {
    title: "Conta sem vínculo com empresa",
    message:
      "Sua conta existe, mas não há um perfil autorizado para este e-mail. Peça ao administrador da sua empresa para liberar o acesso.",
    icon: "ri-user-unfollow-line",
  },
  ambiguous: {
    title: "Mais de um vínculo encontrado",
    message:
      "Existe mais de um perfil autorizado com este e-mail. Por segurança o acesso não é escolhido automaticamente — solicite ao administrador que ajuste o cadastro.",
    icon: "ri-question-line",
  },
  multiple_links: {
    title: "Conta vinculada a mais de uma empresa",
    message:
      "Esta conta está ligada a mais de um perfil. O acesso fica bloqueado até a correção pelo administrador da plataforma.",
    icon: "ri-error-warning-line",
  },
  no_company: {
    title: "Perfil sem empresa",
    message: "Seu perfil não está associado a nenhuma empresa ativa. Regularize o cadastro com o administrador.",
    icon: "ri-building-line",
  },
  profile_inactive: {
    title: "Perfil inativo",
    message: "Seu vínculo com a empresa está inativo. Fale com o administrador para reativar o acesso.",
    icon: "ri-lock-line",
  },
  email_unverified: {
    title: "Confirme seu e-mail",
    message:
      "É necessário confirmar o e-mail antes do primeiro acesso. Abra a mensagem enviada para a sua caixa de entrada e clique no link de confirmação.",
    icon: "ri-mail-check-line",
  },
  concurrent: {
    title: "Vínculo em processamento",
    message: "Outro acesso vinculou este e-mail ao mesmo tempo. Recarregue a página para tentar novamente.",
    icon: "ri-loader-4-line",
  },
  no_email: {
    title: "Conta sem e-mail",
    message: "Não foi possível identificar um e-mail válido na sua conta. Fale com o suporte da plataforma.",
    icon: "ri-mail-close-line",
  },
  company_suspended: {
    title: "Empresa suspensa",
    message:
      "O acesso desta empresa está suspenso administrativamente. Nenhum dado foi excluído. Procure o administrador da plataforma para regularizar.",
    icon: "ri-lock-2-line",
  },
  company_inactive: {
    title: "Empresa indisponível",
    message: "A empresa vinculada à sua conta não está ativa. Fale com o administrador da plataforma.",
    icon: "ri-building-4-line",
  },
};

function mapStatus(status: string): SessionBlockReason {
  switch (status) {
    case "no_link":
      return "no_link";
    case "ambiguous":
      return "ambiguous";
    case "multiple_links":
      return "multiple_links";
    case "no_company":
      return "no_company";
    case "profile_inactive":
      return "profile_inactive";
    case "email_unverified":
      return "email_unverified";
    case "concurrent":
      return "concurrent";
    case "no_email":
      return "no_email";
    default:
      return "no_link";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(EMPTY_STATE);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const evaluate = useCallback(async (userId: string | null, email: string | null) => {
    if (!userId) {
      if (mounted.current) {
        setState({
          loading: false,
          userId: null,
          email: null,
          session: null,
          blockReason: null,
          isPlatformAdmin: false,
          error: null,
        });
      }
      return;
    }
    try {
      const { data, error } = await supabase.rpc("session_context");
      if (error) throw new Error(error.message);
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as Record<string, unknown>[];
      const row = rows[0];
      const status = String(row?.status ?? "unknown");

      if (status === "linked") {
        const companyStatus = String(row?.company_status ?? "");
        if (companyStatus === "suspended") {
          if (mounted.current) {
            setState({
              loading: false,
              userId,
              email,
              session: null,
              blockReason: "company_suspended",
              isPlatformAdmin: false,
              error: null,
            });
          }
          return;
        }
        if (companyStatus !== "active") {
          if (mounted.current) {
            setState({
              loading: false,
              userId,
              email,
              session: null,
              blockReason: "company_inactive",
              isPlatformAdmin: false,
              error: null,
            });
          }
          return;
        }
        const role: TenantRole = row?.role === "admin" ? "admin" : "colaborador";
        if (mounted.current) {
          setState({
            loading: false,
            userId,
            email,
            session: {
              profileId: String(row?.profile_id ?? ""),
              companyId: String(row?.company_id ?? ""),
              role,
              name: String(row?.member_name ?? email ?? ""),
              email: String(row?.email ?? email ?? ""),
              company: String(row?.company_name ?? ""),
              subdomain: String(row?.company_subdomain ?? ""),
              companyStatus,
            },
            blockReason: null,
            isPlatformAdmin: false,
            error: null,
          });
        }
        return;
      }

      // Sem vínculo empresarial pode ainda ser um Superadministrador da plataforma
      // (vínculo separado em `platform_admins`). Perguntamos ao banco, nunca ao navegador.
      let platformAdmin = false;
      try {
        const { data: isAdmin } = await supabase.rpc("is_platform_admin");
        platformAdmin = isAdmin === true;
      } catch {
        platformAdmin = false;
      }

      if (mounted.current) {
        setState({
          loading: false,
          userId,
          email,
          session: null,
          blockReason: mapStatus(status),
          isPlatformAdmin: platformAdmin,
          error: null,
        });
      }
    } catch (err) {
      if (mounted.current) {
        setState({
          loading: false,
          userId,
          email,
          session: null,
          blockReason: null,
          isPlatformAdmin: false,
          error: err instanceof Error ? err.message : "Não foi possível validar a sessão.",
        });
      }
    }
  }, []);

  const handleSession = useCallback(
    (session: Session | null) => {
      void evaluate(session?.user.id ?? null, session?.user.email ?? null);
    },
    [evaluate]
  );

  useEffect(() => {
    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        // Libera a tela imediatamente e resolve o vínculo em seguida.
        setState((prev) => ({ ...prev, loading: true }));
        handleSession(data.session);
      })
      .catch(() => {
        if (active) {
          setState({
            loading: false,
            userId: null,
            email: null,
            session: null,
            blockReason: null,
            isPlatformAdmin: false,
            error: "Falha ao iniciar a sessão.",
          });
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // O callback precisa retornar de forma síncrona: nunca aguardar chamadas
      // do mesmo cliente Supabase aqui dentro (risco de deadlock do Auth).
      if (event === "SIGNED_OUT") {
        setState({
          loading: false,
          userId: null,
          email: null,
          session: null,
          blockReason: null,
          isPlatformAdmin: false,
          error: null,
        });
        return;
      }
      const userId = session?.user.id ?? null;
      const email = session?.user.email ?? null;
      window.setTimeout(() => {
        if (active) void evaluate(userId, email);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [evaluate, handleSession]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        const message = friendlyAuthError(error.message);
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return message;
      }
      await evaluate(data.user?.id ?? null, data.user?.email ?? null);
      return null;
    } catch (err) {
      // Falha de rede pode rejeitar a promise em vez de devolver `{ error }`.
      const message = friendlyAuthError(err instanceof Error ? err.message : null);
      setState((prev) => ({ ...prev, loading: false, error: message }));
      return message;
    }
  }, [evaluate]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sessão local é limpa mesmo se o servidor estiver inalcançável.
    }
    setState({
      loading: false,
      userId: null,
      email: null,
      session: null,
      blockReason: null,
      isPlatformAdmin: false,
      error: null,
    });
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    await evaluate(data.session?.user.id ?? null, data.session?.user.email ?? null);
  }, [evaluate]);

  const sendPasswordReset = useCallback(async (email: string): Promise<string | null> => {
    const base = __BASE_PATH__.split("/").filter(Boolean).join("/");
    const prefix = base ? `/${base}` : "";
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}${prefix}/redefinir-senha`,
      });
      return error ? friendlyAuthError(error.message) : null;
    } catch (err) {
      return friendlyAuthError(err instanceof Error ? err.message : null);
    }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? friendlyAuthError(error.message) : null;
    } catch (err) {
      return friendlyAuthError(err instanceof Error ? err.message : null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, refresh, sendPasswordReset, updatePassword }),
    [state, signIn, signOut, refresh, sendPasswordReset, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
}