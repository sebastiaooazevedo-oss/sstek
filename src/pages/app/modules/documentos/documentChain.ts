import type { DocumentRecord } from "@/mocks/documents";

export interface ReplacementChain {
  /** Documentos da cadeia, do mais antigo ao mais recente. */
  docs: DocumentRecord[];
  /** Posição do documento consultado dentro da cadeia. */
  currentIndex: number;
}

/**
 * Monta a cadeia de substituição de um documento.
 *
 * Percorre para trás pelos vínculos `replacesRef` (documentos anteriores) e
 * para frente por `supersededByRef` (documentos que o substituíram), devolvendo
 * a linha do tempo completa em ordem cronológica — do original ao mais recente.
 * O percurso para em vínculos quebrados ou em referências ausentes na base.
 */
export function buildReplacementChain(
  current: DocumentRecord | null | undefined,
  all: DocumentRecord[]
): ReplacementChain {
  if (!current) return { docs: [], currentIndex: -1 };

  const byId = new Map(all.map((doc) => [doc.id, doc]));
  const seen = new Set<string>([current.id]);

  const before: DocumentRecord[] = [];
  let cursor: DocumentRecord | undefined = current;
  while (cursor?.replacesRef) {
    const previous = byId.get(cursor.replacesRef);
    if (!previous || seen.has(previous.id)) break;
    before.unshift(previous);
    seen.add(previous.id);
    cursor = previous;
  }

  const after: DocumentRecord[] = [];
  cursor = current;
  while (cursor?.supersededByRef) {
    const next = byId.get(cursor.supersededByRef);
    if (!next || seen.has(next.id)) break;
    after.push(next);
    seen.add(next.id);
    cursor = next;
  }

  return {
    docs: [...before, current, ...after],
    currentIndex: before.length,
  };
}

/** Resumo de uma cadeia de substituição, reaproveitado na lista. */
export interface ReplacementChainInfo {
  /** Documento que ocupa o lugar hoje (último elo não substituído). */
  vigente: DocumentRecord;
  /** Momento (ISO) da última troca registrada na cadeia. */
  lastSwapAt: string | null;
  /** Quantos documentos a cadeia reúne. */
  length: number;
}

function swapTime(value?: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function summarizeChain(chain: DocumentRecord[]): ReplacementChainInfo {
  const lastSwapAt = chain.reduce<string | null>((latest, doc) => {
    if (!doc.supersededAt) return latest;
    if (!latest || swapTime(doc.supersededAt) >= swapTime(latest)) return doc.supersededAt;
    return latest;
  }, null);

  const vigente = [...chain].reverse().find((doc) => !doc.supersededByRef) || chain[chain.length - 1];

  return { vigente, lastSwapAt, length: chain.length };
}

/**
 * Indexa todas as cadeias de substituição da base em uma única passada.
 *
 * Devolve, por documento, o elo vigente da cadeia e a data da última troca —
 * usado para mostrar o histórico resumido direto na linha da lista, sem abrir
 * a gaveta. Documentos fora de qualquer cadeia simplesmente não entram no mapa.
 */
export function buildReplacementChainIndex(
  all: DocumentRecord[]
): Map<string, ReplacementChainInfo> {
  const byId = new Map(all.map((doc) => [doc.id, doc]));
  const index = new Map<string, ReplacementChainInfo>();

  // Percorre a partir dos documentos originais (sem antecessor) para frente.
  all
    .filter((doc) => !doc.replacesRef)
    .forEach((root) => {
      const chain: DocumentRecord[] = [root];
      const seen = new Set<string>([root.id]);
      let cursor: DocumentRecord | undefined = root;
      while (cursor?.supersededByRef) {
        const next = byId.get(cursor.supersededByRef);
        if (!next || seen.has(next.id)) break;
        chain.push(next);
        seen.add(next.id);
        cursor = next;
      }
      if (chain.length < 2) return;
      const info = summarizeChain(chain);
      chain.forEach((doc) => index.set(doc.id, info));
    });

  // Vínculos quebrados (antecessor ausente na base): resolve individualmente.
  all.forEach((doc) => {
    if (index.has(doc.id)) return;
    const chain = buildReplacementChain(doc, all).docs;
    if (chain.length < 2) return;
    const info = summarizeChain(chain);
    chain.forEach((node) => index.set(node.id, info));
  });

  return index;
}

/** Data curta (dd/mm/aaaa) de uma troca registrada. */
export function formatSwapDay(value?: string | null): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleDateString("pt-BR");
}

/** Data e hora completas de uma troca registrada. */
export function formatSwapMoment(value?: string | null): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}