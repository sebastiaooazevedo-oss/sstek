// Edge Function: veiculos — Etapa 1 (cadastro, documentos versionados,
// exigências documentais por empresa/categoria e registro de avisos).
//
// As tabelas do módulo negam escrita pelo cliente (RLS) e `system_audit_logs`
// também — por isso toda gravação e toda auditoria acontecem aqui.
// Cliente ANON (token do usuário) só identifica o usuário e resolve permissões.
// Cliente SERVICE ROLE só executa banco/auditoria.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  MAX_CHECKIN_DAMAGES,
  MAX_CHECKIN_REPAIRS,
  fotosObrigatoriasFaltando,
  placaConfere,
  sanitizarAvaria,
  sanitizarReparo,
  transicaoReparoPermitida,
  validarAvaria,
  validarReparo,
  type AvariaEntrada,
  type ReparoEntrada,
} from "../_shared/checkin.ts";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

const OWNERSHIPS = ["proprio", "locado", "terceiro"];
const STATUSES = ["disponivel", "em_uso", "manutencao", "bloqueado", "inativo"];
const MAX_PHOTOS = 6;
const PLATE_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

function normalizePlate(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function text(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

/** "dd/mm/aaaa" ou "aaaa-mm-dd" → "aaaa-mm-dd"; null = vazio, undefined = inválido. */
function parseDate(value: unknown): string | null | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let year = 0;
  let month = 0;
  let day = 0;
  if (br) {
    day = Number(br[1]);
    month = Number(br[2]);
    year = Number(br[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return undefined;
  }
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return undefined;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function optionalInt(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, max);
}

const INSPECTION_RESULTS = ["conforme", "nao_conforme", "nao_aplicavel"];
const CHECKLIST_CRITICALITIES = ["baixa", "media", "alta", "critica"];
const EPC_KINDS = ["epc", "acessorio"];
const MAX_ITEM_PHOTOS = 6;
const EPC_STATUS_ACTIVE = "ativo";
const CHECKIN_KINDS = ["entrega", "devolucao"];
const CHECKIN_ITEM_RESULTS = ["conforme", "avaria"];
const MAX_CHECKIN_PHOTOS = 8; // 5 obrigatórias (frente, traseira, laterais, painel) + 3 adicionais

interface Access {
  role: string | null;
  fullAccess: boolean;
  permissions: Record<string, boolean>;
}

function can(access: Access, permission: string): boolean {
  if (!access.role) return false;
  if (access.fullAccess) return true;
  return access.permissions[permission] === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return jsonResponse({ ok: false, error: "service_unavailable" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ ok: false, error: "nao_autenticado", detail: "É preciso estar logado." }, 401);
  }

  try {
    const anon = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await anon.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ ok: false, error: "nao_autenticado", detail: "Sessão expirada." }, 401);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, name, company_id")
      .eq("auth_user_id", user.id)
      .not("company_id", "is", null)
      .limit(1);
    const profile = Array.isArray(profileRows) ? profileRows[0] : null;
    const companyId = profile?.company_id ? String(profile.company_id) : "";
    if (!companyId) {
      return jsonResponse({ ok: false, error: "sem_empresa", detail: "Usuário sem empresa vinculada." }, 403);
    }

    const { data: companyRow } = await admin
      .from("companies")
      .select("id, subdomain")
      .eq("id", companyId)
      .maybeSingle();
    const companyRef = String((companyRow as Record<string, unknown> | null)?.subdomain ?? "");
    if (!companyRef) {
      return jsonResponse({ ok: false, error: "empresa_invalida", detail: "Empresa não encontrada." }, 409);
    }

    const { data: accessRaw } = await anon.rpc("tenant_effective_access");
    const payloadAccess = ((Array.isArray(accessRaw) ? accessRaw[0] : accessRaw) ?? {}) as Record<string, unknown>;
    const permissionsRaw = payloadAccess.permissions;
    const permissions: Record<string, boolean> = {};
    if (permissionsRaw && typeof permissionsRaw === "object" && !Array.isArray(permissionsRaw)) {
      Object.entries(permissionsRaw as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value === "boolean") permissions[key] = value;
      });
    }
    const access: Access = {
      role:
        payloadAccess.role === "admin"
          ? "admin"
          : payloadAccess.role === "colaborador"
            ? "colaborador"
            : null,
      fullAccess: payloadAccess.fullAccess === true,
      permissions,
    };

    const actorName = text(profile?.name ?? user.email ?? "", 120) || "Usuário do sistema";
    const actorId = user.id;

    async function audit(entry: {
      action: string;
      entity: string;
      entityId: string;
      field?: string | null;
      oldValue?: string | null;
      newValue?: string | null;
      detail: string;
    }): Promise<string | null> {
      const { error } = await admin.from("system_audit_logs").insert({
        company_id: companyId,
        module: "veiculos",
        area: "frota",
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId,
        field: entry.field ?? null,
        old_value: entry.oldValue ?? null,
        new_value: entry.newValue ?? null,
        detail: entry.detail,
        actor_id: actorId,
        actor_name: actorName,
      });
      return error ? error.message : null;
    }

    function deny(permission: string): Response {
      return jsonResponse(
        {
          ok: false,
          error: "sem_permissao",
          detail: `Seu perfil não tem a permissão necessária (${permission}) para esta operação.`,
        },
        403,
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    const acao = text(payload?.acao, 40).toLowerCase();

    /* --------------------------- 1. Veículo --------------------------- */
    if (acao === "salvar_veiculo") {
      const veiculo = (payload?.veiculo ?? {}) as Record<string, unknown>;
      const ref = text(veiculo.ref, 60);
      const isNew = !ref;
      const required = isNew ? "vehicles.create" : "vehicles.edit";
      if (!can(access, required)) return deny(required);

      const plate = text(veiculo.plate, 20);
      const plateNormalized = normalizePlate(plate);
      if (!PLATE_RE.test(plateNormalized)) {
        return jsonResponse(
          {
            ok: false,
            error: "placa_invalida",
            detail: "Placa inválida. Use o formato ABC1234 (antigo) ou ABC1D23 (Mercosul).",
          },
          400,
        );
      }

      const ownership = text(veiculo.ownership, 20) || "proprio";
      if (!OWNERSHIPS.includes(ownership)) {
        return jsonResponse({ ok: false, error: "propriedade_invalida", detail: "Propriedade inválida." }, 400);
      }
      const status = text(veiculo.status, 20) || "disponivel";
      if (!STATUSES.includes(status)) {
        return jsonResponse({ ok: false, error: "situacao_invalida", detail: "Situação inválida." }, 400);
      }
      const ownerName = text(veiculo.ownerName, 160);
      if (ownership !== "proprio" && !ownerName) {
        return jsonResponse(
          { ok: false, error: "proprietario_obrigatorio", detail: "Informe o proprietário ou a locadora do veículo." },
          400,
        );
      }

      const yearRaw = veiculo.year;
      let year: number | null = null;
      if (yearRaw !== null && yearRaw !== undefined && yearRaw !== "") {
        const parsed = Number(yearRaw);
        if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
          return jsonResponse({ ok: false, error: "ano_invalido", detail: "Ano inválido." }, 400);
        }
        year = parsed;
      }

      const odometer = optionalInt(veiculo.odometer);
      if (odometer === undefined) {
        return jsonResponse(
          {
            ok: false,
            error: "hodometro_invalido",
            detail: "Hodômetro deve ser um número inteiro maior ou igual a zero.",
          },
          400,
        );
      }

      let tankCapacity: number | null = null;
      if (veiculo.tankCapacity !== null && veiculo.tankCapacity !== undefined && veiculo.tankCapacity !== "") {
        const parsed = Number(veiculo.tankCapacity);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return jsonResponse(
            { ok: false, error: "tanque_invalido", detail: "Capacidade do tanque deve ser maior que zero." },
            400,
          );
        }
        tankCapacity = Math.round(parsed * 100) / 100;
      }

      const photos = stringList(veiculo.photos, MAX_PHOTOS);

      // As 4 laterais são obrigatórias no cadastro — validadas também no servidor.
      const requiredPhotoSides: Array<[string, string]> = [
        ["frente", "frente"],
        ["lateral-esquerda", "lateral esquerda"],
        ["lateral-direita", "lateral direita"],
        ["traseira", "traseira"],
      ];
      const missingPhotoSides = requiredPhotoSides
        .filter(([code]) => !photos.some((path) => new RegExp(`/veiculos/${code}-\\d{10,}-`).test(path)))
        .map(([, label]) => label);
      if (missingPhotoSides.length > 0) {
        return jsonResponse(
          {
            ok: false,
            error: "fotos_obrigatorias",
            detail: `Anexe as 4 fotos obrigatórias do veículo. Faltando: ${missingPhotoSides.join(", ")}.`,
          },
          400,
        );
      }

      const { data: duplicate } = await admin
        .from("vehicles")
        .select("ref")
        .eq("company_ref", companyRef)
        .eq("plate_normalized", plateNormalized)
        .maybeSingle();
      const duplicateRef = duplicate ? String((duplicate as Record<string, unknown>).ref) : "";
      if (duplicateRef && duplicateRef !== ref) {
        return jsonResponse(
          {
            ok: false,
            error: "placa_duplicada",
            detail: `A placa ${plateNormalized} já está cadastrada nesta empresa.`,
          },
          409,
        );
      }

      const row: Record<string, unknown> = {
        company_id: companyId,
        company_ref: companyRef,
        plate,
        plate_normalized: plateNormalized,
        renavam: text(veiculo.renavam, 30) || null,
        chassis: text(veiculo.chassis, 40) || null,
        brand: text(veiculo.brand, 60) || null,
        model: text(veiculo.model, 80) || null,
        year,
        category: text(veiculo.category, 60) || null,
        fuel: text(veiculo.fuel, 40) || null,
        internal_code: text(veiculo.internalCode, 60) || null,
        establishment: text(veiculo.establishment, 120) || null,
        cost_center: text(veiculo.costCenter, 80) || null,
        ownership,
        owner_name: ownerName || null,
        tank_capacity: tankCapacity,
        odometer,
        photos,
        notes: text(veiculo.notes, 2000) || null,
        status,
      };

      if (isNew) {
        const newRef = `vei-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
        const { error: insertError } = await admin
          .from("vehicles")
          .insert({ ...row, ref: newRef, created_by: actorId });
        if (insertError) {
          return jsonResponse({ ok: false, error: "gravacao_falhou", detail: insertError.message }, 500);
        }
        const auditError = await audit({
          action: "created",
          entity: "vehicles",
          entityId: newRef,
          newValue: plateNormalized,
          detail: `Veículo ${plateNormalized} cadastrado por ${actorName}.`,
        });
        return jsonResponse({
          ok: true,
          ref: newRef,
          auditoria: !auditError,
          detail: auditError
            ? `Veículo cadastrado, mas o registro de auditoria falhou: ${auditError}`
            : "Veículo cadastrado.",
        });
      }

      const { data: current, error: readError } = await admin
        .from("vehicles")
        .select("*")
        .eq("company_ref", companyRef)
        .eq("ref", ref)
        .maybeSingle();
      if (readError) {
        return jsonResponse({ ok: false, error: "leitura_falhou", detail: readError.message }, 500);
      }
      if (!current) {
        return jsonResponse({ ok: false, error: "veiculo_nao_encontrado", detail: "Veículo não encontrado." }, 404);
      }

      const previous = current as Record<string, unknown>;
      const { error: updateError } = await admin
        .from("vehicles")
        .update(row)
        .eq("company_ref", companyRef)
        .eq("ref", ref);
      if (updateError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: updateError.message }, 500);
      }

      const tracked: Array<[string, unknown, unknown]> = [
        ["placa", previous.plate_normalized, row.plate_normalized],
        ["situacao", previous.status, row.status],
        ["hodometro", previous.odometer, row.odometer],
        ["propriedade", previous.ownership, row.ownership],
        ["proprietario", previous.owner_name, row.owner_name],
        ["estabelecimento", previous.establishment, row.establishment],
        ["centro_custo", previous.cost_center, row.cost_center],
      ];
      const changed = tracked.filter(([, before, after]) => String(before ?? "") !== String(after ?? ""));
      const plateChanged = String(previous.plate_normalized ?? "") !== plateNormalized;
      let auditError: string | null = null;
      if (plateChanged) {
        auditError = await audit({
          action: "updated",
          entity: "vehicles",
          entityId: ref,
          field: "plate",
          oldValue: String(previous.plate ?? ""),
          newValue: plate,
          detail: `Placa alterada de ${previous.plate ?? "—"} para ${plate} por ${actorName}. O histórico do veículo foi preservado.`,
        });
      } else if (changed.length) {
        auditError = await audit({
          action: "updated",
          entity: "vehicles",
          entityId: ref,
          newValue: changed.map(([field]) => field).join(", "),
          detail: `Cadastro do veículo ${plate} alterado por ${actorName} (${changed
            .map(([field]) => field)
            .join(", ")}).`,
        });
      }

      return jsonResponse({
        ok: true,
        ref,
        alterado: plateChanged || changed.length > 0,
        auditoria: !auditError,
        detail: auditError ? `Alterações salvas, mas a auditoria falhou: ${auditError}` : "Alterações salvas.",
      });
    }

    /* ------------------------ 2. Documento ------------------------ */
    if (acao === "salvar_documento") {
      if (!can(access, "vehicles.documents")) return deny("vehicles.documents");
      const doc = (payload?.documento ?? {}) as Record<string, unknown>;
      const vehicleRef = text(doc.vehicleRef, 60);
      if (!vehicleRef) {
        return jsonResponse({ ok: false, error: "veiculo_obrigatorio", detail: "Selecione o veículo." }, 400);
      }
      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate")
        .eq("company_ref", companyRef)
        .eq("ref", vehicleRef)
        .maybeSingle();
      if (!vehicleRow) {
        return jsonResponse({ ok: false, error: "veiculo_nao_encontrado", detail: "Veículo não encontrado." }, 404);
      }

      const typeLabel = text(doc.typeLabel, 120);
      if (!typeLabel) {
        return jsonResponse({ ok: false, error: "tipo_obrigatorio", detail: "Informe o tipo do documento." }, 400);
      }

      const issuedAt = parseDate(doc.issuedAt);
      const expiresAt = parseDate(doc.expiresAt);
      if (issuedAt === undefined || expiresAt === undefined) {
        return jsonResponse({ ok: false, error: "data_invalida", detail: "Data inválida. Use DD/MM/AAAA." }, 400);
      }
      if (issuedAt && expiresAt && expiresAt < issuedAt) {
        return jsonResponse(
          { ok: false, error: "periodo_invalido", detail: "O vencimento não pode ser anterior à emissão." },
          400,
        );
      }

      const replacesRef = text(doc.replacesRef, 60);
      let version = 1;
      let previous: Record<string, unknown> | null = null;
      if (replacesRef) {
        const { data: previousRow } = await admin
          .from("vehicle_documents")
          .select("*")
          .eq("company_ref", companyRef)
          .eq("ref", replacesRef)
          .eq("vehicle_ref", vehicleRef)
          .maybeSingle();
        if (!previousRow) {
          return jsonResponse(
            { ok: false, error: "documento_anterior_invalido", detail: "Documento a substituir não encontrado." },
            404,
          );
        }
        previous = previousRow as Record<string, unknown>;
        version = Number(previous.version ?? 1) + 1;
        if (previous.is_current === false) {
          return jsonResponse(
            {
              ok: false,
              error: "documento_ja_substituido",
              detail: "Este documento já foi substituído por outra versão.",
            },
            409,
          );
        }
      }

      const newRef = `vdoc-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
      const row: Record<string, unknown> = {
        company_id: companyId,
        company_ref: companyRef,
        ref: newRef,
        vehicle_ref: vehicleRef,
        type_key: text(doc.typeKey, 60) || "outro",
        type_label: typeLabel,
        purpose: text(doc.purpose, 80) || null,
        number: text(doc.number, 80) || null,
        issued_at: issuedAt,
        expires_at: expiresAt,
        responsible: text(doc.responsible, 120) || null,
        file_url: text(doc.fileUrl, 1200) || null,
        storage_path: text(doc.storagePath, 600) || null,
        file_type: text(doc.fileType, 40) || null,
        file_size: text(doc.fileSize, 40) || null,
        notes: text(doc.notes, 2000) || null,
        version,
        is_current: true,
        replaces_ref: replacesRef || null,
        created_by: actorId,
      };

      const { error: insertError } = await admin.from("vehicle_documents").insert(row);
      if (insertError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: insertError.message }, 500);
      }

      let auditError: string | null = null;
      if (previous && replacesRef) {
        const { error: supersedeError } = await admin
          .from("vehicle_documents")
          .update({
            is_current: false,
            superseded_by_ref: newRef,
            superseded_at: new Date().toISOString(),
            replacement_reason: text(doc.replacementReason, 500) || null,
          })
          .eq("company_ref", companyRef)
          .eq("ref", replacesRef);
        if (supersedeError) {
          return jsonResponse({ ok: false, error: "substituicao_falhou", detail: supersedeError.message }, 500);
        }
        auditError = await audit({
          action: "updated",
          entity: "vehicle_documents",
          entityId: newRef,
          field: "version",
          oldValue: `${previous.type_label ?? ""} v${previous.version ?? 1} (${previous.expires_at ?? "sem vencimento"})`,
          newValue: `${typeLabel} v${version} (${expiresAt ?? "sem vencimento"})`,
          detail: `Documento ${typeLabel} do veículo ${vehicleRow.plate} substituído (v${version}) por ${actorName}. A versão anterior foi preservada.`,
        });
      } else {
        auditError = await audit({
          action: "created",
          entity: "vehicle_documents",
          entityId: newRef,
          newValue: `${typeLabel} (${expiresAt ?? "sem vencimento"})`,
          detail: `Documento ${typeLabel} anexado ao veículo ${vehicleRow.plate} por ${actorName}.`,
        });
      }

      return jsonResponse({
        ok: true,
        ref: newRef,
        version,
        auditoria: !auditError,
        detail: auditError
          ? `Documento salvo, mas a auditoria falhou: ${auditError}`
          : replacesRef
            ? "Nova versão do documento registrada. A anterior ficou preservada."
            : "Documento registrado.",
      });
    }

    /* ------------------------ 3. Exigências ------------------------ */
    if (acao === "salvar_exigencia" || acao === "remover_exigencia") {
      if (!can(access, "vehicles.documents")) return deny("vehicles.documents");
      const ex = (payload?.exigencia ?? {}) as Record<string, unknown>;
      const ref = text(ex.ref, 60);

      if (acao === "remover_exigencia") {
        if (!ref) return jsonResponse({ ok: false, error: "ref_obrigatorio" }, 400);
        const { error } = await admin
          .from("vehicle_document_requirements")
          .update({ active: false })
          .eq("company_ref", companyRef)
          .eq("ref", ref);
        if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
        const auditError = await audit({
          action: "deleted",
          entity: "vehicle_document_requirements",
          entityId: ref,
          detail: `Exigência documental desativada por ${actorName} (histórico preservado).`,
        });
        return jsonResponse({ ok: true, auditoria: !auditError, detail: "Exigência desativada." });
      }

      const typeLabel = text(ex.typeLabel, 120);
      if (!typeLabel) {
        return jsonResponse({ ok: false, error: "tipo_obrigatorio", detail: "Informe o tipo do documento." }, 400);
      }
      const alertDaysRaw = ex.alertDays === undefined || ex.alertDays === "" ? 30 : Number(ex.alertDays);
      if (!Number.isInteger(alertDaysRaw) || alertDaysRaw < 0 || alertDaysRaw > 365) {
        return jsonResponse(
          { ok: false, error: "antecedencia_invalida", detail: "Antecedência deve estar entre 0 e 365 dias." },
          400,
        );
      }

      const row: Record<string, unknown> = {
        company_id: companyId,
        company_ref: companyRef,
        category: text(ex.category, 60) || "*",
        purpose: text(ex.purpose, 60) || "*",
        type_key: text(ex.typeKey, 60) || "outro",
        type_label: typeLabel,
        required: ex.required !== false,
        has_expiry: ex.hasExpiry !== false,
        alert_days: alertDaysRaw,
        responsible: text(ex.responsible, 120) || null,
        notes: text(ex.notes, 1000) || null,
        active: ex.active !== false,
      };

      if (ref) {
        const { error } = await admin
          .from("vehicle_document_requirements")
          .update(row)
          .eq("company_ref", companyRef)
          .eq("ref", ref);
        if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
        const auditError = await audit({
          action: "updated",
          entity: "vehicle_document_requirements",
          entityId: ref,
          newValue: `${typeLabel} (${row.category}/${row.purpose})`,
          detail: `Exigência documental ${typeLabel} alterada por ${actorName}.`,
        });
        return jsonResponse({ ok: true, ref, auditoria: !auditError, detail: "Exigência atualizada." });
      }

      const newRef = `vexg-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
      const { error } = await admin.from("vehicle_document_requirements").insert({ ...row, ref: newRef });
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
      const auditError = await audit({
        action: "created",
        entity: "vehicle_document_requirements",
        entityId: newRef,
        newValue: `${typeLabel} (${row.category}/${row.purpose})`,
        detail: `Exigência documental ${typeLabel} criada por ${actorName}.`,
      });
      return jsonResponse({ ok: true, ref: newRef, auditoria: !auditError, detail: "Exigência criada." });
    }

    /* ------------------- 4. Registro de aviso de vencimento ------------------- */
    if (acao === "registrar_aviso") {
      if (!can(access, "vehicles.documents")) return deny("vehicles.documents");
      const vehicleRef = text(payload?.vehicleRef, 60);
      if (!vehicleRef) return jsonResponse({ ok: false, error: "veiculo_obrigatorio" }, 400);
      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate")
        .eq("company_ref", companyRef)
        .eq("ref", vehicleRef)
        .maybeSingle();
      if (!vehicleRow) {
        return jsonResponse({ ok: false, error: "veiculo_nao_encontrado" }, 404);
      }
      const daysBefore = Number(payload?.daysBefore ?? 0);
      const row = {
        company_id: companyId,
        company_ref: companyRef,
        vehicle_ref: vehicleRef,
        document_ref: text(payload?.documentRef, 60) || null,
        expires_at: parseDate(payload?.expiresAt) ?? null,
        days_before: Number.isFinite(daysBefore) ? Math.trunc(daysBefore) : null,
        channel: text(payload?.channel, 40) || "registro_interno",
        sent_to: text(payload?.sentTo, 300) || null,
        notes: text(payload?.notes, 1000) || null,
        actor_name: actorName,
      };
      const { error } = await admin.from("vehicle_document_alerts").insert(row);
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
      const auditError = await audit({
        action: "notified",
        entity: "vehicle_document_alerts",
        entityId: vehicleRef,
        newValue: row.expires_at ?? "",
        detail: `Aviso de vencimento registrado para o veículo ${vehicleRow.plate} por ${actorName} (canal: ${row.channel}).`,
      });
      return jsonResponse({ ok: true, auditoria: !auditError, detail: "Aviso registrado." });
    }

    /* --------------------------- 5. Inativar --------------------------- */
    if (acao === "inativar_veiculo") {
      if (!can(access, "vehicles.edit")) return deny("vehicles.edit");
      const ref = text(payload?.ref, 60);
      const motivo = text(payload?.motivo, 500);
      if (!ref) return jsonResponse({ ok: false, error: "ref_obrigatorio" }, 400);
      if (motivo.length < 10) {
        return jsonResponse(
          {
            ok: false,
            error: "justificativa_obrigatoria",
            detail: "Informe o motivo da inativação (mínimo 10 caracteres).",
          },
          400,
        );
      }
      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate, status")
        .eq("company_ref", companyRef)
        .eq("ref", ref)
        .maybeSingle();
      if (!vehicleRow) return jsonResponse({ ok: false, error: "veiculo_nao_encontrado" }, 404);
      if (String(vehicleRow.status) === "inativo") {
        return jsonResponse({ ok: false, error: "ja_inativo", detail: "O veículo já está inativo." }, 409);
      }
      const { error } = await admin
        .from("vehicles")
        .update({ status: "inativo" })
        .eq("company_ref", companyRef)
        .eq("ref", ref);
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
      const auditError = await audit({
        action: "deleted",
        entity: "vehicles",
        entityId: ref,
        oldValue: String(vehicleRow.status),
        newValue: "inativo",
        detail: `Veículo ${vehicleRow.plate} inativado por ${actorName}. Motivo: ${motivo}. O histórico foi preservado (nada foi excluído).`,
      });
      return jsonResponse({
        ok: true,
        auditoria: !auditError,
        detail: "Veículo inativado. O histórico e os documentos permanecem preservados.",
      });
    }

    /* --------------------- 6. Checklist (versionado) --------------------- */
    if (acao === "salvar_checklist") {
      if (!can(access, "vehicles.checklists")) return deny("vehicles.checklists");
      const checklist = (payload?.checklist ?? {}) as Record<string, unknown>;
      const templateRefInput = text(checklist.templateRef, 60);
      const name = text(checklist.name, 140);
      if (!name) {
        return jsonResponse({ ok: false, error: "nome_obrigatorio", detail: "Informe o nome do checklist." }, 400);
      }
      const category = text(checklist.category, 60) || "*";
      const notes = text(checklist.notes, 1000);

      const rawItems = Array.isArray(checklist.items) ? checklist.items : [];
      if (rawItems.length === 0) {
        return jsonResponse(
          { ok: false, error: "itens_obrigatorios", detail: "Inclua ao menos um item no checklist." },
          400,
        );
      }
      if (rawItems.length > 80) {
        return jsonResponse(
          { ok: false, error: "itens_demais", detail: "O checklist aceita no máximo 80 itens." },
          400,
        );
      }

      const items: Record<string, unknown>[] = [];
      const seenKeys = new Set<string>();
      for (let index = 0; index < rawItems.length; index += 1) {
        const raw = (rawItems[index] ?? {}) as Record<string, unknown>;
        const label = text(raw.label, 160);
        if (!label) {
          return jsonResponse(
            { ok: false, error: "item_sem_descricao", detail: `O item ${index + 1} está sem descrição.` },
            400,
          );
        }
        const key = text(raw.key, 60) || `it-${index + 1}`;
        if (seenKeys.has(key)) {
          return jsonResponse(
            { ok: false, error: "item_duplicado", detail: `O item "${label}" está repetido.` },
            400,
          );
        }
        seenKeys.add(key);
        const criticality = text(raw.criticality, 20) || "media";
        if (!CHECKLIST_CRITICALITIES.includes(criticality)) {
          return jsonResponse(
            { ok: false, error: "criticidade_invalida", detail: `Criticidade inválida no item "${label}".` },
            400,
          );
        }
        items.push({
          key,
          label,
          criticality,
          photoRequired: raw.photoRequired === true,
          requiresBlock: raw.requiresBlock === true || criticality === "critica",
          justificationRequired: raw.justificationRequired !== false,
        });
      }

      let version = 1;
      let previousRef = "";
      let previousVersion = 0;
      if (templateRefInput) {
        const { data: current } = await admin
          .from("vehicle_checklist_templates")
          .select("ref, version")
          .eq("company_ref", companyRef)
          .eq("template_ref", templateRefInput)
          .eq("is_current", true)
          .maybeSingle();
        if (!current) {
          return jsonResponse(
            { ok: false, error: "checklist_nao_encontrado", detail: "Modelo de checklist não encontrado." },
            404,
          );
        }
        previousRef = String((current as Record<string, unknown>).ref ?? "");
        previousVersion = Number((current as Record<string, unknown>).version ?? 1);
        version = previousVersion + 1;

        const { error: supersedeError } = await admin
          .from("vehicle_checklist_templates")
          .update({ is_current: false, superseded_at: new Date().toISOString() })
          .eq("company_ref", companyRef)
          .eq("ref", previousRef);
        if (supersedeError) {
          return jsonResponse({ ok: false, error: "gravacao_falhou", detail: supersedeError.message }, 500);
        }
      }

      const stableRef =
        templateRefInput || `vtpl-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
      const newRef = `vchk-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;

      const { error: insertError } = await admin.from("vehicle_checklist_templates").insert({
        company_id: companyId,
        company_ref: companyRef,
        ref: newRef,
        template_ref: stableRef,
        version,
        is_current: true,
        name,
        category,
        items,
        active: true,
        notes: notes || null,
        created_by: actorId,
      });
      if (insertError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: insertError.message }, 500);
      }

      const auditError = await audit({
        action: previousRef ? "updated" : "created",
        entity: "vehicle_checklist_templates",
        entityId: stableRef,
        oldValue: previousRef ? `v${previousVersion}` : null,
        newValue: `v${version} (${items.length} itens)`,
        detail: previousRef
          ? `Checklist ${name} recebeu a versão ${version} por ${actorName}. A versão ${previousVersion} foi preservada e as inspeções antigas mantêm o checklist respondido.`
          : `Checklist ${name} criado por ${actorName} (categoria ${category}, ${items.length} itens).`,
      });

      return jsonResponse({
        ok: true,
        ref: newRef,
        templateRef: stableRef,
        version,
        auditoria: !auditError,
        detail: auditError
          ? `Checklist salvo, mas a auditoria falhou: ${auditError}`
          : previousRef
            ? `Versão ${version} criada. A versão anterior continua preservada.`
            : "Checklist criado.",
      });
    }

    if (acao === "desativar_checklist") {
      if (!can(access, "vehicles.checklists")) return deny("vehicles.checklists");
      const templateRef = text(payload?.templateRef, 60);
      const motivo = text(payload?.motivo, 500);
      if (!templateRef) return jsonResponse({ ok: false, error: "ref_obrigatorio" }, 400);
      if (motivo.length < 10) {
        return jsonResponse(
          {
            ok: false,
            error: "justificativa_obrigatoria",
            detail: "Informe o motivo da desativação (mínimo 10 caracteres).",
          },
          400,
        );
      }
      const { error } = await admin
        .from("vehicle_checklist_templates")
        .update({ active: false })
        .eq("company_ref", companyRef)
        .eq("template_ref", templateRef);
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
      const auditError = await audit({
        action: "deleted",
        entity: "vehicle_checklist_templates",
        entityId: templateRef,
        detail: `Checklist desativado por ${actorName}. Motivo: ${motivo}. As versões e inspeções já registradas foram preservadas.`,
      });
      return jsonResponse({
        ok: true,
        auditoria: !auditError,
        detail: "Checklist desativado. Nada foi excluído.",
      });
    }

    /* -------------------------- 7. Inspeção -------------------------- */
    if (acao === "registrar_inspecao") {
      if (!can(access, "vehicles.inspections")) return deny("vehicles.inspections");
      const inspecao = (payload?.inspecao ?? {}) as Record<string, unknown>;

      const vehicleRef = text(inspecao.vehicleRef, 60);
      if (!vehicleRef) {
        return jsonResponse({ ok: false, error: "veiculo_obrigatorio", detail: "Selecione o veículo." }, 400);
      }
      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate, category, odometer, status")
        .eq("company_ref", companyRef)
        .eq("ref", vehicleRef)
        .maybeSingle();
      if (!vehicleRow) {
        return jsonResponse({ ok: false, error: "veiculo_nao_encontrado", detail: "Veículo não encontrado." }, 404);
      }
      const vehicle = vehicleRow as Record<string, unknown>;

      const templateRef = text(inspecao.templateRef, 60);
      if (!templateRef) {
        return jsonResponse(
          { ok: false, error: "checklist_obrigatorio", detail: "Selecione o modelo de checklist." },
          400,
        );
      }
      const { data: templateRow } = await admin
        .from("vehicle_checklist_templates")
        .select("template_ref, version, name, category, items, active")
        .eq("company_ref", companyRef)
        .eq("template_ref", templateRef)
        .eq("is_current", true)
        .maybeSingle();
      if (!templateRow) {
        return jsonResponse(
          { ok: false, error: "checklist_nao_encontrado", detail: "Modelo de checklist não encontrado." },
          404,
        );
      }
      const template = templateRow as Record<string, unknown>;
      if (template.active === false) {
        return jsonResponse(
          { ok: false, error: "checklist_inativo", detail: "Este checklist está desativado e não pode ser aplicado." },
          409,
        );
      }
      const templateItems = Array.isArray(template.items)
        ? (template.items as Record<string, unknown>[])
        : [];
      if (templateItems.length === 0) {
        return jsonResponse(
          { ok: false, error: "checklist_vazio", detail: "Este modelo não tem itens para inspecionar." },
          409,
        );
      }

      const odometer = optionalInt(inspecao.odometer);
      if (odometer === undefined) {
        return jsonResponse(
          { ok: false, error: "hodometro_invalido", detail: "Hodômetro deve ser um número inteiro maior ou igual a zero." },
          400,
        );
      }

      const responsesRaw = Array.isArray(inspecao.responses) ? inspecao.responses : [];
      const answers = new Map<string, Record<string, unknown>>();
      responsesRaw.forEach((raw) => {
        const item = (raw ?? {}) as Record<string, unknown>;
        const itemKey = text(item.itemKey, 60);
        if (itemKey) answers.set(itemKey, item);
      });

      const snapshot: Record<string, unknown>[] = [];
      const findings: Record<string, unknown>[] = [];
      let criticalCount = 0;

      for (const templateItem of templateItems) {
        const itemKey = text(templateItem.key, 60);
        const label = text(templateItem.label, 160) || itemKey;
        const answer = answers.get(itemKey);
        if (!answer) {
          return jsonResponse(
            {
              ok: false,
              error: "item_sem_resposta",
              detail: `O item "${label}" não foi respondido. Todos os itens precisam de conferência.`,
            },
            400,
          );
        }
        const result = text(answer.result, 20);
        if (!INSPECTION_RESULTS.includes(result)) {
          return jsonResponse(
            { ok: false, error: "resposta_invalida", detail: `Resposta inválida no item "${label}".` },
            400,
          );
        }
        const observation = text(answer.observation, 1000);
        const justification = text(answer.justification, 500);
        const photoPaths = stringList(answer.photoPaths, MAX_ITEM_PHOTOS);
        const criticality = text(templateItem.criticality, 20) || "media";
        const requiresBlock = templateItem.requiresBlock === true || criticality === "critica";
        const justificationRequired = templateItem.justificationRequired !== false;

        if (result === "nao_aplicavel" && justificationRequired && !justification) {
          return jsonResponse(
            {
              ok: false,
              error: "justificativa_obrigatoria",
              detail: `O item "${label}" exige justificativa para ser marcado como não aplicável.`,
            },
            400,
          );
        }
        if (result === "nao_conforme" && templateItem.photoRequired === true && photoPaths.length === 0) {
          return jsonResponse(
            {
              ok: false,
              error: "foto_obrigatoria",
              detail: `O item "${label}" exige pelo menos uma foto da não conformidade.`,
            },
            400,
          );
        }

        snapshot.push({
          itemKey,
          label,
          result,
          observation: observation || null,
          justification: justification || null,
          photoPaths,
          criticality,
          requiresBlock,
          photoRequired: templateItem.photoRequired === true,
        });

        if (result === "nao_conforme") {
          if (requiresBlock) criticalCount += 1;
          findings.push({
            itemKey,
            itemLabel: label,
            criticality,
            description: observation || `Não conformidade registrada no item ${label}.`,
            photoPaths,
            correctiveAction: text(answer.correctiveAction, 1000) || null,
            requiresBlock,
          });
        }
      }

      const blocked = criticalCount > 0;
      const totalFindings = findings.length;
      const inspectionResult = totalFindings > 0 ? "reprovado" : "aprovado";
      const inspectionRef = `vinsp-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;

      const { error: insertError } = await admin.from("vehicle_inspections").insert({
        company_id: companyId,
        company_ref: companyRef,
        ref: inspectionRef,
        vehicle_ref: vehicleRef,
        plate_snapshot: text(vehicle.plate, 20) || null,
        category: text(template.category, 60) || text(vehicle.category, 60) || null,
        template_ref: templateRef,
        template_version: Number(template.version ?? 1),
        template_name: text(template.name, 140) || null,
        odometer,
        responses: snapshot,
        result: inspectionResult,
        critical_findings: criticalCount,
        total_findings: totalFindings,
        blocked,
        notes: text(inspecao.notes, 1000) || null,
        performed_by: actorId,
        performed_by_name: actorName,
      });
      if (insertError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: insertError.message }, 500);
      }

      if (findings.length > 0) {
        const rows = findings.map((finding, index) => ({
          company_id: companyId,
          company_ref: companyRef,
          ref: `${inspectionRef}-f${index + 1}`,
          inspection_ref: inspectionRef,
          vehicle_ref: vehicleRef,
          item_key: String(finding.itemKey),
          item_label: String(finding.itemLabel),
          criticality: String(finding.criticality),
          description: finding.description ? String(finding.description) : null,
          photo_paths: finding.photoPaths,
          corrective_action: finding.correctiveAction ? String(finding.correctiveAction) : null,
          requires_block: finding.requiresBlock === true,
          status: "aberto",
        }));
        const { error: findingsError } = await admin.from("vehicle_inspection_findings").insert(rows);
        if (findingsError) {
          return jsonResponse(
            {
              ok: false,
              error: "achados_falharam",
              detail: `A inspeção ${inspectionRef} foi registrada, mas os achados falharam: ${findingsError.message}. Registre a ocorrência com o gestor.`,
            },
            500,
          );
        }
      }

      let blockCreated = false;
      if (blocked) {
        const { data: activeBlock } = await admin
          .from("vehicle_blocks")
          .select("ref")
          .eq("company_ref", companyRef)
          .eq("vehicle_ref", vehicleRef)
          .eq("status", "ativo")
          .maybeSingle();
        if (!activeBlock) {
          const blockRef = `vblk-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
          const criticalLabels = findings
            .filter((finding) => finding.requiresBlock === true)
            .map((finding) => String(finding.itemLabel))
            .join(", ");
          const { error: blockError } = await admin.from("vehicle_blocks").insert({
            company_id: companyId,
            company_ref: companyRef,
            ref: blockRef,
            vehicle_ref: vehicleRef,
            inspection_ref: inspectionRef,
            reason: `Não conformidade crítica na inspeção: ${criticalLabels}.`,
            status: "ativo",
            blocked_by: actorId,
            blocked_by_name: actorName,
          });
          if (blockError) {
            return jsonResponse(
              {
                ok: false,
                error: "bloqueio_falhou",
                detail: `A inspeção foi registrada, mas o bloqueio automático falhou: ${blockError.message}. Bloqueie o veículo manualmente.`,
              },
              500,
            );
          }
          blockCreated = true;
        }
      }

      const vehiclePatch: Record<string, unknown> = {};
      if (blocked && String(vehicle.status) !== "inativo") vehiclePatch.status = "bloqueado";
      const currentOdometer = vehicle.odometer === null || vehicle.odometer === undefined ? null : Number(vehicle.odometer);
      if (odometer !== null && (currentOdometer === null || odometer > currentOdometer)) {
        vehiclePatch.odometer = odometer;
      }
      if (Object.keys(vehiclePatch).length > 0) {
        await admin.from("vehicles").update(vehiclePatch).eq("company_ref", companyRef).eq("ref", vehicleRef);
      }

      const auditError = await audit({
        action: blocked ? "blocked" : "created",
        entity: "vehicle_inspections",
        entityId: inspectionRef,
        newValue: `${inspectionResult} · ${totalFindings} achado(s) · ${criticalCount} crítico(s)`,
        detail: `Inspeção do veículo ${vehicle.plate} (${text(template.name, 140)} v${template.version}) registrada por ${actorName}. ${totalFindings} não conformidade(s), ${criticalCount} crítica(s).${
          blocked ? " Veículo bloqueado automaticamente até liberação autorizada." : ""
        }`,
      });

      return jsonResponse({
        ok: true,
        ref: inspectionRef,
        result: inspectionResult,
        totalFindings,
        criticalFindings: criticalCount,
        blocked,
        blockCreated,
        auditoria: !auditError,
        detail: blocked
          ? "Inspeção registrada. Há não conformidade crítica: o veículo foi bloqueado e só pode ser liberado por perfil autorizado, com justificativa e evidência."
          : totalFindings > 0
            ? "Inspeção registrada com não conformidades. Nenhuma crítica: o veículo não foi bloqueado."
            : "Inspeção registrada sem não conformidades.",
      });
    }

    /* ------------------------ 8. Resolver achado ------------------------ */
    if (acao === "resolver_achado") {
      if (!can(access, "vehicles.inspections")) return deny("vehicles.inspections");
      const findingRef = text(payload?.findingRef, 60);
      const resolution = text(payload?.resolucao, 1000);
      if (!findingRef) return jsonResponse({ ok: false, error: "ref_obrigatorio" }, 400);
      if (resolution.length < 10) {
        return jsonResponse(
          {
            ok: false,
            error: "resolucao_obrigatoria",
            detail: "Descreva a tratativa do achado (mínimo 10 caracteres).",
          },
          400,
        );
      }
      const { data: findingRow } = await admin
        .from("vehicle_inspection_findings")
        .select("ref, item_label, status, vehicle_ref")
        .eq("company_ref", companyRef)
        .eq("ref", findingRef)
        .maybeSingle();
      if (!findingRow) {
        return jsonResponse({ ok: false, error: "achado_nao_encontrado", detail: "Achado não encontrado." }, 404);
      }
      if (String((findingRow as Record<string, unknown>).status) === "resolvido") {
        return jsonResponse(
          { ok: false, error: "achado_ja_resolvido", detail: "Este achado já foi resolvido." },
          409,
        );
      }
      const { error } = await admin
        .from("vehicle_inspection_findings")
        .update({
          status: "resolvido",
          resolution_notes: resolution,
          resolved_by: actorId,
          resolved_by_name: actorName,
          resolved_at: new Date().toISOString(),
        })
        .eq("company_ref", companyRef)
        .eq("ref", findingRef);
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
      const auditError = await audit({
        action: "updated",
        entity: "vehicle_inspection_findings",
        entityId: findingRef,
        oldValue: "aberto",
        newValue: "resolvido",
        detail: `Achado "${String((findingRow as Record<string, unknown>).item_label)}" tratado por ${actorName}. Tratativa: ${resolution}`,
      });
      return jsonResponse({
        ok: true,
        auditoria: !auditError,
        detail: "Achado marcado como resolvido. O registro original foi preservado.",
      });
    }

    /* ------------------------ 9. Liberar bloqueio ------------------------ */
    if (acao === "liberar_bloqueio") {
      if (!can(access, "vehicles.unblock")) return deny("vehicles.unblock");
      const blockRef = text(payload?.blockRef, 60);
      const justificativa = text(payload?.justificativa, 1000);
      const evidence = stringList(payload?.evidencias, 6);
      if (!blockRef) return jsonResponse({ ok: false, error: "ref_obrigatorio" }, 400);
      if (justificativa.length < 15) {
        return jsonResponse(
          {
            ok: false,
            error: "justificativa_obrigatoria",
            detail: "Descreva a justificativa da liberação (mínimo 15 caracteres).",
          },
          400,
        );
      }
      if (evidence.length === 0) {
        return jsonResponse(
          {
            ok: false,
            error: "evidencia_obrigatoria",
            detail: "Anexe pelo menos uma evidência da correção antes de liberar o veículo.",
          },
          400,
        );
      }
      const { data: blockRow } = await admin
        .from("vehicle_blocks")
        .select("ref, vehicle_ref, status")
        .eq("company_ref", companyRef)
        .eq("ref", blockRef)
        .maybeSingle();
      if (!blockRow) {
        return jsonResponse({ ok: false, error: "bloqueio_nao_encontrado", detail: "Bloqueio não encontrado." }, 404);
      }
      const block = blockRow as Record<string, unknown>;
      if (String(block.status) !== "ativo") {
        return jsonResponse({ ok: false, error: "bloqueio_ja_liberado", detail: "Este bloqueio já foi liberado." }, 409);
      }

      const { data: openCritical } = await admin
        .from("vehicle_inspection_findings")
        .select("ref, item_label")
        .eq("company_ref", companyRef)
        .eq("vehicle_ref", String(block.vehicle_ref))
        .eq("requires_block", true)
        .neq("status", "resolvido")
        .limit(10);
      const pending = Array.isArray(openCritical) ? openCritical : [];
      if (pending.length > 0) {
        const labels = pending
          .map((row) => String((row as Record<string, unknown>).item_label ?? ""))
          .filter(Boolean)
          .join(", ");
        return jsonResponse(
          {
            ok: false,
            error: "achados_pendentes",
            detail: `Existem achados críticos sem tratativa registrada: ${labels}. Resolva os achados antes de liberar o veículo.`,
          },
          409,
        );
      }

      const { error: releaseError } = await admin
        .from("vehicle_blocks")
        .update({
          status: "liberado",
          released_at: new Date().toISOString(),
          released_by: actorId,
          released_by_name: actorName,
          release_justification: justificativa,
          release_evidence: evidence,
        })
        .eq("company_ref", companyRef)
        .eq("ref", blockRef);
      if (releaseError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: releaseError.message }, 500);
      }

      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate, status")
        .eq("company_ref", companyRef)
        .eq("ref", String(block.vehicle_ref))
        .maybeSingle();
      const vehicleStatus = vehicleRow ? String((vehicleRow as Record<string, unknown>).status) : "";
      if (vehicleStatus === "bloqueado") {
        await admin
          .from("vehicles")
          .update({ status: "disponivel" })
          .eq("company_ref", companyRef)
          .eq("ref", String(block.vehicle_ref));
      }

      const auditError = await audit({
        action: "released",
        entity: "vehicle_blocks",
        entityId: blockRef,
        oldValue: "ativo",
        newValue: "liberado",
        detail: `Bloqueio do veículo ${vehicleRow ? String((vehicleRow as Record<string, unknown>).plate) : String(block.vehicle_ref)} liberado por ${actorName}. Justificativa: ${justificativa}. Evidências: ${evidence.length} arquivo(s).`,
      });

      return jsonResponse({
        ok: true,
        auditoria: !auditError,
        detail: "Veículo liberado. Justificativa, evidências e autor ficaram registrados na auditoria.",
      });
    }

    /* --------------------------- 10. EPC --------------------------- */
    if (acao === "vincular_epc") {
      if (!can(access, "vehicles.epc")) return deny("vehicles.epc");
      const vinculo = (payload?.vinculo ?? {}) as Record<string, unknown>;
      const vehicleRef = text(vinculo.vehicleRef, 60);
      if (!vehicleRef) {
        return jsonResponse({ ok: false, error: "veiculo_obrigatorio", detail: "Selecione o veículo." }, 400);
      }
      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate")
        .eq("company_ref", companyRef)
        .eq("ref", vehicleRef)
        .maybeSingle();
      if (!vehicleRow) {
        return jsonResponse({ ok: false, error: "veiculo_nao_encontrado", detail: "Veículo não encontrado." }, 404);
      }
      const kind = text(vinculo.kind, 20) || "epc";
      if (!EPC_KINDS.includes(kind)) {
        return jsonResponse({ ok: false, error: "tipo_invalido", detail: "Tipo inválido: use EPC ou acessório." }, 400);
      }
      const epiName = text(vinculo.epiName, 160);
      if (!epiName) {
        return jsonResponse(
          { ok: false, error: "equipamento_obrigatorio", detail: "Informe o equipamento ou acessório." },
          400,
        );
      }
      const quantityRaw = vinculo.quantity === undefined || vinculo.quantity === "" ? 1 : Number(vinculo.quantity);
      if (!Number.isInteger(quantityRaw) || quantityRaw < 1 || quantityRaw > 999) {
        return jsonResponse(
          { ok: false, error: "quantidade_invalida", detail: "Quantidade deve ser um inteiro entre 1 e 999." },
          400,
        );
      }
      const identification = text(vinculo.identification, 80);

      if (identification) {
        const { data: duplicated } = await admin
          .from("vehicle_epc_links")
          .select("ref, vehicle_ref")
          .eq("company_ref", companyRef)
          .eq("status", EPC_STATUS_ACTIVE)
          .ilike("identification", identification)
          .limit(3);
        const clash = (Array.isArray(duplicated) ? duplicated : []).find(
          (row) => String((row as Record<string, unknown>).vehicle_ref) !== vehicleRef,
        );
        if (clash) {
          return jsonResponse(
            {
              ok: false,
              error: "equipamento_em_outro_veiculo",
              detail: `A identificação ${identification} já está ativa em outro veículo. Transfira o equipamento em vez de duplicá-lo.`,
            },
            409,
          );
        }
        const sameVehicle = (Array.isArray(duplicated) ? duplicated : []).find(
          (row) => String((row as Record<string, unknown>).vehicle_ref) === vehicleRef,
        );
        if (sameVehicle) {
          return jsonResponse(
            {
              ok: false,
              error: "equipamento_ja_vinculado",
              detail: `A identificação ${identification} já está vinculada a este veículo.`,
            },
            409,
          );
        }
      }

      const newRef = `vepc-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
      const { error } = await admin.from("vehicle_epc_links").insert({
        company_id: companyId,
        company_ref: companyRef,
        ref: newRef,
        vehicle_ref: vehicleRef,
        source: text(vinculo.source, 40) || "epi_delivery",
        source_ref: text(vinculo.sourceRef, 80) || null,
        epi_name: epiName,
        epi_ca: text(vinculo.epiCa, 40) || null,
        kind,
        identification: identification || null,
        quantity: quantityRaw,
        status: EPC_STATUS_ACTIVE,
        notes: text(vinculo.notes, 1000) || null,
        linked_by: actorId,
        linked_by_name: actorName,
      });
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);

      const auditError = await audit({
        action: "created",
        entity: "vehicle_epc_links",
        entityId: newRef,
        newValue: `${epiName}${identification ? ` (${identification})` : ""} x${quantityRaw}`,
        detail: `${kind === "epc" ? "EPC" : "Acessório"} ${epiName} vinculado ao veículo ${String((vehicleRow as Record<string, unknown>).plate)} por ${actorName}.`,
      });
      return jsonResponse({
        ok: true,
        ref: newRef,
        auditoria: !auditError,
        detail: "Equipamento vinculado ao veículo.",
      });
    }

    if (acao === "desvincular_epc") {
      if (!can(access, "vehicles.epc")) return deny("vehicles.epc");
      const linkRef = text(payload?.linkRef, 60);
      const motivo = text(payload?.motivo, 500);
      if (!linkRef) return jsonResponse({ ok: false, error: "ref_obrigatorio" }, 400);
      if (motivo.length < 10) {
        return jsonResponse(
          { ok: false, error: "justificativa_obrigatoria", detail: "Informe o motivo da retirada (mínimo 10 caracteres)." },
          400,
        );
      }
      const { data: linkRow } = await admin
        .from("vehicle_epc_links")
        .select("ref, status, epi_name, vehicle_ref")
        .eq("company_ref", companyRef)
        .eq("ref", linkRef)
        .maybeSingle();
      if (!linkRow) {
        return jsonResponse({ ok: false, error: "vinculo_nao_encontrado", detail: "Vínculo não encontrado." }, 404);
      }
      if (String((linkRow as Record<string, unknown>).status) !== EPC_STATUS_ACTIVE) {
        return jsonResponse(
          { ok: false, error: "vinculo_inativo", detail: "Este vínculo já foi encerrado ou transferido." },
          409,
        );
      }
      const { error } = await admin
        .from("vehicle_epc_links")
        .update({
          status: "removido",
          unlinked_at: new Date().toISOString(),
          unlinked_by: actorId,
          unlinked_by_name: actorName,
          unlink_reason: motivo,
        })
        .eq("company_ref", companyRef)
        .eq("ref", linkRef);
      if (error) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: error.message }, 500);
      const auditError = await audit({
        action: "deleted",
        entity: "vehicle_epc_links",
        entityId: linkRef,
        oldValue: "ativo",
        newValue: "removido",
        detail: `Equipamento ${String((linkRow as Record<string, unknown>).epi_name)} retirado do veículo por ${actorName}. Motivo: ${motivo}. O vínculo permanece no histórico.`,
      });
      return jsonResponse({ ok: true, auditoria: !auditError, detail: "Equipamento desvinculado (histórico preservado)." });
    }

    if (acao === "transferir_epc") {
      if (!can(access, "vehicles.epc")) return deny("vehicles.epc");
      const linkRef = text(payload?.linkRef, 60);
      const toVehicleRef = text(payload?.toVehicleRef, 60);
      const motivo = text(payload?.motivo, 500);
      if (!linkRef || !toVehicleRef) {
        return jsonResponse({ ok: false, error: "dados_incompletos", detail: "Informe o vínculo e o veículo de destino." }, 400);
      }
      if (motivo.length < 10) {
        return jsonResponse(
          { ok: false, error: "justificativa_obrigatoria", detail: "Informe o motivo da transferência (mínimo 10 caracteres)." },
          400,
        );
      }
      const { data: linkRow } = await admin
        .from("vehicle_epc_links")
        .select("*")
        .eq("company_ref", companyRef)
        .eq("ref", linkRef)
        .maybeSingle();
      if (!linkRow) {
        return jsonResponse({ ok: false, error: "vinculo_nao_encontrado", detail: "Vínculo não encontrado." }, 404);
      }
      const link = linkRow as Record<string, unknown>;
      if (String(link.status) !== EPC_STATUS_ACTIVE) {
        return jsonResponse({ ok: false, error: "vinculo_inativo", detail: "Este vínculo não está ativo." }, 409);
      }
      if (String(link.vehicle_ref) === toVehicleRef) {
        return jsonResponse(
          { ok: false, error: "mesmo_veiculo", detail: "O veículo de destino é o mesmo do vínculo atual." },
          400,
        );
      }
      const { data: targetVehicle } = await admin
        .from("vehicles")
        .select("ref, plate")
        .eq("company_ref", companyRef)
        .eq("ref", toVehicleRef)
        .maybeSingle();
      if (!targetVehicle) {
        return jsonResponse({ ok: false, error: "veiculo_destino_invalido", detail: "Veículo de destino não encontrado." }, 404);
      }

      const identification = text(link.identification, 80);
      if (identification) {
        const { data: duplicated } = await admin
          .from("vehicle_epc_links")
          .select("ref")
          .eq("company_ref", companyRef)
          .eq("vehicle_ref", toVehicleRef)
          .eq("status", EPC_STATUS_ACTIVE)
          .ilike("identification", identification)
          .limit(1);
        if (Array.isArray(duplicated) && duplicated.length > 0) {
          return jsonResponse(
            {
              ok: false,
              error: "equipamento_ja_vinculado",
              detail: `A identificação ${identification} já está ativa no veículo de destino.`,
            },
            409,
          );
        }
      }

      const { error: closeError } = await admin
        .from("vehicle_epc_links")
        .update({
          status: "transferido",
          unlinked_at: new Date().toISOString(),
          unlinked_by: actorId,
          unlinked_by_name: actorName,
          unlink_reason: motivo,
          transfer_to_vehicle_ref: toVehicleRef,
        })
        .eq("company_ref", companyRef)
        .eq("ref", linkRef);
      if (closeError) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: closeError.message }, 500);

      const newRef = `vepc-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
      const { error: insertError } = await admin.from("vehicle_epc_links").insert({
        company_id: companyId,
        company_ref: companyRef,
        ref: newRef,
        vehicle_ref: toVehicleRef,
        source: text(link.source, 40) || "epi_delivery",
        source_ref: link.source_ref ?? null,
        epi_name: String(link.epi_name ?? "Equipamento"),
        epi_ca: link.epi_ca ?? null,
        kind: String(link.kind ?? "epc"),
        identification: identification || null,
        quantity: Number(link.quantity ?? 1) || 1,
        status: EPC_STATUS_ACTIVE,
        notes: link.notes ?? null,
        linked_by: actorId,
        linked_by_name: actorName,
      });
      if (insertError) {
        return jsonResponse(
          {
            ok: false,
            error: "transferencia_parcial",
            detail: `O vínculo original foi encerrado, mas o novo vínculo falhou: ${insertError.message}. Refaça o vínculo no veículo de destino.`,
          },
          500,
        );
      }

      const auditError = await audit({
        action: "updated",
        entity: "vehicle_epc_links",
        entityId: newRef,
        oldValue: String(link.vehicle_ref),
        newValue: toVehicleRef,
        detail: `Equipamento ${String(link.epi_name)} transferido para o veículo ${String((targetVehicle as Record<string, unknown>).plate)} por ${actorName}. Motivo: ${motivo}.`,
      });
      return jsonResponse({
        ok: true,
        ref: newRef,
        auditoria: !auditError,
        detail: "Equipamento transferido: um único vínculo ativo permanece.",
      });
    }

    /* ------------------- 11. Check-in de entrega / devolução ------------------- */
    if (acao === "registrar_checkin") {
      if (!can(access, "vehicles.checkin")) return deny("vehicles.checkin");
      const checkin = (payload?.checkin ?? {}) as Record<string, unknown>;

      const vehicleRef = text(checkin.vehicleRef, 60);
      if (!vehicleRef) {
        return jsonResponse({ ok: false, error: "veiculo_obrigatorio", detail: "Selecione o veículo." }, 400);
      }
      const { data: vehicleRow } = await admin
        .from("vehicles")
        .select("ref, plate, odometer, status, category")
        .eq("company_ref", companyRef)
        .eq("ref", vehicleRef)
        .maybeSingle();
      if (!vehicleRow) {
        return jsonResponse({ ok: false, error: "veiculo_nao_encontrado", detail: "Veículo não encontrado." }, 404);
      }
      const vehicle = vehicleRow as Record<string, unknown>;
      // O condutor digita a placa do veículo à frente dele: evita check-in no veículo errado.
      if (!placaConfere(text(checkin.plateTyped, 12), text(vehicle.plate, 12))) {
        return jsonResponse(
          {
            ok: false,
            error: "placa_nao_confere",
            detail: "A placa digitada não confere com o veículo escolhido. Confira a placa do veículo à sua frente.",
          },
          400,
        );
      }
      if (String(vehicle.status) === "inativo") {
        return jsonResponse(
          { ok: false, error: "veiculo_inativo", detail: "Veículo inativo não pode receber check-in." },
          409,
        );
      }

      const kind = text(checkin.kind, 20);
      if (!CHECKIN_KINDS.includes(kind)) {
        return jsonResponse(
          { ok: false, error: "tipo_invalido", detail: "Tipo inválido: use entrega ou devolução." },
          400,
        );
      }

      const conferenteName = text(checkin.conferenteName, 120);
      if (conferenteName.length < 3) {
        return jsonResponse(
          {
            ok: false,
            error: "conferente_obrigatorio",
            detail: "A dupla conferência exige o nome do conferente da empresa.",
          },
          400,
        );
      }

      const odometer = optionalInt(checkin.odometer);
      if (odometer === undefined || odometer === null) {
        return jsonResponse(
          {
            ok: false,
            error: "hodometro_obrigatorio",
            detail: "Informe o hodômetro do veículo no momento do check-in.",
          },
          400,
        );
      }
      const fuelRaw = checkin.fuelLevel;
      if (fuelRaw === null || fuelRaw === undefined || fuelRaw === "") {
        return jsonResponse(
          { ok: false, error: "combustivel_obrigatorio", detail: "Informe o nível de combustível (0 a 100%)." },
          400,
        );
      }
      const fuelLevel = Number(fuelRaw);
      if (!Number.isInteger(fuelLevel) || fuelLevel < 0 || fuelLevel > 100) {
        return jsonResponse(
          { ok: false, error: "combustivel_invalido", detail: "Nível de combustível deve ser um inteiro entre 0 e 100." },
          400,
        );
      }

      const photos = stringList(checkin.photos, MAX_CHECKIN_PHOTOS);
      const missingPhotos = fotosObrigatoriasFaltando(photos);
      if (missingPhotos.length > 0) {
        return jsonResponse(
          {
            ok: false,
            error: "evidencia_obrigatoria",
            detail: `Faltam as fotos obrigatórias do check-in: ${missingPhotos.join(", ")}.`,
          },
          400,
        );
      }

      const rawDamages = Array.isArray(checkin.damages) ? (checkin.damages as AvariaEntrada[]) : [];
      if (rawDamages.length > MAX_CHECKIN_DAMAGES) {
        return jsonResponse(
          { ok: false, error: "avarias_demais", detail: `O mapa aceita no máximo ${MAX_CHECKIN_DAMAGES} avarias.` },
          400,
        );
      }
      for (let index = 0; index < rawDamages.length; index += 1) {
        const message = validarAvaria(rawDamages[index] ?? {}, index + 1);
        if (message) return jsonResponse({ ok: false, error: "avaria_invalida", detail: message }, 400);
      }
      const damages = rawDamages.map((item, index) => sanitizarAvaria(item ?? {}, index));

      const rawRepairs = Array.isArray(checkin.repairRequests) ? (checkin.repairRequests as ReparoEntrada[]) : [];
      if (rawRepairs.length > MAX_CHECKIN_REPAIRS) {
        return jsonResponse(
          { ok: false, error: "reparos_demais", detail: `No máximo ${MAX_CHECKIN_REPAIRS} solicitações de reparo por check-in.` },
          400,
        );
      }
      for (let index = 0; index < rawRepairs.length; index += 1) {
        const message = validarReparo(rawRepairs[index] ?? {}, index + 1);
        if (message) return jsonResponse({ ok: false, error: "reparo_invalido", detail: message }, 400);
      }
      const repairRequests = rawRepairs.map((item, index) => sanitizarReparo(item ?? {}, index));

      // Toda imagem precisa estar na pasta da própria empresa.
      const allPaths = [
        ...photos,
        ...damages.map((item) => item.photo).filter(Boolean),
        ...repairRequests.flatMap((item) => item.photos),
      ];
      const foreign = allPaths.find((path) => !path.startsWith(`${companyRef}/`));
      if (foreign) {
        return jsonResponse(
          { ok: false, error: "foto_invalida", detail: "Uma das fotos não pertence a esta empresa. Envie a foto novamente." },
          400,
        );
      }

      const rawItems = Array.isArray(checkin.items) ? checkin.items : [];
      if (rawItems.length > 40) {
        return jsonResponse(
          { ok: false, error: "itens_demais", detail: "A conferência aceita no máximo 40 itens." },
          400,
        );
      }
      const items: Record<string, unknown>[] = [];
      for (let index = 0; index < rawItems.length; index += 1) {
        const raw = (rawItems[index] ?? {}) as Record<string, unknown>;
        const label = text(raw.label, 160);
        if (!label) {
          return jsonResponse(
            { ok: false, error: "item_sem_descricao", detail: `O item ${index + 1} está sem descrição.` },
            400,
          );
        }
        const result = text(raw.result, 20) || "conforme";
        if (!CHECKIN_ITEM_RESULTS.includes(result)) {
          return jsonResponse(
            { ok: false, error: "resultado_invalido", detail: `Resultado inválido no item "${label}".` },
            400,
          );
        }
        const observation = text(raw.observation, 1000);
        if (result === "avaria" && observation.length < 5) {
          return jsonResponse(
            {
              ok: false,
              error: "observacao_obrigatoria",
              detail: `Descreva a avaria encontrada no item "${label}".`,
            },
            400,
          );
        }
        items.push({
          key: text(raw.key, 60) || `it-${index + 1}`,
          label,
          result,
          observation: observation || null,
        });
      }

      const { data: openDeliveryRow } = await admin
        .from("vehicle_checkins")
        .select("ref, odometer, performed_at, responsible_name, responsible_document, responsible_role")
        .eq("company_ref", companyRef)
        .eq("vehicle_ref", vehicleRef)
        .eq("kind", "entrega")
        .eq("status", "aberta")
        .maybeSingle();
      const openDelivery = openDeliveryRow as Record<string, unknown> | null;

      if (kind === "entrega") {
        if (openDelivery) {
          return jsonResponse(
            {
              ok: false,
              error: "entrega_em_aberto",
              detail: `Já existe uma entrega em aberto para este veículo (${String(openDelivery.responsible_name ?? "condutor")}). Registre a devolução antes de uma nova entrega.`,
            },
            409,
          );
        }
        if (String(vehicle.status) === "bloqueado") {
          return jsonResponse(
            {
              ok: false,
              error: "veiculo_bloqueado",
              detail: "Veículo bloqueado por não conformidade crítica não pode ser entregue. Libere o bloqueio primeiro.",
            },
            409,
          );
        }
      } else {
        if (!openDelivery) {
          return jsonResponse(
            {
              ok: false,
              error: "sem_entrega_aberta",
              detail: "Não existe entrega em aberto para este veículo. Registre a entrega antes da devolução.",
            },
            409,
          );
        }
        const deliveryOdometer =
          openDelivery.odometer === null || openDelivery.odometer === undefined
            ? null
            : Number(openDelivery.odometer);
        if (deliveryOdometer !== null && odometer < deliveryOdometer) {
          return jsonResponse(
            {
              ok: false,
              error: "hodometro_regressivo",
              detail: `O hodômetro da devolução (${odometer}) não pode ser menor que o da entrega (${deliveryOdometer}).`,
            },
            400,
          );
        }
      }

      // Condutor responsável é definido pelo servidor, nunca pelo cliente:
      // - retirada: o colaborador que executa o checklist assume o veículo;
      // - devolução: quem estava com o veículo até este momento.
      let responsibleName = "";
      let responsibleDocument = text(checkin.responsibleDocument, 40);
      let responsibleRole = text(checkin.responsibleRole, 80);

      if (kind === "entrega") {
        responsibleName = actorName;
        if (!responsibleDocument || !responsibleRole) {
          const { data: collaboratorRows } = await admin
            .from("company_collaborators")
            .select("cpf, role_function")
            .eq("company_id", companyId)
            .eq("active", true)
            .ilike("email", text(user.email ?? "", 160))
            .limit(1);
          const collaborator = Array.isArray(collaboratorRows)
            ? (collaboratorRows[0] as Record<string, unknown> | undefined)
            : undefined;
          if (!responsibleDocument && collaborator?.cpf) responsibleDocument = text(collaborator.cpf, 40);
          if (!responsibleRole && collaborator?.role_function) {
            responsibleRole = text(collaborator.role_function, 80);
          }
        }
      } else {
        responsibleName = text(openDelivery?.responsible_name, 120) || actorName;
        if (!responsibleDocument) responsibleDocument = text(openDelivery?.responsible_document, 40);
        if (!responsibleRole) responsibleRole = text(openDelivery?.responsible_role, 80);
      }
      if (responsibleName.length < 3) {
        return jsonResponse(
          {
            ok: false,
            error: "responsavel_obrigatorio",
            detail: "Não foi possível identificar o condutor responsável. Saia e entre novamente no sistema.",
          },
          400,
        );
      }

      const checkinRef = `vchk-in-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
      const linkedRef = kind === "devolucao" && openDelivery ? String(openDelivery.ref ?? "") : "";
      const { error: insertError } = await admin.from("vehicle_checkins").insert({
        company_id: companyId,
        company_ref: companyRef,
        ref: checkinRef,
        vehicle_ref: vehicleRef,
        kind,
        status: kind === "entrega" ? "aberta" : "registrada",
        plate_snapshot: text(vehicle.plate, 20) || null,
        vehicle_category: text(vehicle.category, 60) || null,
        plate_confirmed: true,
        damages,
        repair_requests: repairRequests,
        responsible_name: responsibleName,
        responsible_document: responsibleDocument || null,
        responsible_role: responsibleRole || null,
        conferente_name: conferenteName,
        odometer,
        fuel_level: fuelLevel,
        items,
        photos,
        notes: text(checkin.notes, 1000) || null,
        linked_ref: linkedRef || null,
        performed_by: actorId,
        performed_by_name: actorName,
      });
      if (insertError) {
        return jsonResponse({ ok: false, error: "gravacao_falhou", detail: insertError.message }, 500);
      }

      if (kind === "devolucao" && linkedRef) {
        const { error: closeError } = await admin
          .from("vehicle_checkins")
          .update({ status: "encerrada", closed_at: new Date().toISOString() })
          .eq("company_ref", companyRef)
          .eq("ref", linkedRef)
          .eq("status", "aberta");
        if (closeError) {
          return jsonResponse(
            {
              ok: false,
              error: "fechamento_falhou",
              detail: `A devolução foi registrada, mas o fechamento da entrega falhou: ${closeError.message}.`,
            },
            500,
          );
        }
      }

      const vehiclePatch: Record<string, unknown> = {};
      const currentOdometer =
        vehicle.odometer === null || vehicle.odometer === undefined ? null : Number(vehicle.odometer);
      if (currentOdometer === null || odometer > currentOdometer) vehiclePatch.odometer = odometer;
      if (kind === "entrega") {
        vehiclePatch.status = "em_uso";
      } else if (String(vehicle.status) !== "bloqueado") {
        vehiclePatch.status = "disponivel";
      }
      const { error: vehicleError } = await admin
        .from("vehicles")
        .update(vehiclePatch)
        .eq("company_ref", companyRef)
        .eq("ref", vehicleRef);
      if (vehicleError) {
        return jsonResponse(
          {
            ok: false,
            error: "veiculo_nao_atualizado",
            detail: `O check-in foi registrado, mas a situação do veículo não atualizou: ${vehicleError.message}.`,
          },
          500,
        );
      }

      // Solicitações de reparo vão para o acompanhamento da gestão da frota.
      let repairWarning = "";
      if (repairRequests.length > 0) {
        const { error: repairError } = await admin.from("vehicle_repair_requests").insert(
          repairRequests.map((item, index) => ({
            company_id: companyId,
            company_ref: companyRef,
            ref: `${checkinRef}-r${index + 1}`,
            vehicle_ref: vehicleRef,
            checkin_ref: checkinRef,
            damage_id: item.damageId || null,
            plate_snapshot: text(vehicle.plate, 20) || null,
            title: item.title,
            description: item.description || null,
            priority: item.priority,
            photos: item.photos,
            requested_by: actorId,
            requested_by_name: actorName,
          })),
        );
        if (repairError) {
          repairWarning = ` Atenção: o check-in foi gravado com os pedidos de reparo, mas o acompanhamento não foi criado (${repairError.message}).`;
        }
      }

      const avarias = items.filter((item) => item.result === "avaria");
      const novasAvarias = damages.filter((item) => !item.preexisting).length;
      const auditError = await audit({
        action: kind === "entrega" ? "checked_out" : "checked_in",
        entity: "vehicle_checkins",
        entityId: checkinRef,
        oldValue: kind === "devolucao" ? String(openDelivery?.ref ?? "") : null,
        newValue: `${kind} · ${odometer} km · ${fuelLevel}% · ${avarias.length} item(ns) com problema · ${novasAvarias} avaria(s) no mapa · ${repairRequests.length} reparo(s)`,
        detail:
          kind === "entrega"
            ? `Checklist de retirada do veículo ${String(vehicle.plate)}: ${responsibleName} assumiu o veículo como condutor responsável. Conferido por ${conferenteName}. Hodômetro ${odometer} km, tanque ${fuelLevel}%. ${photos.length} foto(s), ${avarias.length} avaria(s).`
            : `Checklist de devolução do veículo ${String(vehicle.plate)}: ${responsibleName} devolveu o veículo, conferido por ${conferenteName}. Hodômetro ${odometer} km, tanque ${fuelLevel}%. ${photos.length} foto(s), ${avarias.length} avaria(s). A retirada ${linkedRef} foi encerrada e o veículo ficou sem condutor responsável.`,
      });

      return jsonResponse({
        ok: true,
        ref: checkinRef,
        kind,
        responsavel: responsibleName,
        avarias: avarias.length + novasAvarias,
        reparos: repairRequests.length,
        auditoria: !auditError,
        detail:
          (kind === "entrega"
            ? `Retirada registrada. ${responsibleName} é o condutor responsável do veículo a partir de agora.`
            : "Devolução registrada. O veículo voltou para a empresa e ficou sem condutor responsável.") + repairWarning,
      });
    }

    if (acao === "atualizar_reparo") {
      if (!can(access, "vehicles.edit")) return deny("vehicles.edit");
      const reparo = (payload?.reparo ?? {}) as Record<string, unknown>;
      const ref = text(reparo.ref, 80);
      const status = text(reparo.status, 20);
      const resolution = text(reparo.resolution, 1000);
      if (!ref) return jsonResponse({ ok: false, error: "reparo_obrigatorio", detail: "Informe o reparo." }, 400);
      const { data: row } = await admin
        .from("vehicle_repair_requests")
        .select("ref, status, title, plate_snapshot")
        .eq("company_ref", companyRef)
        .eq("ref", ref)
        .maybeSingle();
      if (!row) return jsonResponse({ ok: false, error: "reparo_nao_encontrado", detail: "Solicitação de reparo não encontrada." }, 404);
      const current = row as Record<string, unknown>;
      if (!transicaoReparoPermitida(String(current.status), status)) {
        return jsonResponse(
          { ok: false, error: "transicao_invalida", detail: `Não é possível mudar de "${String(current.status)}" para "${status}".` },
          409,
        );
      }
      const closing = status === "concluida" || status === "cancelada";
      if (closing && resolution.length < 5) {
        return jsonResponse(
          {
            ok: false,
            error: "resolucao_obrigatoria",
            detail: status === "concluida" ? "Descreva o que foi feito no reparo." : "Informe o motivo do cancelamento.",
          },
          400,
        );
      }
      const { error: updateError } = await admin
        .from("vehicle_repair_requests")
        .update({
          status,
          resolution: resolution || null,
          resolved_by_name: closing ? actorName : null,
          resolved_at: closing ? new Date().toISOString() : null,
        })
        .eq("company_ref", companyRef)
        .eq("ref", ref);
      if (updateError) return jsonResponse({ ok: false, error: "gravacao_falhou", detail: updateError.message }, 500);
      const auditError = await audit({
        action: "repair_status",
        entity: "vehicle_repair_requests",
        entityId: ref,
        oldValue: String(current.status),
        newValue: status,
        detail: `Reparo "${String(current.title)}" do veículo ${String(current.plate_snapshot ?? "")}: ${String(current.status)} → ${status}.${resolution ? ` ${resolution}` : ""}`,
      });
      const labels: Record<string, string> = {
        aberta: "Reparo reaberto.",
        em_andamento: "Reparo em andamento.",
        concluida: "Reparo concluído.",
        cancelada: "Reparo cancelado.",
      };
      return jsonResponse({ ok: true, ref, status, auditoria: !auditError, detail: labels[status] ?? "Reparo atualizado." });
    }

    /* ------------------------- 12. Limpeza da frota de demonstração ------------------------- */
    if (acao === "limpar_frota_demo") {
      if (access.role !== "admin") {
        return jsonResponse(
          {
            ok: false,
            error: "apenas_admin",
            detail: "Somente o administrador da empresa pode remover a frota de demonstração.",
          },
          403,
        );
      }
      if (!can(access, "vehicles.edit")) return deny("vehicles.edit");

      // Só remove o que a semeadura de demonstração criou: combinação de placa
      // fictícia + prefixo de `ref` da própria empresa. Nada além disso é tocado.
      const demoPlates = ["VGA1A23", "VGA2B34", "VGA3C45"];
      const { data: demoRows, error: demoError } = await admin
        .from("vehicles")
        .select("ref, plate")
        .eq("company_id", companyId)
        .in("plate_normalized", demoPlates)
        .like("ref", `${companyRef}-vh-%`);
      if (demoError) {
        return jsonResponse({ ok: false, error: "leitura_falhou", detail: demoError.message }, 500);
      }

      const targets = Array.isArray(demoRows) ? demoRows : [];
      if (targets.length === 0) {
        return jsonResponse({
          ok: true,
          removidos: 0,
          detail: "Nenhum veículo de demonstração encontrado nesta empresa. A frota já está limpa.",
        });
      }

      const refs = targets
        .map((row) => String((row as Record<string, unknown>).ref ?? ""))
        .filter(Boolean);
      const plates = targets
        .map((row) => String((row as Record<string, unknown>).plate ?? ""))
        .filter(Boolean);

      const { data: docRows } = await admin
        .from("vehicle_documents")
        .select("storage_path")
        .eq("company_id", companyId)
        .in("vehicle_ref", refs);
      const storagePaths = (Array.isArray(docRows) ? docRows : [])
        .map((row) => String((row as Record<string, unknown>).storage_path ?? ""))
        .filter(Boolean);

      const steps: Array<[string, string]> = [
        ["vehicle_inspection_findings", "vehicle_ref"],
        ["vehicle_inspections", "vehicle_ref"],
        ["vehicle_blocks", "vehicle_ref"],
        ["vehicle_epc_links", "vehicle_ref"],
        ["vehicle_checkins", "vehicle_ref"],
        ["vehicle_document_alerts", "vehicle_ref"],
        ["vehicle_documents", "vehicle_ref"],
        ["vehicles", "ref"],
      ];
      for (const [table, column] of steps) {
        const { error: stepError } = await admin
          .from(table)
          .delete()
          .eq("company_id", companyId)
          .in(column, refs);
        if (stepError) {
          return jsonResponse(
            {
              ok: false,
              error: "limpeza_falhou",
              detail: `A limpeza parou em ${table}: ${stepError.message}`,
            },
            500,
          );
        }
      }

      let arquivosRemovidos = 0;
      if (storagePaths.length > 0) {
        const { error: storageError, data: removed } = await admin.storage
          .from("documents")
          .remove(storagePaths);
        if (!storageError) {
          arquivosRemovidos = Array.isArray(removed) ? removed.length : storagePaths.length;
        }
      }

      const auditError = await audit({
        action: "deleted",
        entity: "vehicles",
        entityId: refs.join(", ").slice(0, 300),
        oldValue: plates.join(", "),
        newValue: "frota de demonstração removida",
        detail: `${targets.length} veículo(s) de demonstração removido(s) por ${actorName}: ${plates.join(
          ", ",
        )}. Documentos, inspeções, achados, bloqueios, vínculos de EPC e check-ins desses veículos foram excluídos junto.`,
      });

      return jsonResponse({
        ok: true,
        removidos: targets.length,
        arquivosRemovidos,
        auditoria: !auditError,
        detail: `${targets.length} veículo(s) de demonstração removido(s) com documentos, inspeções e histórico vinculados.${
          arquivosRemovidos > 0 ? ` ${arquivosRemovidos} arquivo(s) excluído(s) do armazenamento.` : ""
        }`,
      });
    }

    return jsonResponse({ ok: false, error: "acao_invalida", detail: "Ação não reconhecida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
