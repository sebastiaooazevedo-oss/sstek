/**
 * Domínio do módulo Veículos — Etapa 1 (cadastro, documentos e vencimentos).
 *
 * `ref` é o ID interno estável e é o que TODOS os relacionamentos usam. A placa
 * é apenas a forma de identificar o veículo na interface: se ela for corrigida,
 * documentos e histórico continuam ligados ao mesmo `ref`.
 */

export type VehicleStatus = "disponivel" | "em_uso" | "manutencao" | "bloqueado" | "inativo";
export type VehicleOwnership = "proprio" | "locado" | "terceiro";

export interface Vehicle {
  ref: string;
  plate: string;
  plateNormalized: string;
  renavam: string;
  chassis: string;
  brand: string;
  model: string;
  year: number | null;
  category: string;
  fuel: string;
  internalCode: string;
  establishment: string;
  costCenter: string;
  ownership: VehicleOwnership;
  ownerName: string;
  tankCapacity: number | null;
  odometer: number | null;
  photos: string[];
  notes: string;
  status: VehicleStatus;
}

/* ------------------- Fotos obrigatórias do veículo ------------------- */

/**
 * Cada veículo precisa das 4 laterais fotografadas no cadastro. O código da
 * lateral é gravado no próprio caminho do arquivo (`/veiculos/frente-<ts>-...`),
 * então a foto continua ligada à lateral correta mesmo depois de recarregar.
 */
export const vehiclePhotoSlots: { key: string; label: string; hint: string; icon: string }[] = [
  { key: "frente", label: "Frente", hint: "Diagonal da frente", icon: "ri-car-line" },
  {
    key: "lateral_esquerda",
    label: "Lateral esquerda",
    hint: "Lado do motorista",
    icon: "ri-roadster-line",
  },
  {
    key: "lateral_direita",
    label: "Lateral direita",
    hint: "Lado do passageiro",
    icon: "ri-roadster-line",
  },
  { key: "traseira", label: "Traseira", hint: "Diagonal da traseira", icon: "ri-car-line" },
];

/** Código usado no caminho do arquivo (sem underline, para o nome ficar estável). */
export function vehiclePhotoSlotCode(slotKey: string): string {
  return slotKey.replace(/_/g, "-");
}

/** Lateral a que uma foto pertence. `null` para fotos antigas/avulsas. */
export function photoSlotOfPath(path: string): string | null {
  const match = path.match(/\/veiculos\/([a-z-]+)-\d{10,}-/);
  if (!match) return null;
  const code = match[1];
  return vehiclePhotoSlots.find((slot) => vehiclePhotoSlotCode(slot.key) === code)?.key ?? null;
}

/** Fotos de uma lateral específica. */
export function photosForSlot(photos: string[], slotKey: string): string[] {
  return photos.filter((path) => photoSlotOfPath(path) === slotKey);
}

/** Fotos que não pertencem a nenhuma das 4 laterais obrigatórias. */
export function extraPhotos(photos: string[]): string[] {
  return photos.filter((path) => photoSlotOfPath(path) === null);
}

/** Laterais ainda sem foto — usado na validação do cadastro. */
export function missingPhotoSlots(photos: string[]): string[] {
  return vehiclePhotoSlots
    .filter((slot) => photosForSlot(photos, slot.key).length === 0)
    .map((slot) => slot.label);
}

export interface VehicleDocument {
  ref: string;
  vehicleRef: string;
  typeKey: string;
  typeLabel: string;
  purpose: string;
  number: string;
  issuedAt: string | null;
  expiresAt: string | null;
  responsible: string;
  fileUrl: string;
  storagePath: string;
  fileType: string;
  fileSize: string;
  notes: string;
  version: number;
  isCurrent: boolean;
  replacesRef: string;
  supersededByRef: string;
  replacementReason: string;
  createdAt: string;
}

