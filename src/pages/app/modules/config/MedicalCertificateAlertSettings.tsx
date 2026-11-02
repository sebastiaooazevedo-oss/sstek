import { useEffect, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { updateSetting, useSystemSettings } from "@/pages/app/settings/settingsStore";

const PRESETS = [3, 5, 7, 15];

/**
 * Parametrização do alerta de afastamento prolongado.
 *
 * O número define a partir de quantos dias de afastamento um atestado médico
 * passa a gerar aviso no sino da gestão e destaque no resumo de absenteísmo.
 */
export default function MedicalCertificateAlertSettings() {
  const session = useAppSession();
  const settings = useSystemSettings();
  const current = settings.certificateLeaveAlertDays;
  const [draft, setDraft] = useState(String(current));

  useEffect(() => {
    setDraft(String(current));
  }, [current]);

  const commit = (raw: string) => {
    const days = Math.round(Number(raw));
    if (!Number.isFinite(days) || days < 1) {
      setDraft(String(current));
      return;
    }
    const clamped = Math.min(365, days);
    setDraft(String(clamped));
    if (clamped !== current) {
      updateSetting("certificateLeaveAlertDays", clamped, { name: session.name });
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-alarm-warning-line text-lg"></i>
        </span>
        <div>
          <h2 className="font-heading text-base font-bold text-foreground-950">Atestados médicos</h2>
          <p className="mt-0.5 text-xs text-foreground-500">
            Defina quando um afastamento deve chamar a atenção da gestão no sino de notificações.
          </p>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold text-foreground-900">
              Alertar a partir de quantos dias de afastamento
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
              Atestados com afastamento <strong className="font-semibold">igual ou acima</strong> deste número geram o
              aviso “Afastamento prolongado” no sino do administrador, com atalho para a ficha do colaborador, e ficam
              destacados no resumo de absenteísmo do dashboard.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => commit(String(preset))}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    preset === current
                      ? "bg-primary-500 text-background-50"
                      : "border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
                  }`}
                >
                  <i className="ri-timer-line text-sm"></i>
                  {preset} dias
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-end gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-foreground-600">Dias de afastamento</span>
              <input
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit((e.target as HTMLInputElement).value);
                  }
                }}
                aria-label="Dias de afastamento para gerar alerta"
                className="w-24 rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-right text-sm font-semibold text-foreground-900 outline-none transition-colors focus:border-primary-400"
              />
            </label>
            <span className="pb-2.5 text-xs font-semibold text-foreground-500">dia(s)</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-600">
        <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          O limite vale apenas para novos avisos no sino — o atestado continua registrado e visível na ficha do
          colaborador, no card de atestados recebidos e no resumo de absenteísmo, independentemente dos dias.
        </span>
      </div>
    </section>
  );
}