import type { CheckinDamage } from "@/pages/app/modules/veiculos/vehicleTypes";
import {
  DIAGRAM_VIEWBOX,
  diagramFor,
  type DiagramKind,
  type ZoneTone,
} from "@/pages/app/modules/veiculos/checkin/vehicleDiagrams";

/**
 * Desenho do veículo visto de cima, com áreas clicáveis e marcadores
 * numerados das avarias. Usado no check-in (interativo) e no detalhe do
 * check-in no painel (somente leitura).
 */

interface Props {
  kind: DiagramKind;
  damages?: CheckinDamage[];
  /** Área destacada (a que está sendo editada). */
  selectedZone?: string | null;
  onZoneClick?: (zoneId: string, label: string) => void;
  /** Clique em um marcador numerado (índice na lista `damages`). */
  onPinClick?: (index: number) => void;
  className?: string;
}

const toneClass: Record<ZoneTone, string> = {
  body: "fill-background-200 stroke-background-400",
  glass: "fill-secondary-200 stroke-secondary-400",
  wheel: "fill-foreground-800 stroke-foreground-950",
  light: "fill-accent-200 stroke-accent-400",
  trim: "fill-background-300 stroke-background-500",
  cargo: "fill-background-100 stroke-background-400",
};

const severityFill: Record<string, string> = {
  leve: "fill-secondary-600",
  moderada: "fill-accent-500",
  grave: "fill-danger-600",
};

export default function VehicleIllustration({
  kind,
  damages = [],
  selectedZone = null,
  onZoneClick,
  onPinClick,
  className = "",
}: Props) {
  const diagram = diagramFor(kind);
  const interactive = Boolean(onZoneClick);
  const damagedZones = new Set(damages.filter((item) => !item.preexisting).map((item) => item.zone));
  const oldZones = new Set(damages.filter((item) => item.preexisting).map((item) => item.zone));

  // Vários marcadores na mesma área ficam lado a lado.
  const perZone = new Map<string, number>();
  const pins = damages
    .map((damage, index) => {
      const zone = diagram.zones.find((item) => item.id === damage.zone);
      if (!zone) return null;
      const order = perZone.get(damage.zone) ?? 0;
      perZone.set(damage.zone, order + 1);
      const cx = zone.x + zone.w / 2 + (order % 3) * 14 - (order > 0 ? 7 : 0);
      const cy = zone.y + zone.h / 2 + Math.floor(order / 3) * 14;
      return { damage, index, cx: Math.min(232, Math.max(8, cx)), cy: Math.min(432, Math.max(8, cy)) };
    })
    .filter(Boolean) as { damage: CheckinDamage; index: number; cx: number; cy: number }[];

  return (
    <svg
      viewBox={`0 0 ${DIAGRAM_VIEWBOX.width} ${DIAGRAM_VIEWBOX.height}`}
      className={`h-full w-full select-none ${className}`}
      role="img"
      aria-label={`Desenho do veículo (${diagram.label}) visto de cima`}
    >
      <defs>
        <pattern id="vi-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" className="fill-none stroke-background-200" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="240" height="440" rx="14" fill="url(#vi-grid)" />

      <text x="120" y="12" textAnchor="middle" className="fill-foreground-400 text-[8px] font-bold tracking-[0.2em]">
        FRENTE
      </text>
      <text x="120" y="437" textAnchor="middle" className="fill-foreground-400 text-[8px] font-bold tracking-[0.2em]">
        TRASEIRA
      </text>
      <text x="8" y="224" className="fill-foreground-400 text-[8px] font-bold" transform="rotate(-90 8 224)" textAnchor="middle">
        ESQUERDA · MOTORISTA
      </text>
      <text x="234" y="224" className="fill-foreground-400 text-[8px] font-bold" transform="rotate(90 234 224)" textAnchor="middle">
        DIREITA · PASSAGEIRO
      </text>

      {/* Sombra e contorno da carroceria */}
      {diagram.outline.map((shape, index) => (
        <rect
          key={`shadow-${index}`}
          x={shape.x + 3}
          y={shape.y + 5}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          className="fill-foreground-950/10"
        />
      ))}
      {diagram.outline.map((shape, index) => (
        <rect
          key={`outline-${index}`}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          className="fill-background-50 stroke-background-500"
          strokeWidth="1.5"
        />
      ))}

      {diagram.zones.map((zone) => {
        const selected = selectedZone === zone.id;
        const damaged = damagedZones.has(zone.id);
        const old = !damaged && oldZones.has(zone.id);
        const stateClass = selected
          ? "fill-primary-300 stroke-primary-700"
          : damaged
            ? "fill-danger-200 stroke-danger-500"
            : old
              ? "fill-background-300 stroke-foreground-500"
              : toneClass[zone.tone];
        return (
          <g
            key={zone.id}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Marcar avaria: ${zone.label}` : undefined}
            onClick={interactive ? () => onZoneClick?.(zone.id, zone.label) : undefined}
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onZoneClick?.(zone.id, zone.label);
                    }
                  }
                : undefined
            }
            className={interactive ? "group cursor-pointer outline-none" : undefined}
          >
            <title>{zone.label}</title>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx={zone.rx ?? 4}
              strokeWidth={selected ? 2 : 1}
              strokeDasharray={old ? "3 2" : undefined}
              className={`transition-colors ${stateClass} ${
                interactive && !selected ? "group-hover:fill-primary-200 group-hover:stroke-primary-500 group-focus-visible:fill-primary-200 group-focus-visible:stroke-primary-600" : ""
              }`}
            />
          </g>
        );
      })}

      {pins.map(({ damage, index, cx, cy }) => (
        <g
          key={`${damage.id}-${index}`}
          onClick={onPinClick ? () => onPinClick(index) : undefined}
          className={onPinClick ? "cursor-pointer" : undefined}
        >
          <title>{`${index + 1}. ${damage.zoneLabel}${damage.preexisting ? " (pré-existente)" : ""}`}</title>
          <circle cx={cx} cy={cy} r="8.5" className="fill-background-50" />
          <circle
            cx={cx}
            cy={cy}
            r="7"
            className={damage.preexisting ? "fill-foreground-500" : severityFill[damage.severity] ?? "fill-danger-600"}
          />
          <text x={cx} y={cy + 3} textAnchor="middle" className="pointer-events-none fill-background-50 text-[8.5px] font-bold">
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
