import { escapeHtml } from "@/pages/app/utils/exportPdf";
import { callSignatureEnginePublic } from "./signatureService";
import { buildValidationUrl, validationQrDataUrl } from "./validationQr";

/**
 * Chancela de autenticidade (QR-Code no rodape).
 *
 * Todo documento que recebeu assinatura eletronica carrega um rodape com
 * QR-Code, codigo de verificacao e hash do conteudo. O QR aponta para a
 * validacao publica real (`/validar/:token`), onde o servidor confirma o
 * registro. O token e aleatorio e nao enumeravel.
 *
 * O selo e criado (ou reaproveitado) no servidor a partir do hash do conteudo:
 * o mesmo conteudo sempre devolve o mesmo selo, e nenhum conteudo diferente
 * pode se apresentar como o documento original.
 */

export type SealScope =
  | "assinatura"
  | "epi"
  | "dds"
  | "apr"
  | "cipa"
  | "presenca"
  | "documento"
  | "outro";

export const sealScopeLabels: Record<SealScope, string> = {
  assinatura: "Documento assinável",
  epi: "EPI",
  dds: "DDS",
  apr: "Análise Preliminar de Risco",
  cipa: "Documento da CIPA",
  presenca: "Ficha de Presença",
  documento: "Documento",
  outro: "Documento",
};

export interface SealSigner {
  name: string;
  role?: string | null;
  signedAt?: string | null;
}

/** Dados exibidos na chancela (tela e PDF). */
export interface SealDisplay {
  token: string;
  label: string;
  scope?: SealScope;
  signerCount?: number;
  sealedAt?: string | null;
  contentHash?: string | null;
  companyName?: string | null;
}

export interface DocumentSeal extends SealDisplay {
  token: string;
  code: string;
  url: string;
  contentHash: string;
  signerCount: number;
  sealedAt: string;
}

export interface RequestSealInput {
  scope: SealScope;
  referenceRef: string;
  referenceLabel: string;
  signers: SealSigner[];
  /** Conteudo canonico do documento (objeto) usado para o hash. */
  content: unknown;
}

/* ------------------------------------------------------------------ */
/* Contexto de empresa (subdominio) para o selo                        */
/* ------------------------------------------------------------------ */

let sealSubdomain = "";

export function setSealSubdomain(value: string): void {
  sealSubdomain = value || "";
}

export function getSealSubdomain(): string {
  return sealSubdomain;
}

/* ------------------------------------------------------------------ */
/* Hash e codigo de verificacao                                        */
/* ------------------------------------------------------------------ */

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}

