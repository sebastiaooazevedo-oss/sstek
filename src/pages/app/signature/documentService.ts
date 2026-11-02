import { callSignatureEngine, callSignatureEnginePublic, type SignatureActor } from "./signatureService";

/**
 * Fluxo de documentos assinaveis (Etapa 02).
 * Toda a regra (estados, congelamento de versao, hash, desafio de autenticacao
 * adicional, unicidade por empresa/documento/versao/signatario, idempotencia,
 * fechamento e substituicao) vive no backend (edge function + RPC transacional).
 * Aqui apenas enviamos a intencao e observamos o retorno.
 */

export type SignatureDocumentStatus =
  | "rascunho"
  | "aguardando"
  | "parcial"
  | "concluido"
  | "cancelado";

export type SignatureDeclarationType =
  | "epi_receipt"
  | "training_participation"
  | "content_acknowledgement";

export type SignatureDocType = "epi" | "dds" | "certificado" | "apr" | "outro";

export interface SignatureDocSignatory {
  id: string;
  collaboratorRef: string;
  name: string;
  roleLabel: string | null;
  email: string | null;
  positionPage: number;
  positionX: number;
  positionY: number;
  orderIndex: number;
  status: "pendente" | "assinado";
  signedAt: string | null;
}

export interface SignatureDocument {
  id: string;
  documentUid: string | null;
  docType: SignatureDocType;
  title: string;
  declarationType: SignatureDeclarationType;
  declarationText: string | null;
  content: Record<string, unknown>;
  contentHash: string | null;
  basePdfHash: string | null;
  finalPdfHash: string | null;
  evidenceReportHash: string | null;
  validationToken: string | null;
  requiredLevel: SignatureLevel;
  certificateRequired: boolean;
  status: SignatureDocumentStatus;
  version: number;
  dueAt: string | null;
  createdByRef: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  supersedesDocumentId: string | null;
  supersededByDocumentId: string | null;
  createdAt: string;
  signatories: SignatureDocSignatory[];
}

export const documentStatusLabels: Record<SignatureDocumentStatus, string> = {
  rascunho: "Rascunho",
  aguardando: "Aguardando assinaturas",
  parcial: "Parcialmente assinado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const documentTypeLabels: Record<SignatureDocType, string> = {
  epi: "Ficha de EPI",
  dds: "DDS",
  certificado: "Certificado",
  apr: "APR",
  outro: "Outro",
};

export interface DeclarationOption {
  id: SignatureDeclarationType;
  label: string;
  hint: string;
  text: string;
}

export const declarationOptions: DeclarationOption[] = [
  {
    id: "epi_receipt",
    label: "Recebimento de EPIs",
    hint: "Declaração de recebimento dos equipamentos listados",
    text: "Declaro que recebi os Equipamentos de Proteção Individual (EPIs) listados neste documento, em perfeito estado de conservação e funcionamento, e que fui orientado quanto ao uso, guarda e conservação, conforme a NR-06.",
  },
  {
    id: "training_participation",
    label: "Participação em treinamento",
    hint: "Declaração de participação no treinamento descrito",
    text: "Declaro que participei do treinamento descrito neste documento, compreendi o conteúdo ministrado e estou apto a aplicar as orientações recebidas no exercício das minhas atividades.",
  },
  {
    id: "content_acknowledgement",
    label: "Ciência do conteúdo",
    hint: "Declaração de ciência sobre o conteúdo do documento",
    text: "Declaro que li e compreendi integralmente o conteúdo deste documento e que estou ciente das informações, orientações e responsabilidades nele descritas.",
  },
];

export function declarationTextFor(type: SignatureDeclarationType): string {
  return declarationOptions.find((o) => o.id === type)?.text ?? "";
}

export function declarationLabelFor(type: SignatureDeclarationType): string {
  return declarationOptions.find((o) => o.id === type)?.label ?? "Ciência do conteúdo";
}

