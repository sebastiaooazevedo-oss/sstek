import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { collaboratorAreas, collaboratorEstablishments } from "@/mocks/collaborators";
import RowsEditor from "@/pages/app/modules/documentos/structured/components/RowsEditor";
import SmartChecklist from "@/pages/app/modules/documentos/structured/components/SmartChecklist";
import PhotoField from "@/pages/app/modules/documentos/structured/components/PhotoField";
import {
  checklistFromTemplates,
  entryFromTemplate,
  uid,
  workActivities,
  workPermitBaseTemplates,
  type ChecklistEntry,
  type PhotoItem,
  type RiskRow,
} from "@/pages/app/modules/documentos/structured/structuredData";
import type { StructuredRecord, WorkPermitPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface WorkPermitModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: StructuredRecord) => void;
}

function emptyPayload(): WorkPermitPayload {
  return {
    protocol: "",
    notes: "",
    checklist: checklistFromTemplates(workPermitBaseTemplates),
    photos: [],
    ptNumber: "",
    permitDate: "",
    startTime: "",
    endTime: "",
    validUntil: "",
    establishment: collaboratorEstablishments[0] ?? "",
    area: "",
    location: "",
    equipment: "",
    workOrder: "",
    activityIds: [],
    requester: "",
    executorCompany: "",
    executorResponsible: "",
    executorRole: "",
    workerCount: "",
    risks: [],
    epiList: "",
    tools: "",
    isolation: "",
    atmosphericO2: "",
    atmosphericLel: "",
    atmosphericH2s: "",
    atmosphericCo: "",
    atmosphericTime: "",
    issuerName: "",
    issuerRole: "",
    issuerRegistration: "",
    approverName: "",
    approverRole: "",
    watcher: "",
    closureTime: "",
    closureNotes: "",
    pending: "",
  };
}

/**
 * Criação do documento "Permissão de Trabalho": liberação de atividade de risco
 * com atividades autorizadas, riscos e medidas de controle, teste atmosférico,
 * checklist inteligente por tipo de atividade, fotos e assinaturas de emissão.
 */
