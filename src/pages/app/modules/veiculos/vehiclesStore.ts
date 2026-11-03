import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { vehiclePhotoSlotCode } from "@/pages/app/modules/veiculos/vehicleTypes";
import type {
  CheckinItem,
  CheckinItemResult,
  CheckinKind,
  CheckinStatus,
  CheckinDamage,
  CheckinRepairRequest,
  ChecklistCriticality,
  DamageSeverity,
  DamageType,
  RepairPriority,
  RepairStatus,
  ChecklistItem,
  ChecklistTemplate,
  EpcKind,
  EpcStatus,
  InspectionResponse,
  InspectionFinding,
  InspectionResult,
  ItemAnswer,
  Vehicle,
  VehicleAlertRecord,
  VehicleBlock,
  VehicleCheckin,
  VehicleDocument,
  VehicleEpcLink,
  VehicleInspection,
  VehicleOwnership,
  VehicleRepairRequest,
  VehicleRequirement,
  VehicleStatus,
} from "@/pages/app/modules/veiculos/vehicleTypes";

/**
 * Store do módulo Veículos.
 *
 * Leitura: direto do banco, limitada pela RLS da empresa do usuário.
 * Escrita: SEMPRE pela Edge Function `veiculos`, que valida no servidor e grava
 * a trilha de auditoria. O navegador não tem permissão de INSERT/UPDATE/DELETE
 * nessas tabelas — de propósito.
 */

export interface VehiclesState {
  vehicles: Vehicle[];
  documents: VehicleDocument[];
  requirements: VehicleRequirement[];
  alerts: VehicleAlertRecord[];
  checklists: ChecklistTemplate[];
  inspections: VehicleInspection[];
  findings: InspectionFinding[];
  blocks: VehicleBlock[];
  epcLinks: VehicleEpcLink[];
  checkins: VehicleCheckin[];
  /** Solicitações de reparo abertas nos check-ins (vazio enquanto a tabela não existir). */
  repairRequests: VehicleRepairRequest[];
  epiSources: EpiSource[];
  companyId: string | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

/** Item de entrega de EPI usado como origem de um vínculo de EPC. */
export interface EpiSource {
  deliveryRef: string;
  collaboratorName: string;
  deliveryDate: string;
  name: string;
  ca: string;
  quantity: number;
}

let companyRef = "";
let state: VehiclesState = {
  vehicles: [],
  documents: [],
  requirements: [],
  alerts: [],
  checklists: [],
  inspections: [],
  findings: [],
  blocks: [],
  epcLinks: [],
  checkins: [],
  repairRequests: [],
  epiSources: [],
  companyId: null,
  loading: false,
  loaded: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<VehiclesState>): void {
  state = { ...state, ...patch };
  emit();
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    ref: str(row.ref),
    plate: str(row.plate),
    plateNormalized: str(row.plate_normalized),
    renavam: str(row.renavam),
    chassis: str(row.chassis),
    brand: str(row.brand),
    model: str(row.model),
    year: num(row.year),
    category: str(row.category),
    fuel: str(row.fuel),
    internalCode: str(row.internal_code),
    establishment: str(row.establishment),
    costCenter: str(row.cost_center),
    ownership: (str(row.ownership) || "proprio") as VehicleOwnership,
    ownerName: str(row.owner_name),
    tankCapacity: num(row.tank_capacity),
    odometer: num(row.odometer),
    photos: Array.isArray(row.photos) ? (row.photos as string[]).map((item) => String(item)) : [],
    notes: str(row.notes),
    status: (str(row.status) || "disponivel") as VehicleStatus,
  };
}

function mapDocument(row: Record<string, unknown>): VehicleDocument {
  return {
    ref: str(row.ref),
    vehicleRef: str(row.vehicle_ref),
    typeKey: str(row.type_key),
    typeLabel: str(row.type_label),
    purpose: str(row.purpose),
    number: str(row.number),
    issuedAt: row.issued_at ? str(row.issued_at) : null,
    expiresAt: row.expires_at ? str(row.expires_at) : null,
    responsible: str(row.responsible),
    fileUrl: str(row.file_url),
    storagePath: str(row.storage_path),
    fileType: str(row.file_type),
    fileSize: str(row.file_size),
    notes: str(row.notes),
    version: Number(row.version) || 1,
    isCurrent: row.is_current !== false,
    replacesRef: str(row.replaces_ref),
    supersededByRef: str(row.superseded_by_ref),
    replacementReason: str(row.replacement_reason),
    createdAt: str(row.created_at),
  };
}

