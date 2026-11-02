import { useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import BrandLogo from "@/components/base/BrandLogo";
import AppLoadingScreen from "@/pages/app/components/AppLoadingScreen";
import { blockReasons, useAuth } from "@/pages/app/auth/authProvider";

interface SessionGateProps {
  /** Rotas da plataforma (globais) não exigem vínculo com uma empresa. */
  requireTenant?: boolean;
  children: ReactNode;
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-lg border border-background-200 bg-background-50 p-6 md:p-8">{children}</div>
    </div>
  );
}

/**
 * Portão de sessão do app interno.
 *
 * Existem quatro situações distintas e nenhuma delas vira "tela vazia":
 * carregando, falta de sessão (redireciona ao login), ausência de permissão
 * (motivo vindo do banco) e falha de conexão (com nova tentativa).
 */
export default function SessionGate({ requireTenant = true, children }: SessionGateProps) {
  const { loading, userId, session, blockReason, isPlatformAdmin, error, signOut, refresh } = useAuth();
  const location = useLocation();
  const hadUser = useRef(false);

  useEffect(() => {
    if (userId) hadUser.current = true;
  }, [userId]);

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (error) {
    return (
      <FullScreen>
        <BrandLogo className="h-9" />
        <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-wifi-off-line text-xl"></i>
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
          Não foi possível validar a sessão
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">
          A conexão com o servidor falhou ou a sessão expirou. Nenhuma permissão é concedida enquanto isso não for
          resolvido.
        </p>
        <p className="mt-3 rounded-md bg-background-100 px-3 py-2 text-[11px] leading-relaxed text-foreground-500">{error}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-logout-box-r-line"></i>
            Sair
          </button>
        </div>
      </FullScreen>
    );
  }

  if (!userId) {
    return <Navigate to="/login" replace state={{ from: location.pathname, expired: hadUser.current }} />;
  }

  // O Superadministrador da plataforma é um vínculo separado (`platform_admins`) e
  // não precisa de empresa. Bloquear por falta de vínculo empresarial o impediria de
  // abrir o próprio painel — a autorização real continua sendo checada no banco.
  const lacksTenantOnly = blockReason === "no_link" || blockReason === "no_company";

  if (isPlatformAdmin && lacksTenantOnly) {
    if (!requireTenant) return <>{children}</>;
    return <Navigate to="/app/empresas" replace />;
  }

  if (blockReason) {
    const info = blockReasons[blockReason];
    return (
      <FullScreen>
        <BrandLogo className="h-9" />
        <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className={`${info.icon} text-xl`}></i>
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">{info.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">{info.message}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-refresh-line"></i>
            Verificar de novo
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-logout-box-r-line"></i>
            Usar outra conta
          </button>
          <Link to="/" className="text-sm font-semibold text-foreground-500 hover:text-foreground-800">
            Voltar ao site
          </Link>
        </div>
      </FullScreen>
    );
  }

  if (requireTenant && !session) {
    const info = blockReasons.no_link;
    return (
      <FullScreen>
        <BrandLogo className="h-9" />
        <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">{info.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">{info.message}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
        >
          <i className="ri-logout-box-r-line"></i>
          Sair
        </button>
      </FullScreen>
    );
  }

  return <>{children}</>;
}