export interface VehicleRequirement {
  ref: string;
  category: string;
  purpose: string;
  typeKey: string;
  typeLabel: string;
  required: boolean;
  hasExpiry: boolean;
  alertDays: number;
  responsible: string;
  notes: string;
  active: boolean;
}

export interface VehicleAlertRecord {
  id: string;
  vehicleRef: string;
  documentRef: string;
  expiresAt: string | null;
  daysBefore: number | null;
  channel: string;
  sentTo: string;
  notes: string;
  actorName: string;
  createdAt: string;
}

/* ---------------------- Etapa 2 — inspeções ---------------------- */

export type ChecklistCriticality = "baixa" | "media" | "alta" | "critica";

export interface ChecklistItem {
  key: string;
  label: string;
  criticality: ChecklistCriticality;
  photoRequired: boolean;
  requiresBlock: boolean;
  justificationRequired: boolean;
}

export interface ChecklistTemplate {
  ref: string;
  templateRef: string;
  version: number;
  isCurrent: boolean;
  name: string;
  category: string;
  items: ChecklistItem[];
  active: boolean;
  notes: string;
  createdAt: string;
  supersededAt: string | null;
}

export type ItemAnswer = "conforme" | "nao_conforme" | "nao_aplicavel";

export interface InspectionResponse {
  itemKey: string;
  label: string;
  result: ItemAnswer;
  observation: string;
  justification: string;
  photoPaths: string[];
  criticality: ChecklistCriticality;
  requiresBlock: boolean;
  photoRequired: boolean;
}

export type InspectionResult = "aprovado" | "reprovado";

export interface VehicleInspection {
  ref: string;
  vehicleRef: string;
  plateSnapshot: string;
  category: string;
  templateRef: string;
  templateVersion: number;
  templateName: string;
  odometer: number | null;
  responses: InspectionResponse[];
  result: InspectionResult;
  criticalFindings: number;
  totalFindings: number;
  blocked: boolean;
  notes: string;
  performedAt: string;
  performedByName: string;
}

export interface InspectionFinding {
  ref: string;
  inspectionRef: string;
  vehicleRef: string;
  itemKey: string;
  itemLabel: string;
  criticality: ChecklistCriticality;
  description: string;
  photoPaths: string[];
  correctiveAction: string;
  requiresBlock: boolean;
  status: "aberto" | "resolvido";
  resolutionNotes: string;
  resolvedByName: string;
  resolvedAt: string | null;
}

export interface VehicleBlock {
  ref: string;
  vehicleRef: string;
  inspectionRef: string;
  reason: string;
  status: "ativo" | "liberado";
  blockedAt: string;
  blockedByName: string;
  releasedAt: string | null;
  releasedByName: string;
  releaseJustification: string;
  releaseEvidence: string[];
}

export type EpcKind = "epc" | "acessorio";
export type EpcStatus = "ativo" | "removido" | "transferido";

export interface VehicleEpcLink {
  ref: string;
  vehicleRef: string;
  source: string;
  sourceRef: string;
  epiName: string;
  epiCa: string;
  kind: EpcKind;
  identification: string;
  quantity: number;
  status: EpcStatus;
  notes: string;
  linkedAt: string;
  linkedByName: string;
  unlinkedAt: string | null;
  unlinkReason: string;
  transferToVehicleRef: string;
}

/* ---------------------- Etapa 3 — check-in de entrega e devolução ---------------------- */

export type CheckinKind = "entrega" | "devolucao";
export type CheckinStatus = "aberta" | "encerrada" | "registrada";
export type CheckinItemResult = "conforme" | "avaria";

export interface CheckinItem {
  key: string;
  label: string;
  result: CheckinItemResult;
  observation: string;
}

/**
 * Checklist de retirada (`entrega`) e de devolução (`devolucao`).
 *
 * Na retirada, o colaborador que executa o checklist assume o veículo como
 * condutor responsável. Na devolução o veículo volta para a empresa e fica sem
 * condutor responsável — o histórico aponta quem devolveu e quem conferiu.
 * Os dois exigem dupla conferência (condutor + conferente da empresa).
 */
