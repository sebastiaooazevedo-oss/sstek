import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";

/**
 * Atestados médicos.
 *
 * Regras do fluxo (Entrega 1):
 *  1. O arquivo é enviado ao Storage ANTES de qualquer INSERT.
 *  2. Depois do upload, o app CONFIRMA no servidor que o objeto existe naquele
 *     bucket e que o tamanho gravado corresponde ao arquivo escolhido.
 *  3. Só então o registro é inserido. Se upload ou confirmação falharem,
 *     NENHUM registro é criado — o usuário vê o erro e tenta de novo.
 *  4. O servidor ainda valida a finalização em gatilho: caminho não vazio,
 *     objeto existente, pasta da empresa do registro e pasta do próprio
 *     colaborador. Chamada direta à API passa pela mesma validação.
 *  5. O registro finalizado é imutável no banco. Correção = NOVA VERSÃO
 *     (`replaces_id`), que preserva o original e o arquivo original.
 *  6. Registros antigos sem arquivo NÃO são apagados nem reatribuídos: eles
 *     continuam listados e sinalizados como "sem arquivo", com a opção de
 *     receber uma nova versão com o documento.
 *
 * Compatibilidade: o select tenta as colunas de versionamento e, se o banco
 * ainda não tiver a migração aplicada, cai automaticamente para a leitura
 * antiga (nesse caso a correção por versão fica indisponível na UI).
 */

export interface MedicalCertificate {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  /** Unidade/estabelecimento gravada no momento do envio. */
  establishment: string;
  /** Área/setor gravada no momento do envio. */
  area: string;
  certificateType: string;
  issuedOn: string;
  leaveDays: number;
  cid: string;
  notes: string;
  fileName: string;
  storagePath?: string;
  /** Tem arquivo no Storage? Registros antigos podem não ter. */
  hasFile: boolean;
  hasImage: boolean;
  createdAt: string;
  /** Versão do atestado (1 = original). */
  revision: number;
  /** Id do atestado substituído por este registro. */
  replacesId: string | null;
  /** Id da versão que substituiu este registro, quando houver. */
  supersededBy: string | null;
  /** Versão vigente = não foi substituída por ninguém. */
  isCurrent: boolean;
}

export interface NewMedicalCertificate {
  collaboratorId: string;
  collaboratorName: string;
  area: string;
  establishment: string;
  certificateType: string;
  issuedOn: string;
  leaveDays: number;
  cid: string;
  notes: string;
  file: File;
  createdBy: string;
  /** Quando preenchido, cria uma NOVA VERSÃO do atestado informado. */
  replacesId?: string | null;
}

export type MedicalCertificateResult = { ok: true } | { ok: false; error: string; retryable: boolean };

interface MedicalCertificateState {
  /** Todos os registros, incluindo versões substituídas. */
  certificates: MedicalCertificate[];
  /** Apenas as versões vigentes (não substituídas). */
  current: MedicalCertificate[];
  companyId: string | null;
  versioningSupported: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

const BUCKET = "documents";

const BASE_COLUMNS =
  "id, collaborator_ref, collaborator_name, establishment, area, certificate_type, issued_on, leave_days, cid, notes, file_name, storage_path, created_at";
const VERSION_COLUMNS = `${BASE_COLUMNS}, revision, replaces_id`;

let companyRef = "vega";
let state: MedicalCertificateState = {
  certificates: [],
  current: [],
  companyId: null,
  versioningSupported: false,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function derive(certificates: MedicalCertificate[]): MedicalCertificate[] {
  const childOf = new Map<string, string>();
  certificates.forEach((cert) => {
    if (cert.replacesId) childOf.set(cert.replacesId, cert.id);
  });
  certificates.forEach((cert) => {
    cert.supersededBy = childOf.get(cert.id) ?? null;
    cert.isCurrent = cert.supersededBy === null;
  });
  return certificates.filter((cert) => cert.isCurrent);
}

function setState(patch: Partial<MedicalCertificateState>): void {
  const next = { ...state, ...patch };
  if (patch.certificates) {
    next.current = derive(patch.certificates);
  }
  state = next;
  emit();
}

function mapRow(r: Record<string, unknown>): MedicalCertificate {
  const storagePath = (r.storage_path as string) || undefined;
  const previewDataUrl = (r.preview_data_url as string) || "";
  return {
    id: String(r.id),
    collaboratorId: (r.collaborator_ref as string) ?? "",
    collaboratorName: (r.collaborator_name as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    area: (r.area as string) ?? "",
    certificateType: (r.certificate_type as string) ?? "Atestado médico",
    issuedOn: (r.issued_on as string) ?? "",
    leaveDays: Number(r.leave_days) || 0,
    cid: (r.cid as string) ?? "",
    notes: (r.notes as string) ?? "",
    fileName: (r.file_name as string) ?? "",
    storagePath,
    hasFile: Boolean(storagePath),
    hasImage: Boolean(storagePath) || Boolean(previewDataUrl),
    createdAt: (r.created_at as string) ?? "",
    revision: Number(r.revision) || 1,
    replacesId: (r.replaces_id as string) || null,
    supersededBy: null,
    isCurrent: true,
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column .* does not exist|could not find the '.*' column/i.test(error.message ?? "");
}

async function resolveCompanyId(ref: string): Promise<string> {
  if (!ref) throw new Error("company not resolved");
  const { data, error } = await supabase.from("companies").select("id").eq("subdomain", ref).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("company not resolved");
  return String(data.id);
}

async function ensureCompanyId(): Promise<string> {
  if (state.companyId) return state.companyId;
  const companyId = await resolveCompanyId(companyRef);
  setState({ companyId });
  return companyId;
}

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));

    let versioningSupported = true;
    // Linhas tipadas de forma ampla: o fallback sem versionamento devolve
    // menos colunas, e mapRow já trata revision/replaces_id ausentes.
    let data: Record<string, unknown>[] | null;
    let error: { code?: string; message?: string } | null;
    ({ data, error } = await supabase
      .from("medical_certificates")
      .select(VERSION_COLUMNS)
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false }));

    if (isMissingColumnError(error)) {
      versioningSupported = false;
      ({ data, error } = await supabase
        .from("medical_certificates")
        .select(BASE_COLUMNS)
        .eq("company_ref", companyRef)
        .order("created_at", { ascending: false }));
    }

    if (error) throw error;

    setState({
      certificates: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      versioningSupported,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({
      loaded: true,
      loading: false,
      error: "Não foi possível carregar os atestados médicos.",
    });
  }
}

