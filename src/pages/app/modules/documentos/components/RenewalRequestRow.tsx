import {
  formatDay,
  formatStamp,
  openTasks,
  renewalIdleInfo,
  renewalProgress,
  renewalSlaInfo,
  renewalStatusMeta,
  type RenewalRequest,
} from "@/pages/app/modules/documentos/renewalStore";

interface RenewalRequestRowProps {
  request: RenewalRequest;
  idleAlertDays: number;
  warningDays: number;
  onOpen: (request: RenewalRequest) => void;
}

/** Cor da faixa lateral: sinaliza urgência antes de ler o conteúdo. */
function accentClass(request: RenewalRequest, late: boolean, dueSoon: boolean): string {
  if (request.status === "concluida") return "bg-primary-300";
  if (late) return "bg-danger-500";
  if (dueSoon) return "bg-accent-500";
  if (request.status === "aberta") return "bg-danger-300";
  return "bg-secondary-300";
}

/**
 * Uma linha da fila de solicitações de renovação.
 *
 * Mostra o número público da solicitação, o andamento da tratativa e o prazo
 * (SLA) com a mesma leitura de urgência usada nos filtros do painel.
 */
export default function RenewalRequestRow({
  request,
  idleAlertDays,
  warningDays,
  onOpen,
}: RenewalRequestRowProps) {
  const meta = renewalStatusMeta[request.status];
  const pending = openTasks(request);
  const progress = renewalProgress(request);
  const sla = renewalSlaInfo(request);
  const idle = renewalIdleInfo(request, idleAlertDays);
  const dueSoon = Boolean(sla && !sla.late && warningDays > 0 && sla.remainingDays <= warningDays);
  const late = Boolean(sla?.late);

  return (
    <li className="relative flex flex-col gap-3 py-3.5 pl-5 pr-4 transition-colors hover:bg-background-100/60 md:pr-5 lg:flex-row lg:items-center">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${accentClass(request, late, dueSoon)}`}
      ></span>

      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          request.status === "concluida"
            ? "bg-primary-100 text-primary-700"
            : request.status === "aberta"
              ? "bg-danger-100 text-danger-800"
              : "bg-secondary-100 text-secondary-800"
        }`}
      >
        <i className={`${meta.icon} text-lg`}></i>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            title={`Número da solicitação: ${request.code || "não numerada"}`}
            className="shrink-0 rounded-md bg-background-100 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-foreground-700 ring-1 ring-inset ring-background-200"
          >
            {request.code || "—"}
          </span>
          <p className="truncate text-sm font-semibold text-foreground-950">{request.documentName}</p>
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}></span>
            {meta.label}
          </span>
          {request.status !== "concluida" && sla && (
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                sla.late
                  ? "bg-danger-100 text-danger-800 ring-1 ring-danger-200"
                  : dueSoon
                    ? "bg-accent-100 text-accent-900"
                    : "bg-background-100 text-foreground-600"
              }`}
              title={`Prazo (SLA) de ${sla.days} dia(s) para concluir`}
            >
              <i className={sla.late ? "ri-alarm-warning-line" : "ri-timer-line"}></i>
              {sla.late
                ? `Atrasada há ${Math.abs(sla.remainingDays)} dia(s)`
                : sla.dueToday
                  ? "Prazo vence hoje"
                  : `Prazo ${formatDay(sla.dueAt)} · ${sla.remainingDays} dia(s)`}
            </span>
          )}
          {request.status !== "concluida" && idle?.idle && (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900"
              title={`Última movimentação em ${formatStamp(idle.lastAt)}`}
            >
              <i className="ri-pause-circle-line"></i>
              Parada há {idle.idleDays} dia(s)
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-[11px] text-foreground-500">
          {request.documentTypeName}
          {request.collaboratorName ? ` · ${request.collaboratorName}` : ""}
          {request.collaboratorCpf ? ` · CPF ${request.collaboratorCpf}` : ""}
          {request.unit ? ` · ${request.unit}` : ""}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium text-foreground-600">
          <span
            className={
              request.ownerName
                ? "inline-flex items-center gap-1"
                : "inline-flex items-center gap-1 text-danger-700"
            }
          >
            <i className={request.ownerName ? "ri-user-star-line" : "ri-user-unfollow-line"}></i>
            {request.ownerName ? `Responsável: ${request.ownerName}` : "Sem responsável"}
          </span>
          {request.delegatedFromName && (
            <span className="inline-flex items-center gap-1 text-foreground-400">
              <i className="ri-git-branch-line"></i>
              delegada por {request.delegatedFromName}
            </span>
          )}
        </p>

        {request.status === "concluida" ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-medium text-foreground-500">
            <span className="inline-flex items-center gap-1">
              <i className="ri-checkbox-circle-line text-primary-600"></i>
              Concluída em {formatStamp(request.completedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-calendar-check-line"></i>
              Nova validade {request.newExpiresAt}
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="ri-attachment-2"></i>
              {request.attachments.length} anexo(s)
            </span>
            {sla && (
              <span
                className={`inline-flex items-center gap-1 ${
                  request.completedAt && new Date(request.completedAt) > new Date(sla.dueAt)
                    ? "text-danger-700"
                    : "text-primary-700"
                }`}
              >
                <i className="ri-alarm-warning-line"></i>
                {request.completedAt && new Date(request.completedAt) > new Date(sla.dueAt)
                  ? "concluída fora do prazo"
                  : "concluída no prazo"}
              </span>
            )}
          </p>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-background-200">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="whitespace-nowrap text-[10px] font-semibold text-foreground-500">
              {request.tasks.length - pending.length}/{request.tasks.length} tarefas
            </span>
            {pending[0] && (
              <span className="hidden min-w-0 truncate text-[10px] text-foreground-400 xl:inline">
                Próxima: {pending[0].label}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpen(request)}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
          request.status === "concluida"
            ? "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
            : request.status === "aberta"
              ? "bg-danger-600 text-background-50 hover:bg-danger-700"
              : "bg-primary-500 text-background-50 hover:bg-primary-600"
        }`}
      >
        <i className={request.status === "concluida" ? "ri-eye-line" : "ri-arrow-right-line"}></i>
        {request.status === "concluida" ? "Ver registro" : "Abrir solicitação"}
      </button>
    </li>
  );
}