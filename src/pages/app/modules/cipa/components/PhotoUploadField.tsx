import type { CipaPhoto } from "@/mocks/cipa";

interface PhotoUploadFieldProps {
  value: CipaPhoto[];
  onChange: (photos: CipaPhoto[]) => void;
  label: string;
  hint: string;
}

/**
 * Campo reutilizável de registro fotográfico: upload de múltiplas imagens
 * (data URL), prévia em miniatura e remoção individual.
 */
export default function PhotoUploadField({ value, onChange, label, hint }: PhotoUploadFieldProps) {
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onChange([
            ...value,
            { id: `ph-${Date.now()}-${index}`, url: reader.result as string, name: file.name },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-camera-line text-base text-primary-700"></i>
          {label}
        </h3>
        <span className="text-[11px] text-foreground-400">{value.length} foto(s)</span>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-6 text-center transition-colors hover:border-primary-400">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-image-add-line text-2xl"></i>
        </span>
        <span className="text-sm font-semibold text-foreground-900">Adicionar fotos</span>
        <span className="text-xs text-foreground-500">{hint}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </label>

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {value.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-background-200 bg-background-100">
              <div className="h-28 w-full">
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-foreground-950/60 text-background-50 transition-colors hover:bg-accent-600"
              >
                <i className="ri-close-line text-base"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}