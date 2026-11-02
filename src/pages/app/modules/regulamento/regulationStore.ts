import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";

/**
 * Regulamento Interno da empresa.
 *
 * Cada publicação gera uma NOVA versão do regulamento. A versão anterior deixa
 * de ser válida (status "substituido") mas permanece acessível no histórico,
 * com a sinalização de que não está mais vigente. A partir do momento em que uma
 * nova versão é publicada, todos os colaboradores passam a ter pendência de
 * leitura e assinatura novamente.
 *
 * O estado fica no Supabase (tabelas `internal_regulations` e
 * `internal_regulation_signatures`) e é compartilhado por todos os usuários da
 * empresa. Os arquivos PDF sobem para o bucket privado `documents`.
 */

export interface RegulationPageContent {
  heading: string;
  paragraphs: string[];
}

export type RegulationStatus = "vigente" | "substituido";

export interface InternalRegulation {
  id: string;
  companyRef: string;
  version: number;
  title: string;
  summary: string;
  storagePath: string | null;
  fileSize: string | null;
  pageCount: number;
  contentPages: RegulationPageContent[];
  status: RegulationStatus;
  publishedAt: string;
  publishedBy: string | null;
  replacedAt: string | null;
  replacedBy: string | null;
}

export interface RegulationSignatureRecord {
  id: string;
  regulationId: string;
  version: number;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorEmail: string | null;
  collaboratorRole: string | null;
  pagesRead: number;
  signedAt: string;
  declaration: string;
}

