interface SummaryItem {
  label: string;
  value: number;
  icon: string;
  tone: "primary" | "secondary" | "accent" | "danger";
}

interface DocumentsSummaryBarProps {
  stats: SummaryItem[];
  /** Rótulo do recorte de período aplicado aos números. */
  periodLabel?: string;
}

const toneChip: Record<SummaryItem["tone"], string> = {
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-800",
  accent: "bg-accent-100 text-accent-800",
  danger: "bg-danger-100 text-danger-800",
};

const toneValue: Record<SummaryItem["tone"], string> = {
  primary: "text-foreground-950",
  secondary: "text-foreground-950",
  accent: "text-accent-900",
  danger: "text-danger-700",
};

/** Faixa única de indicadores: substitui os quatro cartões soltos por um painel. */
export default function DocumentsSummaryBar({ stats, periodLabel }: DocumentsSummaryBarProps) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-background-200 bg-background-200 shadow-sm">
      <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="group bg-background-50 px-4 py-4 transition-colors md:px-5 md:py-5">
            <div className="flex items-start justify-between gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneChip[stat.tone]}`}>
                <i className={`${stat.icon} text-base`}></i>
              </span>
              {periodLabel && (
                <span className="hidden truncate text-[10px] font-medium text-foreground-400 sm:block">
                  {periodLabel}
                </span>
              )}
            </div>
            <p
              className={`mt-3 font-heading text-[26px] font-extrabold leading-none tracking-tight ${toneValue[stat.tone]}`}
            >
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] font-medium leading-snug text-foreground-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}