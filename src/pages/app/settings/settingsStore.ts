import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import { logAudit } from "@/pages/app/modules/config/systemLogStore";

/**
 * Store das parametrizações da EMPRESA.
 *
 * Cada empresa tem a sua própria linha em `company_settings`. A tabela antiga
 * (`system_settings`, linha única `id = 1`) passou a ser configuração global da
 * plataforma: os módulos contratados continuam vindo de lá, só para leitura, e
 * não podem ser liberados pelo administrador do cliente.
 *
 * Leitura: membro da empresa. Escrita: administrador da empresa (garantido por
 * RLS no banco, não pelo frontend). Nenhum valor é confirmado como salvo antes
 * de o servidor responder com sucesso.
 */
export interface SystemSettings {
  /** Bloqueia o cadastro de um EPI cujo CA não está ativo na Ficha de EPI. */
  validarCaAtivoNoEpi: boolean;
  /** Permite adicionar um equipamento mesmo quando o CA não é encontrado na consulta oficial. */
  permitirCaNaoEncontrado: boolean;
  /** Permite adicionar um equipamento mesmo quando o CA está com a validade vencida. */
  permitirCaVencido: boolean;
  /** URL assinada (temporária) da logo da empresa, usada dentro do sistema. */
  logoUrl: string | null;
  /** Caminho privado da logo no bucket `branding`. */
  logoPath: string | null;
  /** URL assinada (temporária) do papel timbrado usado nas exportações. */
  letterheadUrl: string | null;
  /** Caminho privado do papel timbrado no bucket `branding`. */
  letterheadPath: string | null;
  /** Razão social da empresa (cabeçalho de relatórios e documentos). */
  companyLegalName: string;
  /** CNPJ da empresa (cabeçalho de relatórios e documentos). */
  companyCnpj: string;
  /** Nome do responsável técnico de segurança do trabalho. */
  technicalResponsible: string;
  /** Registro profissional do responsável técnico (ex.: CREA/MTE). */
  technicalRegistration: string;
  /**
   * Telefone do SESMT da empresa. É usado como alternativa quando a CIPA não
   * possui nenhum membro com área SESMT (selo do capacete e comprovante público).
   */
  sesmtPhone: string;
  /**
   * Endereço público (https://dominio) onde o sistema está publicado.
   * É o endereço gravado dentro dos QR-Codes de fiscalização.
   */
  publicBaseUrl: string;
  /**
   * Prazo de atendimento (em horas) dos pedidos de substituição de EPI, por
   * motivo. Chave ausente = prazo padrão do sistema.
   */
  replacementSlaHours: Record<string, number>;
  /** Prazo (em dias) para concluir a renovação de um documento, por tipo. */
  documentRenewalSlaDays: Record<string, number>;
  /** Dias sem movimentação para uma renovação ser sinalizada como paralisada. */
  documentRenewalIdleDays: number;
  /** Antecedência do aviso de prazo (SLA) ao responsável da tratativa. */
  documentRenewalSlaWarningDays: number;
  /** Antecedência do aviso de prazo (SLA) ao gestor. */
  documentRenewalManagerWarningDays: number;
  /** Escalonamento ao gestor quando a tratativa não se movimenta. */
  documentRenewalEscalationDays: number;
  /**
   * Módulos habilitados — definidos pela PLATAFORMA (somente leitura aqui).
   * Chave ausente = módulo habilitado.
   */
  enabledModules: Record<string, boolean>;
  /**
   * Termo de tratamento de dados (LGPD) da consulta externa da ficha de
   * verificação. Fica gravado em `company_settings.fiscalizacao_termo_lgpd`,
   * portanto vale para TODOS os visitantes — não só para este navegador.
   */
  fiscalizacaoTermoConsulta: string;
  /** Exibe no dashboard do administrador o resumo de "quem precisa de atenção". */
  dashboardMoodAttention: boolean;
  /** A partir de quantos dias de afastamento o atestado gera alerta. */
  certificateLeaveAlertDays: number;
}

export type BrandingAssetKind = "logo" | "letterhead";

export interface SaveResult {
  ok: boolean;
  error: string | null;
}

