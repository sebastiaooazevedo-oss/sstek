import { supabase } from "@/lib/supabase";
import type { Collaborator } from "@/mocks/collaborators";
import type { DocumentRecord } from "@/mocks/documents";
import { daysUntilExpiry } from "@/pages/app/modules/documentos/documentUtils";
import {
  alertRecipients,
  type DocumentExpiryAlertConfig,
} from "@/pages/app/modules/documentos/documentExpiryAlertStore";

/**
 * Dispara o aviso de vencimento por e-mail.
 *
 * O e-mail vai em "grupos": um para o SESMT (e demais e-mails cadastrados) e um
 * para cada gestor/líder responsável, contendo **apenas** os documentos dos
 * colaboradores da equipe dele. Assim o gestor não recebe a base inteira.
 *
 * Cada documento é avisado uma única vez por validade e por destinatário: o
 * registro fica em `document_expiry_notifications` (documento + validade +
 * destinatário). Ao renovar a validade, um novo aviso é gerado.
 *
 * O envio acontece na Edge Function `notify-document-expiry`, que guarda a
 * chave do Resend e gera o PDF anexo no backend.
 */
export type ExpiryEmailStatus =
  | "sent"
  | "nothing-new"
  | "no-recipients"
  | "disabled"
  | "resend-not-configured"
  | "error";

export interface ExpiryEmailResult {
  status: ExpiryEmailStatus;
  count: number;
  recipients: string[];
  message: string;
}

interface SentNotificationRow {
  document_ref: string | null;
  expires_at: string | null;
  recipient: string | null;
}

interface EmailDocumentItem {
  name: string;
  typeName: string;
  expiresAt: string;
  days: number;
  collaboratorName: string;
  establishment: string;
}

interface AlertGroup {
  key: string;
  label: string;
  recipients: string[];
  attachPdf: boolean;
  entries: { doc: DocumentRecord; days: number }[];
}

const SESMT_GROUP_KEY = "__sesmt__";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sentKey(documentRef: string, expiresAt: string, recipientKey: string): string {
  return `${documentRef}|${expiresAt}|${recipientKey}`;
}

/** Documentos dentro da janela de aviso (vencidos incluídos). */
export function documentsInExpiryWindow(
  documents: DocumentRecord[],
  daysBefore: number
): { doc: DocumentRecord; days: number }[] {
  const windowDays = Math.max(1, Math.round(daysBefore));
  return documents
    .map((doc) => ({ doc, days: daysUntilExpiry(doc.expiresAt) }))
    .filter((entry): entry is { doc: DocumentRecord; days: number } =>
      entry.days !== null && entry.days <= windowDays
    )
    .sort((a, b) => a.days - b.days);
}

/**
 * Gestor/líder responsável pelo colaborador dono do documento.
 * O vínculo é o `managerId` do cadastro de colaboradores.
 */
export function managerOfDocument(
  doc: DocumentRecord,
  collaborators: Collaborator[]
): Collaborator | null {
  if (!doc.collaboratorId) return null;
  const collaborator = collaborators.find((c) => c.id === doc.collaboratorId);
  if (!collaborator?.managerId) return null;
  const manager = collaborators.find((c) => c.id === collaborator.managerId);
  if (!manager) return null;
  if (!EMAIL_PATTERN.test((manager.email || "").trim())) return null;
  return manager;
}

