import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton, inputClass } from "@/pages/app/components/Modal";
import { getInitials } from "@/pages/app/context";
import { getMoodOption, isNegativeMood, moodToneChip } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate, moodTime } from "@/pages/app/mood/moodUtils";
import {
  followupFor,
  saveMoodFollowup,
  followupStatusLabel,
  useMoodFollowups,
  type FollowupStatus,
} from "@/pages/app/mood/moodFollowupStore";
import { ATTENTION_META, attentionSignal, type PersonMoodSummary } from "@/pages/app/mood/moodPeople";

interface MoodPersonModalProps {
  person: PersonMoodSummary | null;
  open: boolean;
  onClose: () => void;
  company: string;
  editorName: string;
}

const STATUS_OPTIONS: { id: FollowupStatus; label: string; icon: string }[] = [
  { id: "pendente", label: "Aguardando", icon: "ri-time-line" },
  { id: "acompanhando", label: "Em acompanhamento", icon: "ri-chat-smile-2-line" },
  { id: "acolhido", label: "Acolhido", icon: "ri-heart-3-line" },
];

const statusChip: Record<FollowupStatus, string> = {
  pendente: "bg-secondary-100 text-secondary-900",
  acompanhando: "bg-primary-100 text-primary-700",
  acolhido: "bg-primary-500 text-background-50",
};

/**
 * Ficha do colaborador para o gestor.
 *
 * Reúne o retrato do sentimento (último registro, média, dias negativos e
 * sequência), o histórico do período e o registro de acolhimento — a ação do
 * superior depois do alerta: aguardando, em acompanhamento ou acolhido, com
 * uma nota interna da conversa.
 */
