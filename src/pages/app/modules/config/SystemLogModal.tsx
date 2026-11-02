import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import {
  actionLabels,
  areaLabels,
  formatLogDateTime,
  periodRange,
  useSystemLogs,
  type PeriodKey,
} from "@/pages/app/modules/config/systemLogStore";
import {
  exportSystemLogsCsv,
  exportSystemLogsPdf,
} from "@/pages/app/modules/config/systemLogExport";

interface SystemLogModalProps {
  open: boolean;
  onClose: () => void;
}

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "custom", label: "Personalizado" },
];

const AREA_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "company_data", label: "Dados da empresa" },
  { value: "branding", label: "Identidade visual" },
  { value: "epi_rules", label: "Regras de EPI" },
  { value: "caepi_base", label: "Base do CAEPI" },
  { value: "epi", label: "Entregas de EPI" },
  { value: "dds", label: "DDS (Diálogo Diário)" },
  { value: "cipa", label: "CIPA" },
  { value: "qrcodes", label: "QR-Codes e ficha de verificação" },
  { value: "download", label: "Downloads e exportações" },
  { value: "signatures", label: "Assinaturas" },
];

function moduleTone(module: string): string {
  switch (module) {
    case "caepi":
      return "bg-accent-100 text-accent-800";
    case "epi":
    case "dds":
      return "bg-secondary-100 text-secondary-900";
    case "cipa":
      return "bg-primary-100 text-primary-700";
    case "signatures":
      return "bg-secondary-100 text-secondary-900";
    default:
      return "bg-primary-100 text-primary-700";
  }
}

function moduleIcon(module: string): string {
  switch (module) {
    case "caepi":
      return "ri-database-2-line";
    case "epi":
      return "ri-shield-check-line";
    case "dds":
      return "ri-chat-check-line";
    case "cipa":
      return "ri-team-line";
    case "download":
      return "ri-download-2-line";
    case "signatures":
      return "ri-quill-pen-line";
    default:
      return "ri-settings-3-line";
  }
}

/**
 * Valor antigo/novo de um campo no log.
 * Textos longos (como o termo LGPD inteiro) aparecem resumidos e podem ser
 * abertos por inteiro — sem estourar o cartão do registro.
 */
function LogValue({ label, value }: { label: string; value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const texto = value ?? "(vazio)";
  const longo = texto.length > 120;
  const visivel = longo && !expanded ? `${texto.slice(0, 120)}…` : texto;

  return (
    <div className="rounded-md border border-background-200 bg-background-100 px-2.5 py-2">
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">{label}</p>
      <p className="mt-0.5 whitespace-pre-line break-words text-[11px] leading-relaxed text-foreground-700">
        {visivel}
      </p>
      {longo && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-primary-700 hover:text-primary-800"
        >
          <i className={expanded ? "ri-contract-up-down-line" : "ri-expand-up-down-line"}></i>
          {expanded ? "Recolher" : `Ver texto completo (${texto.length} caracteres)`}
        </button>
      )}
    </div>
  );
}

/**
 * Modal de auditoria: linha do tempo completa de tudo que altera dados no banco
 * (Configurações da empresa, Base do CAEPI, Entregas de EPI, DDS, CIPA e
 * Assinaturas), com filtro por período e por tipo de registro. Permite exportar
 * o resultado filtrado em PDF (papel timbrado da empresa) e CSV.
 */
