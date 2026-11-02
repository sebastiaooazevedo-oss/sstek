import { useState } from "react";
import SystemLogModal from "@/pages/app/modules/config/SystemLogModal";
import { formatLogDateTime, useSystemLogs } from "@/pages/app/modules/config/systemLogStore";

/**
 * Seção "Logs do sistema" nas Configurações da empresa.
 *
 * Mostra um resumo da última movimentação e um botão que abre a linha do tempo
 * completa de auditoria (Configurações + Base do CAEPI) com filtros por período
 * e por tipo de registro.
 */
export default function SystemLogPanel() {
  const [open, setOpen] = useState(false);
  const { entries } = useSystemLogs({ from: null, to: null, area: null }, true, 1);
  const last = entries[0];

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
          <i className="ri-history-line text-lg"></i>
        </span>
        <div>
          <h2 className="font-heading text-base font-bold text-foreground-950">Logs do sistema</h2>
          <p className="mt-0.5 text-xs text-foreground-500">
            Auditoria de tudo que altera dados no banco — dados da empresa, identidade visual, regras de EPI, a base
            do CAEPI, entregas de EPI, DDS, CIPA e assinaturas — com filtro por período e por tipo de registro, além
            de exportação em PDF (com papel timbrado) e CSV. Útil para auditorias e investigação de problemas.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-sm font-semibold text-foreground-900">Histórico completo de alterações</h3>
          {last ? (
            <p className="mt-1.5 text-xs text-foreground-600">
              Última movimentação registrada em <span className="font-medium text-foreground-900">{formatLogDateTime(last.createdAt)}</span>
              {last.actorName ? ` por ${last.actorName}` : ""}.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-foreground-600">
              Nenhuma movimentação registrada ainda. As próximas alterações aparecerão aqui automaticamente.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 dark:text-foreground-950"
        >
          <i className="ri-file-list-3-line"></i>
          Ver todos os logs do sistema
        </button>
      </div>

      <SystemLogModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}