function mapRequirement(row: Record<string, unknown>): VehicleRequirement {
  return {
    ref: str(row.ref),
    category: str(row.category) || "*",
    purpose: str(row.purpose) || "*",
    typeKey: str(row.type_key),
    typeLabel: str(row.type_label),
    required: row.required !== false,
    hasExpiry: row.has_expiry !== false,
    alertDays: Number(row.alert_days) || 0,
    responsible: str(row.responsible),
    notes: str(row.notes),
    active: row.active !== false,
  };
}

function mapAlert(row: Record<string, unknown>): VehicleAlertRecord {
  return {
    id: str(row.id),
    vehicleRef: str(row.vehicle_ref),
    documentRef: str(row.document_ref),
    expiresAt: row.expires_at ? str(row.expires_at) : null,
    daysBefore: num(row.days_before),
    channel: str(row.channel),
    sentTo: str(row.sent_to),
    notes: str(row.notes),
    actorName: str(row.actor_name),
    createdAt: str(row.created_at),
  };
}

/* ------------------------------- Empresa ------------------------------- */

function mapChecklistItem(raw: unknown): ChecklistItem {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    key: str(row.key),
    label: str(row.label),
    criticality: (str(row.criticality) || "media") as ChecklistCriticality,
    photoRequired: row.photoRequired === true,
    requiresBlock: row.requiresBlock === true,
    justificationRequired: row.justificationRequired !== false,
  };
}

function mapChecklist(row: Record<string, unknown>): ChecklistTemplate {
  return {
    ref: str(row.ref),
    templateRef: str(row.template_ref),
    version: Number(row.version) || 1,
    isCurrent: row.is_current !== false,
    name: str(row.name),
    category: str(row.category) || "*",
    items: Array.isArray(row.items) ? (row.items as unknown[]).map(mapChecklistItem) : [],
    active: row.active !== false,
    notes: str(row.notes),
    createdAt: str(row.created_at),
    supersededAt: row.superseded_at ? str(row.superseded_at) : null,
  };
}

function mapResponse(raw: unknown): InspectionResponse {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    itemKey: str(row.itemKey),
    label: str(row.label),
    result: (str(row.result) || "conforme") as ItemAnswer,
    observation: str(row.observation),
    justification: str(row.justification),
    photoPaths: Array.isArray(row.photoPaths) ? (row.photoPaths as unknown[]).map((item) => String(item)) : [],
    criticality: (str(row.criticality) || "media") as ChecklistCriticality,
    requiresBlock: row.requiresBlock === true,
    photoRequired: row.photoRequired === true,
  };
}

function mapInspection(row: Record<string, unknown>): VehicleInspection {
  return {
    ref: str(row.ref),
    vehicleRef: str(row.vehicle_ref),
    plateSnapshot: str(row.plate_snapshot),
    category: str(row.category),
    templateRef: str(row.template_ref),
    templateVersion: Number(row.template_version) || 1,
    templateName: str(row.template_name),
    odometer: num(row.odometer),
    responses: Array.isArray(row.responses) ? (row.responses as unknown[]).map(mapResponse) : [],
    result: (str(row.result) || "aprovado") as InspectionResult,
    criticalFindings: Number(row.critical_findings) || 0,
    totalFindings: Number(row.total_findings) || 0,
    blocked: row.blocked === true,
    notes: str(row.notes),
    performedAt: str(row.performed_at),
    performedByName: str(row.performed_by_name),
  };
}

function mapFinding(row: Record<string, unknown>): InspectionFinding {
  return {
    ref: str(row.ref),
    inspectionRef: str(row.inspection_ref),
    vehicleRef: str(row.vehicle_ref),
    itemKey: str(row.item_key),
    itemLabel: str(row.item_label),
    criticality: (str(row.criticality) || "media") as ChecklistCriticality,
    description: str(row.description),
    photoPaths: Array.isArray(row.photo_paths) ? (row.photo_paths as unknown[]).map((item) => String(item)) : [],
    correctiveAction: str(row.corrective_action),
    requiresBlock: row.requires_block === true,
    status: str(row.status) === "resolvido" ? "resolvido" : "aberto",
    resolutionNotes: str(row.resolution_notes),
    resolvedByName: str(row.resolved_by_name),
    resolvedAt: row.resolved_at ? str(row.resolved_at) : null,
  };
}

