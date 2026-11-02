import type { ReactNode } from "react";

export interface ModuleHeaderTab {
  id: string;
  label: string;
  icon: string;
  description?: string;
}

export interface ModuleHeaderTabs {
  label: string;
  items: ModuleHeaderTab[];
  active: string;
  onChange: (id: string) => void;
}

interface ModuleHeaderProps {
  /** Ícone do selo acima do título. */
  badgeIcon: string;
  badgeLabel: string;
  title: string;
  subtitle?: ReactNode;
  /** Barra de ações (normalmente um <ModuleToolbar />). */
  actions?: ReactNode;
  /** Abas integradas na base do painel, no mesmo padrão de Documentos. */
  tabs?: ModuleHeaderTabs;
  /** Conteúdo acima do selo (ex.: "Voltar para Documentos"). */
  beforeBadge?: ReactNode;
  /** Faixa informativa dentro do painel, abaixo do título. */
  meta?: ReactNode;
  /** Variante compacta usada quando o módulo é exibido dentro de outro módulo. */
  compact?: boolean;
}

/** Botão de ação principal — verde sólido, usado uma única vez por cabeçalho. */
export const modulePrimaryAction =
  "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-background-50 shadow-sm shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-md hover:shadow-primary-600/30 active:translate-y-px";

/** Botão secundário — fantasma, para ações de apoio. */
export const moduleGhostAction =
  "inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 hover:text-foreground-950";

/** Divisor vertical entre grupos de ações da barra. */
export const moduleToolbarDivider = "mx-0.5 hidden h-6 w-px bg-background-200 sm:block";

/** Container da barra de ações do cabeçalho. */
export function ModuleToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded-xl border border-background-200 bg-background-50 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Painel de cabeçalho padrão do portal.
 * Faixa gradiente + selo + título + ações + abas, para que todos os módulos
 * (Documentos, EPI, DDS, CIPA, Colaboradores...) falem a mesma língua.
 */
export default function ModuleHeader({
  badgeIcon,
  badgeLabel,
  title,
  subtitle,
  actions,
  tabs,
  beforeBadge,
  meta,
  compact = false,
}: ModuleHeaderProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-background-200 bg-background-50 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-32px_rgba(15,23,42,0.35)]">
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500"
      ></div>

      <div
        className={`flex flex-col gap-5 bg-gradient-to-br from-background-50 via-background-50 to-background-100 lg:flex-row lg:items-center lg:justify-between lg:gap-8 ${
          compact ? "px-4 py-4 md:px-5 md:py-5" : "px-5 py-5 md:px-6 md:py-6"
        }`}
      >
        <div className="min-w-0">
          {beforeBadge}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-800">
            <i className={`${badgeIcon} text-xs`}></i>
            {badgeLabel}
          </span>
          <h1
            className={`mt-3 font-heading font-extrabold leading-none tracking-tight text-foreground-950 ${
              compact ? "text-2xl md:text-[26px]" : "text-3xl md:text-[34px]"
            }`}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground-600">{subtitle}</p>
          )}
        </div>

        {actions && <div className="shrink-0 lg:pl-4">{actions}</div>}
      </div>

      {meta && <div className="border-t border-background-200 bg-background-50 px-5 py-3 md:px-6">{meta}</div>}

      {tabs && (
        <div className="overflow-x-auto border-t border-background-200 bg-background-50 px-2 md:px-4">
          <div role="tablist" aria-label={tabs.label} className="flex min-w-max items-stretch">
            {tabs.items.map((item) => {
              const active = item.id === tabs.active;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={item.description || item.label}
                  onClick={() => tabs.onChange(item.id)}
                  className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors md:px-4 ${
                    active
                      ? "border-primary-600 text-primary-800"
                      : "border-transparent text-foreground-500 hover:border-background-300 hover:text-foreground-900"
                  }`}
                >
                  <i className={`${item.icon} text-base ${active ? "text-primary-600" : "text-foreground-400"}`}></i>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}