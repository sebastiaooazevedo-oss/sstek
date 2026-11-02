import { useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { updateSetting, useSystemSettings } from "@/pages/app/settings/settingsStore";
import {
  defaultReplacementSlaHours,
  formatSlaHours,
  slaHoursFor,
} from "@/pages/app/modules/epi/replacementSla";
import { replacementReasons } from "@/pages/app/modules/epi/replacementStore";

const reasonHints: Record<string, string> = {
  "CA vencido": "Equipamento em uso com o Certificado de Aprovação vencido. Prioridade máxima.",
  Perda: "EPI perdido pelo colaborador. Exige registro de perda e expõe o trabalhador.",
  Dano: "Equipamento danificado que deixou de proteger o colaborador.",
  Desgaste: "Desgaste natural pelo uso, sem comprometer a proteção imediata.",
  "Tamanho inadequado": "Equipamento não se ajusta ao colaborador e precisa de troca de numeração.",
  Outro: "Casos diversos informados pelo colaborador ou pelo SESMT.",
};

function draftsFrom(overrides: Record<string, number>): Record<string, string> {
  const next: Record<string, string> = {};
  replacementReasons.forEach((reason) => {
    next[reason] = String(slaHoursFor(reason, overrides));
  });
  return next;
}

function mapFromDrafts(drafts: Record<string, string>): Record<string, number> {
  const next: Record<string, number> = {};
  replacementReasons.forEach((reason) => {
    const raw = (drafts[reason] ?? "").trim();
    const hours = Number(raw.replace(",", "."));
    if (raw === "") return;
    if (Number.isFinite(hours) && hours > 0) next[reason] = Math.round(hours);
  });
  return next;
}

/**
 * Parametrização do prazo de atendimento dos pedidos de substituição de EPI.
 *
 * Cada motivo aceita um prazo próprio em horas. Pedidos que passam do prazo
 * aparecem destacados (e no sino do administrador) para o SESMT providenciar a
 * troca. Campos vazios voltam para o prazo padrão do sistema.
 */
export default function EpiReplacementSlaForm() {
  const session = useAppSession();
  const settings = useSystemSettings();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => draftsFrom(settings.replacementSlaHours));

  useEffect(() => {
    setDrafts(draftsFrom(settings.replacementSlaHours));
  }, [settings.replacementSlaHours]);

  const customCount = useMemo(
    () => Object.entries(settings.replacementSlaHours).filter(([, hours]) => Number(hours) > 0).length,
    [settings.replacementSlaHours]
  );

  const commit = () => {
    const next = mapFromDrafts(drafts);
    if (JSON.stringify(next) !== JSON.stringify(settings.replacementSlaHours)) {
      updateSetting("replacementSlaHours", next, { name: session.name });
    }
  };

  const restoreDefaults = () => {
    setDrafts(draftsFrom({}));
    updateSetting("replacementSlaHours", {}, { name: session.name });
  };

  return (
    <div className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-foreground-600">
          Cada pedido de substituição recebe um prazo a partir do motivo informado. Pedidos fora do prazo ficam
          destacados em vermelho no painel e aparecem no sino do administrador.{" "}
          {customCount > 0
            ? `${customCount} motivo(s) com prazo personalizado.`
            : "Todos os motivos estão usando o prazo padrão do sistema."}
        </p>
        <button
          type="button"
          onClick={restoreDefaults}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-restart-line"></i>
          Restaurar padrões
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {replacementReasons.map((reason) => {
          const raw = drafts[reason] ?? "";
          const hours = Number(raw);
          const valid = raw.trim() !== "" && Number.isFinite(hours) && hours > 0;
          const isDefault = !valid || hours === defaultReplacementSlaHours[reason];
          return (
            <div
              key={reason}
              className="rounded-lg border border-background-200 bg-background-100 px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor={`sla-${reason.replace(/\s+/g, "-").toLowerCase()}`}
                    className="block text-xs font-semibold text-foreground-900"
                  >
                    {reason}
                  </label>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-500">{reasonHints[reason]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <input
                    id={`sla-${reason.replace(/\s+/g, "-").toLowerCase()}`}
                    type="number"
                    min={1}
                    max={720}
                    inputMode="numeric"
                    value={raw}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [reason]: e.target.value }))}
                    onBlur={commit}
                    className="w-20 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-right text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  />
                  <span className="text-[11px] font-semibold text-foreground-500">horas</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isDefault ? "bg-background-200 text-foreground-600" : "bg-primary-100 text-primary-700"
                  }`}
                >
                  <i className="ri-timer-line"></i>
                  {valid ? formatSlaHours(hours) : `padrão: ${formatSlaHours(defaultReplacementSlaHours[reason])}`}
                </span>
                {reason === "CA vencido" || reason === "Perda" ? (
                  <span className="text-[10px] font-semibold text-accent-700">prioridade alta</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}