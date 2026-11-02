import type { Cipa, CipaAction, CipaAta, CipaElection, CipaMeeting } from "@/mocks/cipa";
import {
  ataSignedCount,
  brDateToTime,
  candidacyState,
  daysUntilBrDate,
  isAtaFullyApproved,
  rankCandidates,
  todayTime,
} from "@/pages/app/modules/cipa/cipaUtils";

/**
 * Alertas do módulo CIPA: reuniões próximas (agendadas), ações atrasadas
 * (prazo vencido ou marcadas como "Atrasada") e atas pendentes de aprovação
 * (presidente/secretário ainda sem assinar). Alimentam o sino do topo e o
 * painel de alertas dos dashboards.
 */
export interface CipaAlert {
  id: string;
  kind: "meeting" | "action" | "approval" | "candidacy" | "result";
  icon: string;
  tone: string;
  title: string;
  detail: string;
  when: string;
  to: string;
}

/**
 * Processos eleitorais com inscrições abertas. Os que estão perto de encerrar
 * (prazo em até 3 dias) ganham destaque para não passarem batido.
 */
export function candidacyAlerts(elections: CipaElection[], nameOf: (id: string) => string): CipaAlert[] {
  return elections
    .map((e) => ({ election: e, state: candidacyState(e) }))
    .filter(({ state }) => state.phase === "aberta")
    .sort((a, b) => a.state.daysLeft - b.state.daysLeft)
    .map(({ election: e, state: st }) => {
      const nearClosing = st.daysLeft <= 3;
      return {
        id: `cipa-candidacy-${e.id}`,
        kind: "candidacy" as const,
        icon: nearClosing ? "ri-alarm-warning-line" : "ri-megaphone-line",
        tone: nearClosing ? "text-accent-700" : "text-secondary-700",
        title: nearClosing ? `Inscrições encerrando: ${e.title}` : `Inscrições abertas: ${e.title}`,
        detail: `${nameOf(e.cipaId)} · ${e.candidates.length} inscrito(s) · prazo até ${st.end}`,
        when:
          st.daysLeft > 0 ? (nearClosing ? `encerra em ${st.daysLeft} dia(s)` : `aberta · ${st.daysLeft} dia(s)`) : "último dia",
        to: "/app/cipa",
      };
    });
}

/**
 * Processos eleitorais cujo Edital de Resultado já foi publicado. Destaca os
 * nomes dos colaboradores eleitos (titulares e suplentes), para que a
 * publicação não passe batido.
 */
export function publishedResultAlerts(elections: CipaElection[], nameOf: (id: string) => string): CipaAlert[] {
  return elections
    .filter((e) => e.status === "Publicada")
    .map((e) => {
      const ranking = rankCandidates(e);
      const elected = ranking.filter((r) => r.seat === "titular" || r.seat === "suplente");
      const names = elected.slice(0, 4).map((r) => r.candidate.name);
      const extra = elected.length - names.length;
      const detail = elected.length
        ? `Eleitos: ${names.join(", ")}${extra > 0 ? ` +${extra}` : ""} · ${nameOf(e.cipaId)}`
        : `${nameOf(e.cipaId)} · resultados da apuração publicados`;
      return {
        id: `cipa-result-${e.id}`,
        kind: "result" as const,
        icon: "ri-award-line",
        tone: "text-primary-600",
        title: `Resultado publicado: ${e.title}`,
        detail,
        when: "publicado",
        to: "/app/cipa",
      };
    });
}

export function upcomingCipaMeetings(meetings: CipaMeeting[], limit = 4): CipaMeeting[] {
  return meetings
    .filter((m) => m.status === "Agendada")
    .sort((a, b) => brDateToTime(a.date) - brDateToTime(b.date))
    .slice(0, limit);
}

export function overdueCipaActions(actions: CipaAction[]): CipaAction[] {
  const now = todayTime();
  return actions
    .filter((a) => a.status !== "Concluída" && (a.status === "Atrasada" || (a.dueDate && brDateToTime(a.dueDate) < now)))
    .sort((a, b) => brDateToTime(a.dueDate) - brDateToTime(b.dueDate));
}

/** Atas que ainda aguardam a assinatura de aprovação (presidente/secretário). */
export function pendingApprovalAtas(atas: CipaAta[]): CipaAta[] {
  return atas
    .filter((ata) => !isAtaFullyApproved(ata))
    .sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date));
}

function relativeWhen(date: string): string {
  const days = daysUntilBrDate(date);
  if (!date) return "sem prazo";
  if (days < 0) return `venceu há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

export function buildCipaAlerts(
  cipas: Cipa[],
  meetings: CipaMeeting[],
  actions: CipaAction[],
  atas: CipaAta[] = [],
  elections: CipaElection[] = []
): CipaAlert[] {
  const nameOf = (id: string) => cipas.find((c) => c.id === id)?.name || "CIPA";

  const candidacyList = candidacyAlerts(elections, nameOf);
  const resultList = publishedResultAlerts(elections, nameOf);

  const meetingAlerts: CipaAlert[] = upcomingCipaMeetings(meetings).map((m) => ({
    id: `cipa-meeting-${m.id}`,
    kind: "meeting",
    icon: "ri-calendar-event-line",
    tone: "text-accent-700",
    title: m.title,
    detail: `${nameOf(m.cipaId)} · ${m.date}${m.time ? ` às ${m.time}` : ""} · ${m.location || "local a definir"}`,
    when: relativeWhen(m.date),
    to: "/app/cipa",
  }));

  const actionAlerts: CipaAlert[] = overdueCipaActions(actions).map((a) => ({
    id: `cipa-action-${a.id}`,
    kind: "action",
    icon: "ri-alarm-warning-line",
    tone: "text-accent-700",
    title: a.title,
    detail: `${nameOf(a.cipaId)} · responsável: ${a.responsible || "—"}`,
    when: relativeWhen(a.dueDate),
    to: "/app/cipa",
  }));

  const approvalAlerts: CipaAlert[] = pendingApprovalAtas(atas).map((ata) => ({
    id: `cipa-approval-${ata.id}`,
    kind: "approval",
    icon: "ri-quill-pen-line",
    tone: "text-primary-600",
    title: `Ata aguardando aprovação: ${ata.title}`,
    detail: `${nameOf(ata.cipaId)} · ${ata.date} · ${ataSignedCount(ata)}/${ata.approvals.length} assinatura(s)`,
    when: "pendente",
    to: "/app/cipa",
  }));

  return [...candidacyList, ...resultList, ...approvalAlerts, ...meetingAlerts, ...actionAlerts];
}