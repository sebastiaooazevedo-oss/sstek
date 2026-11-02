import { useSyncExternalStore } from "react";
import { zipSync } from "fflate";
import { supabase } from "@/lib/supabase";
import type { Collaborator } from "@/mocks/collaborators";
import type { DocumentRecord } from "@/mocks/documents";
import { getDocuments } from "@/pages/app/modules/documentos/documentsStore";
import { buildCollaboratorDossier } from "@/pages/app/modules/documentos/batchPdfBuilder";
import {
  buildBatchPlan,
  documentFileName,
  type BatchDocItem,
  type BatchTypeSelection,
} from "@/pages/app/modules/documentos/batchPrintTypes";

/**
 * Estado da Impressão em Lote.
 *
 * A seleção sobrevive à navegação (o usuário vai para a Conferência e pode
 * voltar para ajustar), mas os PDFs gerados permanecem apenas na sessão do
 * navegador. O banco guarda só o rastro auditável: quem gerou, quais
 * documentos/versões entraram e quando.
 */

export interface BatchConfig {
  collaboratorIds: string[];
  types: BatchTypeSelection[];
  /** Troca manual de versão: `${collaboratorId}:${typeId}` → documento. */
  versionChoice: Record<string, string>;
  /**
   * Incluir documentos sem arquivo digital (página de registro cadastral).
   * `false` exclui esses itens do PDF e informa a exclusão.
   */
  includeMissing: boolean;
}

export interface BatchResult {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  fileName: string;
  items: BatchDocItem[];
  pendencies: string[];
  pageCount: number;
  status: "gerado" | "falha";
  error?: string;
  bytes?: Uint8Array;
  url?: string;
  checked: boolean;
  selected: boolean;
}

interface BatchStoreState {
  config: BatchConfig | null;
  batchRef: string;
  results: BatchResult[];
  generating: boolean;
  progress: { current: number; total: number; collaborator: string } | null;
  generatedAt: string | null;
  actor: string;
  error: string | null;
  printQueue: string[];
  printNotice: string;
}

let state: BatchStoreState = {
  config: null,
  batchRef: "",
  results: [],
  generating: false,
  progress: null,
  generatedAt: null,
  actor: "",
  error: null,
  printQueue: [],
  printNotice: "",
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<BatchStoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function subscribeBatchPrint(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBatchPrintState(): BatchStoreState {
  return state;
}

export function useBatchPrintState(): BatchStoreState {
  return useSyncExternalStore(subscribeBatchPrint, getBatchPrintState, getBatchPrintState);
}

function toBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type });
}

