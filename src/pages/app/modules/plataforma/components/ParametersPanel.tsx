import { useCallback, useEffect, useState } from "react";
import { platformApi } from "@/pages/app/modules/plataforma/platformApi";
import {
  defaultParameters,
  mergeParameters,
  profileMeta,
  profileOptionCatalog,
  type PlatformParameters,
  type ProfileKey,
  type ProfileOptions,
} from "@/pages/app/modules/plataforma/platformDefaults";
import { systemModules } from "@/pages/app/settings/modules";
import PlatformSwitch from "@/pages/app/modules/plataforma/components/PlatformSwitch";

const roles: ProfileKey[] = ["admin", "colaborador"];

export default function ParametersPanel() {
  const [parameters, setParameters] = useState<PlatformParameters>(defaultParameters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformApi.settingsGet();
      setParameters(mergeParameters(data.parameters));
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a parametrização.");
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

  const toggleModule = (role: ProfileKey, moduleId: string) => {
    setParameters((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [role]: {
          ...prev.profiles[role],
          modules: {
            ...prev.profiles[role].modules,
            [moduleId]: !prev.profiles[role].modules[moduleId],
          },
        },
      },
    }));
  };

  const toggleOption = (role: ProfileKey, key: keyof ProfileOptions) => {
    setParameters((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [role]: {
          ...prev.profiles[role],
          options: { ...prev.profiles[role].options, [key]: !prev.profiles[role].options[key] },
        },
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await platformApi.saveParameters(parameters as unknown as Record<string, unknown>);
      setMessage("Parametrização por perfil salva. Novos vínculos já usam esses padrões.");
      setUpdatedAt(new Date().toISOString());
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
          Carregando parametrização…
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-foreground-600">
          <i className="ri-information-line mt-0.5 text-sm text-primary-600"></i>
          Estes padrões definem o que cada perfil recebe ao ser criado. Ajustes individuais continuam sendo feitos no
          cadastro da empresa.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setParameters(defaultParameters())}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-arrow-go-back-line"></i>
            Restaurar padrões
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={saving ? "ri-loader-4-line animate-spin" : "ri-save-3-line"}></i>
            {saving ? "Salvando…" : "Salvar parametrização"}
          </button>
        </div>
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

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {roles.map((role) => {
          const meta = profileMeta[role];
          const profile = parameters.profiles[role];
          const enabledModules = systemModules.filter((module) => profile.modules[module.id]).length;
          return (
            <section key={role} className="rounded-lg border border-background-200 bg-background-50 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <i className={`${meta.icon} text-lg`}></i>
                </span>
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">{meta.label}</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">{meta.description}</p>
                </div>
                <span className="ml-auto whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                  {enabledModules}/{systemModules.length} módulos
                </span>
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Módulos habilitados por padrão
                </p>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {systemModules.map((module) => (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => toggleModule(role, module.id)}
                      aria-pressed={Boolean(profile.modules[module.id])}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                        profile.modules[module.id]
                          ? "border-primary-300 bg-primary-50 text-primary-900"
                          : "border-background-200 bg-background-50 text-foreground-500 hover:bg-background-100"
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                        <i
                          className={`${
                            profile.modules[module.id] ? "ri-checkbox-circle-fill text-primary-600" : "ri-checkbox-blank-circle-line"
                          } text-sm`}
                        ></i>
                      </span>
                      <span className="truncate">{module.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Comportamentos do perfil
                </p>
                <div className="mt-2.5 flex flex-col gap-2">
                  {profileOptionCatalog.map((option) => (
                    <PlatformSwitch
                      key={option.key}
                      checked={profile.options[option.key]}
                      onChange={() => toggleOption(role, option.key)}
                      label={option.label}
                      description={option.description}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {updatedAt && (
        <p className="mt-4 text-[11px] text-foreground-400">
          Última alteração registrada em {new Date(updatedAt).toLocaleString("pt-BR")}.
        </p>
      )}
    </div>
  );
}