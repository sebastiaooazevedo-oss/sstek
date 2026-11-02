import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignatureStamp from "@/components/base/SignatureStamp";
import { useCollaboratorSignature } from "@/pages/app/signature/signatureStore";
import {
  resolveRegulationFileUrl,
  signRegulation,
  type InternalRegulation,
  type RegulationSignatureRecord,
} from "@/pages/app/modules/regulamento/regulationStore";

interface ReaderSigner {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface RegulationReaderProps {
  regulation: InternalRegulation;
  signature: RegulationSignatureRecord | null;
  signer: ReaderSigner | null;
  preview?: boolean;
  onSigned?: () => void;
}

const DECLARATION =
  "Declaro que li integralmente todas as páginas deste Regulamento Interno, compreendi as regras nele estabelecidas e estou ciente de que o descumprimento pode gerar as medidas disciplinares previstas no documento.";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RegulationReader({
  regulation,
  signature,
  signer,
  preview = false,
  onSigned,
}: RegulationReaderProps) {
  const totalPages = Math.max(regulation.pageCount, regulation.contentPages.length, 1);
  const [page, setPage] = useState(1);
  const [maxReached, setMaxReached] = useState(1);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const stamp = useCollaboratorSignature(signer?.id);

  useEffect(() => {
    setPage(1);
    setMaxReached(1);
    setNotice("");
    setError("");
  }, [regulation.id]);

  useEffect(() => {
    let active = true;
    setFileUrl(null);
    if (!regulation.storagePath) return () => {
      active = false;
    };
    setLoadingFile(true);
    resolveRegulationFileUrl(regulation)
      .then((url) => {
        if (active) setFileUrl(url);
      })
      .finally(() => {
        if (active) setLoadingFile(false);
      });
    return () => {
      active = false;
    };
  }, [regulation]);

  const currentContent = useMemo(
    () => regulation.contentPages[page - 1] ?? null,
    [regulation.contentPages, page]
  );

  const goNext = () => {
    if (page >= totalPages) return;
    const next = page + 1;
    setPage(next);
    setMaxReached((value) => Math.max(value, next));
  };

  const goPrev = () => {
    if (page <= 1) return;
    setPage(page - 1);
  };

  const reachedEnd = maxReached >= totalPages;
  const alreadySigned = Boolean(signature);

  const handleSign = async () => {
    if (!signer) return;
    setSaving(true);
    setError("");
    try {
      await signRegulation({
        regulation,
        collaboratorId: signer.id,
        collaboratorName: signer.name,
        collaboratorEmail: signer.email,
        collaboratorRole: signer.role,
        pagesRead: maxReached,
        declaration: DECLARATION,
      });
      setConfirmOpen(false);
      setAccepted(false);
      setNotice("Assinatura registrada. O administrador já consegue ver que você leu e assinou este regulamento.");
      onSigned?.();
    } catch (err) {
      setError((err as Error).message || "Não foi possível registrar a assinatura.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho do documento */}
      <div className="rounded-lg border border-background-200 bg-background-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                <i className="ri-book-read-line"></i>
                Versão {regulation.version}
              </span>
              {regulation.status === "substituido" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-600">
                  <i className="ri-forbid-2-line"></i>
                  Não vigente
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-800">
                  <i className="ri-shield-check-line"></i>
                  Versão vigente
                </span>
              )}
              <span className="rounded-full bg-background-100 px-2.5 py-0.5 text-[11px] font-medium text-foreground-600">
                {totalPages} página(s)
              </span>
              {regulation.fileSize && (
                <span className="rounded-full bg-background-100 px-2.5 py-0.5 text-[11px] font-medium text-foreground-600">
                  PDF · {regulation.fileSize}
                </span>
              )}
            </div>
            <h2 className="mt-2 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
              {regulation.title}
            </h2>
            {regulation.summary && (
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground-600">{regulation.summary}</p>
            )}
            <p className="mt-2 text-[11px] text-foreground-400">
              Publicado em {formatDateTime(regulation.publishedAt)}
              {regulation.publishedBy ? ` por ${regulation.publishedBy}` : ""}
            </p>
          </div>

          {alreadySigned ? (
            <div className="shrink-0 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 lg:w-72">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-800">
                <i className="ri-checkbox-circle-line"></i>
                Assinatura registrada
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-primary-700">
                Você leu e assinou esta versão em {formatDateTime(signature?.signedAt)}.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Área de leitura */}
      <div className="overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 bg-background-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={page <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Página anterior"
            >
              <i className="ri-arrow-left-s-line text-lg"></i>
            </button>
            <span className="text-xs font-semibold text-foreground-700">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={page >= totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Próxima página"
            >
              <i className="ri-arrow-right-s-line text-lg"></i>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-background-200 sm:block">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${Math.round((maxReached / totalPages) * 100)}%` }}
              ></div>
            </div>
            <span className="text-[11px] font-medium text-foreground-500">
              {maxReached} de {totalPages} folheadas
            </span>
          </div>
        </div>

        {loadingFile ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-foreground-500">
              <i className="ri-loader-4-line animate-spin text-lg"></i>
              Carregando o PDF…
            </div>
          </div>
        ) : fileUrl ? (
          <div className="bg-background-200/60 p-3 sm:p-5">
            <iframe
              key={`${regulation.id}-${page}`}
              src={`${fileUrl}#page=${page}&view=FitH&toolbar=0&navpanes=0`}
              title={`${regulation.title} · página ${page}`}
              className="h-[62vh] min-h-[420px] w-full rounded-md border border-background-300 bg-background-50"
            />
            <p className="mt-2 text-center text-[11px] text-foreground-400">
              Se o visualizador não carregar, use o botão “Abrir PDF” no topo da página.
            </p>
          </div>
        ) : currentContent ? (
          <div className="bg-background-200/60 p-3 sm:p-5">
            <article className="mx-auto min-h-[460px] w-full max-w-3xl rounded-md border border-background-200 bg-background-50 px-7 py-8 sm:px-10 sm:py-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
                Regulamento Interno · versão {regulation.version}
              </p>
              <h3 className="mt-3 font-heading text-lg font-extrabold tracking-tight text-foreground-950 sm:text-xl">
                {currentContent.heading}
              </h3>
              <div className="mt-4 flex flex-col gap-3">
                {currentContent.paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-relaxed text-foreground-700">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-background-200 pt-3 text-[11px] text-foreground-400">
                <span>{regulation.title}</span>
                <span>
                  Página {page} de {totalPages}
                </span>
              </div>
            </article>
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-file-warning-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Arquivo do regulamento indisponível</p>
            <p className="max-w-md text-xs leading-relaxed text-foreground-500">
              Não foi possível carregar o conteúdo desta versão. Fale com o administrador da sua empresa.
            </p>
          </div>
        )}
      </div>

      {/* Gate de assinatura */}
      {!preview && !alreadySigned && (
        <div
          className={`rounded-lg border p-5 ${
            reachedEnd ? "border-primary-200 bg-primary-50" : "border-background-200 bg-background-50"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  reachedEnd ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-400"
                }`}
              >
                <i className={`${reachedEnd ? "ri-checkbox-circle-line" : "ri-book-open-line"} text-xl`}></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-950">
                  {reachedEnd
                    ? "Você chegou ao fim do regulamento"
                    : "Folheie todas as páginas para liberar a assinatura"}
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-600">
                  {reachedEnd
                    ? "Confirme a leitura para registrar sua assinatura de ciência. A ação fica visível para o administrador."
                    : `Você já folheou ${maxReached} de ${totalPages} página(s). Use a seta “próxima página” no leitor acima até a última página.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!reachedEnd || !signer}
              onClick={() => {
                setAccepted(false);
                setConfirmOpen(true);
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="ri-quill-pen-line text-base"></i>
              Assinar regulamento
            </button>
          </div>
          {!signer && (
            <p className="mt-3 flex items-start gap-2 text-[11px] text-foreground-500">
              <i className="ri-information-line mt-0.5"></i>
              Para assinar, é necessário estar identificado como colaborador da empresa.
            </p>
          )}
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
        }}
        size="lg"
        icon="ri-quill-pen-line"
        title="Assinar Regulamento Interno"
        subtitle={`${regulation.title} · versão ${regulation.version}`}
        footer={
          <>
            <ModalButton
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={saving}
            >
              Voltar à leitura
            </ModalButton>
            <ModalButton
              icon={saving ? "ri-loader-4-line" : "ri-check-line"}
              onClick={handleSign}
              disabled={saving || !accepted}
            >
              {saving ? "Registrando..." : "Confirmar assinatura"}
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-background-200 bg-background-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Declaração</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground-700">{DECLARATION}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
              <i className="ri-book-open-line"></i>
              {maxReached} de {totalPages} páginas lidas
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
              <i className="ri-user-line"></i>
              {signer?.name ?? "—"}
            </span>
          </div>

          <div className="flex min-h-[110px] items-center justify-center rounded-lg border border-dashed border-primary-300 bg-primary-50 px-6 py-4">
            {stamp ? (
              <SignatureStamp
                name={signer?.name ?? ""}
                font={stamp.fontModel}
                nameStyle={stamp.nameStyle}
                imageData={stamp.imageData}
                size={44}
              />
            ) : (
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground-700">{signer?.name ?? "—"}</p>
                <p className="mt-1 text-[11px] text-foreground-500">
                  Sua assinatura pessoal ainda não foi criada. A ciência será registrada com seu nome, data e hora.
                </p>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-background-200 bg-background-50 px-4 py-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-background-300 text-primary-500 focus:ring-primary-400"
            />
            <span className="text-xs leading-relaxed text-foreground-700">
              Confirmo que li todas as páginas deste regulamento e que a assinatura registra minha ciência sobre o
              conteúdo.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}