/* ------------------------------------------------------------------ */
/* Etapa 04: classificacao, politica e campos por categoria.            */
/* ------------------------------------------------------------------ */

/**
 * Classificacao legal da assinatura (Lei 14.063/2020 e MP 2.200-2/2001).
 * O metodo atual (representacao visual + codigo de uso unico) e, no maximo,
 * assinatura eletronica SIMPLES. "Avancada" e "qualificada" NAO sao atribuidas
 * automaticamente: exigem meio/certificado real e validacao no servidor.
 */
export type SignatureLevel = "simples" | "avancada" | "qualificada";

export const signatureLevelLabels: Record<SignatureLevel, string> = {
  simples: "Assinatura eletrônica simples",
  avancada: "Assinatura eletrônica avançada",
  qualificada: "Assinatura eletrônica qualificada (ICP-Brasil)",
};

export const signatureLevelShort: Record<SignatureLevel, string> = {
  simples: "Simples",
  avancada: "Avançada",
  qualificada: "Qualificada",
};

export const signerRoleLabels: Record<string, string> = {
  colaborador: "Colaborador",
  responsavel_tecnico: "Responsável técnico",
  instrutor: "Instrutor",
  facilitador: "Facilitador",
  executante: "Executante",
  gestor: "Gestor",
};

/** Campos minimos por categoria documental (EPI, treinamento, DDS, APR). */
export const categoryTemplates: Record<
  SignatureDocType,
  { label: string; fields: { label: string; value: string }[]; note: string }
> = {
  epi: {
    label: "Ficha de EPI",
    fields: [
      { label: "Trabalhador", value: "" },
      { label: "Empresa", value: "" },
      { label: "Equipamento", value: "" },
      { label: "Modelo", value: "" },
      { label: "CA", value: "" },
      { label: "Quantidade", value: "" },
      { label: "Data de entrega", value: "" },
      { label: "Responsável", value: "" },
    ],
    note: "Registra trabalhador, empresa, equipamento, modelo, CA, quantidade, data de entrega, responsável e a confirmação.",
  },
  dds: {
    label: "DDS",
    fields: [
      { label: "Assunto", value: "" },
      { label: "Conteúdo", value: "" },
      { label: "Data", value: "" },
      { label: "Responsável", value: "" },
      { label: "Participantes", value: "" },
    ],
    note: "O DDS NÃO substitui, por si só, treinamento obrigatório.",
  },
  certificado: {
    label: "Certificado de treinamento",
    fields: [
      { label: "Nome do trabalhador", value: "" },
      { label: "Conteúdo", value: "" },
      { label: "Carga horária", value: "" },
      { label: "Data", value: "" },
      { label: "Local", value: "" },
      { label: "Instrutor", value: "" },
      { label: "Qualificação do instrutor", value: "" },
      { label: "Responsável técnico", value: "" },
      { label: "NR aplicável", value: "" },
    ],
    note: "Observa a NR específica do treinamento (conteúdo, carga horária, instrutor e responsável técnico).",
  },
  apr: {
    label: "APR",
    fields: [
      { label: "Atividade", value: "" },
      { label: "Área", value: "" },
      { label: "Responsável", value: "" },
      { label: "Perigos", value: "" },
      { label: "Medidas de controle", value: "" },
    ],
    note: "Análise Preliminar de Risco com aceite dos executantes.",
  },
  outro: {
    label: "Outro documento",
    fields: [{ label: "Descrição", value: "" }],
    note: "Documento genérico de SST.",
  },
};

export interface DocumentSignatoryInput {
  collaboratorRef: string;
  name: string;
  role?: string | null;
  email?: string | null;
  positionPage?: number;
  positionX?: number;
  positionY?: number;
}

export interface CreateDocumentInput {
  docType: SignatureDocType;
  title: string;
  declarationType: SignatureDeclarationType;
  declarationText?: string | null;
  content?: Record<string, unknown>;
  dueAt?: string | null;
  signatories: DocumentSignatoryInput[];
}

