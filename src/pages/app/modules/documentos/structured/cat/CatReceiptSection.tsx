import { useState } from "react";
import { Field, inputClass, selectClass } from "@/pages/app/components/Modal";
import { catYesNo } from "@/pages/app/modules/documentos/structured/cat/catData";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatReceiptSectionProps {
  value: CatPayload;
  onChange: (patch: Partial<CatPayload>) => void;
}

const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

/**
 * Recibo de entrega da CAT — comprovante que deve ser entregue ao trabalhador
 * (Lei 8.213/91, art. 22, §2º). Aceita imagem ou PDF e registra a data e para
 * quem o recibo foi entregue.
 */
export default function CatReceiptSection({ value, onChange }: CatReceiptSectionProps) {
  const [error, setError] = useState("");
  const isImage = value.receiptType.startsWith("image/");

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      setError("O recibo deve ter no máximo 3 MB.");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      if (!dataUrl) {
        setError("Não foi possível ler o arquivo selecionado.");
        return;
      }
      setError("");
      onChange({
        receiptName: file.name,
        receiptType: file.type || "application/pdf",
        receiptDataUrl: dataUrl,
        receiptDeliveredTo: value.receiptDeliveredTo || value.workerName,
      });
    } catch {
      setError("Não foi possível ler o arquivo selecionado.");
    }
  };

  return (
    <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-receipt-line text-base text-primary-700"></i>
          Recibo de entrega da CAT
        </h3>
        <span className="text-[11px] text-foreground-400">Entrega obrigatória ao trabalhador</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}

      {value.receiptName ? (
        <div className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 p-3.5">
          {isImage ? (
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-100">
              <img src={value.receiptDataUrl} alt="Recibo da CAT" className="h-full w-full object-top" />
            </span>
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <i className="ri-file-pdf-2-line text-xl"></i>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground-900">{value.receiptName}</p>
            <p className="text-[11px] text-foreground-500">Anexado ao documento e disponível para download.</p>
          </div>
          {value.receiptDataUrl && (
            <a
              href={value.receiptDataUrl}
              target="_blank"
              rel="noreferrer"
              download={value.receiptName}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-download-2-line"></i>
              Abrir
            </a>
          )}
          <button
            type="button"
            aria-label="Remover recibo"
            onClick={() => onChange({ receiptName: "", receiptType: "", receiptDataUrl: "" })}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700"
          >
            <i className="ri-close-line text-base"></i>
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-3.5 transition-colors hover:border-primary-400">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-upload-cloud-2-line text-lg"></i>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground-800">
              Anexar o recibo de entrega da CAT
            </span>
            <span className="block text-xs text-foreground-500">
              Imagem ou PDF do comprovante gerado no eSocial / Empregador Web · até 3 MB
            </span>
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Data de entrega do recibo">
          <input
            type="date"
            className={inputClass}
            value={value.receiptDeliveredDate}
            onChange={(e) => onChange({ receiptDeliveredDate: e.target.value })}
          />
        </Field>
        <Field label="Entregue a">
          <input
            className={inputClass}
            value={value.receiptDeliveredTo}
            onChange={(e) => onChange({ receiptDeliveredTo: e.target.value })}
            placeholder="Nome de quem recebeu"
          />
        </Field>
        <Field label="Recibo também entregue ao sindicato">
          <div className="relative">
            <select
              className={selectClass}
              value={value.receiptDeliveredToUnion}
              onChange={(e) => onChange({ receiptDeliveredToUnion: e.target.value })}
            >
              {catYesNo.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>
      </div>
    </section>
  );
}