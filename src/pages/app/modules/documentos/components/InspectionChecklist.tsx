import { inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  inspectionChecklist,
  inspectionItemStatuses,
  type ChecklistEntry,
} from "@/pages/app/modules/documentos/components/inspectionData";

interface InspectionChecklistProps {
  value: Record<string, ChecklistEntry>;
  onChange: (id: string, patch: Partial<ChecklistEntry>) => void;
}

const statusTone: Record<string, string> = {
  Conforme: "border-primary-300 text-primary-700",
  "Não conforme": "border-accent-300 text-accent-800",
  "Não aplicável": "border-background-300 text-foreground-600",
};

export default function InspectionChecklist({ value, onChange }: InspectionChecklistProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {inspectionChecklist.map((item) => {
        const entry = value[item.id] || { status: "", note: "" };
        return (
          <div key={item.id} className="rounded-lg border border-background-200 bg-background-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background-100 text-foreground-500">
                  <i className="ri-checkbox-multiple-line text-sm"></i>
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground-800">{item.label}</span>
                <span className="shrink-0 rounded-md bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-900">
                  {item.ref}
                </span>
              </div>
              <div className="relative sm:w-44">
                <select
                  className={`${selectClass} ${entry.status ? statusTone[entry.status] || "" : ""}`}
                  value={entry.status}
                  onChange={(e) => onChange(item.id, { status: e.target.value })}
                >
                  <option value="">Não avaliado</option>
                  {inspectionItemStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </div>
            <input
              className={`${inputClass} mt-2`}
              value={entry.note}
              onChange={(e) => onChange(item.id, { note: e.target.value })}
              placeholder="Observação do item (opcional)"
            />
          </div>
        );
      })}
    </div>
  );
}