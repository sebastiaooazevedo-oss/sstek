import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "@/pages/app/components/AppSidebar";
import AppTopbar from "@/pages/app/components/AppTopbar";
import DailyMoodGate from "@/pages/app/components/DailyMoodGate";
import TenantGate from "@/pages/app/components/TenantGate";
import SessionGate from "@/pages/app/components/SessionGate";
import PermissionGuard from "@/pages/app/components/PermissionGuard";
import { AppSessionContext, type AppSession } from "@/pages/app/context";
import { useAuth } from "@/pages/app/auth/authProvider";
import { setSealSubdomain } from "@/pages/app/signature/authenticitySeal";

/**
 * Casca do sistema interno.
 *
 * A sessão exibida aqui vem exclusivamente do Supabase Auth + `session_context()`.
 * Não existe mais leitura de papel/empresa do localStorage, nem fallback para
 * dados de demonstração quando o vínculo não é encontrado.
 */
export default function AppLayout() {
  const location = useLocation();
  const { session: tenant, email: authEmail } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // A administração da plataforma é global (cross-tenant): exige conta autenticada
  // e vínculo em `platform_admins` (verificado no painel e no backend), mas não exige
  // vínculo com uma empresa.
  const isPlatformArea =
    location.pathname.startsWith("/app/empresas") || location.pathname.startsWith("/app/plataforma");

  const session = useMemo<AppSession>(() => {
    if (isPlatformArea) {
      return {
        role: "super",
        subdomain: tenant?.subdomain ?? "",
        company: tenant?.company ?? "Plataforma SSTEK",
        name: tenant?.name ?? authEmail?.split("@")[0] ?? "Superadministrador",
        email: tenant?.email ?? authEmail ?? "",
      };
    }
    return {
      role: tenant?.role ?? "colaborador",
      subdomain: tenant?.subdomain ?? "",
      company: tenant?.company ?? "",
      name: tenant?.name ?? "",
      email: tenant?.email ?? authEmail ?? "",
    };
  }, [tenant, authEmail, isPlatformArea]);

  const shell = (
    <div className="flex h-screen w-full overflow-hidden bg-background-100">
      <AppSidebar
        role={session.role}
        subdomain={session.subdomain}
        company={session.company}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar onOpenMenu={() => setSidebarOpen(true)} />
        <main className="app-content flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
          <PermissionGuard>
            <Outlet />
          </PermissionGuard>
        </main>
      </div>
    </div>
  );

  return (
    <AppSessionContext.Provider value={session}>
      <SealBootstrap subdomain={session.subdomain} />
      <SessionGate requireTenant={!isPlatformArea}>
        {isPlatformArea ? (
          shell
        ) : (
          <TenantGate subdomain={session.subdomain}>
            {shell}
            <DailyMoodGate />
          </TenantGate>
        )}
      </SessionGate>
    </AppSessionContext.Provider>
  );
}

/** Mantém o subdomínio atual disponível para a chancela dos PDFs. */
function SealBootstrap({ subdomain }: { subdomain: string }) {
  useEffect(() => {
    setSealSubdomain(subdomain);
  }, [subdomain]);
  return null;
}