export async function loadMedicalCertificates(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function setMedicalCertificateCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, certificates: [], current: [] };
  void loadMedicalCertificates();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadMedicalCertificates();
  return () => {
    listeners.delete(listener);
  };
}

/* ------------------------- Imagem do atestado ------------------------ */

function sanitizeStorageName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "atestado"
  );
}

interface UploadResult {
  ok: boolean;
  path?: string;
  error?: string;
}

/**
 * Confirma, no servidor, que o objeto existe no bucket e que o tamanho
 * gravado corresponde ao arquivo escolhido. Não cria registro nenhum.
 *
 * A leitura da própria pasta de atestados é autorizada pela policy mesmo antes
 * de o registro existir (storage_path_is_own_certificate_folder).
 */
async function confirmUploadedObject(
  path: string,
  expectedSize: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const slash = path.lastIndexOf("/");
    const folder = slash >= 0 ? path.slice(0, slash) : "";
    const fileName = slash >= 0 ? path.slice(slash + 1) : path;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, { search: fileName, limit: 100 });

    if (error) {
      return {
        ok: false,
        error: "Não foi possível confirmar o envio do arquivo. Nada foi cadastrado — tente novamente.",
      };
    }

    const found = (data ?? []).find((item) => item.name === fileName);
    if (!found) {
      return {
        ok: false,
        error: "O envio do arquivo não foi confirmado no servidor. Nada foi cadastrado — tente novamente.",
      };
    }

    const storedSize = Number((found.metadata as { size?: number } | null)?.size ?? NaN);
    if (Number.isFinite(storedSize) && expectedSize > 0 && storedSize !== expectedSize) {
      return {
        ok: false,
        error: "O arquivo gravado não corresponde ao enviado. Nada foi cadastrado — tente novamente.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Não foi possível confirmar o envio do arquivo. Nada foi cadastrado — tente novamente.",
    };
  }
}

/**
 * Etapa 1 do envio: grava o arquivo no Storage privado, CONFIRMA a gravação
 * (existência + tamanho) e só então devolve o caminho. Nenhum registro de
 * banco é criado aqui.
 */
async function uploadCertificateFile(file: File, collaboratorId: string): Promise<UploadResult> {
  const path = `${companyRef}/atestados/${collaboratorId}/${Date.now()}-${sanitizeStorageName(file.name)}`;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      return {
        ok: false,
        error: "Não foi possível enviar a imagem do atestado. Verifique a conexão e tente novamente.",
      };
    }

    if (!data?.path) {
      return {
        ok: false,
        error: "O envio da imagem não foi confirmado. Nada foi cadastrado — tente novamente.",
      };
    }

    const confirmation = await confirmUploadedObject(data.path, file.size);
    if (!confirmation.ok) {
      // Objeto enviado mas não confirmado: inalcançável (fechado). Remoção
      // best-effort, nunca pré-requisito.
      void supabase.storage
        .from(BUCKET)
        .remove([data.path])
        .then(
          () => undefined,
          () => undefined
        );
      return { ok: false, error: confirmation.error };
    }

    return { ok: true, path: data.path };
  } catch {
    return {
      ok: false,
      error: "Não foi possível enviar a imagem do atestado. Verifique a conexão e tente novamente.",
    };
  }
}

