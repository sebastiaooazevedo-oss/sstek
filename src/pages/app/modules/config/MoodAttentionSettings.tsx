import { Link } from "react-router-dom";
import { updateSetting, useSystemSettings } from "@/pages/app/settings/settingsStore";

/**
 * Parametrização do bloco de atenção do sentimento no dashboard.
 *
 * O administrador pode desligar o resumo quando não quiser esse tipo de
 * informação na primeira tela — os registros e o painel de sentimento
 * continuam funcionando normalmente, apenas o card do dashboard some.
 */
export default function MoodAttentionSettings() {
  const settings = useSystemSettings();
  const enabled = settings.dashboardMoodAttention;

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-user-heart-line text-lg"></i>
        </span>
        <div>
          <h2 className="font-heading text-base font-bold text-foreground-950">Atenção no sentimento da equipe</h2>
          <p className="mt-0.5 text-xs text-foreground-500">
            Mostra no dashboard do administrador quem registrou sentimento negativo e ainda não teve acolhimento.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground-900">
              Exibir resumo de atenção no dashboard
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                enabled ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
              }`}
            >
              {enabled ? "Ativado" : "Desativado"}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
            Quando ativado, o painel inicial do administrador ganha um bloco com as pessoas que precisam de atenção,
            o sinal detectado e o status do acolhimento — com atalho para abrir a ficha e registrar a conversa. Ao
            desativar, o bloco sai do dashboard, mas o painel de Sentimento da equipe continua completo.
          </p>
          <Link
            to="/app/sentimento?tab=attention"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800"
          >
            <i className="ri-arrow-right-up-line"></i>
            Abrir o painel de sentimento
          </Link>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Exibir resumo de atenção no sentimento no dashboard"
          onClick={() => updateSetting("dashboardMoodAttention", !enabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
            enabled ? "bg-primary-500" : "bg-background-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform dark:bg-background-950 ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          ></span>
        </button>
      </div>

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-600">
        <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          O aviso do sino sobre sentimento negativo sem acolhimento continua ativo independentemente desta opção —
          ele é o alerta operacional para o gestor agir. As notas de acolhimento são visíveis apenas para a gestão.
        </span>
      </div>
    </section>
  );
}