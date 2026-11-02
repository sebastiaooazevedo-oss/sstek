import type { Collaborator } from "@/mocks/collaborators";
import type { DocumentRecord } from "@/mocks/documents";

/**
 * Regras da Impressão em Lote de documentos.
 *
 * Os arquivos NÃO são recriados aqui: esta camada apenas localiza, no cadastro
 * de cada colaborador, os documentos já existentes, escolhe a versão vigente
 * quando há mais de uma e informa o que está ausente antes de gerar. Nenhum
 * documento de outro colaborador entra no lote.
 */

/** De onde vem o conteúdo impresso de cada documento. */
export type BatchDocSource = "arquivo" | "imagem" | "cadastro" | "sem-arquivo";

export interface BatchTypeSelection {
  typeId: string;
  label: string;
}

export interface BatchDocItem {
  typeId: string;
  typeName: string;
  /** `ref` do documento no cadastro ou o marcador `cadastro`. */
  documentId: string;
  name: string;
  issuedAt: string;
  expiresAt: string;
  status: string;
  versionLabel: string;
  source: BatchDocSource;
  /** Páginas efetivamente impressas (preenchido na geração). */
  pages: number;
  note?: string;
}

export interface BatchCollaboratorPlan {
  collaboratorId: string;
  collaboratorName: string;
  collaboratorRole: string;
  establishment: string;
  matricula: string;
  /** Documentos que entram no dossiê, na ordem escolhida. */
  items: BatchDocItem[];
  /** Ausências e avisos informados ANTES de gerar (nunca omitidos). */
  pendencies: string[];
}

export interface BatchPlanOptions {
  /**
   * Incluir no PDF os documentos que existem no cadastro mas não têm arquivo
   * digital anexado (hoje eles entram como página de registro cadastral).
   * Com `false`, esses itens são excluídos do PDF e a exclusão é informada —
   * nunca omitida em silêncio.
   */
  includeMissing?: boolean;
}

/** Tipo gerado a partir do próprio cadastro (não depende de arquivo enviado). */
export const CADASTRO_TYPE_ID = "ficha-cadastro-colaborador";

/** Pacote sugerido para a conferência documental de um colaborador. */
export const suggestedBatchTypes: BatchTypeSelection[] = [
  { typeId: CADASTRO_TYPE_ID, label: "Ficha de Cadastro do Colaborador" },
  { typeId: "aso", label: "ASO" },
  { typeId: "ficha-epi", label: "Ficha de EPI" },
  { typeId: "cnh", label: "CNH — Carteira Nacional de Habilitação" },
];

