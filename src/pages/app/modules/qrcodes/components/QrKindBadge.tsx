interface QrKindBadgeProps {
  /** `true` quando o QR já usa o identificador aleatório persistente. */
  opaque: boolean;
  /** Versão do identificador opaco (1 no primeiro). */
  version?: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Etiqueta de situação do identificador do QR-Code.
 *
 * Existe por um motivo bem prático: adesivo impresso com referência legada
 * (`c-001`) é previsível e precisa ser reimpresso. A etiqueta deixa isso
 * visível na grade, sem precisar abrir ficha por ficha.
 */
export default function QrKindBadge({ opaque, version, size = "sm", className = "" }: QrKindBadgeProps) {
  const padding = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold uppercase tracking-wide ${padding} ${
        opaque ? "bg-primary-100 text-primary-800" : "bg-accent-100 text-accent-900"
      } ${className}`}
      title={
        opaque
          ? "Identificador aleatório e persistente. Não muda por leitura, sessão ou atualização cadastral."
          : "Código antigo e previsível. Continua valendo, mas o adesivo deve ser reimpresso com o identificador novo."
      }
    >
      <i className={opaque ? "ri-shield-check-line" : "ri-history-line"}></i>
      {opaque ? `Opaco v${version && version > 0 ? version : 1}` : "Legado"}
    </span>
  );
}