interface RegulationStoreState {
  regulations: InternalRegulation[];
  signatures: RegulationSignatureRecord[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

const BUCKET = "documents";
const STORAGE_FOLDER = "regulamento-interno";

let companyRef = "vega";
let state: RegulationStoreState = {
  regulations: [],
  signatures: [],
  loaded: false,
  loading: false,
  error: null,
};

let seeding = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<RegulationStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRegulation(row: Record<string, unknown>): InternalRegulation {
  const pages = Array.isArray(row.content_pages)
    ? (row.content_pages as RegulationPageContent[])
    : [];
  return {
    id: String(row.ref),
    companyRef: String(row.company_ref ?? ""),
    version: Number(row.version ?? 1) || 1,
    title: String(row.title ?? "Regulamento Interno"),
    summary: (row.summary as string) ?? "",
    storagePath: (row.storage_path as string) ?? null,
    fileSize: (row.file_size as string) ?? null,
    pageCount: Math.max(1, Number(row.page_count ?? 1) || 1),
    contentPages: pages,
    status: row.status === "substituido" ? "substituido" : "vigente",
    publishedAt: String(row.published_at ?? ""),
    publishedBy: (row.published_by as string) ?? null,
    replacedAt: (row.replaced_at as string) ?? null,
    replacedBy: (row.replaced_by as string) ?? null,
  };
}

function mapSignature(row: Record<string, unknown>): RegulationSignatureRecord {
  return {
    id: String(row.id ?? `${row.regulation_ref}-${row.collaborator_id}`),
    regulationId: String(row.regulation_ref ?? ""),
    version: Number(row.regulation_version ?? 1) || 1,
    collaboratorId: String(row.collaborator_id ?? ""),
    collaboratorName: String(row.collaborator_name ?? ""),
    collaboratorEmail: (row.collaborator_email as string) ?? null,
    collaboratorRole: (row.collaborator_role as string) ?? null,
    pagesRead: Number(row.pages_read ?? 0) || 0,
    signedAt: String(row.signed_at ?? ""),
    declaration: (row.declaration as string) ?? "",
  };
}

/* ------------------------------ Seed demo ---------------------------- */

const SEED_REGULATION_REF = "rg-seed-1";
const SEED_REGULATION_VERSION = 1;

const seedPages: RegulationPageContent[] = [
  {
    heading: "1. Apresentação e abrangência",
    paragraphs: [
      "Este Regulamento Interno estabelece as regras de convivência, segurança e organização do trabalho aplicáveis a todos os colaboradores da empresa, independentemente da função, unidade ou regime de contratação.",
      "O documento complementa as obrigações previstas na Consolidação das Leis do Trabalho (CLT), nas Normas Regulamentadoras do Ministério do Trabalho e Emprego e nas convenções coletivas aplicáveis.",
      "É responsabilidade de cada colaborador ler integralmente o regulamento, esclarecer dúvidas com o SESMT ou com a liderança imediata e registrar a ciência por meio da assinatura eletrônica ao final da leitura.",
    ],
  },
  {
    heading: "2. Jornada, ponto e assiduidade",
    paragraphs: [
      "A jornada de trabalho observa o horário contratado e os intervalos previstos em lei e em acordo coletivo. O registro de ponto é obrigatório e deve ser realizado pelo próprio colaborador, no início e no fim do turno.",
      "Ausências, atrasos e saídas antecipadas devem ser comunicados à liderança imediata e ao Recursos Humanos com a maior brevidade possível. A justificativa legal deve ser apresentada em até 48 horas.",
      "A troca de turno ou de escala depende de autorização prévia da liderança e do setor de Recursos Humanos, respeitando o descanso mínimo entre jornadas.",
    ],
  },
  {
    heading: "3. Conduta e respeito no ambiente de trabalho",
    paragraphs: [
      "A empresa não tolera qualquer forma de assédio moral, assédio sexual, discriminação, preconceito ou violência no ambiente de trabalho, em suas dependências físicas ou digitais.",
      "O uso de celular e de outros dispositivos pessoais é permitido apenas nos intervalos e em áreas autorizadas. Em áreas operacionais, o uso é proibido enquanto o colaborador estiver em atividade.",
      "É vedado o acesso a áreas restritas sem autorização, bem como a permanência no local de trabalho fora do horário de serviço sem justificativa.",
    ],
  },
  {
    heading: "4. Segurança do trabalho e EPIs",
    paragraphs: [
      "O uso dos Equipamentos de Proteção Individual (EPIs) é obrigatório nas atividades que o exijam, conforme a NR-06 e a análise de riscos de cada função. A recusa injustificada caracteriza descumprimento deste regulamento.",
      "Os EPIs são de uso pessoal e devem ser conservados em local adequado, higienizados e substituídos quando danificados. O colaborador deve comunicar imediatamente qualquer avaria ao SESMT.",
      "É proibido executar tarefas de manutenção, limpeza ou ajuste em máquinas sem o bloqueio e a etiquetagem (LOTO) previstos no procedimento de segurança.",
    ],
  },
  {
    heading: "5. Treinamentos obrigatórios e DDS",
    paragraphs: [
      "A participação nos treinamentos obrigatórios, integrações e Diálogos Diários de Segurança (DDS) é condição para a execução de determinadas atividades. O colaborador deve registrar presença e assinar a lista ou o termo correspondente.",
      "Certificados vencidos impedem a execução de atividades de risco. Cabe ao colaborador e à liderança acompanharem a validade dos treinamentos no sistema de gestão de SST.",
      "As orientações recebidas em DDS são de aplicação imediata e devem ser seguidas em todas as frentes de trabalho.",
    ],
  },
  {
    heading: "6. Uso dos recursos da empresa e sigilo",
    paragraphs: [
      "Computadores, ferramentas, veículos, crachás e demais recursos são disponibilizados exclusivamente para as atividades profissionais. Todos os equipamentos e informações devolvidos ao final do contrato.",
      "Informações técnicas, comerciais, financeiras e dados pessoais tratados pela empresa são confidenciais, em conformidade com a Lei Geral de Proteção de Dados (LGPD).",
      "O crachá e a credencial de acesso são pessoais e intransferíveis. Em caso de perda, o colaborador deve comunicar imediatamente o setor responsável e será emitida uma segunda via.",
    ],
  },
  {
    heading: "7. Descumprimento e disposições finais",
    paragraphs: [
      "O descumprimento das regras deste regulamento sujeita o colaborador a advertência verbal, advertência escrita ou suspensão, conforme a gravidade e a reincidência, sem prejuízo das medidas legais cabíveis.",
      "Este regulamento entra em vigor na data de sua publicação. Cada nova versão substitui integralmente a anterior e exige a leitura e a assinatura de ciência de todos os colaboradores.",
      "Dúvidas sobre a aplicação deste documento devem ser encaminhadas à liderança imediata, ao Recursos Humanos ou ao SESMT.",
    ],
  },
];

function demoRegulations(): InternalRegulation[] {
  return [
    {
      id: SEED_REGULATION_REF,
      companyRef,
      version: SEED_REGULATION_VERSION,
      title: "Regulamento Interno",
      summary:
        "Regras de convivência, jornada, segurança, uso de EPIs, treinamentos e disposições gerais da empresa.",
      storagePath: null,
      fileSize: null,
      pageCount: seedPages.length,
      contentPages: seedPages,
      status: "vigente",
      publishedAt: "2026-08-03T12:00:00.000Z",
      publishedBy: "Marina Alves",
      replacedAt: null,
      replacedBy: null,
    },
  ];
}

const SEED_SIGNATURES: { id: string; name: string; email: string; role: string; at: string }[] = [
  { id: "c-002", name: "Juliana Prado", email: "juliana.prado@vega.com.br", role: "Técnica de Segurança", at: "2026-08-04T13:20:00.000Z" },
  { id: "c-005", name: "Patrícia Gomes", email: "patricia.gomes@vega.com.br", role: "Analista de Qualidade", at: "2026-08-05T09:42:00.000Z" },
  { id: "c-008", name: "Marcos Oliveira", email: "marcos.oliveira@vega.com.br", role: "Supervisor de Produção", at: "2026-08-05T17:05:00.000Z" },
  { id: "c-009", name: "Tatiane Costa", email: "tatiane.costa@vega.com.br", role: "Operadora de Máquinas", at: "2026-08-06T11:14:00.000Z" },
  { id: "c-011", name: "Larissa Martins", email: "larissa.martins@vega.com.br", role: "Engenheira de Segurança", at: "2026-08-07T15:51:00.000Z" },
];

function demoSignatures(): RegulationSignatureRecord[] {
  return SEED_SIGNATURES.map((item) => ({
    id: `${SEED_REGULATION_REF}-${item.id}`,
    regulationId: SEED_REGULATION_REF,
    version: SEED_REGULATION_VERSION,
    collaboratorId: item.id,
    collaboratorName: item.name,
    collaboratorEmail: item.email,
    collaboratorRole: item.role,
    pagesRead: seedPages.length,
    signedAt: item.at,
    declaration:
      "Declaro que li integralmente todas as páginas do Regulamento Interno e estou ciente das regras nele estabelecidas.",
  }));
}

async function seedDemo(): Promise<void> {
  if (seeding) return;
  seeding = true;
  try {
    const regulationRows = demoRegulations().map((reg) => ({
      company_ref: companyRef,
      ref: reg.id,
      version: reg.version,
      title: reg.title,
      summary: reg.summary,
      storage_path: null,
      file_size: null,
      page_count: reg.pageCount,
      content_pages: reg.contentPages,
      status: reg.status,
      published_at: reg.publishedAt,
      published_by: reg.publishedBy,
      updated_at: new Date().toISOString(),
    }));
    await supabase
      .from("internal_regulations")
      .upsert(regulationRows, { onConflict: "company_ref,ref" });

    const signatureRows = demoSignatures().map((sig) => ({
      company_ref: companyRef,
      regulation_ref: sig.regulationId,
      regulation_version: sig.version,
      collaborator_id: sig.collaboratorId,
      collaborator_name: sig.collaboratorName,
      collaborator_email: sig.collaboratorEmail,
      collaborator_role: sig.collaboratorRole,
      pages_read: sig.pagesRead,
      declaration: sig.declaration,
      signed_at: sig.signedAt,
    }));
    await supabase
      .from("internal_regulation_signatures")
      .upsert(signatureRows, { onConflict: "company_ref,regulation_ref,collaborator_id" });
  } finally {
    seeding = false;
  }
}

/* ------------------------------- Load -------------------------------- */

async function fetchAll(): Promise<{
  regulations: InternalRegulation[];
  signatures: RegulationSignatureRecord[];
}> {
  const [regRes, sigRes] = await Promise.all([
    supabase
      .from("internal_regulations")
      .select("*")
      .eq("company_ref", companyRef)
      .order("version", { ascending: false }),
    supabase
      .from("internal_regulation_signatures")
      .select("*")
      .eq("company_ref", companyRef)
      .order("signed_at", { ascending: false }),
  ]);
  if (regRes.error) throw regRes.error;
  return {
    regulations: ((regRes.data as Record<string, unknown>[]) ?? []).map(mapRegulation),
    signatures: sigRes.error
      ? []
      : ((sigRes.data as Record<string, unknown>[]) ?? []).map(mapSignature),
  };
}

async function loadAll(force = false): Promise<void> {
  if (!force && (state.loading || state.loaded)) return;
  setState({ loading: true });
  try {
    const data = await fetchAll();
    setState({
      regulations: data.regulations,
      signatures: data.signatures,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    // Falha de conexão NÃO vira conteúdo de demonstração: a tela informa o erro.
    setState({
      regulations: [],
      signatures: [],
      loaded: true,
      loading: false,
      error: "Não foi possível carregar o regulamento. Verifique a conexão e tente novamente.",
    });
  }
}

export function setRegulationCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef && (state.loaded || state.loading)) return;
  const changed = next !== companyRef;
  companyRef = next;
  if (changed) {
    state = { regulations: [], signatures: [], loaded: false, loading: false, error: null };
    void Promise.resolve().then(() => loadAll(true));
  }
}

export function subscribeRegulations(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadAll();
  return () => {
    listeners.delete(listener);
  };
}

export function getRegulations(): InternalRegulation[] {
  return state.regulations;
}

export function getRegulationStoreState(): RegulationStoreState {
  return state;
}

export function useRegulations(): InternalRegulation[] {
  const { subdomain } = useAppSession();
  setRegulationCompanyRef(subdomain);
  return useSyncExternalStore(subscribeRegulations, getRegulations, getRegulations);
}

export function useRegulationSignatures(): RegulationSignatureRecord[] {
  const { subdomain } = useAppSession();
  setRegulationCompanyRef(subdomain);
  return useSyncExternalStore(
    subscribeRegulations,
    () => state.signatures,
    () => state.signatures
  );
}

export function useRegulationStoreState(): RegulationStoreState {
  const { subdomain } = useAppSession();
  setRegulationCompanyRef(subdomain);
  return useSyncExternalStore(subscribeRegulations, getRegulationStoreState, getRegulationStoreState);
}

/** Versão vigente (a que precisa ser lida e assinada agora). */
export function useCurrentRegulation(): InternalRegulation | null {
  const regulations = useRegulations();
  return regulations.find((reg) => reg.status === "vigente") ?? null;
}

/** Versões anteriores, da mais recente para a mais antiga. */
export function usePreviousRegulations(): InternalRegulation[] {
  const regulations = useRegulations();
  return regulations
    .filter((reg) => reg.status === "substituido")
    .sort((a, b) => b.version - a.version);
}

export function signaturesForRegulation(
  signatures: RegulationSignatureRecord[],
  regulationId: string
): RegulationSignatureRecord[] {
  return signatures.filter((sig) => sig.regulationId === regulationId);
}

export function firstSignatureFor(
  signatures: RegulationSignatureRecord[],
  regulationId: string,
  collaboratorId: string | null | undefined
): RegulationSignatureRecord | null {
  if (!collaboratorId) return null;
  return (
    signatures.find(
      (sig) => sig.regulationId === regulationId && sig.collaboratorId === collaboratorId
    ) ?? null
  );
}

/* ------------------------------ Arquivos ----------------------------- */

function sanitizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 70) || "regulamento.pdf"
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

async function uploadRegulationFile(file: File): Promise<{ path: string; size: string }> {
  const path = `${companyRef}/${STORAGE_FOLDER}/${Date.now()}-${sanitizeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/pdf",
  });
  if (error) throw new Error("Não foi possível enviar o PDF do regulamento.");
  return { path, size: formatFileSize(file.size) };
}

/** Gera um link assinado temporário para abrir o PDF do regulamento. */
export async function resolveRegulationFileUrl(
  regulation: InternalRegulation | null
): Promise<string | null> {
  if (!regulation?.storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(regulation.storagePath, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------- Ações ------------------------------ */

export interface PublishRegulationInput {
  title: string;
  summary: string;
  file: File;
  pageCount: number;
  publishedBy: string;
}

/** Publica uma nova versão e invalida a anterior (mantendo-a no histórico). */
export async function publishNewRegulation(
  input: PublishRegulationInput
): Promise<{ version: number }> {
  const uploaded = await uploadRegulationFile(input.file);
  const current = state.regulations.find((reg) => reg.status === "vigente") ?? null;
  const nextVersion =
    Math.max(0, ...state.regulations.map((reg) => reg.version)) + 1;
  const now = new Date().toISOString();

  if (current) {
    const { error } = await supabase
      .from("internal_regulations")
      .update({
        status: "substituido",
        replaced_at: now,
        replaced_by: input.publishedBy,
        updated_at: now,
      })
      .eq("company_ref", companyRef)
      .eq("ref", current.id);
    if (error) throw new Error("Não foi possível invalidar a versão anterior do regulamento.");
  }

  const ref = `rg-${Date.now()}`;
  const { error } = await supabase.from("internal_regulations").insert({
    company_ref: companyRef,
    ref,
    version: nextVersion,
    title: input.title.trim() || "Regulamento Interno",
    summary: input.summary.trim(),
    storage_path: uploaded.path,
    file_size: uploaded.size,
    page_count: Math.max(1, input.pageCount || 1),
    content_pages: [],
    status: "vigente",
    published_at: now,
    published_by: input.publishedBy,
  });
  if (error) throw new Error("Não foi possível salvar o novo regulamento.");

  await loadAll(true);
  return { version: nextVersion };
}

export interface SignRegulationInput {
  regulation: InternalRegulation;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorEmail?: string | null;
  collaboratorRole?: string | null;
  pagesRead: number;
  declaration: string;
}

/**
 * Registra a leitura completa e a ciência do colaborador.
 *
 * A identidade (colaborador, empresa, versão vigente) é resolvida no banco: o
 * navegador não escolhe por quem assina, e a função recusa versões que não
 * estejam mais vigentes.
 */
export async function signRegulation(input: SignRegulationInput): Promise<void> {
  const { data, error } = await supabase.rpc("regulation_acknowledge", {
    p_regulation_ref: input.regulation.id,
    p_pages_read: input.pagesRead,
    p_declaration: input.declaration,
  });
  if (error) {
    throw new Error("Não foi possível registrar a sua assinatura. Tente novamente.");
  }
  const result = data as { ok?: boolean; reason?: string } | null;
  if (!result?.ok) {
    const reason = result?.reason;
    if (reason === "regulation_not_active") {
      throw new Error("Esta versão do regulamento não está mais vigente. Recarregue a página.");
    }
    if (reason === "no_collaborator_link") {
      throw new Error(
        "Sua conta ainda não está vinculada a um cadastro de colaborador desta empresa. Peça ao administrador para vincular seu e-mail ao seu cadastro."
      );
    }
    if (reason === "no_company") {
      throw new Error("Sua empresa está inativa ou suspensa. O aceite não pode ser registrado.");
    }
    throw new Error("Não foi possível registrar a sua assinatura. Tente novamente.");
  }
  await loadAll(true);
}