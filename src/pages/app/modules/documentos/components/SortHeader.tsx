export type SortDirection = "asc" | "desc";

interface SortHeaderProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  /** Texto do tooltip; por padrão usa o próprio rótulo. */
  title?: string;
  className?: string;
}

/**
 * Cabeçalho de coluna ordenável.
 * Mostra a seta só na coluna ativa (e a bifurcação discreta nas demais) para a
 * faixa de títulos não virar um festival de ícones.
 */
export default function SortHeader({
  label,
  active,
  direction,
  onSort,
  title,
  className = "",
}: SortHeaderProps) {
  return (
    <th
      className={`px-5 py-3.5 ${className}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onSort}
        title={title || `Ordenar por ${label.toLowerCase()}`}
        className={`-mx-2 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
          active
            ? "bg-background-200 text-foreground-900"
            : "text-foreground-400 hover:bg-background-200/60 hover:text-foreground-800"
        }`}
      >
        {label}
        <i
          className={`text-sm ${
            active
              ? direction === "asc"
                ? "ri-arrow-up-line"
                : "ri-arrow-down-line"
              : "ri-arrow-up-down-line opacity-60"
          }`}
        ></i>
      </button>
    </th>
  );
}