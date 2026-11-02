import { useMemo } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { getInitials } from "@/pages/app/context";
import { getMoodOption, MOOD_OPTIONS, moodToneChip, type MoodId } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate } from "@/pages/app/mood/moodUtils";
import { followupStatusLabel, latestFollowupFor, type MoodFollowup } from "@/pages/app/mood/moodFollowupStore";
import {
  ATTENTION_META,
  attentionPeople,
  attentionSignal,
  peopleByMood,
  type AttentionLevel,
  type PersonMoodSummary,
} from "@/pages/app/mood/moodPeople";

export type PeopleTab = "moods" | "attention";

interface MoodPeoplePanelProps {
  people: PersonMoodSummary[];
  selectedMood: MoodId | null;
  onSelectMood: (mood: MoodId | null) => void;
  onOpenPerson: (person: PersonMoodSummary) => void;
  tab: PeopleTab;
  onTabChange: (tab: PeopleTab) => void;
  followups: MoodFollowup[];
  periodText: string;
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

const FOLLOW_STATUS_CHIP: Record<string, string> = {
  pendente: "bg-secondary-100 text-secondary-900",
  acompanhando: "bg-primary-100 text-primary-700",
  acolhido: "bg-primary-500 text-background-50",
};

/**
 * "Quem está como" e "quem precisa de atenção".
 *
 * A primeira aba mostra, para cada sentimento, quem registrou aquilo por último
 * no período — o gestor enxerga as pessoas por trás dos números. A segunda
 * organiza os casos que pedem conversa, com o motivo declarado e o status do
 * acolhimento. Clicar em qualquer pessoa abre a ficha completa.
 */
export default function MoodPeoplePanel({
  people,
  selectedMood,
  onSelectMood,
  onOpenPerson,
  tab,
  onTabChange,
  followups,
  periodText,
}: MoodPeoplePanelProps) {
  const attention = useMemo(() => attentionPeople(people), [people]);
  const grouped = useMemo(
    () => MOOD_OPTIONS.map((option) => ({ option, list: peopleByMood(people, option.id) })),
    [people]
  );

  const counts = useMemo(
    () => ({
      critico: attention.filter((person) => person.attention === "critico").length,
      atencao: attention.filter((person) => person.attention === "atencao").length,
      observacao: attention.filter((person) => person.attention === "observacao").length,
    }),
    [attention]
  );

  const visibleGroups = selectedMood
    ? grouped.filter((group) => group.option.id === selectedMood)
    : grouped;

  const statusFor = (person: PersonMoodSummary) => latestFollowupFor(followups, person.userKey);

  return (
    <SectionCard
      title="Colaboradores"
      subtitle={`Quem escolheu cada sentimento no período · ${periodText}`}
      action={
        <div className="inline-flex items-center gap-1 rounded-full bg-background-100 p-1">
          <button
            type="button"
            onClick={() => onTabChange("moods")}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === "moods" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className="ri-user-heart-line text-base"></i>
            Quem está como
          </button>
          <button
            type="button"
            onClick={() => onTabChange("attention")}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === "attention" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className="ri-alert-line text-base"></i>
            Precisa de atenção
            {attention.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  tab === "attention" ? "bg-background-50 text-primary-700" : "bg-accent-100 text-accent-800"
                }`}
              >
                {attention.length}
              </span>
            )}
          </button>
        </div>
      }
    >
      {people.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-user-search-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum colaborador com registro no período</p>
          <p className="text-xs text-foreground-500">Ajuste o período para ver quem registrou sentimento.</p>
        </div>
      ) : tab === "moods" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
              Mostrar sentimento
            </span>
            <button
              type="button"
              onClick={() => onSelectMood(null)}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedMood === null
                  ? "border-primary-300 bg-primary-500 text-background-50"
                  : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
              }`}
            >
              <i className="ri-layout-grid-line"></i>
              Todos
            </button>
            {MOOD_OPTIONS.map((option) => {
              const active = selectedMood === option.id;
              const count = grouped.find((group) => group.option.id === option.id)?.list.length ?? 0;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectMood(active ? null : option.id)}
                  aria-pressed={active}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary-300 bg-primary-500 text-background-50"
                      : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                  }`}
                >
                  <span className="text-sm leading-none">{option.emoji}</span>
                  {option.label}
                  <span className={`tabular-nums ${active ? "text-background-50/80" : "text-foreground-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`grid gap-3 ${
              visibleGroups.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            }`}
          >
            {visibleGroups.map(({ option, list }) => (
              <div key={option.id} className="flex min-w-0 flex-col rounded-xl border border-background-200 bg-background-100">
                <div className="flex items-center justify-between gap-2 border-b border-background-200 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-lg leading-none">{option.emoji}</span>
                    <span className="truncate text-xs font-bold text-foreground-900">{option.label}</span>
                  </span>
                  <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground-600">
                    {list.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  {list.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[11px] text-foreground-400">Ninguém neste sentimento</p>
                  ) : (
                    list.map((person) => {
                      const status = statusFor(person);
                      return (
                        <button
                          key={person.userKey}
                          type="button"
                          onClick={() => onOpenPerson(person)}
                          className="group flex w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-background-50 px-2 py-1.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-sm"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${moodToneChip(option.id)}`}
                          >
                            {getInitials(person.userName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-semibold text-foreground-900">
                              {person.userName}
                            </span>
                            <span className="block truncate text-[10px] text-foreground-500">
                              {person.area || "Sem área"}
                              {person.latest.establishment ? ` · ${person.latest.establishment}` : ""} ·{" "}
                              {friendlyMoodDate(person.latest.moodDate)}
                            </span>
                          </span>
                          {status && (
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                status.status === "acolhido"
                                  ? "bg-primary-500"
                                  : status.status === "acompanhando"
                                    ? "bg-primary-300"
                                    : "bg-secondary-400"
                              }`}
                            ></span>
                          )}
                          <i className="ri-arrow-right-s-line shrink-0 text-foreground-300 transition-colors group-hover:text-primary-600"></i>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-foreground-500">
            <i className="ri-information-line"></i>
            Cada pessoa aparece no sentimento do seu registro mais recente no período. Clique para abrir a ficha e registrar o acolhimento.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {(["critico", "atencao", "observacao"] as AttentionLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-3.5 py-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${LEVEL_CHIP[level]}`}>
                  <i
                    className={
                      level === "critico" ? "ri-alarm-warning-line" : level === "atencao" ? "ri-alert-line" : "ri-eye-line"
                    }
                  ></i>
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-lg font-extrabold leading-none tabular-nums text-foreground-950">
                    {counts[level]}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold text-foreground-600">{ATTENTION_META[level].label}</p>
                </div>
              </div>
            ))}
          </div>

          {attention.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-emotion-happy-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum colaborador em alerta no período</p>
              <p className="text-xs text-foreground-500">
                Nenhum registro negativo encontrado. Continue acompanhando o pulso da equipe.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {attention.map((person) => {
                const option = getMoodOption(person.latest.mood);
                const level = person.attention as AttentionLevel;
                const status = statusFor(person);
                return (
                  <div
                    key={person.userKey}
                    className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-background-200 bg-background-100 p-3.5 pl-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center"
                  >
                    <span className={`absolute inset-y-0 left-0 w-1 ${LEVEL_BAR[level]}`}></span>
                    <div className="relative shrink-0">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold ${moodToneChip(person.latest.mood)}`}
                      >
                        {getInitials(person.userName)}
                      </span>
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-background-50 bg-background-50 text-sm">
                        {option?.emoji ?? "•"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground-950">{person.userName}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${LEVEL_CHIP[level]}`}>
                          <i className={level === "observacao" ? "ri-eye-line" : "ri-alert-line"}></i>
                          {ATTENTION_META[level].label}
                        </span>
                        {person.area && <span className="text-[11px] text-foreground-400">{person.area}</span>}
                        {person.latest.establishment && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                            <i className="ri-building-4-line"></i>
                            {person.latest.establishment}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-foreground-600">{attentionSignal(person)}</p>
                      {person.latest.reason && (
                        <p className="mt-1 line-clamp-2 text-[11px] italic leading-relaxed text-foreground-500">
                          “{person.latest.reason}”
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {status ? (
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${FOLLOW_STATUS_CHIP[status.status]}`}>
                          <i className="ri-hand-heart-line"></i>
                          {followupStatusLabel(status.status)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-600">
                          <i className="ri-time-line"></i>
                          Sem acolhimento
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenPerson(person)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-user-heart-line"></i>
                        Abrir ficha
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}