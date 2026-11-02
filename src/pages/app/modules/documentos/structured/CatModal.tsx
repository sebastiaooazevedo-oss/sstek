import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass } from "@/pages/app/components/Modal";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import SmartChecklist from "@/pages/app/modules/documentos/structured/components/SmartChecklist";
import { useSystemSettings, type SystemSettings } from "@/pages/app/settings/settingsStore";
import { toBrDate } from "@/pages/app/modules/documentos/structured/structuredPdf";
import {
  checklistFromTemplates,
  uid,
  type ChecklistEntry,
} from "@/pages/app/modules/documentos/structured/structuredData";
import {
  buildCatProtocol,
  catAccidentTypes,
  catChecklistTemplates,
  catConsequences,
  onlyDigits,
} from "@/pages/app/modules/documentos/structured/cat/catData";
import CatEmployerSection from "@/pages/app/modules/documentos/structured/cat/CatEmployerSection";
import CatWorkerSection from "@/pages/app/modules/documentos/structured/cat/CatWorkerSection";
import CatAccidentSection from "@/pages/app/modules/documentos/structured/cat/CatAccidentSection";
import CatMedicalSection from "@/pages/app/modules/documentos/structured/cat/CatMedicalSection";
import CatReceiptSection from "@/pages/app/modules/documentos/structured/cat/CatReceiptSection";
import type { CatPayload, StructuredRecord } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: StructuredRecord) => void;
  /** Documentos já criados — usados para gerar o próximo número sequencial. */
  existingRecords?: StructuredRecord[];
}

/** Payload inicial da CAT, já com os dados da empresa vindos do sistema. */
function initialPayload(settings: SystemSettings, protocol: string): CatPayload {
  return {
    protocol,
    notes: "",
    checklist: checklistFromTemplates(catChecklistTemplates),
    photos: [],
    catNumber: "",
    employerName: settings.companyLegalName || "Metalúrgica Vega Ltda.",
    employerDocType: "CNPJ",
    employerDoc: settings.companyCnpj || "",
    employerCnae: "",
    employerStreet: "",
    employerNumber: "",
    employerComplement: "",
    employerDistrict: "",
    employerCity: "",
    employerUf: "SP",
    employerCep: "",
    employerPhone: settings.sesmtPhone || "",
    employerUnit: "",
    workerCollaboratorId: "",
    workerName: "",
    workerBirth: "",
    workerSex: "",
    workerMarital: "",
    workerCpf: "",
    workerRg: "",
    workerCtps: "",
    workerNit: "",
    workerEsocial: "",
    workerCbo: "",
    workerCategory: "",
    workerSalary: "",
    workerAdmission: "",
    workerStreet: "",
    workerNumber: "",
    workerComplement: "",
    workerDistrict: "",
    workerCity: "",
    workerUf: "SP",
    workerCep: "",
    workerPhone: "",
    accidentType: catAccidentTypes[0],
    accidentDate: "",
    accidentTime: "",
    hoursWorked: "",
    accidentLocation: "",
    accidentDescription: "",
    causalAgentCode: "",
    causalAgent: "",
    bodyPartCode: "",
    bodyPart: "",
    policeReport: "Não",
    policeReportNumber: "",
    policeReportUnit: "",
    policeReportDate: "",
    medicalCare: "Sim",
    medicalDate: "",
    medicalUnit: "",
    medicalDoctor: "",
    medicalCrm: "",
    diagnosis: "",
    cid: "",
    leaveWork: "Sim",
    lastWorkedDay: "",
    consequence: catConsequences[0],
    deathDate: "",
    receiptName: "",
    receiptType: "",
    receiptDataUrl: "",
    receiptDeliveredDate: "",
    receiptDeliveredTo: "",
    receiptDeliveredToUnion: "Não",
  };
}

/** Texto pronto para transcrever os dados no eSocial / Empregador Web. */
function transcriptionText(form: CatPayload): string {
  const rows: [string, string][] = [
    ["Nº de controle", form.protocol],
    ["Nº da CAT (oficial)", form.catNumber],
    ["Empregador", `${form.employerName} — ${form.employerDocType} ${form.employerDoc}`],
    ["Unidade / estabelecimento", form.employerUnit],
    ["CNAE", form.employerCnae],
    ["Endereço do empregador", `${form.employerStreet}, ${form.employerNumber} — ${form.employerDistrict}, ${form.employerCity}/${form.employerUf} — CEP ${form.employerCep}`],
    ["Telefone do empregador", form.employerPhone],
    ["Trabalhador", form.workerName],
    ["CPF", form.workerCpf],
    ["NIT/PIS", form.workerNit],
    ["Matrícula eSocial", form.workerEsocial],
    ["CBO", form.workerCbo],
    ["Tipo de acidente", form.accidentType],
    ["Data/hora", `${toBrDate(form.accidentDate)} ${form.accidentTime}`.trim()],
    ["Horas trabalhadas", form.hoursWorked],
    ["Local", form.accidentLocation],
    ["Agente causador", `${form.causalAgentCode} — ${form.causalAgent}`],
    ["Parte do corpo", `${form.bodyPartCode} — ${form.bodyPart}`],
    ["CID", form.cid],
    ["Diagnóstico", form.diagnosis],
    ["Último dia trabalhado", toBrDate(form.lastWorkedDay)],
    ["Consequência", form.consequence],
  ];
  return rows.map(([label, value]) => `${label}: ${value || "—"}`).join("\n");
}

