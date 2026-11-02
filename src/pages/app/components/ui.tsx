import type { ReactNode } from "react";

type Tone = "primary" | "accent" | "secondary";

const toneChip: Record<Tone, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-800",
  secondary: "bg-secondary-100 text-secondary-800",
};

const toneBar: Record<Tone, string> = {
  primary: "bg-primary-500",
  accent: "bg-accent-500",
  secondary: "bg-secondary-500",
};

/* ---------------------------------------------------------------- */

interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, subtitle, action, children, className = "" }: SectionCardProps) {
  return (
    <section className={`rounded-lg border border-background-200 bg-background-50 p-5 md:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-base font-bold tracking-tight text-foreground-950">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-foreground-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

interface KpiCardProps {
  icon: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  tone: Tone;
}

export function KpiCard({ icon, label, value, delta, trend, tone }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-5">
      <div className="flex items-start justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneChip[tone]}`}>
          <i className={`${icon} text-xl`}></i>
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            trend === "up" ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-800"
          }`}
        >
          <i className={trend === "up" ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
          {delta}
        </span>
      </div>
      <p className="mt-5 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-foreground-500">{label}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface RingStatProps {
  percent: number;
  value: string;
  label: string;
  tone?: Tone;
}

const toneStroke: Record<Tone, string> = {
  primary: "var(--primary-500)",
  accent: "var(--accent-500)",
  secondary: "var(--secondary-500)",
};

export function RingStat({ percent, value, label, tone = "primary" }: RingStatProps) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-5">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(oklch(${toneStroke[tone]}) ${p}%, oklch(var(--background-200)) ${p}% 100%)`,
        }}
      >
        <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-background-50">
          <span className="font-heading text-lg font-extrabold text-foreground-950">{value}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground-900">{label}</p>
        <p className="mt-1 text-xs text-foreground-500">{p}% do total</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface BarItem {
  label: string;
  value: number;
}

interface MiniBarsProps {
  data: BarItem[];
  tone?: Tone;
  suffix?: string;
}

export function MiniBars({ data, tone = "primary", suffix = "" }: MiniBarsProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-48 items-end gap-2 md:gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground-600">
            {item.value}
            {suffix}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-md ${toneBar[tone]} transition-all`}
              style={{ height: `${Math.round((item.value / max) * 100)}%` }}
            ></div>
          </div>
          <span className="text-[11px] font-medium text-foreground-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface HBar {
  label: string;
  value: number;
}

interface HorizontalBarsProps {
  data: HBar[];
  tone?: Tone;
  suffix?: string;
}

export function HorizontalBars({ data, tone = "primary", suffix = "" }: HorizontalBarsProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-4">
      {data.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground-800">{item.label}</span>
            <span className="text-sm font-semibold text-foreground-600">
              {item.value}
              {suffix}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
            <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${(item.value / max) * 100}%` }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */

const statusStyles: Record<string, string> = {
  Ativo: "bg-primary-100 text-primary-700",
  "Em dia": "bg-primary-100 text-primary-700",
  Trial: "bg-secondary-100 text-secondary-800",
  Afastado: "bg-secondary-100 text-secondary-800",
  Vencendo: "bg-accent-100 text-accent-800",
  Inadimplente: "bg-accent-200 text-accent-900",
  Vencido: "bg-danger-100 text-danger-800 ring-1 ring-danger-200",
  Desligado: "bg-background-200 text-foreground-600",
  Empresa: "bg-secondary-100 text-secondary-800",
  Colaborador: "bg-background-200 text-foreground-700",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[status] || "bg-background-200 text-foreground-700"}`}>
      {status}
    </span>
  );
}

/* ---------------------------------------------------------------- */

export function DaysPill({ days }: { days: number }) {
  const urgent = days <= 7;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        urgent ? "bg-accent-200 text-accent-900" : "bg-background-200 text-foreground-700"
      }`}
    >
      <i className="ri-timer-line"></i>
      {days} {days === 1 ? "dia" : "dias"}
    </span>
  );
}