import { supabase } from "@/lib/supabase";

/** Contrato de dados devolvido pela edge function `platform-admin`. */
export interface PlatformCompany {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  subdomain: string;
  plan: string;
  status: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  collaborators: number;
}

export interface PlatformDomain {
  id: string;
  company_id: string;
  domain: string;
  kind: string;
  is_primary: boolean;
  dns_status: string;
  https_status: string;
  dns_checked_at: string | null;
  notes: string | null;
}

export interface PlatformCompanyAdmin {
  id: string;
  company_id: string | null;
  role: string;
  name: string;
  email: string | null;
  phone?: string | null;
  status: string;
  auth_user_id: string | null;
  is_primary_admin?: boolean;
  created_at: string;
}

export interface PlatformAuditRow {
  id: number;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_company_id: string | null;
  target_company_name: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface PlatformActiveCatalog {
  id: string;
  file_name: string;
  row_count: number;
  rejected_count: number;
  is_active: boolean;
  status: string;
  created_at: string;
  encoding: string | null;
  delimiter_char: string | null;
  catalogRows: number;
}

export interface PlatformOverview {
  ok: boolean;
  admin: { id: string; name: string; email: string | null };
  companies: PlatformCompany[];
  domains: PlatformDomain[];
  companyAdmins: PlatformCompanyAdmin[];
  audit: PlatformAuditRow[];
  activeCatalog: PlatformActiveCatalog | null;
  reservedSubdomains: string[];
}

export interface CaepiBatchRow {
  id: string;
  file_name: string;
  file_size: number;
  row_count: number;
  inserted_count: number;
  updated_count: number;
  rejected_count: number;
  status: string;
  is_active: boolean;
  encoding: string | null;
  delimiter_char: string | null;
  uploaded_by_name: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CaepiLogRow {
  id: number;
  batch_id: string | null;
  action: string;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface PlatformLicenseRow {
  companyId: string;
  companyName: string;
  subdomain: string;
  companyPlan: string;
  companyStatus: string;
  collaborators: number;
  plan: string;
  seats: number;
  monthlyValue: number;
  billingCycle: string;
  status: string;
  startedAt: string | null;
  nextDueDate: string | null;
  notes: string | null;
}

export interface PlatformInvoiceRow {
  id: string;
  company_id: string;
  reference_month: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  method: string | null;
  notes: string | null;
  created_at: string;
  company_name: string | null;
  company_subdomain: string | null;
  company_plan: string | null;
}

export interface PlatformSettingsPayload {
  ok: boolean;
  parameters: Record<string, unknown>;
  rolePermissions: Record<string, unknown>;
  updatedAt: string | null;
}

export interface PlatformInvoiceCompany {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  status: string;
}

/** Empresa disponível para receber uma base de colaboradores. */
export interface ImportCompany {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  status: string;
  collaborators: number;
}

export interface ImportHistoryRow {
  id: number;
  actor_name: string | null;
  target_company_id: string | null;
  target_company_name: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface CollaboratorImportRow {
  line: number;
  name: string;
  cpf: string;
  ref?: string;
  matricula?: string;
  roleFunction?: string;
  area?: string;
  establishment?: string;
  rg?: string;
  pis?: string;
  ctps?: string;
  admissionDate?: string;
  birthDate?: string;
  phone?: string;
  email?: string;
  city?: string;
  status?: string;
}

export interface CollaboratorImportResult extends ApiResponse {
  inserted: number;
  skipped: number;
  failed: number;
  errors: { line: number; message: string }[];
}

export interface PlatformSealSigner {
  name: string;
  role?: string | null;
  signedAt?: string | null;
}

export interface PlatformSealRow {
  id: string;
  company_id: string;
  company_name: string | null;
  company_subdomain: string | null;
  scope: string;
  reference_ref: string;
  reference_label: string | null;
  content_hash: string;
  signer_count: number;
  signers: PlatformSealSigner[];
  /** Gestor que emitiu/imprimiu o relatório chancelado (nulo em documentos assinados). */
  issuer: string | null;
  validation_token: string;
  code: string;
  sealed_at: string;
  created_at: string;
}

export interface PlatformSealsPayload {
  ok: boolean;
  seals: PlatformSealRow[];
  companies: PlatformInvoiceCompany[];
  /** Nomes distintos de gestores emissores dentro do recorte consultado. */
  issuers?: string[];
}

export interface PlatformSystemLog {
  uid: string;
  source: string;
  companyId: string | null;
  companyName: string | null;
  module: string;
  area: string | null;
  action: string;
  entity: string | null;
  detail: string;
  actorName: string | null;
  actorRole: string | null;
  createdAt: string;
  secret: boolean;
}

export interface PlatformSystemLogsPayload {
  ok: boolean;
  logs: PlatformSystemLog[];
  companies: PlatformInvoiceCompany[];
  counts: { total: number; created: number; deleted: number; secret: number };
}

interface ApiResponse {
  ok?: boolean;
  error?: string;
  detail?: string;
}

export class PlatformApiError extends Error {
  code: string;
  constructor(message: string, code = "UNKNOWN") {
    super(message);
    this.name = "PlatformApiError";
    this.code = code;
  }
}

async function invoke<T extends ApiResponse>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("platform-admin", {
    body: { action, ...payload },
  });

  if (error) {
    // A função devolve detalhes no corpo mesmo em 401/403; tentamos ler a mensagem real.
    const context = (error as { context?: { body?: string } })?.context;
    let message = error.message;
    let code = "INVOKE_FAILED";
    if (context?.body) {
      try {
        const parsed = JSON.parse(context.body) as ApiResponse;
        message = parsed.detail || parsed.error || message;
        code = parsed.error || code;
      } catch {
        // mantém a mensagem original
      }
    }
    throw new PlatformApiError(message, code);
  }

  const response = (data ?? {}) as T;
  if (response.ok === false) {
    throw new PlatformApiError(response.detail || response.error || "Operação não concluída.", response.error);
  }
  return response;
}

export const platformApi = {
  overview: () => invoke<PlatformOverview>("overview"),
  upsertCompany: (input: Record<string, unknown>) => invoke("upsert_company", input),
  setCompanyStatus: (companyId: string, status: string, reason?: string) =>
    invoke<ApiResponse & { detail?: string }>("set_company_status", { companyId, status, reason }),
  upsertDomain: (input: Record<string, unknown>) => invoke("upsert_domain", input),
  upsertCompanyAdmin: (input: Record<string, unknown>) => invoke("upsert_company_admin", input),
  updatePrimaryAdmin: (input: Record<string, unknown>) =>
    invoke<ApiResponse & { detail?: string }>("update_primary_admin", input),
  revokePrimaryAdmin: (companyId: string, profileId: string) =>
    invoke<ApiResponse & { detail?: string }>("revoke_primary_admin", { companyId, profileId }),
  supportAccess: (companyId: string, reason: string) =>
    invoke<ApiResponse & { detail?: string }>("support_access", { companyId, reason }),
  caepiHistory: () => invoke<{ ok: boolean; batches: CaepiBatchRow[]; logs: CaepiLogRow[] }>("caepi_history"),
  caepiActivate: (batchId: string) =>
    invoke<ApiResponse & { detail?: string; records?: number }>("caepi_activate", { batchId }),
  caepiErrors: (batchId: string, limit = 500) =>
    invoke<{ ok: boolean; errors: CaepiErrorRow[] }>("caepi_errors", { batchId, limit }),
  /** Registra a abertura de uma tela do painel global (IP e data/hora no servidor). */
  logAccess: (screen: string) =>
    invoke<ApiResponse>("log_access", { screen, path: typeof window === "undefined" ? null : window.location.pathname }),
  settingsGet: () => invoke<PlatformSettingsPayload>("settings_get"),
  saveParameters: (value: Record<string, unknown>) =>
    invoke<ApiResponse & { detail?: string }>("settings_save", { kind: "parameters", value }),
  saveRolePermissions: (value: Record<string, unknown>) =>
    invoke<ApiResponse & { detail?: string }>("settings_save", { kind: "role_permissions", value }),
  /** Modulos contratados — definidos pela plataforma, somente leitura para o cliente. */
  modulesGet: () => invoke<{ ok: boolean; modules: Record<string, boolean>; updatedAt: string | null }>("modules_get"),
  saveModules: (modules: Record<string, boolean>) =>
    invoke<ApiResponse & { detail?: string }>("modules_save", { modules }),
  licenses: () => invoke<{ ok: boolean; licenses: PlatformLicenseRow[] }>("licenses_overview"),
  saveLicense: (input: Record<string, unknown>) =>
    invoke<ApiResponse & { detail?: string }>("license_save", input),
  payments: () =>
    invoke<{ ok: boolean; invoices: PlatformInvoiceRow[]; companies: PlatformInvoiceCompany[] }>("payments_overview"),
  updateInvoice: (invoiceId: string, status: string, method?: string) =>
    invoke<ApiResponse & { detail?: string }>("invoice_update", { invoiceId, status, method }),
  importContext: () =>
    invoke<{ ok: boolean; companies: ImportCompany[]; history: ImportHistoryRow[] }>("import_context"),
  importCollaborators: (companyId: string, fileName: string, rows: CollaboratorImportRow[]) =>
    invoke<CollaboratorImportResult>("collaborators_import", { companyId, fileName, rows }),
  systemLogs: (params: { companyId?: string | null; role?: string; from?: string | null; to?: string | null; limit?: number }) =>
    invoke<PlatformSystemLogsPayload>("system_logs", params),
  sealsOverview: (params: {
    companyId?: string | null;
    scope?: string | null;
    issuer?: string | null;
    from?: string | null;
    to?: string | null;
    search?: string;
    limit?: number;
  }) => invoke<PlatformSealsPayload>("seals_overview", params),
};

export interface CaepiErrorRow {
  line_no: number;
  column_name: string | null;
  value_text: string | null;
  reason: string;
  row_preview: string;
}

/** Gera e baixa o relatório de erros de um lote (CSV) a partir dos dados do servidor. */
export function downloadCaepiErrorsCsv(fileName: string, rows: CaepiErrorRow[]): void {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["Linha", "Coluna", "Valor", "Motivo", "Conteudo da linha"].join(";");
  const body = rows.map((row) =>
    [row.line_no, row.column_name, row.value_text, row.reason, row.row_preview].map(escape).join(";")
  );
  const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relatorio-erros-caepi-${fileName.replace(/\.[^.]+$/, "")}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}