import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Efeito celebrativo usado no registro do sentimento.
 *
 * Ao contrário de uma imagem pronta, as partículas são elementos de layout
 * animados por CSS — assim acompanham os tokens de cor do tema (claro/escuro)
 * e não pesam no carregamento. Dispara uma única rajada de confete sempre que
 * `active` passa a verdadeiro, disparando `onDone` ao final como fallback.
 */

interface MoodCelebrationProps {
  active: boolean;
  onDone?: () => void;
  /** "burst" = rajada compacta dentro do card; "full" = cobre o palco inteiro. */
  variant?: "burst" | "full";
  className?: string;
}

const COLORS = [
  "oklch(var(--primary-500))",
  "oklch(var(--accent-500))",
  "oklch(var(--secondary-500))",
  "oklch(var(--primary-300))",
  "oklch(var(--accent-300))",
  "oklch(var(--secondary-300))",
];

const SPARKS = ["✨", "🌟", "🎉", "💚"];

interface Piece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotate: number;
  distance: number;
  delay: number;
  duration: number;
  round: boolean;
  spark: string | null;
}

/** Distribuição determinística: mesma rajada a cada render, sem re-sorteio. */
function buildPieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.22;
    const distance = 70 + ((index * 37) % 120);
    return {
      id: index,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40,
      size: 6 + (index % 4) * 3,
      color: COLORS[index % COLORS.length],
      rotate: (index % 2 === 0 ? 1 : -1) * (140 + (index % 5) * 40),
      distance,
      delay: (index % 6) * 55,
      duration: 1150 + (index % 5) * 130,
      round: index % 3 === 0,
      spark: index % 9 === 0 ? SPARKS[index % SPARKS.length] : null,
    };
  });
}

export default function MoodCelebration({
  active,
  onDone,
  variant = "burst",
  className = "",
}: MoodCelebrationProps) {
  const [runId, setRunId] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!active) return;
    setRunId((value) => value + 1);
    const timer = window.setTimeout(() => doneRef.current?.(), 2100);
    return () => window.clearTimeout(timer);
  }, [active]);

  const pieces = useMemo(() => buildPieces(variant === "full" ? 34 : 22), [variant]);

  if (!active) return null;

  return (
    <div
      key={runId}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-30 overflow-hidden ${className}`}
    >
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        {pieces.map((piece) => {
          const style = {
            "--fly-x": `${piece.x.toFixed(1)}px`,
            "--fly-y": `${piece.y.toFixed(1)}px`,
            "--fly-rot": `${piece.rotate}deg`,
            "--fly-delay": `${piece.delay}ms`,
            "--fly-duration": `${piece.duration}ms`,
            background: piece.color,
            width: piece.spark ? undefined : piece.size,
            height: piece.spark ? undefined : piece.size,
            borderRadius: piece.round ? "9999px" : "2px",
          } as CSSProperties;

          return (
            <span
              key={piece.id}
              className="mood-confetti-piece absolute block"
              style={style}
            >
              {piece.spark ? <span className="text-sm leading-none">{piece.spark}</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}