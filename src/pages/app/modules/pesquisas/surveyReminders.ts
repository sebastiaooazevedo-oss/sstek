import { useSyncExternalStore } from "react";
import type { Survey } from "@/pages/app/modules/pesquisas/surveyTypes";

/**
 * Lembretes automáticos de prazo.
 *
 * O administrador define quantos dias antes do encerramento o colaborador
 * que ainda não respondeu deve ser avisado no sino do topo. A preferência
 * fica salva no navegador do gestor (não é um dado sensível).
 */

const STORAGE_KEY = "sstek:pesquisas:lembrete-dias";
const DEFAULT_DAYS = 3;
export const reminderOptions = [1, 2, 3, 5, 7, 10, 15];

let days = DEFAULT_DAYS;
let initialized = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function readStoredDays(): number {
  if (typeof window === "undefined") return DEFAULT_DAYS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw);
    return reminderOptions.includes(parsed) ? parsed : DEFAULT_DAYS;
  } catch {
    return DEFAULT_DAYS;
  }
}

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  days = readStoredDays();
}

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSurveyReminderDays(): number {
  return useSyncExternalStore(subscribe, () => days, () => days);
}

export function setSurveyReminderDays(next: number): void {
  ensureInitialized();
  if (!reminderOptions.includes(next)) return;
  days = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Sem persistência: o valor continua valendo nesta sessão.
  }
  emit();
}

/** Dias restantes até o encerramento (0 = encerra hoje). */
export function daysUntilEnd(iso: string, now: number = Date.now()): number {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

/** O lembrete deve aparecer quando falta X dias ou menos para encerrar. */
export function isReminderDue(
  survey: Survey,
  daysBefore: number,
  now: number = Date.now()
): boolean {
  const end = new Date(survey.endAt).getTime();
  if (Number.isNaN(end)) return false;
  if (end < now) return false;
  if (end - now > daysBefore * 86400000) return false;
  return true;
}