export default function MoodPersonModal({ person, open, onClose, company, editorName }: MoodPersonModalProps) {
  const followups = useMoodFollowups();
  const [status, setStatus] = useState<FollowupStatus>("pendente");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const existing = useMemo(
    () => (person ? followupFor(followups.rows, person.userKey, person.latest.moodDate) : undefined),
    [followups.rows, person]
  );

  useEffect(() => {
    if (!open || !person) return;
    setStatus(existing?.status ?? "pendente");
    setNote(existing?.note ?? "");
    setFeedback(null);
  }, [open, person, existing]);

  if (!person) return null;

  const option = getMoodOption(person.latest.mood);
  const negative = isNegativeMood(person.latest.mood);
  const attentionMeta = person.attention ? ATTENTION_META[person.attention] : null;

  const handleSave = async () => {
    if (!person) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveMoodFollowup({
        company,
        collaboratorKey: person.userKey,
        collaboratorName: person.userName,
        moodDate: person.latest.moodDate,
        mood: person.latest.mood,
        status,
        note,
        createdBy: editorName,
      });
      setFeedback({ tone: "ok", text: "Acolhimento registrado. O acompanhamento fica salvo para a equipe gestora." });
    } catch {
      setFeedback({
        tone: "error",
        text: "Não foi possível salvar o acolhimento agora. Verifique a conexão e tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const stat = [
    { label: "Média no período", value: person.average > 0 ? `${person.average.toFixed(1)} / 5` : "—", icon: "ri-line-chart-line" },
    { label: "Registros", value: String(person.total), icon: "ri-file-list-3-line" },
    { label: "Dias negativos", value: String(person.negativeDays), icon: "ri-emotion-unhappy-line" },
    { label: "Dias seguidos", value: person.negativeStreak > 0 ? String(person.negativeStreak) : "—", icon: "ri-fire-line" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-user-heart-line"
      title={person.userName}
      subtitle={`${person.area || "Sem área informada"}${person.latest.establishment ? ` · ${person.latest.establishment}` : ""}${person.role ? ` · ${person.role}` : ""} · Visão do gestor`}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>
            Fechar
          </ModalButton>
          <ModalButton icon="ri-save-3-line" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar acolhimento"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Retrato atual */}
        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
            negative ? "border-accent-200 bg-accent-50" : "border-background-200 bg-background-100"
          }`}
        >
          <div className="relative shrink-0">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold ${moodToneChip(person.latest.mood)}`}
            >
              {getInitials(person.userName)}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-background-50 bg-background-50 text-base">
              {option?.emoji ?? "•"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground-950">
              {option?.label ?? "—"}
              <span className="ml-2 text-[11px] font-medium text-foreground-500">
                {friendlyMoodDate(person.latest.moodDate)} às {moodTime(person.latest.createdAt)}
              </span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground-600">
              {person.latest.reason ? `“${person.latest.reason}”` : "Nenhum motivo informado no último registro."}
            </p>
          </div>
          {attentionMeta && (
            <span
              className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${
                person.attention === "critico"
                  ? "bg-accent-200 text-accent-900"
                  : person.attention === "atencao"
                    ? "bg-accent-100 text-accent-800"
                    : "bg-secondary-100 text-secondary-900"
              }`}
            >
              <i className={person.attention === "observacao" ? "ri-eye-line" : "ri-alert-line"}></i>
              {attentionMeta.label}
            </span>
          )}
        </div>

        {attentionMeta && (
          <div className="flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-50 px-3.5 py-3 text-xs text-foreground-600">
            <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
            <p>
              <strong className="text-foreground-900">{attentionSignal(person)}.</strong> {attentionMeta.description}
            </p>
          </div>
        )}

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stat.map((item) => (
            <div key={item.label} className="rounded-lg border border-background-200 bg-background-100 p-3">
              <div className="flex items-center gap-1.5 text-foreground-400">
                <i className={`${item.icon} text-xs`}></i>
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
              <p className="mt-1.5 font-heading text-base font-extrabold tracking-tight text-foreground-950">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Acolhimento */}
        <div className="rounded-xl border border-background-200 bg-background-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-hand-heart-line text-primary-600"></i>
              Acolhimento
            </p>
            {existing && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusChip[existing.status]}`}>
                <i className="ri-checkbox-circle-line"></i>
                {followupStatusLabel(existing.status)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-foreground-500">
            Registre como está o acompanhamento deste colaborador. Visível apenas para a gestão.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((item) => {
              const active = status === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatus(item.id)}
                  aria-pressed={active}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary-400 bg-primary-500 text-background-50"
                      : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                  }`}
                >
                  <i className={item.icon}></i>
                  {item.label}
                </button>
              );
            })}
          </div>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">Nota interna</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="O que foi conversado, combinados e próximos passos..."
              className={`${inputClass} resize-none`}
            ></textarea>
            <span className="flex items-center justify-between text-[11px] text-foreground-400">
              <span>Use com cuidado: registre fatos e combinados, não julgamentos.</span>
              <span className="tabular-nums">{note.length}/500</span>
            </span>
          </label>

          {existing && (
            <p className="mt-2 text-[11px] text-foreground-500">
              Última atualização em {friendlyMoodDate(existing.updatedAt.slice(0, 10))}
              {existing.createdBy ? ` por ${existing.createdBy}` : ""}.
            </p>
          )}

          {feedback && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                feedback.tone === "ok"
                  ? "border-primary-200 bg-primary-50 text-primary-700"
                  : "border-accent-200 bg-accent-50 text-accent-900"
              }`}
            >
              <i className={feedback.tone === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        {/* Histórico */}
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-history-line text-foreground-400"></i>
            Histórico no período
          </p>
          <div className="mt-2.5 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {person.entries.slice(0, 30).map((entry) => {
              const entryOption = getMoodOption(entry.mood);
              const entryNegative = isNegativeMood(entry.mood);
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${
                    entryNegative ? "border-accent-200 bg-accent-50" : "border-background-200 bg-background-100"
                  }`}
                >
                  <span className="text-lg leading-none">{entryOption?.emoji ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-foreground-800">
                      {friendlyMoodDate(entry.moodDate)}
                      <span className="ml-1.5 font-medium text-foreground-400">{moodTime(entry.createdAt)}</span>
                      <span className="ml-1.5 rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                        {entryOption?.label ?? "—"}
                      </span>
                    </p>
                    {entry.reason && (
                      <p className="mt-0.5 text-[11px] italic leading-relaxed text-foreground-600">“{entry.reason}”</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}