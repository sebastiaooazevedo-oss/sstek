import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Sessão real do Superadministrador da plataforma.
 *
 * Diferente do login demonstrativo do app, este painel exige uma conta do Supabase Auth
 * e o vínculo ativo em `platform_admins`. Sem esse vínculo, o backend também recusa as
 * operações — a tela não é a única barreira.
 */

interface PlatformSessionState {
  loading: boolean;
  email: string | null;
  userId: string | null;
  isPlatformAdmin: boolean;
  error: string | null;
}

export function usePlatformSession() {
  const [state, setState] = useState<PlatformSessionState>({
    loading: true,
    email: null,
    userId: null,
    isPlatformAdmin: false,
    error: null,
  });

  const evaluate = useCallback(async (email: string | null, userId: string | null) => {
    if (!userId) {
      setState({ loading: false, email: null, userId: null, isPlatformAdmin: false, error: null });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) throw new Error(error.message);
      setState({
        loading: false,
        email,
        userId,
        isPlatformAdmin: data === true,
        error: data === true ? null : "Esta conta não possui vínculo ativo de Superadministrador da plataforma.",
      });
    } catch (err) {
      setState({
        loading: false,
        email,
        userId,
        isPlatformAdmin: false,
        error: err instanceof Error ? err.message : "Não foi possível validar a permissão.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      void evaluate(session?.user.email ?? null, session?.user.id ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      // O callback precisa retornar imediatamente e não pode aguardar chamadas do
      // mesmo cliente Supabase (risco de deadlock na inicialização do Auth).
      const email = session?.user.email ?? null;
      const userId = session?.user.id ?? null;
      window.setTimeout(() => {
        void evaluate(email, userId);
      }, 0);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [evaluate]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: error.message }));
        return error.message;
      }
      const { data: isAdmin } = await supabase.rpc("is_platform_admin");
      if (isAdmin !== true) {
        await supabase.auth.signOut();
        const message =
          "Conta autenticada, mas sem vínculo ativo de Superadministrador da plataforma. Administradores de empresa não acessam funções globais.";
        setState({ loading: false, email: null, userId: null, isPlatformAdmin: false, error: message });
        return message;
      }
      setState({
        loading: false,
        email: data.user?.email ?? email,
        userId: data.user?.id ?? null,
        isPlatformAdmin: true,
        error: null,
      });
      return null;
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ loading: false, email: null, userId: null, isPlatformAdmin: false, error: null });
  }, []);

  return { ...state, signIn, signOut, refresh: evaluate };
}