import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSession } from "@/pages/app/context";
import BatchHistoryCard from "@/pages/app/modules/documentos/components/BatchHistoryCard";
import {
  fetchBatchHistory,
  formatHistoryDay,
  groupHistoryByBatch,
  type BatchHistoryGroup,
  type BatchHistoryRow,
} from "@/pages/app/modules/documentos/batchPrintHistory";
import { setBatchConfig } from "@/pages/app/modules/documentos/batchPrintStore";
import type { BatchTypeSelection } from "@/pages/app/modules/documentos/batchPrintTypes";

const periodOptions = [
  { id: "7", label: "Últimos 7 dias" },
  { id: "30", label: "Últimos 30 dias" },
  { id: "90", label: "Últimos 90 dias" },
  { id: "365", label: "Últimos 12 meses" },
  { id: "all", label: "Todo o período" },
  { id: "custom", label: "Período personalizado" },
] as const;

type PeriodId = (typeof periodOptions)[number]["id"];

function resolveFromIso(period: PeriodId, customFrom: string): string | null {
  if (period === "all") return null;
  if (period === "custom") {
    if (!customFrom) return null;
    const date = new Date(`${customFrom}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date();
  date.setDate(date.getDate() - Number(period));
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function resolveToTime(period: PeriodId, customTo: string): number | null {
  if (period !== "custom" || !customTo) return null;
  const date = new Date(`${customTo}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * Lotes gerados — histórico da Impressão em Lote.
 *
 * Lê o rastro de auditoria (quem gerou, quais documentos/versões, quando).
 * Os PDFs não ficam armazenados: esta tela é o registro do que foi emitido.
 */
export default function BatchPrintHistoryPage() {
  const navigate = useNavigate();
  const session = useAppSession();

  const [period, setPeriod] = useState<PeriodId>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [collaboratorFilter, setCollaboratorFilter] = useState("");
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<BatchHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const fromIso = resolveFromIso(period, customFrom);

  const load = useCallback(async () => {
    if (!session.subdomain) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchBatchHistory(session.subdomain, fromIso);
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível carregar os lotes gerados. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }, [session.subdomain, fromIso]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const collaboratorOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => map.set(row.collaboratorId, row.collaboratorName));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const toTime = resolveToTime(period, customTo);
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (collaboratorFilter && row.collaboratorId !== collaboratorFilter) return false;
      if (toTime !== null && new Date(row.generatedAt).getTime() > toTime) return false;
      if (!term) return true;
      return (
        row.collaboratorName.toLowerCase().includes(term) ||
        row.fileName.toLowerCase().includes(term) ||
        row.batchRef.toLowerCase().includes(term) ||
        row.items.some((item) => item.typeName.toLowerCase().includes(term))
      );
    });
  }, [rows, collaboratorFilter, period, customTo, search]);

  const groups = useMemo(() => groupHistoryByBatch(filteredRows), [filteredRows]);

  const summary = useMemo(() => {
    const collaborators = new Set(filteredRows.map((row) => row.collaboratorId));
    return [
      { label: "Lotes no período", value: String(groups.length), icon: "ri-printer-cloud-line" },
      { label: "Dossiês gerados", value: String(filteredRows.length), icon: "ri-file-pdf-2-line" },
      { label: "Páginas emitidas", value: String(filteredRows.reduce((sum, row) => sum + row.pageCount, 0)), icon: "ri-file-copy-2-line" },
      { label: "Colaboradores", value: String(collaborators.size), icon: "ri-user-line" },
    ];
  }, [groups.length, filteredRows]);

  const handleRepeat = (group: BatchHistoryGroup) => {
    const collaboratorIds = Array.from(new Set(group.rows.map((row) => row.collaboratorId)));
    const types: BatchTypeSelection[] = [];
    group.rows.forEach((row) => {
      row.items.forEach((item) => {
        if (!item.typeId) return;
        if (types.some((type) => type.typeId === item.typeId)) return;
        types.push({ typeId: item.typeId, label: item.typeName });
      });
    });
    if (collaboratorIds.length === 0 || types.length === 0) return;
    setBatchConfig({ collaboratorIds, types, versionChoice: {}, includeMissing: true });
    navigate("/app/documentos?lote=ajustar");
  };

  const clearFilters = () => {
    setPeriod("30");
    setCustomFrom("");
    setCustomTo("");
    setCollaboratorFilter("");
    setSearch("");
  };

  const filtersActive =
    period !== "30" || Boolean(customFrom) || Boolean(customTo) || Boolean(collaboratorFilter) || Boolean(search);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-history-line"></i>
            Documentos · Impressão em lote
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Lotes gerados
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-foreground-600">
            Histórico auditável de cada lote: quem gerou, quais documentos e versões entraram, quantas páginas e
            quando. Os PDFs reunidos não ficam armazenados — eles são montados na sessão de quem gerou.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/app/documentos")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-arrow-left-line text-base"></i>
            Voltar para Documentos
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/documentos?lote=ajustar")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-printer-cloud-line text-base"></i>
            Nova impressão em lote
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Período</span>
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodId)}
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-56"
              >
                {periodOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </label>

          {period === "custom" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">De</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none focus:border-primary-400"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Até</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none focus:border-primary-400"
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Colaborador</span>
            <div className="relative">
              <select
                value={collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-64"
              >
                <option value="">Todos os colaboradores</option>
                {collaboratorOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Buscar</span>
            <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
              <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
                <i className="ri-search-line text-base"></i>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Lote, arquivo, documento ou colaborador..."
                className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
              />
            </div>
          </label>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar
            </button>
          )}
        </div>

        {period === "custom" && (customFrom || customTo) && (
          <p className="mt-3 text-[11px] text-foreground-500">
            Exibindo de {customFrom ? formatHistoryDay(`${customFrom}T12:00:00`) : "início"} até{" "}
            {customTo ? formatHistoryDay(`${customTo}T12:00:00`) : "hoje"}.
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border border-background-200 bg-background-50 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-100 text-primary-700">
              <i className={`${item.icon} text-base`}></i>
            </span>
            <p className="mt-3 font-heading text-xl font-extrabold text-foreground-950">{item.value}</p>
            <p className="text-[11px] font-medium text-foreground-500">{item.label}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="mt-5 flex flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-lg border border-background-200 bg-background-100"
            ></div>
          ))}
          <p className="flex items-center gap-2 text-xs text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Carregando o rastro de auditoria dos lotes...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-4">
          <div className="flex items-start gap-2.5 text-sm text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-accent-900 transition-colors hover:bg-accent-100"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-file-search-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum lote encontrado</p>
          <p className="max-w-md text-xs leading-relaxed text-foreground-500">
            {rows.length === 0
              ? "Ainda não há lotes registrados para esta empresa no período. Gere uma impressão em lote para começar o histórico."
              : "Os filtros atuais não retornaram lotes. Ajuste o período ou o colaborador para ver mais registros."}
          </p>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-refresh-line"></i>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {groups.map((group, index) => (
            <BatchHistoryCard
              key={group.batchRef}
              group={group}
              defaultExpanded={index === 0}
              onRepeat={handleRepeat}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-100 px-4 py-3 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-shield-check-line mt-0.5 text-base text-primary-700"></i>
        <span>
          Este histórico é o rastro auditável do que foi emitido, restrito à sua empresa. Os arquivos PDF não são
          armazenados pelo sistema: para obter uma cópia, gere novamente a partir dos documentos originais do
          cadastro de cada colaborador.
        </span>
      </div>
    </div>
  );
}