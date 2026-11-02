import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { platformApi } from "@/pages/app/modules/plataforma/platformApi";
import {
  defaultRolePermissions,
  mergeRolePermissions,
  permissionCatalog,
  roleMeta,
  type PlatformRoleKey,
  type RolePermissions,
} from "@/pages/app/modules/plataforma/platformDefaults";

const roleOrder: PlatformRoleKey[] = ["super", "admin", "colaborador"];

export default function RolePermissionsPanel() {
  const [permissions, setPermissions] = useState<RolePermissions>(defaultRolePermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformApi.settingsGet();
      setPermissions(mergeRolePermissions(data.rolePermissions));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as permissões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof permissionCatalog>();
    permissionCatalog.forEach((field) => {
      const list = map.get(field.group) ?? [];
      list.push(field);
      map.set(field.group, list);
    });
    return Array.from(map.entries());
  }, []);

  const toggle = (role: PlatformRoleKey, key: string) => {
    if (role === "super") return;
    setPermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }));
  };

  const counts = useMemo(() => {
    const result: Record<PlatformRoleKey, number> = { super: 0, admin: 0, colaborador: 0 };
    roleOrder.forEach((role) => {
      result[role] = permissionCatalog.filter((field) => permissions[role][field.key]).length;
    });
    return result;
  }, [permissions]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        admin: permissions.admin,
        colaborador: permissions.colaborador,
      };
      await platformApi.saveRolePermissions(payload);
      setMessage("Perfis e permissões salvos. A matriz passa a valer para os vínculos aplicáveis.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-16">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando perfis…
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {roleOrder.map((role) => {
          const meta = roleMeta[role];
          const isSuper = role === "super";
          return (
            <div
              key={role}
              className={`rounded-lg border p-4 ${
                isSuper ? "border-accent-300 bg-accent-50" : "border-background-200 bg-background-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    isSuper ? "bg-accent-200 text-accent-900" : "bg-secondary-100 text-secondary-900"
                  }`}
                >
                  <i className={`${meta.icon} text-base`}></i>
                </span>
                <span className="rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
                  {counts[role]}/{permissionCatalog.length}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground-950">{meta.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {(error || message) && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-md border px-4 py-3 text-xs leading-relaxed ${
            error ? "border-accent-300 bg-accent-50 text-accent-900" : "border-primary-200 bg-primary-50 text-primary-900"
          }`}
        >
          <i className={`${error ? "ri-error-warning-line" : "ri-checkbox-circle-line"} mt-0.5 text-sm`}></i>
          <span>{error || message}</span>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-background-200">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Permissão
                </th>
                {roleOrder.map((role) => (
                  <th
                    key={role}
                    className="w-[130px] px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-foreground-400"
                  >
                    {roleMeta[role].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([group, fields]) => (
                <Fragment key={group}>
                  <tr className="bg-background-100">
                    <td colSpan={4} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-foreground-500">
                      {group}
                    </td>
                  </tr>
                  {fields.map((field) => (
                    <tr key={field.key} className="border-b border-background-100 last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-foreground-900">{field.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">{field.description}</p>
                        <p className="mt-1 font-mono text-[10px] text-foreground-400">{field.key}</p>
                      </td>
                      {roleOrder.map((role) => {
                        const active = Boolean(permissions[role][field.key]);
                        const locked = role === "super";
                        return (
                          <td key={role} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggle(role, field.key)}
                              disabled={locked}
                              aria-pressed={active}
                              aria-label={`${roleMeta[role].label}: ${field.label}`}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                                locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                              } ${
                                active
                                  ? "border-primary-300 bg-primary-100 text-primary-700"
                                  : "border-background-300 bg-background-50 text-foreground-300 hover:bg-background-100"
                              }`}
                            >
                              <i className={active ? "ri-check-line text-sm" : "ri-subtract-line text-sm"}></i>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground-500">
          <i className="ri-lock-2-line mt-0.5 text-primary-600"></i>
          O superadministrador da plataforma tem permissões fixas. Administrador e Colaborador seguem a matriz acima:
          a tela sem a capacidade liberada sai do menu e não abre nem por acesso direto à rota.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPermissions(defaultRolePermissions())}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-arrow-go-back-line"></i>
            Padrões
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={saving ? "ri-loader-4-line animate-spin" : "ri-save-3-line"}></i>
            {saving ? "Salvando…" : "Salvar permissões"}
          </button>
        </div>
      </div>
    </div>
  );
}