import { useEffect, useMemo, useState } from "react";
import { getInitials, useAppSession } from "@/pages/app/context";
import { findTodayMood, recordMood, reloadMoods, useMoodState } from "@/pages/app/mood/moodStore";
import { getMoodOption, type MoodId } from "@/pages/app/mood/moodOptions";
import { resolveMoodActor, todayIso } from "@/pages/app/mood/moodUtils";
import MoodChooser from "@/pages/app/mood/components/MoodChooser";
import MoodCelebration from "@/pages/app/mood/components/MoodCelebration";

/**
 * Registro obrigatório do sentimento do dia.
 *
 * Modal bloqueante com acabamento premium: faixa de cor no topo, saudação
 * pessoal e confirmação celebrada — escolher "Muito Feliz" rende confete, e o
 * ato de registrar ganha uma tela de agradecimento antes de liberar o sistema.
 */
export default function DailyMoodGate() {
  const session = useAppSession();
  const actor = useMemo(() => resolveMoodActor(session), [session]);
  const { rows, loaded, loading, error } = useMoodState();
  const today = todayIso();

  const [selected, setSelected] = useState<MoodId | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [celebrated, setCelebrated] = useState(false);
  const [done, setDone] = useState<{ mood: MoodId } | null>(null);

  const alreadyRegistered = Boolean(findTodayMood(rows, actor.userKey, today));
  const firstName = actor.userName.split(" ")[0] || "Olá";
  const doneOption = done ? getMoodOption(done.mood) : undefined;

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 3400);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (done) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-foreground-950/80 p-3 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Sentimento registrado"
      >
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-background-200 bg-background-50 p-7 text-center shadow-2xl">
          <MoodCelebration active variant="full" />
          <div className="relative">
            <span className="relative mx-auto flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary-500/25 blur-2xl"></span>
              <span className="animate-mood-pop relative text-6xl">{doneOption?.emoji ?? "😊"}</span>
            </span>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-primary-600">
              <i className="ri-checkbox-circle-line mr-1"></i>
              Sentimento registrado
            </p>
            <h2 className="mt-1.5 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
              Obrigado, {firstName}!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground-600">
              {done.mood === "muito_feliz" || done.mood === "feliz"
                ? "Bom saber que o dia está leve. Que essa energia acompanhe você até o fim do expediente."
                : "Registrar como você se sente já ajuda quem cuida de você a estar por perto."}
            </p>
            <button
              type="button"
              onClick={() => setDone(null)}
              className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-arrow-right-line"></i>
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Evita o "flash" enquanto os registros ainda estão sendo carregados.
  if ((!loaded || loading) && !error) return null;
  if (alreadyRegistered) return null;

  const handleConfirm = async () => {
    if (!selected || saving) return;
    const option = getMoodOption(selected);
    if (!option) return;
    setSaving(true);
    setSaveError("");
    try {
      await recordMood({
        actor,
        mood: option.id,
        moodScore: option.score,
        reason,
        moodDate: today,
      });
      setDone({ mood: option.id });
    } catch {
      setSaveError("Não foi possível registrar o sentimento agora. Verifique a conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-foreground-950/75 p-3 py-8 backdrop-blur-sm md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Registro do sentimento do dia"
    >
      <div className="animate-fade-up relative w-full max-w-2xl overflow-hidden rounded-2xl border border-background-200 bg-background-50 shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary-500/20 via-accent-500/15 to-secondary-500/20"></div>
        <div className="relative p-5 md:p-7">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-primary-500/25 blur-md"></span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-background-50">
                {getInitials(actor.userName)}
              </span>
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-600">
                <i className="ri-heart-3-line"></i>
                Sentimento do dia
                <span className="inline-flex items-center gap-1 rounded-full bg-background-50/80 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-foreground-500">
                  <i className="ri-time-line"></i>
                  menos de 1 min
                </span>
              </p>
              <h2 className="mt-0.5 font-heading text-lg font-extrabold tracking-tight text-foreground-950 md:text-xl">
                Olá, {firstName}! Como foi o seu dia?
              </h2>
            </div>
          </div>

          <p className="mt-3.5 flex items-start gap-2 rounded-xl border border-secondary-200/60 bg-secondary-50 px-3.5 py-2.5 text-xs leading-relaxed text-secondary-900">
            <i className="ri-information-line mt-0.5"></i>
            Antes de começar, reserve um instante para registrar como você está se sentindo. É rápido e ajuda quem
            cuida de você no dia a dia.
          </p>

          <div className="mt-5">
            <MoodChooser
              value={selected}
              onChange={(mood) => {
                setSelected(mood);
                if (mood !== "muito_feliz") setCelebrated(false);
                else setCelebrated(true);
              }}
              reason={reason}
              onReasonChange={setReason}
            />
          </div>

          {error && !saveError && (
            <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-900">
              <i className="ri-wifi-off-line text-base"></i>
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => void reloadMoods()}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-accent-900 transition-colors hover:bg-accent-100"
              >
                <i className="ri-refresh-line"></i>
                Tentar novamente
              </button>
            </div>
          )}

          {saveError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-900">
              <i className="ri-error-warning-line mt-0.5 text-base"></i>
              <span className="flex-1">{saveError}</span>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-background-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5 text-[11px] text-foreground-400">
              <i className="ri-calendar-check-line"></i>
              Um único registro por dia
              {celebrated && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 font-semibold text-primary-700">
                  <i className="ri-sparkling-2-line"></i>
                  confete liberado
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={!selected || saving}
              onClick={handleConfirm}
              className={`inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                selected && !saving
                  ? "animate-mood-breathe bg-primary-500 text-background-50 hover:bg-primary-600"
                  : "cursor-not-allowed bg-background-300 text-foreground-400"
              }`}
            >
              {saving ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-base"></i>
                  Registrando...
                </>
              ) : (
                <>
                  <i className="ri-emotion-happy-line text-base"></i>
                  Registrar sentimento do dia
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}