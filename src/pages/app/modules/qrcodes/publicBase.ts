import { getSettings } from "@/pages/app/settings/settingsStore";
import { resolveQrCode } from "@/pages/app/modules/qrcodes/qrIdentifierStore";

/**
 * Resolve o endereço que é gravado DENTRO do QR-Code de fiscalização.
 *
 * Regra de ouro: o QR é lido por um celular sem login. Então ele nunca pode
 * apontar para o endereço do editor de pré-visualização (que exige sessão e
 * responde "invalid authorization") nem para um subdomínio que ainda não
 * existe. A ordem de prioridade é:
 *
 * 1. Endereço público configurado pela empresa (Configurações / QR-Codes);
 * 2. Endereço atual do navegador + caminho de publicação do build.
 */

/** Caminho onde o app foi publicado (ex.: vazio ou "/preview/abc"). */
function appPathPrefix(): string {
  const base = typeof __BASE_PATH__ === "string" ? __BASE_PATH__ : "/";
  const segments = base.split("/").filter(Boolean);
  return segments.length > 0 ? `/${segments.join("/")}` : "";
}

/** Origem do navegador atual. */
function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) return window.location.origin;
  return "https://sstek.com";
}

/** Endereço montado a partir de onde o sistema está aberto agora. */
export function currentBaseUrl(): string {
  return `${currentOrigin().replace(/\/+$/, "")}${appPathPrefix()}`;
}

/**
 * Diz se um endereço exige sessão/login para abrir.
 *
 * Isso acontece com o editor de pré-visualização da plataforma, com localhost
 * e com IPs internos — justamente os casos em que o celular do fiscal vai
 * receber um erro de autorização em vez da ficha.
 */
export function hostRequiresSession(url: string): boolean {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return true;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
  // Editor/hospedagem de pré-visualização da plataforma.
  if (host.includes("readdy")) return true;
  return false;
}

/** `true` quando o sistema está rodando em ambiente de pré-visualização. */
export function isPreviewEnvironment(): boolean {
  if (typeof __IS_PREVIEW__ !== "undefined" && __IS_PREVIEW__) return true;
  return hostRequiresSession(currentBaseUrl());
}

/** Normaliza o endereço digitado pelo usuário (aceita "dominio.com"). */
export function normalizeBaseUrl(value: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}`;
  } catch {
    return "";
  }
}

export interface QrBaseInfo {
  /** Endereço final, sem barra no fim. */
  base: string;
  /** `true` quando veio do campo configurado pela empresa. */
  configured: boolean;
  /**
   * `true` quando o endereço exige login — neste caso os adesivos impressos
   * não abrem no celular de quem fiscaliza.
   */
  requiresSession: boolean;
}

/** Endereço efetivo usado em todos os QR-Codes de fiscalização. */
export function resolveQrBase(): QrBaseInfo {
  const configured = normalizeBaseUrl(getSettings().publicBaseUrl);
  if (configured) {
    return { base: configured, configured: true, requiresSession: hostRequiresSession(configured) };
  }
  const fallback = currentBaseUrl();
  return { base: fallback, configured: false, requiresSession: hostRequiresSession(fallback) };
}

/** Caminho interno da ficha de fiscalização para um código já resolvido. */
export function fiscalizacaoRoutePath(code: string, _opaque: boolean, subdomain: string): string {
  const company = (subdomain || "").trim();
  // O subdomínio vai na URL em TODOS os casos. Ele não é segredo (é o próprio
  // endereço da empresa) e é o que permite à consulta externa carregar o termo
  // LGPD correto e registrar a solicitação na empresa certa — inclusive para
  // identificadores opacos, que não contêm nenhuma referência interna.
  const query = company ? `?empresa=${encodeURIComponent(company)}` : "";
  return `/fiscalizacao/${encodeURIComponent(code)}${query}`;
}

/** Caminho interno usando a referência do colaborador (compatibilidade). */
export function fiscalizacaoPath(subdomain: string, collaboratorId: string): string {
  return fiscalizacaoRoutePath(collaboratorId, false, subdomain);
}

/** Caminho interno da ficha para o código VIGENTE do colaborador. */
export function fiscalizacaoLocalPath(subdomain: string, collaboratorId: string): string {
  const identifier = resolveQrCode(subdomain, collaboratorId);
  return fiscalizacaoRoutePath(identifier.code, identifier.opaque, subdomain);
}

/**
 * Endereço público completo gravado dentro do QR-Code.
 *
 * O código vem do resolvedor de identificadores: se o colaborador ainda usa a
 * referência legada, ela é mantida exatamente como está (adesivos impressos
 * continuam válidos). Se já recebeu um identificador opaco, é ele que vai no
 * QR — sem empresa na URL.
 */
export function fiscalizacaoUrl(subdomain: string, collaboratorId: string): string {
  const { base } = resolveQrBase();
  return `${base}${fiscalizacaoLocalPath(subdomain, collaboratorId)}`;
}