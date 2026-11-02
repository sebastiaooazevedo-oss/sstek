import Logo from "@/components/base/Logo";

interface BrandLogoProps {
  /**
   * "dark" = fundos claros · "light" = fundos escuros (usado só no fallback).
   * A logo da empresa é privada e só é exibida depois do login; nas telas
   * públicas (login, primeiro acesso, ficha de fiscalização) mostramos a marca
   * da plataforma.
   */
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-8",
  md: "h-9 md:h-10",
  lg: "h-12 md:h-16",
};

/**
 * Marca exibida nas telas públicas e nos portões de sessão.
 *
 * Não lê configuração de empresa de propósito: essas telas podem ser abertas
 * sem autenticação e a identidade visual da empresa é um arquivo privado.
 * A marca personalizada aparece no app (AppBrandLogo) após o login.
 */
export default function BrandLogo({ variant = "dark", size = "md", className = "" }: BrandLogoProps) {
  return (
    <span className={className ? `inline-flex ${className}` : "inline-flex"}>
      <Logo variant={variant} size={size} />
    </span>
  );
}