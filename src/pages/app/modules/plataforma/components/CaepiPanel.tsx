import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import {
  loadCaepiBase,
  useCaepiBase,
  type CaepiImportBatch,
} from "@/pages/app/modules/config/caepiBaseStore";
import CaepiImportModal from "@/pages/app/modules/config/caepiImport/CaepiImportModal";
import {
  downloadCaepiErrorsCsv,
  platformApi,
  type PlatformActiveCatalog,
} from "@/pages/app/modules/plataforma/platformApi";

interface CaepiPanelProps {
  activeCatalog: PlatformActiveCatalog | null;
  onRefresh: () => Promise<void>;
  notify: (message: string | null, error?: string | null) => void;
}

interface SampleRow {
  ca: string;
  numero_processo: string | null;
  razao_social: string | null;
  equipamento: string | null;
  situacao: string | null;
  validade: string | null;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export default function CaepiPanel({ activeCatalog, onRefresh, notify }: CaepiPanelProps) {
  const session = useAppSession();
  const { batches, logs, job, cancelling } = useCaepiBase();
  const [importOpen, setImportOpen] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleRow[]>([]);

  const running = ["uploading", "starting", "importing"].includes(job.phase);

  useEffect(() => {
    if (!activeCatalog?.id) {
      setSample([]);
      return;
    }
    let active = true;
    void supabase
      .from("caepi_catalog_entries")
      .select("ca, numero_processo, razao_social, equipamento, situacao, validade")
      .eq("batch_id", activeCatalog.id)
      .order("id", { ascending: true })
      .limit(5)
      .then(({ data }) => {
        if (active) setSample((data as SampleRow[] | null) ?? []);
      });
    return () => {
      active = false;
    };
  }, [activeCatalog?.id]);

  async function handleActivate(batch: CaepiImportBatch) {
    setActivating(batch.id);
    try {
      const result = await platformApi.caepiActivate(batch.id);
      notify(result.detail || "Base ativada.");
      await Promise.all([onRefresh(), loadCaepiBase(true)]);
    } catch (err) {
      notify(null, err instanceof Error ? err.message : "Não foi possível ativar a base.");
    } finally {
      setActivating(null);
    }
  }

  async function handleErrors(batch: CaepiImportBatch) {
    setDownloading(batch.id);
    try {
      const result = await platformApi.caepiErrors(batch.id, 5000);
      if (result.errors.length === 0) {
        notify("Este lote não tem erros de validação registrados.");
        return;
      }
      downloadCaepiErrorsCsv(batch.fileName, result.errors);
      notify(`${result.errors.length} linha(s) de erro exportadas em CSV.`);
    } catch (err) {
      notify(null, err instanceof Error ? err.message : "Não foi possível gerar o relatório de erros.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
              <i className="ri-database-2-line text-lg"></i>
            </span>
            <div>
              <h2 className="font-heading text-base font-bold text-foreground-950">Base central CAEPI</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">
                Catálogo único, global e compartilhado. Todas as empresas consultam esta mesma base — não existe
                cópia por empresa. Somente o Superadministrador importa, valida e ativa versões.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => setImportOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
            >
              <i className="ri-upload-2-line"></i>
              Importar nova base
            </button>
            {running && (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-loader-4-line animate-spin"></i>
                Ver progresso
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Versão ativa</p>
            {activeCatalog ? (
              <>
                <p className="mt-1 truncate text-sm font-semibold text-foreground-950">{activeCatalog.file_name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-600">
                  <span>{activeCatalog.catalogRows.toLocaleString("pt-BR")} CAs gravados</span>
                  <span>{activeCatalog.rejected_count.toLocaleString("pt-BR")} rejeitados na validação</span>
                  <span>ativada em {formatDateTime(activeCatalog.created_at)}</span>
                  {activeCatalog.encoding && <span>{activeCatalog.encoding.toUpperCase()}</span>}
                  {activeCatalog.delimiter_char && <span>separador “{activeCatalog.delimiter_char}”</span>}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-foreground-600">Nenhuma base ativa.</p>
            )}
          </div>
          <div className="rounded-md bg-background-100 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary-900">
              <i className="ri-lock-2-line"></i>
              Escrita bloqueada por RLS
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">
              As tabelas do catálogo aceitam apenas leitura para o cliente. Nenhuma empresa consegue inserir,
              atualizar ou apagar registros, mesmo chamando a API diretamente.
            </p>
          </div>
        </div>

        {running && (
          <div className="border-t border-background-200 bg-background-100 px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-600">
              <span className="flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin text-secondary-700"></i>
                {job.message || "Processando…"}
              </span>
              {job.pct !== null && <span className="font-bold tabular-nums text-foreground-950">{job.pct}%</span>}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${job.pct ?? 15}%` }}
              ></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-600">
              <span>Gravados: <strong>{job.rowCount.toLocaleString("pt-BR")}</strong></span>
              <span>Inseridos: <strong>{job.inserted.toLocaleString("pt-BR")}</strong></span>
              <span>Atualizados: <strong>{job.updated.toLocaleString("pt-BR")}</strong></span>
              <span>Rejeitados: <strong>{job.rejected.toLocaleString("pt-BR")}</strong></span>
              {cancelling && <span className="font-semibold">Cancelando…</span>}
            </div>
          </div>
        )}

        {job.phase === "error" && job.error && (
          <p className="border-t border-background-200 bg-background-100 px-5 py-3 text-xs text-foreground-700">
            <i className="ri-error-warning-line mr-1.5"></i>
            {job.error}
          </p>
        )}

        {sample.length > 0 && (
          <div className="border-t border-background-200 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
              Amostra consultada do banco
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-background-200 text-[10px] uppercase tracking-wide text-foreground-500">
                    <th className="py-2 pr-3 font-semibold">CA</th>
                    <th className="py-2 pr-3 font-semibold">Processo</th>
                    <th className="py-2 pr-3 font-semibold">Fabricante</th>
                    <th className="py-2 pr-3 font-semibold">Equipamento</th>
                    <th className="py-2 pr-3 font-semibold">Situação</th>
                    <th className="py-2 font-semibold">Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {sample.map((row) => (
                    <tr key={row.ca} className="border-b border-background-100 last:border-0 text-foreground-700">
                      <td className="py-2 pr-3 font-medium text-foreground-900">{row.ca}</td>
                      <td className="py-2 pr-3">{row.numero_processo || "—"}</td>
                      <td className="py-2 pr-3">{row.razao_social || "—"}</td>
                      <td className="py-2 pr-3">{row.equipamento || "—"}</td>
                      <td className="py-2 pr-3">{row.situacao || "—"}</td>
                      <td className="py-2">{row.validade || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-background-200 bg-background-50">
        <div className="border-b border-background-200 px-5 py-4">
          <h3 className="font-heading text-sm font-bold text-foreground-950">Histórico de importações</h3>
          <p className="mt-0.5 text-xs text-foreground-500">
            Ativar uma versão concluída troca a base de forma atômica. Se a validação falhar, a versão anterior
            continua ativa.
          </p>
        </div>
        <div className="divide-y divide-background-100">
          {batches.length === 0 && (
            <p className="px-5 py-6 text-xs text-foreground-500">Nenhuma importação registrada.</p>
          )}
          {batches.slice(0, 8).map((batch) => (
            <div key={batch.id} className="flex flex-col gap-2 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-xs font-semibold text-foreground-900">{batch.fileName}</span>
                  {batch.isActive && (
                    <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                      Base ativa
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      batch.status === "completed"
                        ? "bg-secondary-100 text-secondary-900"
                        : batch.status === "processing"
                          ? "bg-accent-100 text-accent-900"
                          : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    {batch.status === "completed" ? "Concluída" : batch.status === "processing" ? "Em processamento" : "Interrompida"}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-foreground-600">
                  <span>{formatDateTime(batch.createdAt)}</span>
                  <span>{batch.rowCount.toLocaleString("pt-BR")} gravados</span>
                  <span>{batch.rejectedCount.toLocaleString("pt-BR")} rejeitados</span>
                  {batch.uploadedByName && <span>por {batch.uploadedByName}</span>}
                </p>
                {batch.errorMessage && (
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-500">{batch.errorMessage}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {batch.rejectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleErrors(batch)}
                    disabled={downloading === batch.id}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-60"
                  >
                    <i className={downloading === batch.id ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}></i>
                    Erros
                  </button>
                )}
                {batch.status === "completed" && !batch.isActive && (
                  <button
                    type="button"
                    onClick={() => void handleActivate(batch)}
                    disabled={activating === batch.id}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-secondary-600 disabled:opacity-60"
                  >
                    <i className={activating === batch.id ? "ri-loader-4-line animate-spin" : "ri-play-circle-line"}></i>
                    Ativar versão
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {logs.length > 0 && (
          <div className="border-t border-background-200 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Últimas movimentações</p>
            <div className="mt-2 space-y-1.5">
              {logs.slice(0, 5).map((log) => (
                <p key={log.id} className="text-[11px] text-foreground-600">
                  <span className="font-medium text-foreground-800">{formatDateTime(log.createdAt)}</span>
                  {" · "}
                  {log.actorName || "Sistema"}
                  {" · "}
                  {log.detail || log.action}
                </p>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-md bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-shield-check-line mt-0.5 text-sm text-primary-600"></i>
        <span>
          Atualizar o catálogo não reescreve entregas de EPI, fichas assinadas nem documentos já emitidos: eles guardam
          a descrição do equipamento e o CA no momento do registro.
        </span>
      </p>

      <CaepiImportModal open={importOpen} onClose={() => setImportOpen(false)} actorName={session.name} />
    </div>
  );
}