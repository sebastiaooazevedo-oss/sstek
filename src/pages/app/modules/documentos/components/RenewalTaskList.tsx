import { useState } from "react";
import {
  addRenewalTask,
  completeRenewalTask,
  formatStamp,
  type RenewalRequest,
} from "@/pages/app/modules/documentos/renewalStore";

interface RenewalTaskListProps {
  request: RenewalRequest;
  canEdit: boolean;
  userName: string;
}

/**
 * Tarefas da tratativa.
 *
 * Cada tarefa é concluída individualmente e, ao concluir, recebe dia e hora.
 * Não existe desmarcar: é um registro de execução, não um checklist livre.
 */
export default function RenewalTaskList({ request, canEdit, userName }: RenewalTaskListProps) {
  const [label, setLabel] = useState("");
  const locked = !canEdit || request.status === "concluida";
  const done = request.tasks.filter((task) => task.done).length;

  const handleAdd = () => {
    const clean = label.trim();
    if (!clean) return;
    addRenewalTask(request.id, clean, userName);
    setLabel("");
  };

  return (
    <section className="rounded-xl border border-background-200 bg-background-50">
      <div className="flex items-center justify-between gap-3 border-b border-background-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
            <i className="ri-list-check-3 text-base"></i>
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground-950">Tarefas da tratativa</h3>
            <p className="text-[10px] text-foreground-500">
              {done} de {request.tasks.length} concluídas
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2 py-1 text-[10px] font-semibold text-foreground-500">
          <i className="ri-lock-2-line"></i>
          sem edição após concluir
        </span>
      </div>

      <ul className="divide-y divide-background-100">
        {request.tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                task.done ? "bg-primary-500 text-background-50" : "border border-background-300 bg-background-50 text-foreground-400"
              }`}
            >
              <i className={task.done ? "ri-lock-2-line text-[11px]" : "ri-circle-line text-[10px]"}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-[13px] leading-snug ${
                  task.done ? "font-medium text-foreground-500 line-through" : "font-semibold text-foreground-900"
                }`}
              >
                {task.label}
              </p>
              {task.done && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-foreground-500">
                  <span className="inline-flex items-center gap-1 text-primary-700">
                    <i className="ri-checkbox-circle-line"></i>
                    Concluída em {formatStamp(task.doneAt)}
                  </span>
                  {task.doneBy && <span>· por {task.doneBy}</span>}
                </p>
              )}
            </div>
            {!task.done && (
              <button
                type="button"
                disabled={locked}
                onClick={() => completeRenewalTask(request.id, task.id, userName)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-primary-300 bg-primary-50 px-2.5 py-1.5 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="ri-check-line"></i>
                Concluir
              </button>
            )}
          </li>
        ))}
      </ul>

      {!locked && (
        <div className="flex flex-col gap-2 border-t border-background-200 bg-background-100 px-4 py-3 sm:flex-row sm:items-center">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAdd();
            }}
            placeholder="Adicionar tarefa necessária (ex.: solicitar guia à clínica)"
            className="w-full min-w-0 rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!label.trim()}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-add-line"></i>
            Adicionar
          </button>
        </div>
      )}

      {request.status === "concluida" && (
        <div className="flex items-center gap-1.5 border-t border-background-200 bg-primary-50 px-4 py-2.5 text-[10px] font-medium text-primary-800">
          <i className="ri-shield-check-line"></i>
          Solicitação encerrada em {formatStamp(request.completedAt)}. Tarefas e anexos ficam
          travados para auditoria.
        </div>
      )}
    </section>
  );
}