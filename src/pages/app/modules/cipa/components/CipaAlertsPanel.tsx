import { Link } from "react-router-dom";
import { useActions, useAtas, useCipas, useElections, useMeetings } from "@/pages/app/modules/cipa/cipaStore";
import { buildCipaAlerts } from "@/pages/app/modules/cipa/cipaAlerts";

/**
 * Painel de alertas da CIPA exibido nos dashboards.
 * Reúne as reuniões agendadas (próximas), as ações atrasadas e as atas
 * aguardando aprovação, com atalho direto para o módulo. Não aparece quando
 * não há nada que exija atenção.
 */
export default function CipaAlertsPanel() {
  const cipas = useCipas();
  const meetings = useMeetings();
  const actions = useActions();
  const atas = useAtas();
  const elections = useElections();

  const alerts = buildCipaAlerts(cipas, meetings, actions, atas, elections);
  if (alerts.length === 0) return null;

  const candidacyCount = alerts.filter((a) => a.kind === "candidacy").length;
  const resultsCount = alerts.filter((a) => a.kind === "result").length;
  const meetingsCount = alerts.filter((a) => a.kind === "meeting").length;
  const actionsCount = alerts.filter((a) => a.kind === "action").length;
  const approvalsCount = alerts.filter((a) => a.kind === "approval").length;

  const summary: string[] = [];
  if (candidacyCount > 0) summary.push(`${candidacyCount} candidatura(s) com inscrições abertas`);
  if (resultsCount > 0) summary.push(`${resultsCount} resultado(s) publicado(s)`);
  if (approvalsCount > 0) summary.push(`${approvalsCount} ata(s) aguardando aprovação`);
  if (meetingsCount > 0) summary.push(`${meetingsCount} reunião(ões) agendada(s)`);
  if (actionsCount > 0) summary.push(`${actionsCount} ação(ões) atrasada(s)`);

  return (
    <section className="rounded-lg border border-accent-300 bg-accent-50 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-government-line text-xl"></i>
          </span>
          <div>
            <h3 className="font-heading text-base font-bold text-foreground-950">CIPA · Atenção necessária</h3>
            <p className="mt-1 text-xs text-foreground-600">
              {summary.join(" · ")}
            </p>
          </div>
        </div>
        <Link
          to="/app/cipa"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600"
        >
          <i className="ri-arrow-right-line"></i>
          Abrir CIPA
        </Link>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {alerts.map((alert) => (
          <li key={alert.id}>
            <Link
              to={alert.to}
              className="flex items-center gap-3 rounded-lg border border-accent-200 bg-background-50 px-4 py-3 transition-colors hover:bg-background-100"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 ${alert.tone}`}>
                <i className={`${alert.icon} text-lg`}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-950">{alert.title}</p>
                <p className="truncate text-xs text-foreground-500">{alert.detail}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
                {alert.when}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}