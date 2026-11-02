/**
 * Apresentacao padronizada de uma assinatura eletronica.
 * Ordem obrigatoria:
 *   [Representacao visual preservada]
 *   Assinado eletronicamente por
 *   [NOME COMPLETO]
 *   Data: DD/MM/AAAA HH:mm:ss - UTC-03:00
 *   ID da assinatura: [UUID]
 * O ID identifica o ATO e nao deve ser apresentado como prova isolada.
 */

export interface SignatureDisplay {
  signatureUid: string | null;
  signerName: string | null;
  signedAt: string | null;
  timezoneDisplay: string | null;
  representationSnapshot: string | null;
  /** Nivel legal do ato: simples, avancada ou qualificada. */
  level?: string | null;
}

export const DEFAULT_DISPLAY_TIMEZONE = "UTC\u221203:00";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Formata a data/hora de exibicao no fuso oficial do sistema (UTC-03:00).
 * O servidor grava sempre em UTC; aqui apenas convertemos para exibicao.
 */
export function formatSignatureTimestamp(
  iso: string | null | undefined,
  timezoneDisplay?: string | null
): string {
  if (!iso) return "--/--/---- --:--:--";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "--/--/---- --:--:--";
  const shifted = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
  const date = `${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()}`;
  const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  const tz = timezoneDisplay || DEFAULT_DISPLAY_TIMEZONE;
  return `${date} ${time} \u2014 ${tz}`;
}