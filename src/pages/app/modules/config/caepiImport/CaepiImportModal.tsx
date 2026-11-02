import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import {
  cancelCaepiImport,
  countCaepiErrors,
  downloadCaepiErrorReport,
  formatBytes,
  resetCaepiJob,
  startCaepiImport,
  useCaepiBase,
} from "@/pages/app/modules/config/caepiBaseStore";
import { analyzeCaepiFile, autoMapping, parseCsvLine } from "@/pages/app/modules/config/caepiImport/caepiCsv";
import MappingStep from "@/pages/app/modules/config/caepiImport/MappingStep";
import ImportProgressStep from "@/pages/app/modules/config/caepiImport/ImportProgressStep";
import ResultStep from "@/pages/app/modules/config/caepiImport/ResultStep";
import type { CaepiAnalysis, CaepiFieldKey, CaepiMapping } from "@/pages/app/modules/config/caepiImport/types";

type Step = "select" | "mapping" | "running" | "result";

interface CaepiImportModalProps {
  open: boolean;
  onClose: () => void;
  actorName: string;
}

const DEDUPE_PRIORITY: CaepiFieldKey[] = ["ca", "numero_processo", "cnpj"];

function defaultDedupe(mapping: CaepiMapping): CaepiFieldKey[] {
  const chosen = DEDUPE_PRIORITY.filter((field) => {
    const index = mapping[field];
    return index !== undefined && index >= 0;
  });
  return chosen.length > 0 ? chosen : ["ca"];
}

