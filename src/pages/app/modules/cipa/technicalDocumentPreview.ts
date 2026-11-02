import { getAtas, getCipas, getElections, getInspections } from "@/pages/app/modules/cipa/cipaStore";
import { buildCipaFichaPdfBody } from "@/pages/app/modules/cipa/cipaPdf";
import { buildInspectionPdfBody } from "@/pages/app/modules/cipa/inspectionPdf";
import { buildDossierPdfBody, defaultDossierParts } from "@/pages/app/modules/cipa/editalPdf";
import { electionCommitteeAta } from "@/pages/app/modules/cipa/cipaUtils";
import {
  technicalSignatureInfo,
  type TechnicalSignatureScope,
} from "@/pages/app/modules/cipa/technicalSignatureStore";

export interface TechnicalDocumentPreview {
  /** Título do documento (usado no cabeçalho da prévia). */
  title: string;
  /** Corpo HTML no mesmo layout do PDF emitido. */
  bodyHtml: string;
  /** Rótulo do tipo de documento. */
  kindLabel: string;
  /** Resumo curto do contexto (comissão, unidade, data). */
  context: string;
}

function findCipa(cipaId: string) {
  return getCipas().find((c) => c.id === cipaId) ?? null;
}

/**
 * Monta a pré-visualização do documento técnico pendente de assinatura do RT.
 *
 * Usa exatamente os mesmos geradores da emissão definitiva (ficha, inspeção e
 * dossiê), inclusive com a assinatura já registrada quando ela existir. Assim
 * o RT confere o conteúdo real antes de assinar e não existe divergência entre
 * o que ele viu e o que será emitido.
 */
export function buildTechnicalDocumentPreview(
  scope: TechnicalSignatureScope,
  referenceRef: string
): TechnicalDocumentPreview | null {
  if (scope === "ficha-cipa") {
    const cipa = findCipa(referenceRef);
    if (!cipa) return null;
    return {
      title: `Ficha de Cadastro da CIPA — ${cipa.name}`,
      bodyHtml: buildCipaFichaPdfBody(cipa, technicalSignatureInfo(scope, referenceRef) ?? undefined),
      kindLabel: "Ficha de Cadastro da CIPA",
      context: `${cipa.unit || cipa.name} · Mandato ${cipa.mandateNumber || "—"}`,
    };
  }

  if (scope === "inspecao-cipa") {
    const inspection = getInspections().find((i) => i.id === referenceRef);
    if (!inspection) return null;
    const cipaName = findCipa(inspection.cipaId)?.name || "CIPA";
    return {
      title: `Inspeção da CIPA — ${inspection.title}`,
      bodyHtml: buildInspectionPdfBody(
        inspection,
        cipaName,
        technicalSignatureInfo(scope, referenceRef) ?? undefined
      ),
      kindLabel: "Inspeção da CIPA",
      context: `${cipaName}${inspection.area ? ` · ${inspection.area}` : ""} · ${inspection.date}`,
    };
  }

  if (scope === "dossie-eleicao") {
    const election = getElections().find((e) => e.id === referenceRef);
    if (!election) return null;
    const cipaName = findCipa(election.cipaId)?.name || "CIPA";
    const ata = electionCommitteeAta(election, getAtas());
    return {
      title: `Dossiê do Processo Eleitoral — ${election.title}`,
      bodyHtml: buildDossierPdfBody(
        election,
        cipaName,
        ata,
        defaultDossierParts,
        [],
        "",
        "",
        technicalSignatureInfo(scope, referenceRef) ?? undefined
      ),
      kindLabel: "Dossiê do Processo Eleitoral",
      context: `${cipaName} · Processo ${election.processNumber || "—"} · Ano ${election.year || "—"}`,
    };
  }

  return null;
}