import type { ScanLog } from "@/mocks/qrcodes";

interface ScanLogTableProps {
  logs: ScanLog[];
  showCollaborator?: boolean;
}

export default function ScanLogTable({ logs, showCollaborator = true }: ScanLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-background-200 bg-background-100 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-200 text-foreground-400">
          <i className="ri-qr-scan-2-line text-2xl"></i>
        </span>
        <p className="text-sm font-semibold text-foreground-800">Nenhum escaneamento registrado</p>
        <p className="text-xs text-foreground-500">Os QR-Codes ainda não foram lidos por nenhum aparelho.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-background-200">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-background-200 bg-background-100 text-left">
            {showCollaborator && (
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Colaborador</th>
            )}
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Data / hora</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Aparelho</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">IP</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Localização</th>
            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Origem</th>
            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-background-100 last:border-0 hover:bg-background-50">
              {showCollaborator && (
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-foreground-950">{log.collaboratorName}</p>
                  <p className="text-xs text-foreground-400">{log.collaboratorId.toUpperCase()}</p>
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground-700">{log.scannedAt}</td>
              <td className="px-4 py-3">
                <p className="text-sm text-foreground-800">{log.device}</p>
                <p className="text-xs text-foreground-400">{log.browser}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground-700">{log.ip}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground-700">{log.location}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="rounded-md bg-secondary-100 px-2 py-1 text-xs font-medium text-secondary-900">{log.source}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    log.result === "OK" ? "bg-primary-100 text-primary-700" : "bg-accent-200 text-accent-900"
                  }`}
                >
                  <i className={log.result === "OK" ? "ri-shield-check-line" : "ri-alert-line"}></i>
                  {log.result === "OK" ? "Conforme" : "Alerta"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}