export default function CaepiImportModal({ open, onClose, actorName }: CaepiImportModalProps) {
  const { job, cancelling } = useCaepiBase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("select");
  const [analysis, setAnalysis] = useState<CaepiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeLabel, setAnalyzeLabel] = useState("");
  const [analyzePct, setAnalyzePct] = useState<number | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState(";");
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1252">("utf-8");
  const [mapping, setMapping] = useState<CaepiMapping>({});
  const [dedupeFields, setDedupeFields] = useState<CaepiFieldKey[]>(["ca"]);
  const [errorsStored, setErrorsStored] = useState(0);
  const [downloadingErrors, setDownloadingErrors] = useState(false);

  const rawLines = useMemo(() => analysis?.rawLines ?? [], [analysis]);
  const headers = useMemo(() => {
    if (!analysis) return [];
    const headerLine = rawLines[0] ?? analysis.headerLine;
    return parseCsvLine(headerLine, delimiter);
  }, [analysis, rawLines, delimiter]);
  const previewRows = useMemo(
    () => rawLines.slice(1).map((line) => parseCsvLine(line, delimiter)),
    [rawLines, delimiter]
  );

  const busy = step === "running" && ["uploading", "starting", "importing"].includes(job.phase);

  useEffect(() => {
    if (!open) return;
    setAnalyzeError(null);
    setFormError(null);
  }, [open]);

  useEffect(() => {
    if (step !== "running") return;
    if (job.phase === "done") {
      setStep("result");
      if (job.batchId) {
        void countCaepiErrors(job.batchId).then(setErrorsStored);
      }
    }
  }, [job.phase, job.batchId, step]);

  function reset() {
    setStep("select");
    setAnalysis(null);
    setAnalyzing(false);
    setAnalyzeError(null);
    setFormError(null);
    setErrorsStored(0);
    resetCaepiJob();
  }

  function handleClose() {
    if (busy) return;
    onClose();
    if (step === "result" || step === "select") reset();
  }

  async function handleFile(file: File) {
    setAnalyzeError(null);
    setFormError(null);
    setAnalysis(null);
    setAnalyzing(true);
    setAnalyzeLabel("Lendo o arquivo…");
    setAnalyzePct(null);
    try {
      const result = await analyzeCaepiFile(file, (progress) => {
        setAnalyzeLabel(progress.message);
        setAnalyzePct(progress.pct);
      });
      setAnalysis(result);
      setDelimiter(result.delimiter);
      setEncoding(result.encoding);
      const initial = autoMapping(result.headers);
      setMapping(initial);
      setDedupeFields(defaultDedupe(initial));
      setStep("mapping");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Não foi possível ler o arquivo selecionado.");
    } finally {
      setAnalyzing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDelimiterChange(value: string) {
    setDelimiter(value);
    if (!analysis) return;
    const line = analysis.rawLines[0] ?? analysis.headerLine;
    const nextHeaders = parseCsvLine(line, value);
    const nextMapping = autoMapping(nextHeaders);
    setMapping(nextMapping);
    setDedupeFields(defaultDedupe(nextMapping));
  }

  function handleMappingChange(field: CaepiFieldKey, index: number) {
    setMapping((prev) => {
      const next = { ...prev, [field]: index };
      if (index < 0) {
        setDedupeFields((current) => (current.includes(field) ? current.filter((item) => item !== field) : current));
      }
      return next;
    });
  }

  function toggleDedupe(field: CaepiFieldKey) {
    setDedupeFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    );
  }

  async function handleStart() {
    if (!analysis) return;
    if (mapping.ca === undefined || mapping.ca < 0) {
      setFormError("Selecione qual coluna do arquivo contém o número do CA.");
      return;
    }
    if (dedupeFields.length === 0) {
      setFormError("Escolha pelo menos um campo para compor a chave de identificação.");
      return;
    }
    setFormError(null);
    setStep("running");
    await startCaepiImport({ analysis, mapping, dedupeFields, actor: { id: null, name: actorName } });
  }

  async function handleDownloadErrors() {
    if (!job.batchId) return;
    setDownloadingErrors(true);
    try {
      await downloadCaepiErrorReport(job.batchId, job.fileName ?? "caepi");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível gerar o relatório de erros.");
    } finally {
      setDownloadingErrors(false);
    }
  }

  const title =
    step === "result"
      ? "Base do CAEPI importada"
      : step === "running"
        ? "Importando a base do CAEPI"
        : "Importar base do CAEPI";

  return (
    <Modal open={open} onClose={handleClose} title={title} icon="ri-database-2-line" size="xl">
      {step === "select" && (
        <div className="space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-background-300 bg-background-100/60 px-5 py-9 text-center transition-colors hover:bg-background-100"
            onClick={() => inputRef.current?.click()}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <i className={analyzing ? "ri-loader-4-line animate-spin text-xl" : "ri-upload-cloud-2-line text-xl"}></i>
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground-900">
              {analyzing ? analyzeLabel : "Selecione o arquivo oficial da Tabela de CA"}
            </p>
            <p className="mt-1 max-w-md text-[11px] text-foreground-500">
              Aceita o <strong>.csv.gz</strong> baixado do portal do CAEPI (convertido aqui no navegador) ou um{" "}
              <strong>.csv</strong> em UTF-8. Você verá uma prévia e confirmará o mapeamento antes de qualquer gravação.
            </p>
            {analyzing && analyzePct !== null && (
              <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-background-200">
                <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${analyzePct}%` }}></div>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.gz,text/csv,application/gzip"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {analyzeError && (
            <div className="flex items-start gap-2 rounded-md bg-background-100 px-3 py-2.5 text-xs text-foreground-800">
              <i className="ri-error-warning-line mt-0.5 text-accent-600"></i>
              <span>{analyzeError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[
              { icon: "ri-eye-line", title: "Prévia antes de gravar", text: "Primeiras linhas e mapeamento confirmado por você." },
              { icon: "ri-shield-check-line", title: "Valida linha a linha", text: "Erros com linha, coluna e motivo, sem gravar." },
              { icon: "ri-refresh-line", title: "Sem duplicar", text: "Chave de identificação + posição de retomada." },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                  <i className={`${item.icon} text-sm`}></i>
                </span>
                <p className="mt-1.5 text-xs font-semibold text-foreground-900">{item.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">{item.text}</p>
              </div>
            ))}
          </div>

          <p className="flex items-start gap-1.5 rounded-md bg-background-100 px-3 py-2 text-[11px] text-foreground-600">
            <i className="ri-global-line mt-0.5"></i>
            <span>
              A Tabela de CA do CAEPI é pública e nacional: a base importada é <strong>global</strong> (a mesma para
              todas as empresas). Os registros de EPI, entregas e assinaturas continuam isolados por empresa.
            </span>
          </p>
        </div>
      )}

      {step === "mapping" && analysis && (
        <div className="space-y-4">
          <MappingStep
            analysis={analysis}
            delimiter={delimiter}
            onDelimiterChange={handleDelimiterChange}
            encoding={encoding}
            onEncodingChange={setEncoding}
            headers={headers}
            previewRows={previewRows}
            mapping={mapping}
            onMappingChange={handleMappingChange}
            dedupeFields={dedupeFields}
            onDedupeToggle={toggleDedupe}
          />

          {formError && (
            <div className="flex items-start gap-2 rounded-md bg-background-100 px-3 py-2.5 text-xs text-foreground-800">
              <i className="ri-error-warning-line mt-0.5 text-accent-600"></i>
              <span>{formError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-background-200 pt-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-arrow-left-line"></i>
              Trocar arquivo
            </button>
            <button
              type="button"
              onClick={() => void handleStart()}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 dark:text-foreground-950"
            >
              <i className="ri-play-circle-line"></i>
              Validar e importar {formatBytes(analysis.totalBytes)}
            </button>
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="space-y-4">
          {job.phase === "error" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-100 px-3.5 py-3">
                <i className="ri-error-warning-line mt-0.5 text-lg text-accent-700"></i>
                <div>
                  <p className="text-sm font-semibold text-foreground-900">A importação parou</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground-700">{job.error}</p>
                  <p className="mt-1.5 text-[11px] text-foreground-500">
                    A base ativa anterior continua no ar. Se o arquivo já foi enviado, o lote aparece no histórico com a
                    opção <strong>Retomar importação</strong>.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetCaepiJob();
                    setStep("select");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-arrow-left-line"></i>
                  Escolher arquivo novamente
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 dark:text-foreground-950"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <ImportProgressStep
              job={job}
              cancelling={cancelling}
              onCancel={() => void cancelCaepiImport({ id: null, name: actorName })}
            />
          )}
        </div>
      )}

      {step === "result" && (
        <ResultStep
          job={job}
          errorsStored={errorsStored}
          downloading={downloadingErrors}
          onDownloadErrors={() => void handleDownloadErrors()}
          onFinish={() => {
            reset();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}