import { useEffect, useState } from "react";
import { MOOD_OPTIONS, type MoodId } from "@/pages/app/mood/moodOptions";
import MoodCelebration from "@/pages/app/mood/components/MoodCelebration";

interface MoodChooserProps {
  value: MoodId | null;
  onChange: (mood: MoodId) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  compact?: boolean;
}

interface MoodVisual {
  /** Glow suave atrás do emoji (translúcido, funciona no claro e no escuro). */
  halo: string;
  /** Borda + fundo quando o card está selecionado. */
  active: string;
  /** Tinta do texto do rótulo quando selecionado. */
  label: string;
  /** Mensagem de acolhimento exibida abaixo das opções. */
  message: string;
}

const VISUALS: Record<MoodId, MoodVisual> = {
  muito_triste: {
    halo: "bg-accent-600/25",
    active: "border-accent-400 bg-accent-50 ring-1 ring-accent-300/70",
    label: "text-accent-800",
    message: "Obrigado por confiar. Dias difíceis passam — e você não está sozinho nisso.",
  },
  triste: {
    halo: "bg-accent-500/25",
    active: "border-accent-400 bg-accent-50 ring-1 ring-accent-300/70",
    label: "text-accent-800",
    message: "Obrigado por contar. Reconhecer como a gente se sente já é um passo importante.",
  },
  neutro: {
    halo: "bg-secondary-500/25",
    active: "border-secondary-400 bg-secondary-50 ring-1 ring-secondary-300/70",
    label: "text-secondary-800",
    message: "Dia neutro também é dia. Um passo de cada vez, sem pressa.",
  },
  feliz: {
    halo: "bg-primary-500/25",
    active: "border-primary-400 bg-primary-50 ring-2 ring-primary-300/60",
    label: "text-primary-700",
    message: "Boa! Que esse humor contamine o time hoje.",
  },
  muito_feliz: {
    halo: "bg-primary-500/35",
    active: "border-primary-400 bg-primary-50 ring-2 ring-primary-300/70",
    label: "text-primary-700",
    message: "Uhuu! Que energia boa — isso merece confete. Espalha essa alegria por aí!",
  },
};

const REASON_SUGGESTIONS = [
  "Trabalho em equipe",
  "Reconhecimento",
  "Muita demanda",
  "Dia tranquilo",
  "Aprendi algo novo",
];

const MAX_REASON = 500;

/**
 * Seletor do sentimento do dia.
 *
 * Cards com brilho suave e elevação no hover, marcação bem visível da escolha
 * e uma faixa de retorno empática logo abaixo. Escolher "Muito Feliz" dispara
 * uma rajada de confete, porque sim — dia bom merece comemoração.
 */