export async function createDocument(
  actor: SignatureActor,
  input: CreateDocumentInput
): Promise<{ documentId: string }> {
  return callSignatureEngine<{ documentId: string }>("create_document", actor, { ...input });
}

export async function updateDocument(
  actor: SignatureActor,
  documentId: string,
  input: Partial<CreateDocumentInput>
): Promise<void> {
  await callSignatureEngine("update_document", actor, { documentId, ...input });
}

export async function submitDocument(actor: SignatureActor, documentId: string): Promise<void> {
  await callSignatureEngine("submit_document", actor, { documentId });
}

export interface IssuedChallenge {
  challengeId: string;
  expiresAt: string;
  maxAttempts: number;
  maskedContact: string;
  devCode?: string;
}

export async function issueChallenge(
  actor: SignatureActor,
  documentId: string
): Promise<IssuedChallenge> {
  return callSignatureEngine<IssuedChallenge>("issue_challenge", actor, { documentId });
}

export async function signDocumentWithChallenge(
  actor: SignatureActor,
  params: { documentId: string; challengeId: string; code: string }
): Promise<void> {
  await callSignatureEngine("doc_sign", actor, { ...params });
}

export async function reportDocumentDivergence(
  actor: SignatureActor,
  params: { documentId: string; message: string }
): Promise<void> {
  await callSignatureEngine("report_divergence", actor, { ...params });
}

export async function cancelDocument(
  actor: SignatureActor,
  params: { documentId: string; reason?: string }
): Promise<void> {
  await callSignatureEngine("cancel_document", actor, { ...params });
}

export async function substituteDocument(
  actor: SignatureActor,
  documentId: string
): Promise<{ documentId: string; version: number }> {
  return callSignatureEngine<{ documentId: string; version: number }>("substitute_document", actor, {
    documentId,
  });
}

/* ------------------------------------------------------------------ */
/* Etapa 03: identidade, validacao publica e evidencias autorizadas.     */
/* ------------------------------------------------------------------ */

export interface DocumentSignatureView {
  signatureUid: string | null;
  signerName: string | null;
  signedAt: string | null;
  timezoneDisplay: string | null;
  declarationType: SignatureDeclarationType | null;
  representationVersion: number | null;
  representationSnapshot: string | null;
  signatureLevel?: SignatureLevel | null;
}

export interface DocumentValidationResult {
  valid: boolean;
  found: boolean;
  reason?: string;
  vigente?: boolean;
  status?: SignatureDocumentStatus;
  documentUid?: string;
  title?: string;
  docType?: SignatureDocType;
  version?: number;
  requiredLevel?: SignatureLevel;
  certificateRequired?: boolean;
  companyName?: string | null;
  submittedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  basePdfHash?: string | null;
  finalPdfHash?: string | null;
  contentHash?: string | null;
  divergences?: string[];
  signatures?: DocumentSignatureView[];
  signatories?: { name: string; roleLabel: string | null; status: "pendente" | "assinado" }[];
}

export interface DocumentEvidenceSignature extends DocumentSignatureView {
  signatoryId: string | null;
  authMethod: string | null;
  authResult: string | null;
  signatureLevel?: SignatureLevel | null;
  certificateSubject?: string | null;
  certificateIssuer?: string | null;
  certificateSerial?: string | null;
  timestampReceiptId?: string | null;
  representationKind: string | null;
  signatureHash: string | null;
  contentHash: string | null;
  basePdfHash: string | null;
  evidence: Record<string, unknown> | null;
}