function mapBlock(row: Record<string, unknown>): VehicleBlock {
  return {
    ref: str(row.ref),
    vehicleRef: str(row.vehicle_ref),
    inspectionRef: str(row.inspection_ref),
    reason: str(row.reason),
    status: str(row.status) === "liberado" ? "liberado" : "ativo",
    blockedAt: str(row.blocked_at),
    blockedByName: str(row.blocked_by_name),
    releasedAt: row.released_at ? str(row.released_at) : null,
    releasedByName: str(row.released_by_name),
    releaseJustification: str(row.release_justification),
    releaseEvidence: Array.isArray(row.release_evidence)
      ? (row.release_evidence as unknown[]).map((item) => String(item))
      : [],
  };
}

function mapEpcLink(row: Record<string, unknown>): VehicleEpcLink {
  return {
    ref: str(row.ref),
    vehicleRef: str(row.vehicle_ref),
    source: str(row.source),
    sourceRef: str(row.source_ref),
    epiName: str(row.epi_name),
    epiCa: str(row.epi_ca),
    kind: (str(row.kind) || "epc") as EpcKind,
    identification: str(row.identification),
    quantity: Number(row.quantity) || 1,
    status: (str(row.status) || "ativo") as EpcStatus,
    notes: str(row.notes),
    linkedAt: str(row.linked_at),
    linkedByName: str(row.linked_by_name),
    unlinkedAt: row.unlinked_at ? str(row.unlinked_at) : null,
    unlinkReason: str(row.unlink_reason),
    transferToVehicleRef: str(row.transfer_to_vehicle_ref),
  };
}

function mapCheckinItem(raw: unknown): CheckinItem {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    key: str(row.key),
    label: str(row.label),
    result: (str(row.result) === "avaria" ? "avaria" : "conforme") as CheckinItemResult,
    observation: str(row.observation),
  };
}

const DAMAGE_TYPES = ["risco", "amassado", "quebrado", "trincado", "faltante", "desgaste", "outro"];
const SEVERITIES = ["leve", "moderada", "grave"];
const PRIORITIES = ["baixa", "media", "alta", "urgente"];
const REPAIR_STATUSES = ["aberta", "em_andamento", "concluida", "cancelada"];

function pick<T extends string>(value: unknown, allowed: string[], fallback: T): T {
  const v = str(value);
  return (allowed.includes(v) ? v : fallback) as T;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function mapDamage(raw: unknown): CheckinDamage {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(row.id),
    zone: str(row.zone),
    zoneLabel: str(row.zoneLabel ?? row.zone_label),
    type: pick<DamageType>(row.type, DAMAGE_TYPES, "outro"),
    severity: pick<DamageSeverity>(row.severity, SEVERITIES, "leve"),
    description: str(row.description),
    photo: str(row.photo),
    preexisting: row.preexisting === true,
    repair: row.repair === true,
  };
}

function mapCheckinRepair(raw: unknown): CheckinRepairRequest {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(row.id),
    title: str(row.title),
    description: str(row.description),
    priority: pick<RepairPriority>(row.priority, PRIORITIES, "media"),
    photos: strList(row.photos),
    damageId: str(row.damageId ?? row.damage_id),
  };
}

function mapRepairRequest(row: Record<string, unknown>): VehicleRepairRequest {
  return {
    ref: str(row.ref),
    vehicleRef: str(row.vehicle_ref),
    checkinRef: str(row.checkin_ref),
    damageId: str(row.damage_id),
    plate: str(row.plate_snapshot),
    title: str(row.title),
    description: str(row.description),
    priority: pick<RepairPriority>(row.priority, PRIORITIES, "media"),
    photos: strList(row.photos),
    status: pick<RepairStatus>(row.status, REPAIR_STATUSES, "aberta"),
    requestedByName: str(row.requested_by_name),
    requestedAt: str(row.created_at),
    resolution: str(row.resolution),
    resolvedByName: str(row.resolved_by_name),
    resolvedAt: row.resolved_at ? str(row.resolved_at) : null,
  };
}

