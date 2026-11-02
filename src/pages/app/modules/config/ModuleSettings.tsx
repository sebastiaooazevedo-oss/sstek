import { isModuleEnabled, useSystemSettings } from "@/pages/app/settings/settingsStore";
import { systemModules } from "@/pages/app/settings/modules";

/**
 * Módulos contratados da empresa.
 *
 * A lista é definida pela PLATAFORMA (super usuário) e chega aqui somente para
 * leitura: o administrador do cliente não pode liberar módulo por conta própria.
 * Módulos desativados desaparecem do menu lateral e das telas relacionadas.
 */
export default function ModuleSettings() {
  const settings = useSystemSettings();
  const enabledCount = systemModules.filter((module) => isModuleEnabled(settings, module.id)).length;
  const allEnabled = enabledCount === systemModules.length;

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-apps-2-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Módulos do sistema</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Módulos contratados pela empresa. A liberação é feita pela plataforma — aqui você apenas acompanha o
              que está ativo.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${
            allEnabled ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-900"
          }`}
        >
          <i className={allEnabled ? "ri-checkbox-circle-line" : "ri-equalizer-2-line"}></i>
          {allEnabled ? "Todos habilitados" : `${enabledCount} de ${systemModules.length} habilitados`}
        </span>
      </div>

      <ul>
        {systemModules.map((module) => {
          const enabled = isModuleEnabled(settings, module.id);
          return (
            <li
              key={module.id}
              className="flex flex-col gap-3 border-b border-background-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    enabled ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-500"
                  }`}
                >
                  <i className={`${module.icon} text-lg`}></i>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground-900">{module.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        enabled ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {enabled ? "Ativado" : "Desativado"}
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-600">{module.description}</p>
                </div>
              </div>

              <span
                className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                  enabled
                    ? "border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100"
                    : "border-background-300 bg-background-100 text-foreground-600"
                }`}
              >
                <i className={enabled ? "ri-lock-unlock-line" : "ri-lock-line"}></i>
                {enabled ? "Contratado" : "Não contratado"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-600">
        <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          Precisa ativar ou desativar um módulo? Fale com o suporte da plataforma. Os dados já registrados continuam
          guardados: o módulo apenas deixa de aparecer no menu até ser reativado.
        </span>
      </div>
    </section>
  );
}