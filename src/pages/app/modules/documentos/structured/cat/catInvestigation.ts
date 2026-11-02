import {
  accidentChecklistTemplates,
  checklistFromTemplates,
  rootCauseMethods,
  uid,
} from "@/pages/app/modules/documentos/structured/structuredData";
import { buildCatActionPlan } from "@/pages/app/modules/documentos/structured/cat/catActionPlan";
import type {
  AccidentPayload,
  CatPayload,
  StructuredRecord,
} from "@/pages/app/modules/documentos/structured/structuredTypes";

/**
 * Ponte CAT → Investigação de Acidente.
 *
 * A CAT registra a comunicação legal do evento; a investigação é a análise
 * técnica (causa raiz + plano de ação). Ao salvar uma CAT, a investigação
 * nasce preenchida com os mesmos dados do evento, do acidentado e das
 * comunicações legais — o técnico só completa a análise.
 */

/** Converte a espécie da CAT para o tipo de ocorrência da investigação. */
const occurrenceByCatType: Record<string, string> = {
  "Acidente típico": "Acidente típico",
  "Acidente de trajeto": "Acidente de trajeto",
  "Doença ocupacional / profissional": "Doença ocupacional",
};

/** Converte a consequência da CAT na gravidade da investigação. */
function severityFromConsequence(consequence: string): string {
  if (consequence === "Óbito") return "Óbito";
  if (consequence.startsWith("Incapacidade permanente")) return "Lesão grave / incapacitante";
  if (consequence.startsWith("Afastamento temporário")) return "Lesão com afastamento";
  return "Lesão leve (sem afastamento)";
}

function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Nº de controle da investigação derivado do nº de controle da CAT. */
function investigationProtocol(catProtocol: string): string {
  const base = (catProtocol || "").trim();
  if (!base) return "";
  return base.startsWith("CAT-") ? base.replace("CAT-", "INV-") : `INV-${base}`;
}

/**
 * Monta a investigação de acidente já preenchida a partir da CAT.
 * Devolve null quando o registro não é uma CAT ou não tem os dados mínimos.
 */
export function buildInvestigationFromCat(record: StructuredRecord): StructuredRecord | null {
  if (record.kind !== "cat") return null;
  const cat = record.payload as CatPayload;
  if (!cat.workerName?.trim() || !cat.accidentDate) return null;

  const occurrenceType = occurrenceByCatType[cat.accidentType] ?? "Acidente típico";
  const establishment =
    cat.employerUnit?.trim() ||
    (cat.employerCity ? `${cat.employerCity}${cat.employerUf ? `/${cat.employerUf}` : ""}` : "");
  const suggestedActions = buildCatActionPlan(cat);

  const payload: AccidentPayload = {
    protocol: investigationProtocol(cat.protocol),
    notes: `Investigação gerada automaticamente a partir da CAT ${cat.protocol}${
      cat.catNumber ? ` (nº oficial ${cat.catNumber})` : ""
    }. O plano de ação veio pré-sugerido pelo agente causador "${cat.causalAgent || "não informado"}" — revise responsáveis e prazos e complete a análise de causa raiz.`,
    checklist: checklistFromTemplates(accidentChecklistTemplates),
    photos: [],
    occurrenceType,
    severity: severityFromConsequence(cat.consequence),
    occurrenceDate: cat.accidentDate,
    occurrenceTime: cat.accidentTime,
    shift: "",
    establishment,
    area: "",
    location: cat.accidentLocation,
    cid: cat.cid,
    // Acidentado — dados herdados do cadastro do trabalhador na CAT.
    victimName: cat.workerName,
    victimCpf: cat.workerCpf,
    victimRegistration: cat.workerEsocial || cat.workerCtps,
    victimRole: cat.workerCategory,
    victimAdmission: cat.workerAdmission,
    victimBirth: cat.workerBirth,
    victimSex: cat.workerSex,
    // Comunicações legais: a CAT já foi emitida, o eSocial depende do nº oficial.
    catIssued: "Sim",
    catNumber: cat.catNumber,
    catDate: cat.accidentDate,
    esocialSent: cat.catNumber?.trim() ? "Sim" : "Em andamento",
    cipaNotified: "Em andamento",
    leaveDays: "",
    returnDate: "",
    // Descrição do evento.
    activity: cat.workerCategory || cat.workerCbo,
    description: cat.accidentDescription,
    agent: `${cat.causalAgentCode} — ${cat.causalAgent}`.replace(/^— |— $/g, "").trim(),
    bodyPart: `${cat.bodyPartCode} — ${cat.bodyPart}`.replace(/^— |— $/g, "").trim(),
    injuryNature: cat.diagnosis,
    // Análise técnica — fica para o investigador preencher.
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
    actions: suggestedActions,
    investigatorName: "",
    investigatorRole: "",
    investigatorRegistration: "",
    cipaRepresentative: "",
    employerRepresentative: "",
  };

  return {
    id: uid("investigacao"),
    kind: "investigacao-acidente",
    title: `${cat.workerName.trim()} — ${occurrenceType}`,
    date: cat.accidentDate,
    establishment,
    payload,
  };
}

/** Compara o CPF do colaborador com o CPF informado na CAT (só dígitos). */
export function catBelongsToCollaborator(cat: CatPayload, collaboratorId: string, cpf: string): boolean {
  if (cat.workerCollaboratorId) return cat.workerCollaboratorId === collaboratorId;
  const catCpf = digitsOnly(cat.workerCpf);
  return catCpf !== "" && catCpf === digitsOnly(cpf);
}

/** Pendências legais da CAT que exigem acompanhamento da gestão. */
export function catPendingItems(cat: CatPayload): { missingNumber: boolean; missingReceipt: boolean } {
  return {
    missingNumber: !cat.catNumber?.trim(),
    missingReceipt: !cat.receiptName,
  };
}