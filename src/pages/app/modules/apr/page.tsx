import { useEffect, useMemo, useRef, useState } from "react";
import { aprAreas, type AprRecord } from "@/mocks/apr";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import AprFormModal from "@/pages/app/modules/apr/components/AprFormModal";
import AprDetailModal from "@/pages/app/modules/apr/components/AprDetailModal";
import AprMonthlyReportModal from "@/pages/app/modules/apr/components/AprMonthlyReportModal";
import { riskLevel } from "@/pages/app/modules/apr/aprUtils";
import { addApr, useAprs } from "@/pages/app/modules/apr/aprStore";
import { PeriodFilterBar, periodLabel, usePeriodFilter } from "@/pages/app/components/PeriodFilter";
import ExportMenu from "@/pages/app/components/ExportMenu";
import BackToDocuments from "@/pages/app/components/BackToDocuments";
import { pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

interface AprPageProps {
  embedded?: boolean;
  /** Aberto pelo menu "Criar documento" de Documentos: já abre a nova APR. */
  openCreate?: boolean;
  /** Avisa o pai que o pedido de criação já foi atendido. */
  onCreateConsumed?: () => void;
}

export default function AprPage({ embedded = false, openCreate = false, onCreateConsumed }: AprPageProps) {
  const records = useAprs();
  const [search, setSearch] = useState("");
  const [requestFilter, setRequestFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const periodFilter = usePeriodFilter(records.map((r) => r.date));

  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detail, setDetail] = useState<AprRecord | null>(null);
  const [notice, setNotice] = useState("");
  const createHandled = useRef(false);

  // Vindo do menu "Criar documento", a nova APR abre uma única vez.
  useEffect(() => {
    if (!openCreate || createHandled.current) return;
    createHandled.current = true;
    setFormOpen(true);
    onCreateConsumed?.();
  }, [openCreate, onCreateConsumed]);

  const criticalOf = (record: AprRecord) =>
    record.risks.some((r) => riskLevel(r.severity, r.probability).tone === "accent");

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.establishment) set.add(r.establishment);
    });
    collaboratorEstablishments.forEach((u) => set.add(u));
    return Array.from(set);
  }, [records]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchTerm =
        !term ||
        r.title.toLowerCase().includes(term) ||
        r.requestNumber.toLowerCase().includes(term) ||
        r.activity.toLowerCase().includes(term) ||
        r.responsible.toLowerCase().includes(term) ||
        r.area.toLowerCase().includes(term) ||
        r.signatures.some((s) => s.collaboratorName.toLowerCase().includes(term));
      const requestTerm = requestFilter.trim().toLowerCase();
      const matchRequest =
        !requestTerm ||
        r.requestNumber.toLowerCase().includes(requestTerm) ||
        (requestTerm.replace(/\D/g, "").length > 2 &&
          r.requestNumber.replace(/\D/g, "").includes(requestTerm.replace(/\D/g, "")));
      const matchArea = !areaFilter || r.area === areaFilter;
      const matchUnit = !unitFilter || r.establishment === unitFilter;
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchPeriod = periodFilter.matches(r.date);
      return matchTerm && matchRequest && matchArea && matchUnit && matchStatus && matchPeriod;
    });
  }, [records, search, requestFilter, areaFilter, unitFilter, statusFilter, periodFilter]);

  const periodRecords = useMemo(
    () => records.filter((r) => periodFilter.matches(r.date)),
    [records, periodFilter.value, periodFilter.effectiveMonth]
  );

  const stats = useMemo(() => {
    const totalRisks = periodRecords.reduce((sum, r) => sum + r.risks.length, 0);
    const totalSignatures = periodRecords.reduce((sum, r) => sum + r.signatures.filter((s) => s.signature).length, 0);
    return [
      { label: "APRs registradas", value: `${periodRecords.length}`, icon: "ri-clipboard-line", tone: "primary" },
      { label: "Riscos mapeados", value: `${totalRisks}`, icon: "ri-alert-line", tone: "secondary" },
      { label: "Aceites coletados", value: `${totalSignatures}`, icon: "ri-verified-badge-line", tone: "secondary" },
      {
        label: "APRs com pendência",
        value: `${periodRecords.filter((r) => r.status === "Pendente").length}`,
        icon: "ri-timer-line",
        tone: "accent",
      },
    ];
  }, [periodRecords]);

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const handleCreate = (record: AprRecord) => {
    addApr(record);
    const concluded = record.status === "Concluída" || record.signatures.every((s) => s.signature);
    setNotice(
      concluded
        ? `APR "${record.title}" concluída e registrada em Documentos.`
        : `APR "${record.title}" registrada com ${record.signatures.length} executante(s).`
    );
  };

  const hasFilters =
    Boolean(search || requestFilter || areaFilter || unitFilter || statusFilter) || periodFilter.isActive;

  const exportHeaders = [
    "Nº da solicitação",
    "Título",
    "Atividade",
    "Unidade",
    "Setor",
    "Data",
    "Responsável",
    "Origem",
    "Riscos",
    "Aceites",
    "Situação",
  ];
  const buildExportRows = () =>
    filtered.map((r) => {
      const signed = r.signatures.filter((s) => s.signature).length;
      return [
        r.requestNumber || "—",
        r.title,
        r.activity,
        r.establishment || "—",
        r.area,
        r.date,
        r.responsible,
        r.origin === "colaborador" ? "Colaborador" : "Gestão",
        String(r.risks.length),
        `${signed}/${r.signatures.length}`,
        r.status === "Concluída" ? "Concluído" : "Pendente",
      ];
    });

  const handleExportPdf = () => {
    const label = periodLabel(periodFilter.value, periodFilter.months);
    const rows = buildExportRows();
    const totalRisks = filtered.reduce((sum, r) => sum + r.risks.length, 0);
    const concluded = filtered.filter((r) => r.status === "Concluída").length;
    const body = `
      ${pdfHeader(`APR · ${label}`)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>APRs no período</span></div>
        <div class="kpi"><b>${totalRisks}</b><span>Riscos mapeados</span></div>
        <div class="kpi"><b>${concluded}</b><span>APRs concluídas</span></div>
      </div>
      <h2>APRs (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      ${pdfFooter()}
    `;
    printHtml("APR — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("apr-sstek.csv", exportHeaders, buildExportRows());
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {!embedded && <BackToDocuments />}
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-clipboard-line"></i>
            Gestão de riscos
          </p>
          <h1
            className={`mt-2 font-heading font-extrabold tracking-tight text-foreground-950 ${
              embedded ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
            }`}
          >
            APR · Análise Preliminar de Risco
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Avalie perigos e medidas de controle de cada atividade e colete o aceite por assinatura dos executantes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} disabled={filtered.length === 0} />
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-file-chart-line text-base"></i>
            Relatório mensal
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Nova APR
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

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

      {/* Lista */}
      <div className="mt-6 rounded-lg border border-background-200 bg-background-50">
        <div className="border-b border-background-200 p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, atividade, responsável ou executante..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 md:w-80"
            />
          </div>

          <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-hashtag text-base"></i>
            </span>
            <input
              type="search"
              value={requestFilter}
              onChange={(e) => setRequestFilter(e.target.value)}
              placeholder="Nº da solicitação"
              aria-label="Filtrar por número da solicitação"
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 sm:w-44"
            />
          </div>

          <div className="relative">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-52"
            >
              <option value="">Todos os setores</option>
              {aprAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-56"
            >
              <option value="">Todas as unidades</option>
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-44"
            >
              <option value="">Todos os aceites</option>
              <option value="Concluída">Concluído</option>
              <option value="Pendente">Pendente</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRequestFilter("");
                setAreaFilter("");
                setUnitFilter("");
                setStatusFilter("");
                periodFilter.reset();
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100 lg:ml-auto"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar filtros
            </button>
          )}
          </div>

          <PeriodFilterBar
            value={periodFilter.value}
            onChange={periodFilter.setValue}
            months={periodFilter.months}
            effectiveMonth={periodFilter.effectiveMonth}
            className="mt-3"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">APR / Atividade</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Solicitação</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Setor</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Data</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Responsável</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Riscos</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Aceites</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const signed = r.signatures.filter((s) => s.signature).length;
                return (
                  <tr key={r.id} className="border-b border-background-100 transition-colors last:border-0 hover:bg-background-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                          <i className="ri-clipboard-line text-lg"></i>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground-950">{r.title}</p>
                          <p className="truncate text-xs text-foreground-500">{r.activity}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="whitespace-nowrap text-xs font-bold text-foreground-900">
                        {r.requestNumber || "—"}
                      </p>
                      {r.origin === "colaborador" && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary-700">
                          <i className="ri-user-line"></i>
                          Colaborador
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-medium text-foreground-700">
                        {r.area}
                      </span>
                      {r.establishment && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-foreground-400">
                          <i className="ri-building-2-line"></i>
                          <span className="truncate">{r.establishment}</span>
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-foreground-700">{r.date}</td>
                    <td className="px-5 py-3.5 text-sm text-foreground-700">{r.responsible}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-foreground-700">
                        <i className="ri-alert-line text-foreground-500"></i>
                        {r.risks.length}
                        {criticalOf(r) && (
                          <span className="ml-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-800">
                            crítico
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          r.status === "Concluída" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                        }`}
                      >
                        <i className={r.status === "Concluída" ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
                        {signed}/{r.signatures.length}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetail(r)}
                          title="Ver APR"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-eye-line text-base"></i>
                          Ver APR
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-clipboard-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhuma APR encontrada</p>
            <p className="text-xs text-foreground-500">Ajuste os filtros ou registre uma nova análise de risco.</p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-add-line"></i>
              Nova APR
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-background-200 px-5 py-4">
            <p className="text-xs text-foreground-500">
              Mostrando <strong className="font-semibold text-foreground-800">{filtered.length}</strong> APR(s)
            </p>
            <p className="text-xs text-foreground-400">Aceite por assinatura disponível em cada APR</p>
          </div>
        )}
      </div>

      <AprFormModal open={formOpen} onClose={() => setFormOpen(false)} onCreate={handleCreate} />
      <AprDetailModal record={detail} onClose={() => setDetail(null)} />
      <AprMonthlyReportModal open={reportOpen} onClose={() => setReportOpen(false)} records={records} />
    </div>
  );
}