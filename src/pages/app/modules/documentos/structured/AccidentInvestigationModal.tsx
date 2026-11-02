import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { collaboratorAreas, collaboratorEstablishments } from "@/mocks/collaborators";
import RowsEditor from "@/pages/app/modules/documentos/structured/components/RowsEditor";
import SmartChecklist from "@/pages/app/modules/documentos/structured/components/SmartChecklist";
import PhotoField from "@/pages/app/modules/documentos/structured/components/PhotoField";
import {
  accidentChecklistTemplates,
  accidentSeverities,
  accidentShifts,
  accidentTypes,
  checklistFromTemplates,
  rootCauseMethods,
  uid,
  type ChecklistEntry,
  type PhotoItem,
} from "@/pages/app/modules/documentos/structured/structuredData";
import type { AccidentPayload, StructuredRecord } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface AccidentInvestigationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: StructuredRecord) => void;
}

const yesNo = ["Sim", "Não", "Em andamento"];

function emptyPayload(): AccidentPayload {
  return {
    protocol: "",
    notes: "",
    checklist: checklistFromTemplates(accidentChecklistTemplates),
    photos: [],
    occurrenceType: accidentTypes[0],
    severity: accidentSeverities[0],
    occurrenceDate: "",
    occurrenceTime: "",
    shift: "",
    establishment: collaboratorEstablishments[0] ?? "",
    area: "",
    location: "",
    cid: "",
    victimName: "",
    victimCpf: "",
    victimRegistration: "",
    victimRole: "",
    victimAdmission: "",
    victimBirth: "",
    victimSex: "",
    catIssued: "Sim",
    catNumber: "",
    catDate: "",
    esocialSent: "Em andamento",
    cipaNotified: "Sim",
    leaveDays: "",
    returnDate: "",
    activity: "",
    description: "",
    agent: "",
    bodyPart: "",
    injuryNature: "",
    rootCauseMethod: rootCauseMethods[0],
    rootCause: "",
    contributingFactors: "",
    unsafeAct: "",
    unsafeCondition: "",
    managementFailure: "",
    nrsRelated: "",
    episUsed: "",
    trainings: "",
    immediateActions: "",
    conclusion: "",
    witnesses: [],
    actions: [],
    investigatorName: "",
    investigatorRole: "",
    investigatorRegistration: "",
    cipaRepresentative: "",
    employerRepresentative: "",
  };
}

/**
 * Criação do documento "Investigação de Acidente": registro completo exigido na
 * análise de acidentes (NR-1), com dados do acidentado, comunicações legais
 * (CAT / eSocial / CIPA), análise de causa raiz, plano de ação, testemunhas,
 * checklist inteligente e registro fotográfico.
 */
