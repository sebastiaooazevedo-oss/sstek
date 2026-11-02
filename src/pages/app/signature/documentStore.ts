import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import type { SignatureActor } from "./signatureService";
import {
  cancelDocument,
  createDocument,
  issueChallenge,
  reportDocumentDivergence,
  signDocumentWithChallenge,
  submitDocument,
  substituteDocument,
  updateDocument,
  type CreateDocumentInput,
  type SignatureDocument,
  type SignatureDocSignatory,
  type SignatureDocumentStatus,
} from "./documentService";

/**
 * Store compartilhado dos documentos assinaveis.
 * Le `signature_documents` + `signature_document_signatories` (somente leitura
 * pelo cliente) e expoe hooks. Toda escrita passa pelo motor no backend.
 */

let documents: SignatureDocument[] = [];
let loaded = false;
let loading = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function mapSignatory(row: Record<string, unknown>): SignatureDocSignatory {
  return {
    id: String(row.id),
    collaboratorRef: String(row.collaborator_ref ?? ""),
    name: String(row.name ?? ""),
    roleLabel: (row.role_label as string) ?? null,
    email: (row.email as string) ?? null,
    positionPage: Number(row.position_page ?? 1),
    positionX: Number(row.position_x ?? 50),
    positionY: Number(row.position_y ?? 50),
    orderIndex: Number(row.order_index ?? 0),
    status: row.status === "assinado" ? "assinado" : "pendente",
    signedAt: (row.signed_at as string) ?? null,
  };
}

