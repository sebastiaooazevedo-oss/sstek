import { useRef, useState } from "react";
import Modal, { Field, ModalButton, inputClass } from "@/pages/app/components/Modal";
import { publishNewRegulation } from "@/pages/app/modules/regulamento/regulationStore";

interface UploadRegulationModalProps {
  open: boolean;
  onClose: () => void;
  currentVersion: number;
  publishedBy: string;
  onPublished: (message: string) => void;
}

const MAX_SIZE = 25 * 1024 * 1024;

export default function UploadRegulationModal({
  open,
  onClose,
  currentVersion,
  publishedBy,
  onPublished,
}: UploadRegulationModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("Regulamento Interno");
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitle("Regulamento Interno");
    setSummary("");
    setFile(null);
    setPageCount(0);
    setConfirmed(false);
    setError("");
    setReading(false);
    setSubmitting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleFile = async (selected: File | null) => {
    setError("");
    setPageCount(0);
    setFile(null);
    if (!selected) return;
    if (selected.type && selected.type !== "application/pdf") {
      setError("Envie um arquivo PDF do regulamento.");
      return;
    }
    if (!/\.pdf$/i.test(selected.name) && selected.type !== "application/pdf") {
      setError("Envie um arquivo PDF do regulamento.");
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError("O PDF deve ter no máximo 25 MB.");
      return;
    }
    setFile(selected);
    setReading(true);
    try {
      const buffer = await selected.arrayBuffer();
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const total = doc.getPageCount();
      if (total <= 0) throw new Error("empty");
      setPageCount(total);
    } catch {
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setError(
        "Não foi possível ler o PDF enviado. Verifique se o arquivo não está protegido por senha e tente novamente."
      );
    } finally {
      setReading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Selecione o PDF do novo regulamento.");
      return;
    }
    if (pageCount <= 0) {
      setError("Aguarde a leitura do PDF ou envie um arquivo válido.");
      return;
    }
    if (!confirmed) {
      setError("Confirme que a nova versão substitui a atual e exigirá nova assinatura de todos.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await publishNewRegulation({
        title,
        summary,
        file,
        pageCount,
        publishedBy,
      });
      onPublished(
        `Versão ${result.version} publicada. A versão anterior foi marcada como não vigente e todos os colaboradores precisam assinar novamente.`
      );
      reset();
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível publicar o novo regulamento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      icon="ri-upload-cloud-2-line"
      title="Publicar nova versão do Regulamento Interno"
      subtitle={`Versão vigente atual: v${currentVersion}. O novo arquivo passa a valer para todos os colaboradores.`}
      footer={
        <>
          <ModalButton variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancelar
          </ModalButton>
          <ModalButton
            icon={submitting ? "ri-loader-4-line" : "ri-upload-cloud-2-line"}
            onClick={handleSubmit}
            disabled={submitting || reading || !file || !confirmed}
          >
            {submitting ? "Publicando..." : "Publicar nova versão"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs leading-relaxed text-accent-900">
          <i className="ri-alert-line mt-0.5 text-base"></i>
          <span>
            Ao publicar, a versão atual ({`v${currentVersion}`}) deixa de ser válida, mas continua disponível no
            histórico sinalizada como <strong className="font-semibold">não vigente</strong>. Todos os colaboradores
            voltam a ter a pendência de leitura e assinatura do novo regulamento.
          </span>
        </div>

        <Field label="Título do documento" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Regulamento Interno"
          />
        </Field>

        <Field label="Resumo (opcional)" hint="Aparece na lista de versões e no painel do administrador.">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 400))}
            className={`${inputClass} min-h-[76px] resize-y`}
            placeholder="Resumo das principais regras e do motivo da atualização."
          />
        </Field>

        <Field label="Arquivo PDF" required hint="Somente PDF, até 25 MB. O número de páginas é lido automaticamente.">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-4 text-left transition-colors hover:border-primary-300 hover:bg-background-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
              <i className="ri-file-pdf-2-line text-xl"></i>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground-900">
                {file ? file.name : "Selecionar PDF do regulamento"}
              </span>
              <span className="mt-0.5 block text-xs text-foreground-500">
                {reading
                  ? "Lendo o arquivo…"
                  : file && pageCount > 0
                    ? `${pageCount} página(s) · pronto para publicar`
                    : "Clique para escolher o arquivo no seu computador"}
              </span>
            </span>
            <i className="ri-upload-line text-lg text-foreground-400"></i>
          </button>
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-background-200 bg-background-100 px-4 py-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-background-300 text-primary-500 focus:ring-primary-400"
          />
          <span className="text-xs leading-relaxed text-foreground-700">
            Confirmo que esta publicação substitui o regulamento vigente e que todos os colaboradores deverão ler e
            assinar a nova versão.
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}