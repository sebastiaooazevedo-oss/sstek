import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Parametrização do aviso de vencimento de documentos por e-mail.
 *
 * Fica em uma tabela própria, por empresa (`document_expiry_alert_settings`),
 * porque o alerta é de gestão: cada empresa define a janela de antecedência e
 * quem recebe. O envio em si acontece na Edge Function
 * `notify-document-expiry` (a chave do Resend nunca chega ao navegador).
 */
export interface DocumentExpiryAlertConfig {
  /** Envia (ou não) os avisos automáticos por e-mail. */
  enabled: boolean;
  /** Janela, em dias, antes do vencimento em que o documento entra no aviso. */
  daysBefore: number;
  /** E-mail do SESMT (destinatário principal). */
  sesmtEmail: string;
  /** Outros e-mails cadastrados para receber os alertas. */
  extraEmails: string[];
  /**
   * Copia o gestor/líder responsável quando o documento é de um colaborador da
   * equipe dele. Cada gestor recebe apenas os documentos dos seus liderados.
   */
  notifyManagers: boolean;
  /** Anexa ao e-mail um PDF com a lista de documentos agrupada por unidade. */
  attachPdf: boolean;
  /** Envia o resumo semanal (vencimentos da semana + o que venceu) ao SESMT. */
  weeklySummary: boolean;
  /** Dia da semana do resumo (1 = segunda ... 5 = sexta). */
  weeklyWeekday: number;
  /** Data/hora do último resumo semanal enviado (ISO). */
  weeklyLastSentAt: string | null;
  /** true depois da primeira leitura do banco. */
  loaded: boolean;
}

interface AlertSettingsRow {
  enabled: boolean | null;
  days_before: number | null;
  sesmt_email: string | null;
  extra_emails: string[] | null;
  notify_managers: boolean | null;
  attach_pdf: boolean | null;
  weekly_summary: boolean | null;
  weekly_weekday: number | null;
  weekly_last_sent_at: string | null;
}

const defaultConfig: DocumentExpiryAlertConfig = {
  enabled: true,
  daysBefore: 60,
  sesmtEmail: "",
  extraEmails: [],
  notifyManagers: true,
  attachPdf: false,
  weeklySummary: false,
  weeklyWeekday: 1,
  weeklyLastSentAt: null,
  loaded: false,
};

let config: DocumentExpiryAlertConfig = { ...defaultConfig };
let loading = false;
let loadedOnce = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function applyRow(row: AlertSettingsRow): void {
  const days = Number(row.days_before);
  const weekday = Number(row.weekly_weekday);
  config = {
    enabled: row.enabled ?? true,
    daysBefore: Number.isFinite(days) && days >= 1 ? Math.min(365, Math.round(days)) : 60,
    sesmtEmail: (row.sesmt_email ?? "").trim(),
    extraEmails: Array.isArray(row.extra_emails) ? row.extra_emails.filter(Boolean) : [],
    notifyManagers: row.notify_managers ?? defaultConfig.notifyManagers,
    attachPdf: row.attach_pdf ?? false,
    weeklySummary: row.weekly_summary ?? false,
    weeklyWeekday:
      Number.isFinite(weekday) && weekday >= 1 && weekday <= 5 ? Math.round(weekday) : 1,
    weeklyLastSentAt: row.weekly_last_sent_at ?? null,
    loaded: true,
  };
}

async function loadConfig(): Promise<void> {
  if (loadedOnce || loading) return;
  loading = true;
  try {
    const { data, error } = await supabase
      .from("document_expiry_alert_settings")
      .select(
        "enabled, days_before, sesmt_email, extra_emails, notify_managers, attach_pdf, weekly_summary, weekly_weekday, weekly_last_sent_at"
      )
      .maybeSingle();
    if (!error && data) applyRow(data as AlertSettingsRow);
  } catch {
    /* mantém os padrões quando a leitura falha */
  } finally {
    loading = false;
    loadedOnce = true;
    config = { ...config, loaded: true };
    emit();
  }
}

async function persist(): Promise<void> {
  const payload = {
    enabled: config.enabled,
    days_before: config.daysBefore,
    sesmt_email: config.sesmtEmail,
    extra_emails: config.extraEmails,
    notify_managers: config.notifyManagers,
    attach_pdf: config.attachPdf,
    weekly_summary: config.weeklySummary,
    weekly_weekday: config.weeklyWeekday,
    weekly_last_sent_at: config.weeklyLastSentAt,
    updated_at: new Date().toISOString(),
  };
  try {
    const { data } = await supabase
      .from("document_expiry_alert_settings")
      .select("company_id")
      .maybeSingle();
    const companyId = (data as { company_id?: string } | null)?.company_id;
    if (companyId) {
      await supabase
        .from("document_expiry_alert_settings")
        .update(payload)
        .eq("company_id", companyId);
    } else {
      await supabase.from("document_expiry_alert_settings").insert(payload);
    }
  } catch {
    /* gravação otimista; nova tentativa na próxima alteração */
  }
}

export function subscribeDocumentExpiryAlertConfig(listener: () => void): () => void {
  listeners.add(listener);
  void loadConfig();
  return () => {
    listeners.delete(listener);
  };
}

export function getDocumentExpiryAlertConfig(): DocumentExpiryAlertConfig {
  return config;
}

export function useDocumentExpiryAlertConfig(): DocumentExpiryAlertConfig {
  return useSyncExternalStore(
    subscribeDocumentExpiryAlertConfig,
    getDocumentExpiryAlertConfig,
    getDocumentExpiryAlertConfig
  );
}

export function saveDocumentExpiryAlertConfig(patch: Partial<DocumentExpiryAlertConfig>): void {
  const nextDays =
    patch.daysBefore !== undefined
      ? Math.min(365, Math.max(1, Math.round(Number(patch.daysBefore) || 1)))
      : config.daysBefore;
  const nextWeekday =
    patch.weeklyWeekday !== undefined
      ? Math.min(5, Math.max(1, Math.round(Number(patch.weeklyWeekday) || 1)))
      : config.weeklyWeekday;
  config = {
    ...config,
    ...patch,
    daysBefore: nextDays,
    weeklyWeekday: nextWeekday,
    loaded: config.loaded,
  };
  emit();
  void persist();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Lista final de destinatários (SESMT + e-mails adicionais), sem duplicar. */
export function alertRecipients(current: DocumentExpiryAlertConfig): string[] {
  const all = [current.sesmtEmail, ...current.extraEmails]
    .map((email) => email.trim().toLowerCase())
    .filter((email) => Boolean(email) && EMAIL_PATTERN.test(email));
  return Array.from(new Set(all));
}