const defaultSettings: SystemSettings = {
  validarCaAtivoNoEpi: true,
  permitirCaNaoEncontrado: false,
  permitirCaVencido: false,
  logoUrl: null,
  logoPath: null,
  letterheadUrl: null,
  letterheadPath: null,
  companyLegalName: "",
  companyCnpj: "",
  technicalResponsible: "",
  technicalRegistration: "",
  sesmtPhone: "",
  publicBaseUrl: "",
  replacementSlaHours: {},
  documentRenewalSlaDays: {},
  documentRenewalIdleDays: 5,
  documentRenewalSlaWarningDays: 3,
  documentRenewalManagerWarningDays: 7,
  documentRenewalEscalationDays: 5,
  enabledModules: {},
  fiscalizacaoTermoConsulta: "",
  dashboardMoodAttention: true,
  certificateLeaveAlertDays: 3,
};

interface SettingsRow {
  logo_path: string | null;
  letterhead_path: string | null;
  validar_ca_ativo_no_epi: boolean | null;
  permitir_ca_nao_encontrado: boolean | null;
  permitir_ca_vencido: boolean | null;
  company_legal_name: string | null;
  company_cnpj: string | null;
  technical_responsible: string | null;
  technical_registration: string | null;
  sesmt_phone: string | null;
  public_base_url: string | null;
  replacement_sla_hours: Record<string, number> | null;
  document_renewal_sla_days: Record<string, number> | null;
  document_renewal_idle_days: number | null;
  document_renewal_sla_warning_days: number | null;
  document_renewal_manager_warning_days: number | null;
  document_renewal_escalation_days: number | null;
  dashboard_mood_attention: boolean | null;
  certificate_leave_alert_days: number | null;
  fiscalizacao_termo_lgpd: string | null;
}

const SETTINGS_COLUMNS =
  "logo_path, letterhead_path, validar_ca_ativo_no_epi, permitir_ca_nao_encontrado, permitir_ca_vencido, company_legal_name, company_cnpj, technical_responsible, technical_registration, sesmt_phone, public_base_url, replacement_sla_hours, document_renewal_sla_days, document_renewal_idle_days, document_renewal_sla_warning_days, document_renewal_manager_warning_days, document_renewal_escalation_days, dashboard_mood_attention, certificate_leave_alert_days, fiscalizacao_termo_lgpd";

const BRANDING_BUCKET = "branding";

let settings: SystemSettings = { ...defaultSettings };
let companyKey = "";
let companyId: string | null = null;
let refInitialized = false;
let loaded = false;
let loading = false;
let saveError: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setSaveError(message: string | null): void {
  saveError = message;
  emit();
}

function applyRow(row: SettingsRow): void {
  settings = {
    ...settings,
    validarCaAtivoNoEpi: row.validar_ca_ativo_no_epi ?? true,
    permitirCaNaoEncontrado: row.permitir_ca_nao_encontrado ?? false,
    permitirCaVencido: row.permitir_ca_vencido ?? false,
    logoPath: row.logo_path ?? null,
    letterheadPath: row.letterhead_path ?? null,
    logoUrl: null,
    letterheadUrl: null,
    companyLegalName: row.company_legal_name ?? "",
    companyCnpj: row.company_cnpj ?? "",
    technicalResponsible: row.technical_responsible ?? "",
    technicalRegistration: row.technical_registration ?? "",
    sesmtPhone: row.sesmt_phone ?? "",
    publicBaseUrl: row.public_base_url ?? "",
    replacementSlaHours: row.replacement_sla_hours ?? {},
    documentRenewalSlaDays: row.document_renewal_sla_days ?? {},
    documentRenewalIdleDays:
      typeof row.document_renewal_idle_days === "number" && row.document_renewal_idle_days > 0
        ? row.document_renewal_idle_days
        : defaultSettings.documentRenewalIdleDays,
    documentRenewalSlaWarningDays:
      typeof row.document_renewal_sla_warning_days === "number" && row.document_renewal_sla_warning_days >= 0
        ? Math.min(60, Math.round(row.document_renewal_sla_warning_days))
        : defaultSettings.documentRenewalSlaWarningDays,
    documentRenewalManagerWarningDays:
      typeof row.document_renewal_manager_warning_days === "number" &&
      row.document_renewal_manager_warning_days >= 0
        ? Math.min(60, Math.round(row.document_renewal_manager_warning_days))
        : defaultSettings.documentRenewalManagerWarningDays,
    documentRenewalEscalationDays:
      typeof row.document_renewal_escalation_days === "number" && row.document_renewal_escalation_days >= 0
        ? Math.min(60, Math.round(row.document_renewal_escalation_days))
        : defaultSettings.documentRenewalEscalationDays,
    fiscalizacaoTermoConsulta: row.fiscalizacao_termo_lgpd ?? "",
    dashboardMoodAttention: row.dashboard_mood_attention ?? true,
    certificateLeaveAlertDays:
      typeof row.certificate_leave_alert_days === "number" && row.certificate_leave_alert_days > 0
        ? row.certificate_leave_alert_days
        : defaultSettings.certificateLeaveAlertDays,
  };
}

