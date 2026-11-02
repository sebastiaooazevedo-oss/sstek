import { LOGO_ALT, LOGO_TITLE, logoUrlFor } from "@/components/base/logoAssets";

interface LogoProps {
  /** "dark" = fundos claros (letras azuis) · "light" = fundos escuros (letras brancas). */
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

const SIZES: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "h-8",
  md: "h-9 md:h-10",
  lg: "h-12 md:h-16",
};

export default function Logo({ variant = "dark", size = "md" }: LogoProps) {
  return (
    <img
      src={logoUrlFor(variant)}
      alt={LOGO_ALT}
      title={LOGO_TITLE}
      className={`${SIZES[size]} w-auto max-w-full object-contain object-left`}
    />
  );
}