export default function WorkPermitModal({ open, onClose, onSave }: WorkPermitModalProps) {
  const [form, setForm] = useState<WorkPermitPayload>(emptyPayload);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(emptyPayload());
    setError("");
  }, [open]);

  const set = (patch: Partial<WorkPermitPayload>) => setForm((prev) => ({ ...prev, ...patch }));

  const suggestions = useMemo(() => {
    const selected = workActivities.filter((activity) => form.activityIds.includes(activity.name));
    return [...workPermitBaseTemplates, ...selected.flatMap((activity) => activity.items)];
  }, [form.activityIds]);

  // Ao marcar uma atividade, os itens de verificação daquela NR entram
  // automaticamente no checklist (sem duplicar).
  const toggleActivity = (name: string) => {
    const active = form.activityIds.includes(name);
    const nextIds = active ? form.activityIds.filter((id) => id !== name) : [...form.activityIds, name];
    let nextChecklist = form.checklist;
    if (!active) {
      const def = workActivities.find((activity) => activity.name === name);
      if (def) {
        const existing = new Set(nextChecklist.map((item) => item.label.trim().toLowerCase()));
        const additions = def.items
          .filter((item) => !existing.has(item.label.trim().toLowerCase()))
          .map(entryFromTemplate);
        nextChecklist = [...nextChecklist, ...additions];
      }
    }
    set({ activityIds: nextIds, checklist: nextChecklist });
  };

  const handleSubmit = () => {
    if (!form.permitDate) {
      setError("Informe a data da permissão de trabalho.");
      return;
    }
    if (form.activityIds.length === 0) {
      setError("Selecione ao menos uma atividade autorizada.");
      return;
    }
    if (!form.executorResponsible.trim()) {
      setError("Informe o responsável executante da atividade.");
      return;
    }
    if (!form.issuerName.trim()) {
      setError("Informe quem emitiu a permissão (emissor responsável).");
      return;
    }
    setError("");
    const title = [form.ptNumber ? `PT ${form.ptNumber}` : "Permissão de Trabalho", form.location || form.area]
      .filter(Boolean)
      .join(" · ");
    onSave({
      id: uid("permissao"),
      kind: "permissao-trabalho",
      title,
      date: form.permitDate,
      establishment: form.establishment,
      payload: form,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-file-shield-2-line"
      title="Permissão de Trabalho"
      subtitle="Liberação formal de atividade de risco, com riscos, medidas de controle, checklist por NR e assinaturas."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-file-add-line">
            Gerar documento
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-file-list-3-line text-base text-primary-700"></i>
            Identificação da permissão
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nº da permissão" required>
              <input
                className={inputClass}
                value={form.ptNumber}
                onChange={(e) => set({ ptNumber: e.target.value })}
                placeholder="Ex.: PT-2026-0187"
              />
            </Field>
            <Field label="Data" required>
              <input
                type="date"
                className={inputClass}
                value={form.permitDate}
                onChange={(e) => set({ permitDate: e.target.value })}
              />
            </Field>
            <Field label="Início">
              <input type="time" className={inputClass} value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
            </Field>
            <Field label="Término">
              <input type="time" className={inputClass} value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
            </Field>
            <Field label="Válida até">
              <input
                type="date"
                className={inputClass}
                value={form.validUntil}
                onChange={(e) => set({ validUntil: e.target.value })}
              />
            </Field>
            <Field label="Unidade / estabelecimento">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.establishment}
                  onChange={(e) => set({ establishment: e.target.value })}
                >
                  <option value="">Selecione a unidade</option>
                  {collaboratorEstablishments.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Área / setor">
              <div className="relative">
                <select className={selectClass} value={form.area} onChange={(e) => set({ area: e.target.value })}>
                  <option value="">Selecione a área</option>
                  {collaboratorAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Ordem de serviço">
              <input
                className={inputClass}
                value={form.workOrder}
                onChange={(e) => set({ workOrder: e.target.value })}
                placeholder="Ex.: OS-4471"
              />
            </Field>
            <Field label="Local exato / equipamento" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Ex.: Caixa d'água — reservatório superior"
              />
            </Field>
            <Field label="Nº de controle interno">
              <input
                className={inputClass}
                value={form.protocol}
                onChange={(e) => set({ protocol: e.target.value })}
                placeholder="Ex.: 0187"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-shield-star-line text-base text-primary-700"></i>
              Atividades autorizadas
            </h3>
            <span className="text-[11px] text-foreground-400">
              Cada atividade inclui itens de verificação no checklist
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {workActivities.map((activity) => {
              const active = form.activityIds.includes(activity.name);
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => toggleActivity(activity.name)}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? "border-primary-400 bg-primary-50"
                      : "border-background-300 bg-background-50 hover:bg-background-100"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      active ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500"
                    }`}
                  >
                    <i className={active ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}></i>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground-900">{activity.name}</span>
                    <span className="mt-0.5 block text-[10px] text-foreground-400">{activity.refs}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-team-line text-base text-primary-700"></i>
            Executante
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Solicitante">
              <input
                className={inputClass}
                value={form.requester}
                onChange={(e) => set({ requester: e.target.value })}
                placeholder="Quem solicitou a atividade"
              />
            </Field>
            <Field label="Empresa executante">
              <input
                className={inputClass}
                value={form.executorCompany}
                onChange={(e) => set({ executorCompany: e.target.value })}
                placeholder="Ex.: Manutenção interna / terceirizada"
              />
            </Field>
            <Field label="Responsável no local" required>
              <input
                className={inputClass}
                value={form.executorResponsible}
                onChange={(e) => set({ executorResponsible: e.target.value })}
                placeholder="Nome do encarregado"
              />
            </Field>
            <Field label="Função do responsável">
              <input
                className={inputClass}
                value={form.executorRole}
                onChange={(e) => set({ executorRole: e.target.value })}
                placeholder="Ex.: Encarregado de manutenção"
              />
            </Field>
            <Field label="Nº de trabalhadores">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.workerCount}
                onChange={(e) => set({ workerCount: e.target.value })}
                placeholder="Ex.: 3"
              />
            </Field>
            <Field label="Vigia / observador">
              <input
                className={inputClass}
                value={form.watcher}
                onChange={(e) => set({ watcher: e.target.value })}
                placeholder="Nome do vigia (NR-33)"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-error-warning-line text-base text-accent-700"></i>
            Riscos e medidas de controle
          </h3>
          <RowsEditor
            value={form.risks}
            onChange={(risks: RiskRow[]) => set({ risks })}
            addLabel="Adicionar risco"
            emptyText="Nenhum risco registrado. Descreva perigos, riscos e as medidas de controle aplicadas."
            columns={[
              { key: "hazard", label: "Perigo", placeholder: "Ex.: Queda de altura" },
              { key: "risk", label: "Risco", placeholder: "Ex.: Queda com lesão grave" },
              { key: "control", label: "Medida de controle", placeholder: "Ex.: linha de vida e guarda-corpo" },
              { key: "epi", label: "EPI / EPC", placeholder: "Ex.: cinto paraquedista" },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-nurse-line text-base text-primary-700"></i>
            Recursos de segurança e teste atmosférico
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="EPIs exigidos">
              <input
                className={inputClass}
                value={form.epiList}
                onChange={(e) => set({ epiList: e.target.value })}
                placeholder="Ex.: capacete, cinto, luvas"
              />
            </Field>
            <Field label="Ferramentas e equipamentos">
              <input
                className={inputClass}
                value={form.tools}
                onChange={(e) => set({ tools: e.target.value })}
                placeholder="Ex.: andaime, detector de gases"
              />
            </Field>
            <Field label="Isolamento / bloqueio">
              <input
                className={inputClass}
                value={form.isolation}
                onChange={(e) => set({ isolation: e.target.value })}
                placeholder="Ex.: LOTO aplicado no painel Q-12"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-background-200 bg-background-100 p-4 lg:grid-cols-5">
            <Field label="O₂ (%)">
              <input className={inputClass} value={form.atmosphericO2} onChange={(e) => set({ atmosphericO2: e.target.value })} placeholder="20,9" />
            </Field>
            <Field label="%LEL">
              <input className={inputClass} value={form.atmosphericLel} onChange={(e) => set({ atmosphericLel: e.target.value })} placeholder="0" />
            </Field>
            <Field label="H₂S (ppm)">
              <input className={inputClass} value={form.atmosphericH2s} onChange={(e) => set({ atmosphericH2s: e.target.value })} placeholder="0" />
            </Field>
            <Field label="CO (ppm)">
              <input className={inputClass} value={form.atmosphericCo} onChange={(e) => set({ atmosphericCo: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Hora do teste">
              <input type="time" className={inputClass} value={form.atmosphericTime} onChange={(e) => set({ atmosphericTime: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
              Checklist inteligente de liberação
            </h3>
            <span className="text-[11px] text-foreground-400">Itens adicionados conforme as atividades marcadas</span>
          </div>
          <SmartChecklist
            value={form.checklist}
            onChange={(checklist: ChecklistEntry[]) => set({ checklist })}
            suggestions={suggestions}
            emptyHint="Marque as atividades autorizadas para receber os itens de verificação."
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <PhotoField
            value={form.photos}
            onChange={(photos: PhotoItem[]) => set({ photos })}
            title="Fotos do local e das condições de segurança"
            hint="Anexe fotos do isolamento, dos bloqueios e dos recursos de segurança instalados."
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-lock-unlock-line text-base text-primary-700"></i>
            Encerramento e liberação
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hora do encerramento">
              <input
                type="time"
                className={inputClass}
                value={form.closureTime}
                onChange={(e) => set({ closureTime: e.target.value })}
              />
            </Field>
            <Field label="Pendências">
              <input
                className={inputClass}
                value={form.pending}
                onChange={(e) => set({ pending: e.target.value })}
                placeholder="Ex.: aguardando liberação da produção"
              />
            </Field>
          </div>
          <Field label="Condições de encerramento / observações">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.closureNotes}
              onChange={(e) => set({ closureNotes: e.target.value })}
              placeholder="Descreva as condições ao término da atividade e as devidas liberações."
            />
          </Field>
          <Field label="Observações gerais da permissão">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Orientações, restrições e informações complementares."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Emissor da permissão" required>
              <input
                className={inputClass}
                value={form.issuerName}
                onChange={(e) => set({ issuerName: e.target.value })}
                placeholder="Nome de quem emite"
              />
            </Field>
            <Field label="Função do emissor">
              <input
                className={inputClass}
                value={form.issuerRole}
                onChange={(e) => set({ issuerRole: e.target.value })}
                placeholder="Ex.: Técnico de Segurança"
              />
            </Field>
            <Field label="Registro do emissor">
              <input
                className={inputClass}
                value={form.issuerRegistration}
                onChange={(e) => set({ issuerRegistration: e.target.value })}
                placeholder="Ex.: MTE 0032145"
              />
            </Field>
            <Field label="Aprovador">
              <input
                className={inputClass}
                value={form.approverName}
                onChange={(e) => set({ approverName: e.target.value })}
                placeholder="Nome de quem aprova"
              />
            </Field>
            <Field label="Função do aprovador">
              <input
                className={inputClass}
                value={form.approverRole}
                onChange={(e) => set({ approverRole: e.target.value })}
                placeholder="Ex.: Gerente de Produção"
              />
            </Field>
          </div>
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-pen-nib-line text-base text-primary-700"></i>
              <h3 className="text-sm font-bold text-foreground-950">Assinatura de liberação</h3>
            </div>
            <SignatureFooter />
          </div>
        </section>
      </div>
    </Modal>
  );
}