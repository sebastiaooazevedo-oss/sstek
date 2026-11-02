import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  platformApi,
  type CollaboratorImportResult,
  type CollaboratorImportRow,
  type ImportCompany,
  type ImportHistoryRow,
} from "@/pages/app/modules/plataforma/platformApi";
import {
  downloadTemplateCsv,
  downloadTemplateXlsx,
  importFields,
  parseCollaboratorFile,
  type ParsedImportRow,
} from "@/pages/app/modules/plataforma/collaboratorImport";
import { tenantHost } from "@/core/domain";

interface BulkImportPanelProps {
  notify: (message: string | null, error?: string | null) => void;
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function historySummary(detail: Record<string, unknown> | null): string {
  if (!detail) return "Importação concluída.";
  const inserted = Number(detail.inserted ?? 0);
  const skipped = Number(detail.skipped ?? 0);
  const failed = Number(detail.failed ?? 0);
  const fileName = typeof detail.fileName === "string" ? detail.fileName : null;
  return `${fileName ? `${fileName} · ` : ""}${inserted} adicionado(s) · ${skipped} já existente(s) · ${failed} com erro`;
}

export default function BulkImportPanel({ notify }: BulkImportPanelProps) {
  const [companies, setCompanies] = useState<ImportCompany[]>([]);
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CollaboratorImportResult | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await platformApi.importContext();
      setCompanies(data.companies);
      setHistory(data.history);
      setCompanyId((current) => current || data.companies[0]?.id || "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar as empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? null,
    [companies, companyId]
  );

  const summary = useMemo(() => {
    const valid = rows.filter((row) => row.errors.length === 0);
    return {
      total: rows.length,
      valid: valid.length,
      invalid: rows.length - valid.length,
      statuses: rows.reduce<Record<string, number>>((acc, row) => {
        const status = (row.data.status || "Ativo").trim();
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }, [rows]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setResult(null);
    try {
      const parsed = await parseCollaboratorFile(file);
      if (parsed.rows.length === 0) {
        setParseError("O arquivo não tem nenhuma linha de colaborador abaixo do cabeçalho.");
        setRows([]);
        setFileName("");
      } else {
        setRows(parsed.rows);
        setIgnoredColumns(parsed.ignoredColumns);
        setFileName(file.name);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Não foi possível ler o arquivo.");
      setRows([]);
      setFileName("");
    } finally {
      setParsing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function handleImport() {
    if (!companyId) {
      notify(null, "Selecione a empresa que vai receber a base.");
      return;
    }
    const validRows = rows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) {
      notify(null, "Não há linhas válidas para importar. Corrija o arquivo e envie de novo.");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const response = await platformApi.importCollaborators(
        companyId,
        fileName || "planilha",
        validRows.map((row) => ({ ...(row.data as Record<string, string>), line: row.line })) as unknown as CollaboratorImportRow[]
      );
      setResult(response);
      notify(response.detail || `${response.inserted} colaborador(es) importado(s).`);
      await loadContext();
    } catch (err) {
      notify(null, err instanceof Error ? err.message : "Não foi possível concluir a importação.");
    } finally {
      setImporting(false);
    }
  }

  function resetFile() {
    setRows([]);
    setFileName("");
    setIgnoredColumns([]);
    setParseError(null);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-16">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando empresas…
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 px-4 py-4 text-sm text-accent-900 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          {loadError}
        </span>
        <button
          type="button"
          onClick={() => void loadContext()}
          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-accent-700"
        >
          <i className="ri-refresh-line"></i>
          Tentar novamente
        </button>
      </div>
    );
  }

  const visibleRows = showOnlyErrors ? rows.filter((row) => row.errors.length > 0) : rows;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-background-200 bg-background-50 p-4 lg:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-building-2-line"></i>
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground-950">1. Empresa de destino</h2>
              <p className="text-[11px] text-foreground-500">Toda a base entrará nesta empresa.</p>
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">Empresa</span>
            <div className="relative">
              <select
                value={companyId}
                onChange={(event) => {
                  setCompanyId(event.target.value);
                  setResult(null);
                }}
                className="w-full cursor-pointer appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} · Plano {company.plan}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </label>

          {selectedCompany && (
            <dl className="mt-4 space-y-2 rounded-md bg-background-100 px-3.5 py-3 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-foreground-500">Subdomínio</dt>
                <dd className="font-medium text-foreground-900">{tenantHost(selectedCompany.subdomain)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-foreground-500">Colaboradores hoje</dt>
                <dd className="font-semibold text-foreground-900">{selectedCompany.collaborators}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-foreground-500">Situação</dt>
                <dd className="font-medium text-foreground-900">
                  {selectedCompany.status === "active" ? "Ativa" : selectedCompany.status === "trial" ? "Em teste" : "Suspensa"}
                </dd>
              </div>
            </dl>
          )}

          <p className="mt-4 flex items-start gap-2 rounded-md border border-background-200 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-500">
            <i className="ri-information-line mt-0.5 text-secondary-700"></i>
            O CPF é a chave de deduplicação: quem já existe nesta empresa é ignorado, sem sobrescrever dados.
          </p>
        </section>

        <section className="rounded-lg border border-background-200 bg-background-50 p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
              <i className="ri-file-upload-line"></i>
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground-950">2. Enviar a planilha</h2>
              <p className="text-[11px] text-foreground-500">Aceita .csv e .xlsx. A primeira linha deve ser o cabeçalho.</p>
            </div>
          </div>

          <label
            className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-8 text-center transition-colors hover:border-primary-400"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={`${parsing ? "ri-loader-4-line animate-spin" : "ri-file-excel-2-line"} text-xl`}></i>
            </span>
            <span className="text-sm font-semibold text-foreground-900">
              {parsing ? "Lendo o arquivo…" : fileName || "Clique ou arraste o arquivo aqui"}
            </span>
            <span className="text-[11px] text-foreground-500">
              {fileName ? "Envie outro arquivo para substituir este." : "CSV com ; ou , · XLSX do Excel"}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {parseError && (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
              <i className="ri-error-warning-line mt-0.5"></i>
              <span>{parseError}</span>
            </p>
          )}

          {fileName && !parseError && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Linhas lidas", value: summary.total, icon: "ri-file-list-3-line" },
                { label: "Válidas", value: summary.valid, icon: "ri-checkbox-circle-line" },
                { label: "Com erro", value: summary.invalid, icon: "ri-error-warning-line" },
                { label: "Ativos", value: summary.statuses.Ativo ?? 0, icon: "ri-user-follow-line" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-background-200 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-medium text-foreground-500">
                    <i className={`${item.icon} text-secondary-700`}></i>
                    {item.label}
                  </p>
                  <p className="mt-1 font-heading text-lg font-extrabold text-foreground-950">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {ignoredColumns.length > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-foreground-500">
              Colunas ignoradas (não fazem parte do modelo): <strong>{ignoredColumns.join(", ")}</strong>.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!companyId || summary.valid === 0 || importing}
              onClick={() => void handleImport()}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className={importing ? "ri-loader-4-line animate-spin" : "ri-upload-2-line"}></i>
              {importing ? "Importando…" : `Importar ${summary.valid || ""} colaborador(es)`}
            </button>
            {fileName && (
              <button
                type="button"
                onClick={resetFile}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2.5 text-xs font-semibold text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-close-line"></i>
                Limpar arquivo
              </button>
            )}
          </div>

          {result && (
            <div className="mt-4 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-primary-900">
                <i className="ri-checkbox-circle-line"></i>
                Importação concluída em {selectedCompany?.name}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-primary-900">
                {result.inserted} adicionado(s) · {result.skipped} já existente(s) · {result.failed} com erro. Tudo registrado na auditoria da plataforma.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px] text-accent-900">
                  {result.errors.map((error, index) => (
                    <li key={`${error.line}-${index}`} className="flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5"></i>
                      {error.line > 0 ? `Linha ${error.line}: ` : ""}
                      {error.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground-950">Modelo da planilha</h2>
            <p className="text-[11px] text-foreground-500">
              Só <strong>Nome completo</strong> e <strong>CPF</strong> são obrigatórios. As demais colunas podem ficar vazias.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadTemplateCsv()}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-file-text-line"></i>
              Modelo CSV
            </button>
            <button
              type="button"
              onClick={() => downloadTemplateXlsx()}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-secondary-600 dark:text-foreground-950"
            >
              <i className="ri-file-excel-2-line"></i>
              Modelo XLSX
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-background-200">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-background-100 text-[10px] uppercase tracking-wide text-foreground-500">
                <th className="px-3 py-2 font-semibold">Coluna</th>
                <th className="px-3 py-2 font-semibold">Obrigatória</th>
                <th className="px-3 py-2 font-semibold">Como preencher</th>
                <th className="px-3 py-2 font-semibold">Exemplo</th>
              </tr>
            </thead>
            <tbody>
              {importFields.map((field) => (
                <tr key={field.key} className="border-t border-background-100">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground-900">{field.label}</td>
                  <td className="px-3 py-2">
                    {field.required ? (
                      <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-900">Sim</span>
                    ) : (
                      <span className="text-[10px] text-foreground-400">Opcional</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground-600">{field.description}</td>
                  <td className="px-3 py-2 text-foreground-500">{field.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="rounded-lg border border-background-200 bg-background-50">
          <div className="flex flex-col gap-2 border-b border-background-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground-950">Prévia da importação</h2>
              <p className="text-[11px] text-foreground-500">
                Confira antes de gravar. Linhas com erro não são enviadas.
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground-600">
              <input
                type="checkbox"
                checked={showOnlyErrors}
                onChange={(event) => setShowOnlyErrors(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-background-300 accent-primary-500"
              />
              Mostrar apenas linhas com erro
            </label>
          </div>

          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-background-100 text-[10px] uppercase tracking-wide text-foreground-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Linha</th>
                  <th className="px-3 py-2 font-semibold">Nome</th>
                  <th className="px-3 py-2 font-semibold">CPF</th>
                  <th className="px-3 py-2 font-semibold">Função</th>
                  <th className="px-3 py-2 font-semibold">Estabelecimento</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-3 py-2 font-semibold">Validação</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr
                    key={row.line}
                    className={`border-t border-background-100 ${row.errors.length > 0 ? "bg-accent-50/60" : ""}`}
                  >
                    <td className="px-3 py-2 text-foreground-400">{row.line}</td>
                    <td className="px-3 py-2 font-medium text-foreground-900">{row.data.name || "—"}</td>
                    <td className="px-3 py-2 text-foreground-600">{row.data.cpf || "—"}</td>
                    <td className="px-3 py-2 text-foreground-600">{row.data.roleFunction || "—"}</td>
                    <td className="px-3 py-2 text-foreground-600">{row.data.establishment || "—"}</td>
                    <td className="px-3 py-2 text-foreground-600">{row.data.status || "Ativo"}</td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                          <i className="ri-check-line"></i>
                          Pronta
                        </span>
                      ) : (
                        <span className="block text-[10px] leading-relaxed text-accent-900">
                          {row.errors.join(" ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-foreground-500">
                      Nenhuma linha com erro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-background-200 bg-background-50">
        <div className="border-b border-background-200 px-4 py-3">
          <h2 className="text-sm font-bold text-foreground-950">Últimas importações</h2>
          <p className="text-[11px] text-foreground-500">Cada lote fica registrado na auditoria, com autor, empresa e data/hora.</p>
        </div>
        <div className="divide-y divide-background-100">
          {history.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-foreground-500">Nenhuma importação registrada ainda.</p>
          )}
          {history.map((item) => (
            <div key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground-900">
                  {item.target_company_name ?? "Empresa removida"}
                </p>
                <p className="mt-0.5 text-[11px] text-foreground-500">{historySummary(item.detail)}</p>
              </div>
              <p className="shrink-0 text-[11px] text-foreground-500">
                {item.actor_name ?? "Superadministrador"} · {formatDateTime(item.created_at)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}