function mapCheckin(row: Record<string, unknown>): VehicleCheckin {
  const status = str(row.status);
  return {
    ref: str(row.ref),
    vehicleRef: str(row.vehicle_ref),
    kind: (str(row.kind) === "devolucao" ? "devolucao" : "entrega") as CheckinKind,
    status: (status === "encerrada" || status === "registrada" ? status : "aberta") as CheckinStatus,
    plateSnapshot: str(row.plate_snapshot),
    vehicleCategory: str(row.vehicle_category),
    plateConfirmed: row.plate_confirmed === true,
    damages: Array.isArray(row.damages) ? (row.damages as unknown[]).map(mapDamage) : [],
    repairRequests: Array.isArray(row.repair_requests) ? (row.repair_requests as unknown[]).map(mapCheckinRepair) : [],
    responsibleName: str(row.responsible_name),
    responsibleDocument: str(row.responsible_document),
    responsibleRole: str(row.responsible_role),
    conferenteName: str(row.conferente_name),
    odometer: num(row.odometer),
    fuelLevel: num(row.fuel_level),
    items: Array.isArray(row.items) ? (row.items as unknown[]).map(mapCheckinItem) : [],
    photos: Array.isArray(row.photos) ? (row.photos as unknown[]).map((item) => String(item)) : [],
    notes: str(row.notes),
    linkedRef: str(row.linked_ref),
    performedByName: str(row.performed_by_name),
    performedAt: str(row.performed_at),
    closedAt: row.closed_at ? str(row.closed_at) : null,
  };
}

function flattenEpiSources(rows: unknown[]): EpiSource[] {
  const list: EpiSource[] = [];
  rows.forEach((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const items = Array.isArray(row.items) ? (row.items as unknown[]) : [];
    items.forEach((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const name = str(item.name) || str(item.epi) || str(item.description) || str(item.item);
      if (!name) return;
      list.push({
        deliveryRef: str(row.ref),
        collaboratorName: str(row.collaborator_name),
        deliveryDate: str(row.delivery_date),
        name,
        ca: str(item.ca) || str(item.caNumber) || str(item.certificate),
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
      });
    });
  });
  return list;
}


async function resolveCompanyId(ref: string): Promise<string> {
  if (!ref) throw new Error("company not resolved");
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("subdomain", ref)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("company not resolved");
  return String((data as Record<string, unknown>).id);
}

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    const [vehiclesRes, docsRes, reqRes, alertsRes, checklistsRes, inspectionsRes, findingsRes, blocksRes, epcRes, checkinsRes, epiRes, repairsRes] =
      await Promise.all([
        supabase.from("vehicles").select("*").eq("company_id", companyId).order("plate"),
        supabase
          .from("vehicle_documents")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase.from("vehicle_document_requirements").select("*").eq("company_id", companyId),
        supabase
          .from("vehicle_document_alerts")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("vehicle_checklist_templates")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("vehicle_inspections")
          .select("*")
          .eq("company_id", companyId)
          .order("performed_at", { ascending: false })
          .limit(300),
        supabase
          .from("vehicle_inspection_findings")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("vehicle_blocks")
          .select("*")
          .eq("company_id", companyId)
          .order("blocked_at", { ascending: false })
          .limit(300),
        supabase
          .from("vehicle_epc_links")
          .select("*")
          .eq("company_id", companyId)
          .order("linked_at", { ascending: false })
          .limit(500),
        supabase
          .from("vehicle_checkins")
          .select("*")
          .eq("company_id", companyId)
          .order("performed_at", { ascending: false })
          .limit(400),
        supabase
          .from("epi_deliveries")
          .select("ref, collaborator_name, delivery_date, items")
          .eq("company_id", companyId)
          .order("delivery_date", { ascending: false })
          .limit(120),
        supabase
          .from("vehicle_repair_requests")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
    const firstError =
      vehiclesRes.error ||
      docsRes.error ||
      reqRes.error ||
      alertsRes.error ||
      checklistsRes.error ||
      inspectionsRes.error ||
      findingsRes.error ||
      blocksRes.error ||
      epcRes.error ||
      checkinsRes.error ||
      null;
    if (firstError) throw new Error(firstError.message);
    setState({
      vehicles: (vehiclesRes.data ?? []).map((row) => mapVehicle(row as Record<string, unknown>)),
      documents: (docsRes.data ?? []).map((row) => mapDocument(row as Record<string, unknown>)),
      requirements: (reqRes.data ?? []).map((row) => mapRequirement(row as Record<string, unknown>)),
      alerts: (alertsRes.data ?? []).map((row) => mapAlert(row as Record<string, unknown>)),
      checklists: (checklistsRes.data ?? []).map((row) => mapChecklist(row as Record<string, unknown>)),
      inspections: (inspectionsRes.data ?? []).map((row) => mapInspection(row as Record<string, unknown>)),
      findings: (findingsRes.data ?? []).map((row) => mapFinding(row as Record<string, unknown>)),
      blocks: (blocksRes.data ?? []).map((row) => mapBlock(row as Record<string, unknown>)),
      epcLinks: (epcRes.data ?? []).map((row) => mapEpcLink(row as Record<string, unknown>)),
      checkins: (checkinsRes.data ?? []).map((row) => mapCheckin(row as Record<string, unknown>)),
      // Tabela nova: se ainda não existir no banco, o módulo continua funcionando sem a lista.
      repairRequests: repairsRes.error
        ? []
        : (repairsRes.data ?? []).map((row) => mapRepairRequest(row as Record<string, unknown>)),
      epiSources: flattenEpiSources(epiRes.data ?? []),
      companyId,
      loading: false,
      loaded: true,
      error: null,
    });
  } catch (error) {
    setState({
      loading: false,
      loaded: true,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível carregar os veículos da empresa.",
    });
  }
}

