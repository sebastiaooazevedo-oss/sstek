import { useTheme } from "@/pages/app/utils/theme";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { LOGO_ALT, LOGO_TITLE, logoUrlFor } from "@/components/base/logoAssets";

interface AppBrandLogoProps {
  /** Define altura e limite de largura da marca. */
  className?: string;
}

/**
 * Logo exibida após o login, sempre com fundo transparente.
 * Se a empresa enviou a própria logo em Configurações, ela tem prioridade;
 * caso contrário, mostra a marca SSTEK oficial — branca no tema escuro e azul
 * no tema claro, sempre com o detalhe verde no K.
 */
export default function AppBrandLogo({ className = "" }: AppBrandLogoProps) {
  const theme = useTheme();
  const { logoUrl } = useSystemSettings();
  const src = logoUrl || logoUrlFor(theme === "dark" ? "light" : "dark");
  // Só a logo enviada pela empresa precisa de halo: a marca SSTEK já tem
  // versão própria para cada fundo.
  const glow = logoUrl && theme === "dark" ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "";

  return (
    <img
      src={src}
      alt={LOGO_ALT}
      title={LOGO_TITLE}
      className={`w-auto object-contain ${glow} ${className}`}
    />
  );
}