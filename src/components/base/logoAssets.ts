/**
 * Fonte única da marca SSTEK em todo o produto.
 *
 * Existe UMA única arte de logo (a colorida, com fundo transparente). O que
 * muda entre os contextos é apenas a cor das letras:
 *
 * - LOGO_COLOR_URL → letras azul-marinho + detalhe verde no K (fundos claros)
 * - LOGO_WHITE_URL → letras brancas + o mesmo detalhe verde no K (fundos escuros)
 *
 * As duas são a mesma arte; nunca declarar a URL da logo direto nos componentes.
 */

/** Marca oficial com letras azuis, fundo transparente — usada em fundos claros. */
export const LOGO_COLOR_URL =
  "/images/7ac4fcf023.png";

/** A mesma marca com letras brancas e o detalhe verde no K — usada em fundos escuros. */
export const LOGO_WHITE_URL =
  "/images/0a7be1687a.png";

export const LOGO_ALT = "SSTEK — Gestão Inteligente em Segurança do Trabalho";
export const LOGO_TITLE = "SSTEK — Sistema de Gestão de Segurança do Trabalho";

/** Retorna a arte adequada ao fundo: "light" = fundo escuro, "dark" = fundo claro. */
export function logoUrlFor(variant: "light" | "dark" = "dark"): string {
  return variant === "light" ? LOGO_WHITE_URL : LOGO_COLOR_URL;
}