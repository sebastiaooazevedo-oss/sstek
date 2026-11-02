import { useCallback, useSyncExternalStore } from "react";
import type { DocumentRecord } from "@/mocks/documents";

/**
 * Controle de "ciência" dos documentos direcionados a um colaborador.
 *
 * Quando um documento é registrado com destinatário = colaborador, ele passa a
 * aparecer no sino de notificações e na central de alertas daquele
 * colaborador. Ao abrir/visualizar o documento, a referência é marcada como
 * vista e o alerta desaparece (mas o documento continua acessível no
 * histórico de já visualizados).
 *
 * O estado é guardado por empresa + colaborador para que usuários diferentes
 * no mesmo navegador não compartilhem as marcações.
 */

const STORAGE_PREFIX = "sstek.document-ack.v1";
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

/** Marca um documento como visualizado (o alerta deixa de aparecer). */
export function acknowledgeDocument(
  companyRef: string,
  actorRef: string,
  documentId: string
): void {
  if (!actorRef || !documentId) return;
  const key = storageKey(companyRef, actorRef);
  const current = snapshotFor(key);
  if (current.includes(documentId)) return;
  const next = [...current, documentId];
  cache.set(key, next);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ambiente sem storage: mantém apenas em memória */
  }
  emit();
}

/** Lista de ids já visualizados pelo colaborador atual. */
export function useDocumentAcknowledgements(
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

/** Documentos que foram direcionados a um colaborador específico. */
export function directedDocumentsFor(
  documents: DocumentRecord[],
  collaboratorId: string | null | undefined
): DocumentRecord[] {
  if (!collaboratorId) return [];
  return documents.filter(
    (doc) =>
      doc.scope === "colaborador" &&
      doc.collaboratorId === collaboratorId &&
      doc.visibleToCollaborator
  );
}