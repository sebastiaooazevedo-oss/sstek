import { useCallback, useSyncExternalStore } from "react";

/**
 * Controle de "notificação já visualizada" do sino do topo.
 *
 * Regra do produto:
 * - Avisos informativos (vencimentos, importações, sentimento, reuniões etc.)
 *   somem do sino assim que o usuário abre a lista de notificações.
 * - Avisos que dependem de uma ação (assinar, dar aceite, responder pesquisa,
 *   ler o regulamento) NÃO são marcados como lidos ao abrir o sino: eles só
 *   deixam de aparecer quando o colaborador executa a ação exigida — e essa
 *   remoção vem do próprio estado do documento/pesquisa, não daqui.
 *
 * O estado é guardado por empresa + usuário para que pessoas diferentes no
 * mesmo navegador não compartilhem as marcações.
 */

const STORAGE_PREFIX = "sstek.notif-read.v1";
const MAX_STORED_IDS = 300;
const EMPTY: string[] = [];

const cache = new Map<string, string[]>();
const listeners = new Set<() => void>();

function storageKey(companyRef: string, actorRef: string): string {
  const company = (companyRef || "empresa").trim().toLowerCase();
  const actor = (actorRef || "anon").trim().toLowerCase();
  return `${STORAGE_PREFIX}:${company}:${actor}`;
}

function readFromStorage(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function snapshotFor(key: string): string[] {
  const cached = cache.get(key);
  if (cached) return cached;
  const loaded = readFromStorage(key);
  cache.set(key, loaded);
  return loaded;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Marca como lidas as notificações informativas exibidas ao usuário. */
export function markNotificationsRead(
  companyRef: string,
  actorRef: string,
  ids: string[]
): void {
  if (!actorRef || ids.length === 0) return;
  const key = storageKey(companyRef, actorRef);
  const current = snapshotFor(key);
  const missing = ids.filter((id) => id && !current.includes(id));
  if (missing.length === 0) return;
  const next = [...current, ...missing].slice(-MAX_STORED_IDS);
  cache.set(key, next);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ambiente sem storage: mantém apenas em memória */
  }
  emit();
}

/** Ids já visualizados pelo usuário atual. */
export function useReadNotificationIds(
  companyRef: string,
  actorRef: string | null | undefined
): string[] {
  const key = actorRef ? storageKey(companyRef, actorRef) : "";
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const getSnapshot = useCallback(() => (key ? snapshotFor(key) : EMPTY), [key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}