async function signBrandingPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BRANDING_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function loadSettings(): Promise<void> {
  if (loading) return;
  if (loaded) return;
  const ref = companyKey;
  if (!ref) {
    settings = { ...defaultSettings };
    loaded = true;
    emit();
    return;
  }
  loading = true;
  try {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("subdomain", ref)
      .maybeSingle();
    if (companyError) throw new Error(companyError.message);
    if (!company) {
      settings = { ...defaultSettings };
      saveError = "Empresa não identificada para carregar as configurações.";
      return;
    }
    const resolvedCompanyId = String(company.id);

    const [rowResult, modulesResult] = await Promise.all([
      supabase
        .from("company_settings")
        .select(SETTINGS_COLUMNS)
        .eq("company_id", resolvedCompanyId)
        .maybeSingle(),
      supabase.rpc("platform_enabled_modules"),
    ]);

    if (rowResult.error) throw new Error(rowResult.error.message);

    companyId = resolvedCompanyId;
    settings = { ...defaultSettings };
    if (rowResult.data) applyRow(rowResult.data as SettingsRow);

    const modules = (modulesResult.data as Record<string, boolean> | null) ?? {};
    settings = { ...settings, enabledModules: modules };

    const [logoUrl, letterheadUrl] = await Promise.all([
      signBrandingPath(settings.logoPath),
      signBrandingPath(settings.letterheadPath),
    ]);
    settings = { ...settings, logoUrl, letterheadUrl };
    saveError = null;
  } catch (error) {
    saveError = error instanceof Error ? error.message : "Não foi possível carregar as configurações da empresa.";
  } finally {
    loaded = true;
    loading = false;
    emit();
  }
}

/**
 * Define a empresa (subdomínio da sessão) dona das configurações carregadas.
 * Sem empresa (telas públicas/portões de sessão) não mexe no que já está
 * carregado — a identidade visual da empresa não é exposta fora do app.
 */
export function setSettingsCompanyRef(ref: string): void {
  const next = (ref || "").trim().toLowerCase();
  if (!next) return;
  if (refInitialized && next === companyKey) return;
  refInitialized = true;
  companyKey = next;
  companyId = null;
  loaded = false;
  saveError = null;
  settings = { ...defaultSettings };
  emit();
  void loadSettings();
}

function toRow(current: SystemSettings, currentCompanyId: string): Record<string, unknown> {
  return {
    company_id: currentCompanyId,
    logo_path: current.logoPath,
    letterhead_path: current.letterheadPath,
    validar_ca_ativo_no_epi: current.validarCaAtivoNoEpi,
    permitir_ca_nao_encontrado: current.permitirCaNaoEncontrado,
    permitir_ca_vencido: current.permitirCaVencido,
    company_legal_name: current.companyLegalName,
    company_cnpj: current.companyCnpj,
    technical_responsible: current.technicalResponsible,
    technical_registration: current.technicalRegistration,
    sesmt_phone: current.sesmtPhone,
    public_base_url: current.publicBaseUrl || null,
    replacement_sla_hours: current.replacementSlaHours,
    document_renewal_sla_days: current.documentRenewalSlaDays,
    document_renewal_idle_days: current.documentRenewalIdleDays,
    document_renewal_sla_warning_days: current.documentRenewalSlaWarningDays,
    document_renewal_manager_warning_days: current.documentRenewalManagerWarningDays,
    document_renewal_escalation_days: current.documentRenewalEscalationDays,
    dashboard_mood_attention: current.dashboardMoodAttention,
    certificate_leave_alert_days: current.certificateLeaveAlertDays,
    fiscalizacao_termo_lgpd: current.fiscalizacaoTermoConsulta,
    updated_at: new Date().toISOString(),
  };
}

/** Grava a configuração da empresa no servidor e devolve o resultado real. */
async function persistSettings(): Promise<SaveResult> {
  if (!companyId) {
    const message = "Empresa não identificada: não foi possível salvar as configurações.";
    setSaveError(message);
    return { ok: false, error: message };
  }
  try {
    const { error } = await supabase
      .from("company_settings")
      .upsert(toRow(settings, companyId), { onConflict: "company_id" });
    if (error) throw new Error(error.message);
    saveError = null;
    emit();
    return { ok: true, error: null };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Não foi possível salvar as configurações da empresa.";
    setSaveError(message);
    return { ok: false, error: message };
  }
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  void loadSettings();
  return () => {
    listeners.delete(listener);
  };
}

