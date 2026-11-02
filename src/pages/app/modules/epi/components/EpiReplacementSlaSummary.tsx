import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEpiReplacementRequests } from "@/pages/app/modules/epi/replacementStore";
import { replacementDeadline } from "@/pages/app/modules/epi/replacementSla";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";

interface EpiReplacementSlaSummaryProps {
  /** Unidade selecionada no dashboard (vazio = todas). */
  unit?: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Resumo de prazos dos pedidos de substituição de EPI.
 *
 * Mostra, no painel do Administrador, quantos pedidos vencem hoje e quantos já
 * atrasaram — usando os prazos por motivo parametrizados em Configurações.
 * Também acompanha o índice de atendimento dentro do prazo.
 */
export default function EpiReplacementSlaSummary({ unit = "" }: EpiReplacementSlaSummaryProps) {
  const requests = useEpiReplacementRequests();
  const { replacementSlaHours } = useSystemSettings();

  const stats = useMemo(() => {
    const scoped = unit ? requests.filter((item) => item.establishment === unit) : requests;
    const decorated = scoped.map((request) => ({
      request,
      deadline: replacementDeadline(request.createdAt, request.reason, replacementSlaHours),
    }));

    const open = decorated.filter(
      ({ request }) => request.status === "Pendente" || request.status === "Em andamento"
    );
    const now = new Date();

    const dueToday = open.filter(
      ({ deadline }) => deadline && !deadline.overdue && isSameDay(deadline.dueAt, now)
    ).length;
    const overdue = open.filter(({ deadline }) => deadline?.overdue).length;
    const dueNextThreeDays = open.filter(
      ({ deadline }) =>
        deadline &&
        !deadline.overdue &&
        !isSameDay(deadline.dueAt, now) &&
        deadline.remainingHours <= 72
    ).length;

    const resolved = decorated.filter(
      ({ request }) => request.status === "Concluída" && request.resolvedAt && request.createdAt
    );
    const onTime = resolved.filter(({ deadline, request }) => {
      if (!deadline) return false;
      const resolvedAt = new Date(request.resolvedAt);
      if (Number.isNaN(resolvedAt.getTime())) return false;
      return resolvedAt.getTime() <= deadline.dueAt.getTime();
    }).length;
    const onTimeRate = resolved.length ? Math.round((onTime / resolved.length) * 100) : null;

    return {
      total: scoped.length,
      open: open.length,
      dueToday,
      overdue,
      dueNextThreeDays,
      onTimeRate,
      resolvedCount: resolved.length,
    };
  }, [requests, unit, replacementSlaHours]);

  if (!stats.total) return null;

  const tiles: {
    id: string;
    label: string;
    value: string;
    hint: string;
    icon: string;
    tone: "primary" | "accent" | "secondary" | "danger";
  }[] = [
    {
      id: "abertos",
      label: "Pedidos em aberto",
      value: `${stats.open}`,
      hint: "aguardando atendimento",
      icon: "ri-time-line",
      tone: "secondary",
    },
    {
      id: "hoje",
      label: "Vencem hoje",
      value: `${stats.dueToday}`,
      hint: stats.dueNextThreeDays
        ? `+${stats.dueNextThreeDays} em até 3 dias`
        : "dentro do prazo de atendimento",
      icon: "ri-calendar-check-line",
      tone: "primary",
    },
    {
      id: "atrasados",
      label: "Já atrasados",
      value: `${stats.overdue}`,
      hint: "fora do prazo de atendimento",
      icon: "ri-alarm-warning-line",
      tone: "danger",
    },
    {
      id: "prazo",
      label: "Atendidos no prazo",
      value: stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`,
      hint: stats.resolvedCount
        ? `${stats.resolvedCount} pedido(s) concluído(s)`
        : "nenhum pedido concluído ainda",
      icon: "ri-shield-check-line",
      tone: "primary",
    },
  ];

  const toneClasses: Record<string, string> = {
    primary: "border-background-200 bg-background-100 text-primary-700",
    secondary: "border-background-200 bg-background-100 text-secondary-800",
    accent: "border-accent-200 bg-accent-50 text-accent-800",
    danger: "border-accent-300 bg-accent-50 text-accent-800",
  };

  return (
    <section className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className="ri-timer-flash-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground-950">Prazos de atendimento de EPI</p>
            <p className="mt-0.5 text-xs text-foreground-500">
              Vencimentos calculados pelos prazos por motivo definidos em Configurações
              {unit ? ` · ${unit}` : ""}.
            </p>
          </div>
        </div>
        <Link
          to="/app/epi"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100"
        >
          <i className="ri-arrow-right-line"></i>
          Abrir pedidos
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`rounded-lg border p-3.5 ${
              tile.id === "atrasados" && stats.overdue > 0
                ? toneClasses.danger
                : "border-background-200 bg-background-100"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-md ${
                tile.id === "atrasados" && stats.overdue > 0
                  ? "bg-accent-200 text-accent-900"
                  : tile.tone === "primary"
                    ? "bg-primary-100 text-primary-700"
                    : "bg-secondary-100 text-secondary-800"
              }`}
            >
              <i className={`${tile.icon} text-base`}></i>
            </span>
            <p className="mt-2.5 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
              {tile.value}
            </p>
            <p className="text-[11px] font-semibold text-foreground-700">{tile.label}</p>
            <p className="mt-0.5 text-[11px] text-foreground-500">{tile.hint}</p>
          </div>
        ))}
      </div>

      {stats.overdue > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-[11px] font-medium text-accent-900">
          <i className="ri-alarm-warning-line mt-0.5"></i>
          {stats.overdue} pedido(s) passaram do prazo de atendimento e aparecem destacados na lista
          de pedidos de substituição, acima dos demais.
        </p>
      )}
    </section>
  );
}