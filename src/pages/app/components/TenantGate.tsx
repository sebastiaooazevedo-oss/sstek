import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import BrandLogo from "@/components/base/BrandLogo";
import AppLoadingScreen from "@/pages/app/components/AppLoadingScreen";
import { tenantHost } from "@/core/domain";

type TenantState = "loading" | "ok" | "unknown" | "suspended" | "error";

interface TenantRow {
  id: string;
  name: string;
  subdomain: string;
  status: string;
}

interface TenantGateProps {
  subdomain: string;
  children: ReactNode;
}

/**
 * Resolve o tenant pelo subdomínio antes de abrir o sistema.
 *
 * O subdomínio apenas IDENTIFICA a empresa — quem autoriza é a sessão + as regras do banco.
 * Subdomínio desconhecido não cai em "primeira empresa": mostra uma página própria.
 * Empresa suspensa tem o acesso bloqueado sem qualquer exclusão de dados.
 */
export default function TenantGate({ subdomain, children }: TenantGateProps) {
  const [state, setState] = useState<TenantState>("loading");
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("resolve_tenant", { p_subdomain: subdomain });
      if (rpcError) throw new Error(rpcError.message);
      const rows = (data as TenantRow[] | null) ?? [];
      const found = rows[0] ?? null;
      setTenant(found);
      if (!found) {
        setState("unknown");
        return;
      }
      if (found.status === "suspended") {
        setState("suspended");
        return;
      }
      setState("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível validar a empresa.");
      setState("error");
    }
  }, [subdomain]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  if (state === "ok") return <>{children}</>;

  if (state === "loading") {
    return <AppLoadingScreen />;
  }

  const isUnknown = state === "unknown";
  const isSuspended = state === "suspended";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-lg border border-background-200 bg-background-50 p-6 md:p-8">
        <BrandLogo className="h-9" />
        <span
          className={`mt-6 flex h-12 w-12 items-center justify-center rounded-lg ${
            isSuspended ? "bg-accent-100 text-accent-800" : "bg-secondary-100 text-secondary-900"
          }`}
        >
          <i
            className={`${
              isSuspended ? "ri-lock-2-line" : isUnknown ? "ri-question-line" : "ri-error-warning-line"
            } text-xl`}
          ></i>
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
          {isSuspended
            ? "Acesso suspenso"
            : isUnknown
              ? "Subdomínio não encontrado"
              : "Não foi possível validar a empresa"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">
          {isSuspended ? (
            <>
              O acesso de <strong>{tenant?.name}</strong> está suspenso administrativamente. Nenhum dado foi excluído.
              Fale com o administrador da plataforma para regularizar a situação.
            </>
          ) : isUnknown ? (
            <>
              Não existe empresa vinculada ao endereço <strong>{tenantHost(subdomain)}</strong>. Por segurança, nenhum
              dado de outra empresa é exibido.
            </>
          ) : (
            <>Ocorreu uma falha ao consultar o cadastro da empresa. Tente novamente.</>
          )}
        </p>
        {error && state === "error" && (
          <p className="mt-3 rounded-md bg-background-100 px-3 py-2 text-[11px] leading-relaxed text-foreground-500">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void resolve()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-arrow-left-line"></i>
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}