export interface VehicleCheckin {
  ref: string;
  vehicleRef: string;
  kind: CheckinKind;
  status: CheckinStatus;
  plateSnapshot: string;
  responsibleName: string;
  responsibleDocument: string;
  responsibleRole: string;
  conferenteName: string;
  odometer: number | null;
  fuelLevel: number | null;
  items: CheckinItem[];
  photos: string[];
  notes: string;
  linkedRef: string;
  performedByName: string;
  performedAt: string;
  closedAt: string | null;
}

export const checkinKindMeta: Record<CheckinKind, { label: string; short: string; icon: string; className: string }> = {
  entrega: {
    label: "Checklist de retirada",
    short: "Retirada",
    icon: "ri-logout-box-r-line",
    className: "bg-secondary-100 text-secondary-800",
  },
  devolucao: {
    label: "Checklist de devolução",
    short: "Devolução",
    icon: "ri-login-box-line",
    className: "bg-primary-100 text-primary-700",
  },
};

export const checkinStatusMeta: Record<CheckinStatus, { label: string; className: string }> = {
  aberta: { label: "Em uso (retirada aberta)", className: "bg-accent-100 text-accent-800" },
  encerrada: { label: "Retirada encerrada", className: "bg-background-200 text-foreground-600" },
  registrada: { label: "Devolução registrada", className: "bg-primary-100 text-primary-700" },
};

/** Conferência de condições aplicada nos dois check-ins. */
export const checkinConditionItems: { key: string; label: string }[] = [
  { key: "pneus", label: "Pneus, rodas e estepe" },
  { key: "lataria", label: "Lataria, para-choques e carroceria" },
  { key: "vidros", label: "Vidros, retrovisores e faróis" },
  { key: "iluminacao", label: "Iluminação e sinalização" },
  { key: "cintos", label: "Cintos, bancos e cabine" },
  { key: "limpeza", label: "Limpeza e conservação" },
  { key: "documentos", label: "Documentos e equipamentos obrigatórios" },
];

/** Entrega em aberto (veículo em uso) de um veículo, se existir. */
export function openDeliveryFor(checkins: VehicleCheckin[], vehicleRef: string): VehicleCheckin | null {
  return (
    checkins.find(
      (item) => item.vehicleRef === vehicleRef && item.kind === "entrega" && item.status === "aberta"
    ) ?? null
  );
}

export function checkinsForVehicle(checkins: VehicleCheckin[], vehicleRef: string): VehicleCheckin[] {
  return checkins
    .filter((item) => item.vehicleRef === vehicleRef)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}

/* ---------------------- Catálogos da Etapa 2 ---------------------- */

export const criticalityMeta: Record<ChecklistCriticality, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-background-200 text-foreground-600" },
  media: { label: "Média", className: "bg-secondary-100 text-secondary-800" },
  alta: { label: "Alta", className: "bg-accent-100 text-accent-800" },
  critica: { label: "Crítica", className: "bg-danger-100 text-danger-800" },
};

export const criticalityOptions: ChecklistCriticality[] = ["baixa", "media", "alta", "critica"];

export const inspectionResultMeta: Record<InspectionResult, { label: string; className: string }> = {
  aprovado: { label: "Aprovado", className: "bg-primary-100 text-primary-700" },
  reprovado: { label: "Com não conformidade", className: "bg-danger-100 text-danger-800" },
};

export const itemAnswerMeta: Record<ItemAnswer, { label: string; className: string; icon: string }> = {
  conforme: { label: "Conforme", className: "bg-primary-100 text-primary-700", icon: "ri-check-line" },
  nao_conforme: { label: "Não conforme", className: "bg-danger-100 text-danger-800", icon: "ri-close-line" },
  nao_aplicavel: { label: "Não aplicável", className: "bg-background-200 text-foreground-600", icon: "ri-subtract-line" },
};

