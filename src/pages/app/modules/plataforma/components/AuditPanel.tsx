import { useMemo, useState } from "react";
import type { PlatformAuditRow, PlatformCompany } from "@/pages/app/modules/plataforma/platformApi";

interface AuditPanelProps {
  audit: PlatformAuditRow[];
  companies: PlatformCompany[];
}

const actionLabel: Record<string, { label: string; icon: string; tone: string }> = {
  company_created: { label: "Empresa cadastrada", icon: "ri-add-circle-line", tone: "bg-primary-100 text-primary-700" },
  company_updated: { label: "Empresa atualizada", icon: "ri-edit-line", tone: "bg-secondary-100 text-secondary-900" },
  company_suspended: { label: "Empresa suspensa", icon: "ri-pause-circle-line", tone: "bg-accent-200 text-accent-900" },
  company_reactivated: { label: "Empresa reativada", icon: "ri-play-circle-line", tone: "bg-primary-100 text-primary-700" },
  domain_saved: { label: "Subdomínio atualizado", icon: "ri-global-line", tone: "bg-secondary-100 text-secondary-900" },
  company_admin_linked: { label: "Administrador vinculado", icon: "ri-user-add-line", tone: "bg-secondary-100 text-secondary-900" },
  company_admin_updated: { label: "Vínculo de administrador atualizado", icon: "ri-user-settings-line", tone: "bg-secondary-100 text-secondary-900" },
  support_access: { label: "Acesso de suporte", icon: "ri-customer-service-2-line", tone: "bg-accent-100 text-accent-900" },
  caepi_batch_activated: { label: "Base CAEPI ativada", icon: "ri-database-2-line", tone: "bg-primary-100 text-primary-700" },
  access_denied: { label: "Acesso negado", icon: "ri-forbid-2-line", tone: "bg-accent-200 text-accent-900" },
  platform_panel_access: { label: "Acesso ao painel global", icon: "ri-login-box-line", tone: "bg-secondary-100 text-secondary-900" },
  platform_parameters_saved: { label: "Parametrização por perfil atualizada", icon: "ri-equalizer-line", tone: "bg-secondary-100 text-secondary-900" },
  platform_permissions_saved: { label: "Perfis e permissões atualizados", icon: "ri-shield-user-line", tone: "bg-secondary-100 text-secondary-900" },
  license_saved: { label: "Licença atualizada", icon: "ri-bank-card-line", tone: "bg-primary-100 text-primary-700" },
  invoice_status_changed: { label: "Cobrança atualizada", icon: "ri-wallet-3-line", tone: "bg-accent-100 text-accent-900" },
};

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export default function AuditPanel({ audit, companies }: AuditPanelProps) {
  const [actionFilter, setActionFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const actions = useMemo(() => Array.from(new Set(audit.map((row) => row.action))), [audit]);

  const filtered = audit.filter((row) => {
    const matchesAction = actionFilter === "all" || row.action === actionFilter;
    const matchesCompany = companyFilter === "all" || row.target_company_id === companyFilter;
    return matchesAction && matchesCompany;
  });

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todas as empresas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todas as ações</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {actionLabel[action]?.label ?? action}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-foreground-500">
          {filtered.length} registro(s) · trilha append-only (não pode ser editada nem apagada)
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="divide-y divide-background-100">
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-foreground-500">Nenhuma ação registrada com esses filtros.</p>
          )}
          {filtered.map((row) => {
            const meta = actionLabel[row.action] ?? {
              label: row.action,
              icon: "ri-history-line",
              tone: "bg-background-200 text-foreground-700",
            };
            const detail = row.detail ?? {};
            const ip = typeof detail.ip === "string" ? detail.ip : null;
            const userAgent = typeof detail.user_agent === "string" ? detail.user_agent : null;
            const detailEntries = Object.entries(detail).filter(
              ([key, value]) =>
                !["ip", "user_agent", "path"].includes(key) &&
                value !== null &&
                value !== undefined &&
                value !== ""
            );
            return (
              <div key={row.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                    <i className={`${meta.icon} text-sm`}></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground-900">{meta.label}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-foreground-600">
                      <span>{row.actor_name || row.actor_email || "Sistema"}</span>
                      {row.target_company_name && <span>· {row.target_company_name}</span>}
                      <span>· {formatDateTime(row.created_at)}</span>
                    </p>
                    {detailEntries.length > 0 && (
                      <p className="mt-1 break-words text-[10px] leading-relaxed text-foreground-400">
                        {detailEntries
                          .map(
                            ([key, value]) =>
                              `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`
                          )
                          .join(" · ")}
                      </p>
                    )}
                    {(ip || userAgent) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-foreground-500">
                        {ip && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2 py-0.5 font-medium"
                            title="Endereço IP registrado no servidor"
                          >
                            <i className="ri-map-pin-2-line"></i>
                            {ip}
                          </span>
                        )}
                        {userAgent && (
                          <span
                            className="max-w-[280px] truncate rounded-full bg-background-100 px-2 py-0.5"
                            title={userAgent}
                          >
                            {userAgent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}