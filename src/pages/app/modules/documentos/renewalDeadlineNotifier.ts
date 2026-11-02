import { supabase } from "@/lib/supabase";
import {
  registerRenewalDeadlineNotices,
  renewalDueSoonInfo,
  renewalLastActivity,
  renewalSlaInfo,
  type RenewalNoticeAudience,
  type RenewalRequest,
} from "@/pages/app/modules/documentos/renewalStore";

/**
 * Aviso automático de prazo de renovação por e-mail.
 *
 * Há dois públicos com janelas independentes (parametrizadas em
 * Configurações › Prazo (SLA) de renovação de documentos):
 *
 * - **gestor** — usa `documentRenewalManagerWarningDays`;
 * - **responsável da tratativa** — usa `documentRenewalSlaWarningDays`.
 *
 * O e-mail sai no início da janela de cada público: no primeiro acesso do dia,
 * quando a tratativa entra na janela, cada destinatário recebe **um** aviso por
 * data-limite. O controle fica em `document_renewal_deadline_notifications`
 * (solicitação + data-limite + público + destinatário), então reabrir a tela
 * não duplica e-mails e renovar o prazo gera um aviso novo.
 *
 * **Escalonamento:** se, `documentRenewalEscalationDays` dias depois de um aviso
 * a tratativa continuar sem nenhuma movimentação, o gestor é avisado novamente.
 * Um escalonamento por data-limite.
 *
 * Todo aviso efetivamente enviado também é gravado no histórico da tratativa
 * (destinatário, público e data), para ficar rastreável no modal.
 *
 * O envio acontece na Edge Function `notify-renewal-deadline`, que guarda a
 * chave do Resend no backend.
 */

export type RenewalAudience = "gestor" | "responsavel";

export type RenewalDeadlineStatus =
  | "sent"
  | "nothing-new"
  | "disabled"
  | "resend-not-configured"
  | "error";

export interface RenewalDeadlineResult {
  status: RenewalDeadlineStatus;
  /** Solicitações avisadas (somando os públicos). */
  count: number;
  /** E-mails enviados. */
  emails: number;
  /** Reavisos de escalonamento enviados ao gestor. */
  escalations: number;
  message: string;
}

interface SentNotificationRow {
  request_ref: string | null;
  due_at: string | null;
  audience: string | null;
  recipient: string | null;
  sent_at: string | null;
}

interface DeadlineCandidate {
  request: RenewalRequest;
  recipient: string;
  label: string;
  remainingDays: number;
}

interface EscalationCandidate extends DeadlineCandidate {
  /** Dias desde o último aviso de prazo. */
  daysSinceNotice: number;
}

interface AudienceGroup {
  audience: RenewalNoticeAudience;
  recipient: string;
  label: string;
  entries: { request: RenewalRequest; recipient: string; label: string; remainingDays: number }[];
}

const TABLE = "document_renewal_deadline_notifications";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sentKey(
  requestRef: string,
  dueAt: string,
  audience: string,
  recipient: string
): string {
  return `${requestRef}|${dueAt}|${audience}|${recipient}`.toLowerCase();
}

