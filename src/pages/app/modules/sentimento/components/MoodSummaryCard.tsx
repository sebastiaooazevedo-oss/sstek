import { useMemo } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { useAppSession } from "@/pages/app/context";
import { getMoodOption } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate, isoToBr, moodTime, resolveMoodActor, todayIso } from "@/pages/app/mood/moodUtils";
import { ownMoods, useMoodState } from "@/pages/app/mood/moodStore";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Últimos N dias em ISO, do mais antigo para hoje. */
function lastDays(count: number): string[] {
  const now = new Date();
  const days: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index);
    days.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return days;
}

function weekdayShort(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
}

/**
 * Resumo do sentimento do próprio colaborador.
 *
 * Mostra o registro de hoje em destaque, uma faixa com os últimos sete dias
 * (o dia atual ganha halo) e a sequência de dias registrados — um jeito leve
 * de lembrar o colaborador de cuidar de si todos os dias.
 */
export default function MoodSummaryCard() {
  const session = useAppSession();
  const actor = useMemo(() => resolveMoodActor(session), [session]);
  const { rows } = useMoodState();

  const mine = useMemo(() => ownMoods(rows, actor), [rows, actor]);
  const byDate = useMemo(() => {
    const map = new Map<string, (typeof mine)[number]>();
    mine.forEach((entry) => map.set(entry.moodDate, entry));
    return map;
  }, [mine]);

  const today = todayIso();
  const todayEntry = byDate.get(today);
  const todayOption = todayEntry ? getMoodOption(todayEntry.mood) : undefined;

  const week = lastDays(7);
  const streak = useMemo(() => {
    let count = 0;
    for (let index = 0; index < 365; index += 1) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      if (byDate.has(iso)) count += 1;
      else break;
    }
    return count;
  }, [byDate]);

  const recent = useMemo(() => mine.slice(0, 5), [mine]);

  return (
    <SectionCard title="Meu sentimento" subtitle="Como você se sentiu nos últimos dias">
      {todayEntry && todayOption ? (
        <div className="relative overflow-hidden rounded-xl border border-primary-200 bg-primary-50 p-4">
          <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-primary-500/10 blur-2xl"></span>
          <div className="relative flex items-center gap-3.5">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <span className="absolute inset-1 rounded-full bg-primary-500/20 blur-md"></span>
              <span className="animate-mood-pop relative text-4xl">{todayOption.emoji}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground-950">
                Hoje você está se sentindo <span className="text-primary-700">{todayOption.label}</span>
              </p>
              <p className="mt-0.5 text-xs text-foreground-500">
                <i className="ri-time-line mr-1"></i>
                Registrado às {moodTime(todayEntry.createdAt)}
              </p>
            </div>
            {streak > 1 && (
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-background-50 px-2.5 py-1 text-[11px] font-bold text-primary-700 sm:inline-flex">
                <i className="ri-fire-line"></i>
                {streak} dias
              </span>
            )}
          </div>
          {todayEntry.reason && (
            <p className="relative mt-3 rounded-lg bg-background-50 px-3 py-2 text-xs italic leading-relaxed text-foreground-600">
              “{todayEntry.reason}”
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-background-300 bg-background-100 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-emotion-line text-xl"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-900">Ainda sem registro hoje</p>
            <p className="mt-0.5 text-[11px] text-foreground-500">
              O registro do dia aparece aqui assim que for feito.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-calendar-2-line"></i>
            Últimos 7 dias
          </p>
          <span className="text-[11px] text-foreground-400">
            {week.filter((iso) => byDate.has(iso)).length}/7 registrados
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((iso) => {
            const entry = byDate.get(iso);
            const option = entry ? getMoodOption(entry.mood) : undefined;
            const isToday = iso === today;
            return (
              <div
                key={iso}
                title={`${isoToBr(iso)}${option ? ` · ${option.label}` : " · sem registro"}`}
                className={`flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors ${
                  isToday
                    ? "border-primary-300 bg-primary-50"
                    : option
                      ? "border-background-200 bg-background-100"
                      : "border-dashed border-background-200 bg-background-50"
                }`}
              >
                <span
                  className={`text-[9px] font-bold uppercase ${
                    isToday ? "text-primary-700" : "text-foreground-400"
                  }`}
                >
                  {weekdayShort(iso)}
                </span>
                <span className={`text-base leading-none ${isToday && option ? "animate-mood-pop" : ""}`}>
                  {option?.emoji ?? "·"}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${option ? "bg-primary-500" : "bg-background-300"}`}
                ></span>
              </div>
            );
          })}
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {recent.map((entry) => {
            const option = getMoodOption(entry.mood);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-3.5 py-2.5"
              >
                <span className="text-xl">{option?.emoji ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground-800">{option?.label ?? "Registro"}</p>
                  {entry.reason && <p className="truncate text-[11px] text-foreground-500">{entry.reason}</p>}
                </div>
                <span className="whitespace-nowrap text-[11px] font-medium text-foreground-400">
                  {friendlyMoodDate(entry.moodDate)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}