export const epcKindLabels: Record<EpcKind, string> = {
  epc: "EPC",
  acessorio: "Acessório",
};

export const epcStatusMeta: Record<EpcStatus, { label: string; className: string }> = {
  ativo: { label: "Ativo no veículo", className: "bg-primary-100 text-primary-700" },
  removido: { label: "Removido", className: "bg-background-200 text-foreground-600" },
  transferido: { label: "Transferido", className: "bg-secondary-100 text-secondary-800" },
};

/** Checklists vigentes aplicáveis à categoria do veículo (ou a todas). */
export function checklistsForVehicle(
  templates: ChecklistTemplate[],
  category: string
): ChecklistTemplate[] {
  return templates.filter(
    (template) =>
      template.isCurrent &&
      template.active &&
      (template.category === "*" || !category || template.category === category)
  );
}

/* ------------------------------ Catálogos ------------------------------ */

export const vehicleStatusMeta: Record<VehicleStatus, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-primary-100 text-primary-700" },
  em_uso: { label: "Em uso", className: "bg-secondary-100 text-secondary-800" },
  manutencao: { label: "Em manutenção", className: "bg-accent-100 text-accent-800" },
  bloqueado: { label: "Bloqueado", className: "bg-danger-100 text-danger-800" },
  inativo: { label: "Inativo", className: "bg-background-200 text-foreground-600" },
};

export const vehicleStatusOptions: VehicleStatus[] = [
  "disponivel",
  "em_uso",
  "manutencao",
  "bloqueado",
  "inativo",
];

export const ownershipLabels: Record<VehicleOwnership, string> = {
  proprio: "Próprio",
  locado: "Locado",
  terceiro: "Terceiro",
};

export const vehicleCategories = [
  "Leve",
  "Utilitário",
  "Van",
  "Caminhão",
  "Carreta",
  "Ônibus",
  "Moto",
  "Máquina",
];

export const vehicleFuels = ["Diesel S10", "Diesel", "Gasolina", "Etanol", "Flex", "GNV", "Elétrico"];

export const vehiclePurposes = [
  { key: "*", label: "Qualquer finalidade" },
  { key: "administrativo", label: "Administrativo" },
  { key: "operacional", label: "Operacional" },
  { key: "transporte_carga", label: "Transporte de carga" },
  { key: "transporte_pessoas", label: "Transporte de pessoas" },
];

export const vehicleDocumentTypes = [
  { key: "crlv", label: "CRLV-e" },
  { key: "seguro", label: "Apólice de seguro" },
  { key: "locacao", label: "Contrato de locação" },
  { key: "laudo", label: "Laudo técnico" },
  { key: "inspecao", label: "Inspeção veicular" },
  { key: "outro", label: "Outro documento" },
];

export const vehicleDocumentTypeLabel = (key: string): string =>
  vehicleDocumentTypes.find((item) => item.key === key)?.label ?? "Outro documento";

/* ------------------------------- Utilitários ------------------------------ */

const pad = (value: number): string => String(value).padStart(2, "0");

/** "aaaa-mm-dd" → "dd/mm/aaaa". */
export function formatDateBr(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value;
}

