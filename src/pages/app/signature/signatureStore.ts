import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { defaultSignatureFontId, type SignatureFontId } from "./signatureFonts";
import type { SignatureNameStyle } from "./signatureUtils";
import { callSignatureEngine } from "./signatureService";

/**
 * Assinatura pessoal do colaborador.
 * A representação visual pode ser desenhada (traço) ou tipográfica (modelo de
 * escrita). O estado atual é lido de `collaborator_signatures` (ponteiro) e o
 * histórico completo fica em `signature_representations` (versionado no servidor).
 * Toda gravação passa pela edge function `signature-engine` — o cliente não
 * escreve a assinatura diretamente.
 */
export type RepresentationKind = "draw" | "typographic";

export interface SignatureConfig {
  kind: RepresentationKind;
  fontModel: SignatureFontId;
  nameStyle: SignatureNameStyle;
  imageData: string | null;
  activated: boolean;
  termAcceptedAt: string | null;
  representationId: string | null;
  version: number;
}

export interface SignatureTerm {
  id: string;
  version: number;
  title: string;
  body: string;
}

export interface SignatureHistoryEntry {
  id: string;
  version: number;
  kind: RepresentationKind;
  fontModel: SignatureFontId;
  nameStyle: SignatureNameStyle;
  imageData: string | null;
  isActive: boolean;
  createdAt: string;
  supersededAt: string | null;
}

interface SignatureRow {
  collaborator_id: string;
  font_model: string | null;
  name_style: string | null;
  kind: string | null;
  image_data: string | null;
  activated: boolean | null;
  term_accepted_at: string | null;
  representation_id: string | null;
  version: number | null;
}

let configs: Record<string, SignatureConfig> = {};
let termsAccepted: Record<string, string | null> = {};
let activeTerm: SignatureTerm | null = null;
let loaded = false;
let loading = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