export interface DocumentEvidence {
  document: {
    id: string;
    documentUid: string | null;
    title: string;
    docType: SignatureDocType;
    version: number;
    status: SignatureDocumentStatus;
    requiredLevel?: SignatureLevel;
    certificateRequired?: boolean;
    declarationType: SignatureDeclarationType;
    declarationText: string | null;
    content: Record<string, unknown>;
    contentHash: string | null;
    basePdfHash: string | null;
    finalPdfHash: string | null;
    evidenceReportHash: string | null;
    validationToken: string | null;
    submittedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelledReason: string | null;
    supersedesDocumentId: string | null;
    supersededByDocumentId: string | null;
  };
  signatories: SignatureDocSignatory[];
  signatures: DocumentEvidenceSignature[];
  divergences: { id: string; message: string; createdAt: string; collaboratorRef: string | null }[];
}

/** Validacao publica por token aleatorio nao enumeravel (sem sessao). */
export async function validateDocument(token: string): Promise<DocumentValidationResult> {
  return callSignatureEnginePublic<DocumentValidationResult>("validate_document", { token });
}

/** Conteudo completo + evidencias pessoais (acesso autorizado). */
export async function getDocumentEvidence(
  actor: SignatureActor,
  documentId: string
): Promise<DocumentEvidence> {
  return callSignatureEngine<DocumentEvidence>("get_document_evidence", actor, { documentId });
}

/* ------------------------------------------------------------------ */
/* Etapa 04: governanca (politica por categoria/papel, retencao, TSA).  */
/* ------------------------------------------------------------------ */

export interface SignaturePolicyRow {
  id: string;
  company_id: string | null;
  doc_type: SignatureDocType;
  signer_role: string;
  required_level: SignatureLevel;
  requires_certificate: boolean;
  legal_fundamento: string | null;
  legal_references: string[] | null;
  policy_version: number;
  approved_by: string | null;
  approved_at: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface RetentionPolicyRow {
  id: string;
  company_id: string | null;
  doc_type: SignatureDocType;
  retention_years: number;
  backup_required: boolean;
  legal_basis: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface CertificateConfig {
  id?: string;
  company_id?: string;
  provider: string | null;
  enabled: boolean;
  validation_endpoint: string | null;
  notes: string | null;
}

export interface Governance {
  policies: SignaturePolicyRow[];
  retention: RetentionPolicyRow[];
  certificateConfig: CertificateConfig | null;
}

export interface TestResult {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface TestSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
}

export async function getGovernance(actor: SignatureActor): Promise<Governance> {
  const res = await callSignatureEngine<Partial<Governance>>("get_governance", actor, {});
  return {
    policies: res.policies ?? [],
    retention: res.retention ?? [],
    certificateConfig: res.certificateConfig ?? null,
  };
}

export interface UpsertPolicyInput {
  docType: SignatureDocType;
  signerRole: string;
  requiredLevel: SignatureLevel;
  requiresCertificate: boolean;
  legalFundamento: string;
  legalReferences: string[];
  approvedBy?: string;
  notes?: string;
}

export async function upsertPolicy(actor: SignatureActor, input: UpsertPolicyInput): Promise<void> {
  await callSignatureEngine("upsert_policy", actor, { ...input });
}

export interface UpsertRetentionInput {
  docType: SignatureDocType;
  retentionYears: number;
  backupRequired: boolean;
  legalBasis: string;
  notes?: string;
}

export async function upsertRetention(actor: SignatureActor, input: UpsertRetentionInput): Promise<void> {
  await callSignatureEngine("upsert_retention", actor, { ...input });
}

export interface CertificateConfigInput {
  provider: string;
  enabled: boolean;
  validationEndpoint: string;
  notes?: string;
}

export async function setCertificateConfig(
  actor: SignatureActor,
  input: CertificateConfigInput
): Promise<void> {
  await callSignatureEngine("set_certificate_config", actor, { ...input });
}

export async function runSignatureTests(
  actor: SignatureActor
): Promise<{ summary: TestSummary; tests: TestResult[] }> {
  const res = await callSignatureEngine<{ summary: TestSummary; tests: TestResult[] }>(
    "run_test_suite",
    actor,
    {}
  );
  return { summary: res.summary, tests: res.tests ?? [] };
}