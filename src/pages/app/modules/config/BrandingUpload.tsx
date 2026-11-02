import { useRef, useState, type DragEvent } from "react";
import { useAppSession } from "@/pages/app/context";
import {
  clearBrandingAsset,
  uploadBrandingAsset,
  type BrandingAssetKind,
} from "@/pages/app/settings/settingsStore";

interface BrandingUploadProps {
  kind: BrandingAssetKind;
  title: string;
  description: string;
  hint: string;
  allowedTypes: string[];
  allowedLabel: string;
  value: string | null;
  /** Classes extras para a moldura da pré-visualização (proporção). */
  previewClass?: string;
  previewFit?: "contain" | "cover";
}

export default function BrandingUpload({
  kind,
  title,
  description,
  hint,
  allowedTypes,
  allowedLabel,
  value,
  previewClass = "h-28",
  previewFit = "contain",
}: BrandingUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const session = useAppSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError("");

    if (!allowedTypes.includes(file.type)) {
      setError(`Formato inválido. Envie um arquivo ${allowedLabel}.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 5 MB.");
      return;
    }

    setBusy(true);
    try {
      const result = await uploadBrandingAsset(file, kind, { name: session.name });
      if (!result.ok) {
        setError(result.error || "Não foi possível enviar o arquivo. Tente novamente.");
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível enviar o arquivo. Tente novamente."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    void handleFiles(event.dataTransfer.files);
  };

  const remove = async () => {
    setError("");
    setBusy(true);
    try {
      const result = await clearBrandingAsset(kind, { name: session.name });
      if (!result.ok) {
        setError(result.error || "Não foi possível remover o arquivo.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
      <div className="max-w-2xl">
        <h3 className="text-sm font-semibold text-foreground-900">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">{description}</p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
            dragOver ? "border-primary-400 bg-primary-50 dark:bg-primary-950" : "border-background-300 bg-background-100"
          }`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-50 text-primary-600">
            <i className="ri-upload-cloud-2-line text-xl"></i>
          </span>
          <p className="text-xs text-foreground-600">
            Arraste o arquivo aqui ou{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-primary-700 hover:text-primary-800"
            >
              selecione do computador
            </button>
          </p>
          <p className="text-[11px] text-foreground-400">{hint}</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={allowedTypes.join(",")}
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-error-warning-line text-sm"></i>
            {error}
          </div>
        )}

        {busy && (
          <p className="mt-3 flex items-center gap-2 text-xs text-foreground-600">
            <i className="ri-loader-4-line animate-spin text-sm"></i>
            Enviando arquivo...
          </p>
        )}
      </div>

      <div className="w-full shrink-0 md:w-56">
        <div
          className={`flex w-full items-center justify-center overflow-hidden rounded-lg border border-background-200 bg-background-100 ${previewClass}`}
        >
          {value ? (
            <img
              src={value}
              alt={title}
              className={`h-full w-full ${previewFit === "cover" ? "object-cover" : "object-contain"} p-2`}
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-foreground-400">
              <i className="ri-image-line text-2xl"></i>
              <span className="text-[11px]">Nenhum arquivo</span>
            </span>
          )}
        </div>

        {value ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-60"
            >
              <i className="ri-refresh-line"></i>
              Trocar
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100 disabled:opacity-60 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100 dark:hover:bg-accent-900"
            >
              <i className="ri-delete-bin-line"></i>
              Remover
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}