function mapDocument(row: Record<string, unknown>, signatories: SignatureDocSignatory[]): SignatureDocument {
  return {
    id: String(row.id),
    documentUid: (row.document_uid as string) ?? null,
    docType: (row.doc_type as SignatureDocument["docType"]) ?? "outro",
    title: String(row.title ?? "Documento"),
    declarationType: row.declaration_type as SignatureDocument["declarationType"],
    declarationText: (row.declaration_text as string) ?? null,
    content: (row.content as Record<string, unknown>) ?? {},
    contentHash: (row.content_hash as string) ?? null,
    basePdfHash: (row.base_pdf_hash as string) ?? null,
    finalPdfHash: (row.final_pdf_hash as string) ?? null,
    evidenceReportHash: (row.evidence_report_hash as string) ?? null,
    validationToken: (row.validation_token as string) ?? null,
    requiredLevel: (row.required_level as SignatureDocument["requiredLevel"]) ?? "simples",
    certificateRequired: Boolean(row.certificate_required),
    status: (row.status as SignatureDocumentStatus) ?? "rascunho",
    version: Number(row.version ?? 1),
    dueAt: (row.due_at as string) ?? null,
    createdByRef: (row.created_by_ref as string) ?? null,
    submittedAt: (row.submitted_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    cancelledReason: (row.cancelled_reason as string) ?? null,
    supersedesDocumentId: (row.supersedes_document_id as string) ?? null,
    supersededByDocumentId: (row.superseded_by_document_id as string) ?? null,
    createdAt: String(row.created_at ?? ""),
    signatories,
  };
}

async function loadAll(): Promise<void> {
  if (loaded || loading) return;
  loading = true;
  try {
    const [docsRes, sigRes] = await Promise.all([
      supabase
        .from("signature_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("signature_document_signatories").select("*").order("order_index", { ascending: true }),
    ]);

    if (docsRes.error) throw docsRes.error;

    const byDoc = new Map<string, SignatureDocSignatory[]>();
    if (!sigRes.error && sigRes.data) {
      (sigRes.data as Record<string, unknown>[]).forEach((row) => {
        const docId = String(row.document_id);
        const list = byDoc.get(docId) ?? [];
        list.push(mapSignatory(row));
        byDoc.set(docId, list);
      });
    }

    documents = ((docsRes.data as Record<string, unknown>[]) ?? []).map((row) =>
      mapDocument(row, byDoc.get(String(row.id)) ?? [])
    );
  } catch {
    /* mantem cache em memoria em caso de falha de rede */
  } finally {
    loaded = true;
    loading = false;
    emit();
  }
}

async function refresh(): Promise<void> {
  loaded = false;
  loading = false;
  await loadAll();
}

export function subscribeDocumentsFlow(listener: () => void): () => void {
  listeners.add(listener);
  void loadAll();
  return () => {
    listeners.delete(listener);
  };
}

export function getSignatureDocuments(): SignatureDocument[] {
  return documents;
}

export function useSignatureDocuments(): SignatureDocument[] {
  return useSyncExternalStore(subscribeDocumentsFlow, getSignatureDocuments, getSignatureDocuments);
}

/** Referência estavel do usuario atual na base (colaborador ou criador admin). */
export function resolveActorRef(sessionName: string, sessionEmail: string): string {
  const match = collaborators.find((c) => c.name === sessionName);
  if (match) return match.id;
  return `usr-${sessionEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

/** Monta o ator para as chamadas ao motor a partir da sessao atual. */
export function useSignatureActor(): SignatureActor & { isCollaborator: boolean } {
  const session = useAppSession();
  return useMemo(() => {
    const match = collaborators.find((c) => c.name === session.name);
    return {
      collaboratorRef: resolveActorRef(session.name, session.email),
      collaboratorName: session.name,
      collaboratorEmail: session.email,
      subdomain: session.subdomain,
      isCollaborator: Boolean(match),
    };
  }, [session.name, session.email, session.subdomain]);
}

/** Documentos em que a referencia informada ainda precisa assinar. */
export function usePendingDocuments(ref: string | null | undefined): SignatureDocument[] {
  const docs = useSignatureDocuments();
  return useMemo(() => {
    if (!ref) return [];
    return docs.filter(
      (d) =>
        (d.status === "aguardando" || d.status === "parcial") &&
        d.signatories.some((s) => s.collaboratorRef === ref && s.status === "pendente")
    );
  }, [docs, ref]);
}

/* ------------------------------------------------------------------ */
/* Acoes (sempre validadas no backend)                                  */
/* ------------------------------------------------------------------ */

export async function createDocumentAction(actor: SignatureActor, input: CreateDocumentInput): Promise<string> {
  const res = await createDocument(actor, input);
  await refresh();
  return res.documentId;
}

export async function updateDocumentAction(
  actor: SignatureActor,
  documentId: string,
  input: Partial<CreateDocumentInput>
): Promise<void> {
  await updateDocument(actor, documentId, input);
  await refresh();
}

export async function submitDocumentAction(actor: SignatureActor, documentId: string): Promise<void> {
  await submitDocument(actor, documentId);
  await refresh();
}

export async function issueChallengeAction(actor: SignatureActor, documentId: string) {
  return issueChallenge(actor, documentId);
}

export async function signDocumentAction(
  actor: SignatureActor,
  params: { documentId: string; challengeId: string; code: string }
): Promise<void> {
  await signDocumentWithChallenge(actor, params);
  await refresh();
}

export async function reportDivergenceAction(
  actor: SignatureActor,
  params: { documentId: string; message: string }
): Promise<void> {
  await reportDocumentDivergence(actor, params);
}

export async function cancelDocumentAction(
  actor: SignatureActor,
  params: { documentId: string; reason?: string }
): Promise<void> {
  await cancelDocument(actor, params);
  await refresh();
}

export async function substituteDocumentAction(
  actor: SignatureActor,
  documentId: string
): Promise<string> {
  const res = await substituteDocument(actor, documentId);
  await refresh();
  return res.documentId;
}

export function useSignatureDocumentActions(): boolean {
  return useSyncExternalStore(subscribeDocumentsFlow, () => loaded, () => loaded);
}

/* ------------------------------------------------------------------ */
/* Assinaturas registradas de um documento (para conferencia/previa)    */
/* ------------------------------------------------------------------ */

export interface DocumentSignatureRow {
  signatoryId: string | null;
  signatureUid: string | null;
  signerName: string | null;
  signatureHash: string;
  signedAt: string;
  timezoneDisplay: string | null;
  representationSnapshot: string | null;
  representationKind: string | null;
  declarationType: string | null;
  basePdfHash: string | null;
  signatureLevel: string | null;
}

export function useDocumentSignatures(documentId: string | null): DocumentSignatureRow[] {
  const [rows, setRows] = useState<DocumentSignatureRow[]>([]);
  const docs = useSignatureDocuments();

  useEffect(() => {
    if (!documentId) {
      setRows([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("document_signatures")
          .select("signatory_id, signature_uid, signer_name, signature_hash, signed_at, timezone_display, representation_snapshot, representation_kind, declaration_type, base_pdf_hash, signature_level")
          .eq("document_id", documentId)
          .order("signed_at", { ascending: true });
        if (!active || error || !data) return;
        setRows(
          (data as Record<string, unknown>[]).map((row) => ({
            signatoryId: (row.signatory_id as string) ?? null,
            signatureUid: (row.signature_uid as string) ?? null,
            signerName: (row.signer_name as string) ?? null,
            signatureHash: String(row.signature_hash ?? ""),
            signedAt: String(row.signed_at ?? ""),
            timezoneDisplay: (row.timezone_display as string) ?? null,
            representationSnapshot: (row.representation_snapshot as string) ?? null,
            representationKind: (row.representation_kind as string) ?? null,
            declarationType: (row.declaration_type as string) ?? null,
            basePdfHash: (row.base_pdf_hash as string) ?? null,
            signatureLevel: (row.signature_level as string) ?? null,
          }))
        );
      } catch {
        /* sem assinaturas legiveis */
      }
    })();
    return () => {
      active = false;
    };
  }, [documentId, docs]);

  return rows;
}