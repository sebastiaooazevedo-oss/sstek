import { useMemo } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/pages/app/components/ui";
import { getInitials, useAppSession } from "@/pages/app/context";
import { MOOD_OPTIONS, getMoodOption, isNegativeMood, moodToneChip } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate, moodTime, resolveMoodActor, todayIso } from "@/pages/app/mood/moodUtils";
import { teamMoods, useMoodState } from "@/pages/app/mood/moodStore";
import { areasLedBy, useLeadership } from "@/pages/app/modules/leadership/leadershipStore";

const SEGMENT_COLOR: Record<string, string> = {
  muito_triste: "bg-accent-600",
  triste: "bg-accent-400",
  neutro: "bg-secondary-400",
  feliz: "bg-primary-400",
  muito_feliz: "bg-primary-600",
};

/**
 * Painel do gestor: sentimento da equipe sob sua responsabilidade.
 *
 * Resume o dia em três números, mostra a distribuição de hoje numa barra
 * única e lista os registros recentes. Quem marcou Triste ou Muito Triste
 * aparece destacado, com o motivo informado — informação privada, lida por
 * quem cuida deles.
 */
export default function MoodTeamPanel() {
  const session = useAppSession();
  const actor = useMemo(() => resolveMoodActor(session), [session]);
  const { rows } = useMoodState();
  const leadership = useLeadership();
  const today = todayIso();

  const leaderAreas = useMemo(() => areasLedBy(actor.collaboratorId), [actor, leadership]);
  const team = useMemo(() => teamMoods(rows, actor, leaderAreas), [rows, actor, leaderAreas]);
  const todayEntries = team.filter((entry) => entry.moodDate === today);
  const alerts = todayEntries.filter((entry) => isNegativeMood(entry.mood));
  const recent = team.slice(0, 6);

  const distribution = MOOD_OPTIONS.map((option) => ({
    option,
    count: todayEntries.filter((entry) => entry.mood === option.id).length,
  })).filter((item) => item.count > 0);

  const stats = [
    {
      icon: "ri-emotion-happy-line",
      value: todayEntries.length,
      label: "Registros hoje",
      tone: "bg-primary-100 text-primary-700",
    },
    {
      icon: "ri-alert-line",
      value: alerts.length,
      label: "Alertas (tristes)",
      tone: "bg-accent-100 text-accent-800",
    },
    {
      icon: "ri-group-line",
      value: team.length,
      label: "Acompanhados",
      tone: "bg-secondary-100 text-secondary-800",
    },
  ];

  return (
    <SectionCard
      title="Sentimento da equipe"
      subtitle="Registros do dia e alertas de colaboradores sob sua responsabilidade"
      action={
        <Link
          to="/app/sentimento"
          className="hidden cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
        >
          <i className="ri-arrow-right-line"></i>
          Abrir painel
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-2.5 md:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-xl border border-background-200 bg-background-100 p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.tone}`}>
              <i className={`${stat.icon} text-base`}></i>
            </span>
            <p className="mt-2.5 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[11px] font-medium leading-tight text-foreground-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-background-200 bg-background-100 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground-500">
            <i className="ri-pulse-line"></i>
            Pulso de hoje
          </p>
          <span className="text-[11px] text-foreground-400">
            {todayEntries.length} registro{todayEntries.length === 1 ? "" : "s"} ·{" "}
            {todayEntries.filter((entry) => entry.moodScore >= 4).length} positivo(s)
          </span>
        </div>

        {distribution.length > 0 ? (
          <>
            <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-background-200">
              {distribution.map(({ option, count }) => (
                <span
                  key={option.id}
                  title={`${option.label}: ${count}`}
                  className={`h-full ${SEGMENT_COLOR[option.id]}`}
                  style={{ width: `${(count / todayEntries.length) * 100}%` }}
                ></span>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {distribution.map(({ option, count }) => (
                <span
                  key={option.id}
                  className="inline-flex items-center gap-1 rounded-full bg-background-50 px-2 py-0.5 text-[11px] font-semibold text-foreground-600"
                >
                  <span className="text-sm leading-none">{option.emoji}</span>
                  {option.label}
                  <span className="text-foreground-400">· {count}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-foreground-500">
            Nenhum colaborador registrou o sentimento hoje ainda.
          </p>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent-300 bg-accent-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
            <i className="ri-emotion-unhappy-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground-950">
              {alerts.length} colaborador(es) registraram sentimento negativo hoje
            </p>
            <p className="mt-0.5 text-xs text-foreground-600">
              Considere conversar com {alerts.length === 1 ? "ele" : "eles"} — um bom dia pode mudar tudo.
            </p>
          </div>
        </div>
      )}

      {recent.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {recent.map((entry) => {
            const option = getMoodOption(entry.mood);
            const negative = isNegativeMood(entry.mood);
            return (
              <li
                key={entry.id}
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                  negative ? "border-accent-200 bg-accent-50" : "border-background-200 bg-background-100"
                }`}
              >
                <div className="relative shrink-0">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${moodToneChip(entry.mood)}`}
                  >
                    {getInitials(entry.userName)}
                  </span>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-background-50 bg-background-50 text-xs">
                    {option?.emoji ?? "•"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground-950">{entry.userName}</p>
                    <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                      {option?.label ?? "—"}
                    </span>
                    {negative && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-200 px-2 py-0.5 text-[10px] font-bold text-accent-900">
                        <i className="ri-alert-line"></i>
                        Atenção
                      </span>
                    )}
                  </div>
                  {entry.reason && (
                    <p className="mt-1 text-xs italic leading-relaxed text-foreground-600">“{entry.reason}”</p>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-foreground-400">
                  {friendlyMoodDate(entry.moodDate)} · {moodTime(entry.createdAt)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-emotion-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum registro no momento</p>
          <p className="text-xs text-foreground-500">
            Quando o colaborador registrar o sentimento do dia, ele aparece aqui.
          </p>
        </div>
      )}
    </SectionCard>
  );
}