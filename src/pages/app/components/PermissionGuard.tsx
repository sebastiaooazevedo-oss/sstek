import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import type { RoleId } from "@/mocks/app";
import AppLoadingScreen from "@/pages/app/components/AppLoadingScreen";
import { useAppSession } from "@/pages/app/context";
import { permissionCatalog } from "@/pages/app/modules/plataforma/platformDefaults";
import { permissionForPath } from "@/pages/app/permissions/accessControl";
import { isPermissionGranted, useEffectiveAccess } from "@/pages/app/permissions/permissionStore";

/**
 * Portão de permissões das telas do app interno.
 *
 * A matriz "Perfis & permissões" do painel global é aplicada aqui: uma tela sem
 * a capacidade liberada não abre, mesmo que a pessoa digite a rota na barra de
 * endereço. O menu lateral usa a mesma regra, então a tela também desaparece.
 */
export default function PermissionGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useAppSession();
  const { loading, access } = useEffectiveAccess();
  const role = access.role ?? (session.role as RoleId);
  const required = permissionForPath(location.pathname, role);

  if (loading) {
    return <AppLoadingScreen variant="panel" />;
  }

  if (required && !isPermissionGranted(access, required)) {
    const field = permissionCatalog.find((item) => item.key === required);
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-background-200 bg-background-50 p-6 md:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-lock-2-line text-xl"></i>
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
          Tela não liberada para o seu perfil
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">
          A capacidade <strong>{field?.label ?? required}</strong> está desativada para o perfil{" "}
          <strong>{role === "admin" ? "Administrador" : "Colaborador"}</strong> na matriz de perfis e permissões da
          plataforma.
        </p>
        <p className="mt-3 rounded-md bg-background-100 px-3.5 py-2.5 text-[11px] leading-relaxed text-foreground-500">
          Se você precisa desta tela, solicite ao Superadministrador da plataforma que libere a capacidade em{" "}
          <strong>Perfis &amp; permissões</strong>. A mudança vale para todos os vínculos do seu perfil.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-arrow-left-line"></i>
          Voltar ao painel
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}