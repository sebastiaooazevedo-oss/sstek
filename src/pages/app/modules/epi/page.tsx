import { useEffect, useMemo, useRef, useState } from "react";
import { getInitials } from "@/pages/app/context";
import { epiReasons, type EpiDelivery } from "@/mocks/epi";
import EpiDeliveryModal from "@/pages/app/modules/epi/components/EpiDeliveryModal";
import EpiDetailModal from "@/pages/app/modules/epi/components/EpiDetailModal";
import EpiMonthlyReportModal from "@/pages/app/modules/epi/components/EpiMonthlyReportModal";
import ConsultaCaModal from "@/pages/app/modules/epi/components/ConsultaCaModal";
import EpiReplacementRequestsPanel from "@/pages/app/modules/epi/components/EpiReplacementRequestsPanel";
import { addEpiDelivery, useEpis } from "@/pages/app/modules/epi/epiStore";
import { PeriodFilterBar, periodLabel, usePeriodFilter } from "@/pages/app/components/PeriodFilter";
import ExportMenu from "@/pages/app/components/ExportMenu";
import BackToDocuments from "@/pages/app/components/BackToDocuments";
import ModuleHeader, {
  ModuleToolbar,
  moduleGhostAction,
  modulePrimaryAction,
  moduleToolbarDivider,
} from "@/pages/app/components/ModuleHeader";
import { pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

interface EpiPageProps {
  embedded?: boolean;
  /** Aberto pelo menu "Criar documento" de Documentos: já abre a nova entrega. */
  openCreate?: boolean;
  /** Avisa o pai que o pedido de criação já foi atendido. */
  onCreateConsumed?: () => void;
}

export default function EpiPage({ embedded = false, openCreate = false, onCreateConsumed }: EpiPageProps) {
  const deliveries = useEpis();
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const periodFilter = usePeriodFilter(deliveries.map((d) => d.date));

  const units = useMemo(
    () => Array.from(new Set(deliveries.map((d) => d.establishment).filter((u): u is string => Boolean(u)))).sort(),
    [deliveries]
  );

  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [caOpen, setCaOpen] = useState(false);
  const [detail, setDetail] = useState<EpiDelivery | null>(null);
  const [notice, setNotice] = useState("");
  const createHandled = useRef(false);

  // Vindo do menu "Criar documento", a nova entrega abre uma única vez.
  useEffect(() => {
    if (!openCreate || createHandled.current) return;
    createHandled.current = true;
    setFormOpen(true);
    onCreateConsumed?.();
  }, [openCreate, onCreateConsumed]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deliveries.filter((d) => {
      const matchTerm =
        !term ||
        d.collaboratorName.toLowerCase().includes(term) ||
        d.collaboratorRole.toLowerCase().includes(term) ||
        d.area.toLowerCase().includes(term) ||
        d.items.some((i) => i.name.toLowerCase().includes(term) || i.ca.includes(term));
      const matchReason = !reasonFilter || d.reason === reasonFilter;
      const matchStatus = !statusFilter || d.status === statusFilter;
      const matchUnit = !unitFilter || d.establishment === unitFilter;
      const matchPeriod = periodFilter.matches(d.date);
      return matchTerm && matchReason && matchStatus && matchUnit && matchPeriod;
    });
  }, [deliveries, search, reasonFilter, statusFilter, unitFilter, periodFilter.value, periodFilter.effectiveMonth]);

  const periodDeliveries = useMemo(
    () => deliveries.filter((d) => periodFilter.matches(d.date)),
    [deliveries, periodFilter.value, periodFilter.effectiveMonth]
  );

  const stats = useMemo(() => {
    const totalItems = periodDeliveries.reduce(
      (sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
    return [
      { label: "Entregas registradas", value: `${periodDeliveries.length}`, icon: "ri-shirt-line", tone: "primary" },
      { label: "Itens entregues", value: `${totalItems}`, icon: "ri-stack-line", tone: "secondary" },
      {
        label: "Aceites assinados",
        value: `${periodDeliveries.filter((d) => d.status === "Assinada").length}`,
        icon: "ri-verified-badge-line",
        tone: "secondary",
      },
      {
        label: "Aceites pendentes",
        value: `${periodDeliveries.filter((d) => d.status === "Pendente").length}`,
        icon: "ri-timer-line",
        tone: "accent",
      },
    ];
  }, [periodDeliveries]);

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const handleCreate = (delivery: EpiDelivery) => {
    addEpiDelivery(delivery);
    setNotice(
      delivery.status === "Assinada"
        ? `Entrega de EPI para ${delivery.collaboratorName} registrada, com aceite assinado e Ficha de EPI gerada em Documentos.`
        : `Entrega de EPI para ${delivery.collaboratorName} registrada.`
    );
  };

  const hasFilters = Boolean(search || reasonFilter || statusFilter || unitFilter) || periodFilter.isActive;

  const exportHeaders = ["Colaborador", "Função", "Setor", "Unidade", "Motivo", "Data", "Itens (un)", "Aceite"];
  const buildExportRows = () =>
    filtered.map((d) => [
      d.collaboratorName,
      d.collaboratorRole,
      d.area,
      d.establishment || "—",
      d.reason,
      d.date,
      String(d.items.reduce((s, i) => s + i.quantity, 0)),
      d.status === "Assinada" ? "Assinado" : "Pendente",
    ]);

  const handleExportPdf = () => {
    const label = periodLabel(periodFilter.value, periodFilter.months);
    const rows = buildExportRows();
    const totalItems = filtered.reduce(
      (sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
    const body = `
      ${pdfHeader(`Ficha de EPI · ${label}`)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>Entregas no período</span></div>
        <div class="kpi"><b>${totalItems}</b><span>Itens entregues</span></div>
        <div class="kpi"><b>${filtered.filter((d) => d.status === "Pendente").length}</b><span>Aceites pendentes</span></div>
      </div>
      <h2>Entregas de EPI (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      ${pdfFooter()}
    `;
    printHtml("Ficha de EPI — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("ficha-epi-sstek.csv", exportHeaders, buildExportRows());
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho no padrão único do portal */}
      <ModuleHeader
        compact={embedded}
        beforeBadge={embedded ? undefined : <BackToDocuments />}
        badgeIcon="ri-shirt-line"
        badgeLabel="Controle de EPI"
        title="Ficha de EPI"
        subtitle="Registre as entregas de EPI com CA e colete o aceite por assinatura do colaborador."
        actions={
          <ModuleToolbar>
            <button type="button" onClick={() => setFormOpen(true)} className={modulePrimaryAction}>
              <i className="ri-add-line text-base"></i>
              Nova entrega de EPI
            </button>
            <span className={moduleToolbarDivider} aria-hidden="true"></span>
            <button type="button" onClick={() => setCaOpen(true)} className={moduleGhostAction}>
              <i className="ri-search-eye-line text-base"></i>
              Consultar CA
            </button>
            <button type="button" onClick={() => setReportOpen(true)} className={moduleGhostAction}>
              <i className="ri-file-chart-line text-base"></i>
              Relatório mensal
            </button>
            <span className={moduleToolbarDivider} aria-hidden="true"></span>
            <ExportMenu
              variant="ghost"
              onExportPdf={handleExportPdf}
              onExportCsv={handleExportCsv}
              disabled={filtered.length === 0}
            />
          </ModuleToolbar>
        }
      />

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

      <EpiReplacementRequestsPanel />

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
              placeholder="Buscar por colaborador, função, setor ou item..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 md:w-80"
            />
          </div>

          <div className="relative">
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-52"
            >
              <option value="">Todos os motivos</option>
              {epiReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
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
              <option value="Assinada">Assinado</option>
              <option value="Pendente">Pendente</option>
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
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setReasonFilter("");
                setStatusFilter("");
                setUnitFilter("");
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
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Colaborador</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Equipamentos</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Motivo</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Data</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Aceite</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-background-100 transition-colors last:border-0 hover:bg-background-50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-xs font-bold text-secondary-900">
                        {getInitials(d.collaboratorName)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground-950">{d.collaboratorName}</p>
                        <p className="truncate text-xs text-foreground-500">
                          {d.collaboratorRole} · {d.area}
                          {d.establishment && ` · ${d.establishment}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-foreground-800">
                      {d.items.reduce((s, i) => s + i.quantity, 0)} unidade(s) · {d.items.length} tipo(s)
                    </p>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      {d.items.map((i) => i.name).join(", ")}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-medium text-foreground-700">
                      {d.reason}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-sm text-foreground-700">{d.date}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        d.status === "Assinada" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className={d.status === "Assinada" ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
                      {d.status === "Assinada" ? "Assinado" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetail(d)}
                        title="Ver ficha de EPI"
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-eye-line text-base"></i>
                        Ver ficha
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-shirt-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhuma entrega de EPI encontrada</p>
            <p className="text-xs text-foreground-500">Ajuste os filtros ou registre uma nova entrega com aceite.</p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-add-line"></i>
              Nova entrega de EPI
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-background-200 px-5 py-4">
            <p className="text-xs text-foreground-500">
              Mostrando <strong className="font-semibold text-foreground-800">{filtered.length}</strong> entrega(s)
            </p>
            <p className="text-xs text-foreground-400">Aceite por assinatura disponível em cada ficha</p>
          </div>
        )}
      </div>

      <EpiDeliveryModal open={formOpen} onClose={() => setFormOpen(false)} onCreate={handleCreate} />
      <EpiDetailModal delivery={detail} onClose={() => setDetail(null)} />
      <EpiMonthlyReportModal open={reportOpen} onClose={() => setReportOpen(false)} deliveries={deliveries} />
      <ConsultaCaModal open={caOpen} onClose={() => setCaOpen(false)} />
    </div>
  );
}