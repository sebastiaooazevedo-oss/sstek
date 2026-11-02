import { useEffect, useState } from "react";
import { useCipas } from "@/pages/app/modules/cipa/cipaStore";
import OverviewTab from "@/pages/app/modules/cipa/components/OverviewTab";
import CipasTab from "@/pages/app/modules/cipa/components/CipasTab";
import AgendaTab from "@/pages/app/modules/cipa/components/AgendaTab";
import AtasTab from "@/pages/app/modules/cipa/components/AtasTab";
import ActionsTab from "@/pages/app/modules/cipa/components/ActionsTab";
import ElectionsTab from "@/pages/app/modules/cipa/components/ElectionsTab";
import InspectionsTab from "@/pages/app/modules/cipa/components/InspectionsTab";
import TechnicalSignatureHistoryTab from "@/pages/app/modules/cipa/components/TechnicalSignatureHistoryTab";
import ModuleHeader from "@/pages/app/components/ModuleHeader";
import { usePermissions } from "@/pages/app/permissions/permissionStore";

interface TabDef {
  id: string;
  label: string;
  icon: string;
}

const tabs: TabDef[] = [
  { id: "visao", label: "Visão geral", icon: "ri-dashboard-3-line" },
  { id: "cipas", label: "Comissões", icon: "ri-government-line" },
  { id: "agenda", label: "Agenda", icon: "ri-calendar-schedule-line" },
  { id: "atas", label: "Atas", icon: "ri-file-text-line" },
  { id: "acoes", label: "Ações", icon: "ri-task-line" },
  { id: "eleicoes", label: "Eleições", icon: "ri-checkbox-multiple-line" },
  { id: "inspecoes", label: "Inspeções", icon: "ri-clipboard-line" },
  { id: "assinaturas", label: "Assinaturas do RT", icon: "ri-shield-keyhole-line" },
];

/** Permissão que governa cada seção da CIPA (null = sempre visível). */
const tabPermissions: Record<string, string | null> = {
  visao: null,
  cipas: null,
  agenda: null,
  atas: "cipa.minutes",
  acoes: "cipa.actions",
  eleicoes: "cipa.elections",
  inspecoes: "cipa.inspections",
  assinaturas: null,
};

export default function CipaPage() {
  const cipas = useCipas();
  const { can } = usePermissions();
  const [tab, setTab] = useState("visao");
  const [cipaFilter, setCipaFilter] = useState("");

  const visibleTabs = tabs.filter((item) => {
    const required = tabPermissions[item.id];
    return !required || can(required);
  });

  // Se o perfil não tem acesso à aba aberta, volta para a visão geral.
  useEffect(() => {
    const required = tabPermissions[tab];
    if (required && !can(required)) setTab("visao");
  }, [tab, can]);

  const activeCipa = cipas.find((c) => c.id === cipaFilter);

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho no padrão único do portal */}
      <ModuleHeader
        badgeIcon="ri-government-line"
        badgeLabel="CIPA"
        title="CIPA"
        subtitle="Gerencie uma ou mais comissões (matriz e filiais): composição e mandato, agenda de reuniões e eventos, atas, plano de ações, processos eleitorais e inspeções com registro fotográfico."
        actions={
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground-400">
              Filtrar por comissão
            </span>
            <div className="relative">
              <select
                value={cipaFilter}
                onChange={(e) => setCipaFilter(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-background-300 bg-background-50 pl-3 pr-9 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400 sm:w-64"
              >
                <option value="">Todas as comissões</option>
                {cipas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </div>
        }
        meta={
          activeCipa ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-foreground-700 dark:text-secondary-100">
              <span className="flex items-center gap-1.5 font-semibold text-secondary-900 dark:text-secondary-200">
                <i className="ri-filter-3-line"></i>
                Exibindo: {activeCipa.name}
              </span>
              <span className="flex items-center gap-1.5">
                <i className="ri-building-2-line text-foreground-400"></i>
                {activeCipa.unit}
              </span>
              <span className="flex items-center gap-1.5">
                <i className="ri-calendar-line text-foreground-400"></i>
                Mandato {activeCipa.mandateNumber}
              </span>
              <button
                type="button"
                onClick={() => setCipaFilter("")}
                className="ml-auto cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 font-semibold text-secondary-800 transition-colors hover:bg-secondary-100 dark:text-secondary-200 dark:hover:bg-secondary-900"
              >
                Limpar filtro
              </button>
            </div>
          ) : undefined
        }
        tabs={{ label: "Seções da CIPA", items: visibleTabs, active: tab, onChange: setTab }}
      />

      {/* Conteúdo */}
      <div className="mt-6">
        {tab === "visao" && <OverviewTab cipaId={cipaFilter} onGoTab={setTab} />}
        {tab === "cipas" && <CipasTab />}
        {tab === "agenda" && <AgendaTab cipaId={cipaFilter} />}
        {tab === "atas" && <AtasTab cipaId={cipaFilter} />}
        {tab === "acoes" && <ActionsTab cipaId={cipaFilter} />}
        {tab === "eleicoes" && <ElectionsTab cipaId={cipaFilter} />}
        {tab === "inspecoes" && <InspectionsTab cipaId={cipaFilter} />}
        {tab === "assinaturas" && <TechnicalSignatureHistoryTab cipaId={cipaFilter} />}
      </div>
    </div>
  );
}