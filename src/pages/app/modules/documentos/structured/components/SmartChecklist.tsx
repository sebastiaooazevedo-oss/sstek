import { useState } from "react";
import {
  checklistStatuses,
  countChecklist,
  entryFromTemplate,
  uid,
  type ChecklistEntry,
  type ChecklistStatus,
  type ChecklistTemplate,
} from "@/pages/app/modules/documentos/structured/structuredData";

interface SmartChecklistProps {
  value: ChecklistEntry[];
  onChange: (next: ChecklistEntry[]) => void;
  /** Sugestões que mudam conforme o tipo/equipamento/atividade escolhidos. */
  suggestions?: ChecklistTemplate[];
  emptyHint?: string;
}

const statusTone: Record<ChecklistStatus, string> = {
  "Não avaliado": "border-background-300 bg-background-50 text-foreground-600",
  Conforme: "border-primary-300 bg-primary-50 text-primary-800",
  "Não conforme": "border-accent-300 bg-accent-50 text-accent-900",
  "Não aplicável": "border-background-300 bg-background-100 text-foreground-500",
};

/**
 * Checklist inteligente: combina as sugestões automáticas do roteiro (conforme
 * tipo de ocorrência, equipamento de medição ou atividade da permissão) com
 * itens livres criados pelo usuário. Cada item recebe situação e observação.
 */
export default function SmartChecklist({
  value,
  onChange,
  suggestions = [],
  emptyHint = "Nenhum item de verificação. Adicione uma sugestão ou crie um item.",
}: SmartChecklistProps) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
  const counts = countChecklist(value);

  const existing = new Set(value.map((v) => v.label.trim().toLowerCase()));
  const pending = suggestions.filter((s) => !existing.has(s.label.trim().toLowerCase()));

  const update = (id: string, patch: Partial<ChecklistEntry>) =>
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const addTemplates = (templates: ChecklistTemplate[]) => {
    if (!templates.length) return;
    const added = templates.filter((t) => !existing.has(t.label.trim().toLowerCase())).map(entryFromTemplate);
    onChange([...value, ...added]);
  };

  const addDraft = () => {
    const label = draft.trim();
    if (!label) return;
    onChange([...value, { id: uid("ck"), label, ref: "", status: "Não avaliado", note: "" }]);
    setDraft("");
  };

  return (
    <div className="rounded-lg border border-background-200 bg-background-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
            <i className="ri-checkbox-circle-line"></i>
            {counts.conforme} conforme(s)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
            <i className="ri-error-warning-line"></i>
            {counts.naoConforme} não conforme(s)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
            <i className="ri-list-check-2"></i>
            {counts.total} item(ns)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100"
        >
          <i className={expanded ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
          {expanded ? "Recolher" : "Expandir"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col">
          {pending.length > 0 && (
            <div className="border-b border-background-100 bg-secondary-50/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary-800">
                  <i className="ri-sparkling-2-line"></i>
                  Sugestões para este documento
                </span>
                <button
                  type="button"
                  onClick={() => addTemplates(pending)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-secondary-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-secondary-900 transition-colors hover:bg-secondary-100"
                >
                  <i className="ri-add-circle-line"></i>
                  Adicionar todas ({pending.length})
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pending.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => addTemplates([suggestion])}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-background-300 bg-background-50 px-2.5 py-1 text-[11px] text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-800"
                    title={suggestion.label}
                  >
                    <i className="ri-add-line"></i>
                    <span className="truncate">{suggestion.label}</span>
                    {suggestion.ref && <span className="text-foreground-400">· {suggestion.ref}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {value.length === 0 ? (
            <p className="px-4 py-5 text-xs text-foreground-500">{emptyHint}</p>
          ) : (
            <div className="flex flex-col divide-y divide-background-100">
              {value.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_132px_minmax(0,1fr)_32px] md:items-center"
                >
                  <div className="min-w-0">
                    <input
                      value={item.label}
                      onChange={(e) => update(item.id, { label: e.target.value })}
                      className="w-full bg-transparent text-sm font-medium text-foreground-900 outline-none"
                      aria-label="Item verificado"
                    />
                    <div className="mt-1 flex items-center gap-1.5">
                      <i className="ri-bookmark-3-line text-[11px] text-foreground-400"></i>
                      <input
                        value={item.ref}
                        onChange={(e) => update(item.id, { ref: e.target.value })}
                        placeholder="referência"
                        className="w-24 rounded border border-background-200 bg-background-50 px-1.5 py-0.5 text-[10px] text-foreground-600 outline-none focus:border-primary-400"
                        aria-label="Referência normativa"
                      />
                    </div>
                  </div>

                  <select
                    value={item.status}
                    onChange={(e) => update(item.id, { status: e.target.value as ChecklistStatus })}
                    className={`w-full rounded-md border px-2 py-1.5 text-[11px] font-semibold outline-none ${statusTone[item.status]}`}
                    aria-label="Situação do item"
                  >
                    {checklistStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <input
                    value={item.note}
                    onChange={(e) => update(item.id, { note: e.target.value })}
                    placeholder="Observação"
                    className="w-full rounded-md border border-background-200 bg-background-50 px-2 py-1.5 text-xs text-foreground-800 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                    aria-label="Observação do item"
                  />

                  <button
                    type="button"
                    aria-label="Remover item"
                    onClick={() => onChange(value.filter((v) => v.id !== item.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-accent-700"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-background-100 px-4 py-3 sm:flex-row sm:items-center">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder="Adicionar item personalizado..."
              className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
            />
            <button
              type="button"
              onClick={addDraft}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-add-line"></i>
              Incluir item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}