import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSession } from "@/pages/app/context";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import BatchPdfPreviewModal from "@/pages/app/modules/documentos/components/BatchPdfPreviewModal";
import {
  clearPrintNotice,
  downloadResult,
  downloadSelectedZip,
  openResultForPrint,
  printNextInQueue,
  retryCollaborator,
  setAllResultsSelected,
  startPrintQueue,
  toggleResultChecked,
  toggleResultSelected,
  useBatchPrintState,
  type BatchResult,
} from "@/pages/app/modules/documentos/batchPrintStore";

const sourceLabels: Record<string, string> = {
  arquivo: "Arquivo original",
  imagem: "Imagem digitalizada",
  cadastro: "Dados do cadastro",
  "sem-arquivo": "Sem arquivo digital",
};

/**
 * Conferência da Impressão em Lote.
 * Nada é impresso automaticamente: o usuário confere cada dossiê (com prévia
 * de todas as páginas), marca o que conferiu, baixa o que precisa e só então
 * segue para a impressão.
 */
export default function BatchPrintConferencePage() {
  const navigate = useNavigate();
  const session = useAppSession();
  const collaborators = useCollaboratorsList();
  const documents = useDocuments();
  const { results, batchRef, generatedAt, actor, printQueue, printNotice, generating } = useBatchPrintState();

  const [preview, setPreview] = useState<BatchResult | null>(null);
  const [notice, setNotice] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  const generated = results.filter((result) => result.status === "gerado");
  const selected = generated.filter((result) => result.selected);
  const checkedCount = results.filter((result) => result.checked).length;
  const totalPages = generated.reduce((sum, result) => sum + result.pageCount, 0);

  const allSelected = generated.length > 0 && generated.every((result) => result.selected);

  const summary = useMemo(
    () => [
      { label: "Colaboradores com dossiê", value: String(generated.length), icon: "ri-user-line" },
      { label: "Páginas geradas", value: String(totalPages), icon: "ri-file-copy-2-line" },
      { label: "Conferidos", value: `${checkedCount}/${results.length}`, icon: "ri-checkbox-circle-line" },
    ],
    [generated.length, totalPages, checkedCount, results.length]
  );

  const handleZip = () => {
    const count = downloadSelectedZip();
    setNotice(
      count > 0
        ? `${count} PDF(s) selecionado(s) foram baixados em um arquivo ZIP.`
        : "Selecione ao menos um dossiê gerado para baixar o ZIP."
    );
  };

  const handlePrintSelected = () => {
    const outcome = startPrintQueue();
    if (outcome.total === 0) {
      setNotice("Selecione ao menos um dossiê gerado para seguir para a impressão.");
    }
  };

  const handleRetry = async (result: BatchResult) => {
    const collaborator = collaborators.find((c) => c.id === result.collaboratorId);
    if (!collaborator) {
      setNotice("Não foi possível localizar o colaborador deste dossiê.");
      return;
    }
    setRetrying(result.collaboratorId);
    await retryCollaborator({
      collaborator,
      documents,
      actor: session.name,
      actorEmail: session.email,
      subdomain: session.subdomain,
    });
    setRetrying(null);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-printer-cloud-line"></i>
            Documentos · Impressão em lote
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Conferência da Impressão em Lote
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-foreground-600">
            Confira cada dossiê antes de imprimir. A impressão não começa sozinha — visualize as páginas, marque
            o que já conferiu e então siga para a impressão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/app/documentos?lote=ajustar")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-equalizer-line text-base"></i>
            Voltar e ajustar a seleção
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/documentos/lotes")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-history-line text-base"></i>
            Lotes gerados
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/documentos")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-file-list-3-line text-base"></i>
            Ir para Documentos
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-printer-cloud-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum lote gerado nesta sessão</p>
          <p className="max-w-md text-xs leading-relaxed text-foreground-500">
            Os dossiês ficam disponíveis enquanto esta aba estiver aberta. Volte para Documentos, selecione os
            colaboradores e os documentos e gere novamente.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/documentos?lote=ajustar")}
            className="mt-1 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-equalizer-line"></i>
            Selecionar documentos
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summary.map((item) => (
              <div key={item.label} className="rounded-lg border border-background-200 bg-background-50 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                  <i className={`${item.icon} text-base`}></i>
                </span>
                <p className="mt-3 font-heading text-xl font-extrabold text-foreground-950">{item.value}</p>
                <p className="text-[11px] font-medium text-foreground-500">{item.label}</p>
              </div>
            ))}
            <div className="rounded-lg border border-background-200 bg-background-100 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Lote</p>
              <p className="mt-1 break-all text-sm font-bold text-foreground-900">{batchRef || "—"}</p>
              <p className="mt-1 text-[11px] text-foreground-500">
                {generatedAt || "—"}
                {actor ? ` · por ${actor}` : ""}
              </p>
            </div>
          </div>

          {notice && (
            <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
              <span className="flex-1">{notice}</span>
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => setNotice("")}
                className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}

          {printNotice && (
            <div className="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
              <i className="ri-information-line mt-0.5 text-base"></i>
              <span className="flex-1">{printNotice}</span>
              <button
                type="button"
                aria-label="Fechar aviso de impressão"
                onClick={clearPrintNotice}
                className="flex h-6 w-6 items-center justify-center rounded-md text-accent-800 transition-colors hover:bg-accent-100"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setAllResultsSelected(!allSelected)}
                className="h-4 w-4 accent-primary-500"
              />
              <span className="text-sm font-medium text-foreground-800">
                Selecionar os arquivos conferidos
                <span className="ml-1.5 text-xs font-normal text-foreground-500">
                  ({selected.length} de {generated.length} selecionado(s))
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {printQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => printNextInQueue()}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-100"
                >
                  <i className="ri-arrow-right-circle-line text-base"></i>
                  Abrir próximo ({printQueue.length})
                </button>
              )}
              <button
                type="button"
                onClick={handleZip}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-file-zip-line text-base"></i>
                Baixar selecionados (ZIP)
              </button>
              <button
                type="button"
                onClick={handlePrintSelected}
                disabled={selected.length === 0}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2.5 text-xs font-semibold text-background-50 transition-colors hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className="ri-printer-line text-base"></i>
                Continuar para impressão dos selecionados
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-background-200 bg-background-100 px-4 py-2.5 text-[11px] leading-relaxed text-foreground-600">
            <i className="ri-information-line mt-0.5 text-foreground-400"></i>
            <span>
              Os navegadores bloqueiam a abertura de várias janelas de impressão ao mesmo tempo. Por isso a
              impressão dos selecionados é feita <strong className="font-semibold">um arquivo por vez</strong>,
              na ordem da lista. Nada é marcado como impresso automaticamente — o sistema não tem como confirmar
              que a impressão foi concluída.
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {results.map((result) => {
              const failed = result.status === "falha";
              return (
                <div
                  key={result.collaboratorId}
                  className={`rounded-lg border bg-background-50 ${
                    result.checked
                      ? "border-primary-300"
                      : failed
                        ? "border-accent-300"
                        : "border-background-200"
                  }`}
                >
                  <div className="flex flex-col gap-3 border-b border-background-200 px-4 py-3.5 md:flex-row md:items-start md:justify-between md:px-5">
                    <div className="flex min-w-0 items-start gap-3">
                      {!failed && (
                        <input
                          type="checkbox"
                          checked={result.selected}
                          onChange={() => toggleResultSelected(result.collaboratorId)}
                          aria-label={`Selecionar dossiê de ${result.collaboratorName}`}
                          className="mt-1 h-4 w-4 shrink-0 accent-primary-500"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground-950">{result.collaboratorName}</p>
                        <p className="truncate text-xs text-foreground-500">{result.collaboratorRole || "—"}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground-500">
                          <span className="inline-flex items-center gap-1 rounded-md bg-background-100 px-2 py-0.5 font-mono text-[10px] text-foreground-700">
                            <i className="ri-file-pdf-2-line"></i>
                            {result.fileName}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <i className="ri-file-copy-2-line"></i>
                            {result.pageCount} página(s)
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              failed ? "bg-accent-100 text-accent-900" : "bg-primary-100 text-primary-700"
                            }`}
                          >
                            <i className={failed ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
                            {failed ? "Falhou" : "Gerado"}
                          </span>
                          {result.checked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                              <i className="ri-check-double-line"></i>
                              Conferido
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100">
                        <input
                          type="checkbox"
                          checked={result.checked}
                          onChange={() => toggleResultChecked(result.collaboratorId)}
                          className="h-3.5 w-3.5 accent-primary-500"
                        />
                        Conferido
                      </label>
                      <button
                        type="button"
                        disabled={failed || !result.url}
                        onClick={() => setPreview(result)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-40"
                      >
                        <i className="ri-eye-line"></i>
                        Visualizar PDF
                      </button>
                      <button
                        type="button"
                        disabled={failed}
                        onClick={() => downloadResult(result.collaboratorId)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-40"
                      >
                        <i className="ri-download-2-line"></i>
                        Baixar
                      </button>
                      <button
                        type="button"
                        disabled={failed}
                        onClick={() => {
                          const opened = openResultForPrint(result.collaboratorId);
                          setNotice(
                            opened
                              ? "PDF aberto em nova aba. Use o ícone de impressão do visualizador para imprimir."
                              : "O navegador bloqueou a abertura do PDF. Libere pop-ups para este site."
                          );
                        }}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-2.5 py-2 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-40"
                      >
                        <i className="ri-printer-line"></i>
                        Imprimir
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3.5 md:px-5">
                    {failed ? (
                      <div className="flex flex-col gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3">
                        <p className="text-xs font-semibold text-accent-900">
                          {result.error || "Não foi possível gerar este dossiê."}
                        </p>
                        <p className="text-[11px] text-accent-800">
                          Os documentos originais não foram alterados. Corrija a pendência e tente novamente
                          apenas este colaborador.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRetry(result)}
                          disabled={retrying === result.collaboratorId || generating}
                          className="mt-1 inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-accent-900 transition-colors hover:bg-accent-100 disabled:opacity-50"
                        >
                          <i
                            className={
                              retrying === result.collaboratorId ? "ri-loader-4-line animate-spin" : "ri-refresh-line"
                            }
                          ></i>
                          Tentar novamente
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                          Documentos incluídos, na ordem
                        </p>
                        <ol className="mt-2 flex flex-col gap-1.5">
                          {result.items.map((item, index) => (
                            <li
                              key={`${item.typeId}-${item.documentId}`}
                              className="flex flex-wrap items-center gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[10px] font-bold text-secondary-900">
                                {index + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold text-foreground-900">
                                  {item.typeName}
                                </span>
                                <span className="block truncate text-[11px] text-foreground-500">
                                  {item.name} · {item.versionLabel} · emitido em {item.issuedAt}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-medium text-foreground-600">
                                {sourceLabels[item.source] || item.source}
                              </span>
                              <span className="shrink-0 text-[10px] text-foreground-500">
                                {item.pages} pág.
                              </span>
                            </li>
                          ))}
                        </ol>

                        {result.pendencies.length > 0 && (
                          <div className="mt-2.5 rounded-md border border-accent-200 bg-accent-50/70 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-accent-800">
                              Pendências e avisos
                            </p>
                            <ul className="mt-1 flex flex-col gap-1">
                              {result.pendencies.map((pendency) => (
                                <li
                                  key={pendency}
                                  className="flex items-start gap-1.5 text-[11px] leading-relaxed text-accent-900"
                                >
                                  <i className="ri-error-warning-line mt-0.5"></i>
                                  <span>{pendency}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-100 px-4 py-3 text-[11px] leading-relaxed text-foreground-600">
            <i className="ri-shield-check-line mt-0.5 text-base text-primary-700"></i>
            <div className="flex flex-col gap-1">
              <p>
                Os PDFs reunidos são cópias para apresentação e impressão. Eles não preservam a validade
                criptográfica das assinaturas eletrônicas dos arquivos originais — a validade é conferida no
                original, que segue disponível no cadastro do colaborador.
              </p>
              <p>
                Os arquivos gerados ficam apenas nesta sessão do navegador. O sistema registra quem gerou, quais
                documentos e versões entraram e quando. A marcação “Conferido” é uma checagem operacional e não
                representa assinatura eletrônica.
              </p>
            </div>
          </div>
        </>
      )}

      <BatchPdfPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        url={preview?.url}
        fileName={preview?.fileName || ""}
        pageCount={preview?.pageCount || 0}
        onDownload={() => preview && downloadResult(preview.collaboratorId)}
      />
    </div>
  );
}