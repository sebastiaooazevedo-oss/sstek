import { useEffect, useRef, useState } from "react";

interface ExportMenuProps {
  onExportPdf: () => void;
  onExportCsv: () => void;
  disabled?: boolean;
  /** Versão reduzida, usada dentro de cartões e listas. */
  compact?: boolean;
  /** "ghost" acompanha a barra de ações padrão dos cabeçalhos. */
  variant?: "default" | "ghost";
}

/** Botão "Exportar" com menu suspenso para PDF e planilha (CSV). */
export default function ExportMenu({
  onExportPdf,
  onExportCsv,
  disabled = false,
  compact = false,
  variant = "default",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const choosePdf = () => {
    setOpen(false);
    onExportPdf();
  };

  const chooseCsv = () => {
    setOpen(false);
    onExportCsv();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={
          variant === "ghost"
            ? `inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 hover:text-foreground-950 disabled:cursor-not-allowed disabled:opacity-40 ${
                open ? "bg-background-200 text-foreground-950" : ""
              }`
            : `inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"
              }`
        }
      >
        <i className="ri-download-2-line text-base"></i>
        Exportar
        <i className={`ri-arrow-down-s-line text-base transition-transform ${open ? "rotate-180" : ""}`}></i>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-background-200 bg-background-50 py-1.5 shadow-xl">
          <button
            type="button"
            onClick={choosePdf}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-file-pdf-2-line text-base text-accent-700"></i>
            Exportar em PDF
          </button>
          <button
            type="button"
            onClick={chooseCsv}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-file-excel-2-line text-base text-primary-700"></i>
            Exportar planilha (CSV)
          </button>
        </div>
      )}
    </div>
  );
}