function audienceEmail(request: RenewalRequest, audience: RenewalAudience): string {
  const raw = audience === "gestor" ? request.managerEmail : request.ownerEmail;
  const email = String(raw ?? "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : "";
}

function audienceLabel(request: RenewalRequest, audience: RenewalAudience): string {
  if (audience === "gestor") return (request.managerName || "").trim() || "Gestor";
  return (request.ownerName || "").trim() || "Responsável";
}

/** Tratativas dentro da janela de aviso de um público, com o e-mail do destinatário. */
export function renewalDeadlineCandidates(
  requests: RenewalRequest[],
  audience: RenewalAudience,
  warningDays: number,
  now = new Date()
): DeadlineCandidate[] {
  const window = Math.max(0, Math.round(warningDays));
  if (window === 0) return [];
  return requests
    .filter((request) => request.status !== "concluida")
    .map((request) => {
      const soon = renewalDueSoonInfo(request, window, now);
      const recipient = audienceEmail(request, audience);
      if (!soon?.dueSoon || !recipient) return null;
      return {
        request,
        recipient,
        label: audienceLabel(request, audience),
        remainingDays: soon.remainingDays,
      };
    })
    .filter((entry): entry is DeadlineCandidate => Boolean(entry))
    .sort((a, b) => a.remainingDays - b.remainingDays);
}

/**
 * Tratativas que precisam de escalonamento: já receberam um aviso de prazo,
 * passaram `escalationDays` dias sem nenhuma movimentação e continuam abertas.
 *
 * Conta como movimentação tudo que a pessoa faz na tratativa (assumir, delegar,
 * agendar, comunicar, anexar, concluir tarefa). O próprio e-mail de aviso não
 * conta — senão o escalonamento nunca dispararia.
 */
export function renewalEscalationCandidates(
  requests: RenewalRequest[],
  escalationDays: number,
  rows: SentNotificationRow[],
  now = new Date()
): EscalationCandidate[] {
  const window = Math.max(0, Math.round(escalationDays));
  if (window === 0) return [];

  // Último aviso de prazo por solicitação + data-limite (ignora escalonamentos).
  const baseline = new Map<string, number>();
  const escalated = new Set<string>();
  rows.forEach((row) => {
    if (!row.request_ref || !row.due_at || !row.sent_at) return;
    const key = `${row.request_ref}|${row.due_at}`.toLowerCase();
    const time = new Date(row.sent_at).getTime();
    if (row.audience === "escalonamento") {
      escalated.add(key);
      return;
    }
    if (Number.isNaN(time)) return;
    const current = baseline.get(key) ?? 0;
    if (time > current) baseline.set(key, time);
  });

  return requests
    .filter((request) => request.status !== "concluida")
    .map((request) => {
      const recipient = audienceEmail(request, "gestor");
      if (!recipient) return null;
      const key = `${request.id}|${request.dueAt}`.toLowerCase();
      if (escalated.has(key)) return null;
      const baselineTime = baseline.get(key);
      if (!baselineTime) return null;

      const lastActivity = renewalLastActivity(request);
      const lastTime = lastActivity ? new Date(lastActivity).getTime() : 0;
      // Movimentou depois do aviso: não escala.
      if (lastTime > baselineTime + 1500) return null;

      const daysSinceNotice = Math.floor((now.getTime() - baselineTime) / 86400000);
      if (daysSinceNotice < window) return null;

      const sla = renewalSlaInfo(request, now);
      return {
        request,
        recipient,
        label: audienceLabel(request, "gestor"),
        remainingDays: sla ? sla.remainingDays : 0,
        daysSinceNotice,
      };
    })
    .filter((entry): entry is EscalationCandidate => Boolean(entry))
    .sort((a, b) => b.daysSinceNotice - a.daysSinceNotice);
}

async function loadSentRows(): Promise<SentNotificationRow[]> {
  try {
    const { data } = await supabase
      .from(TABLE)
      .select("request_ref, due_at, audience, recipient, sent_at");
    return (data ?? []) as SentNotificationRow[];
  } catch {
    // Sem o registro, o envio segue: o pior cenário é um aviso repetido.
    return [];
  }
}

function buildGroups(
  candidates: DeadlineCandidate[],
  audience: RenewalNoticeAudience
): AudienceGroup[] {
  const byRecipient = new Map<string, AudienceGroup>();
  candidates.forEach((candidate) => {
    const existing = byRecipient.get(candidate.recipient);
    const entry = {
      request: candidate.request,
      recipient: candidate.recipient,
      label: candidate.label,
      remainingDays: candidate.remainingDays,
    };
    if (existing) {
      existing.entries.push(entry);
      return;
    }
    byRecipient.set(candidate.recipient, {
      audience,
      recipient: candidate.recipient,
      label: candidate.label,
      entries: [entry],
    });
  });
  return Array.from(byRecipient.values());
}

function toEmailItems(group: AudienceGroup) {
  return group.entries.map(({ request, remainingDays }) => {
    const sla = renewalSlaInfo(request);
    return {
      requestId: request.id,
      documentName: request.documentName,
      documentTypeName: request.documentTypeName,
      collaboratorName: request.collaboratorName || "",
      ownerName: request.ownerName || "",
      managerName: request.managerName || "",
      unit: request.unit || "",
      dueAt: request.dueAt || (sla ? sla.dueAt : ""),
      slaDays: request.slaDays,
      remainingDays,
    };
  });
}

export async function sendRenewalDeadlineAlerts(options: {
  requests: RenewalRequest[];
  companyName: string;
  managerWarningDays: number;
  ownerWarningDays: number;
  escalationDays?: number;
}): Promise<RenewalDeadlineResult> {
  const {
    requests,
    companyName,
    managerWarningDays,
    ownerWarningDays,
    escalationDays = 0,
  } = options;
  const managerWindow = Math.max(0, Math.round(managerWarningDays));
  const ownerWindow = Math.max(0, Math.round(ownerWarningDays));
  const escalationWindow = Math.max(0, Math.round(escalationDays));

  if (managerWindow === 0 && ownerWindow === 0) {
    return {
      status: "disabled",
      count: 0,
      emails: 0,
      escalations: 0,
      message:
        "O aviso automático de prazo está desligado para os dois públicos (gestor e responsável) na parametrização.",
    };
  }

  const managerCandidates = renewalDeadlineCandidates(requests, "gestor", managerWindow);
  const ownerCandidates = renewalDeadlineCandidates(requests, "responsavel", ownerWindow);
  const sentRows = await loadSentRows();
  const escalationCandidates =
    escalationWindow > 0
      ? renewalEscalationCandidates(requests, escalationWindow, sentRows)
      : [];

  if (
    managerCandidates.length === 0 &&
    ownerCandidates.length === 0 &&
    escalationCandidates.length === 0
  ) {
    const windows = [
      managerWindow > 0 ? `gestor ${managerWindow} dia(s)` : "",
      ownerWindow > 0 ? `responsável ${ownerWindow} dia(s)` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      status: "nothing-new",
      count: 0,
      emails: 0,
      escalations: 0,
      message: `Nenhuma tratativa dentro das janelas de aviso (${windows}).`,
    };
  }

  const alreadySent = new Set(
    sentRows
      .filter((row) => row.request_ref && row.due_at && row.audience && row.recipient)
      .map((row) =>
        sentKey(
          String(row.request_ref),
          String(row.due_at),
          String(row.audience),
          String(row.recipient)
        )
      )
  );

  const isNew = (group: AudienceGroup, entry: { request: RenewalRequest }) =>
    !alreadySent.has(
      sentKey(entry.request.id, entry.request.dueAt || "", group.audience, group.recipient)
    );

  const pendingGroups: AudienceGroup[] = [];
  buildGroups(managerCandidates, "gestor").forEach((group) => {
    const entries = group.entries.filter((entry) => isNew(group, entry));
    if (entries.length > 0) pendingGroups.push({ ...group, entries });
  });
  buildGroups(ownerCandidates, "responsavel").forEach((group) => {
    const entries = group.entries.filter((entry) => isNew(group, entry));
    if (entries.length > 0) pendingGroups.push({ ...group, entries });
  });
  buildGroups(escalationCandidates, "escalonamento").forEach((group) => {
    const entries = group.entries.filter((entry) => isNew(group, entry));
    if (entries.length > 0) pendingGroups.push({ ...group, entries });
  });

  if (pendingGroups.length === 0) {
    return {
      status: "nothing-new",
      count: 0,
      emails: 0,
      escalations: 0,
      message:
        "As tratativas dentro da janela de prazo já foram avisadas por e-mail. Um novo aviso só sai se a data-limite mudar ou se houver um escalonamento.",
    };
  }

  const payload = pendingGroups.map((group) => ({
    audience: group.audience,
    recipient: group.recipient,
    label: group.label,
    requests: toEmailItems(group),
  }));

  try {
    const { data, error } = await supabase.functions.invoke("notify-renewal-deadline", {
      body: { companyName: companyName || "Sua empresa", groups: payload },
    });
    if (error) throw error;

    const result = (data ?? {}) as {
      sent?: boolean;
      sentCount?: number;
      reason?: string;
      sentEmails?: string[];
    };

    if (result.reason === "resend-not-configured") {
      return {
        status: "resend-not-configured",
        count: 0,
        emails: 0,
        escalations: 0,
        message:
          "O envio de e-mail ainda não está configurado no backend (Resend). Os avisos continuam aparecendo no sino até a configuração ser concluída.",
      };
    }

    if (result.sent !== true) {
      return {
        status: "error",
        count: 0,
        emails: 0,
        escalations: 0,
        message: "Não foi possível enviar os e-mails de aviso de prazo. Tente novamente em instantes.",
      };
    }

    const sentEmails = Array.isArray(result.sentEmails)
      ? result.sentEmails.map((email) => String(email).toLowerCase())
      : pendingGroups.map((group) => group.recipient);

    const deliveredGroups = pendingGroups.filter((group) =>
      sentEmails.includes(group.recipient.toLowerCase())
    );

    const sentAt = new Date().toISOString();
    const rows = deliveredGroups.flatMap((group) =>
      group.entries.map((entry) => ({
        request_ref: entry.request.id,
        due_at: entry.request.dueAt || "",
        audience: group.audience,
        recipient: group.recipient,
        remaining_days: entry.remainingDays,
      }))
    );

    if (rows.length > 0) {
      try {
        await supabase.from(TABLE).upsert(rows, {
          onConflict: "request_ref,due_at,audience,recipient",
        });
      } catch {
        // O envio já aconteceu; o registro apenas evita repetição na próxima varredura.
      }
    }

    // Histórico da tratativa: destinatário, público e data.
    registerRenewalDeadlineNotices(
      deliveredGroups.flatMap((group) =>
        group.entries.map((entry) => ({
          requestId: entry.request.id,
          audience: group.audience,
          recipient: group.recipient,
          recipientName: group.label,
          dueAt: entry.request.dueAt || "",
          remainingDays: entry.remainingDays,
          sentAt,
        }))
      ),
      "Sistema (aviso automático)"
    );

    const addressed = new Set(rows.map((row) => row.request_ref));
    const emails = new Set(rows.map((row) => row.recipient));
    const escalations = rows.filter((row) => row.audience === "escalonamento").length;

    return {
      status: "sent",
      count: addressed.size,
      emails: emails.size,
      escalations,
      message:
        escalations > 0
          ? `Aviso de prazo enviado para ${emails.size} destinatário(s), cobrindo ${addressed.size} tratativa(s). ${escalations} escalonamento(s) ao gestor por falta de movimentação.`
          : `Aviso de prazo enviado para ${emails.size} destinatário(s), cobrindo ${addressed.size} tratativa(s) na janela de vencimento.`,
    };
  } catch {
    return {
      status: "error",
      count: 0,
      emails: 0,
      escalations: 0,
      message: "Não foi possível enviar os e-mails de aviso de prazo. Verifique a conexão e tente novamente.",
    };
  }
}