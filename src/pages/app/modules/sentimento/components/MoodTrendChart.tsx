import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getMoodByScore } from "@/pages/app/mood/moodOptions";
import type { ChartRow, ChartSeries } from "@/pages/app/modules/sentimento/moodTrend";

const COLOR_ALERT = "oklch(var(--accent-500))";
const COLOR_GRID = "oklch(var(--background-300))";
const COLOR_AXIS = "oklch(var(--foreground-400))";
const COLOR_REF = "oklch(var(--foreground-300))";
const COLOR_SURFACE = "oklch(var(--background-50))";

interface MoodTrendChartProps {
  data: ChartRow[];
  series: ChartSeries[];
  selectedDay: string | null;
  onSelectDay: (date: string) => void;
}

interface TrendDotProps {
  cx?: number;
  cy?: number;
  payload?: ChartRow;
  seriesField?: string;
  seriesColor?: string;
  selectedDay?: string | null;
  onSelectDay?: (date: string) => void;
}

/** Ponto de uma série: clicável para abrir o detalhe do dia. */
function TrendDot({ cx, cy, payload, seriesField, seriesColor, selectedDay, onSelectDay }: TrendDotProps) {
  if (cx === undefined || cy === undefined || !payload || !seriesField) return <g />;
  const raw = payload[seriesField];
  if (raw === null || raw === undefined) return <g />;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return <g />;

  const active = selectedDay === payload.date;
  const negative = value <= 2;
  const fill = active || negative ? COLOR_ALERT : seriesColor ?? COLOR_AXIS;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 7 : 4.5}
      fill={fill}
      stroke={COLOR_SURFACE}
      strokeWidth={active ? 3 : 2}
      style={{ cursor: "pointer" }}
      onClick={() => onSelectDay?.(payload.date)}
    />
  );
}

interface AlertTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  alertLabels?: Set<string>;
}

/** Rótulo do eixo X: dias com alerta negativo ganham um marcador de destaque. */
function AlertTick({ x = 0, y = 0, payload, alertLabels }: AlertTickProps) {
  const label = String(payload?.value ?? "");
  const alert = alertLabels ? alertLabels.has(label) : false;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={11}
        textAnchor="middle"
        fontSize={11}
        fontWeight={alert ? 700 : 400}
        fill={alert ? COLOR_ALERT : COLOR_AXIS}
      >
        {label}
      </text>
      {alert && <circle cx={0} cy={16} r={2.6} fill={COLOR_ALERT} />}
    </g>
  );
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
  series: ChartSeries[];
}

function TrendTooltip({ active, payload, series }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const items = series
    .map((s) => {
      const raw = row[s.field];
      if (raw === null || raw === undefined) return null;
      const value = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(value) ? { s, value } : null;
    })
    .filter((item): item is { s: ChartSeries; value: number } => item !== null);

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
        {row.date.split("-").reverse().join("/")}
      </p>
      {items.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {items.map(({ s, value }) => {
            const option = getMoodByScore(value);
            return (
              <li key={s.field} className="flex items-center gap-2 text-xs">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="font-medium text-foreground-700">{s.name}</span>
                <span className="ml-auto flex items-center gap-1 font-bold text-foreground-950">
                  {option && <span className="text-sm">{option.emoji}</span>}
                  {value.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-foreground-500">Sem registro neste dia</p>
      )}
      {row.hasAlert && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-900">
          <i className="ri-alert-line"></i>
          Alerta de sentimento negativo
        </p>
      )}
      {row.count > 0 && (
        <p className="mt-1 text-[11px] text-foreground-500">
          {row.count} registro{row.count > 1 ? "s" : ""} no dia
        </p>
      )}
    </div>
  );
}

/** Gráfico de evolução (linha) da nota média de sentimento por dia. */
export default function MoodTrendChart({ data, series, selectedDay, onSelectDay }: MoodTrendChartProps) {
  const alertLabels = useMemo(
    () => new Set(data.filter((row) => row.hasAlert).map((row) => row.label)),
    [data]
  );
  const yTick = (value: number) => getMoodByScore(value)?.emoji ?? String(value);

  return (
    <div className="h-[300px] w-full md:h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 18, bottom: 22, left: -8 }}>
          <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={<AlertTick alertLabels={alertLabels} />}
            tickLine={false}
            axisLine={{ stroke: COLOR_GRID }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={yTick}
            tick={{ fontSize: 15 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <ReferenceLine y={3} stroke={COLOR_REF} strokeDasharray="4 4" />
          <Tooltip cursor={{ stroke: COLOR_GRID, strokeWidth: 1 }} content={<TrendTooltip series={series} />} />
          {series.map((s) => (
            <Line
              key={s.field}
              type="monotone"
              dataKey={s.field}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              connectNulls={false}
              isAnimationActive
              animationDuration={700}
              activeDot={false}
              dot={(props: TrendDotProps) => (
                <TrendDot
                  {...props}
                  seriesField={s.field}
                  seriesColor={s.color}
                  selectedDay={selectedDay}
                  onSelectDay={onSelectDay}
                />
              )}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}