import { useState } from "react";
import {
  compressImage,
  uid,
  type PhotoItem,
} from "@/pages/app/modules/documentos/structured/structuredData";

interface PhotoFieldProps {
  value: PhotoItem[];
  onChange: (next: PhotoItem[]) => void;
  title?: string;
  hint?: string;
  /** Quantidade máxima de fotos anexadas ao documento. */
  max?: number;
}

/**
 * Campo de fotos com compressão automática (as imagens ficam embutidas no PDF
 * gerado e permanecem no documento salvo).
 */
export default function PhotoField({
  value,
  onChange,
  title = "Registro fotográfico",
  hint = "JPG ou PNG — as fotos são anexadas ao documento e saem no PDF.",
  max = 8,
}: PhotoFieldProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = max - value.length;
    if (room <= 0) {
      setError(`Limite de ${max} fotos por documento.`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const selected = Array.from(files).slice(0, room);
      const added: PhotoItem[] = [];
      for (const file of selected) {
        const url = await compressImage(file);
        if (url) added.push({ id: uid("ph"), url, name: file.name });
      }
      if (added.length) onChange([...value, ...added]);
      if (files.length > room) setError(`Foram anexadas ${room} foto(s). Limite do documento: ${max}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-xs font-bold text-foreground-800">
          <i className="ri-camera-line text-base text-primary-700"></i>
          {title}
        </h4>
        <span className="text-[11px] text-foreground-400">
          {value.length}/{max} foto(s)
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-[11px] text-accent-900">{error}</p>
      )}

      <div className="flex flex-wrap gap-2.5">
        {value.map((photo) => (
          <div
            key={photo.id}
            className="group relative h-24 w-24 overflow-hidden rounded-lg border border-background-200 bg-background-100"
          >
            <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={`Remover ${photo.name}`}
              onClick={() => onChange(value.filter((item) => item.id !== photo.id))}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-foreground-950/60 text-background-50 transition-colors hover:bg-accent-600"
            >
              <i className="ri-close-line text-xs"></i>
            </button>
          </div>
        ))}

        {value.length < max && (
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-background-300 bg-background-100 text-center transition-colors hover:border-primary-400 hover:bg-primary-50">
            <i className={`${busy ? "ri-loader-4-line animate-spin" : "ri-image-add-line"} text-lg text-primary-700`}></i>
            <span className="px-1 text-[10px] font-semibold leading-tight text-foreground-600">
              {busy ? "Processando" : "Adicionar foto"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <p className="text-[11px] text-foreground-400">{hint}</p>
    </div>
  );
}