import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getInitials, useAppSession } from "@/pages/app/context";
import { getMoodOption, moodToneChip } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate, resolveMoodActor, todayIso } from "@/pages/app/mood/moodUtils";
import { followupStatusLabel, useMoodFollowups } from "@/pages/app/mood/moodFollowupStore";
import {
  ATTENTION_META,
  attentionSignal,
  type AttentionLevel,
  type PersonMoodSummary,
} from "@/pages/app/mood/moodPeople";
import { attentionCasesFor } from "@/pages/app/mood/moodAttention";
import MoodPersonModal from "@/pages/app/modules/sentimento/components/MoodPersonModal";

interface MoodAttentionCardProps {
  people: PersonMoodSummary[];
  periodText: string;
  /** Unidade aplicada no filtro do dashboard (vazio = todas). */
  unitLabel?: string;
}

const LEVEL_CHIP: Record<AttentionLevel, string> = {
  critico: "bg-accent-200 text-accent-900",
  atencao: "bg-accent-100 text-accent-800",
  observacao: "bg-secondary-100 text-secondary-900",
};

const LEVEL_BAR: Record<AttentionLevel, string> = {
  critico: "bg-accent-600",
  atencao: "bg-accent-400",
  observacao: "bg-secondary-400",
};

const FOLLOW_CHIP: Record<string, string> = {
  pendente: "bg-secondary-100 text-secondary-900",
  acompanhando: "bg-primary-100 text-primary-700",
  acolhido: "bg-primary-500 text-background-50",
};

/**
 * Resumo de "quem precisa de atenção" no sentimento da equipe.
 *
 * O administrador vê na própria tela inicial as pessoas com sinal de alerta,
 * o motivo declarado e se já houve acolhimento. Os casos ainda sem retorno
 * aparecem primeiro e cada linha abre a ficha completa, onde a conversa é
 * registrada — sem precisar trocar de módulo.
 */
export default function MoodAttentionCard({ people, periodText, unitLabel = "" }: MoodAttentionCardProps) {
  const session = useAppSession();
  const actor = useMemo(() => resolveMoodActor(session), [session]);
  const followups = useMoodFollowups();
  const [selected, setSelected] = useState<PersonMoodSummary | null>(null);

  const cases = useMemo(
    () =>
      attentionCasesFor(people, followups.rows, todayIso(), { windowDays: 9999 }).sort((a, b) => {
        if (a.needsFollowup !== b.needsFollowup) return a.needsFollowup ? -1 : 1;
        const rankA = a.person.attention ? ["critico", "atencao", "observacao"].indexOf(a.person.attention) : 9;
        const rankB = b.person.attention ? ["critico", "atencao", "observacao"].indexOf(b.person.attention) : 9;
        return rankA - rankB;
      }),
    [people, followups.rows]
  );

  const pending = cases.filter((item) => item.needsFollowup);
  const shown = cases.slice(0, 4);
  const byLevel = (level: AttentionLevel) =>
    cases.filter((item) => item.person.attention === level).length;

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 p-4 md:flex-row md:items-start md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
              <i className="ri-user-heart-line text-lg"></i>
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">
                  Quem precisa de atenção
                </h2>
                {pending.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-900">
                    <i className="ri-alert-line"></i>
                    {pending.length} sem acolhimento
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-foreground-500">
                Sentimento da equipe · {periodText} · {unitLabel || "Todas as unidades"} · clique em uma pessoa para abrir a
                ficha e registrar o acolhimento.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              {(["critico", "atencao", "observacao"] as AttentionLevel[]).map((level) => (
                <span
                  key={level}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${LEVEL_CHIP[level]}`}
                >
                  <i className={level === "observacao" ? "ri-eye-line" : "ri-alert-line"}></i>
                  {byLevel(level)} {ATTENTION_META[level].label}
                </span>
              ))}
            </div>
            <Link
              to="/app/sentimento?tab=attention"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-external-link-line"></i>
              Ver todos
            </Link>
          </div>
        </div>

        <div className="p-4 md:p-5">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-emotion-happy-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum colaborador em alerta no período</p>
              <p className="text-xs text-foreground-500">
                Quando alguém registrar tristeza ou um caso ficar sem acolhimento, aparece aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
              {shown.map((item) => {
                const { person } = item;
                const level = person.attention as AttentionLevel;
                const option = getMoodOption(person.latest.mood);
                return (
                  <button
                    key={person.userKey}
                    type="button"
                    onClick={() => setSelected(person)}
                    className="group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border border-background-200 bg-background-100 p-3.5 pl-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-sm"
                  >
                    <span className={`absolute inset-y-0 left-0 w-1 ${LEVEL_BAR[level]}`}></span>
                    <div className="relative shrink-0">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold ${moodToneChip(person.latest.mood)}`}
                      >
                        {getInitials(person.userName)}
                      </span>
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-background-50 bg-background-50 text-sm">
                        {option?.emoji ?? "•"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground-950">{person.userName}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_CHIP[level]}`}>
                          <i className={level === "observacao" ? "ri-eye-line" : "ri-alert-line"}></i>
                          {ATTENTION_META[level].label}
                        </span>
                        {person.area && <span className="truncate text-[11px] text-foreground-400">{person.area}</span>}
                        {person.latest.establishment && (
                          <span className="inline-flex items-center gap-1 truncate rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                            <i className="ri-building-4-line"></i>
                            {person.latest.establishment}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-foreground-600">{attentionSignal(person)}</p>
                      {person.latest.reason && (
                        <p className="mt-1 line-clamp-1 text-[11px] italic text-foreground-500">“{person.latest.reason}”</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-foreground-400">
                          {friendlyMoodDate(person.latest.moodDate)}
                        </span>
                        {item.followup ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${FOLLOW_CHIP[item.followup.status]}`}>
                            <i className="ri-hand-heart-line"></i>
                            {followupStatusLabel(item.followup.status)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                            <i className="ri-time-line"></i>
                            Sem acolhimento
                          </span>
                        )}
                      </div>
                    </div>

                    <i className="ri-arrow-right-s-line mt-1 shrink-0 text-foreground-300 transition-colors group-hover:text-primary-600"></i>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {cases.length > shown.length && (
          <div className="border-t border-background-200 px-5 py-3 text-center">
            <Link
              to="/app/sentimento?tab=attention"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              Ver os {cases.length} casos do período
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        )}
      </section>

      <MoodPersonModal
        person={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        company={actor.company}
        editorName={actor.userName}
      />
    </>
  );
}

