interface FichaWatermarkProps {
  /** Texto repetido (ex.: "CONSULTA RESTRITA · FBK2"). */
  label: string;
  /** Opacidade do texto. Discreta por padrão, mas legível. */
  opacity?: number;
}

const ROWS = 16;
const COLUMNS = 5;

/**
 * Marca-d'água discreta, repetida e legível sobre a ficha.
 *
 * É puramente visual: não impede print e não tenta bloquear botão direito ou
 * seleção de texto — a proteção real é a sessão validada no servidor. Manter
 * `aria-hidden` preserva leitores de tela.
 */
export default function FichaWatermark({ label, opacity = 0.06 }: FichaWatermarkProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      <div className="absolute left-1/2 top-1/2 flex w-[220%] -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] flex-col gap-7">
        {Array.from({ length: ROWS }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex justify-center gap-10 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.32em] text-foreground-900"
            style={{ opacity }}
          >
            {Array.from({ length: COLUMNS }).map((__, columnIndex) => (
              <span key={`cell-${rowIndex}-${columnIndex}`}>{label}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}