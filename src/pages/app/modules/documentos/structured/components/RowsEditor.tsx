import { uid } from "@/pages/app/modules/documentos/structured/structuredData";

export interface ColumnDef {
  key: string;
  label: string;
  type?: "text" | "select" | "date" | "number";
  options?: string[];
  placeholder?: string;
}

interface RowsEditorProps<T extends { id: string }> {
  value: T[];
  onChange: (next: T[]) => void;
  columns: ColumnDef[];
  addLabel: string;
  emptyText: string;
}

/**
 * Editor genérico de linhas (plano de ação, riscos, medições, testemunhas...).
 * Cada linha vira um bloco com os campos definidos em `columns`.
 */
export default function RowsEditor<T extends { id: string }>({
  value,
  onChange,
  columns,
  addLabel,
  emptyText,
}: RowsEditorProps<T>) {
  const update = (id: string, key: string, next: string) =>
    onChange(value.map((row) => (row.id === id ? ({ ...row, [key]: next } as T) : row)));

  const addRow = () => {
    const blank: Record<string, string> = { id: uid("row") };
    columns.forEach((column) => {
      blank[column.key] = column.type === "select" ? column.options?.[0] ?? "" : "";
    });
    onChange([...value, blank as unknown as T]);
  };

  const readValue = (row: T, key: string): string => {
    const raw = (row as unknown as Record<string, unknown>)[key];
    return typeof raw === "string" ? raw : "";
  };

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-4 text-xs text-foreground-500">
          {emptyText}
        </p>
      ) : (
        value.map((row, index) => (
          <div key={row.id} className="rounded-lg border border-background-200 bg-background-50 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                Linha {index + 1}
              </span>
              <button
                type="button"
                aria-label="Remover linha"
                onClick={() => onChange(value.filter((item) => item.id !== row.id))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-accent-700"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {columns.map((column) => (
                <label key={column.key} className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-semibold text-foreground-600">{column.label}</span>
                  {column.type === "select" ? (
                    <div className="relative">
                      <select
                        value={readValue(row, column.key)}
                        onChange={(e) => update(row.id, column.key, e.target.value)}
                        className="w-full appearance-none rounded-md border border-background-300 bg-background-50 px-2.5 py-2 pr-8 text-xs text-foreground-900 outline-none focus:border-primary-400"
                      >
                        {(column.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                    </div>
                  ) : (
                    <input
                      type={column.type === "date" ? "date" : column.type === "number" ? "number" : "text"}
                      value={readValue(row, column.key)}
                      onChange={(e) => update(row.id, column.key, e.target.value)}
                      placeholder={column.placeholder}
                      className="w-full rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-xs text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-md border border-dashed border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-800"
      >
        <i className="ri-add-line text-sm"></i>
        {addLabel}
      </button>
    </div>
  );
}