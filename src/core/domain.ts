/**
 * Domínio público do SSTEK.
 *
 * Cada empresa acessa por `<subdominio>.<ROOT_DOMAIN>`. O valor vem da variável
 * de ambiente `VITE_PUBLIC_ROOT_DOMAIN` (configurada na hospedagem); o padrão
 * abaixo vale para desenvolvimento.
 */
export const ROOT_DOMAIN: string = String(import.meta.env.VITE_PUBLIC_ROOT_DOMAIN || "sstek.com.br")
  .trim()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

/** Endereço (sem protocolo) da empresa: `empresa.sstek.com.br`. */
export function tenantHost(subdomain: string): string {
  const sub = (subdomain || "").trim().toLowerCase();
  return sub ? `${sub}.${ROOT_DOMAIN}` : ROOT_DOMAIN;
}

/** URL completa da empresa: `https://empresa.sstek.com.br`. */
export function tenantUrl(subdomain: string): string {
  return `https://${tenantHost(subdomain)}`;
}
