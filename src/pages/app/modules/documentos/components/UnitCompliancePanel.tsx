export interface UnitComplianceEntry {
  unit: string;
  total: number;
  ok: number;
  expiring: number;
  expired: number;
  percent: number;
}

interface UnitCompliancePanelProps {
  entries: UnitComplianceEntry[];
  /** Percentual consolidado da empresa inteira. */
  overallPercent: number;
  /** Unidade usada hoje no filtro da lista (string vazia = todas). */
  activeUnit: string;
  onSelectUnit: (unit: string) => void;
}

const CORPORATE = "Corporativo";

function barTone(percent: number): string {
  if (percent >= 90) return "bg-primary-500";
  if (percent >= 70) return "bg-secondary-500";
  return "bg-accent-500";
}

function valueTone(percent: number): string {
  if (percent >= 90) return "text-primary-700";
  if (percent >= 70) return "text-secondary-800";
  return "text-accent-800";
}

/**
 * Painel de conformidade documental por estabelecimento.
 *
 * Mostra, para cada unidade, o percentual de documentos em dia. A ordem vai do
 * pior para o melhor resultado, para que a unidade que precisa de atenção
 * apareça primeiro. Clicar em uma unidade filtra a lista por ela.
 */
export default function UnitCompliancePanel({
  entries,
  overallPercent,
  activeUnit,
  onSelectUnit,
}: UnitCompliancePanelProps) {
  const actionable = entries.filter((entry) => entry.unit !== CORPORATE);
  const critical = entries.filter((entry) => entry.percent < 90).length;

  return (
    <section className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-building-4-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">
              Conformidade por unidade
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
              Percentual de documentos em dia em cada estabelecimento.{" "}
              {critical > 0
                ? `${critical} unidade(s) abaixo da meta de 90%.`
                : "Todas as unidades estão na meta de 90%."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-3.5 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Conformidade geral
            </p>
            <p className="text-[11px] font-medium text-foreground-500">
              {entries.length} unidade(s) monitorada(s)
            </p>
          </div>
          <p className={`font-heading text-2xl font-extrabold leading-none tracking-tight ${valueTone(overallPercent)}`}>
            {overallPercent}%
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-100/60 px-6 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
            <i className="ri-building-line text-xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma unidade para avaliar</p>
          <p className="text-xs text-foreground-500">
            Envie documentos vinculados a estabelecimentos para ver a conformidade por unidade.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const isCorporate = entry.unit === CORPORATE;
            const active = Boolean(activeUnit) && activeUnit === entry.unit;
            return (
              <button
                key={entry.unit}
                type="button"
                disabled={isCorporate}
                onClick={() => onSelectUnit(entry.unit)}
                title={
                  isCorporate
                    ? "Documentos sem unidade definida valem para toda a empresa"
                    : active
                      ? "Remover o filtro desta unidade"
                      : `Filtrar a lista por ${entry.unit}`
                }
                className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${
                  isCorporate
                    ? "cursor-default border-dashed border-background-300 bg-background-100/70"
                    : active
                      ? "cursor-pointer border-primary-400 bg-primary-50"
                      : "cursor-pointer border-background-200 bg-background-50 hover:border-primary-300 hover:bg-background-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground-950">
                      <i className={`${isCorporate ? "ri-stack-line" : "ri-building-line"} shrink-0 text-xs text-foreground-400`}></i>
                      {entry.unit}
                    </p>
                    <p className="mt-0.5 text-[11px] text-foreground-500">
                      {entry.ok} de {entry.total} em dia
                    </p>
                  </div>
                  <span className={`font-heading text-lg font-extrabold leading-none tracking-tight ${valueTone(entry.percent)}`}>
                    {entry.percent}%
                  </span>
                </div>

                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barTone(entry.percent)}`}
                    style={{ width: `${Math.min(100, Math.max(0, entry.percent))}%` }}
                  ></div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold">
                  {entry.expired > 0 && (
                    <span className="inline-flex items-center gap-1 text-danger-700">
                      <i className="ri-error-warning-line"></i>
                      {entry.expired} vencido(s)
                    </span>
                  )}
                  {entry.expiring > 0 && (
                    <span className="inline-flex items-center gap-1 text-accent-700">
                      <i className="ri-timer-line"></i>
                      {entry.expiring} vencendo
                    </span>
                  )}
                  {entry.expired === 0 && entry.expiring === 0 && (
                    <span className="inline-flex items-center gap-1 text-primary-700">
                      <i className="ri-checkbox-circle-line"></i>
                      Sem pendências
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {actionable.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-foreground-400">
          <i className="ri-information-line"></i>
          Meta de conformidade: 90% dos documentos em dia por estabelecimento.
        </p>
      )}
    </section>
  );
}