export function getSettings(): SystemSettings {
  return settings;
}

/** Último erro de leitura/gravação das configurações (exibido na tela). */
export function getSettingsSaveError(): string | null {
  return saveError;
}

/**
 * Aplica no estado local o termo LGPD que o servidor acabou de gravar.
 *
 * A parametrização do termo não usa `updateSetting`: ela grava pela Edge
 * Function `fiscalizacao-termo`, porque a alteração precisa ser auditada com
 * autor e texto anterior (a tabela de auditoria nega escrita pelo cliente).
 */
export function setFiscalizacaoTermoLocal(texto: string): void {
  settings = { ...settings, fiscalizacaoTermoConsulta: texto };
  emit();
}

export function useSystemSettings(): SystemSettings {
  const { subdomain } = useAppSession();
  setSettingsCompanyRef(subdomain);
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export function useSettingsSaveError(): string | null {
  return useSyncExternalStore(subscribeSettings, getSettingsSaveError, getSettingsSaveError);
}

/** Autor da alteração (usado apenas no log de auditoria). */
export interface SettingsActor {
  id?: string | null;
  name?: string | null;
}

/** Metadados de auditoria por campo de configuração: a que área pertence e como exibir. */
const SETTING_AUDIT_META: Partial<Record<keyof SystemSettings, { area: string; label: string }>> = {
  validarCaAtivoNoEpi: { area: "epi_rules", label: "Validar se o CA está ativo no cadastro de EPI" },
  permitirCaNaoEncontrado: { area: "epi_rules", label: "Permitir adicionar EPI com CA não encontrado" },
  permitirCaVencido: { area: "epi_rules", label: "Permitir adicionar EPI com CA vencido" },
  logoPath: { area: "branding", label: "Logo da empresa" },
  letterheadPath: { area: "branding", label: "Papel timbrado" },
  companyLegalName: { area: "company_data", label: "Razão social" },
  companyCnpj: { area: "company_data", label: "CNPJ" },
  technicalResponsible: { area: "company_data", label: "Responsável técnico" },
  technicalRegistration: { area: "company_data", label: "Registro profissional" },
  sesmtPhone: { area: "company_data", label: "Telefone do SESMT" },
  publicBaseUrl: { area: "company_data", label: "Endereço público dos QR-Codes de fiscalização" },
  replacementSlaHours: { area: "epi_rules", label: "Prazo de atendimento de substituição de EPI (horas)" },
  documentRenewalSlaDays: {
    area: "documents",
    label: "Prazo (SLA) de renovação de documentos por tipo",
  },
  documentRenewalIdleDays: {
    area: "documents",
    label: "Alerta de solicitação de renovação paralisada (dias sem movimentação)",
  },
  documentRenewalSlaWarningDays: {
    area: "documents",
    label: "Aviso de prazo (SLA) de renovação ao responsável da tratativa (dias antes)",
  },
  documentRenewalManagerWarningDays: {
    area: "documents",
    label: "Aviso de prazo (SLA) de renovação ao gestor (dias antes)",
  },
  documentRenewalEscalationDays: {
    area: "documents",
    label: "Escalonamento ao gestor quando a tratativa não se movimenta (dias após o aviso)",
  },
  fiscalizacaoTermoConsulta: {
    area: "qrcodes",
    label: "Termo LGPD da consulta externa (ficha de verificação)",
  },
  dashboardMoodAttention: {
    area: "dashboard",
    label: "Resumo de atenção no sentimento no dashboard do administrador",
  },
  certificateLeaveAlertDays: {
    area: "dashboard",
    label: "Alerta de atestado médico com afastamento prolongado (dias)",
  },
};

/** Formata o valor de um campo para leitura no log de auditoria. */
function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(vazio)";
  if (typeof value === "boolean") return value ? "Ativado" : "Desativado";
  if (typeof value === "string" && /^https?:\/\//.test(value)) return "arquivo de imagem";
  return String(value);
}

function auditChange<K extends keyof SystemSettings>(
  key: K,
  previous: SystemSettings[K],
  value: SystemSettings[K],
  actor?: SettingsActor
): void {
  const meta = SETTING_AUDIT_META[key];
  if (!meta || previous === value) return;
  const isEmpty = value === null || value === "";
  void logAudit({
    module: "config",
    area: meta.area,
    action: isEmpty ? "deleted" : "updated",
    entity: "company_settings",
    entityId: companyId,
    field: String(key),
    oldValue: formatAuditValue(previous),
    newValue: formatAuditValue(value),
    detail: `${meta.label}: ${formatAuditValue(previous)} -> ${formatAuditValue(value)}`,
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
  });
}

/**
 * Atualiza uma parametrização da empresa.
 *
 * A alteração é aplicada na hora para a tela responder rápido, mas é REVERTIDA
 * se o servidor recusar — o retorno informa o erro real (ex.: RLS barrando um
 * usuário que não é administrador da empresa).
 */
export async function updateSetting<K extends keyof SystemSettings>(
  key: K,
  value: SystemSettings[K],
  actor?: SettingsActor
): Promise<SaveResult> {
  if (key === "logoUrl" || key === "logoPath" || key === "letterheadUrl" || key === "letterheadPath") {
    return { ok: false, error: "Use o envio de arquivo de identidade visual." };
  }
  if (key === "enabledModules") {
    return { ok: false, error: "Os módulos contratados são definidos pela plataforma." };
  }

  const previousSettings = settings;
  const previousValue = settings[key];
  settings = { ...settings, [key]: value };
  emit();

  const result = await persistSettings();
  if (!result.ok) {
    settings = previousSettings;
    emit();
    return result;
  }
  auditChange(key, previousValue, value, actor);
  return result;
}

export async function resetSettings(actor?: SettingsActor): Promise<SaveResult> {
  const previousSettings = settings;
  settings = { ...defaultSettings, enabledModules: settings.enabledModules };
  emit();
  const result = await persistSettings();
  if (!result.ok) {
    settings = previousSettings;
    emit();
    return result;
  }
  void logAudit({
    module: "config",
    area: "company_data",
    action: "deleted",
    entity: "company_settings",
    entityId: companyId,
    field: "all",
    detail: "Configurações da empresa restauradas para o padrão.",
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? null,
  });
  return result;
}

/**
 * Verifica se um módulo está habilitado para a empresa.
 * A lista é definida pela plataforma; chave ausente = habilitado.
 */
export function isModuleEnabled(current: SystemSettings, moduleId: string): boolean {
  return current.enabledModules[moduleId] !== false;
}

function brandingPathFor(kind: BrandingAssetKind, extension: string): string {
  return `${companyKey}/${kind}/${kind}-${Date.now()}.${extension}`;
}

/**
 * Envia um arquivo de marca para a pasta PRIVADA da própria empresa e grava o
 * caminho na configuração. Devolve erro quando o upload ou a gravação falham.
 */
export async function uploadBrandingAsset(
  file: File,
  kind: BrandingAssetKind,
  actor?: SettingsActor
): Promise<SaveResult> {
  if (!companyKey) return { ok: false, error: "Empresa não identificada para enviar o arquivo." };

  const rawExt = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safeExt = (rawExt || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = brandingPathFor(kind, safeExt);

  const { error: uploadError } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: "3600",
  });
  if (uploadError) {
    setSaveError(uploadError.message);
    return { ok: false, error: uploadError.message };
  }

  const url = await signBrandingPath(path);
  const previousSettings = settings;
  const previousPath = kind === "logo" ? settings.logoPath : settings.letterheadPath;

  settings =
    kind === "logo"
      ? { ...settings, logoPath: path, logoUrl: url }
      : { ...settings, letterheadPath: path, letterheadUrl: url };
  emit();

  const result = await persistSettings();
  if (!result.ok) {
    settings = previousSettings;
    emit();
    return result;
  }

  if (kind === "logo") {
    auditChange("logoPath", previousPath, path, actor);
  } else {
    auditChange("letterheadPath", previousPath, path, actor);
  }
  return result;
}

/** Remove a referência ao arquivo de marca da empresa (o objeto não é apagado). */
export async function clearBrandingAsset(
  kind: BrandingAssetKind,
  actor?: SettingsActor
): Promise<SaveResult> {
  const previousSettings = settings;
  const previousPath = kind === "logo" ? settings.logoPath : settings.letterheadPath;

  settings =
    kind === "logo"
      ? { ...settings, logoPath: null, logoUrl: null }
      : { ...settings, letterheadPath: null, letterheadUrl: null };
  emit();

  const result = await persistSettings();
  if (!result.ok) {
    settings = previousSettings;
    emit();
    return result;
  }

  if (kind === "logo") {
    auditChange("logoPath", previousPath, null, actor);
  } else {
    auditChange("letterheadPath", previousPath, null, actor);
  }
  return result;
}