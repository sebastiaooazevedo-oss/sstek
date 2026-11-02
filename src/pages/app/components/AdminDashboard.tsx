import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PeriodFilterBar, periodLabel, usePeriodFilter } from "@/pages/app/components/PeriodFilter";
import {
  ChartCard,
  ChartLegend,
  ColumnChart,
  DonutChart,
  HBarChart,
  ProgressMetric,
  StatTile,
  type ChartCategory,
} from "@/pages/app/components/charts";
import DashboardDrilldownModal, {
  type DrilldownColumn,
  type DrilldownRow,
} from "@/pages/app/components/dashboard/DashboardDrilldownModal";
import DashboardRecords from "@/pages/app/components/dashboard/DashboardRecords";
import MoodAttentionCard from "@/pages/app/components/dashboard/MoodAttentionCard";
import MedicalCertificatesCard from "@/pages/app/components/dashboard/MedicalCertificatesCard";
import AbsenteeismCard from "@/pages/app/components/dashboard/AbsenteeismCard";
import { useMedicalCertificates } from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import {
  buildAbsenteeism,
  filterCertificatesByScope,
} from "@/pages/app/modules/meusdocumentos/certificateInsights";
import { useMoodState } from "@/pages/app/mood/moodStore";
import { buildPeople } from "@/pages/app/mood/moodPeople";
import { isoToBr } from "@/pages/app/mood/moodUtils";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import SignaturePanel from "@/pages/app/components/SignaturePanel";
import CipaAlertsPanel from "@/pages/app/modules/cipa/components/CipaAlertsPanel";
import CipaApprovalsPanel from "@/pages/app/modules/cipa/components/CipaApprovalsPanel";
import EpiExpiredCaPanel from "@/pages/app/modules/epi/components/EpiExpiredCaPanel";
import EpiReplacementRequestsPanel from "@/pages/app/modules/epi/components/EpiReplacementRequestsPanel";
import EpiReplacementSlaSummary from "@/pages/app/modules/epi/components/EpiReplacementSlaSummary";
import MoodTeamPanel from "@/pages/app/modules/sentimento/components/MoodTeamPanel";
import { useAprs } from "@/pages/app/modules/apr/aprStore";
import { useEpis } from "@/pages/app/modules/epi/epiStore";
import { useDds } from "@/pages/app/modules/dds/ddsStore";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { useAtas, useCipas } from "@/pages/app/modules/cipa/cipaStore";
import { isAtaFullyApproved } from "@/pages/app/modules/cipa/cipaUtils";
import { useSignatures } from "@/pages/app/signature/signatureStore";
import { collaborators, collaboratorEstablishments } from "@/mocks/collaborators";
import { climateSurvey, expiringDocs, recentEpiDeliveries } from "@/mocks/app";
import { epiExpiryAlerts } from "@/mocks/epi";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";

