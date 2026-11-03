/**
 * Regras da consulta pública da ficha pelo QR-Code, usadas pela função de
 * servidor `fiscalizacao-consulta` e pelas telas do sistema.
 *
 * Arquivo PURO (sem Deno, sem banco): testado pelo `npm test` (consulta.test.ts).
 */

/** Tempo que a ficha fica visível depois de liberada. Depois disso, a sessão expira. */
export const CONSULTA_SESSAO_MINUTOS = 5;

export const CONSULTA_SESSAO_MS = CONSULTA_SESSAO_MINUTOS * 60 * 1000;

/**
 * Protocolo público de uma consulta: os 8 primeiros caracteres do id do
 * registro, sem hífens e em maiúsculas (ex.: `3F9A1C07`). É o mesmo número
 * mostrado ao consultante e no relatório de consultas externas.
 */
export function protocoloDaConsulta(id: string): string {
  return String(id ?? "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Tempo restante em "m:ss" (0:00 quando já expirou). */
export function tempoRestante(expiraEm: string | number | Date, agora: number = Date.now()): string {
  const fim = new Date(expiraEm).getTime();
  if (!Number.isFinite(fim)) return "0:00";
  const resto = Math.max(0, Math.floor((fim - agora) / 1000));
  return `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, "0")}`;
}
