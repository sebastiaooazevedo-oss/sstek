import { useState } from "react";
import { permissionResources } from "@/pages/app/permissions/permissionCatalog";
import {
  accessProfileTemplates,
  templatePermissions,
  type AccessProfileTemplate,
} from "@/pages/app/permissions/accessProfileTemplates";
import {
  createCompanyAccessProfile,
  type CompanyAccessProfile,
} from "@/pages/app/permissions/accessProfileStore";

const actionLabels = permissionResources.flatMap((resource) => resource.actions);

function grantedLabels(template: AccessProfileTemplate): string[] {
  return actionLabels.filter((action) => template.granted.includes(action.key)).map((action) => action.label);
}

interface ExampleProfilesPanelProps {
  companyId: string;
  profiles: CompanyAccessProfile[];
  onCreated: (profile: CompanyAccessProfile) => void;
  onError: (text: string) => void;
}

export default function ExampleProfilesPanel({
  companyId,
  profiles,
  onCreated,
  onError,
}: ExampleProfilesPanelProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const applyTemplate = async (template: AccessProfileTemplate) => {
    if (!companyId) return;
    setPendingKey(template.key);
    try {
      const created = await createCompanyAccessProfile(companyId, {
        name: template.name,
        description: template.description,
        icon: template.icon,
        permissions: templatePermissions(template),
      });
      onCreated(created);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível criar o perfil de exemplo.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="border-b border-background-200 bg-background-100/40 px-5 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
          <i className="ri-lightbulb-flash-line text-sm"></i>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground-900">Perfis de exemplo</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">
            Já vêm com as permissões certas para a função. Aplicar cria um perfil normal desta empresa, que você pode
            ajustar ou excluir depois.
          </p>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {accessProfileTemplates.map((template) => {
          const existing = profiles.find(
            (profile) => profile.name.trim().toLowerCase() === template.name.trim().toLowerCase()
          );
          const labels = grantedLabels(template);
          const visible = labels.slice(0, 6);
          const hidden = labels.length - visible.length;
          const busy = pendingKey === template.key;

          return (
            <li
              key={template.key}
              className="flex flex-col gap-3 rounded-xl border border-background-200 bg-background-50 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <i className={`${template.icon} text-lg`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground-900">
                    {template.name}
                    <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-secondary-800">
                      Exemplo
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-500">{template.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {visible.map((label) => (
                  <span
                    key={label}
                    className="rounded-md bg-background-100 px-2 py-1 text-[10px] font-medium text-foreground-700"
                  >
                    {label}
                  </span>
                ))}
                {hidden > 0 && (
                  <span className="rounded-md bg-background-100 px-2 py-1 text-[10px] font-semibold text-foreground-500">
                    +{hidden} permissões
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-background-200 pt-3">
                <span className="text-[11px] text-foreground-500">
                  {labels.length} permissões liberadas · sem exclusões nem gestão de acessos
                </span>
                {existing ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary-50 px-3 py-2 text-[11px] font-semibold text-primary-800">
                    <i className="ri-checkbox-circle-line"></i>
                    Já criado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void applyTemplate(template)}
                    disabled={busy || !companyId}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary-300 bg-background-50 px-3 py-2 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <i className={busy ? "ri-loader-4-line animate-spin" : "ri-add-line"}></i>
                    {busy ? "Criando…" : "Criar este perfil"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}