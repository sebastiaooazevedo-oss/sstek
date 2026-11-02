import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CompaniesPanel from "@/pages/app/modules/plataforma/components/CompaniesPanel";
import DomainsPanel from "@/pages/app/modules/plataforma/components/DomainsPanel";
import CaepiPanel from "@/pages/app/modules/plataforma/components/CaepiPanel";
import AuditPanel from "@/pages/app/modules/plataforma/components/AuditPanel";
import SealsPanel from "@/pages/app/modules/plataforma/components/SealsPanel";
import PlatformGate from "@/pages/app/modules/plataforma/components/PlatformGate";
import AppLoadingScreen from "@/pages/app/components/AppLoadingScreen";
import { platformApi, type PlatformOverview } from "@/pages/app/modules/plataforma/platformApi";
import { usePlatformSession } from "@/pages/app/modules/plataforma/usePlatformSession";

type TabId = "empresas" | "dominios" | "caepi" | "chancelas" | "auditoria";

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "empresas", label: "Empresas", icon: "ri-building-2-line" },
  { id: "dominios", label: "Subdomínios", icon: "ri-global-line" },
  { id: "caepi", label: "Base CAEPI", icon: "ri-database-2-line" },
  { id: "chancelas", label: "Chancelas emitidas", icon: "ri-shield-check-line" },
  { id: "auditoria", label: "Auditoria", icon: "ri-history-line" },
];

export default function PlataformaPage() {
  const { loading, email, isPlatformAdmin, error, signIn, signOut } = usePlatformSession();
  const location = useLocation();
  const navigate = useNavigate();
  const initialTab = useMemo<TabId>(() => {
    const value = new URLSearchParams(location.search).get("tab");
    if (value === "dominios" || value === "caepi" || value === "chancelas" || value === "auditoria") {
      return value;
    }
    if (location.pathname.replace(/\/$/, "").endsWith("/plataforma")) return "caepi";
    return "empresas";
  }, [location.search, location.pathname]);

  const [tab, setTab] = useState<TabId>(initialTab);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const notify = useCallback((success: string | null, failure: string | null = null) => {
    setMessage(success);
    setMessageError(failure);
  }, []);

  const loadOverview = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const data = await platformApi.overview();
      setOverview(data);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Não foi possível carregar os dados da plataforma.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    void loadOverview();
  }, [isPlatformAdmin, loadOverview]);

  // Registra a abertura do painel global (IP e data/hora no servidor).
  useEffect(() => {
    if (!isPlatformAdmin) return;
    void platformApi.logAccess("empresas").catch(() => {
      // Uma falha no registro não deve impedir o uso do painel.
    });
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!message && !messageError) return;
    const timer = window.setTimeout(() => {
      setMessage(null);
      setMessageError(null);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [message, messageError]);

  useEffect(() => {
    if (tab === initialTab) return;
    navigate(tab === "empresas" ? "/app/empresas" : `/app/empresas?tab=${tab}`, { replace: true });
  }, [tab, initialTab, navigate]);

  if (loading) {
    return <AppLoadingScreen variant="panel" />;
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
            Superadministrador SSTEK
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-600">
            Empresas, subdomínios, vínculos de administradores e a base central CAEPI. Todas as operações são
            validadas no servidor e registradas em auditoria.
          </p>
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
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === item.id
                ? "bg-primary-500 text-background-50"
                : "text-foreground-600 hover:bg-background-200 hover:text-foreground-900"
            }`}
          >
            <i className={item.icon}></i>
            {item.label}
          </button>
        ))}
        <span className="ml-auto hidden pr-2 text-[11px] text-foreground-500 md:block">
          {overview ? `${overview.companies.length} empresa(s) · ${overview.domains.length} domínio(s)` : ""}
        </span>
      </div>

      {(message || messageError) && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-xs leading-relaxed ${
            messageError
              ? "border-accent-300 bg-accent-50 text-accent-900"
              : "border-primary-200 bg-primary-50 text-primary-900"
          }`}
        >
          <i className={`${messageError ? "ri-error-warning-line" : "ri-checkbox-circle-line"} mt-0.5 text-sm`}></i>
          <span>{messageError || message}</span>
        </div>
      )}

      {loadingData && !overview && (
        <div className="mt-8">
          <AppLoadingScreen variant="panel" />
        </div>
      )}

      {dataError && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 px-4 py-4 text-sm text-accent-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <i className="ri-error-warning-line mt-0.5"></i>
            {dataError}
          </span>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-accent-700"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        </div>
      )}

      {overview && (
        <div className="mt-5">
          {tab === "empresas" && (
            <CompaniesPanel
              companies={overview.companies}
              admins={overview.companyAdmins}
              reservedSubdomains={overview.reservedSubdomains}
              onRefresh={loadOverview}
              notify={notify}
            />
          )}
          {tab === "dominios" && (
            <DomainsPanel
              domains={overview.domains}
              companies={overview.companies}
              onRefresh={loadOverview}
              notify={notify}
            />
          )}
          {tab === "caepi" && (
            <CaepiPanel activeCatalog={overview.activeCatalog} onRefresh={loadOverview} notify={notify} />
          )}
          {tab === "chancelas" && <SealsPanel />}
          {tab === "auditoria" && <AuditPanel audit={overview.audit} companies={overview.companies} />}
        </div>
      )}
    </div>
  );
}