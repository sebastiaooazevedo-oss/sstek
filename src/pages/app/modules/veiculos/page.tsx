import { useEffect, useMemo, useState } from "react";
import ModuleHeader, { ModuleToolbar, moduleGhostAction, modulePrimaryAction } from "@/pages/app/components/ModuleHeader";
import Modal, { Field, ModalButton, inputClass } from "@/pages/app/components/Modal";
import { useAppSession } from "@/pages/app/context";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import {
  docSituation,
  type CheckinKind,
  type ChecklistTemplate,
  type Vehicle,
  type VehicleDocument,
  type VehicleRequirement,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import {
  desativarChecklist,
  desativarExigencia,
  inativarVeiculo,
  registrarAvisoVencimento,
  reloadVehicles,
  useVehicles,
} from "@/pages/app/modules/veiculos/vehiclesStore";
import FleetTab from "@/pages/app/modules/veiculos/components/FleetTab";
import DocumentsTab from "@/pages/app/modules/veiculos/components/DocumentsTab";
import RequirementsTab from "@/pages/app/modules/veiculos/components/RequirementsTab";
import InspectionsTab from "@/pages/app/modules/veiculos/components/InspectionsTab";
import EpcTab from "@/pages/app/modules/veiculos/components/EpcTab";
import CheckinsTab from "@/pages/app/modules/veiculos/components/CheckinsTab";
import VehicleFormModal from "@/pages/app/modules/veiculos/components/VehicleFormModal";
import VehicleDocumentModal from "@/pages/app/modules/veiculos/components/VehicleDocumentModal";
import RequirementModal from "@/pages/app/modules/veiculos/components/RequirementModal";
import ChecklistTemplateModal from "@/pages/app/modules/veiculos/components/ChecklistTemplateModal";
import InspectionRunModal from "@/pages/app/modules/veiculos/components/InspectionRunModal";
import EpcLinkModal from "@/pages/app/modules/veiculos/components/EpcLinkModal";
import CheckinWizard from "@/pages/app/modules/veiculos/checkin/CheckinWizard";
import CheckinReportPanel from "@/pages/app/modules/veiculos/checkin/CheckinReportPanel";
import DemoDataModal from "@/pages/app/modules/veiculos/components/DemoDataModal";
import VehicleDetailDrawer from "@/pages/app/modules/veiculos/components/VehicleDetailDrawer";

type TabId = "frota" | "documentos" | "exigencias" | "inspecoes" | "epcs" | "custodia" | "registros";

interface Toast {
  kind: "ok" | "err";
  text: string;
}

const tabs = [
  { id: "frota", label: "Frota", icon: "ri-truck-line", description: "Veículos cadastrados e situação" },
  {
    id: "documentos",
    label: "Documentos e vencimentos",
    icon: "ri-file-shield-2-line",
    description: "Documentos vigentes, vencidos e versões",
  },
  {
    id: "exigencias",
    label: "Exigências documentais",
    icon: "ri-list-check-2",
    description: "O que a empresa exige por categoria",
  },
  {
    id: "inspecoes",
    label: "Inspeções",
    icon: "ri-shield-check-line",
    description: "Checklists versionados, execução e achados",
  },
  {
    id: "epcs",
    label: "EPCs e acessórios",
    icon: "ri-shield-cross-line",
    description: "Equipamentos vinculados ao veículo",
  },
  {
    id: "custodia",
    label: "Check-in",
    icon: "ri-key-2-line",
    description: "Retirada e devolução com check-in de segurança",
  },
  {
    id: "registros",
    label: "Check-ins realizados",
    icon: "ri-file-list-3-line",
    description: "Histórico com filtros, exportação e reparos",
  },
];

function StatTile({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "neutral" | "primary" | "accent" | "danger";
}) {
  const toneClass: Record<string, string> = {
    neutral: "bg-background-100 text-foreground-600",
    primary: "bg-primary-100 text-primary-700",
    accent: "bg-accent-100 text-accent-800",
    danger: "bg-danger-100 text-danger-800",
  };
  return (
    <div className="rounded-xl border border-background-200 bg-background-50 p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass[tone]}`}>
        <i className={`${icon} text-base`}></i>
      </span>
      <p className="mt-3 font-heading text-xl font-extrabold tracking-tight text-foreground-950">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium leading-tight text-foreground-500">{label}</p>
    </div>
  );
}

export default function VeiculosPage() {
  const session = useAppSession();
  const state = useVehicles(session.subdomain);
  const { can } = usePermissions();

  const [tab, setTab] = useState<TabId>("frota");
  const [detailRef, setDetailRef] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [docTarget, setDocTarget] = useState<{ vehicle: Vehicle; replacing: VehicleDocument | null } | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [editRequirement, setEditRequirement] = useState<VehicleRequirement | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [editChecklist, setEditChecklist] = useState<ChecklistTemplate | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<ChecklistTemplate | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionVehicleRef, setInspectionVehicleRef] = useState<string | null>(null);
  const [epcOpen, setEpcOpen] = useState(false);
  const [epcVehicleRef, setEpcVehicleRef] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinVehicleRef, setCheckinVehicleRef] = useState<string | null>(null);
  const [checkinKind, setCheckinKind] = useState<CheckinKind>("entrega");
  const [demoOpen, setDemoOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canCreate = can("vehicles.create");
  const canEdit = can("vehicles.edit");
  const canManageDocs = can("vehicles.documents");
  const canChecklists = can("vehicles.checklists");
  const canInspect = can("vehicles.inspections");
  const canManageEpc = can("vehicles.epc");
  const canUnblock = can("vehicles.unblock");
  const canCheckin = can("vehicles.checkin");
  const canCheckinReport = can("vehicles.checkinReport");
  const visibleTabs = tabs.filter((item) => item.id !== "registros" || canCheckinReport);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const detail = state.vehicles.find((vehicle) => vehicle.ref === detailRef) ?? null;

  const kpis = useMemo(() => {
    const current = state.documents.filter((doc) => doc.isCurrent);
    return {
      total: state.vehicles.length,
      disponiveis: state.vehicles.filter((vehicle) => vehicle.status === "disponivel").length,
      oficina: state.vehicles.filter(
        (vehicle) => vehicle.status === "manutencao" || vehicle.status === "bloqueado"
      ).length,
      vencidos: current.filter((doc) => docSituation(doc) === "vencido").length,
      vencendo: current.filter((doc) => docSituation(doc) === "vencendo").length,
      vigentes: current.length,
      inspecoes: state.inspections.length,
      bloqueados: state.blocks.filter((block) => block.status === "ativo").length,
      achadosAbertos: state.findings.filter((finding) => finding.status !== "resolvido").length,
    };
  }, [state.vehicles, state.documents, state.inspections, state.blocks, state.findings]);

  const openNewVehicle = () => {
    setEditVehicle(null);
    setFormOpen(true);
  };

  const openEditVehicle = (vehicle: Vehicle) => {
    setEditVehicle(vehicle);
    setFormOpen(true);
  };

  const openDocumentModal = (vehicle: Vehicle, replacing: VehicleDocument | null) => {
    setDocTarget({ vehicle, replacing });
  };

  const handleNotify = async (doc: VehicleDocument) => {
    const vehicle = state.vehicles.find((item) => item.ref === doc.vehicleRef);
    if (!vehicle) return;
    const result = await registrarAvisoVencimento({
      vehicleRef: vehicle.ref,
      documentRef: doc.ref,
      expiresAt: doc.expiresAt,
      daysBefore: doc.expiresAt ? 30 : null,
      channel: "registro_interno",
      sentTo: doc.responsible || "",
      notes: `Aviso registrado a partir da ficha do veículo ${vehicle.plate}.`,
    });
    setToast({
      kind: result.ok ? "ok" : "err",
      text: result.ok
        ? "Aviso registrado no histórico do veículo."
        : result.detail || result.error || "Não foi possível registrar o aviso.",
    });
  };

  const handleInactivate = async (motivo: string): Promise<string | null> => {
    if (!detail) return "Veículo não encontrado.";
    const result = await inativarVeiculo(detail.ref, motivo);
    if (!result.ok) {
      return result.detail || result.error || "Não foi possível inativar o veículo.";
    }
    setToast({ kind: "ok", text: result.detail || "Veículo inativado." });
    return null;
  };

  const handleDeactivateRequirement = async (requirement: VehicleRequirement): Promise<boolean> => {
    const result = await desativarExigencia(requirement.ref);
    setToast({
      kind: result.ok ? "ok" : "err",
      text: result.ok
        ? "Exigência desativada. O histórico foi preservado."
        : result.detail || result.error || "Não foi possível desativar a exigência.",
    });
    return result.ok;
  };

  const openDeactivateChecklist = (template: ChecklistTemplate) => {
    setDeactivateTarget(template);
    setDeactivateReason("");
  };

  const confirmDeactivateChecklist = async () => {
    if (!deactivateTarget) return;
    if (deactivateReason.trim().length < 10) {
      setToast({ kind: "err", text: "Descreva o motivo da desativação (mínimo 10 caracteres)." });
      return;
    }
    setDeactivating(true);
    const result = await desativarChecklist(deactivateTarget.templateRef, deactivateReason.trim());
    setDeactivating(false);
    if (!result.ok) {
      setToast({
        kind: "err",
        text: result.detail || result.error || "Não foi possível desativar o checklist.",
      });
      return;
    }
    setDeactivateTarget(null);
    setDeactivateReason("");
    setToast({ kind: "ok", text: result.detail || "Checklist desativado." });
  };

  const openInspection = (vehicleRef: string | null) => {
    setInspectionVehicleRef(vehicleRef);
    setInspectionOpen(true);
  };

  const openEpc = (vehicleRef: string | null) => {
    setEpcVehicleRef(vehicleRef);
    setEpcOpen(true);
  };

  const openCheckin = (vehicleRef: string | null, kind: CheckinKind) => {
    setCheckinVehicleRef(vehicleRef);
    setCheckinKind(kind);
    setCheckinOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <ModuleHeader
        badgeIcon="ri-truck-line"
        badgeLabel="Frota e documentação"
        title="Veículos"
        subtitle="Cadastro da frota, documentação versionada com vencimentos e exigências por categoria. A placa identifica o veículo na tela; o histórico usa um ID interno e não se rompe quando a placa é corrigida."
        actions={
          <ModuleToolbar>
            {canEdit && (
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                title="Dados de demonstração da frota"
                aria-label="Dados de demonstração da frota"
                className={moduleGhostAction}
              >
                <i className="ri-flask-line"></i>
                Demonstração
              </button>
            )}
            <button
              type="button"
              onClick={() => void reloadVehicles()}
              title="Recarregar dados da frota"
              aria-label="Recarregar dados da frota"
              className={moduleGhostAction}
            >
              <i className={state.loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
            </button>
            {canManageDocs && (
              <button
                type="button"
                onClick={() => {
                  setEditRequirement(null);
                  setReqOpen(true);
                }}
                className={moduleGhostAction}
              >
                <i className="ri-list-check-2"></i>
                Nova exigência
              </button>
            )}
            {canCreate && (
              <button type="button" onClick={openNewVehicle} className={modulePrimaryAction}>
                <i className="ri-add-line"></i>
                Novo veículo
              </button>
            )}
          </ModuleToolbar>
        }
        tabs={{
          label: "Seções do módulo de veículos",
          items: visibleTabs,
          active: tab,
          onChange: (id) => setTab(id as TabId),
        }}
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-500">
            <span>
              <strong className="font-semibold text-foreground-800">{kpis.total}</strong> veículo(s) na frota
            </span>
            <span>
              <strong className="font-semibold text-foreground-800">{kpis.vigentes}</strong> documento(s) vigente(s)
            </span>
            <span className="flex items-center gap-1">
              <i className="ri-shield-check-line text-primary-600"></i>
              Escrita validada no servidor e registrada na auditoria
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile icon="ri-truck-line" label="Veículos na frota" value={String(kpis.total)} tone="primary" />
        <StatTile icon="ri-check-double-line" label="Disponíveis" value={String(kpis.disponiveis)} />
        <StatTile icon="ri-tools-line" label="Em manutenção ou bloqueados" value={String(kpis.oficina)} />
        <StatTile icon="ri-file-warning-line" label="Documentos vencidos" value={String(kpis.vencidos)} tone="danger" />
        <StatTile icon="ri-timer-line" label="Documentos vencendo (30 dias)" value={String(kpis.vencendo)} tone="accent" />
        <StatTile
          icon="ri-lock-line"
          label="Veículos bloqueados por inspeção"
          value={String(kpis.bloqueados)}
          tone={kpis.bloqueados > 0 ? "danger" : "neutral"}
        />
      </div>

      {state.error && (
        <div className="flex flex-col gap-3 rounded-xl border border-danger-200 bg-danger-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <i className="ri-error-warning-line mt-0.5 text-base text-danger-700"></i>
            <div>
              <p className="text-sm font-semibold text-danger-900">Não foi possível carregar a frota</p>
              <p className="mt-0.5 text-xs leading-relaxed text-danger-800">{state.error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reloadVehicles()}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-danger-600 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-danger-700"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        </div>
      )}

      {!state.loaded && !state.error ? (
        <div className="rounded-xl border border-background-200 bg-background-50 px-6 py-14 text-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
          <p className="mt-3 text-sm font-medium text-foreground-600">Carregando a frota da empresa...</p>
        </div>
      ) : (
        <>
          {tab === "frota" && (
            <FleetTab
              vehicles={state.vehicles}
              documents={state.documents}
              requirements={state.requirements}
              checkins={state.checkins}
              canCreate={canCreate}
              canEdit={canEdit}
              onNew={openNewVehicle}
              onOpen={(vehicle) => setDetailRef(vehicle.ref)}
              onEdit={openEditVehicle}
            />
          )}

          {tab === "documentos" && (
            <DocumentsTab
              vehicles={state.vehicles}
              documents={state.documents}
              canManage={canManageDocs}
              onOpenVehicle={(vehicle) => setDetailRef(vehicle.ref)}
              onAdd={(vehicle) => openDocumentModal(vehicle, null)}
              onReplace={(doc) => {
                const vehicle = state.vehicles.find((item) => item.ref === doc.vehicleRef) ?? null;
                if (vehicle) openDocumentModal(vehicle, doc);
              }}
            />
          )}

          {tab === "exigencias" && (
            <RequirementsTab
              requirements={state.requirements}
              canManage={canManageDocs}
              onNew={() => {
                setEditRequirement(null);
                setReqOpen(true);
              }}
              onEdit={(requirement) => {
                setEditRequirement(requirement);
                setReqOpen(true);
              }}
              onDeactivate={handleDeactivateRequirement}
            />
          )}

          {tab === "inspecoes" && (
            <InspectionsTab
              vehicles={state.vehicles}
              checklists={state.checklists}
              inspections={state.inspections}
              findings={state.findings}
              blocks={state.blocks}
              canInspect={canInspect}
              canManageChecklists={canChecklists}
              canUnblock={canUnblock}
              onNewChecklist={() => {
                setEditChecklist(null);
                setChecklistOpen(true);
              }}
              onEditChecklist={(template) => {
                setEditChecklist(template);
                setChecklistOpen(true);
              }}
              onDeactivateChecklist={openDeactivateChecklist}
              onNewInspection={openInspection}
              onToast={(kind, text) => setToast({ kind, text })}
            />
          )}

          {tab === "epcs" && (
            <EpcTab
              vehicles={state.vehicles}
              epcLinks={state.epcLinks}
              canManage={canManageEpc}
              onNew={openEpc}
              onToast={(kind, text) => setToast({ kind, text })}
            />
          )}

          {tab === "custodia" && (
            <CheckinsTab
              vehicles={state.vehicles}
              checkins={state.checkins}
              repairs={state.repairRequests}
              canCheckin={canCheckin}
              canReport={canCheckinReport}
              currentUserName={session.name}
              onNew={openCheckin}
              onOpenReport={() => setTab("registros")}
            />
          )}

          {tab === "registros" && canCheckinReport && (
            <CheckinReportPanel
              vehicles={state.vehicles}
              checkins={state.checkins}
              repairs={state.repairRequests}
              canManageRepairs={canEdit}
              onToast={(kind, text) => setToast({ kind, text })}
            />
          )}
        </>
      )}

      {detail && (
        <VehicleDetailDrawer
          vehicle={detail}
          documents={state.documents}
          requirements={state.requirements}
          alerts={state.alerts}
          inspections={state.inspections}
          findings={state.findings}
          blocks={state.blocks}
          epcLinks={state.epcLinks}
          checkins={state.checkins}
          canEdit={canEdit}
          canManage={canManageDocs}
          canUnblock={canUnblock}
          canCheckin={canCheckin}
          onClose={() => setDetailRef(null)}
          onEdit={() => openEditVehicle(detail)}
          onAddDocument={() => openDocumentModal(detail, null)}
          onReplaceDocument={(doc) => openDocumentModal(detail, doc)}
          onNotify={(doc) => void handleNotify(doc)}
          onInactivate={handleInactivate}
          onOpenInspections={() => {
            setDetailRef(null);
            setTab("inspecoes");
          }}
          onOpenCustody={() => {
            setDetailRef(null);
            setTab("custodia");
          }}
          onNewCheckin={(kind) => {
            setDetailRef(null);
            openCheckin(detail.ref, kind);
          }}
        />
      )}

      <VehicleFormModal
        open={formOpen}
        vehicle={editVehicle}
        onClose={() => setFormOpen(false)}
        onSaved={(message) => {
          setFormOpen(false);
          setToast({ kind: "ok", text: message });
        }}
      />

      <VehicleDocumentModal
        open={Boolean(docTarget)}
        vehicle={docTarget?.vehicle ?? null}
        replacing={docTarget?.replacing ?? null}
        onClose={() => setDocTarget(null)}
        onSaved={(message) => {
          setDocTarget(null);
          setToast({ kind: "ok", text: message });
        }}
      />

      <RequirementModal
        open={reqOpen}
        requirement={editRequirement}
        onClose={() => setReqOpen(false)}
        onSaved={(message) => {
          setReqOpen(false);
          setToast({ kind: "ok", text: message });
        }}
      />

      <ChecklistTemplateModal
        open={checklistOpen}
        template={editChecklist}
        onClose={() => setChecklistOpen(false)}
        onSaved={(message) => {
          setChecklistOpen(false);
          setToast({ kind: "ok", text: message });
        }}
      />

      <InspectionRunModal
        open={inspectionOpen}
        vehicles={state.vehicles}
        checklists={state.checklists}
        initialVehicleRef={inspectionVehicleRef}
        onClose={() => setInspectionOpen(false)}
        onSaved={(message, blocked) => {
          setInspectionOpen(false);
          setToast({ kind: blocked ? "err" : "ok", text: message });
        }}
      />

      <EpcLinkModal
        open={epcOpen}
        vehicles={state.vehicles}
        epiSources={state.epiSources}
        initialVehicleRef={epcVehicleRef}
        onClose={() => setEpcOpen(false)}
        onSaved={(message) => {
          setEpcOpen(false);
          setToast({ kind: "ok", text: message });
        }}
      />

      <CheckinWizard
        open={checkinOpen}
        vehicles={state.vehicles}
        checkins={state.checkins}
        repairRequests={state.repairRequests}
        initialVehicleRef={checkinVehicleRef}
        initialKind={checkinKind}
        currentUserName={session.name}
        onClose={() => setCheckinOpen(false)}
        onSaved={(message) => {
          setCheckinOpen(false);
          setToast({ kind: "ok", text: message });
        }}
      />

      <DemoDataModal
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        vehicles={state.vehicles}
        documents={state.documents}
        canClear={canEdit && session.role === "admin"}
        onToast={(kind, text) => setToast({ kind, text })}
      />

      <Modal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        size="md"
        icon="ri-archive-line"
        title="Desativar checklist"
        subtitle="O modelo deixa de ser oferecido para novas inspeções. Versões e inspeções já registradas continuam preservadas."
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
              Cancelar
            </ModalButton>
            <ModalButton onClick={confirmDeactivateChecklist} icon="ri-archive-line" disabled={deactivating}>
              {deactivating ? "Desativando..." : "Confirmar desativação"}
            </ModalButton>
          </>
        }
      >
        <Field label="Motivo da desativação" required hint="Mínimo 10 caracteres. Fica registrado na auditoria.">
          <textarea
            value={deactivateReason}
            onChange={(event) => setDeactivateReason(event.target.value.slice(0, 500))}
            className={`${inputClass} min-h-[72px] resize-y`}
            placeholder="Ex.: checklist substituído pelo modelo revisado após troca de frota."
          ></textarea>
        </Field>
      </Modal>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[70] flex max-w-sm items-start gap-2.5 rounded-lg px-4 py-3 text-sm shadow-xl ${
            toast.kind === "ok"
              ? "bg-primary-700 text-background-50"
              : "bg-danger-700 text-background-50"
          }`}
          role="status"
        >
          <i className={toast.kind === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
          <span className="leading-snug">{toast.text}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setToast(null)}
            className="ml-1 cursor-pointer opacity-80 hover:opacity-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}
    </div>
  );
}