import { RESERVED_SUBDOMAINS } from "@shared/onboarding";
import { ROOT_DOMAIN } from "./domain";

/**
 * Lê o endereço aberto no navegador e diz a que ele se refere.
 *
 * - `tenant`: endereço de uma empresa — subdomínio (`alfa.sstek.com.br`) ou
 *   domínio próprio dela (`sst.alfa.com.br`).
 * - `root`: endereço da plataforma (`sstek.com.br`, `www.`, `app.`, `admin.`…):
 *   site institucional e painel do Superadministrador.
 * - `dev`: desenvolvimento/pré-visualização (localhost, IP, *.vercel.app).
 *   Aqui não há amarração por endereço: vale a empresa do login.
 */
export type AddressKind =
  | { kind: "tenant"; subdomain: string; domain: null }
  | { kind: "tenant"; subdomain: null; domain: string }
  | { kind: "root" }
  | { kind: "dev" };

/** Subdomínios da própria plataforma (nunca são empresas): a mesma lista que o servidor usa. */
const PLATFORM_LABELS = RESERVED_SUBDOMAINS;

const DEV_SUFFIXES = [".vercel.app", ".localhost", ".local", ".test", ".internal"];

export function classifyAddress(hostname: string, rootDomain: string = ROOT_DOMAIN): AddressKind {
  const host = (hostname || "").trim().toLowerCase().replace(/\.$/, "");
  const root = rootDomain.trim().toLowerCase();

  if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return { kind: "dev" };
  if (DEV_SUFFIXES.some((suffix) => host.endsWith(suffix))) return { kind: "dev" };

  if (host === root) return { kind: "root" };
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1));
    // Só um nível: `alfa.sstek.com.br`. Níveis extras não são endereços de empresa.
    if (label.includes(".") || PLATFORM_LABELS.has(label)) return { kind: "root" };
    return { kind: "tenant", subdomain: label, domain: null };
  }
  return { kind: "tenant", subdomain: null, domain: host };
}

/** Endereço atual do navegador (fora do navegador, conta como desenvolvimento). */
export function currentAddress(): AddressKind {
  if (typeof window === "undefined") return { kind: "dev" };
  return classifyAddress(window.location.hostname);
}
