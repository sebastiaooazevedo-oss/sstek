import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import { initialDocuments, type DocumentRecord, type DossierAttachment, type DossierParts } from "@/mocks/documents";
import type { AprRecord } from "@/mocks/apr";
import type { EpiDelivery } from "@/mocks/epi";
import { initialAtas, initialCipas, initialElections, type CipaAta, type CipaElection, type ElectionCandidate } from "@/mocks/cipa";
import { candidacyState, electionCommitteeAta, isAtaFullyApproved, rankCandidates } from "@/pages/app/modules/cipa/cipaUtils";
import { buildAtaPdfBody } from "@/pages/app/modules/cipa/ataPdf";
import { cachedAtaSignatureImages } from "@/pages/app/modules/cipa/ataSignatureImages";
import {
  buildDossierPdfBody,
  buildEditalPdfBody,
  buildPossePdfBody,
  buildResultadoEditalPdfBody,
  defaultDossierParts,
} from "@/pages/app/modules/cipa/editalPdf";
import {
  buildAttendanceReportPdfBody,
  buildBuPdfBody,
  buildCandidateFichaPdfBody,
  buildResultFinalAtaPdfBody,
} from "@/pages/app/modules/cipa/ballotPdf";
import type { BuData } from "@/pages/app/modules/cipa/ballotResult";
import { getAtas, getCipas, getElections } from "@/pages/app/modules/cipa/cipaStore";
import { fileTypeFromName, computeStatus } from "@/pages/app/modules/documentos/documentUtils";
import type { TechnicalSignatureInfo } from "@/pages/app/utils/exportPdf";

/**
 * Store compartilhado dos documentos da empresa, persistido no Supabase
 * (tabela `documents`).
 *
 * Antes mantinha um único array em memória durante a sessão; agora os
 * documentos ficam salvos de verdade e um registro gerado por qualquer módulo
 * (APR, EPI, Atas, Editais, Dossiê, Fichas de Presença, Inspeções, uploads
 * manuais) aparece na tela de Documentos e sobrevive a recarregar a página.
 *
 * A API pública é a mesma de antes (`addDocument`, `addDocuments`,
 * `removeDocument`, `useDocuments`, `getDocuments`, `subscribeDocuments`) para
 * não impactar os consumidores. As gravações atualizam o estado local na hora
 * (otimista) e persistem em segundo plano. A empresa é resolvida pela sessão.
 */