/** Gestores que receberiam aviso hoje, com a quantidade de documentos de cada um. */
export function managersInScope(
  documents: DocumentRecord[],
  collaborators: Collaborator[],
  daysBefore: number
): { name: string; email: string; count: number }[] {
  const byManager = new Map<string, { name: string; email: string; count: number }>();
  documentsInExpiryWindow(documents, daysBefore).forEach(({ doc }) => {
    const manager = managerOfDocument(doc, collaborators);
    if (!manager) return;
    const email = manager.email.trim().toLowerCase();
    const entry = byManager.get(email);
    if (entry) entry.count += 1;
    else byManager.set(email, { name: manager.name, email, count: 1 });
  });
  return Array.from(byManager.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function loadSentKeys(resendAll: boolean): Promise<Set<string>> {
  if (resendAll) return new Set();
  try {
    const { data } = await supabase
      .from("document_expiry_notifications")
      .select("document_ref, expires_at, recipient");
    return new Set(
      ((data ?? []) as SentNotificationRow[])
        .filter((row) => row.document_ref && row.expires_at)
        .map((row) =>
          sentKey(
            String(row.document_ref),
            String(row.expires_at),
            String(row.recipient || SESMT_GROUP_KEY)
          )
        )
    );
  } catch {
    return new Set();
  }
}

function toEmailItems(
  entries: { doc: DocumentRecord; days: number }[],
  collaborators: Collaborator[] = []
): EmailDocumentItem[] {
  const unitByCollaborator = new Map<string, string>();
  collaborators.forEach((collaborator) => {
    if (collaborator.establishment) unitByCollaborator.set(collaborator.id, collaborator.establishment);
  });

  return entries.map(({ doc, days }) => ({
    name: doc.name,
    typeName: doc.typeName,
    expiresAt: doc.expiresAt,
    days,
    collaboratorName: doc.collaboratorName || "",
    // O PDF é agrupado por unidade: usa a unidade própria do documento ou, na
    // falta dela, a unidade do cadastro do colaborador.
    establishment:
      doc.establishment || (doc.collaboratorId ? unitByCollaborator.get(doc.collaboratorId) || "" : ""),
  }));
}

export async function sendDocumentExpiryAlerts(options: {
  documents: DocumentRecord[];
  config: DocumentExpiryAlertConfig;
  companyName: string;
  collaborators?: Collaborator[];
  /** Reenvia mesmo os documentos já avisados (usado na verificação manual). */
  resendAll?: boolean;
}): Promise<ExpiryEmailResult> {
  const { documents, config, companyName, collaborators = [], resendAll = false } = options;

  if (!config.enabled && !resendAll) {
    return {
      status: "disabled",
      count: 0,
      recipients: [],
      message: "O envio automático de avisos por e-mail está desativado na parametrização.",
    };
  }

  const recipients = alertRecipients(config);
  if (recipients.length === 0) {
    return {
      status: "no-recipients",
      count: 0,
      recipients,
      message: "Cadastre o e-mail do SESMT (ou outro e-mail) para receber os alertas de vencimento.",
    };
  }

  const inWindow = documentsInExpiryWindow(documents, config.daysBefore);
  if (inWindow.length === 0) {
    return {
      status: "nothing-new",
      count: 0,
      recipients,
      message: `Nenhum documento vencido ou vencendo nos próximos ${config.daysBefore} dias.`,
    };
  }

  const alreadySent = await loadSentKeys(resendAll);
  const groups: AlertGroup[] = [];

  const sesmtEntries = inWindow.filter(
    ({ doc }) => !alreadySent.has(sentKey(doc.id, doc.expiresAt, SESMT_GROUP_KEY))
  );
  if (sesmtEntries.length > 0) {
    groups.push({
      key: SESMT_GROUP_KEY,
      label: "SESMT",
      recipients,
      attachPdf: config.attachPdf,
      entries: sesmtEntries,
    });
  }

  if (config.notifyManagers && collaborators.length > 0) {
    const byManager = new Map<string, AlertGroup>();
    inWindow.forEach((entry) => {
      const manager = managerOfDocument(entry.doc, collaborators);
      if (!manager) return;
      const email = manager.email.trim().toLowerCase();
      if (alreadySent.has(sentKey(entry.doc.id, entry.doc.expiresAt, email))) return;
      const existing = byManager.get(email);
      if (existing) {
        existing.entries.push(entry);
      } else {
        byManager.set(email, {
          key: email,
          label: manager.name,
          recipients: [email],
          attachPdf: false,
          entries: [entry],
        });
      }
    });
    byManager.forEach((group) => groups.push(group));
  }

  if (groups.length === 0) {
    return {
      status: "nothing-new",
      count: 0,
      recipients,
      message: "Todos os documentos da janela de aviso já foram notificados por e-mail.",
    };
  }

  const payloadGroups = groups.map((group) => ({
    label: group.label,
    key: group.key,
    recipients: group.recipients,
    attachPdf: group.attachPdf,
    documents: toEmailItems(group.entries, collaborators),
  }));

  try {
    const { data, error } = await supabase.functions.invoke("notify-document-expiry", {
      body: {
        mode: "expiry",
        daysBefore: config.daysBefore,
        companyName,
        attachPdf: config.attachPdf,
        groups: payloadGroups,
      },
    });
    if (error) throw error;

    const result = (data ?? {}) as { sent?: boolean; reason?: string };
    if (result.sent !== true) {
      if (result.reason === "resend-not-configured") {
        return {
          status: "resend-not-configured",
          count: 0,
          recipients,
          message:
            "O envio de e-mail ainda não está configurado no backend (Resend). Os avisos ficam registrados na tela até a configuração ser concluída.",
        };
      }
      return {
        status: "error",
        count: 0,
        recipients,
        message: "Não foi possível enviar o e-mail de aviso. Tente novamente em instantes.",
      };
    }

    const rows = groups.flatMap((group) =>
      group.entries.map(({ doc, days }) => ({
        document_ref: doc.id,
        expires_at: doc.expiresAt,
        days_before: days,
        recipients: group.recipients.join(", "),
        recipient: group.key,
      }))
    );
    try {
      await supabase
        .from("document_expiry_notifications")
        .upsert(rows, { onConflict: "document_ref,expires_at,recipient" });
    } catch {
      /* o envio já aconteceu; o registro evita duplicidade na próxima varredura */
    }

    const managerGroups = groups.filter((group) => group.key !== SESMT_GROUP_KEY);
    const documentsCount = inWindow.length;
    const managerNote =
      managerGroups.length > 0
        ? ` O gestor responsável também foi avisado (${managerGroups.length}).`
        : "";
    const pdfNote = config.attachPdf ? " Lista completa anexada em PDF, agrupada por unidade." : "";

    return {
      status: "sent",
      count: documentsCount,
      recipients: Array.from(new Set(groups.flatMap((group) => group.recipients))),
      message: `Aviso enviado para ${recipients.length} destinatário(s) com ${documentsCount} documento(s) vencido(s) ou a vencer.${managerNote}${pdfNote}`,
    };
  } catch {
    return {
      status: "error",
      count: 0,
      recipients,
      message: "Não foi possível enviar o e-mail de aviso. Verifique a conexão e tente novamente.",
    };
  }
}