async function loadAll(): Promise<void> {
  if (loaded || loading) return;
  loading = true;
  try {
    const [sigRes, termRes] = await Promise.all([
      supabase
        .from("collaborator_signatures")
        .select(
          "collaborator_id, font_model, name_style, kind, image_data, activated, term_accepted_at, representation_id, version"
        ),
      supabase
        .from("signature_terms")
        .select("id, version, title, body")
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!sigRes.error && sigRes.data) {
      const next: Record<string, SignatureConfig> = {};
      const accepted: Record<string, string | null> = {};
      (sigRes.data as SignatureRow[]).forEach((row) => {
        const activated = row.activated === null ? true : row.activated;
        accepted[row.collaborator_id] = row.term_accepted_at ?? null;
        if (!activated) return;
        next[row.collaborator_id] = {
          kind: (row.kind as RepresentationKind) || "typographic",
          fontModel: (row.font_model as SignatureFontId) || defaultSignatureFontId,
          nameStyle: (row.name_style as SignatureNameStyle) || "full",
          imageData: row.image_data ?? null,
          activated: true,
          termAcceptedAt: row.term_accepted_at ?? null,
          representationId: row.representation_id ?? null,
          version: row.version ?? 1,
        };
      });
      configs = next;
      termsAccepted = accepted;
    }

    if (!termRes.error && termRes.data) activeTerm = termRes.data as SignatureTerm;
  } catch {
    /* mantém o cache em memória em caso de falha de rede */
  } finally {
    loaded = true;
    loading = false;
    emit();
  }
}

function refreshSignatures(): Promise<void> {
  loaded = false;
  loading = false;
  return loadAll();
}

export function subscribeSignatures(listener: () => void): () => void {
  listeners.add(listener);
  void loadAll();
  return () => {
    listeners.delete(listener);
  };
}

/** Garante que as assinaturas de perfil já foram carregadas (uso em PDFs). */
export async function preloadSignatures(): Promise<void> {
  await loadAll();
}

export function getSignatures(): Record<string, SignatureConfig> {
  return configs;
}

export function useSignatures(): Record<string, SignatureConfig> {
  return useSyncExternalStore(subscribeSignatures, getSignatures, getSignatures);
}

/** Assinatura ativa de um colaborador (ou null se ainda não criou). */
export function useCollaboratorSignature(collaboratorId: string | null | undefined): SignatureConfig | null {
  const all = useSignatures();
  if (!collaboratorId) return null;
  return all[collaboratorId] ?? null;
}

export function getCollaboratorSignature(collaboratorId: string): SignatureConfig | null {
  return configs[collaboratorId] ?? null;
}

/** Data/hora (servidor) em que o colaborador aceitou o termo vigente. */
export function useTermAcceptance(collaboratorId: string | null | undefined): string | null {
  const accepted = useSyncExternalStore(subscribeSignatures, () => termsAccepted, () => termsAccepted);
  if (!collaboratorId) return null;
  return accepted[collaboratorId] ?? null;
}

/** Termo de adesão vigente (carregado do servidor). */
export function useActiveTerm(): SignatureTerm | null {
  return useSyncExternalStore(subscribeSignatures, () => activeTerm, () => activeTerm);
}

/* ------------------------------------------------------------------ */
/* Ações (sempre validadas no backend)                                  */
/* ------------------------------------------------------------------ */

export interface SaveSignatureInput {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorEmail?: string | null;
  kind: RepresentationKind;
  fontModel: SignatureFontId;
  nameStyle: SignatureNameStyle;
  imageData: string;
  reauth?: { confirmed?: boolean; password?: string };
}

export async function saveSignature(input: SaveSignatureInput): Promise<void> {
  await callSignatureEngine(
    "save_representation",
    {
      collaboratorRef: input.collaboratorId,
      collaboratorName: input.collaboratorName,
      collaboratorEmail: input.collaboratorEmail ?? null,
    },
    {
      kind: input.kind,
      fontModel: input.fontModel,
      nameStyle: input.nameStyle,
      imageData: input.imageData,
      reauth: input.reauth ?? {},
    }
  );
  await refreshSignatures();
}

export async function acceptSignatureTerm(params: {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorEmail?: string | null;
}): Promise<void> {
  await callSignatureEngine(
    "accept_term",
    {
      collaboratorRef: params.collaboratorId,
      collaboratorName: params.collaboratorName,
      collaboratorEmail: params.collaboratorEmail ?? null,
    }
  );
  await refreshSignatures();
}

export async function removeSignature(params: {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorEmail?: string | null;
}): Promise<void> {
  await callSignatureEngine(
    "remove_representation",
    {
      collaboratorRef: params.collaboratorId,
      collaboratorName: params.collaboratorName,
      collaboratorEmail: params.collaboratorEmail ?? null,
    }
  );
  await refreshSignatures();
}

/** Histórico de representações (todas as versões, inclusive as substituídas). */
export function useSignatureHistory(collaboratorId: string | null | undefined): SignatureHistoryEntry[] {
  const [entries, setEntries] = useState<SignatureHistoryEntry[]>([]);

  useEffect(() => {
    if (!collaboratorId) {
      setEntries([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("signature_representations")
          .select(
            "id, version, kind, font_model, name_style, image_data, is_active, created_at, superseded_at, profiles!inner(collaborator_ref)"
          )
          .eq("profiles.collaborator_ref", collaboratorId)
          .order("version", { ascending: false });
        if (!active || error || !data) return;
        setEntries(
          (data as Record<string, unknown>[]).map((row) => ({
            id: String(row.id),
            version: Number(row.version ?? 1),
            kind: (row.kind as RepresentationKind) || "typographic",
            fontModel: (row.font_model as SignatureFontId) || defaultSignatureFontId,
            nameStyle: (row.name_style as SignatureNameStyle) || "full",
            imageData: (row.image_data as string) ?? null,
            isActive: Boolean(row.is_active),
            createdAt: String(row.created_at ?? ""),
            supersededAt: (row.superseded_at as string) ?? null,
          }))
        );
      } catch {
        /* sem histórico disponível */
      }
    })();
    return () => {
      active = false;
    };
  }, [collaboratorId]);

  return entries;
}