type TabId = "pendencias" | "aprovacoes" | "registros" | "sentimento";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthKeyOf(date: string): string {
  const parts = date.split(" ")[0].split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1]}`;
}

function monthLabelOf(key: string): string {
  const [, month] = key.split("-");
  return MONTHS_SHORT[Number(month) - 1] ?? key;
}

interface DrilldownState {
  title: string;
  subtitle?: string;
  icon?: string;
  summary?: string;
  columns: DrilldownColumn[];
  rows: DrilldownRow[];
}

const DOC_COLUMNS: DrilldownColumn[] = [
  { key: "name", label: "Documento" },
  { key: "type", label: "Tipo" },
  { key: "owner", label: "Colaborador" },
  { key: "unit", label: "Unidade" },
  { key: "issued", label: "Emissão" },
  { key: "status", label: "Situação", align: "right" },
];

export default function AdminDashboard() {
  const aprs = useAprs();
  const epis = useEpis();
  const ddsRecords = useDds();
  const docs = useDocuments();
  const signatures = useSignatures();
  const cipas = useCipas();
  const atas = useAtas();
  const activeCollaborators = useCollaboratorsList();
  const settings = useSystemSettings();
  const { rows: moodRows } = useMoodState();
  const medicalCertificates = useMedicalCertificates();

  const [tab, setTab] = useState<TabId>("pendencias");
  const [unitFilter, setUnitFilter] = useState("");
  const [drill, setDrill] = useState<DrilldownState | null>(null);

  const periodFilter = usePeriodFilter([
    ...ddsRecords.map((d) => d.date),
    ...aprs.map((a) => a.date),
    ...epis.map((d) => d.date),
    ...docs.map((d) => d.issuedAt),
  ]);
  const periodText = periodLabel(periodFilter.value, periodFilter.months);

  const collabUnitById = useMemo(() => {
    const map = new Map<string, string>();
    activeCollaborators.forEach((c) => {
      if (c.establishment) map.set(c.id, c.establishment);
    });
    return map;
  }, [activeCollaborators]);

  // Unidade do registro: usa a unidade gravada no próprio sentimento e, nos
  // registros antigos (sem unidade), cai para o cadastro do colaborador.
  const moodUnitOf = (entry: { establishment: string; userKey: string }) =>
    entry.establishment || collabUnitById.get(entry.userKey) || "";

  // Sentimento da equipe no mesmo recorte de período e de unidade do restante do dashboard.
  const moodPeriodEntries = useMemo(
    () =>
      moodRows.filter(
        (entry) =>
          periodFilter.matches(isoToBr(entry.moodDate)) && (!unitFilter || moodUnitOf(entry) === unitFilter)
      ),
    [moodRows, periodFilter.matches, unitFilter, collabUnitById]
  );
  const moodPeople = useMemo(() => buildPeople(moodPeriodEntries), [moodPeriodEntries]);

  const collabUnitByName = useMemo(() => {
    const map = new Map<string, string>();
    activeCollaborators.forEach((c) => map.set(c.name, c.establishment || ""));
    return map;
  }, [activeCollaborators]);

  const docUnitOf = (d: { establishment?: string; collaboratorId?: string }) =>
    d.establishment || (d.collaboratorId ? collabUnitById.get(d.collaboratorId) || "" : "");

  const unitOptions = useMemo(() => {
    const units = new Set<string>(collaboratorEstablishments);
    aprs.forEach((a) => a.establishment && units.add(a.establishment));
    epis.forEach((e) => e.establishment && units.add(e.establishment));
    ddsRecords.forEach((d) => d.establishment && units.add(d.establishment));
    docs.forEach((d) => {
      const unit = d.establishment || (d.collaboratorId ? collabUnitById.get(d.collaboratorId) || "" : "");
      if (unit) units.add(unit);
    });
    moodRows.forEach((entry) => {
      const unit = entry.establishment;
      if (unit) units.add(unit);
    });
    return Array.from(units);
  }, [aprs, epis, ddsRecords, docs, collabUnitById, moodRows]);

  const fEpis = unitFilter ? epis.filter((e) => e.establishment === unitFilter) : epis;
  const fDds = unitFilter ? ddsRecords.filter((d) => d.establishment === unitFilter) : ddsRecords;
  const fDocs = unitFilter
    ? docs.filter((d) => {
        const unit = docUnitOf(d);
        return !unit || unit === unitFilter;
      })
    : docs;

  const activeCount = unitFilter
    ? activeCollaborators.filter((c) => c.establishment === unitFilter).length
    : activeCollaborators.length;

  // Absenteísmo apurado a partir dos atestados médicos no mesmo recorte do painel.
  const collabById = useMemo(() => {
    const map = new Map(activeCollaborators.map((c) => [c.id, c] as const));
    return map;
  }, [activeCollaborators]);

  const scopedCertificates = useMemo(
    () => filterCertificatesByScope(medicalCertificates, collabById, { matchesPeriod: periodFilter.matches, unitLabel: unitFilter }),
    [medicalCertificates, collabById, periodFilter.matches, unitFilter]
  );
  const absenteeism = useMemo(() => buildAbsenteeism(scopedCertificates, collabById), [scopedCertificates, collabById]);

  /* ----------------------------- Documentos ----------------------------- */

  const periodDocs = fDocs.filter((d) => periodFilter.matches(d.issuedAt));
  const docsOnTime = periodDocs.filter((d) => d.status === "Em dia").length;
  const docsExpiring = periodDocs.filter((d) => d.status === "Vencendo").length;
  const docsExpired = periodDocs.filter((d) => d.status === "Vencido").length;
  const onTimePct = periodDocs.length > 0 ? Math.round((docsOnTime / periodDocs.length) * 100) : 0;

  const docRowsOf = (list: typeof periodDocs): DrilldownRow[] =>
    list.map((d) => ({
      id: d.id,
      cells: {
        name: d.name,
        type: d.typeName || "—",
        owner: d.collaboratorName || "Corporativo",
        unit: docUnitOf(d) || "Corporativo",
        issued: d.issuedAt || "—",
        status: d.status,
      },
    }));

  const docScope = unitFilter ? `Unidade ${unitFilter}` : "Todas as unidades";

  const openDocs = (label: string, list: typeof periodDocs) =>
    setDrill({
      title: label,
      subtitle: `${docScope} · ${periodText}`,
      icon: "ri-file-list-3-line",
      summary: `${list.length} documento(s) neste recorte.`,
      columns: DOC_COLUMNS,
      rows: docRowsOf(list),
    });

  /* --------------------------- Série mensal ----------------------------- */

  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    fDocs.forEach((d) => periodFilter.matches(d.issuedAt) && monthKeyOf(d.issuedAt) && keys.add(monthKeyOf(d.issuedAt)));
    fDds.forEach((d) => periodFilter.matches(d.date) && monthKeyOf(d.date) && keys.add(monthKeyOf(d.date)));
    fEpis.forEach((d) => periodFilter.matches(d.date) && monthKeyOf(d.date) && keys.add(monthKeyOf(d.date)));
    return Array.from(keys).sort().slice(-6);
  }, [fDocs, fDds, fEpis, periodFilter]);

  const monthCategories: ChartCategory[] = monthKeys.map((key) => ({ key, label: monthLabelOf(key) }));

  const docsByMonth = monthKeys.map((key) =>
    fDocs.filter((d) => periodFilter.matches(d.issuedAt) && monthKeyOf(d.issuedAt) === key)
  );
  const docStatusSeries = [
    { id: "emdia", label: "Em dia", tone: "primary" as const, values: docsByMonth.map((l) => l.filter((d) => d.status === "Em dia").length) },
    { id: "vencendo", label: "Vencendo", tone: "accent" as const, values: docsByMonth.map((l) => l.filter((d) => d.status === "Vencendo").length) },
    { id: "vencido", label: "Vencidos", tone: "secondary" as const, values: docsByMonth.map((l) => l.filter((d) => d.status === "Vencido").length) },
  ];

  const periodEpiList = fEpis.filter((d) => periodFilter.matches(d.date));
  const periodEpiItems = periodEpiList.reduce((sum, d) => sum + d.items.reduce((s, i) => s + i.quantity, 0), 0);
  const periodDdsList = fDds.filter((d) => periodFilter.matches(d.date));
  const ddsParticipations = periodDdsList.reduce((sum, d) => sum + d.participants, 0);
  const ddsWithParticipants = periodDdsList.filter((d) => d.participants > 0).length;

  const activitySeries = [
    {
      id: "dds",
      label: "DDS realizados",
      tone: "primary" as const,
      values: monthKeys.map((key) => fDds.filter((d) => periodFilter.matches(d.date) && monthKeyOf(d.date) === key).length),
    },
    {
      id: "epi",
      label: "Entregas de EPI",
      tone: "secondary" as const,
      values: monthKeys.map((key) => fEpis.filter((d) => periodFilter.matches(d.date) && monthKeyOf(d.date) === key).length),
    },
  ];

  const openMonth = (key: string) => {
    const monthDocs = docsByMonth[monthKeys.indexOf(key)] ?? [];
    const monthDds = fDds.filter((d) => periodFilter.matches(d.date) && monthKeyOf(d.date) === key);
    const monthEpi = fEpis.filter((d) => periodFilter.matches(d.date) && monthKeyOf(d.date) === key);
    const rows: DrilldownRow[] = [
      ...monthDocs.map((d) => ({
        id: `doc-${d.id}`,
        cells: {
          origin: "Documento",
          item: d.name,
          person: d.collaboratorName || "Corporativo",
          detail: d.typeName || "—",
          when: d.issuedAt || "—",
        },
      })),
      ...monthDds.map((d) => ({
        id: `dds-${d.id}`,
        cells: { origin: "DDS", item: d.title, person: d.facilitator, detail: `${d.participants} participante(s)`, when: d.date },
      })),
      ...monthEpi.map((d) => ({
        id: `epi-${d.id}`,
        cells: {
          origin: "EPI",
          item: d.items.map((i) => i.name).join(", ") || "Entrega de EPI",
          person: d.collaboratorName,
          detail: d.status,
          when: d.date,
        },
      })),
    ];
    setDrill({
      title: `Movimentação de ${monthLabelOf(key)}`,
      subtitle: `${docScope} · documentos, DDS e EPI do mês`,
      icon: "ri-calendar-2-line",
      summary: `${monthDocs.length} documento(s), ${monthDds.length} DDS e ${monthEpi.length} entrega(s) de EPI.`,
      columns: [
        { key: "origin", label: "Origem" },
        { key: "item", label: "Registro" },
        { key: "person", label: "Responsável" },
        { key: "detail", label: "Detalhe" },
        { key: "when", label: "Data", align: "right" },
      ],
      rows,
    });
  };

  const openDocStatus = (status: "Em dia" | "Vencendo" | "Vencido") => {
    const labels = { "Em dia": "Documentos em dia", Vencendo: "Documentos a vencer", Vencido: "Documentos vencidos" };
    openDocs(labels[status], periodDocs.filter((d) => d.status === status));
  };

  /* -------------------------- Colaboradores ----------------------------- */

  const byRole = useMemo(() => {
    const map = new Map<string, number>();
    activeCollaborators.forEach((c) => map.set(c.role, (map.get(c.role) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [activeCollaborators]);

  const roleBars = byRole.slice(0, 6).map(([role, count]) => ({
    id: role,
    label: role,
    value: count,
    tone: "primary" as const,
  }));

  const openRole = (role: string) => {
    const list = activeCollaborators.filter((c) => c.role === role);
    setDrill({
      title: `Colaboradores · ${role}`,
      subtitle: docScope,
      icon: "ri-team-line",
      summary: `${list.length} colaborador(es) ativos nesta função.`,
      columns: [
        { key: "name", label: "Colaborador" },
        { key: "role", label: "Função" },
        { key: "area", label: "Área" },
        { key: "unit", label: "Unidade" },
        { key: "status", label: "Situação", align: "right" },
      ],
      rows: list.map((c) => ({
        id: c.id,
        cells: { name: c.name, role: c.role, area: c.area, unit: c.establishment || "—", status: c.status },
      })),
    });
  };

  /* ---------------------------- Coberturas ------------------------------ */

  const signatureCreated = activeCollaborators.filter((c) => signatures[c.id]).length;
  const signatureTotal = activeCollaborators.length || collaborators.length;

  const scopedCipas = unitFilter ? cipas.filter((c) => c.unit === unitFilter) : cipas;
  const scopedAtas = atas.filter((a) => scopedCipas.some((c) => c.id === a.cipaId));
  const approvedAtas = scopedAtas.filter(isAtaFullyApproved).length;

  const openSignatures = () =>
    setDrill({
      title: "Assinaturas pessoais",
      subtitle: docScope,
      icon: "ri-quill-pen-line",
      summary: `${signatureCreated} de ${signatureTotal} colaboradores já criaram a assinatura pessoal.`,
      columns: [
        { key: "name", label: "Colaborador" },
        { key: "role", label: "Função" },
        { key: "unit", label: "Unidade" },
        { key: "status", label: "Situação", align: "right" },
      ],
      rows: activeCollaborators.map((c) => ({
        id: c.id,
        cells: {
          name: c.name,
          role: c.role,
          unit: c.establishment || "—",
          status: signatures[c.id] ? "Criada" : "Pendente",
        },
      })),
    });

  const openAtas = () =>
    setDrill({
      title: "Aprovação de atas da CIPA",
      subtitle: docScope,
      icon: "ri-government-line",
      summary: `${approvedAtas} de ${scopedAtas.length} ata(s) aprovada(s) por completo (presidente + secretário).`,
      columns: [
        { key: "name", label: "Ata" },
        { key: "cipa", label: "Comissão" },
        { key: "date", label: "Data" },
        { key: "status", label: "Aprovação", align: "right" },
      ],
      rows: scopedAtas.map((a) => ({
        id: a.id,
        cells: {
          name: a.title,
          cipa: scopedCipas.find((c) => c.id === a.cipaId)?.name || "—",
          date: a.date || "—",
          status: isAtaFullyApproved(a) ? "Aprovada" : "Pendente",
        },
      })),
    });

  const openClimate = () =>
    setDrill({
      title: "Pesquisa de clima · dimensões",
      subtitle: `${climateSurvey.responded} de ${climateSurvey.total} respostas · índice geral ${climateSurvey.average}`,
      icon: "ri-emotion-line",
      columns: [
        { key: "dimension", label: "Dimensão" },
        { key: "score", label: "Índice (0–10)", align: "right" },
      ],
      rows: climateSurvey.dimensions.map((d) => ({
        id: d.label,
        cells: { dimension: d.label, score: d.value.toFixed(1).replace(".", ",") },
      })),
    });

  /* ------------------------- Pastas operacionais ------------------------ */

  const shownExpiringDocs = unitFilter ? expiringDocs.filter((d) => collabUnitByName.get(d.collaborator) === unitFilter) : expiringDocs;
  const shownRecentEpi = unitFilter ? recentEpiDeliveries.filter((d) => collabUnitByName.get(d.collaborator) === unitFilter) : recentEpiDeliveries;
  const shownEpiExpiry = unitFilter ? epiExpiryAlerts.filter((e) => collabUnitById.get(e.collaboratorId) === unitFilter) : epiExpiryAlerts;
  const signaturesPending = collaborators.filter((c) => !signatures[c.id]).length;

  const openEpiDeliveries = () =>
    setDrill({
      title: "Entregas de EPI no período",
      subtitle: `${docScope} · ${periodText}`,
      icon: "ri-shirt-line",
      summary: `${periodEpiList.length} entrega(s) e ${periodEpiItems} item(ns) entregues.`,
      columns: [
        { key: "collaborator", label: "Colaborador" },
        { key: "items", label: "Itens" },
        { key: "date", label: "Data" },
        { key: "status", label: "Aceite", align: "right" },
      ],
      rows: periodEpiList.map((d) => ({
        id: d.id,
        cells: {
          collaborator: d.collaboratorName,
          items: d.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") || "—",
          date: d.date,
          status: d.status,
        },
      })),
    });

  const openDds = () =>
    setDrill({
      title: "DDS no período",
      subtitle: `${docScope} · ${periodText}`,
      icon: "ri-presentation-line",
      summary: `${periodDdsList.length} DDS registrado(s) e ${ddsParticipations} participação(ões).`,
      columns: [
        { key: "title", label: "DDS" },
        { key: "theme", label: "Tema" },
        { key: "facilitator", label: "Facilitador" },
        { key: "participants", label: "Participantes", align: "right" },
        { key: "date", label: "Data" },
      ],
      rows: periodDdsList.map((d) => ({
        id: d.id,
        cells: {
          title: d.title,
          theme: d.theme || "—",
          facilitator: d.facilitator || "—",
          participants: `${d.participants}`,
          date: d.date,
        },
      })),
    });

  const openColaboradores = () =>
    setDrill({
      title: "Colaboradores ativos",
      subtitle: docScope,
      icon: "ri-team-line",
      summary: `${activeCount} colaborador(es) ativos no cadastro.`,
      columns: [
        { key: "name", label: "Colaborador" },
        { key: "role", label: "Função" },
        { key: "unit", label: "Unidade" },
        { key: "status", label: "Situação", align: "right" },
      ],
      rows: activeCollaborators.map((c) => ({
        id: c.id,
        cells: { name: c.name, role: c.role, unit: c.establishment || "—", status: c.status },
      })),
    });

  /* ----------------------------- Exportação ----------------------------- */

  const handleExportSummary = () => {
    const unitLabel = unitFilter || "Todas as unidades";
    const kpiCards = [
      { label: "Colaboradores ativos", value: `${activeCount}` },
      { label: "Documentos em dia", value: `${onTimePct}%` },
      { label: "Vencendo no período", value: `${docsExpiring}` },
      { label: "EPIs entregues no período", value: `${periodEpiItems}` },
    ]
      .map((k) => `<div class="kpi"><b>${escapeHtml(k.value)}</b><span>${escapeHtml(k.label)}</span></div>`)
      .join("");

    const rows = [
      ["Documentos em dia", `${docsOnTime}`],
      ["Documentos a vencer", `${docsExpiring}`],
      ["Documentos vencidos", `${docsExpired}`],
      ["DDS realizados", `${periodDdsList.length}`],
      ["Participações em DDS", `${ddsParticipations}`],
      ["Entregas de EPI", `${periodEpiList.length}`],
      ["Itens de EPI entregues", `${periodEpiItems}`],
      ["Assinaturas criadas", `${signatureCreated} de ${signatureTotal}`],
      ["Atas da CIPA aprovadas", `${approvedAtas} de ${scopedAtas.length}`],
      ["Dias de afastamento (atestados)", `${absenteeism.totalDays}`],
      ["Colaboradores com atestado", `${absenteeism.people}`],
      ["Média de dias por colaborador afastado", `${String(absenteeism.daysPerPerson).replace(".", ",")}`],
      ...absenteeism.units.map((unit) => [`Absenteísmo · ${unit.unit}`, `${unit.days} dia(s)`] as [string, string]),
    ]
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
      .join("");

    const body = `${pdfHeader(`Resumo do período · ${unitFilter ? `${unitFilter} · ` : ""}${periodText}`)}
      <h1>Resumo executivo de indicadores</h1>
      <p class="muted">Painel consolidado do Administrador — período: ${escapeHtml(periodText)} · Unidade: ${escapeHtml(unitLabel)}.</p>
      <div class="kpis">${kpiCards}</div>
      <h2>Indicadores consolidados</h2>
      <table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>
      ${pdfFooter()}`;

    printHtml("Resumo executivo — SSTEK", body);
  };

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "pendencias", label: "Pendências", icon: "ri-alarm-warning-line", count: shownEpiExpiry.length + shownExpiringDocs.length },
    { id: "aprovacoes", label: "Aprovações & assinaturas", icon: "ri-verified-badge-line", count: scopedAtas.length - approvedAtas },
    { id: "registros", label: "Documentos & EPI", icon: "ri-file-list-3-line" },
    { id: "sentimento", label: "Sentimento da equipe", icon: "ri-emotion-line" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho executivo */}
      <section className="rounded-xl border border-background-200 bg-background-50 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-600">Painel executivo</p>
            <h1 className="mt-1 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
              Conformidade da operação
            </h1>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-foreground-500 md:text-sm">
              Visão consolidada de documentos, EPI, DDS e CIPA. Passe o mouse nos gráficos para ver os valores e clique para
              abrir os registros por trás de cada número.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1.5 text-[11px] font-semibold text-secondary-900">
                <i className="ri-building-4-line"></i>
                {unitFilter || "Todas as unidades"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1.5 text-[11px] font-semibold text-secondary-900">
                <i className="ri-calendar-2-line"></i>
                {periodText}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1.5 text-[11px] font-semibold text-primary-700">
                <i className="ri-file-shield-2-line"></i>
                {periodDocs.length} documentos monitorados
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="relative w-full sm:w-64">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-xs font-semibold text-foreground-900 outline-none focus:border-primary-400"
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
            <button
              type="button"
              onClick={handleExportSummary}
              className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-file-pdf-2-line text-base"></i>
              Exportar resumo
            </button>
          </div>
        </div>

        <PeriodFilterBar
          value={periodFilter.value}
          onChange={periodFilter.setValue}
          months={periodFilter.months}
          effectiveMonth={periodFilter.effectiveMonth}
          className="mt-5 border-t border-background-200 pt-4"
        />
      </section>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon="ri-team-line"
          label="Colaboradores ativos"
          value={`${activeCount}`}
          detail={unitFilter ? `Vinculados a ${unitFilter}` : "Cadastro da empresa"}
          tone="primary"
          onClick={openColaboradores}
        />
        <StatTile
          icon="ri-file-shield-2-line"
          label="Documentos em dia"
          value={`${onTimePct}%`}
          detail={`${docsOnTime} de ${periodDocs.length} no período`}
          tone="secondary"
          onClick={() => openDocStatus("Em dia")}
        />
        <StatTile
          icon="ri-timer-line"
          label="Vencendo no período"
          value={`${docsExpiring}`}
          detail={`${docsExpired} já vencido(s)`}
          tone="accent"
          onClick={() => openDocStatus("Vencendo")}
        />
        <StatTile
          icon="ri-shirt-line"
          label="EPIs entregues"
          value={`${periodEpiItems}`}
          detail={`${periodEpiList.length} entrega(s) registradas`}
          tone="primary"
          onClick={openEpiDeliveries}
        />
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Emissão de documentos por mês"
          subtitle="Situação dos documentos emitidos em cada mês"
          legend={<ChartLegend items={docStatusSeries.map((s) => ({ label: s.label, tone: s.tone }))} />}
          hint="Passe o mouse para ver os valores · clique na coluna para abrir os registros do mês"
        >
          <ColumnChart
            categories={monthCategories}
            series={docStatusSeries}
            stacked
            height={220}
            onSelect={openMonth}
          />
        </ChartCard>

        <ChartCard
          title="Situação documental"
          subtitle={`${periodDocs.length} documentos no recorte`}
          hint="Passe o mouse no anel ou na legenda · clique para ver os documentos"
        >
          <DonutChart
            centerLabel="documentos"
            onSelect={(id) => openDocStatus(id === "vencendo" ? "Vencendo" : id === "vencido" ? "Vencido" : "Em dia")}
            data={[
              { id: "emdia", label: "Em dia", value: docsOnTime, tone: "primary" },
              { id: "vencendo", label: "Vencendo", value: docsExpiring, tone: "accent" },
              { id: "vencido", label: "Vencidos", value: docsExpired, tone: "secondary" },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Atividade operacional"
          subtitle="DDS realizados x entregas de EPI por mês"
          legend={<ChartLegend items={activitySeries.map((s) => ({ label: s.label, tone: s.tone }))} />}
          hint="Passe o mouse para ver os valores · clique para abrir a movimentação do mês"
        >
          <ColumnChart categories={monthCategories} series={activitySeries} height={220} onSelect={openMonth} />
        </ChartCard>

        <ChartCard
          title="Colaboradores por função"
          subtitle={`${activeCount} colaboradores ativos`}
          hint="Clique em uma função para ver o quadro completo"
        >
          <HBarChart data={roleBars} onSelect={openRole} />
        </ChartCard>
      </div>

      {/* Coberturas */}
      <ChartCard
        title="Cobertura de conformidade"
        subtitle="Indicadores de acompanhamento contínuo"
        hint="Clique em um indicador para abrir o detalhamento"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProgressMetric
            label="Assinaturas pessoais criadas"
            value={signatureCreated}
            total={signatureTotal}
            tone="primary"
            onClick={openSignatures}
          />
          <ProgressMetric
            label="Atas da CIPA aprovadas"
            value={approvedAtas}
            total={scopedAtas.length}
            tone="secondary"
            onClick={openAtas}
          />
          <ProgressMetric
            label="Respostas da pesquisa de clima"
            value={climateSurvey.responded}
            total={climateSurvey.total}
            tone="accent"
            detail={`Índice ${String(climateSurvey.average).replace(".", ",")}`}
            onClick={openClimate}
          />
          <ProgressMetric
            label="DDS com participação registrada"
            value={ddsWithParticipants}
            total={periodDdsList.length}
            tone="primary"
            detail={`${ddsParticipations} participações`}
            onClick={openDds}
          />
        </div>
      </ChartCard>

      {settings.dashboardMoodAttention && (
        <MoodAttentionCard people={moodPeople} periodText={periodText} unitLabel={unitFilter} />
      )}

      <MedicalCertificatesCard
        periodText={periodText}
        unitLabel={unitFilter}
        matchesPeriod={periodFilter.matches}
      />

      <AbsenteeismCard
        periodText={periodText}
        unitLabel={unitFilter}
        matchesPeriod={periodFilter.matches}
      />

      {/* Detalhes operacionais */}
      <section className="rounded-xl border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 p-4 md:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">Detalhes operacionais</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Pendências, aprovações e registros completos — organizados por assunto.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-full bg-background-100 p-1">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-50"
                  }`}
                >
                  <i className={`${item.icon} text-sm`}></i>
                  {item.label}
                  {item.count ? (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        active ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 md:p-5">
          {tab === "pendencias" && (
            <div className="flex flex-col gap-5">
              {signaturesPending > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 p-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                    <i className="ri-quill-pen-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground-950">
                      {signaturesPending} colaborador(es) ainda sem assinatura pessoal criada
                    </p>
                    <p className="mt-0.5 text-xs text-foreground-600">
                      Os documentos assinados por eles continuam pendentes até a criação da assinatura no perfil.
                    </p>
                  </div>
                  <Link
                    to="/app/colaboradores"
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600"
                  >
                    <i className="ri-team-line"></i>
                    Revisar colaboradores
                  </Link>
                </div>
              )}
              <EpiExpiredCaPanel unit={unitFilter} />
              <EpiReplacementSlaSummary unit={unitFilter} />
              <EpiReplacementRequestsPanel unit={unitFilter} />
              <CipaAlertsPanel />
            </div>
          )}

          {tab === "aprovacoes" && (
            <div className="flex flex-col gap-5">
              <SignaturePanel />
              <CipaApprovalsPanel />
            </div>
          )}

          {tab === "registros" && (
            <DashboardRecords
              expiringDocs={shownExpiringDocs}
              recentEpi={shownRecentEpi}
              epiExpiry={shownEpiExpiry}
            />
          )}

          {tab === "sentimento" && <MoodTeamPanel />}
        </div>
      </section>

      <DashboardDrilldownModal
        open={drill !== null}
        onClose={() => setDrill(null)}
        title={drill?.title ?? ""}
        subtitle={drill?.subtitle}
        icon={drill?.icon}
        summary={drill?.summary}
        columns={drill?.columns ?? []}
        rows={drill?.rows ?? []}
      />
    </div>
  );
}