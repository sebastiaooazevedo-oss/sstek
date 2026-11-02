import { CAEPI_FIELDS, DELIMITER_OPTIONS, type CaepiAnalysis, type CaepiFieldKey, type CaepiMapping } from "./types";
import { formatBytes } from "@/pages/app/modules/config/caepiBaseStore";

interface MappingStepProps {
  analysis: CaepiAnalysis;
  delimiter: string;
  onDelimiterChange: (value: string) => void;
  encoding: "utf-8" | "windows-1252";
  onEncodingChange: (value: "utf-8" | "windows-1252") => void;
  headers: string[];
  previewRows: string[][];
  mapping: CaepiMapping;
  onMappingChange: (field: CaepiFieldKey, index: number) => void;
  dedupeFields: CaepiFieldKey[];
  onDedupeToggle: (field: CaepiFieldKey) => void;
}

const selectClass =
  "w-full appearance-none rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-xs text-foreground-900 outline-none transition-colors focus:border-primary-400";

export default function MappingStep({
  analysis,
  delimiter,
  onDelimiterChange,
  encoding,
  onEncodingChange,
  headers,
  previewRows,
  mapping,
  onMappingChange,
  dedupeFields,
  onDedupeToggle,
}: MappingStepProps) {
  const previewColumns = Math.min(headers.length, 10);
  const mappedFields = CAEPI_FIELDS.filter((field) => {
    const index = mapping[field.key];
    return index !== undefined && index >= 0;
  });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-background-200 bg-background-100/70 p-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-foreground-700">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground-900">
            <i className="ri-file-text-line"></i>
            {analysis.fileName}
          </span>
          <span>{formatBytes(analysis.fileSize)}</span>
          {analysis.isGzip && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 font-medium text-secondary-900">
              .gz convertido no navegador · {formatBytes(analysis.totalBytes)} de CSV
            </span>
          )}
          <span>{headers.length} coluna(s)</span>
          <span>{analysis.parts.length} parte(s) de envio</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-foreground-700">Separador identificado</span>
            <select
              value={delimiter}
              onChange={(event) => onDelimiterChange(event.target.value)}
              className={selectClass}
            >
              {DELIMITER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-foreground-500">
              Identificado automaticamente. Confira na prévia abaixo antes de continuar.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-foreground-700">Codificação do arquivo</span>
            <select
              value={encoding}
              onChange={(event) => onEncodingChange(event.target.value as "utf-8" | "windows-1252")}
              className={selectClass}
            >
              <option value="utf-8">UTF-8 (recomendado)</option>
              <option value="windows-1252">Windows-1252 / ISO-8859-1</option>
            </select>
            <span className="text-[11px] text-foreground-500">
              {encoding === "utf-8" ? "Detectado como UTF-8." : "Detectado fora do UTF-8 — acentos preservados com Win-1252."}
            </span>
          </label>
        </div>
        {analysis.encodingWarning && (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-accent-100 px-2.5 py-2 text-[11px] text-accent-900">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{analysis.encodingWarning}</span>
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground-900">Prévia do arquivo</h3>
          <span className="text-[11px] text-foreground-500">
            Cabeçalho + {previewRows.length} linha(s) de amostra{headers.length > previewColumns ? " · colunas cortadas" : ""}
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[720px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-background-100">
                <th className="whitespace-nowrap border-b border-background-200 px-2.5 py-2 text-left font-semibold text-foreground-500">
                  #
                </th>
                {headers.slice(0, previewColumns).map((header, index) => (
                  <th
                    key={`h-${index}`}
                    className="max-w-[180px] truncate border-b border-background-200 px-2.5 py-2 text-left font-semibold text-foreground-800"
                    title={header}
                  >
                    {header || `Coluna ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={`r-${rowIndex}`} className="odd:bg-background-50 even:bg-background-100/50">
                  <td className="border-b border-background-200 px-2.5 py-1.5 text-foreground-400">{rowIndex + 1}</td>
                  {headers.slice(0, previewColumns).map((_, cellIndex) => (
                    <td
                      key={`c-${rowIndex}-${cellIndex}`}
                      className="max-w-[180px] truncate border-b border-background-200 px-2.5 py-1.5 text-foreground-700"
                      title={row[cellIndex] ?? ""}
                    >
                      {row[cellIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground-900">Mapeamento de colunas</h3>
        <p className="mt-0.5 text-[11px] text-foreground-500">
          Diga qual coluna do arquivo corresponde a cada campo do sistema. Nenhum valor é convertido: o texto original
          (inclusive zeros à esquerda) é gravado como está.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {CAEPI_FIELDS.map((field) => {
            const value = mapping[field.key];
            return (
              <label key={field.key} className="flex flex-col gap-1 rounded-md border border-background-200 px-3 py-2">
                <span className="flex items-center gap-1 text-xs font-semibold text-foreground-800">
                  {field.label}
                  {field.key === "ca" && <span className="text-accent-600">*</span>}
                </span>
                <select
                  value={value === undefined ? -1 : value}
                  onChange={(event) => onMappingChange(field.key, Number(event.target.value))}
                  className={selectClass}
                >
                  <option value={-1}>— não mapear —</option>
                  {headers.map((header, index) => (
                    <option key={`m-${field.key}-${index}`} value={index}>
                      {index + 1}. {header || "(sem título)"}
                    </option>
                  ))}
                </select>
                {field.hint && <span className="text-[10px] text-foreground-400">{field.hint}</span>}
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-background-200 bg-background-100/70 p-3.5">
        <h3 className="text-sm font-semibold text-foreground-900">Chave de identificação</h3>
        <p className="mt-0.5 text-[11px] text-foreground-500">
          A combinação escolhida identifica cada registro no lote. Ela evita duplicidade ao reimportar o mesmo arquivo.
          O número do CA sozinho não é suficiente: o mesmo CA aparece várias vezes (fabricante/processo diferentes).
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {mappedFields.map((field) => {
            const checked = dedupeFields.includes(field.key);
            return (
              <button
                key={`d-${field.key}`}
                type="button"
                onClick={() => onDedupeToggle(field.key)}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  checked
                    ? "bg-primary-500 text-background-50 dark:text-foreground-950"
                    : "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className={checked ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}></i>
                {field.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-foreground-500">
          Chave atual:{" "}
          <strong className="text-foreground-800">
            {mappedFields
              .filter((field) => dedupeFields.includes(field.key))
              .map((field) => field.label)
              .join(" + ") || "nenhuma selecionada"}
          </strong>
        </p>
      </div>
    </div>
  );
}