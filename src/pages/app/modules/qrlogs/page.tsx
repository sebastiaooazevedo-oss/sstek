import { useMemo, useState } from "react";
import ScanLogTable from "@/pages/app/modules/qrcodes/components/ScanLogTable";
import { PeriodFilterBar, periodLabel, usePeriodFilter } from "@/pages/app/components/PeriodFilter";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { scanLogs, scanSources } from "@/mocks/qrcodes";

export default function QrLogsPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const periodFilter = usePeriodFilter(scanLogs.map((l) => l.scannedAt));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scanLogs.filter((log) => {
      const matchTerm =
        !term ||
        log.collaboratorName.toLowerCase().includes(term) ||
        log.device.toLowerCase().includes(term) ||
        log.ip.includes(term);
      const matchSource = !sourceFilter || log.source === sourceFilter;
      const matchResult = !resultFilter || log.result === resultFilter;
      const matchPeriod = periodFilter.matches(log.scannedAt);
      return matchTerm && matchSource && matchResult && matchPeriod;
    });
  }, [search, sourceFilter, resultFilter, periodFilter.value, periodFilter.effectiveMonth]);

  const periodScans = useMemo(
    () => scanLogs.filter((l) => periodFilter.matches(l.scannedAt)),
    [periodFilter.value, periodFilter.effectiveMonth]
  );

  const stats = [
    { label: "Escaneamentos no período", value: String(periodScans.length), icon: "ri-qr-scan-2-line", tone: "primary" },
    { label: "Leituras conformes", value: String(periodScans.filter((l) => l.result === "OK").length), icon: "ri-shield-check-line", tone: "secondary" },
    { label: "Aparelhos distintos", value: String(new Set(periodScans.map((l) => l.device)).size), icon: "ri-smartphone-line", tone: "secondary" },
    { label: "Leituras com alerta", value: String(periodScans.filter((l) => l.result === "Alerta").length), icon: "ri-alert-line", tone: "accent" },
  ];

  const exportHeaders = ["Colaborador", "Data/hora", "Aparelho", "Navegador", "IP", "Localização", "Origem", "Resultado"];
  const buildExportRows = () =>
    filtered.map((l) => [
      l.collaboratorName,
      l.scannedAt,
      l.device,
      l.browser,
      l.ip,
      l.location,
      l.source,
      l.result === "OK" ? "Conforme" : "Alerta",
    ]);

  const handleExportPdf = () => {
    const label = periodLabel(periodFilter.value, periodFilter.months);
    const rows = buildExportRows();
    const body = `
      ${pdfHeader(`Log de escaneamento · ${label}`)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>Escaneamentos no período</span></div>
        <div class="kpi"><b>${filtered.filter((l) => l.result === "OK").length}</b><span>Leituras conformes</span></div>
        <div class="kpi"><b>${filtered.filter((l) => l.result === "Alerta").length}</b><span>Leituras com alerta</span></div>
      </div>
      <h2>Log de escaneamento (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      ${pdfFooter()}
    `;
    printHtml("Log de escaneamento — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("log-escaneamento-sstek.csv", exportHeaders, buildExportRows());
  };

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const topScanned = [...periodScans]
    .reduce<{ id: string; name: string; count: number }[]>((acc, log) => {
      const found = acc.find((a) => a.id === log.collaboratorId);
      if (found) {
        found.count += 1;
      } else {
        acc.push({ id: log.collaboratorId, name: log.collaboratorName, count: 1 });
      }
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxCount = topScanned.length > 0 ? topScanned[0].count : 1;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-qr-scan-2-line"></i>
            Rastreabilidade
          </p>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            QR-Codes &amp; logs de escaneamento
          </h1>
          <p className="text-sm text-foreground-600">
            Toda leitura de QR-Code fica registrada com data, hora e os dados do aparelho que escaneou.
          </p>
        </div>
        <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneIcon[stat.tone]}`}>
              <i className={`${stat.icon} text-lg`}></i>
            </span>
            <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{stat.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Log completo */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
                <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
                  <i className="ri-search-line text-base"></i>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar por colaborador, aparelho ou IP..."
                  className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Todas as origens</option>
                    {scanSources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>

                <div className="relative flex-1">
                  <select
                    value={resultFilter}
                    onChange={(e) => setResultFilter(e.target.value)}
                    className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Todos os resultados</option>
                    <option value="OK">Conforme</option>
                    <option value="Alerta">Alerta</option>
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>

                {(search || sourceFilter || resultFilter || periodFilter.isActive) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSourceFilter("");
                      setResultFilter("");
                      periodFilter.reset();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-close-circle-line text-base"></i>
                    Limpar
                  </button>
                )}
              </div>

              <PeriodFilterBar
                value={periodFilter.value}
                onChange={periodFilter.setValue}
                months={periodFilter.months}
                effectiveMonth={periodFilter.effectiveMonth}
              />
            </div>

            <div className="mt-4">
              <ScanLogTable logs={filtered} />
            </div>
          </div>
        </div>

        {/* Ranking de leituras */}
        <div className="rounded-lg border border-background-200 bg-background-50 p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-100 text-accent-800">
              <i className="ri-bar-chart-horizontal-line text-base"></i>
            </span>
            <h3 className="text-sm font-bold text-foreground-950">Mais escaneados</h3>
          </div>
          <ul className="mt-4 flex flex-col gap-4">
            {topScanned.map((item, index) => (
              <li key={item.id}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground-800">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background-100 text-[11px] font-bold text-foreground-600">
                      {index + 1}
                    </span>
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold text-foreground-600">{item.count}x</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
                  <div
                    className="h-full rounded-full bg-accent-500"
                    style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }}
                  ></div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-background-200 bg-background-100 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground-800">
              <i className="ri-information-line text-secondary-700"></i>
              Sobre o registro
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground-500">
              Cada leitura guarda data, hora, aparelho, navegador, IP e localização aproximada — evidência útil em
              fiscalização e auditoria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}