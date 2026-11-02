import { useState } from "react";
import { useAppSession } from "@/pages/app/context";
import {
  activeBatch,
  cleanupOrphanCaepiFiles,
  downloadCaepiErrorReport,
  formatBytes,
  resumeCaepiImport,
  useCaepiBase,
  type CaepiImportBatch,
} from "@/pages/app/modules/config/caepiBaseStore";
import CaepiImportModal from "@/pages/app/modules/config/caepiImport/CaepiImportModal";

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function statusBadge(batch: CaepiImportBatch) {
  if (batch.status === "completed" && batch.isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
        <i className="ri-checkbox-circle-line"></i> Base ativa
      </span>
    );
  }
  if (batch.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-600">
        <i className="ri-archive-line"></i> Versão anterior
      </span>
    );
  }
  if (batch.status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-900">
        <i className="ri-loader-4-line animate-spin"></i> Em processamento
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-700">
      <i className="ri-close-circle-line"></i> Interrompida
    </span>
  );
}

const BATCH_LIMIT = 6;

export default function CaepiBaseUpload() {
  const { batches, logs, job, cancelling, cleanupRunning } = useCaepiBase();
  const session = useAppSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const current = activeBatch();
  const visibleBatches = batches.slice(0, BATCH_LIMIT);
  const running = ["uploading", "starting", "importing"].includes(job.phase);

  async function handleCleanup() {
    setCleanupMsg(null);
    setCleanupError(null);
    const result = await cleanupOrphanCaepiFiles({ id: null, name: session.name });
    if (result.ok) {
      setCleanupMsg(
        result.removed && result.removed > 0
          ? `${result.removed} arquivo(s) órfão(s) removido(s) do armazenamento.`
          : "Nenhum arquivo órfão encontrado — nada a remover."
      );
    } else {
      setCleanupError(result.error || "Não foi possível limpar os arquivos órfãos.");
    }
  }

  async function handleResume(batch: CaepiImportBatch) {
    setActionError(null);
    setResuming(batch.id);
    await resumeCaepiImport(batch, { id: null, name: session.name });
    setResuming(null);
  }

  async function handleReport(batch: CaepiImportBatch) {
    setActionError(null);
    setDownloading(batch.id);
    try {
      await downloadCaepiErrorReport(batch.id, batch.fileName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível gerar o relatório de erros.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-database-2-line text-lg"></i>
        </span>
        <div>
          <h2 className="font-heading text-base font-bold text-foreground-950">Base de dados do CAEPI</h2>
          <p className="mt-0.5 text-xs text-foreground-500">
            Importe o arquivo oficial da Tabela de CA (o <strong>.csv.gz</strong> do portal do CAEPI ou um{" "}
            <strong>.csv</strong> em UTF-8) para consultar o CA direto no nosso banco. A importação mostra prévia e
            mapeamento, valida linha a linha, grava em lotes e só troca a base ativa no final.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-sm font-semibold text-foreground-900">Base ativa atualmente</h3>
          {current ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-foreground-600">
              <span className="font-medium text-foreground-900">{current.fileName}</span>
              <span>· {current.rowCount.toLocaleString("pt-BR")} CAs cadastrados</span>
              <span>· {current.rejectedCount.toLocaleString("pt-BR")} linha(s) rejeitada(s) na validação</span>
              <span>· importado em {formatDateTime(current.createdAt)}</span>
              {current.encoding && <span>· {current.encoding.toUpperCase()}</span>}
              {current.delimiter && <span>· separador “{current.delimiter === "\t" ? "TAB" : current.delimiter}”</span>}
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-foreground-600">
              Nenhuma base foi importada ainda. Enquanto isso, as consultas de CA usam a consulta ao vivo ao portal
              oficial (com cache automático por CA já consultado).
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => setModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-foreground-950"
          >
            <i className="ri-upload-2-line"></i>
            Importar nova base
          </button>
          {running && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-loader-4-line animate-spin"></i>
              Ver progresso
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className="border-t border-background-200 bg-background-100 px-5 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-foreground-600">
            <span className="flex min-w-0 items-center gap-2.5">
              <i className="ri-loader-4-line animate-spin shrink-0 text-secondary-700"></i>
              <span className="truncate">{job.message || "Processando…"}</span>
            </span>
            {job.pct !== null && (
              <span className="w-10 text-right text-sm font-bold tabular-nums text-foreground-950">{job.pct}%</span>
            )}
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-background-200">
            {job.pct !== null ? (
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-300"
                style={{ width: `${job.pct}%` }}
              ></div>
            ) : (
              <div className="caepi-progress-indeterminate h-full w-1/3 rounded-full bg-primary-500/70"></div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-600">
            <span>Gravados: <strong className="text-foreground-900">{job.rowCount.toLocaleString("pt-BR")}</strong></span>
            <span>Inseridos: <strong className="text-foreground-900">{job.inserted.toLocaleString("pt-BR")}</strong></span>
            <span>Atualizados: <strong className="text-foreground-900">{job.updated.toLocaleString("pt-BR")}</strong></span>
            <span>Rejeitados: <strong className="text-foreground-900">{job.rejected.toLocaleString("pt-BR")}</strong></span>
            {cancelling && <span className="font-semibold text-foreground-700">Cancelando…</span>}
          </div>
        </div>
      )}

      {job.phase === "error" && job.error && (
        <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-700">
          <i className="ri-error-warning-line mt-0.5 text-base text-accent-700"></i>
          <span>{job.error}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-700">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{actionError}</span>
        </div>
      )}

      {batches.length > 0 && (
        <div className="border-t border-background-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground-900">Histórico de importações</h3>
          <p className="mt-1 text-xs text-foreground-500">
            Cada tentativa fica registrada com a contagem real de gravados, inseridos, atualizados e rejeitados.
            Importações interrompidas podem ser retomadas do ponto onde pararam, sem duplicar registros.
          </p>
          <div className="mt-3 space-y-2">
            {visibleBatches.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-col gap-2 rounded-md border border-background-200 px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-700">
                    <span className="font-medium text-foreground-900">{batch.fileName}</span>
                    <span>{formatDateTime(batch.createdAt)}</span>
                    {batch.status !== "processing" && (
                      <>
                        <span>· {batch.rowCount.toLocaleString("pt-BR")} gravados</span>
                        <span>· {batch.insertedCount.toLocaleString("pt-BR")} novos</span>
                        <span>· {batch.updatedCount.toLocaleString("pt-BR")} atualizados</span>
                        <span>· {batch.rejectedCount.toLocaleString("pt-BR")} rejeitados</span>
                      </>
                    )}
                    {batch.totalBytes > 0 && <span>· {formatBytes(batch.totalBytes)}</span>}
                  </div>
                  {batch.errorMessage && (
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-500">
                      <i className="ri-information-line mt-0.5"></i>
                      <span>{batch.errorMessage}</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {statusBadge(batch)}
                  {batch.rejectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleReport(batch)}
                      disabled={downloading === batch.id}
                      title="Baixar relatório de erros da validação"
                      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <i className={downloading === batch.id ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}></i>
                      Erros
                    </button>
                  )}
                  {batch.canResume && (
                    <button
                      type="button"
                      onClick={() => void handleResume(batch)}
                      disabled={resuming === batch.id || running}
                      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-secondary-500 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-foreground-950"
                    >
                      <i className={resuming === batch.id ? "ri-loader-4-line animate-spin" : "ri-play-circle-line"}></i>
                      {resuming === batch.id ? "Retomando…" : "Retomar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {batches.length > BATCH_LIMIT && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-background-100 px-3 py-2 text-xs text-foreground-500">
              <i className="ri-history-line mt-0.5"></i>
              <span>
                Exibindo as {BATCH_LIMIT} importações mais recentes. As demais tentativas estão em{" "}
                <strong>Logs do sistema</strong>, logo abaixo.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="border-t border-background-200 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShowLogs((value) => !value)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-secondary-800 hover:text-secondary-900"
          >
            <i className={showLogs ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
            {showLogs ? "Ocultar últimas movimentações" : "Ver últimas movimentações"}
          </button>
          <button
            type="button"
            disabled={cleanupRunning || running}
            onClick={() => void handleCleanup()}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
            title="Apaga arquivos que sobraram de tentativas antigas que falharam ou foram canceladas"
          >
            <i className={cleanupRunning ? "ri-loader-4-line animate-spin" : "ri-delete-bin-6-line"}></i>
            {cleanupRunning ? "Limpando…" : "Limpar arquivos órfãos"}
          </button>
        </div>
        {cleanupMsg && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-background-100 px-3 py-2 text-xs text-foreground-600">
            <i className="ri-checkbox-circle-line mt-0.5"></i>
            <span>{cleanupMsg}</span>
          </p>
        )}
        {cleanupError && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-background-100 px-3 py-2 text-xs text-foreground-700">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{cleanupError}</span>
          </p>
        )}
        {showLogs && (
          <div className="mt-3 space-y-2">
            {logs.length === 0 && <p className="text-xs text-foreground-500">Nenhuma movimentação registrada ainda.</p>}
            {logs.slice(0, 4).map((log) => (
              <div key={log.id} className="rounded-md bg-background-100 px-3 py-2 text-xs text-foreground-700">
                <div className="flex flex-wrap items-center gap-2 font-medium text-foreground-900">
                  <span>{formatDateTime(log.createdAt)}</span>
                  <span>· {log.actorName || "Sistema"}</span>
                </div>
                <p className="mt-0.5 text-foreground-600">{log.detail}</p>
              </div>
            ))}
            <p className="flex items-start gap-2 rounded-md bg-background-100 px-3 py-2 text-xs text-foreground-500">
              <i className="ri-history-line mt-0.5"></i>
              <span>
                Exibindo as 4 movimentações mais recentes. O histórico completo está em{" "}
                <strong>Logs do sistema</strong>, nesta mesma tela de Configurações.
              </span>
            </p>
          </div>
        )}
      </div>

      <CaepiImportModal open={modalOpen} onClose={() => setModalOpen(false)} actorName={session.name} />
    </section>
  );
}