interface DocumentsStoreState {
  documents: DocumentRecord[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: DocumentsStoreState = {
  documents: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

let seeding = false;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<DocumentsStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setDocumentsCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, documents: [] };
  void loadDocuments();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRow(r: Record<string, unknown>): DocumentRecord {
  return {
    id: String(r.ref),
    name: (r.name as string) ?? "",
    typeId: (r.type_id as string) ?? "",
    typeName: (r.type_name as string) ?? "",
    scope: (r.scope as DocumentRecord["scope"]) ?? "empresa",
    collaboratorId: (r.collaborator_id as string) ?? undefined,
    collaboratorName: (r.collaborator_name as string) ?? undefined,
    collaboratorRole: (r.collaborator_role as string) ?? undefined,
    issuedAt: (r.issued_at as string) ?? "",
    expiresAt: (r.expires_at as string) ?? "",
    status: (r.status as DocumentRecord["status"]) ?? "Em dia",
    size: (r.size as string) ?? "—",
    fileType: (r.file_type as DocumentRecord["fileType"]) ?? "pdf",
    visibleToCollaborator: Boolean(r.visible_to_collaborator),
    establishment: (r.establishment as string) ?? undefined,
    approvalStatus: (r.approval_status as DocumentRecord["approvalStatus"]) ?? undefined,
    ataId: (r.ata_id as string) ?? undefined,
    electionId: (r.election_id as string) ?? undefined,
    dossierParts: (r.dossier_parts as DossierParts) ?? undefined,
    dossierAttachments: (r.dossier_attachments as string[]) ?? undefined,
    previewDataUrl: (r.preview_data_url as string) ?? undefined,
    storagePath: (r.storage_path as string) ?? undefined,
    fileUrl: (r.file_url as string) ?? undefined,
    attachedPdfHtml: (r.attached_pdf_html as string) ?? undefined,
    attachedAt: (r.attached_at as string) ?? undefined,
    replacesRef: (r.replaces_ref as string) ?? undefined,
    replacesName: (r.replaces_name as string) ?? undefined,
    supersededByRef: (r.superseded_by_ref as string) ?? undefined,
    supersededAt: (r.superseded_at as string) ?? undefined,
    replacementReason: (r.replacement_reason as string) ?? undefined,
  };
}

function toRow(d: DocumentRecord, companyId: string): Record<string, unknown> {
  return {
    company_id: companyId,
    company_ref: companyRef,
    ref: d.id,
    name: d.name,
    type_id: d.typeId,
    type_name: d.typeName,
    scope: d.scope,
    collaborator_id: d.collaboratorId ?? null,
    collaborator_name: d.collaboratorName ?? null,
    collaborator_role: d.collaboratorRole ?? null,
    issued_at: d.issuedAt,
    expires_at: d.expiresAt,
    status: d.status,
    size: d.size,
    file_type: d.fileType,
    visible_to_collaborator: d.visibleToCollaborator,
    establishment: d.establishment ?? null,
    approval_status: d.approvalStatus ?? null,
    ata_id: d.ataId ?? null,
    election_id: d.electionId ?? null,
    dossier_parts: d.dossierParts ?? null,
    dossier_attachments: d.dossierAttachments ?? null,
    preview_data_url: d.previewDataUrl ?? null,
    storage_path: d.storagePath ?? null,
    file_url: d.fileUrl ?? null,
    attached_pdf_html: d.attachedPdfHtml ?? null,
    attached_at: d.attachedAt ?? null,
    replaces_ref: d.replacesRef ?? null,
    replaces_name: d.replacesName ?? null,
    superseded_by_ref: d.supersededByRef ?? null,
    superseded_at: d.supersededAt ?? null,
    replacement_reason: d.replacementReason ?? null,
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------ Empresa ----------------------------- */

/** Empresa da sessão pelo subdomínio — sem fallback para outra empresa. */
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

/* ------------------------------- Load ------------------------------- */

async function seedIfEmpty(companyId: string): Promise<void> {
  if (seeding) return;
  seeding = true;
  try {
    const rows = buildInitialDocuments().map((d) => toRow(d, companyId));
    if (rows.length) {
      await supabase.from("documents").upsert(rows, { onConflict: "company_ref,ref" });
    }
  } finally {
    seeding = false;
  }
}

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    let { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("company_ref", companyRef)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Lista vazia é "sem registros" — não injetamos documentos de demonstração.
    setState({
      documents: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar os documentos." });
  }
}

export async function loadDocuments(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

export function reloadDocuments(): Promise<void> {
  return loadDocuments();
}

export function subscribeDocuments(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadDocuments();
  return () => {
    listeners.delete(listener);
  };
}

export function getDocuments(): DocumentRecord[] {
  return state.documents;
}

export function getDocumentsStoreState(): DocumentsStoreState {
  return state;
}

/** Hook dos documentos da empresa (resolvendo a empresa pela sessão). */
export function useDocuments(): DocumentRecord[] {
  const { subdomain } = useAppSession();
  setDocumentsCompanyRef(subdomain);
  return useSyncExternalStore(subscribeDocuments, getDocuments, getDocuments);
}

/* -------------------------------- CRUD ------------------------------ */

async function persistDocuments(docs: DocumentRecord[]): Promise<void> {
  if (!docs.length) return;
  try {
    const companyId = await ensureCompanyId();
    const rows = docs.map((d) => toRow(d, companyId));
    const { error } = await supabase.from("documents").upsert(rows, { onConflict: "company_ref,ref" });
    if (error) throw error;
    await refresh();
  } catch {
    setState({ error: "Não foi possível salvar os documentos." });
  }
}

export function addDocument(doc: DocumentRecord): void {
  const exists = state.documents.some((d) => d.id === doc.id);
  setState({
    documents: exists ? state.documents.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...state.documents],
  });
  void persistDocuments([doc]);
}

export function addDocuments(docs: DocumentRecord[]): void {
  if (!docs.length) return;
  const incoming = new Set(docs.map((d) => d.id));
  setState({ documents: [...docs, ...state.documents.filter((d) => !incoming.has(d.id))] });
  void persistDocuments(docs);
}

/**
 * Registra um documento como SUBSTITUIÇÃO de outro já existente.
 *
 * O documento novo mantém todos os dados preenchidos no envio e passa a
 * apontar para o anterior (`replacesRef`). O anterior recebe
 * `supersededByRef` e passa a ser exibido como "Vencido", permanecendo
 * consultável no histórico (por colaborador, por unidade e nos filtros de
 * vencidos) sem gerar cobrança de renovação.
 */
export function replaceDocument(oldRef: string, newDoc: DocumentRecord): void {
  const current = state.documents.find((d) => d.id === oldRef);
  const supersededAt = new Date().toISOString();
  const replacement: DocumentRecord = {
    ...newDoc,
    replacesRef: oldRef,
    replacesName: current?.name || newDoc.replacesName,
  };
  const superseded: DocumentRecord | null = current
    ? {
        ...current,
        status: "Vencido",
        supersededByRef: replacement.id,
        supersededAt,
      }
    : null;

  setState({
    documents: [
      replacement,
      ...state.documents.map((d) => (d.id === oldRef && superseded ? superseded : d)).filter(
        (d) => d.id !== replacement.id
      ),
    ],
  });

  void persistDocuments(superseded ? [replacement, superseded] : [replacement]);
}

/** Remove um documento da empresa (exclusão de ficha/documento assinado). */
export function removeDocument(id: string): void {
  setState({ documents: state.documents.filter((d) => d.id !== id) });
  void (async () => {
    try {
      await ensureCompanyId();
      const { error } = await supabase.from("documents").delete().eq("company_ref", companyRef).eq("ref", id);
      if (error) throw error;
      await refresh();
    } catch {
      setState({ error: "Não foi possível remover o documento." });
    }
  })();
}

/* ------------------------------------------------------------------ */
/* Validade dos documentos                                             */
/* ------------------------------------------------------------------ */

/**
 * Define (ou altera) a validade de um documento já cadastrado. Recebe a data
 * em "dd/mm/aaaa"; string vazia marca o documento como permanente (sem
 * validade). A situação (Em dia / Vencendo / Vencido) é recalculada na hora.
 */
export function updateDocumentValidity(id: string, expiresAt: string): void {
  const current = state.documents.find((d) => d.id === id);
  if (!current) return;
  addDocument({ ...current, expiresAt: expiresAt || "", status: computeStatus(expiresAt) });
}

/* ------------------------------------------------------------------ */
/* Arquivos no Storage (bucket privado "documents")                     */
/* ------------------------------------------------------------------ */

const DOCUMENT_BUCKET = "documents";

function sanitizeStorageName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "arquivo"
  );
}

/** Envia um arquivo para o Storage privado e devolve o caminho salvo. */
export async function uploadDocumentFile(
  file: File,
  index = 0
): Promise<{ path: string; url: string | null } | null> {
  try {
    const path = `${companyRef}/${Date.now()}-${index}-${sanitizeStorageName(file.name)}`;
    const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const url = await signDocumentPath(path);
    return { path, url };
  } catch {
    setState({ error: "Não foi possível enviar o arquivo para o armazenamento." });
    return null;
  }
}

/** Gera um link assinado (temporário) para abrir/baixar um arquivo do Storage. */
export async function signDocumentPath(path: string, expiresIn = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Resolve a URL de visualização de um documento enviado ao Storage. */
export async function resolveDocumentUrl(doc: DocumentRecord): Promise<string | null> {
  if (doc.storagePath) return signDocumentPath(doc.storagePath);
  if (doc.fileUrl) return doc.fileUrl;
  return null;
}

/* ------------------------------------------------------------------ */
/* Geração de documento a partir de uma APR                             */
/* ------------------------------------------------------------------ */

function today(): string {
  return new Date().toLocaleDateString("pt-BR");
}

function addOneYear(dateStr: string): string {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "—";
  const [, day, month, year] = match;
  return `${day}/${month}/${Number(year) + 1}`;
}

/**
 * Converte uma APR concluída em um registro de documento da empresa,
 * vinculado ao tipo "APR" já existente no catálogo de documentos.
 */
export function buildAprDocument(record: AprRecord): DocumentRecord {
  return {
    id: `doc-apr-${record.id}`,
    name: `APR — ${record.title}`,
    typeId: "apr",
    typeName: "APR",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: addOneYear(record.date),
    status: "Em dia",
    size: `${240 + record.risks.length * 46 + record.signatures.length * 20} KB`,
    fileType: "pdf",
    visibleToCollaborator: false,
  };
}

/**
 * Converte uma Ficha de EPI assinada em um registro de documento do colaborador,
 * vinculado ao tipo "Ficha de EPI" já existente no catálogo de documentos.
 */
export function buildEpiDocument(delivery: EpiDelivery): DocumentRecord {
  const totalItems = delivery.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    id: `doc-epi-${delivery.id}`,
    name: `Ficha de EPI — ${delivery.collaboratorName}`,
    typeId: "ficha-epi",
    typeName: "Ficha de EPI",
    scope: "colaborador",
    collaboratorId: delivery.collaboratorId,
    collaboratorName: delivery.collaboratorName,
    collaboratorRole: delivery.collaboratorRole,
    issuedAt: today(),
    expiresAt: addOneYear(delivery.date),
    status: "Em dia",
    size: `${196 + totalItems * 24 + delivery.items.length * 18 + (delivery.photo ? 180 : 0)} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    establishment: delivery.establishment || undefined,
  };
}

/**
 * Converte uma ata da CIPA em um registro de documento da empresa, vinculado
 * ao tipo "Ata da CIPA" do catálogo. O id é determinístico para que regravar a
 * mesma ata atualize o registro (evitando duplicidades).
 *
 * A situação de aprovação acompanha as assinaturas: quando presidente e
 * secretário já assinaram, o registro fica "aprovada" e recebe anexado o PDF
 * gerado automaticamente; caso contrário fica "aguardando".
 */
export function buildAtaDocument(
  ata: CipaAta,
  cipaName = "—",
  cipaUnit = "",
  signatureImages: Record<string, string> = cachedAtaSignatureImages(ata)
): DocumentRecord {
  const approvedCount = ata.approvals.filter((a) => a.representationSnapshot || a.signedAt).length;
  const approved = isAtaFullyApproved(ata);
  return {
    id: `doc-ata-${ata.id}`,
    name: `Ata da CIPA — ${ata.title}`,
    typeId: "ata-cipa",
    typeName: "Ata da CIPA",
    scope: "empresa",
    issuedAt: ata.date || today(),
    // Ata é registro datado: não possui data de validade.
    expiresAt: "—",
    status: "Em dia",
    size: `${320 + ata.photos.length * 180 + approvedCount * 42} KB`,
    fileType: "pdf",
    visibleToCollaborator: false,
    ataId: ata.id,
    approvalStatus: approved ? "aprovada" : "aguardando",
    attachedPdfHtml: approved ? buildAtaPdfBody(ata, cipaName, cipaUnit, "", signatureImages) : undefined,
    attachedAt: approved ? new Date().toISOString() : undefined,
  };
}

/**
 * Converte um processo eleitoral da CIPA em um registro de documento da empresa,
 * vinculado ao tipo "Edital de Convocação da CIPA". O PDF do edital (prazo,
 * requisitos e regras de foto) já preenchido no painel da eleição é anexado
 * automaticamente. O id é determinístico para que regravar a mesma eleição
 * atualize o registro (evitando duplicidades).
 */
export function buildEditalDocument(election: CipaElection, cipaName = "—"): DocumentRecord {
  const candidatesCount = election.candidates.filter((c) => c.name.trim()).length;
  const st = candidacyState(election);
  return {
    id: `doc-edital-${election.id}`,
    name: `Edital de Convocação — ${election.title}`,
    typeId: "edital-cipa",
    typeName: "Edital de Convocação da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: st.end || "—",
    status: "Em dia",
    size: `${280 + candidatesCount * 26 + (election.registrationEnd ? 40 : 0)} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    attachedPdfHtml: buildEditalPdfBody(election, cipaName),
    attachedAt: new Date().toISOString(),
  };
}

/**
 * Converte um processo eleitoral da CIPA já apurado/publicado em um registro de
 * documento da empresa, vinculado ao tipo "Edital de Resultado da CIPA". O PDF
 * com a lista de eleitos (ordem de votação) é anexado automaticamente. O id é
 * determinístico para que a republicação atualize o registro (sem duplicar).
 */
export function buildResultadoDocument(election: CipaElection, cipaName = "—"): DocumentRecord {
  const ranked = election.candidates.filter((c) => c.name.trim());
  const elected = ranked.filter((c) => (Number(c.votes) || 0) > 0).length;
  return {
    id: `doc-resultado-${election.id}`,
    name: `Edital de Resultado — ${election.title}`,
    typeId: "edital-resultado-cipa",
    typeName: "Edital de Resultado da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${300 + ranked.length * 24 + elected * 18} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    attachedPdfHtml: buildResultadoEditalPdfBody(election, cipaName),
    attachedAt: new Date().toISOString(),
  };
}

/**
 * Converte um processo eleitoral concluído no Dossiê do Processo Eleitoral,
 * documento único que reúne o Edital de Convocação, a Ata da Comissão Eleitoral,
 * o Edital de Resultado e o Termo de Posse. O id é determinístico para que
 * regerar o dossiê atualize o registro (sem duplicar).
 */
export function buildDossierDocument(
  election: CipaElection,
  cipaName = "—",
  ata?: CipaAta,
  parts: DossierParts = defaultDossierParts,
  attachments: string[] = [],
  technical?: TechnicalSignatureInfo
): DocumentRecord {
  const inscribed = election.candidates.filter((c) => c.name.trim()).length;
  const elected = rankCandidates(election).filter((r) => r.seat === "titular" || r.seat === "suplente").length;
  const includedParts = [parts.convocacao, parts.ata && Boolean(ata), parts.resultado, parts.posse].filter(Boolean).length;
  const externalAttachments = attachments.map((name) => name.trim()).filter(Boolean);
  return {
    id: `doc-dossie-${election.id}`,
    name: `Dossiê do Processo Eleitoral — ${election.title}`,
    typeId: "dossie-cipa",
    typeName: "Dossiê do Processo Eleitoral da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${220 + includedParts * 160 + inscribed * 22 + elected * 20 + externalAttachments.length * 30} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    dossierParts: parts,
    dossierAttachments: externalAttachments,
    attachedPdfHtml: buildDossierPdfBody(election, cipaName, ata, parts, externalAttachments, "", "", technical),
    attachedAt: new Date().toISOString(),
  };
}

/**
 * Converte um arquivo externo anexado (ex.: edital assinado em papel) em um
 * documento da empresa vinculado ao processo eleitoral. O id é determinístico
 * por eleição + nome do arquivo, para que reanexar o mesmo arquivo atualize o
 * registro (sem duplicar).
 */
export function buildElectionAttachmentDocument(election: CipaElection, attachment: DossierAttachment): DocumentRecord {
  const fileName = attachment.name;
  const slug = fileName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return {
    id: `doc-anexo-${election.id}-${slug || "arquivo"}`,
    name: `Anexo externo — ${fileName}`,
    typeId: "anexo-eleicao-cipa",
    typeName: "Anexo do Processo Eleitoral da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: "—",
    fileType: fileTypeFromName(fileName),
    visibleToCollaborator: false,
    electionId: election.id,
    previewDataUrl: attachment.previewDataUrl,
  };
}

/**
 * Converte um processo eleitoral publicado no Termo de Posse dos eleitos,
 * documento próprio anexado em Documentos. Relaciona os empossados titulares e
 * suplentes com espaço para assinatura. O id é determinístico para que regravar
 * a mesma eleição atualize o registro (sem duplicar).
 */
export function buildPosseDocument(election: CipaElection, cipaName = "—"): DocumentRecord {
  const elected = rankCandidates(election).filter((r) => r.seat === "titular" || r.seat === "suplente").length;
  return {
    id: `doc-posse-${election.id}`,
    name: `Termo de Posse — ${election.title}`,
    typeId: "termo-posse-cipa",
    typeName: "Termo de Posse da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${260 + elected * 22} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    attachedPdfHtml: buildPossePdfBody(election, cipaName),
    attachedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Documentos do pleito (BU, ata final, comparecimento e fichas)        */
/* ------------------------------------------------------------------ */

/** Boletim de Urna (apuração completa) como documento da empresa. */
export function buildBuDocument(election: CipaElection, cipaName = "—", bu: BuData): DocumentRecord {
  return {
    id: `doc-bu-${election.id}`,
    name: `Boletim de Urna — ${election.title}`,
    typeId: "boletim-urna-cipa",
    typeName: "Boletim de Urna da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${360 + bu.ranking.length * 26} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    attachedPdfHtml: buildBuPdfBody(election, cipaName, bu),
    attachedAt: new Date().toISOString(),
  };
}

/** Ata de Resultado Final da eleição como documento da empresa. */
export function buildResultFinalAtaDocument(election: CipaElection, cipaName = "—", bu: BuData): DocumentRecord {
  return {
    id: `doc-ata-resultado-${election.id}`,
    name: `Ata de Resultado Final — ${election.title}`,
    typeId: "ata-resultado-cipa",
    typeName: "Ata de Resultado Final da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${340 + bu.ranking.length * 24} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    attachedPdfHtml: buildResultFinalAtaPdfBody(election, cipaName, bu),
    attachedAt: new Date().toISOString(),
  };
}

/** Relatório de comparecimento (habilitados × votantes × ausentes). */
export function buildAttendanceReportDocument(
  election: CipaElection,
  cipaName = "—",
  bu: BuData,
  absentees: string[]
): DocumentRecord {
  return {
    id: `doc-comparecimento-${election.id}`,
    name: `Relatório de comparecimento — ${election.title}`,
    typeId: "relatorio-comparecimento-cipa",
    typeName: "Relatório de Comparecimento do Pleito",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${280 + absentees.length * 12} KB`,
    fileType: "pdf",
    visibleToCollaborator: false,
    electionId: election.id,
    attachedPdfHtml: buildAttendanceReportPdfBody(election, cipaName, bu, absentees),
    attachedAt: new Date().toISOString(),
  };
}

/** Ficha de Cadastro de Candidato como documento da empresa. */
export function buildCandidateFichaDocument(
  election: CipaElection,
  candidate: ElectionCandidate,
  cipaName = "—"
): DocumentRecord {
  return {
    id: `doc-ficha-cand-${election.id}-${candidate.id}`,
    name: `Ficha de Candidato — ${candidate.name}`,
    typeId: "ficha-candidato-cipa",
    typeName: "Ficha de Cadastro de Candidato da CIPA",
    scope: "empresa",
    issuedAt: today(),
    expiresAt: "—",
    status: "Em dia",
    size: `${180 + (candidate.photoUrl ? 220 : 0)} KB`,
    fileType: "pdf",
    visibleToCollaborator: true,
    electionId: election.id,
    previewDataUrl: candidate.photoUrl,
    attachedPdfHtml: buildCandidateFichaPdfBody(candidate, election, cipaName),
    attachedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Seed dos documentos atuais (executado quando a tabela está vazia)    */
/* ------------------------------------------------------------------ */

function buildInitialDocuments(): DocumentRecord[] {
  const cipaNameOf = (id: string) => initialCipas.find((c) => c.id === id)?.name;
  const cipaUnitOf = (id: string) => initialCipas.find((c) => c.id === id)?.unit;
  return [
    ...initialAtas.map((ata) => buildAtaDocument(ata, cipaNameOf(ata.cipaId), cipaUnitOf(ata.cipaId))),
    ...initialElections
      .filter((election) => candidacyState(election).phase === "aberta")
      .map((election) => buildEditalDocument(election, cipaNameOf(election.cipaId))),
    ...initialElections
      .filter((election) => election.status === "Apurada" || election.status === "Publicada")
      .map((election) => buildResultadoDocument(election, cipaNameOf(election.cipaId))),
    ...initialElections
      .filter((election) => election.status === "Publicada")
      .map((election) => buildPosseDocument(election, cipaNameOf(election.cipaId))),
    ...initialElections
      .filter((election) => election.status === "Publicada")
      .map((election) => buildDossierDocument(election, cipaNameOf(election.cipaId), electionCommitteeAta(election, initialAtas))),
    ...initialDocuments,
  ];
}

/**
 * Devolve o HTML para impressão em lote de um documento. Para o Dossiê do
 * Processo Eleitoral, regenera o conteúdo a partir do processo e das atas
 * atuais, garantindo que a Ata da Comissão esteja sempre embutida e atualizada.
 * Para os demais documentos, devolve o PDF já anexado ao registro.
 */
export function batchPdfForDocument(doc: DocumentRecord): string | undefined {
  // Ata da CIPA: regenera a partir da ata atual e da unidade da comissão de
  // origem, garantindo a rastreabilidade por estabelecimento no lote mesmo em
  // registros salvos antes da unidade entrar no cabeçalho da ata.
  if (doc.typeId === "ata-cipa" && doc.ataId) {
    const ata = getAtas().find((a) => a.id === doc.ataId);
    if (ata) {
      const cipa = getCipas().find((c) => c.id === ata.cipaId);
      return buildAtaPdfBody(ata, cipa?.name || "—", cipa?.unit || "", "", cachedAtaSignatureImages(ata));
    }
  }
  if (doc.typeId !== "dossie-cipa" || !doc.electionId) return doc.attachedPdfHtml;
  const election = getElections().find((e) => e.id === doc.electionId);
  if (!election) return doc.attachedPdfHtml;
  const cipaName = getCipas().find((c) => c.id === election.cipaId)?.name || "—";
  return buildDossierPdfBody(election, cipaName, electionCommitteeAta(election, getAtas()), doc.dossierParts ?? defaultDossierParts, doc.dossierAttachments ?? []);
}