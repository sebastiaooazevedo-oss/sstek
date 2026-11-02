import { useEffect, useMemo, useRef, useState } from "react";
import { ddsThemes, type DdsRecord } from "@/mocks/dds";
import { addDds, useDds } from "@/pages/app/modules/dds/ddsStore";
import DdsFormModal from "@/pages/app/modules/dds/components/DdsFormModal";
import DdsDetailModal from "@/pages/app/modules/dds/components/DdsDetailModal";
import DdsMonthlyReportModal from "@/pages/app/modules/dds/components/DdsMonthlyReportModal";
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
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { PermissionLockNote } from "@/pages/app/components/PermissionGate";

type StatusFilter = "" | DdsRecord["status"];

interface DdsPageProps {
  embedded?: boolean;
  /** Aberto pelo menu "Criar documento" de Documentos: já abre o formulário. */
  openCreate?: boolean;
  /** Avisa o pai que o pedido de criação já foi atendido. */
  onCreateConsumed?: () => void;
}

export default function DdsPage({ embedded = false, openCreate = false, onCreateConsumed }: DdsPageProps) {
  const records = useDds();
  const { can } = usePermissions();
  const canCreate = can("dds.create");
  const canReport = can("dds.report");
  const canExport = can("tenant.reports");
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [unitFilter, setUnitFilter] = useState("");
  const periodFilter = usePeriodFilter(records.map((r) => r.date));

  const units = useMemo(
    () => Array.from(new Set(records.map((r) => r.establishment).filter((u): u is string => Boolean(u)))).sort(),
    [records]
  );

  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detail, setDetail] = useState<DdsRecord | null>(null);
  const [notice, setNotice] = useState("");
  const createHandled = useRef(false);

  // Vindo do menu "Criar documento", o formulário abre uma única vez.
  useEffect(() => {
    if (!openCreate || createHandled.current) return;
    createHandled.current = true;
    if (canCreate) setFormOpen(true);
    else setNotice("Seu perfil não tem permissão para criar DDS.");
    onCreateConsumed?.();
  }, [openCreate, onCreateConsumed, canCreate]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchTerm =
        !term ||
        r.title.toLowerCase().includes(term) ||
        r.facilitator.toLowerCase().includes(term) ||
        r.theme.toLowerCase().includes(term) ||
        r.area.toLowerCase().includes(term);
      const matchTheme = !themeFilter || r.theme === themeFilter;
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchUnit = !unitFilter || r.establishment === unitFilter;
      const matchPeriod = periodFilter.matches(r.date);
      return matchTerm && matchTheme && matchStatus && matchUnit && matchPeriod;
    });
  }, [records, search, themeFilter, statusFilter, unitFilter, periodFilter]);

  const periodRecords = useMemo(
    () => records.filter((r) => periodFilter.matches(r.date)),
    [records, periodFilter.value, periodFilter.effectiveMonth]
  );

  const stats = useMemo(() => {
    const totalParticipants = periodRecords.reduce((sum, r) => sum + r.participants, 0);
    const scheduled = periodRecords.filter((r) => r.status === "Agendado").length;
    const themeCount = new Map<string, number>();
    periodRecords.forEach((r) => themeCount.set(r.theme, (themeCount.get(r.theme) || 0) + 1));
    const topTheme = [...themeCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return [
      { label: "DDS registrados", value: `${periodRecords.length}`, icon: "ri-presentation-line", tone: "primary" },
      { label: "Participações", value: `${totalParticipants}`, icon: "ri-team-line", tone: "secondary" },
      { label: "DDS agendados", value: `${scheduled}`, icon: "ri-calendar-schedule-line", tone: "accent" },
      { label: "Tema mais recorrente", value: topTheme, small: true, icon: "ri-price-tag-3-line", tone: "secondary" },
    ];
  }, [periodRecords]);

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const handleCreate = (record: DdsRecord) => {
    if (!canCreate) {
      setNotice("Seu perfil não tem permissão para criar DDS.");
      return;
    }
    addDds(record);
    setNotice(`DDS "${record.title}" registrado com sucesso.`);
  };

  const exportHeaders = ["Data", "Hora", "Título", "Tema", "Facilitador", "Setor", "Unidade", "Participantes", "Situação"];
  const buildExportRows = () =>
    filtered.map((r) => [
      r.date,
      r.time,
      r.title,
      r.theme,
      r.facilitator,
      r.area,
      r.establishment || "—",
      String(r.participants),
      r.status,
    ]);

  const handleExportPdf = () => {
    const label = periodLabel(periodFilter.value, periodFilter.months);
    const rows = buildExportRows();
    const participations = filtered.reduce((sum, r) => sum + r.participants, 0);
    const body = `
      ${pdfHeader(`DDS · ${label}`)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>DDS no período</span></div>
        <div class="kpi"><b>${participations}</b><span>Participações</span></div>
        <div class="kpi"><b>${filtered.filter((r) => r.status === "Agendado").length}</b><span>Agendados</span></div>
      </div>
      <h2>DDS (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      ${pdfFooter()}
    `;
    printHtml("DDS — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("dds-sstek.csv", exportHeaders, buildExportRows());
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho no padrão único do portal */}
      <ModuleHeader
        compact={embedded}
        beforeBadge={embedded ? undefined : <BackToDocuments />}
        badgeIcon="ri-presentation-line"
        badgeLabel="Diálogo Diário de Segurança"
        title="DDS"
        subtitle="Registre os diálogos diários com fotos, facilitador, participantes e tópicos abordados."
        actions={
          <ModuleToolbar>
            {canCreate ? (
              <button type="button" onClick={() => setFormOpen(true)} className={modulePrimaryAction}>
                <i className="ri-add-line text-base"></i>
                Novo DDS
              </button>
            ) : (
              <PermissionLockNote text="Criar DDS bloqueado" />
            )}
            {canReport && (
              <>
                <span className={moduleToolbarDivider} aria-hidden="true"></span>
                <button type="button" onClick={() => setReportOpen(true)} className={moduleGhostAction}>
                  <i className="ri-file-chart-line text-base"></i>
                  Relatório mensal
                </button>
              </>
            )}
            {canExport && (
              <>
                <span className={moduleToolbarDivider} aria-hidden="true"></span>
                <ExportMenu
                  variant="ghost"
                  onExportPdf={handleExportPdf}
                  onExportCsv={handleExportCsv}
                  disabled={filtered.length === 0}
                />
              </>
            )}
          </ModuleToolbar>
        }
      />

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-900"
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
            <p
              className={`mt-4 font-heading font-extrabold tracking-tight text-foreground-950 ${
                "small" in stat && stat.small ? "text-base leading-snug" : "text-2xl"
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mt-6 rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, facilitador, tema ou setor..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-80"
            />
          </div>

          <div className="relative">
            <select
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-60"
            >
              <option value="">Todos os temas</option>
              {ddsThemes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-44"
            >
              <option value="">Todas as situações</option>
              <option value="Realizado">Realizado</option>
              <option value="Agendado">Agendado</option>
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

          {(search || themeFilter || statusFilter || unitFilter || periodFilter.isActive) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setThemeFilter("");
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

      {/* Grid de cards */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <article
              key={r.id}
              className="flex flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50 transition-colors hover:border-primary-300"
            >
              <button
                type="button"
                onClick={() => setDetail(r)}
                className="relative h-44 w-full overflow-hidden bg-background-100"
                aria-label={`Ver detalhes de ${r.title}`}
              >
                {r.cover ? (
                  <img src={r.cover} alt={r.title} className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-foreground-400">
                    <i className="ri-image-line text-2xl"></i>
                    <span className="text-xs">Sem foto</span>
                  </div>
                )}
                <span
                  className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    r.status === "Realizado"
                      ? "bg-primary-500 text-background-50"
                      : "bg-accent-500 text-background-50"
                  }`}
                >
                  <i className={r.status === "Realizado" ? "ri-checkbox-circle-line" : "ri-calendar-schedule-line"}></i>
                  {r.status}
                </span>
                {r.photos.length > 0 && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-foreground-950/60 px-2.5 py-1 text-[11px] font-semibold text-background-50">
                    <i className="ri-image-2-line"></i>
                    {r.photos.length}
                  </span>
                )}
              </button>

              <div className="flex flex-1 flex-col p-4 md:p-5">
                <div className="flex items-center gap-3 text-xs text-foreground-500">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-calendar-line"></i>
                    {r.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-time-line"></i>
                    {r.time}
                  </span>
                </div>
                <h3 className="mt-2 font-heading text-base font-bold leading-snug text-foreground-950">{r.title}</h3>
                <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                  <i className="ri-price-tag-3-line"></i>
                  {r.theme}
                </span>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-600">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-user-star-line text-foreground-400"></i>
                    {r.facilitator}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-group-line text-foreground-400"></i>
                    {r.area}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-team-line text-foreground-400"></i>
                    {r.participants}
                  </span>
                  {r.establishment && (
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-building-2-line text-foreground-400"></i>
                      {r.establishment}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDetail(r)}
                  className="mt-4 inline-flex items-center gap-2 self-start whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-eye-line text-base"></i>
                  Ver detalhes
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-presentation-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum DDS encontrado</p>
          <p className="text-xs text-foreground-500">Ajuste os filtros ou registre um novo diálogo diário de segurança.</p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-add-line"></i>
              Novo DDS
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-foreground-500">
          Mostrando <strong className="font-semibold text-foreground-800">{filtered.length}</strong> DDS registrado(s)
        </p>
      )}

      <DdsFormModal open={formOpen} onClose={() => setFormOpen(false)} onCreate={handleCreate} />
      <DdsMonthlyReportModal open={reportOpen} onClose={() => setReportOpen(false)} records={records} />
      <DdsDetailModal record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}