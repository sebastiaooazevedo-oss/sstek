import { getSettings } from "@/pages/app/settings/settingsStore";
import {
  requestDocumentSeal,
  sealPrintHtml,
  sealUrlOf,
  type SealScope,
  type SealSigner,
} from "./authenticitySeal";

/**
 * Chancela de relatorios consolidados (relatorios mensais impressos pelo gestor).
 *
 * Diferente da ficha de EPI ou da lista de presenca do DDS, o relatorio nao tem
 * assinatura de colaborador: ele e um consolidado emitido pelo gestor. A chancela
 * entao registra QUEM emitiu, com QUE filtros e sobre QUAL conteudo — o hash e
 * calculado sobre os dados realmente impressos, entao qualquer alteracao (trocar
 * o periodo, incluir/remover linha, mudar unidade) muda o hash e invalida a
 * conferencia do papel antigo.
 *
 * Sem sessao/registro valido no servidor nao existe chancela: o relatorio ainda
 * e impresso, mas sem selo — nunca inventamos um selo local.
 */

export interface ReportSealInput {
  scope: SealScope;
  /** Referencia interna legivel e estavel do relatorio (tipo + periodo + filtros). */
  referenceRef: string;
  /** Titulo completo exibido na chancela e na pagina publica. */
  referenceLabel: string;
  /** Legenda do tipo documental no bloco (ex.: "Relatório mensal de EPI"). */
  caption: string;
  /** Nome do gestor que emitiu (sessao atual). */
  issuerName?: string;
  /** Conteudo canonico impresso — base do hash SHA-256. */
  content: unknown;
}

export interface ReportSealResult {
  /** Bloco de chancela em HTML (vazio quando o servidor nao registrou o selo). */
  html: string;
  /** Endereco publico completo de conferencia (vazio quando nao ha selo). */
  url: string;
  /** Codigo curto de verificacao (ex.: A1B2-C3D4-E5F6) — vazio sem selo. */
  code: string;
  /** Conteudo canonico hash usado no selo (vazio quando nao ha selo). */
  contentHash: string;
}

/** Chancela em HTML pronta para o rodape do relatorio impresso. */
export async function reportSealHtml(input: ReportSealInput): Promise<ReportSealResult> {
  const settings = getSettings();
  const issuer = (input.issuerName || "").trim();
  const responsible = settings.technicalResponsible.trim();
  const registration = settings.technicalRegistration.trim();

  const signers: SealSigner[] = [];
  if (issuer) {
    signers.push({ name: issuer, role: "Gestor emitente", signedAt: new Date().toISOString() });
  }
  if (responsible) {
    signers.push({
      name: responsible,
      role: registration || "Responsável técnico",
      signedAt: null,
    });
  }

  const seal = await requestDocumentSeal({
    scope: input.scope,
    referenceRef: input.referenceRef,
    referenceLabel: input.referenceLabel,
    signers,
    content: input.content,
  });

  if (!seal) return { html: "", url: "", code: "", contentHash: "" };

  return {
    html: sealPrintHtml(seal, {
      caption: input.caption,
      headline: "Relatório emitido eletronicamente",
      issuer: issuer || null,
    }),
    url: sealUrlOf(seal.token),
    code: seal.code,
    contentHash: seal.contentHash,
  };
}