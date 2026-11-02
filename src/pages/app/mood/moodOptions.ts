/**
 * Catálogo do "sentimento do dia".
 * Cinco níveis, do mais negativo ao mais positivo, representados por emoji.
 * A pontuação (1 a 5) alimenta os indicadores do gestor.
 */
export type MoodId = "muito_triste" | "triste" | "neutro" | "feliz" | "muito_feliz";

export type MoodTone = "accent" | "secondary" | "primary";

export interface MoodOption {
  id: MoodId;
  label: string;
  emoji: string;
  score: number;
  tone: MoodTone;
}

export const MOOD_OPTIONS: MoodOption[] = [
  { id: "muito_triste", label: "Muito Triste", emoji: "😢", score: 1, tone: "accent" },
  { id: "triste", label: "Triste", emoji: "🙁", score: 2, tone: "accent" },
  { id: "neutro", label: "Neutro", emoji: "😐", score: 3, tone: "secondary" },
  { id: "feliz", label: "Feliz", emoji: "🙂", score: 4, tone: "primary" },
  { id: "muito_feliz", label: "Muito Feliz", emoji: "😄", score: 5, tone: "primary" },
];

const OPTIONS_BY_ID: Record<string, MoodOption> = MOOD_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {} as Record<string, MoodOption>
);

export function getMoodOption(id: string): MoodOption | undefined {
  return OPTIONS_BY_ID[id];
}

export function moodLabel(id: string): string {
  return getMoodOption(id)?.label ?? "—";
}

export function moodEmoji(id: string): string {
  return getMoodOption(id)?.emoji ?? "•";
}

/** Humores que disparam o alerta para o gestor. */
export function isNegativeMood(id: string): boolean {
  return id === "muito_triste" || id === "triste";
}

/** Opção de humor mais próxima de uma nota (usada para médias fracionadas). */
export function getMoodByScore(score: number): MoodOption | undefined {
  if (!Number.isFinite(score)) return undefined;
  let best: MoodOption | undefined;
  let bestDiff = Number.POSITIVE_INFINITY;
  MOOD_OPTIONS.forEach((option) => {
    const diff = Math.abs(option.score - score);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = option;
    }
  });
  return best;
}

const toneChip: Record<MoodTone, string> = {
  accent: "bg-accent-100 text-accent-800",
  secondary: "bg-secondary-100 text-secondary-800",
  primary: "bg-primary-100 text-primary-700",
};

export function moodToneChip(id: string): string {
  const tone = getMoodOption(id)?.tone ?? "secondary";
  return toneChip[tone];
}