/**
 * CAT — Comunicação de Acidente de Trabalho (Lei 8.213/91, art. 22).
 * Reúne os quatro blocos oficiais do formulário, a busca do colaborador para
 * preencher os dados pessoais automaticamente, o checklist legal e o upload do
 * recibo de entrega da CAT ao trabalhador.
 */
export default function CatModal({ open, onClose, onSave, existingRecords = [] }: CatModalProps) {
  const settings = useSystemSettings();
  const [form, setForm] = useState<CatPayload>(() => initialPayload(settings, ""));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialPayload(settings, buildCatProtocol(existingRecords)));
    setError("");
    setCopied(false);
    // O formulário é reiniciado apenas na abertura — as settings são lidas no momento do reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<CatPayload>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = () => {
    if (!form.employerName.trim()) return setError("Informe a razão social do empregador.");
    if (!form.employerDoc.trim()) return setError("Informe o CNPJ/CEI/CPF do empregador.");
    if (!form.employerUnit.trim()) {
      return setError(
        "Vincule a CAT a uma unidade/estabelecimento — o evento precisa estar ligado a uma unidade para o acompanhamento e a conformidade."
      );
    }
    if (!form.workerName.trim()) return setError("Informe o nome do trabalhador acidentado.");
    if (onlyDigits(form.workerCpf).length !== 11) return setError("Informe um CPF válido do trabalhador (11 dígitos).");
    if (!form.accidentDate) return setError("Informe a data do acidente (ou do início da incapacidade).");
    if (!form.accidentDescription.trim()) return setError("Descreva como ocorreu o acidente ou a doença.");
    if (!form.causalAgentCode) return setError("Selecione o agente causador conforme a tabela oficial.");
    if (!form.bodyPartCode) return setError("Selecione a parte do corpo atingida.");
    if (!form.cid.trim()) return setError("Informe o CID conforme o atestado médico.");
    if (!form.receiptName) return setError("Anexe o recibo de entrega da CAT ao trabalhador.");
    if (form.consequence === "Óbito" && !form.deathDate) return setError("Informe a data do óbito.");

    setError("");
    onSave({
      id: uid("cat"),
      kind: "cat",
      title: `${form.workerName.trim()} — ${form.accidentType}`,
      date: form.accidentDate,
      establishment: form.employerUnit.trim(),
      payload: form,
    });
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptionText(form));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o resumo e copie manualmente.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-first-aid-kit-line"
      title="CAT — Comunicação de Acidente de Trabalho"
      subtitle="Formulário completo conforme Lei 8.213/91, art. 22, com recibo de entrega ao trabalhador e resumo para o eSocial."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-file-add-line">
            Gerar CAT
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-1 gap-4 rounded-lg border border-primary-200 bg-primary-50/70 p-4 sm:grid-cols-3">
          <Field label="Nº de controle interno" hint="Gerado automaticamente pelo sistema">
            <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-background-50 px-3 py-2.5">
              <i className="ri-shield-check-line text-base text-primary-700"></i>
              <span className="font-mono text-sm font-bold tracking-wide text-foreground-950">
                {form.protocol || "—"}
              </span>
            </div>
          </Field>
          <Field label="Nº da CAT emitida" hint="Número gerado no eSocial / Empregador Web">
            <input
              className={inputClass}
              value={form.catNumber}
              onChange={(e) => set({ catNumber: e.target.value })}
              placeholder="Ex.: 2026/000123456"
            />
          </Field>
          <Field label="Prazo legal de emissão" hint="Acidente: até o 1º dia útil seguinte. Óbito: imediato.">
            <div className="flex items-center gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2.5">
              <i className="ri-time-line text-base text-accent-700"></i>
              <span className="text-sm text-foreground-700">Lei 8.213/91, art. 22</span>
            </div>
          </Field>
        </section>

        <CatEmployerSection value={form} onChange={set} />
        <CatWorkerSection value={form} onChange={set} />
        <CatAccidentSection value={form} onChange={set} />
        <CatMedicalSection value={form} onChange={set} />
        <CatReceiptSection value={form} onChange={set} />

        <section className="flex flex-col gap-3 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
              Checklist legal da CAT
            </h3>
            <span className="text-[11px] text-foreground-400">Lei 8.213/91 e eSocial S-2210</span>
          </div>
          <SmartChecklist
            value={form.checklist}
            onChange={(checklist: ChecklistEntry[]) => set({ checklist })}
            suggestions={catChecklistTemplates}
            emptyHint="Adicione os itens de conferência legal da CAT."
          />
        </section>

        <section className="flex flex-col gap-3 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-file-transfer-line text-base text-primary-700"></i>
              Transcrição para o eSocial
            </h3>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className={copied ? "ri-check-line text-primary-700" : "ri-file-copy-line"}></i>
              {copied ? "Copiado" : "Copiar dados"}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-background-200 bg-background-100 p-3.5 font-mono text-[11px] leading-relaxed text-foreground-700">
            {transcriptionText(form)}
          </pre>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <Field label="Observações e pendências">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Informações complementares, encaminhamentos e pendências."
            />
          </Field>
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-pen-nib-line text-base text-primary-700"></i>
              <h3 className="text-sm font-bold text-foreground-950">Assinatura do responsável pela emissão</h3>
            </div>
            <SignatureFooter />
          </div>
        </section>
      </div>
    </Modal>
  );
}