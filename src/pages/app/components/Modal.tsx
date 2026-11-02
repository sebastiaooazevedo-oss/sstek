import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
}

const sizeClass: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

export default function Modal({ open, onClose, title, subtitle, icon, children, footer, size = "lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-modal-overlay=""
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground-950/50 p-3 py-6 md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`relative flex w-full ${sizeClass[size]} flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            {icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className={`${icon} text-lg`}></i>
              </span>
            )}
            <div>
              <h2 className="font-heading text-lg font-bold tracking-tight text-foreground-950">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto overflow-x-hidden px-5 py-5 md:px-6">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-background-200 bg-background-50 px-5 py-4 md:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, required, hint, children, className = "" }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-foreground-700">
        {label}
        {required && <span className="ml-0.5 text-accent-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-foreground-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-primary-400";

export const selectClass =
  "w-full appearance-none rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400";

export function ModalButton({
  children,
  onClick,
  variant = "primary",
  icon,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  icon?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors";
  const styles =
    variant === "primary"
      ? "bg-primary-500 text-background-50 hover:bg-primary-600"
      : "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} disabled:cursor-not-allowed disabled:opacity-60`}>
      {icon && <i className={`${icon} text-base`}></i>}
      {children}
    </button>
  );
}