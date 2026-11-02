import type {
  ActionItem,
  ChecklistEntry,
  MeasurementRow,
  PhotoItem,
  RiskRow,
  StructuredKind,
  WitnessItem,
} from "@/pages/app/modules/documentos/structured/structuredData";

interface StructuredBase {
  /** Nº interno de controle do documento. */
  protocol: string;
  notes: string;
  checklist: ChecklistEntry[];
  photos: PhotoItem[];
}

export interface AccidentPayload extends StructuredBase {
  occurrenceType: string;
  severity: string;
  occurrenceDate: string;
  occurrenceTime: string;
  shift: string;
  establishment: string;
  area: string;
  location: string;
  cid: string;
  // Acidentado
  victimName: string;
  victimCpf: string;
  victimRegistration: string;
  victimRole: string;
  victimAdmission: string;
  victimBirth: string;
  victimSex: string;
  // Obrigações legais
  catIssued: string;
  catNumber: string;
  catDate: string;
  esocialSent: string;
  cipaNotified: string;
  leaveDays: string;
  returnDate: string;
  // Descrição e análise
  activity: string;
  description: string;
  agent: string;
  bodyPart: string;
  injuryNature: string;
  rootCauseMethod: string;
  rootCause: string;
  contributingFactors: string;
  unsafeAct: string;
  unsafeCondition: string;
  managementFailure: string;
  nrsRelated: string;
  episUsed: string;
  trainings: string;
  immediateActions: string;
  conclusion: string;
  witnesses: WitnessItem[];
  actions: ActionItem[];
  // Responsáveis
  investigatorName: string;
  investigatorRole: string;
  investigatorRegistration: string;
  cipaRepresentative: string;
  employerRepresentative: string;
}

export interface MeasurementPayload extends StructuredBase {
  measurementDate: string;
  measurementTime: string;
  shift: string;
  establishment: string;
  area: string;
  location: string;
  activity: string;
  workerName: string;
  // Equipamento
  equipmentId: string;
  equipmentName: string;
  equipmentUnit: string;
  equipmentRefs: string;
  brand: string;
  model: string;
  serial: string;
  calibrationCertificate: string;
  calibrationLab: string;
  calibrationDate: string;
  calibrationExpiry: string;
  measurementRange: string;
  resolution: string;
  uncertainty: string;
  // Condições ambientais
  temperature: string;
  humidity: string;
  pressure: string;
  airVelocity: string;
  metabolicRate: string;
  norms: string[];
  rows: MeasurementRow[];
  conclusion: string;
  // Responsável pela aferição
  technicianName: string;
  technicianRole: string;
  technicianRegistration: string;
  technicianCompany: string;
  witnessName: string;
}

export interface WorkPermitPayload extends StructuredBase {
  ptNumber: string;
  permitDate: string;
  startTime: string;
  endTime: string;
  validUntil: string;
  establishment: string;
  area: string;
  location: string;
  equipment: string;
  workOrder: string;
  activityIds: string[];
  // Executante
  requester: string;
  executorCompany: string;
  executorResponsible: string;
  executorRole: string;
  workerCount: string;
  risks: RiskRow[];
  epiList: string;
  tools: string;
  isolation: string;
  atmosphericO2: string;
  atmosphericLel: string;
  atmosphericH2s: string;
  atmosphericCo: string;
  atmosphericTime: string;
  // Liberação e encerramento
  issuerName: string;
  issuerRole: string;
  issuerRegistration: string;
  approverName: string;
  approverRole: string;
  watcher: string;
  closureTime: string;
  closureNotes: string;
  pending: string;
}

/**
 * CAT — Comunicação de Acidente de Trabalho (Lei 8.213/91, art. 22).
 * Estrutura os quatro blocos exigidos no formulário oficial: empregador,
 * trabalhador, acidente/doença e atendimento médico com consequências,
 * além do recibo de entrega da CAT ao trabalhador.
 */
export interface CatPayload extends StructuredBase {
  /** Nº oficial da CAT emitida no eSocial / Empregador Web (opcional). */
  catNumber: string;
  // 1. Empregador
  employerName: string;
  employerDocType: string;
  employerDoc: string;
  employerCnae: string;
  employerStreet: string;
  employerNumber: string;
  employerComplement: string;
  employerDistrict: string;
  employerCity: string;
  employerUf: string;
  employerCep: string;
  employerPhone: string;
  /** Unidade / estabelecimento do empregador onde o evento ocorreu. */
  employerUnit: string;
  // 2. Trabalhador acidentado
  workerCollaboratorId: string;
  workerName: string;
  workerBirth: string;
  workerSex: string;
  workerMarital: string;
  workerCpf: string;
  workerRg: string;
  workerCtps: string;
  workerNit: string;
  workerEsocial: string;
  workerCbo: string;
  workerCategory: string;
  workerSalary: string;
  workerAdmission: string;
  workerStreet: string;
  workerNumber: string;
  workerComplement: string;
  workerDistrict: string;
  workerCity: string;
  workerUf: string;
  workerCep: string;
  workerPhone: string;
  // 3. Acidente ou doença ocupacional
  accidentType: string;
  accidentDate: string;
  accidentTime: string;
  hoursWorked: string;
  accidentLocation: string;
  accidentDescription: string;
  causalAgentCode: string;
  causalAgent: string;
  bodyPartCode: string;
  bodyPart: string;
  policeReport: string;
  policeReportNumber: string;
  policeReportUnit: string;
  policeReportDate: string;
  // 4. Atendimento médico e consequências
  medicalCare: string;
  medicalDate: string;
  medicalUnit: string;
  medicalDoctor: string;
  medicalCrm: string;
  diagnosis: string;
  cid: string;
  leaveWork: string;
  lastWorkedDay: string;
  consequence: string;
  deathDate: string;
  // Recibo de entrega da CAT
  receiptName: string;
  receiptType: string;
  receiptDataUrl: string;
  receiptDeliveredDate: string;
  receiptDeliveredTo: string;
  receiptDeliveredToUnion: string;
}

export type StructuredPayload = AccidentPayload | MeasurementPayload | WorkPermitPayload | CatPayload;

export interface StructuredRecord {
  id: string;
  kind: StructuredKind;
  title: string;
  /** Data do fato/medição/permissão no formato ISO (yyyy-mm-dd). */
  date: string;
  establishment: string;
  payload: StructuredPayload;
}

/** Campos comuns usados pelo bloco de assinaturas do PDF. */
export interface StructuredSigner {
  label: string;
  name: string;
  detail: string;
}