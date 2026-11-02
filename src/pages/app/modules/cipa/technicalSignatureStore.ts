import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { TechnicalSignatureInfo } from "@/pages/app/utils/exportPdf";

/**
 * Assinaturas eletrônicas do Responsável Técnico (RT) nos documentos técnicos
 * da CIPA — Ficha de Cadastro, inspeções e dossiê do processo eleitoral.
 *
 * A ata continua assinada pelo fluxo de aprovação (aprovações da ata). Esta
 * tabela cobre os demais documentos e funciona como um "carimbo" único por
 * documento: enquanto o RT não assina, a exportação definitiva fica bloqueada.
 */

export type TechnicalSignatureScope = "ata-cipa" | "ficha-cipa" | "inspecao-cipa" | "dossie-eleicao";

export interface TechnicalSignature {
  id: string;
  scope: TechnicalSignatureScope;
  referenceRef: string;
  referenceLabel: string;
  signerName: string;
  signerCollaboratorRef: string | null;
  signatureUid: string;
  signatureImage: string | null;
  signedAt: string;
}

interface TechnicalSignatureState {
  signatures: TechnicalSignature[];
  companyId: string | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: TechnicalSignatureState = {
  signatures: [],
  companyId: null,
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<TechnicalSignatureState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setTechnicalSignatureCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false, companyId: null, signatures: [] };
  void loadTechnicalSignatures();
}

function mapRow(r: Record<string, unknown>): TechnicalSignature {
  return {
    id: String(r.id),
    scope: (r.scope as TechnicalSignatureScope) ?? "ficha-cipa",
    referenceRef: (r.reference_ref as string) ?? "",
    referenceLabel: (r.reference_label as string) ?? "",
    signerName: (r.signer_name as string) ?? "",
    signerCollaboratorRef: (r.signer_collaborator_ref as string) || null,
    signatureUid: (r.signature_uid as string) ?? "",
    signatureImage: (r.signature_image as string) || null,
    signedAt: (r.signed_at as string) ?? new Date().toISOString(),
  };
}

async function resolveCompanyId(ref: string): Promise<string> {
  if (!ref) throw new Error("company not resolved");
  const { data, error } = await supabase.from("companies").select("id").eq("subdomain", ref).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("company not resolved");
  return String(data.id);
}

async function refresh(): Promise<void> {
  try {
    const companyId = state.companyId || (await resolveCompanyId(companyRef));
    const { data, error } = await supabase
      .from("cipa_technical_signatures")
      .select("*")
      .eq("company_ref", companyRef)
      .order("signed_at", { ascending: false });
    if (error) throw error;
    setState({
      signatures: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      companyId,
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar as assinaturas técnicas." });
  }
}

export async function loadTechnicalSignatures(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  await refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadTechnicalSignatures();
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): TechnicalSignature[] {
  return state.signatures;
}

export function useTechnicalSignatures(): TechnicalSignature[] {
  const { subdomain } = useAppSession();
  setTechnicalSignatureCompanyRef(subdomain);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getTechnicalSignatures(): TechnicalSignature[] {
  return state.signatures;
}

/** Assinatura do RT para um documento (escopo + referência). */
export function getTechnicalSignature(
  scope: TechnicalSignatureScope,
  referenceRef: string
): TechnicalSignature | null {
  return (
    state.signatures.find((signature) => signature.scope === scope && signature.referenceRef === referenceRef) ??
    null
  );
}

/**
 * Informações da assinatura prontas para o rodapé dos PDFs. Devolve null
 * quando o documento ainda não foi assinado pelo RT.
 */
export function technicalSignatureInfo(
  scope: TechnicalSignatureScope,
  referenceRef: string
): TechnicalSignatureInfo | null {
  const signature = getTechnicalSignature(scope, referenceRef);
  if (!signature) return null;
  return {
    name: signature.signerName,
    image: signature.signatureImage,
    signedAt: signature.signedAt,
    signatureUid: signature.signatureUid,
  };
}

async function ensureCompanyId(): Promise<string> {
  if (state.companyId) return state.companyId;
  const companyId = await resolveCompanyId(companyRef);
  setState({ companyId });
  return companyId;
}

export interface SignTechnicalDocumentInput {
  scope: TechnicalSignatureScope;
  referenceRef: string;
  referenceLabel: string;
  signerName: string;
  signerCollaboratorRef?: string | null;
  signatureUid: string;
  signatureImage?: string | null;
}

/** Registra (ou atualiza) a assinatura do RT em um documento técnico. */
export async function signTechnicalDocument(
  input: SignTechnicalDocumentInput
): Promise<TechnicalSignature | null> {
  try {
    const companyId = await ensureCompanyId();
    const row = {
      company_id: companyId,
      company_ref: companyRef,
      scope: input.scope,
      reference_ref: input.referenceRef,
      reference_label: input.referenceLabel,
      signer_name: input.signerName,
      signer_collaborator_ref: input.signerCollaboratorRef || null,
      signature_uid: input.signatureUid,
      signature_image: input.signatureImage || null,
      signed_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("cipa_technical_signatures")
      .upsert(row, { onConflict: "company_ref,scope,reference_ref" });
    if (error) throw error;
    await refresh();
    return getTechnicalSignature(input.scope, input.referenceRef);
  } catch {
    setState({ error: "Não foi possível registrar a assinatura do Responsável Técnico." });
    return null;
  }
}