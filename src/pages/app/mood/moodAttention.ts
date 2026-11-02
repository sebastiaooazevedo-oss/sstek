import { isNegativeMood } from "./moodOptions";
import { buildPeople, type PersonMoodSummary } from "./moodPeople";
import { followupFor, type MoodFollowup } from "./moodFollowupStore";
import type { MoodEntry } from "./moodStore";

/**
 * Cruzamento entre "quem está mal" e "quem já foi acolhido".
 *
 * É a peça que transforma o registro de sentimento em um alerta acionável:
 * um caso só entra como pendente quando o registro mais recente da pessoa é
 * negativo E ainda não existe um acolhimento válido (ou ele segue apenas
 * como "aguardando"). Assim o aviso do sino desaparece naturalmente no
 * momento em que o superior registra o acompanhamento.
 *
 * O recorte é sempre por janela de dias para evitar que alertas antigos
 * fiquem apitando para sempre na tela de quem já resolveu o assunto.
 */
export const MOOD_ALERT_WINDOW_DAYS = 7;

const DAY_MS = 86400000;

function dayIndex(iso: string): number | null {
  const [year, month, day] = (iso || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export interface MoodAttentionCase {
  person: PersonMoodSummary;
  followup: MoodFollowup | undefined;
  /** Ainda não existe acolhimento válido para o registro mais recente. */
  needsFollowup: boolean;
  /** Quantos dias se passaram desde o registro mais recente. */
  daysAgo: number | null;
}

export interface MoodAttentionOptions {
  /** Janela máxima, em dias, para o registro continuar gerando alerta. */
  windowDays?: number;
  /** Considera apenas casos ainda sem acolhimento registrado. */
  onlyPending?: boolean;
  /** Considera apenas pessoas cujo último registro é negativo. */
  onlyNegativeLatest?: boolean;
}

/** Idade do registro mais recente de uma ficha (em dias). */
export function moodDaysAgo(moodDate: string, todayIso: string): number | null {
  const today = dayIndex(todayIso);
  const day = dayIndex(moodDate);
  if (today === null || day === null) return null;
  return today - day;
}

/** Acolhimento registrado para o último registro da pessoa. */
export function followupForPerson(
  followups: MoodFollowup[],
  person: PersonMoodSummary
): MoodFollowup | undefined {
  return followupFor(followups, person.userKey, person.latest.moodDate);
}

/** Um acolhimento só conta como resolvido se saiu de "aguardando". */
export function followupResolved(followup: MoodFollowup | undefined): boolean {
  return Boolean(followup && followup.status !== "pendente");
}

/**
 * Converte uma lista de fichas em casos de atenção, já com o status do
 * acolhimento e a idade do registro mais recente.
 */
export function attentionCasesFor(
  people: PersonMoodSummary[],
  followups: MoodFollowup[],
  todayIso: string,
  options: MoodAttentionOptions = {}
): MoodAttentionCase[] {
  const windowDays = options.windowDays ?? MOOD_ALERT_WINDOW_DAYS;
  const onlyPending = options.onlyPending ?? false;
  const onlyNegativeLatest = options.onlyNegativeLatest ?? false;

  return people
    .filter((person) => person.attention !== null)
    .map((person) => {
      const followup = followupForPerson(followups, person);
      return {
        person,
        followup,
        needsFollowup: !followupResolved(followup),
        daysAgo: moodDaysAgo(person.latest.moodDate, todayIso),
      };
    })
    .filter((item) => {
      if (item.daysAgo !== null && item.daysAgo > windowDays) return false;
      if (onlyNegativeLatest && !isNegativeMood(item.person.latest.mood)) return false;
      if (onlyPending && !item.needsFollowup) return false;
      return true;
    });
}

/** Atalho: casos pendentes a partir dos registros brutos do período. */
export function pendingMoodAlerts(
  entries: MoodEntry[],
  followups: MoodFollowup[],
  todayIso: string,
  windowDays: number = MOOD_ALERT_WINDOW_DAYS
): MoodAttentionCase[] {
  return attentionCasesFor(buildPeople(entries), followups, todayIso, {
    windowDays,
    onlyPending: true,
    onlyNegativeLatest: true,
  });
}