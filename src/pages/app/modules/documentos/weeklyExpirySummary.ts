import { supabase } from "@/lib/supabase";
import type { DocumentRecord } from "@/mocks/documents";
import { daysUntilExpiry } from "@/pages/app/modules/documentos/documentUtils";
import {
  alertRecipients,
  saveDocumentExpiryAlertConfig,
  type DocumentExpiryAlertConfig,
} from "@/pages/app/modules/documentos/documentExpiryAlertStore";

/**
 * Resumo semanal de vencimentos enviado ao SESMT.
 *
 * Reúne o que venceu (ainda pendente) e o que vence nos próximos 7 dias. O
 * disparo acontece quando a gestão abre a área de Documentos no dia da semana
 * parametrizado (ou depois dele) e desde que o último resumo tenha mais de 6
 * dias — assim a caixa do SESMT não recebe o mesmo resumo duas vezes.
 *
 * A geração do PDF anexo e o envio pelo Resend acontecem na Edge Function
 * `notify-document-expiry` (modo "weekly").
 */
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
];

export type WeeklySummaryStatus =
  | "sent"
  | "disabled"
  | "not-due"
  | "empty"
  | "no-recipients"
  | "resend-not-configured"
  | "error";

export interface WeeklySummaryResult {
  status: WeeklySummaryStatus;
  count: number;
  recipients: string[];
  message: string;
}

interface WeeklyDocumentItem {
  name: string;
  typeName: string;
  expiresAt: string;
  days: number;
  collaboratorName: string;
  establishment: string;
}

function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/** Documentos que entram no resumo semanal: vencidos + vencendo em até 7 dias. */
export function weeklySummaryDocuments(documents: DocumentRecord[]): {
  doc: DocumentRecord;
  days: number;
}[] {
  return documents
    .map((doc) => ({ doc, days: daysUntilExpiry(doc.expiresAt) }))
    .filter((entry): entry is { doc: DocumentRecord; days: number } => {
      if (entry.days === null) return false;
      return entry.days < 0 || entry.days <= 7;
    })
    .sort((a, b) => a.days - b.days);
}

/** O resumo está no dia (ou depois) e já passaram 6 dias desde o último envio? */
export function isWeeklySummaryDue(
  config: DocumentExpiryAlertConfig,
  now: Date = new Date()
): boolean {
  if (!config.weeklySummary) return false;
  if (isoWeekday(now) < config.weeklyWeekday) return false;
  if (!config.weeklyLastSentAt) return true;
  const last = new Date(config.weeklyLastSentAt);
  if (Number.isNaN(last.getTime())) return true;
  const daysSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 6;
}

/** Texto curto do próximo resumo, para exibir na parametrização. */
export function weeklyScheduleLabel(config: DocumentExpiryAlertConfig): string {
  if (!config.weeklySummary) return "Resumo semanal desativado";
  const weekday = WEEKDAY_OPTIONS.find((option) => option.value === config.weeklyWeekday);
  const base = `Toda ${weekday?.label.toLowerCase() || "segunda-feira"}`;
  if (!config.weeklyLastSentAt) return `${base} — nenhum resumo enviado ainda`;
  const last = new Date(config.weeklyLastSentAt);
  if (Number.isNaN(last.getTime())) return `${base} — nenhum resumo enviado ainda`;
  return `${base} — último envio em ${last.toLocaleDateString("pt-BR")}`;
}

export async function sendWeeklyExpirySummary(options: {
  documents: DocumentRecord[];
  config: DocumentExpiryAlertConfig;
  companyName: string;
  /** Ignora a regra de periodicidade (botão "enviar agora"). */
  force?: boolean;
}): Promise<WeeklySummaryResult> {
  const { documents, config, companyName, force = false } = options;

  if (!config.weeklySummary && !force) {
    return {
      status: "disabled",
      count: 0,
      recipients: [],
      message: "O resumo semanal está desativado na parametrização.",
    };
  }

  const recipients = alertRecipients(config);
  if (recipients.length === 0) {
    return {
      status: "no-recipients",
      count: 0,
      recipients,
      message: "Cadastre o e-mail do SESMT para receber o resumo semanal.",
    };
  }

  const entries = weeklySummaryDocuments(documents);
  if (entries.length === 0) {
    return {
      status: "empty",
      count: 0,
      recipients,
      message: "Nenhum documento vencido ou vencendo nos próximos 7 dias — resumo semanal não enviado.",
    };
  }

  const payloadDocuments: WeeklyDocumentItem[] = entries.map(({ doc, days }) => ({
    name: doc.name,
    typeName: doc.typeName,
    expiresAt: doc.expiresAt,
    days,
    collaboratorName: doc.collaboratorName || "",
    establishment: doc.establishment || "",
  }));

  try {
    const { data, error } = await supabase.functions.invoke("notify-document-expiry", {
      body: {
        mode: "weekly",
        companyName,
        attachPdf: config.attachPdf,
        groups: [
          {
            label: "SESMT",
            key: "__sesmt__",
            recipients,
            attachPdf: config.attachPdf,
            documents: payloadDocuments,
          },
        ],
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
            "O Resend ainda não está configurado no backend — o resumo semanal ficará pendente até a configuração.",
        };
      }
      return {
        status: "error",
        count: 0,
        recipients,
        message: "Não foi possível enviar o resumo semanal. Tente novamente em instantes.",
      };
    }

    saveDocumentExpiryAlertConfig({ weeklyLastSentAt: new Date().toISOString() });

    const expired = entries.filter((entry) => entry.days < 0).length;
    const pdfNote = config.attachPdf ? " Com PDF anexado, agrupado por unidade." : "";
    return {
      status: "sent",
      count: entries.length,
      recipients,
      message: `Resumo semanal enviado para ${recipients.length} destinatário(s): ${entries.length} documento(s) (${expired} vencido(s)).${pdfNote}`,
    };
  } catch {
    return {
      status: "error",
      count: 0,
      recipients,
      message: "Não foi possível enviar o resumo semanal. Verifique a conexão e tente novamente.",
    };
  }
}