function makeBatchRef(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LOTE-${stamp}-${rand}`;
}

export function setBatchConfig(config: BatchConfig | null): void {
  setState({ config });
}

export function getBatchPlanPreview(
  collaborator: Collaborator,
  documents: DocumentRecord[] = getDocuments()
): ReturnType<typeof buildBatchPlan> {
  const config = state.config;
  if (!config) {
    return buildBatchPlan(collaborator, [], documents, {});
  }
  return buildBatchPlan(collaborator, config.types, documents, config.versionChoice, {
    includeMissing: config.includeMissing !== false,
  });
}

function revokeResults(results: BatchResult[]): void {
  results.forEach((result) => {
    if (result.url) URL.revokeObjectURL(result.url);
  });
}

export function resetBatch(): void {
  revokeResults(state.results);
  setState({
    results: [],
    generatedAt: null,
    error: null,
    progress: null,
    printQueue: [],
    printNotice: "",
  });
}

/* ---------------------------- Auditoria ---------------------------- */

async function resolveCompanyId(subdomain: string): Promise<string | null> {
  if (!subdomain) return null;
  const { data, error } = await supabase.from("companies").select("id").eq("subdomain", subdomain).maybeSingle();
  if (error || !data) return null;
  return String(data.id);
}

async function persistAudit(
  results: BatchResult[],
  options: { subdomain: string; batchRef: string; actor: string; actorEmail: string; generatedAt: string }
): Promise<void> {
  if (!results.length) return;
  const companyId = await resolveCompanyId(options.subdomain);
  if (!companyId) return;

  const rows = results.map((result) => ({
    company_id: companyId,
    company_ref: options.subdomain,
    batch_ref: options.batchRef,
    collaborator_ref: result.collaboratorId,
    collaborator_name: result.collaboratorName,
    file_name: result.fileName,
    page_count: result.pageCount,
    status: result.status,
    items: result.items.map((item) => ({
      ref: item.documentId,
      name: item.name,
      type_id: item.typeId,
      type_name: item.typeName,
      version: item.versionLabel,
      issued_at: item.issuedAt,
      expires_at: item.expiresAt,
      source: item.source,
      pages: item.pages,
    })),
    pendencies: result.pendencies,
    generated_by_email: options.actorEmail || null,
    generated_by_name: options.actor || null,
    generated_at: options.generatedAt,
  }));

  try {
    await supabase
      .from("document_batch_prints")
      .upsert(rows, { onConflict: "company_ref,batch_ref,collaborator_ref" });
  } catch {
    // A geração do PDF não depende do rastro: falha silenciosa no log.
  }
}

/* ----------------------------- Geração ----------------------------- */

export async function generateBatch(options: {
  collaborators: Collaborator[];
  documents: DocumentRecord[];
  actor: string;
  actorEmail: string;
  subdomain: string;
}): Promise<boolean> {
  const config = state.config;
  if (!config || config.types.length === 0) {
    setState({ error: "Selecione ao menos um tipo de documento." });
    return false;
  }
  const targets = options.collaborators.filter((c) => config.collaboratorIds.includes(c.id));
  if (targets.length === 0) {
    setState({ error: "Selecione ao menos um colaborador." });
    return false;
  }

  const batchRef = state.batchRef || makeBatchRef();
  const generatedAt = new Date().toLocaleString("pt-BR");
  const actor = options.actor.trim() || options.actorEmail || "Usuário do sistema";

  // Resultados antigos dos mesmos colaboradores são descartados (e as URLs
  // temporárias revogadas) para não acumular cópias na memória.
  const previous = state.results.filter((r) => !targets.some((c) => c.id === r.collaboratorId));
  revokeResults(state.results.filter((r) => targets.some((c) => c.id === r.collaboratorId)));

  setState({
    generating: true,
    error: null,
    batchRef,
    actor,
    progress: { current: 0, total: targets.length, collaborator: "" },
    printQueue: [],
    printNotice: "",
  });

  const produced: BatchResult[] = [];

  for (let index = 0; index < targets.length; index += 1) {
    const collaborator = targets[index];
    setState({ progress: { current: index + 1, total: targets.length, collaborator: collaborator.name } });

    const plan = buildBatchPlan(collaborator, config.types, options.documents, config.versionChoice, {
      includeMissing: config.includeMissing !== false,
    });
    const fileName = documentFileName(collaborator);

    try {
      const dossier = await buildCollaboratorDossier({
        plan,
        collaborator,
        documents: options.documents,
        fileName,
        batchRef,
        actor,
        generatedAt,
      });
      const blob = toBlob(dossier.bytes, "application/pdf");
      const url = URL.createObjectURL(blob);
      produced.push({
        collaboratorId: collaborator.id,
        collaboratorName: collaborator.name,
        collaboratorRole: collaborator.role,
        fileName,
        items: dossier.items,
        pendencies: dossier.pendencies,
        pageCount: dossier.pageCount,
        status: "gerado",
        bytes: dossier.bytes,
        url,
        checked: false,
        selected: true,
      });
    } catch (error) {
      produced.push({
        collaboratorId: collaborator.id,
        collaboratorName: collaborator.name,
        collaboratorRole: collaborator.role,
        fileName,
        items: plan.items,
        pendencies: plan.pendencies,
        pageCount: 0,
        status: "falha",
        error:
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível gerar o dossiê deste colaborador.",
        checked: false,
        selected: false,
      });
    }

    setState({ results: [...previous, ...produced] });
  }

  setState({
    generating: false,
    progress: null,
    generatedAt,
    results: [...previous, ...produced],
  });

  void persistAudit(produced, {
    subdomain: options.subdomain,
    batchRef,
    actor,
    actorEmail: options.actorEmail,
    generatedAt: new Date().toISOString(),
  });

  return produced.length > 0;
}

/** Regera apenas um colaborador (após falha), mantendo o restante do lote. */
export async function retryCollaborator(options: {
  collaborator: Collaborator;
  documents: DocumentRecord[];
  actor: string;
  actorEmail: string;
  subdomain: string;
}): Promise<void> {
  const config = state.config;
  if (!config) return;
  const generatedAt = new Date().toLocaleString("pt-BR");
  const actor = state.actor || options.actor || options.actorEmail || "Usuário do sistema";
  const batchRef = state.batchRef || makeBatchRef();
  const plan = buildBatchPlan(options.collaborator, config.types, options.documents, config.versionChoice, {
    includeMissing: config.includeMissing !== false,
  });
  const fileName = documentFileName(options.collaborator);

  setState({ generating: true, error: null });
  let result: BatchResult;
  try {
    const dossier = await buildCollaboratorDossier({
      plan,
      collaborator: options.collaborator,
      documents: options.documents,
      fileName,
      batchRef,
      actor,
      generatedAt,
    });
    const blob = toBlob(dossier.bytes, "application/pdf");
    result = {
      collaboratorId: options.collaborator.id,
      collaboratorName: options.collaborator.name,
      collaboratorRole: options.collaborator.role,
      fileName,
      items: dossier.items,
      pendencies: dossier.pendencies,
      pageCount: dossier.pageCount,
      status: "gerado",
      bytes: dossier.bytes,
      url: URL.createObjectURL(blob),
      checked: false,
      selected: true,
    };
  } catch (error) {
    result = {
      collaboratorId: options.collaborator.id,
      collaboratorName: options.collaborator.name,
      collaboratorRole: options.collaborator.role,
      fileName,
      items: plan.items,
      pendencies: plan.pendencies,
      pageCount: 0,
      status: "falha",
      error: error instanceof Error && error.message ? error.message : "Não foi possível gerar novamente.",
      checked: false,
      selected: false,
    };
  }

  const previous = state.results.filter((r) => r.collaboratorId !== options.collaborator.id);
  revokeResults(state.results.filter((r) => r.collaboratorId === options.collaborator.id));
  setState({ results: [...previous, result], generating: false, batchRef, generatedAt });

  void persistAudit([result], {
    subdomain: options.subdomain,
    batchRef,
    actor,
    actorEmail: options.actorEmail,
    generatedAt: new Date().toISOString(),
  });
}

/* ---------------------------- Conferência --------------------------- */

export function toggleResultChecked(collaboratorId: string): void {
  setState({
    results: state.results.map((r) =>
      r.collaboratorId === collaboratorId ? { ...r, checked: !r.checked } : r
    ),
  });
}

export function toggleResultSelected(collaboratorId: string): void {
  setState({
    results: state.results.map((r) =>
      r.collaboratorId === collaboratorId ? { ...r, selected: !r.selected } : r
    ),
  });
}

export function setAllResultsSelected(selected: boolean): void {
  setState({
    results: state.results.map((r) => (r.status === "gerado" ? { ...r, selected } : r)),
  });
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadResult(collaboratorId: string): void {
  const result = state.results.find((r) => r.collaboratorId === collaboratorId);
  if (!result || !result.bytes) return;
  triggerDownload(toBlob(result.bytes, "application/pdf"), result.fileName);
}

export function downloadSelectedZip(): number {
  const selected = state.results.filter((r) => r.selected && r.status === "gerado" && r.bytes);
  if (selected.length === 0) return 0;
  const entries: Record<string, Uint8Array> = {};
  selected.forEach((result) => {
    if (result.bytes) entries[result.fileName] = result.bytes;
  });
  const zipped = zipSync(entries, { level: 0 });
  triggerDownload(
    toBlob(zipped, "application/zip"),
    `impressao-em-lote-${state.batchRef || "documentos"}.zip`
  );
  return selected.length;
}

/* ----------------------------- Impressão --------------------------- */

/**
 * Abre um PDF gerado para impressão. Nada é marcado como "impresso": o
 * navegador não informa se o diálogo de impressão foi concluído.
 */
export function openResultForPrint(collaboratorId: string): boolean {
  const result = state.results.find((r) => r.collaboratorId === collaboratorId);
  if (!result || !result.url) return false;
  // Blob do próprio app: abre em nova aba. `noopener` faria o navegador
  // devolver `null` mesmo com a janela aberta, por isso é aplicado depois.
  const win = window.open(result.url, "_blank");
  if (win) win.opener = null;
  return Boolean(win);
}

/**
 * Prepara a fila de impressão dos selecionados. Navegadores bloqueiam a
 * abertura de várias janelas de impressão em sequência, então a fila é aberta
 * um arquivo por vez, com ação explícita do usuário em cada um.
 */
export function startPrintQueue(): { opened: boolean; total: number } {
  const selected = state.results.filter((r) => r.selected && r.status === "gerado" && r.url);
  if (selected.length === 0) {
    setState({ printQueue: [], printNotice: "" });
    return { opened: false, total: 0 };
  }
  const [first, ...rest] = selected;
  const opened = openResultForPrint(first.collaboratorId);
  setState({
    printQueue: rest.map((r) => r.collaboratorId),
    printNotice: opened
      ? selected.length > 1
        ? "Abrimos o primeiro PDF. Os navegadores bloqueiam várias janelas de impressão ao mesmo tempo, então use “Abrir próximo” para seguir na ordem."
        : ""
      : "O navegador bloqueou a abertura do PDF. Libere pop-ups para este site e tente novamente.",
  });
  return { opened, total: selected.length };
}

export function printNextInQueue(): boolean {
  const [next, ...rest] = state.printQueue;
  if (!next) return false;
  const opened = openResultForPrint(next);
  setState({
    printQueue: rest,
    printNotice: opened
      ? rest.length > 0
        ? "PDF aberto. Se a janela de impressão não apareceu, use o ícone de impressão do visualizador."
        : ""
      : "O navegador bloqueou a abertura do PDF. Libere pop-ups para este site e tente novamente.",
  });
  return opened;
}

export function clearPrintNotice(): void {
  setState({ printNotice: "" });
}