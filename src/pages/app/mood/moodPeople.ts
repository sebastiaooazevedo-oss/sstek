import { isNegativeMood, type MoodId } from "./moodOptions";
import type { MoodEntry } from "./moodStore";

/**
 * Seletores que transformam a lista de registros em "pessoas".
 *
 * O painel do gestor precisa responder duas perguntas: quem está em cada
 * sentimento agora e quem precisa de atenção (tristeza repetida, muito triste
 * ou histórico negativo recente). Aqui consolidamos o último registro de cada
 * colaborador no período e calculamos os sinais usados nos alertas.
 */
export type AttentionLevel = "critico" | "atencao" | "observacao";

export interface PersonMoodSummary {
  userKey: string;
  userName: string;
  area: string;
  role: string;
  latest: MoodEntry;
  entries: MoodEntry[];
  total: number;
  average: number;
  negativeCount: number;
  negativeDays: number;
  negativeStreak: number;
  lastNegative: MoodEntry | null;
  daysSinceLastNegative: number | null;
  attention: AttentionLevel | null;
}

const ATTENTION_RANK: Record<AttentionLevel, number> = {
  critico: 0,
  atencao: 1,
  observacao: 2,
};

function dayNumber(iso: string): number | null {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d) / 86400000;
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = dayNumber(fromIso);
  const to = dayNumber(toIso);
  if (from === null || to === null) return null;
  return to - from;
}

/**
 * Streak de dias negativos consecutivos, contando a partir do último registro.
 * Só existe se o registro mais recente da pessoa for negativo.
 */
function negativeStreak(latest: MoodEntry, days: Map<string, MoodEntry>): number {
  if (!isNegativeMood(latest.mood)) return 0;
  let streak = 0;
  let cursor = dayNumber(latest.moodDate);
  if (cursor === null) return 0;
  while (true) {
    const iso = new Date(cursor * 86400000).toISOString().slice(0, 10);
    const entry = days.get(iso);
    if (!entry || !isNegativeMood(entry.mood)) break;
    streak += 1;
    cursor -= 1;
    if (streak > 60) break;
  }
  return streak;
}

function attentionFor(
  latest: MoodEntry,
  negativeDays: number,
  negativeCount: number,
  streak: number
): AttentionLevel | null {
  if (streak >= 2 || latest.mood === "muito_triste") return "critico";
  if (isNegativeMood(latest.mood) || negativeDays >= 2) return "atencao";
  if (negativeCount > 0) return "observacao";
  return null;
}

/**
 * Consolida os registros em uma ficha por colaborador.
 * `entries` chega do mais recente para o mais antigo (ordem do store).
 */
export function buildPeople(entries: MoodEntry[]): PersonMoodSummary[] {
  const byPerson = new Map<string, MoodEntry[]>();
  entries.forEach((entry) => {
    const list = byPerson.get(entry.userKey);
    if (list) list.push(entry);
    else byPerson.set(entry.userKey, [entry]);
  });

  const people: PersonMoodSummary[] = [];
  byPerson.forEach((list, userKey) => {
    const sorted = [...list].sort((a, b) => {
      if (a.moodDate !== b.moodDate) return a.moodDate < b.moodDate ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    const latest = sorted[0];
    if (!latest) return;

    const days = new Map<string, MoodEntry>();
    sorted.forEach((entry) => {
      const current = days.get(entry.moodDate);
      if (!current || entry.moodScore < current.moodScore) days.set(entry.moodDate, entry);
    });

    const negatives = sorted.filter((entry) => isNegativeMood(entry.mood));
    const negativeDaySet = new Set(negatives.map((entry) => entry.moodDate));
    const lastNegative = negatives[0] ?? null;
    const streak = negativeStreak(latest, days);
    const total = sorted.length;
    const average = total > 0 ? sorted.reduce((sum, entry) => sum + entry.moodScore, 0) / total : 0;

    people.push({
      userKey,
      userName: latest.userName,
      area: latest.area,
      role: latest.role,
      latest,
      entries: sorted,
      total,
      average,
      negativeCount: negatives.length,
      negativeDays: negativeDaySet.size,
      negativeStreak: streak,
      lastNegative,
      daysSinceLastNegative: lastNegative ? daysBetween(lastNegative.moodDate, latest.moodDate) : null,
      attention: attentionFor(latest, negativeDaySet.size, negatives.length, streak),
    });
  });

  return people.sort((a, b) => {
    const rankA = a.attention ? ATTENTION_RANK[a.attention] : 99;
    const rankB = b.attention ? ATTENTION_RANK[b.attention] : 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.userName.localeCompare(b.userName, "pt-BR");
  });
}

/** Pessoas cujo sentimento mais recente é o informado. */
export function peopleByMood(people: PersonMoodSummary[], mood: MoodId): PersonMoodSummary[] {
  return people.filter((person) => person.latest.mood === mood);
}

/** Quem precisa de atenção, do mais grave para o mais leve. */
export function attentionPeople(people: PersonMoodSummary[]): PersonMoodSummary[] {
  return people.filter((person) => person.attention !== null);
}

export const ATTENTION_META: Record<AttentionLevel, { label: string; description: string }> = {
  critico: {
    label: "Prioridade alta",
    description: "Tristeza repetida por vários dias ou sentimento muito triste no último registro.",
  },
  atencao: {
    label: "Atenção",
    description: "Sentimento negativo no último registro ou mais de um dia negativo no período.",
  },
  observacao: {
    label: "Observação",
    description: "Teve algum dia negativo no período, mas o registro mais recente não é negativo.",
  },
};

/** Texto curto do sinal detectado, usado nos cards. */
export function attentionSignal(person: PersonMoodSummary): string {
  if (person.negativeStreak >= 2) {
    return `Sentimento negativo há ${person.negativeStreak} dias seguidos`;
  }
  if (person.latest.mood === "muito_triste") return "Marcou Muito Triste no último registro";
  if (isNegativeMood(person.latest.mood)) {
    return person.negativeDays > 1
      ? `${person.negativeDays} dias negativos no período`
      : "Marcou sentimento negativo no último registro";
  }
  if (person.negativeDays > 1) return `${person.negativeDays} dias negativos no período`;
  if (person.daysSinceLastNegative !== null && person.daysSinceLastNegative > 0) {
    return `Sentimento negativo há ${person.daysSinceLastNegative} dia(s)`;
  }
  return "Histórico com registro negativo";
}