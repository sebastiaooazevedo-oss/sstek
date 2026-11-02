import { useSyncExternalStore } from "react";

/**
 * Histórico de exportações geradas dentro da sessão atual (em memória).
 * Cada entrada guarda um reprodutor (replay) que reemite o mesmo PDF/planilha,
 * permitindo reenviar rapidamente os últimos documentos emitidos.
 *
 * Entradas de documentos chancelados guardam também o autor do download e o
 * código de verificação da chancela, para que o gestor consiga identificar
 * quem emitiu e qual selo foi gerado naquele arquivo.
 */

/** Dados da chancela de autenticidade vinculada ao arquivo exportado. */
export interface ExportSealInfo {
  /** Código curto de verificação (ex.: A1B2-C3D4-E5F6). */
  code: string;
  /** Endereço público completo de conferência. */
  url: string;
}

export interface ExportEntry {
  id: string;
  label: string;
  kind: "pdf" | "csv";
  at: number;
  /** Nome de quem realizou o download/emissão. */
  actor?: string;
  /** Chancela registrada no servidor para este arquivo (quando houver). */
  seal?: ExportSealInfo;
  replay: () => void;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let entries: ExportEntry[] = [];

const MAX_ENTRIES = 12;

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getExportHistory(): ExportEntry[] {
  return entries;
}

export function subscribeExportHistory(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addExportEntry(entry: {
  label: string;
  kind: "pdf" | "csv";
  replay: () => void;
  at?: number;
  actor?: string;
  seal?: ExportSealInfo;
}): void {
  const actor = (entry.actor || "").trim();
  const full: ExportEntry = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: entry.label,
    kind: entry.kind,
    at: entry.at ?? Date.now(),
    actor: actor || undefined,
    seal: entry.seal,
    replay: entry.replay,
  };
  entries = [full, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

export function clearExportHistory(): void {
  entries = [];
  emit();
}

export function useExportHistory(): ExportEntry[] {
  return useSyncExternalStore(subscribeExportHistory, getExportHistory, getExportHistory);
}