import { useState } from "react";
import { uploadVehicleFile } from "@/pages/app/modules/veiculos/vehiclesStore";
import { FUEL_STEPS, fuelLabel } from "@/pages/app/modules/veiculos/checkin/checkinRules";

/** Placa no estilo Mercosul (faixa azul + letras grandes). */
export function PlatePill({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-[11px] px-1.5 pt-2 pb-0.5 min-w-[72px]",
    md: "text-sm px-2 pt-2.5 pb-1 min-w-[92px]",
    lg: "text-2xl px-4 pt-4 pb-1.5 min-w-[180px]",
  };
  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-md border-2 border-foreground-900 bg-background-50 font-mono font-extrabold uppercase tracking-[0.12em] text-foreground-950 ${sizes[size]}`}
    >
      <span
        className={`absolute inset-x-0 top-0 flex items-center justify-between bg-secondary-700 px-1 text-background-50 ${
          size === "lg" ? "h-3 text-[7px]" : "h-[7px] text-[0px]"
        }`}
      >
        <span className="font-sans font-bold tracking-wide">BRASIL</span>
      </span>
      {plate || "—"}
    </span>
  );
}

/** Marcador de combustível interativo (frações como no painel do veículo). */
export function FuelGauge({ value, onChange }: { value: number | null; onChange?: (value: number) => void }) {
  const active = value === null ? -1 : FUEL_STEPS.findIndex((step) => step >= value - 6);
  return (
    <div>
      <div className="flex items-end gap-1" role="radiogroup" aria-label="Nível de combustível">
        <span className="mb-1 text-[10px] font-bold text-danger-600">R</span>
        {FUEL_STEPS.map((step, index) => {
          const on = index <= active;
          const color = index <= 1 ? "bg-danger-500" : index <= 3 ? "bg-accent-500" : "bg-primary-500";
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={value === step}
              aria-label={`Combustível ${fuelLabel(step)}`}
              disabled={!onChange}
              onClick={() => onChange?.(step)}
              style={{ height: `${14 + index * 3}px` }}
              className={`w-5 rounded-sm transition-all sm:w-6 ${on ? color : "bg-background-200"} ${
                onChange ? "cursor-pointer hover:opacity-80" : "cursor-default"
              }`}
            />
          );
        })}
        <span className="mb-1 text-[10px] font-bold text-primary-700">C</span>
        <i className="ri-gas-station-line mb-0.5 ml-1 text-base text-foreground-500"></i>
      </div>
      <p className="mt-1.5 text-xs font-semibold text-foreground-700">{fuelLabel(value)}</p>
    </div>
  );
}

/** Miniatura de foto com botão de remover. */
export function PhotoThumb({
  url,
  alt,
  onRemove,
  className = "h-16 w-20",
}: {
  url?: string;
  alt: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-200 ${className}`}>
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-foreground-400">
          <i className="ri-image-line"></i>
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remover ${alt}`}
          onClick={onRemove}
          className="absolute right-0 top-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-bl-md bg-foreground-950/70 text-[10px] text-background-50"
        >
          <i className="ri-close-line"></i>
        </button>
      )}
    </span>
  );
}

/** Botões "Tirar foto" e "Galeria". */
export function PhotoButtons({
  onCamera,
  onFiles,
  disabled,
  compact = false,
  label = "Tirar foto",
}: {
  onCamera: () => void;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const btn =
    "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 font-semibold text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700";
  const pad = compact ? "px-2 py-1 text-[10.5px]" : "px-2.5 py-1.5 text-[11px]";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={disabled} onClick={onCamera} className={`${btn} ${pad}`}>
        <i className="ri-camera-line"></i>
        {label}
      </button>
      <label className={`${btn} ${pad} ${disabled ? "pointer-events-none opacity-60" : ""}`}>
        <i className="ri-image-add-line"></i>
        Galeria
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </label>
    </span>
  );
}

/** Envio de fotos do check-in com as mesmas regras em todas as etapas. */
export function useCheckinUploader(onError: (message: string) => void) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File, slot = ""): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      onError("Apenas imagens são aceitas no check-in.");
      return null;
    }
    if (file.size > 8 * 1024 * 1024) {
      onError("Imagem acima de 8 MB. Reduza a foto e tente novamente.");
      return null;
    }
    setUploading(true);
    const result = await uploadVehicleFile(file, slot);
    setUploading(false);
    if (!result) {
      onError("Falha no envio da foto. Verifique a conexão e tente novamente.");
      return null;
    }
    return result.path;
  };
  return { upload, uploading };
}
