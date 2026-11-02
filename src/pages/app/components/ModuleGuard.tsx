import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { toggleKeyForPath, toggleableModules } from "@/core/modules/registry";
import { isModuleEnabled, useSystemSettings } from "@/pages/app/settings/settingsStore";
import { useAppSession } from "@/pages/app/context";

/**
 * Portão de módulos contratados.
 *
 * O menu já esconde módulos desligados para a empresa; este portão garante que
 * a tela também não abra quando alguém digita o endereço direto. A área global
 * da plataforma (Superadministrador) não passa por aqui.
 *
 * Observação: este é um bloqueio de interface. O bloqueio definitivo dos dados
 * de um módulo não contratado deve existir também no banco (etapa de segurança).
 */
export default function ModuleGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useAppSession();
  const settings = useSystemSettings();

  if (session.role === "super") return <>{children}</>;

  const key = toggleKeyForPath(location.pathname);
  if (!key || isModuleEnabled(settings, key)) return <>{children}</>;

  const module = toggleableModules.find((m) => m.key === key);
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-background-200 bg-background-50 p-6 md:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
        <i className={`${module?.icon ?? "ri-lock-2-line"} text-xl`}></i>
      </span>
      <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
        Módulo não habilitado para a empresa
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-foreground-600">
        O módulo <strong>{module?.name ?? key}</strong> não está ativo no plano da {session.company || "empresa"}.
        Para usá-lo, peça ao administrador para habilitá-lo em Configurações da empresa ou fale com o suporte do SSTEK.
      </p>
      <Link
        to="/app"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-primary-50 transition-colors hover:bg-primary-700"
      >
        <i className="ri-arrow-left-line"></i>
        Voltar ao painel
      </Link>
    </div>
  );
}
