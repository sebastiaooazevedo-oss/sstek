import { useCallback, useEffect, useState } from "react";
import PlatformSwitch from "@/pages/app/modules/plataforma/components/PlatformSwitch";
import { platformApi } from "@/pages/app/modules/plataforma/platformApi";
import { systemModules } from "@/pages/app/settings/modules";

/**
 * Módulos contratados da plataforma.
 *
 * Esta é a única origem da lista de módulos habilitados: o administrador do
 * cliente vê o resultado em Configurações, mas não consegue liberar nada por
 * conta própria (a escrita é feita pelo servidor, em `system_settings`).
 */
export default function ModulesPanel() {
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformApi.modulesGet();
      setModules(data.modules ?? {});
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os módulos.");
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

  const isEnabled = (moduleId: string) => modules[moduleId] !== false;

  const toggle = (moduleId: string) => {
    setModules((prev) => ({ ...prev, [moduleId]: !isEnabled(moduleId) }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await platformApi.saveModules(modules);
      setMessage("Módulos da plataforma atualizados. As empresas passam a ver a nova lista.");
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os módulos.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-16">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando módulos…
        </span>
      </div>
    );
  }

  const enabledCount = systemModules.filter((module) => isEnabled(module.id)).length;

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-foreground-600">
          <i className="ri-information-line mt-0.5 text-sm text-primary-600"></i>
          <span>
            <strong>Chave geral da plataforma.</strong> Desligar aqui desliga o módulo para <strong>todas</strong> as empresas
            (ex.: manutenção). O que cada empresa contratou é definido em Empresas → <strong>Módulos</strong>. O administrador
            do cliente não pode liberar módulo por conta própria.
          </span>
        </p>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
            {enabledCount}/{systemModules.length} habilitados
          </span>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={saving ? "ri-loader-4-line animate-spin" : "ri-save-3-line"}></i>
            {saving ? "Salvando…" : "Salvar módulos"}
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

      <section className="mt-4 rounded-lg border border-background-200 bg-background-50 p-5">
        <div className="flex flex-col gap-2.5">
          {systemModules.map((module) => (
            <PlatformSwitch
              key={module.id}
              checked={isEnabled(module.id)}
              onChange={() => toggle(module.id)}
              label={module.name}
              description={module.description}
            />
          ))}
        </div>
      </section>

      {updatedAt && (
        <p className="mt-4 text-[11px] text-foreground-400">
          Última alteração registrada em {new Date(updatedAt).toLocaleString("pt-BR")}.
        </p>
      )}
    </div>
  );
}