export default function MoodChooser({
  value,
  onChange,
  reason,
  onReasonChange,
  compact = false,
}: MoodChooserProps) {
  const [reasonFocused, setReasonFocused] = useState(false);
  const [celebrateId, setCelebrateId] = useState(0);

  const selectedVisual = value ? VISUALS[value] : null;
  const isVeryHappy = value === "muito_feliz";

  useEffect(() => {
    if (!isVeryHappy) setCelebrateId(0);
  }, [isVeryHappy]);

  const handleSelect = (mood: MoodId) => {
    onChange(mood);
    if (mood === "muito_feliz") setCelebrateId((id) => id + 1);
  };

  const appendSuggestion = (text: string) => {
    const current = reason.trim();
    if (current.toLowerCase().includes(text.toLowerCase())) return;
    const next = current ? `${current} · ${text}` : text;
    onReasonChange(next.slice(0, MAX_REASON));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground-800">
            Como você está se sentindo hoje?
            <span className="ml-1 text-accent-600">*</span>
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-lock-2-line"></i>
            Privado
          </span>
        </div>

        <div className="relative">
          {celebrateId > 0 && (
            <MoodCelebration key={celebrateId} active onDone={() => setCelebrateId(0)} className="rounded-2xl" />
          )}

          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {MOOD_OPTIONS.map((option) => {
              const active = value === option.id;
              const visual = VISUALS[option.id];
              const veryHappy = option.id === "muito_feliz";
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={option.label}
                  onClick={() => handleSelect(option.id)}
                  className={`group relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-2xl border px-1 py-3.5 transition-all duration-300 sm:px-2 sm:py-4 ${
                    active
                      ? `${visual.active} -translate-y-0.5 shadow-lg shadow-foreground-950/5`
                      : "border-background-200 bg-background-100 hover:-translate-y-1 hover:border-primary-300 hover:bg-background-50 hover:shadow-md hover:shadow-foreground-950/5"
                  }`}
                >
                  {veryHappy && (
                    <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <span className="mood-shimmer absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-accent-500/25 to-transparent"></span>
                    </span>
                  )}

                  <span
                    className={`relative flex items-center justify-center ${compact ? "h-12 w-12" : "h-14 w-14"}`}
                  >
                    <span
                      className={`absolute inset-1 rounded-full blur-lg transition-opacity duration-300 ${visual.halo} ${
                        active ? "animate-mood-halo opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                    ></span>
                    <span
                      key={active ? "on" : "off"}
                      className={`relative ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} ${
                        active ? "animate-mood-pop" : ""
                      }`}
                    >
                      {option.emoji}
                    </span>
                  </span>

                  <span
                    className={`relative text-center text-[10px] font-semibold leading-tight sm:text-xs ${
                      active ? visual.label : "text-foreground-600"
                    }`}
                  >
                    {option.label}
                  </span>

                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-background-50 shadow-sm">
                      <i className="ri-check-line text-[10px]"></i>
                    </span>
                  )}
                  {veryHappy && !active && (
                    <span className="absolute right-1.5 top-1.5 text-[10px]">🎉</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {value && selectedVisual ? (
          <div
            key={value}
            className="animate-mood-rise mt-3 flex items-start gap-2.5 rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5"
          >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selectedVisual.halo}`}>
              <i className={`text-xs ${isVeryHappy ? "ri-sparkling-2-line" : "ri-heart-3-line"} text-primary-700`}></i>
            </span>
            <p className="text-xs leading-relaxed text-foreground-600" aria-live="polite">
              {selectedVisual.message}
            </p>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground-400">
            <i className="ri-hand-heart-line"></i>
            Toque em um dos sentimentos. Leva menos de cinco segundos.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <label htmlFor="mood-reason" className="block text-sm font-semibold text-foreground-800">
            Motivo <span className="font-normal text-foreground-400">(opcional)</span>
          </label>
          <span
            className={`text-[11px] font-medium tabular-nums ${
              reason.length > MAX_REASON - 60 ? "text-accent-700" : "text-foreground-400"
            }`}
          >
            {reason.length}/{MAX_REASON}
          </span>
        </div>

        <textarea
          id="mood-reason"
          name="mood_reason"
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          onFocus={() => setReasonFocused(true)}
          onBlur={() => setReasonFocused(false)}
          placeholder={reasonFocused ? "" : "Nos conte o que te faz sentir assim"}
          className="w-full resize-none rounded-xl border border-background-300 bg-background-50 px-3.5 py-3 text-sm leading-relaxed text-foreground-900 outline-none transition-all placeholder:text-foreground-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-200/60"
        ></textarea>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[11px] font-medium text-foreground-400">Atalhos:</span>
          {REASON_SUGGESTIONS.map((suggestion) => {
            const picked = reason.toLowerCase().includes(suggestion.toLowerCase());
            return (
              <button
                key={suggestion}
                type="button"
                onClick={() => appendSuggestion(suggestion)}
                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  picked
                    ? "border-primary-300 bg-primary-100 text-primary-700"
                    : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300 hover:bg-background-100"
                }`}
              >
                <i className={picked ? "ri-check-line" : "ri-add-line"}></i>
                {suggestion}
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-500">
          <i className="ri-lock-2-line mt-0.5 text-xs text-secondary-700"></i>
          Fique à vontade para falar o que sente. Essa informação é privada e será lida somente por alguém que quer te
          ver feliz!
        </p>
      </div>
    </div>
  );
}