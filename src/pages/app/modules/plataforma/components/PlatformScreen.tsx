import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import PlatformGate from "@/pages/app/modules/plataforma/components/PlatformGate";
import { platformApi } from "@/pages/app/modules/plataforma/platformApi";
import { usePlatformSession } from "@/pages/app/modules/plataforma/usePlatformSession";

interface PlatformScreenProps {
  /** Identificador da tela, gravado na auditoria junto com IP e data/hora. */
  screen: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

const platformTabs = [
  { to: "/app/empresas", label: "Empresas", icon: "ri-building-2-line", match: (path: string) => path === "/app/empresas" },
  { to: "/app/plataforma", label: "Base CAEPI", icon: "ri-database-2-line", match: (path: string) => path === "/app/plataforma" },
  {
    to: "/app/plataforma/importacao",
    label: "Importar base",
    icon: "ri-file-upload-line",
    match: (path: string) => path.startsWith("/app/plataforma/importacao"),
  },
  {
    to: "/app/plataforma/parametrizacao",
    label: "Parametrização",
    icon: "ri-equalizer-line",
    match: (path: string) => path.startsWith("/app/plataforma/parametrizacao"),
  },
  {
    to: "/app/plataforma/perfis",
    label: "Perfis & permissões",
    icon: "ri-shield-user-line",
    match: (path: string) => path.startsWith("/app/plataforma/perfis"),
  },
  {
    to: "/app/plataforma/licencas",
    label: "Licenças",
    icon: "ri-bank-card-line",
    match: (path: string) => path.startsWith("/app/plataforma/licencas"),
  },
  {
    to: "/app/plataforma/pagamentos",
    label: "Pagamentos",
    icon: "ri-wallet-3-line",
    match: (path: string) => path.startsWith("/app/plataforma/pagamentos"),
  },
  {
    to: "/app/plataforma/logs",
    label: "Logs do sistema",
    icon: "ri-history-line",
    match: (path: string) => path.startsWith("/app/plataforma/logs"),
  },
];

export default function PlatformScreen({ screen, title, subtitle, children }: PlatformScreenProps) {
  const { loading, email, isPlatformAdmin, error, signIn, signOut } = usePlatformSession();
  const location = useLocation();
  const logged = useRef<string | null>(null);

  // Cada abertura de tela do painel global entra na auditoria do servidor.
  useEffect(() => {
    if (!isPlatformAdmin || loading) return;
    if (logged.current === screen) return;
    logged.current = screen;
    void platformApi.logAccess(screen).catch(() => {
      // Falha ao registrar não deve impedir o uso da tela.
    });
  }, [isPlatformAdmin, loading, screen]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center py-24">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Validando acesso…
        </span>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <PlatformGate loading={loading} error={error} onSignIn={signIn} />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-shield-star-line"></i>
            Administração da plataforma
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-600">{subtitle}</p>
        </div>
        <div className="flex flex-col items-start gap-2 rounded-lg border border-background-200 bg-background-50 px-4 py-3 lg:items-end">
          <p className="flex items-center gap-1.5 text-xs text-foreground-600">
            <i className="ri-shield-check-line text-primary-600"></i>
            {email}
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-logout-box-line"></i>
            Sair do painel
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1 rounded-full bg-background-100 p-1">
        {platformTabs.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                active
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200 hover:text-foreground-900"
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}