import { getMoodByScore, MOOD_OPTIONS, type MoodId, type MoodOption } from "@/pages/app/mood/moodOptions";

interface MoodPulseHeroProps {
  total: number;
  average: number;
  positivePct: number;
  negativeCount: number;
  distribution: { option: MoodOption; count: number }[];
  selectedMood: MoodId | null;
  onSelectMood: (mood: MoodId | null) => void;
  periodText: string;
}

const SEGMENT_COLOR: Record<MoodId, string> = {
  muito_triste: "bg-accent-600",
  triste: "bg-accent-400",
  neutro: "bg-secondary-400",
  feliz: "bg-primary-400",
  muito_feliz: "bg-primary-600",
};

const HALO_COLOR: Record<MoodId, string> = {
  muito_triste: "bg-accent-600/30",
  triste: "bg-accent-500/30",
  neutro: "bg-secondary-500/25",
  feliz: "bg-primary-500/25",
  muito_feliz: "bg-primary-500/35",
};

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Faixa executiva do painel de sentimento.
 *
 * Reúne o retrato do período num só bloco: medidor da média (1 a 5), barra
 * empilhada da distribuição e atalhos para filtrar os registros por sentimento.
 * A barra e a legenda são clicáveis — clicar de novo no mesmo item limpa o filtro.
 */
export default function MoodPulseHero({
  total,
  average,
  positivePct,
  negativeCount,
  distribution,
  selectedMood,
  onSelectMood,
  periodText,
}: MoodPulseHeroProps) {
  const avgOption = total > 0 ? getMoodByScore(average) : undefined;
  const fillPercent = total > 0 ? Math.max(0, Math.min(100, ((average - 1) / 4) * 100)) : 0;
  const dominant = distribution.reduce(
    (best, item) => (item.count > (best?.count ?? 0) ? item : best),
    null as { option: MoodOption; count: number } | null
  );
  const positive = distribution
    .filter((item) => item.option.score >= 4)
    .reduce((sum, item) => sum + item.count, 0);

  const gaugeRing = `conic-gradient(from 200deg, oklch(var(--primary-500)) ${fillPercent}%, oklch(var(--background-200)) ${fillPercent}% 100%)`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-background-200 bg-background-50">
      <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-primary-500/10 blur-3xl"></div>
      <div className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl"></div>

      <div className="relative grid gap-6 p-5 md:p-6 lg:grid-cols-[minmax(240px,280px)_1fr] lg:items-center">
        {/* Medidor da média */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-background-200/70 bg-background-100/60 p-4 lg:border-0 lg:bg-transparent lg:p-0">
          <div className="relative flex h-[168px] w-[168px] items-center justify-center">
            <div
              className={`absolute inset-4 rounded-full blur-2xl transition-opacity ${avgOption ? HALO_COLOR[avgOption.id] : "bg-background-300/40"}`}
            ></div>
            <div
              className="relative flex h-full w-full items-center justify-center rounded-full transition-all duration-700"
              style={{ background: gaugeRing }}
            >
              <div className="flex h-[136px] w-[136px] flex-col items-center justify-center rounded-full bg-background-50">
                <span className="text-3xl leading-none">{avgOption?.emoji ?? "🙂"}</span>
                <span className="mt-1.5 font-heading text-3xl font-extrabold leading-none tracking-tight text-foreground-950">
                  {total > 0 ? average.toFixed(1) : "—"}
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  média / 5
                </span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground-950">{avgOption?.label ?? "Sem registros"}</p>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              {total} registro{total === 1 ? "" : "s"} · {periodText}
            </p>
          </div>
        </div>

        {/* Distribuição + atalhos */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                <i className="ri-pulse-line"></i>
                Pulso do período
              </p>
              <p className="mt-1 font-heading text-base font-extrabold tracking-tight text-foreground-950">
                {dominant && dominant.count > 0
                  ? `O time está predominantemente ${dominant.option.label.toLowerCase()}`
                  : "Ainda sem registros no período"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1.5 text-xs font-bold text-primary-700">
              <i className="ri-emotion-happy-line"></i>
              {positivePct}% positivo
            </span>
          </div>

          <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-background-200">
            {distribution.map(({ option, count }) => {
              const width = total > 0 ? (count / total) * 100 : 0;
              if (width <= 0) return null;
              const active = selectedMood === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectMood(active ? null : option.id)}
                  title={`${option.label}: ${count} registro(s) · ${pct(count, total)}%`}
                  aria-label={`${option.label}: ${count} registro(s)`}
                  className={`group relative h-full cursor-pointer border-r border-background-50/70 transition-all last:border-r-0 ${SEGMENT_COLOR[option.id]} ${
                    selectedMood && !active ? "opacity-40" : "opacity-100"
                  } ${active ? "ring-2 ring-foreground-950/20" : "hover:brightness-110"}`}
                  style={{ width: `${Math.max(width, 2)}%` }}
                >
                  <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground-950 px-2 py-1 text-[10px] font-semibold text-background-50 group-hover:block">
                    {option.emoji} {count} · {pct(count, total)}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {MOOD_OPTIONS.map((option) => {
              const item = distribution.find((entry) => entry.option.id === option.id);
              const count = item?.count ?? 0;
              const active = selectedMood === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectMood(active ? null : option.id)}
                  aria-pressed={active}
                  className={`group flex cursor-pointer flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    active
                      ? "border-primary-400 bg-primary-50 shadow-sm"
                      : "border-background-200 bg-background-100 hover:-translate-y-0.5 hover:border-primary-300 hover:bg-background-50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg leading-none">{option.emoji}</span>
                    <span className="font-heading text-base font-extrabold leading-none tabular-nums text-foreground-950">
                      {count}
                    </span>
                  </span>
                  <span className="truncate text-[11px] font-semibold text-foreground-600">{option.label}</span>
                  <span className="h-1 w-full overflow-hidden rounded-full bg-background-200">
                    <span
                      className={`block h-full rounded-full transition-all duration-500 ${SEGMENT_COLOR[option.id]}`}
                      style={{ width: `${pct(count, total)}%` }}
                    ></span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-foreground-500">
            <span className="inline-flex items-center gap-1.5">
              <i className="ri-cursor-line"></i>
              Clique num sentimento para ver quem o escolheu.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-500"></span>
              {negativeCount} alerta{negativeCount === 1 ? "" : "s"} de sentimento negativo
            </span>
            <span>
              {positive} de {total} registro{total === 1 ? "" : "s"} positivos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}