function describeInsertError(error: { code?: string; message?: string } | null): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "42703" || code === "PGRST204" || isMissingColumnError(error)) {
    return "A correção por nova versão ainda não está habilitada no banco. Nada foi cadastrado.";
  }
  if (
    /arquivo não existe|não pertence à pasta da empresa|pasta de outro colaborador|já pertence a um atestado|já usado por documento|referência não é um caminho|empresa do registro não existe|não corresponde ao company_id|sem empresa identificada|caminho de atestado incompleto|precisa estar em/i.test(
      message
    )
  ) {
    return "O servidor recusou a finalização: o arquivo não é um objeto válido e autorizado desta empresa e deste colaborador. Nada foi cadastrado — envie novamente pelo sistema.";
  }
  if (
    code === "23505" ||
    code === "23514" ||
    /medical_certificates_(replaces_id|storage_path)_uidx|requires_file/.test(message)
  ) {
    return "Este envio não pôde ser finalizado (versão ou arquivo em conflito). Nada foi cadastrado — tente novamente.";
  }
  if (code === "42501" || /row-level security|policy/i.test(message)) {
    return "Sem permissão para cadastrar o atestado neste momento. Nada foi cadastrado.";
  }
  return "Não foi possível cadastrar o atestado. Nada foi cadastrado — tente novamente.";
}

/**
 * Registra um atestado médico em etapas explícitas:
 *   1) upload e confirmação do arquivo no servidor;
 *   2) INSERT do registro (somente se o arquivo foi confirmado).
 *
 * Em qualquer falha o retorno traz `retryable: true` e nada é persistido
 * como "envio concluído".
 */
export async function addMedicalCertificate(input: NewMedicalCertificate): Promise<MedicalCertificateResult> {
  if (!input.file) return { ok: false, error: "Anexe a foto do atestado médico.", retryable: true };
  if (!input.issuedOn) return { ok: false, error: "Informe a data do atestado.", retryable: true };
  if (!input.cid.trim()) return { ok: false, error: "Informe o CID do atestado.", retryable: true };
  if (input.replacesId && !state.versioningSupported) {
    return {
      ok: false,
      error: "A correção por nova versão ainda não está habilitada no banco.",
      retryable: false,
    };
  }

  try {
    const companyId = await ensureCompanyId();

    const upload = await uploadCertificateFile(input.file, input.collaboratorId);
    if (!upload.ok || !upload.path) {
      return { ok: false, error: upload.error ?? "Falha no envio do arquivo.", retryable: true };
    }

    const payload: Record<string, unknown> = {
      company_id: companyId,
      company_ref: companyRef,
      collaborator_ref: input.collaboratorId,
      collaborator_name: input.collaboratorName,
      area: input.area || null,
      establishment: input.establishment || null,
      certificate_type: input.certificateType,
      issued_on: input.issuedOn,
      leave_days: Math.max(0, Number(input.leaveDays) || 0),
      cid: input.cid.trim(),
      notes: input.notes.trim() || null,
      storage_path: upload.path,
      preview_data_url: null,
      file_name: input.file.name || null,
      created_by: input.createdBy || null,
    };
    if (input.replacesId) payload.replaces_id = input.replacesId;

    const { error } = await supabase.from("medical_certificates").insert(payload);

    if (error) {
      // O arquivo enviado não pode ser reaproveitado: sem registro, ele fica
      // inalcançável (fechado). A remoção depende de permissão de admin e é
      // best-effort — nunca é pré-requisito para continuar.
      void supabase.storage
        .from(BUCKET)
        .remove([upload.path])
        .then(
          () => undefined,
          () => undefined
        );
      return { ok: false, error: describeInsertError(error), retryable: true };
    }

    await refresh();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Não foi possível concluir o cadastro. Nada foi registrado — tente novamente.",
      retryable: true,
    };
  }
}

/** URL temporária da foto do atestado (Storage ou cópia antiga no banco). */
export async function getMedicalCertificateImage(certificate: MedicalCertificate): Promise<string | null> {
  if (certificate.storagePath) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(certificate.storagePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  try {
    const { data, error } = await supabase
      .from("medical_certificates")
      .select("preview_data_url")
      .eq("id", certificate.id)
      .maybeSingle();
    if (error) throw error;
    return (data?.preview_data_url as string) || null;
  } catch {
    return null;
  }
}

/* --------------------------- Seletores ------------------------------ */

function getCurrentCertificates(): MedicalCertificate[] {
  return state.current;
}

function getAllCertificates(): MedicalCertificate[] {
  return state.certificates;
}

/**
 * Atestados VIGENTES da empresa (ou do próprio colaborador, conforme a RLS).
 * Versões substituídas não aparecem aqui — evita contar dias de
 * afastamento em duplicidade nos painéis.
 */
export function useMedicalCertificates(): MedicalCertificate[] {
  const { subdomain } = useAppSession();
  setMedicalCertificateCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getCurrentCertificates, getCurrentCertificates);
}

/** Todos os registros, incluindo versões históricas. */
export function useMedicalCertificatesHistory(): MedicalCertificate[] {
  const { subdomain } = useAppSession();
  setMedicalCertificateCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, getAllCertificates, getAllCertificates);
}

export function useMedicalCertificateStoreState(): MedicalCertificateState {
  const { subdomain } = useAppSession();
  setMedicalCertificateCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const medicalCertificateTypes = [
  "Atestado médico",
  "ASO — Atestado de Saúde Ocupacional",
  "Exame complementar",
  "Laudo / relatório médico",
];