function parseBrDate(value: string): number {
  const match = (value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 0;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

/** Documentos do tipo, dentro do colaborador, do mais recente para o mais antigo. */
export function candidateDocuments(
  collaboratorId: string,
  typeId: string,
  documents: DocumentRecord[]
): DocumentRecord[] {
  return documents
    .filter((d) => d.scope === "colaborador" && d.collaboratorId === collaboratorId && d.typeId === typeId)
    .sort((a, b) => parseBrDate(b.issuedAt) - parseBrDate(a.issuedAt));
}

/**
 * Sugere a versão vigente: entre as não vencidas, a de emissão mais recente.
 * Se todas estiverem vencidas, devolve a mais recente mesmo assim (com aviso).
 */
export function pickVigente(candidates: DocumentRecord[]): DocumentRecord | undefined {
  if (candidates.length === 0) return undefined;
  const valid = candidates.filter((d) => d.status !== "Vencido");
  return valid[0] ?? candidates[0];
}

export function versionLabelFor(doc: DocumentRecord, candidates: DocumentRecord[]): string {
  if (candidates.length <= 1) return "Versão única";
  const vigente = pickVigente(candidates);
  if (vigente && vigente.id === doc.id) return "Vigente";
  return `Versão de ${doc.issuedAt || "—"}`;
}

/** Fonte real do conteúdo do documento (arquivo enviado, imagem ou nenhum). */
export function sourceOf(doc: DocumentRecord): BatchDocSource {
  if (doc.storagePath || doc.fileUrl) return "arquivo";
  if (doc.previewDataUrl) return "imagem";
  return "sem-arquivo";
}

export function documentFileName(collaborator: Collaborator): string {
  const firstName = collaborator.name.trim().split(/\s+/).slice(0, 2).join("_");
  const slug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  const identifier = collaborator.matricula || collaborator.cpf.replace(/\D/g, "") || collaborator.id;
  return `${slug(firstName) || "Colaborador"}_${slug(identifier)}_Dossie.pdf`;
}

function cadastroItem(collaborator: Collaborator): BatchDocItem {
  return {
    typeId: CADASTRO_TYPE_ID,
    typeName: "Ficha de Cadastro do Colaborador",
    documentId: "cadastro",
    name: `Ficha de Cadastro — ${collaborator.name}`,
    issuedAt: collaborator.admissionDate || "—",
    expiresAt: "—",
    status: "Em dia",
    versionLabel: "Dados do cadastro",
    source: "cadastro",
    pages: 1,
  };
}

/**
 * Monta o plano de impressão de UM colaborador, na ordem escolhida.
 * `versionChoice` permite trocar manualmente a versão de um tipo
 * (chave `${collaboratorId}:${typeId}` → id do documento).
 */
export function buildBatchPlan(
  collaborator: Collaborator,
  selections: BatchTypeSelection[],
  documents: DocumentRecord[],
  versionChoice: Record<string, string> = {},
  options: BatchPlanOptions = {}
): BatchCollaboratorPlan {
  const includeMissing = options.includeMissing !== false;
  const items: BatchDocItem[] = [];
  const pendencies: string[] = [];

  selections.forEach((selection) => {
    const typeName = selection.label;

    if (selection.typeId === CADASTRO_TYPE_ID) {
      items.push(cadastroItem(collaborator));
      return;
    }

    const candidates = candidateDocuments(collaborator.id, selection.typeId, documents);
    if (candidates.length === 0) {
      pendencies.push(`${typeName}: não existe documento deste tipo no cadastro do colaborador.`);
      return;
    }

    const chosenId = versionChoice[`${collaborator.id}:${selection.typeId}`];
    const chosen = candidates.find((d) => d.id === chosenId) ?? pickVigente(candidates) ?? candidates[0];
    const source = sourceOf(chosen);

    // Exclusão explícita dos registros sem arquivo digital: o usuário pediu
    // para não gerar a página de registro cadastral. O item sai do PDF e a
    // ausência fica registrada como exclusão (nunca silenciosa).
    if (source === "sem-arquivo" && !includeMissing) {
      pendencies.push(
        `${typeName} (${chosen.name}): excluído do PDF — documento sem arquivo digital anexado (opção de exclusão ativa).`
      );
      return;
    }

    if (source === "sem-arquivo") {
      pendencies.push(
        `${typeName} (${chosen.name}): registro existe no cadastro, mas sem arquivo digital anexado — entra apenas a página de registro cadastral.`
      );
    }
    if (candidates.length > 1) {
      pendencies.push(
        `${typeName}: ${candidates.length} versões no cadastro; entrou a ${versionLabelFor(chosen, candidates).toLowerCase()} (${chosen.issuedAt}).`
      );
    }
    if (chosen.status === "Vencido") {
      pendencies.push(`${typeName}: a versão utilizada está vencida (${chosen.expiresAt}).`);
    }

    items.push({
      typeId: selection.typeId,
      typeName,
      documentId: chosen.id,
      name: chosen.name,
      issuedAt: chosen.issuedAt || "—",
      expiresAt: chosen.expiresAt || "—",
      status: chosen.status,
      versionLabel: versionLabelFor(chosen, candidates),
      source,
      pages: 1,
      note: source === "sem-arquivo" ? "Arquivo digital não anexado — página de registro cadastral" : undefined,
    });
  });

  return {
    collaboratorId: collaborator.id,
    collaboratorName: collaborator.name,
    collaboratorRole: collaborator.role,
    establishment: collaborator.establishment || "",
    matricula: collaborator.matricula || "",
    items,
    pendencies,
  };
}