/** "aaaa-mm-dd HH:mm" no formato brasileiro. */
export function formatDateTimeBr(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** Dias até o vencimento (negativo = vencido). `null` quando não há data. */
export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const target = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export type DocSituation = "substituido" | "sem_vencimento" | "vencido" | "vencendo" | "em_dia";

export const docSituationMeta: Record<DocSituation, { label: string; className: string }> = {
  em_dia: { label: "Em dia", className: "bg-primary-100 text-primary-700" },
  vencendo: { label: "Vencendo", className: "bg-accent-100 text-accent-800" },
  vencido: { label: "Vencido", className: "bg-danger-100 text-danger-800" },
  sem_vencimento: { label: "Sem vencimento", className: "bg-background-200 text-foreground-600" },
  substituido: { label: "Substituído", className: "bg-background-200 text-foreground-500" },
};

/** Situação real do documento. Documento substituído nunca aparece como vigente. */
export function docSituation(doc: VehicleDocument, alertDays = 30): DocSituation {
  if (!doc.isCurrent) return "substituido";
  if (!doc.expiresAt) return "sem_vencimento";
  const days = daysUntil(doc.expiresAt);
  if (days === null) return "sem_vencimento";
  if (days < 0) return "vencido";
  if (days <= alertDays) return "vencendo";
  return "em_dia";
}

/** Exigências aplicáveis a um veículo (empresa + categoria). */
export function requirementsForVehicle(
  requirements: VehicleRequirement[],
  vehicle: Vehicle
): VehicleRequirement[] {
  return requirements.filter(
    (item) =>
      item.active &&
      (item.category === "*" || item.category === vehicle.category) &&
      (item.purpose === "*" || item.purpose === "" || item.purpose === "operacional" || true)
  );
}

export interface VehiclePendency {
  requirement: VehicleRequirement;
  situation: "ausente" | "vencido" | "vencendo" | "em_dia" | "nao_aplicavel";
  document: VehicleDocument | null;
}

/**
 * Cruza exigências x documentos vigentes do veículo.
 * "Não aplicável" só aparece quando a exigência dispensa vencimento e o
 * documento existente realmente não tem data.
 */
export function buildPendencies(
  vehicle: Vehicle,
  requirements: VehicleRequirement[],
  documents: VehicleDocument[]
): VehiclePendency[] {
  const current = documents.filter((doc) => doc.vehicleRef === vehicle.ref && doc.isCurrent);
  return requirementsForVehicle(requirements, vehicle).map((requirement) => {
    const match =
      current.find(
        (doc) =>
          doc.typeKey === requirement.typeKey &&
          (requirement.purpose === "*" || !requirement.purpose || doc.purpose === requirement.purpose)
      ) ?? null;
    if (!match) {
      return { requirement, situation: "ausente" as const, document: null };
    }
    const situation = docSituation(match, requirement.alertDays);
    if (situation === "vencido" || situation === "vencendo" || situation === "em_dia") {
      return { requirement, situation, document: match };
    }
    return {
      requirement,
      situation: requirement.hasExpiry ? "ausente" : "nao_aplicavel",
      document: match,
    };
  });
}

export interface VehicleDocumentSummary {
  vencidos: number;
  vencendo: number;
  ausentes: number;
  total: number;
}

/** Resumo documental do veículo usado na lista e nos indicadores. */
export function summarizeVehicleDocuments(
  vehicle: Vehicle,
  documents: VehicleDocument[],
  requirements: VehicleRequirement[]
): VehicleDocumentSummary {
  const current = documents.filter((doc) => doc.vehicleRef === vehicle.ref && doc.isCurrent);
  const vencidos = current.filter((doc) => docSituation(doc) === "vencido").length;
  const vencendo = current.filter((doc) => docSituation(doc) === "vencendo").length;
  const pendencies = buildPendencies(vehicle, requirements, documents);
  const ausentes = pendencies.filter((item) => item.situation === "ausente").length;
  return { vencidos, vencendo, ausentes, total: current.length };
}

/** Placas da frota fictícia usada em demonstrações (mesmo conjunto em todas as empresas). */
export const demoFleetPlates = ["VGA1A23", "VGA2B34", "VGA3C45"];

/** Veículo de demonstração usado como alvo das ações de demonstração. */
export const demoShowcasePlate = "VGA1A23";

/** Limpa a placa digitada: só letras e números, em maiúsculas. */
export function normalizePlateInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

/** `true` para ABC1234 (antigo) e ABC1D23 (Mercosul). */
export function isValidPlate(value: string): boolean {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlateInput(value));
}