export default function SystemLogModal({ open, onClose }: SystemLogModalProps) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [area, setArea] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);
  const [exportMsg, setExportMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const filters = useMemo(() => {
    const range = periodRange(period, startDate, endDate);
    return { from: range.from, to: range.to, area: area || null };
  }, [period, startDate, endDate, area]);

  const { entries, loading, error, reload } = useSystemLogs(filters, open);

  const caption = useMemo(() => {
    const periodLabel = PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? "";
    const areaLabel = AREA_OPTIONS.find((option) => option.value === area)?.label ?? "Todos os tipos";
    if (period === "custom") {
      const fromLabel = startDate ? startDate.split("-").reverse().join("/") : "início";
      const toLabel = endDate ? endDate.split("-").reverse().join("/") : "hoje";
      return `${fromLabel} a ${toLabel} · ${areaLabel}`;
    }
    return `${periodLabel} · ${areaLabel}`;
  }, [period, area, startDate, endDate]);

  const handleExport = async (kind: "pdf" | "csv") => {
    setExporting(kind);
    setExportMsg(null);
    try {
      const total = kind === "pdf" ? await exportSystemLogsPdf(filters, caption) : await exportSystemLogsCsv(filters);
      setExportMsg({
        tone: "ok",
        text: total
          ? `${total} registro${total === 1 ? "" : "s"} exportado${total === 1 ? "" : "s"} em ${kind.toUpperCase()}.`
          : "Nenhum registro no filtro para exportar.",
      });
    } catch (err) {
      setExportMsg({
        tone: "error",
        text: err instanceof Error ? err.message : "Não foi possível exportar os logs.",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Logs do sistema"
      subtitle="Registro de auditoria de tudo que altera dados no banco."
      icon="ri-history-line"
      size="xl"
    >
      {/* Filtros */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-semibold text-foreground-700">Período</span>
            <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full border border-background-200 bg-background-50 px-1 py-1">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPeriod(option.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    period === option.key
                      ? "bg-primary-500 text-background-50"
                      : "text-foreground-600 hover:bg-background-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {period === "custom" && (
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-foreground-500">Data inicial</span>
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-foreground-500">Data final</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  />
                </label>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1 lg:w-60">
            <span className="text-xs font-semibold text-foreground-700">Tipo de registro</span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
            >
              {AREA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Resumo / ações */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground-600">
            {loading ? "Carregando registros…" : `${entries.length} registro${entries.length === 1 ? "" : "s"} encontrado${entries.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null || loading}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`ri-file-excel-2-line ${exporting === "csv" ? "animate-spin" : ""}`}></i>
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExport("pdf")}
              disabled={exporting !== null || loading}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-background-50 transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-foreground-950"
            >
              <i className={`ri-file-pdf-2-line ${exporting === "pdf" ? "animate-spin" : ""}`}></i>
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`ri-refresh-line ${loading ? "animate-spin" : ""}`}></i>
              Atualizar
            </button>
          </div>
        </div>

        {exportMsg && (
          <div
            className={`flex items-start gap-2.5 rounded-md border px-4 py-2.5 text-xs ${
              exportMsg.tone === "ok"
                ? "border-secondary-300 bg-secondary-50 text-secondary-900 dark:border-secondary-700 dark:bg-secondary-950 dark:text-secondary-100"
                : "border-accent-300 bg-accent-50 text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100"
            }`}
          >
            <i className={`${exportMsg.tone === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} mt-0.5 text-base`}></i>
            <span>{exportMsg.text}</span>
          </div>
        )}

        {/* Lista */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-xs text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span>{error}</span>
          </div>
        )}

        {!error && !loading && entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background-200 text-foreground-500">
              <i className="ri-history-line text-xl"></i>
            </span>
            <p className="text-sm font-medium text-foreground-700">Nenhum registro no período selecionado</p>
            <p className="text-xs text-foreground-500">Ajuste o período ou o tipo de registro para ver mais eventos.</p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.uid} className="rounded-lg border border-background-200 bg-background-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${moduleTone(entry.module)}`}>
                    <i className={moduleIcon(entry.module)}></i>
                    {areaLabels[entry.area ?? ""] ?? "Sistema"}
                  </span>
                  <span className="rounded-full bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-700">
                    {actionLabels[entry.action] ?? entry.action}
                  </span>
                  <span className="text-[11px] text-foreground-500">{formatLogDateTime(entry.createdAt)}</span>
                  {entry.actorName && <span className="text-[11px] text-foreground-500">· {entry.actorName}</span>}
                </div>
                <p className="mt-1.5 text-sm text-foreground-800">{entry.detail}</p>
                {(entry.oldValue || entry.newValue) && (
                  <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <LogValue label="Valor anterior" value={entry.oldValue} />
                    <LogValue label="Valor novo" value={entry.newValue} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}