export async function loadVehicles(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadVehicles(): Promise<void> {
  return refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadVehicles();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): VehiclesState {
  return state;
}

export function useVehicles(company: string): VehiclesState {
  if (company && company !== companyRef) {
    companyRef = company;
    state = { ...state, loaded: false, companyId: null };
    void loadVehicles();
  }
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* --------------------------------- API --------------------------------- */

export interface VehicleApiResult {
  ok: boolean;
  error?: string;
  detail?: string;
  ref?: string;
  auditoria?: boolean;
  version?: number;
  templateRef?: string;
  result?: InspectionResult;
  blocked?: boolean;
  blockCreated?: boolean;
  totalFindings?: number;
  criticalFindings?: number;
  removidos?: number;
  arquivosRemovidos?: number;
}

async function callVeiculos(
  acao: string,
  payload: Record<string, unknown> = {}
): Promise<VehicleApiResult> {
  try {
    const { data, error } = await supabase.functions.invoke("veiculos", {
      body: { acao, ...payload },
    });
    if (error) {
      return { ok: false, error: error.message || "Falha ao falar com o servidor." };
    }
    const result = (data ?? {}) as VehicleApiResult;
    if (typeof result.ok !== "boolean") {
      return { ok: false, error: "Resposta inválida do servidor." };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha inesperada ao chamar o servidor.",
    };
  }
}

export async function salvarVeiculo(veiculo: Partial<Vehicle>): Promise<VehicleApiResult> {
  const result = await callVeiculos("salvar_veiculo", { veiculo });
  if (result.ok) await refresh();
  return result;
}

export async function inativarVeiculo(ref: string, motivo: string): Promise<VehicleApiResult> {
  const result = await callVeiculos("inativar_veiculo", { ref, motivo });
  if (result.ok) await refresh();
  return result;
}

export async function salvarDocumentoVeiculo(
  documento: Record<string, unknown>
): Promise<VehicleApiResult> {
  const result = await callVeiculos("salvar_documento", { documento });
  if (result.ok) await refresh();
  return result;
}

export async function salvarExigencia(
  exigencia: Partial<VehicleRequirement>
): Promise<VehicleApiResult> {
  const result = await callVeiculos("salvar_exigencia", { exigencia });
  if (result.ok) await refresh();
  return result;
}

export async function desativarExigencia(ref: string): Promise<VehicleApiResult> {
  const result = await callVeiculos("remover_exigencia", { exigencia: { ref } });
  if (result.ok) await refresh();
  return result;
}

export async function registrarAvisoVencimento(payload: {
  vehicleRef: string;
  documentRef?: string;
  expiresAt?: string | null;
  daysBefore?: number | null;
  channel?: string;
  sentTo?: string;
  notes?: string;
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("registrar_aviso", payload);
  if (result.ok) await refresh();
  return result;
}

/* --------------------------- Etapa 2 — API --------------------------- */

export async function salvarChecklist(checklist: {
  templateRef?: string;
  name: string;
  category: string;
  notes: string;
  items: ChecklistItem[];
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("salvar_checklist", { checklist });
  if (result.ok) await refresh();
  return result;
}

export async function desativarChecklist(templateRef: string, motivo: string): Promise<VehicleApiResult> {
  const result = await callVeiculos("desativar_checklist", { templateRef, motivo });
  if (result.ok) await refresh();
  return result;
}

export async function registrarInspecao(inspecao: {
  vehicleRef: string;
  templateRef: string;
  odometer: number | null;
  notes: string;
  responses: Array<{
    itemKey: string;
    result: ItemAnswer;
    observation: string;
    justification: string;
    photoPaths: string[];
    correctiveAction: string;
  }>;
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("registrar_inspecao", { inspecao });
  if (result.ok) await refresh();
  return result;
}

export async function resolverAchado(findingRef: string, resolucao: string): Promise<VehicleApiResult> {
  const result = await callVeiculos("resolver_achado", { findingRef, resolucao });
  if (result.ok) await refresh();
  return result;
}

export async function liberarBloqueio(payload: {
  blockRef: string;
  justificativa: string;
  evidencias: string[];
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("liberar_bloqueio", payload);
  if (result.ok) await refresh();
  return result;
}

export async function vincularEpc(vinculo: {
  vehicleRef: string;
  kind: EpcKind;
  epiName: string;
  epiCa: string;
  identification: string;
  quantity: number;
  source: string;
  sourceRef: string;
  notes: string;
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("vincular_epc", { vinculo });
  if (result.ok) await refresh();
  return result;
}

export async function desvincularEpc(linkRef: string, motivo: string): Promise<VehicleApiResult> {
  const result = await callVeiculos("desvincular_epc", { linkRef, motivo });
  if (result.ok) await refresh();
  return result;
}

export async function transferirEpc(
  linkRef: string,
  toVehicleRef: string,
  motivo: string
): Promise<VehicleApiResult> {
  const result = await callVeiculos("transferir_epc", { linkRef, toVehicleRef, motivo });
  if (result.ok) await refresh();
  return result;
}

/* --------------------------- Etapa 3 — check-in --------------------------- */

export async function registrarCheckin(checkin: {
  vehicleRef: string;
  kind: CheckinKind;
  responsibleName: string;
  responsibleDocument: string;
  responsibleRole: string;
  conferenteName: string;
  odometer: number | null;
  fuelLevel: number | null;
  items: CheckinItem[];
  photos: string[];
  notes: string;
  plateTyped?: string;
  damages?: CheckinDamage[];
  repairRequests?: CheckinRepairRequest[];
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("registrar_checkin", { checkin });
  if (result.ok) await refresh();
  return result;
}

/** Atualiza o andamento de uma solicitação de reparo (permissão de edição da frota). */
export async function atualizarReparo(payload: {
  ref: string;
  status: RepairStatus;
  resolution: string;
}): Promise<VehicleApiResult> {
  const result = await callVeiculos("atualizar_reparo", { reparo: payload });
  if (result.ok) await refresh();
  return result;
}

/* ----------------------- Frota de demonstração ----------------------- */

/**
 * Remove a frota fictícia da empresa atual e tudo que pende dela
 * (documentos, inspeções, achados, bloqueios, EPCs e check-ins).
 * Exige perfil administrador com permissão de edição — validado no servidor.
 */
export async function limparFrotaDemo(): Promise<VehicleApiResult> {
  const result = await callVeiculos("limpar_frota_demo");
  if (result.ok) await refresh();
  return result;
}

/* ------------------------------- Arquivos ------------------------------- */

const VEHICLE_BUCKET = "documents";

function sanitizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "arquivo"
  );
}

/** Envia arquivo para o bucket privado e devolve o caminho + link temporário. */
export async function uploadVehicleFile(
  file: File,
  photoSlot = ""
): Promise<{ path: string; url: string | null } | null> {
  try {
    const prefix = companyRef || "empresa";
    // O código da lateral vai no nome do arquivo para que a foto continue
    // ligada à lateral certa depois de recarregar a ficha.
    const tag = photoSlot ? `${vehiclePhotoSlotCode(photoSlot)}-` : "";
    const path = `${prefix}/veiculos/${tag}${Date.now()}-${sanitizeName(file.name)}`;
    const { error } = await supabase.storage.from(VEHICLE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = await supabase.storage.from(VEHICLE_BUCKET).createSignedUrl(path, 3600);
    return { path, url: data?.signedUrl ?? null };
  } catch {
    return null;
  }
}

/** Link assinado (temporário) para abrir/baixar um arquivo do veículo. */
export async function signVehiclePath(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(VEHICLE_BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}