export default function AccidentInvestigationModal({ open, onClose, onSave }: AccidentInvestigationModalProps) {
  const [title, setTitle] = useState("");
  const [form, setForm] = useState<AccidentPayload>(emptyPayload);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setForm(emptyPayload());
    setError("");
  }, [open]);

  const set = (patch: Partial<AccidentPayload>) => setForm((prev) => ({ ...prev, ...patch }));

  // Checklist inteligente: além do roteiro base, inclui itens específicos
  // conforme o tipo de ocorrência escolhido.
  const suggestions = useMemo(() => {
    const extra = [] as { label: string; ref: string }[];
    if (form.occurrenceType === "Acidente de trajeto") {
      extra.push({ label: "Trajeto e meio de transporte habitual confirmados", ref: "Lei 8.213/91" });
    }
    if (form.occurrenceType === "Doença ocupacional") {
      extra.push({ label: "Histórico de exposição ao agente e exames complementares anexados", ref: "NR-7" });
    }
    if (form.occurrenceType === "Quase acidente (incidente)") {
      extra.push({ label: "Evento tratado como oportunidade de melhoria (sem CAT)", ref: "NR-1" });
    }
    if (form.occurrenceType === "Dano material / avaria") {
      extra.push({ label: "Avaliação de perdas e impacto na operação registrada", ref: "NR-1" });
    }
    if (form.severity === "Óbito" || form.severity === "Lesão grave / incapacitante") {
      extra.push({ label: "Comunicação imediata à CIPA, sindicato e autoridade competente", ref: "NR-1" });
      extra.push({ label: "Afastamento e acompanhamento previdenciário formalizados", ref: "Lei 8.213/91" });
    }
    if (Number(form.leaveDays) > 15) {
      extra.push({ label: "Encaminhamento ao INSS e acompanhamento do retorno ao trabalho", ref: "NR-7" });
    }
    return [...accidentChecklistTemplates, ...extra];
  }, [form.occurrenceType, form.severity, form.leaveDays]);

  const handleSubmit = () => {
    if (title.trim().length < 3) {
      setError("Informe a identificação (título) da investigação.");
      return;
    }
    if (!form.occurrenceDate) {
      setError("Informe a data da ocorrência.");
      return;
    }
    if (!form.victimName.trim()) {
      setError("Informe o nome do acidentado (ou 'sem vítima' em caso de dano material).");
      return;
    }
    if (!form.description.trim()) {
      setError("Descreva o acidente no campo de descrição.");
      return;
    }
    setError("");
    onSave({
      id: uid("investigacao"),
      kind: "investigacao-acidente",
      title: title.trim(),
      date: form.occurrenceDate,
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
      icon="ri-alert-line"
      title="Investigação de Acidente"
      subtitle="Registro completo da ocorrência, análise de causa raiz, plano de ação e evidências fotográficas."
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
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Identificação da investigação" required>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Acidente com prensa hidráulica — linha 3"
            />
          </Field>
          <Field label="Unidade / estabelecimento">
            <div className="relative">
              <select className={selectClass} value={form.establishment} onChange={(e) => set({ establishment: e.target.value })}>
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
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-error-warning-line text-base text-accent-700"></i>
            Ocorrência
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo de ocorrência" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.occurrenceType}
                  onChange={(e) => set({ occurrenceType: e.target.value })}
                >
                  {accidentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Gravidade" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.severity}
                  onChange={(e) => set({ severity: e.target.value })}
                >
                  {accidentSeverities.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Nº de controle interno">
              <input
                className={inputClass}
                value={form.protocol}
                onChange={(e) => set({ protocol: e.target.value })}
                placeholder="Ex.: INV-2026-014"
              />
            </Field>
            <Field label="Data da ocorrência" required>
              <input
                type="date"
                className={inputClass}
                value={form.occurrenceDate}
                onChange={(e) => set({ occurrenceDate: e.target.value })}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                className={inputClass}
                value={form.occurrenceTime}
                onChange={(e) => set({ occurrenceTime: e.target.value })}
              />
            </Field>
            <Field label="Turno">
              <div className="relative">
                <select className={selectClass} value={form.shift} onChange={(e) => set({ shift: e.target.value })}>
                  <option value="">Selecione o turno</option>
                  {accidentShifts.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
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
            <Field label="Local específico" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Ex.: Galpão 2 — prensa hidráulica 04"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-user-heart-line text-base text-primary-700"></i>
            Acidentado
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome" required>
              <input
                className={inputClass}
                value={form.victimName}
                onChange={(e) => set({ victimName: e.target.value })}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="CPF">
              <input
                className={inputClass}
                value={form.victimCpf}
                onChange={(e) => set({ victimCpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="Matrícula">
              <input
                className={inputClass}
                value={form.victimRegistration}
                onChange={(e) => set({ victimRegistration: e.target.value })}
                placeholder="Ex.: 02841"
              />
            </Field>
            <Field label="Função">
              <input
                className={inputClass}
                value={form.victimRole}
                onChange={(e) => set({ victimRole: e.target.value })}
                placeholder="Ex.: Operador de prensa"
              />
            </Field>
            <Field label="Data de admissão">
              <input
                type="date"
                className={inputClass}
                value={form.victimAdmission}
                onChange={(e) => set({ victimAdmission: e.target.value })}
              />
            </Field>
            <Field label="Data de nascimento">
              <input
                type="date"
                className={inputClass}
                value={form.victimBirth}
                onChange={(e) => set({ victimBirth: e.target.value })}
              />
            </Field>
            <Field label="Sexo">
              <div className="relative">
                <select className={selectClass} value={form.victimSex} onChange={(e) => set({ victimSex: e.target.value })}>
                  <option value="">Não informado</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="CID">
              <input
                className={inputClass}
                value={form.cid}
                onChange={(e) => set({ cid: e.target.value })}
                placeholder="Ex.: S62.6"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-file-shield-2-line text-base text-primary-700"></i>
            Comunicações legais e afastamento
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="CAT emitida" hint="Lei 8.213/91 — até o 1º dia útil seguinte.">
              <div className="relative">
                <select className={selectClass} value={form.catIssued} onChange={(e) => set({ catIssued: e.target.value })}>
                  {yesNo.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Nº da CAT">
              <input
                className={inputClass}
                value={form.catNumber}
                onChange={(e) => set({ catNumber: e.target.value })}
                placeholder="Ex.: 2026/000123"
              />
            </Field>
            <Field label="Data da CAT">
              <input type="date" className={inputClass} value={form.catDate} onChange={(e) => set({ catDate: e.target.value })} />
            </Field>
            <Field label="Evento S-2210 no eSocial">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.esocialSent}
                  onChange={(e) => set({ esocialSent: e.target.value })}
                >
                  {yesNo.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="CIPA notificada" hint="NR-5 — participação na análise.">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.cipaNotified}
                  onChange={(e) => set({ cipaNotified: e.target.value })}
                >
                  {yesNo.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Dias de afastamento">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.leaveDays}
                onChange={(e) => set({ leaveDays: e.target.value })}
                placeholder="0"
              />
            </Field>
            <Field label="Retorno previsto">
              <input
                type="date"
                className={inputClass}
                value={form.returnDate}
                onChange={(e) => set({ returnDate: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-file-text-line text-base text-primary-700"></i>
            Descrição do evento
          </h3>
          <Field label="Atividade desenvolvida no momento">
            <input
              className={inputClass}
              value={form.activity}
              onChange={(e) => set({ activity: e.target.value })}
              placeholder="Ex.: Troca de matriz da prensa hidráulica"
            />
          </Field>
          <Field label="Descrição objetiva do acidente" required hint="O que aconteceu, como e em que circunstâncias.">
            <textarea
              className={`${inputClass} min-h-[96px] resize-y`}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              maxLength={2000}
              placeholder="Descreva a sequência do evento, o que o trabalhador fazia e o que provocou a lesão."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Agente causador / fonte da lesão">
              <input
                className={inputClass}
                value={form.agent}
                onChange={(e) => set({ agent: e.target.value })}
                placeholder="Ex.: Prensa hidráulica"
              />
            </Field>
            <Field label="Parte do corpo atingida">
              <input
                className={inputClass}
                value={form.bodyPart}
                onChange={(e) => set({ bodyPart: e.target.value })}
                placeholder="Ex.: Mão direita"
              />
            </Field>
            <Field label="Natureza da lesão">
              <input
                className={inputClass}
                value={form.injuryNature}
                onChange={(e) => set({ injuryNature: e.target.value })}
                placeholder="Ex.: Fratura, corte, contusão"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-search-eye-line text-base text-primary-700"></i>
            Análise de causa raiz
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Método de análise">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.rootCauseMethod}
                  onChange={(e) => set({ rootCauseMethod: e.target.value })}
                >
                  {rootCauseMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="NRs relacionadas">
              <input
                className={inputClass}
                value={form.nrsRelated}
                onChange={(e) => set({ nrsRelated: e.target.value })}
                placeholder="Ex.: NR-12, NR-6, NR-1"
              />
            </Field>
          </div>
          <Field label="Causa raiz identificada">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.rootCause}
              onChange={(e) => set({ rootCause: e.target.value })}
              placeholder="Descreva a causa fundamental que, se eliminada, evitaria a repetição do evento."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fatores contribuintes">
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={form.contributingFactors}
                onChange={(e) => set({ contributingFactors: e.target.value })}
                placeholder="Organização, pressão de produção, layout, manutenção..."
              />
            </Field>
            <Field label="Ato inseguro">
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={form.unsafeAct}
                onChange={(e) => set({ unsafeAct: e.target.value })}
                placeholder="Comportamento que contribuiu para o evento."
              />
            </Field>
            <Field label="Condição insegura">
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={form.unsafeCondition}
                onChange={(e) => set({ unsafeCondition: e.target.value })}
                placeholder="Proteção ausente, dispositivo desativado, iluminação inadequada..."
              />
            </Field>
            <Field label="Falha de gestão">
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={form.managementFailure}
                onChange={(e) => set({ managementFailure: e.target.value })}
                placeholder="Falta de treinamento, APR ausente, manutenção preventiva não executada..."
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Field label="EPIs em uso">
              <input
                className={inputClass}
                value={form.episUsed}
                onChange={(e) => set({ episUsed: e.target.value })}
                placeholder="Ex.: luva de raspa, óculos, protetor auricular"
              />
            </Field>
            <Field label="Treinamentos">
              <input
                className={inputClass}
                value={form.trainings}
                onChange={(e) => set({ trainings: e.target.value })}
                placeholder="Ex.: NR-12 (2025), NR-06 (2026)"
              />
            </Field>
            <Field label="Ações imediatas adotadas">
              <input
                className={inputClass}
                value={form.immediateActions}
                onChange={(e) => set({ immediateActions: e.target.value })}
                placeholder="Ex.: área isolada, máquina bloqueada"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-list-check-2 text-base text-primary-700"></i>
            Plano de ação
          </h3>
          <RowsEditor
            value={form.actions}
            onChange={(actions) => set({ actions })}
            addLabel="Adicionar ação"
            emptyText="Nenhuma ação registrada. Inclua as medidas corretivas e preventivas com responsável e prazo."
            columns={[
              { key: "description", label: "Ação (o que será feito)", placeholder: "Ex.: instalar proteção fixa" },
              { key: "responsible", label: "Responsável", placeholder: "Ex.: Manutenção" },
              { key: "due", label: "Prazo", type: "date" },
              { key: "status", label: "Situação", type: "select", options: ["Pendente", "Em andamento", "Concluída"] },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-user-voice-line text-base text-primary-700"></i>
            Testemunhas
          </h3>
          <RowsEditor
            value={form.witnesses}
            onChange={(witnesses) => set({ witnesses })}
            addLabel="Adicionar testemunha"
            emptyText="Nenhuma testemunha registrada."
            columns={[
              { key: "name", label: "Nome", placeholder: "Nome da testemunha" },
              { key: "role", label: "Função / setor", placeholder: "Ex.: Supervisor de produção" },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
              Checklist inteligente
            </h3>
            <span className="text-[11px] text-foreground-400">Sugestões ajustadas ao tipo e à gravidade</span>
          </div>
          <SmartChecklist
            value={form.checklist}
            onChange={(checklist: ChecklistEntry[]) => set({ checklist })}
            suggestions={suggestions}
            emptyHint="Adicione os itens de verificação da investigação."
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <PhotoField
            value={form.photos}
            onChange={(photos: PhotoItem[]) => set({ photos })}
            title="Fotos do local, do equipamento e da lesão"
            hint="Anexe fotos da cena, do agente causador e das condições observadas — elas saem no PDF."
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <Field label="Conclusão da investigação">
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={form.conclusion}
              onChange={(e) => set({ conclusion: e.target.value })}
              placeholder="Síntese do resultado da investigação e das medidas necessárias."
            />
          </Field>
          <Field label="Observações gerais">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Informações complementares, encaminhamentos e pendências."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Investigador responsável">
              <input
                className={inputClass}
                value={form.investigatorName}
                onChange={(e) => set({ investigatorName: e.target.value })}
                placeholder="Nome"
              />
            </Field>
            <Field label="Função">
              <input
                className={inputClass}
                value={form.investigatorRole}
                onChange={(e) => set({ investigatorRole: e.target.value })}
                placeholder="Ex.: Técnico de Segurança"
              />
            </Field>
            <Field label="Registro (CREA / MTE)">
              <input
                className={inputClass}
                value={form.investigatorRegistration}
                onChange={(e) => set({ investigatorRegistration: e.target.value })}
                placeholder="Ex.: CREA-SP 5070123456"
              />
            </Field>
            <Field label="Representante da CIPA">
              <input
                className={inputClass}
                value={form.cipaRepresentative}
                onChange={(e) => set({ cipaRepresentative: e.target.value })}
                placeholder="Nome do representante"
              />
            </Field>
            <Field label="Representante do empregador">
              <input
                className={inputClass}
                value={form.employerRepresentative}
                onChange={(e) => set({ employerRepresentative: e.target.value })}
                placeholder="Nome do representante"
              />
            </Field>
          </div>
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-pen-nib-line text-base text-primary-700"></i>
              <h3 className="text-sm font-bold text-foreground-950">Assinatura do responsável técnico</h3>
            </div>
            <SignatureFooter />
          </div>
        </section>
      </div>
    </Modal>
  );
}