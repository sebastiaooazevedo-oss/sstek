import { scanLogs, type ScanLog } from "@/mocks/qrcodes";

/**
 * Situação de leitura do QR-Code de fiscalização de um colaborador.
 *
 * A lista de Colaboradores mostra o selo "QR ativo" na própria linha e a ficha
 * do colaborador repete a informação ao lado da prévia do código — as duas
 * telas precisam chegar exatamente ao mesmo resultado, por isso o cálculo vive
 * aqui e não é duplicado nas páginas.
 */
export interface QrScanStatus {
  /** `true` quando existe pelo menos uma leitura registrada. */
  hasScans: boolean;
  /** Total de escaneamentos registrados. */
  total: number;
  /** Leitura mais recente, com dispositivo, origem e resultado. */
  lastLog: ScanLog | null;
  /** Data da última leitura em DD/MM/AAAA (vazio quando nunca foi lido). */
  lastDate: string;
  /** Data e hora completas da última leitura, para a dica (tooltip). */
  lastDateFull: string;
}

/** Converte "29/09/2026 09:14:22" (ou ISO) em timestamp. */
function scanTime(value: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:[\sT]+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec((value || "").trim());
  if (match) {
    return new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
    ).getTime();
  }
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Leitura mais recente de um colaborador (ou `null` quando nunca foi lido). */
export function lastScanOf(collaboratorId: string, logs: ScanLog[] = scanLogs): ScanLog | null {
  let latest: ScanLog | null = null;
  let latestTime = -1;
  logs.forEach((log) => {
    if (log.collaboratorId !== collaboratorId) return;
    const time = scanTime(log.scannedAt);
    if (time >= latestTime) {
      latest = log;
      latestTime = time;
    }
  });
  return latest;
}

/** Resumo de leitura do QR-Code de um colaborador. */
export function qrScanStatus(collaboratorId: string, logs: ScanLog[] = scanLogs): QrScanStatus {
  const mine = logs.filter((log) => log.collaboratorId === collaboratorId);
  const lastLog = lastScanOf(collaboratorId, logs);
  return {
    hasScans: mine.length > 0 && lastLog !== null,
    total: mine.length,
    lastLog,
    lastDate: lastLog ? lastLog.scannedAt.slice(0, 10) : "",
    lastDateFull: lastLog ? lastLog.scannedAt : "",
  };
}