/** SHA-256 (hex) do conteudo canonico — calculado no navegador. */
export async function hashSealContent(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Codigo curto legivel para conferencia manual (ex.: A1B2-C3D4-E5F6). */
export function sealCodeOf(token: string | null | undefined): string {
  const raw = String(token ?? "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 12);
  if (!raw) return "—";
  return raw.replace(/(.{4})(?=.)/g, "$1-");
}

export function sealUrlOf(token: string): string {
  return buildValidationUrl(token);
}

export function formatSealDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function shortSealHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 16)}…${hash.slice(-12)}`;
}

/**
 * Nome do gestor que emitiu o relatorio chancelado.
 *
 * Nos relatorios consolidados o emissor e registrado como signatario com papel
 * de "Gestor emitente"/"Emissor". Em documentos assinados por colaboradores
 * nao existe gestor emissor — o retorno e null (nunca inventamos um nome).
 */
export function sealIssuerOf(signers: SealSigner[] | null | undefined): string | null {
  for (const signer of signers ?? []) {
    const role = String(signer?.role ?? "").toLowerCase();
    if (!role.includes("gestor") && !role.includes("emissor")) continue;
    const name = String(signer?.name ?? "").trim();
    if (name) return name;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Origem da chancela                                                  */
/* ------------------------------------------------------------------ */

export type SealOrigin = "gestor" | "colaborador" | "sem-assinatura";

export const sealOriginLabels: Record<SealOrigin, string> = {
  gestor: "Emitido por gestor",
  colaborador: "Assinado por colaborador",
  "sem-assinatura": "Sem assinatura nominal",
};

/**
 * Separa as chancelas em dois mundos: relatórios emitidos pelo gestor (o
 * emissor entra como signatário) e documentos assinados pelo próprio
 * colaborador (ficha de EPI, ata, APR, termos).
 */
export function sealOriginOf(
  signers: SealSigner[] | null | undefined,
  signerCount?: number | null
): SealOrigin {
  if (sealIssuerOf(signers)) return "gestor";
  const named = (signers ?? []).filter((signer) => String(signer?.name ?? "").trim() !== "").length;
  if (Number(signerCount ?? 0) > 0 || named > 0) return "colaborador";
  return "sem-assinatura";
}

/* ------------------------------------------------------------------ */
/* Criacao do selo no servidor                                         */
/* ------------------------------------------------------------------ */

/**
 * Cria (ou reaproveita) o selo no servidor. Retorna `null` quando nao foi
 * possivel carimbar — nesse caso o documento ainda pode ser impresso, mas
 * sem a chancela (nunca inventamos um selo local).
 */
export async function requestDocumentSeal(input: RequestSealInput): Promise<DocumentSeal | null> {
  try {
    const contentHash = await hashSealContent(input.content);
    const res = await callSignatureEnginePublic<{
      ok?: boolean;
      token?: string;
      sealedAt?: string;
      contentHash?: string;
      signerCount?: number;
      label?: string;
    }>("seal_document", {
      subdomain: sealSubdomain || undefined,
      scope: input.scope,
      referenceRef: input.referenceRef,
      referenceLabel: input.referenceLabel,
      contentHash,
      signers: input.signers.map((s) => ({
        name: s.name,
        role: s.role ?? null,
        signedAt: s.signedAt ?? null,
      })),
    });

    if (!res?.token) return null;
    return {
      token: res.token,
      code: sealCodeOf(res.token),
      url: sealUrlOf(res.token),
      contentHash: res.contentHash || contentHash,
      signerCount: res.signerCount ?? input.signers.length,
      sealedAt: res.sealedAt || new Date().toISOString(),
      label: res.label || input.referenceLabel,
      scope: input.scope,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Validacao publica da chancela                                       */
/* ------------------------------------------------------------------ */

export interface SealValidationResult {
  valid: boolean;
  found: boolean;
  reason?: string;
  scope?: SealScope;
  label?: string | null;
  companyName?: string | null;
  contentHash?: string | null;
  signerCount?: number;
  signers?: SealSigner[];
  sealedAt?: string | null;
}

/** Confere a chancela no servidor (sem sessao). */
export async function validateSealToken(token: string): Promise<SealValidationResult> {
  return callSignatureEnginePublic<SealValidationResult>("validate_seal", { token });
}

/* ------------------------------------------------------------------ */
/* Chancela em HTML (impressao / PDF)                                  */
/* ------------------------------------------------------------------ */

export interface SealHtmlOptions {
  /** Sobrescreve a legenda do tipo de documento (ex.: "Relatório mensal de EPI"). */
  caption?: string;
  /** Titulo em destaque (default: "Documento assinado eletronicamente"). */
  headline?: string;
  /** Nome de quem emitiu o documento (ex.: gestor que imprimiu o relatório). */
  issuer?: string | null;
}

/** Bloco de chancela para o rodape do documento impresso. */
export function sealPrintHtml(seal: SealDisplay | null, options: SealHtmlOptions = {}): string {
  if (!seal?.token) return "";
  const url = sealUrlOf(seal.token);
  const scopeLabel = options.caption || (seal.scope ? sealScopeLabels[seal.scope] : "Documento");
  const headline = options.headline || "Documento assinado eletronicamente";
  const issuer = (options.issuer || "").trim();
  const signers = seal.signerCount ?? 0;

  return `<div class="seal">
    <div class="seal-qr">
      <img class="seal-qr-img" src="${validationQrDataUrl(seal.token, 132)}" alt="QR-Code de autenticidade do documento" />
      <span class="seal-qr-cap">Leia para validar</span>
    </div>
    <div class="seal-body">
      <div class="seal-kicker">Chancela de autenticidade · ${escapeHtml(scopeLabel)}</div>
      <div class="seal-title">${escapeHtml(headline)}</div>
      <div class="seal-doc">${escapeHtml(seal.label || "—")}</div>
      <div class="seal-rows">
        <span><b>Código de verificação:</b> ${escapeHtml(sealCodeOf(seal.token))}</span>
        <span><b>Signatários:</b> ${signers > 0 ? signers : "—"}</span>
        <span><b>Emitido em:</b> ${escapeHtml(formatSealDate(seal.sealedAt))}</span>
        <span><b>Hash SHA-256:</b> ${escapeHtml(shortSealHash(seal.contentHash))}</span>
        ${issuer ? `<span><b>Emitido por:</b> ${escapeHtml(issuer)}</span>` : ""}
      </div>
      <div class="seal-link">Confira em ${escapeHtml(url)}</div>
    </div>
  </div>
  <div class="seal-note">
    A autenticidade deste documento pode ser conferida em ${escapeHtml(url)} ou pela leitura do QR-Code acima.
    O código aponta para o registro do servidor, que guarda o hash do conteúdo impresso e os signatários.
    Qualquer alteração no conteúdo invalida a conferência.
  </div>`;
}