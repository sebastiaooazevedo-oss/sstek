import { useEffect, useState } from "react";
import type { RenewalExam, RenewalRequest } from "@/pages/app/modules/documentos/renewalStore";

export interface ScheduleDraft {
  clinicName: string;
  clinicContact: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentLocation: string;
  examsRequired: boolean;
  exams: RenewalExam[];
  notes: string;
}

interface RenewalScheduleFormProps {
  request: RenewalRequest;
  canEdit: boolean;
  onSave: (draft: ScheduleDraft) => void;
}

const inputClass =
  "w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-primary-400 disabled:cursor-not-allowed disabled:bg-background-100 disabled:text-foreground-500";

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
}

/**
 * Tratativa operacional: clínica/fornecedor, agendamento, exames necessários
 * com orientações por exame, local e horário. Salvar aqui alimenta o e-mail que
 * será enviado ao colaborador e ao gestor.
 */
export default function RenewalScheduleForm({ request, canEdit, onSave }: RenewalScheduleFormProps) {
  const locked = !canEdit || request.status === "concluida";
  const [draft, setDraft] = useState<ScheduleDraft>({
    clinicName: request.clinicName,
    clinicContact: request.clinicContact,
    appointmentDate: request.appointmentDate,
    appointmentTime: request.appointmentTime,
    appointmentLocation: request.appointmentLocation,
    examsRequired: request.examsRequired,
    exams: request.exams,
    notes: request.notes,
  });
  const [examName, setExamName] = useState("");
  const [examInstructions, setExamInstructions] = useState("");

  useEffect(() => {
    setDraft({
      clinicName: request.clinicName,
      clinicContact: request.clinicContact,
      appointmentDate: request.appointmentDate,
      appointmentTime: request.appointmentTime,
      appointmentLocation: request.appointmentLocation,
      examsRequired: request.examsRequired,
      exams: request.exams,
      notes: request.notes,
    });
  }, [
    request.id,
    request.scheduleSavedAt,
    request.clinicName,
    request.clinicContact,
    request.appointmentDate,
    request.appointmentTime,
    request.appointmentLocation,
    request.examsRequired,
    request.exams,
    request.notes,
  ]);

  const update = (patch: Partial<ScheduleDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const addExam = () => {
    const name = examName.trim();
    if (!name) return;
    update({ exams: [...draft.exams, { id: uid(), name, instructions: examInstructions.trim() }] });
    setExamName("");
    setExamInstructions("");
  };

  return (
    <section className="rounded-xl border border-background-200 bg-background-50">
      <div className="flex items-center justify-between gap-3 border-b border-background-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-100 text-accent-800">
            <i className="ri-calendar-schedule-line text-base"></i>
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground-950">Agendamento e exames</h3>
            <p className="text-[10px] text-foreground-500">
              {request.documentTypeName} · validade atual {request.currentExpiresAt}
            </p>
          </div>
        </div>
        {request.scheduleSavedAt && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-100 px-2 py-1 text-[10px] font-semibold text-foreground-500">
            <i className="ri-save-3-line"></i>
            salvo
          </span>
        )}
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-700">Clínica / fornecedor</span>
          <input
            value={draft.clinicName}
            disabled={locked}
            onChange={(event) => update({ clinicName: event.target.value })}
            placeholder="Ex.: Clínica Vida Ocupacional"
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-700">Contato</span>
          <input
            value={draft.clinicContact}
            disabled={locked}
            onChange={(event) => update({ clinicContact: event.target.value })}
            placeholder="Telefone / e-mail / pessoa de contato"
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-700">Data do agendamento</span>
          <input
            type="date"
            value={draft.appointmentDate}
            disabled={locked}
            onChange={(event) => update({ appointmentDate: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-700">Horário</span>
          <input
            type="time"
            value={draft.appointmentTime}
            disabled={locked}
            onChange={(event) => update({ appointmentTime: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <span className="text-[11px] font-semibold text-foreground-700">Local</span>
          <input
            value={draft.appointmentLocation}
            disabled={locked}
            onChange={(event) => update({ appointmentLocation: event.target.value })}
            placeholder="Endereço completo do atendimento"
            className={inputClass}
          />
        </label>
      </div>

      <div className="border-t border-background-200 px-4 py-3.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={draft.examsRequired}
            disabled={locked}
            onChange={(event) => update({ examsRequired: event.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary-500"
          />
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-foreground-900">
              Há necessidade de exames complementares
            </span>
            <span className="block text-[10px] leading-snug text-foreground-500">
              Quando o exame pertence ao ASO, ele deve ser anexado junto ao ASO — não solto em
              exames.
            </span>
          </span>
        </label>

        {draft.examsRequired && (
          <div className="mt-3 rounded-lg border border-background-200 bg-background-100 p-3">
            <ul className="flex flex-col gap-2">
              {draft.exams.map((exam) => (
                <li key={exam.id} className="rounded-md border border-background-200 bg-background-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-foreground-900">{exam.name}</p>
                    {!locked && (
                      <button
                        type="button"
                        aria-label={`Remover exame ${exam.name}`}
                        onClick={() => update({ exams: draft.exams.filter((item) => item.id !== exam.id) })}
                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-danger-100 hover:text-danger-700"
                      >
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    )}
                  </div>
                  {exam.instructions && (
                    <p className="mt-0.5 text-[10px] leading-snug text-foreground-500">
                      <i className="ri-information-line mr-1"></i>
                      {exam.instructions}
                    </p>
                  )}
                </li>
              ))}
              {draft.exams.length === 0 && (
                <li className="rounded-md border border-dashed border-background-300 px-3 py-2 text-[11px] text-foreground-500">
                  Nenhum exame complementar registrado.
                </li>
              )}
            </ul>

            {!locked && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <input
                  value={examName}
                  onChange={(event) => setExamName(event.target.value)}
                  placeholder="Exame (ex.: Audiometria)"
                  className={inputClass}
                />
                <input
                  value={examInstructions}
                  onChange={(event) => setExamInstructions(event.target.value)}
                  placeholder="Orientações (ex.: jejum de 8h)"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addExam}
                  disabled={!examName.trim()}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-secondary-300 bg-secondary-50 px-3 py-2 text-[11px] font-semibold text-secondary-800 transition-colors hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="ri-add-line"></i>
                  Exame
                </button>
              </div>
            )}
          </div>
        )}

        <label className="mt-3 flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-foreground-700">Orientações gerais</span>
          <textarea
            value={draft.notes}
            disabled={locked}
            onChange={(event) => update({ notes: event.target.value.slice(0, 500) })}
            rows={2}
            maxLength={500}
            placeholder="Documentos a levar, jejum, acompanhante, etc."
            className={`${inputClass} resize-y`}
          />
        </label>

        {!locked && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2 text-[11px] font-semibold text-background-50 transition-colors hover:bg-secondary-600"
            >
              <i className="ri-save-3-line"></i>
              Salvar agendamento
            </button>
          </div>
        )}
      </div>
    </section>
  );
}