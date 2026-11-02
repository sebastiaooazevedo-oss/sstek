import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BrandLogo from "@/components/base/BrandLogo";
import ElectronicSignatureBlock from "@/components/base/ElectronicSignatureBlock";
import type { SignatureDisplay } from "@/pages/app/signature/signatureDisplay";
import {
  formatSealDate,
  sealCodeOf,
  sealIssuerOf,
  sealScopeLabels,
  shortSealHash,
  validateSealToken,
  type SealValidationResult,
} from "@/pages/app/signature/authenticitySeal";
import { printDocumentReceipt, printSealReceipt } from "@/pages/app/signature/sealReceipt";
import {
  documentStatusLabels,
  documentTypeLabels,
  signatureLevelLabels,
  validateDocument,
  type DocumentValidationResult,
} from "@/pages/app/signature/documentService";

const statusTone: Record<string, string> = {
  rascunho: "bg-background-200 text-foreground-700",
  aguardando: "bg-accent-100 text-accent-800",
  parcial: "bg-secondary-100 text-secondary-900",
  concluido: "bg-primary-100 text-primary-700",
  cancelado: "bg-background-200 text-foreground-500",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Situação da conferência entre o hash impresso e o hash registrado. */
type HashCheck = "empty" | "match" | "mismatch" | "incomplete" | "unavailable";

/**
 * Compara o hash informado pelo portador do papel com o hash registrado no
 * servidor. Aceita o hash completo (64 caracteres) ou a forma abreviada que
 * aparece na chancela impressa (prefixo…sufixo).
 */
function comparePrintedHash(typed: string, registered?: string | null): HashCheck {
  const raw = (typed || "").trim().toLowerCase();
  if (!raw) return "empty";
  const expected = (registered || "").trim().toLowerCase();
  if (!expected) return "unavailable";

  if (raw.includes("…") || raw.includes("...")) {
    const parts = raw.split(/…|\.\.\./);
    const prefix = (parts[0] || "").replace(/[^0-9a-f]/g, "");
    const suffix = (parts[1] || "").replace(/[^0-9a-f]/g, "");
    if (prefix.length < 6 || suffix.length < 4) return "incomplete";
    return expected.startsWith(prefix) && expected.endsWith(suffix) ? "match" : "mismatch";
  }

  const hex = raw.replace(/[^0-9a-f]/g, "");
  if (!hex) return "incomplete";
  if (hex.length !== 64) return "incomplete";
  return hex === expected ? "match" : "mismatch";
}

export default function ValidarPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DocumentValidationResult | null>(null);
  const [seal, setSeal] = useState<SealValidationResult | null>(null);
  const [hashInput, setHashInput] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSeal(null);
    setHashInput("");
    (async () => {
      if (!token) {
        setError("Token de validação ausente.");
        setLoading(false);
        return;
      }
      try {
        const data = await validateDocument(token);
        if (!active) return;
        if (data.found) {
          setResult(data);
          return;
        }
        // Não é documento assinável: tenta a chancela de autenticidade (EPI,
        // DDS, APR, ata da CIPA) pelo mesmo token do QR-Code.
        setResult(null);
        try {
          const sealData = await validateSealToken(token);
          if (!active) return;
          if (sealData.found) setSeal(sealData);
          else setResult(data);
        } catch {
          if (active) setResult(data);
        }
      } catch (err) {
        if (active) setError((err as Error).message || "Não foi possível validar o documento.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const notFound = result && !result.found && !seal?.found;
  const hashCheck: HashCheck = seal?.found ? comparePrintedHash(hashInput, seal.contentHash) : "empty";
  const divergences = result?.divergences ?? [];
  const declined = result && result.found && result.vigente === false;

  return (
    <div className="min-h-screen bg-background-100">
      <header className="border-b border-background-200 bg-background-50">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <Link to="/">
            <BrandLogo size="sm" />
          </Link>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700">
            <i className="ri-qr-scan-2-line"></i>
            Validação de documento assinado
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10">
        {loading && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-loader-4-line animate-spin text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Conferindo registros no servidor…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-accent-200 bg-accent-50 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
              <i className="ri-error-warning-line text-3xl"></i>
            </span>
            <p className="text-sm font-semibold text-accent-900">{error}</p>
          </div>
        )}

        {!loading && notFound && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
              <i className="ri-error-warning-line text-3xl"></i>
            </span>
            <h1 className="font-heading text-xl font-extrabold text-foreground-950">Documento não localizado</h1>
            <p className="max-w-md text-sm text-foreground-600">
              O token informado não corresponde a nenhum documento. Confira o QR-Code ou o endereço de validação.
            </p>
          </div>
        )}

        {!loading && seal && seal.found && (
          <>
            <div className="flex flex-col gap-4 rounded-lg border border-primary-200 bg-primary-50 p-5 sm:flex-row sm:items-center md:p-6">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-shield-check-line text-2xl"></i>
              </span>
              <div className="min-w-0">
                <p className="font-heading text-lg font-extrabold tracking-tight text-foreground-950">
                  Documento autêntico
                </p>
                <p className="mt-0.5 text-sm text-foreground-600">
                  A chancela confere com o registro do servidor: o conteúdo impresso não foi alterado.
                </p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700">
                Chancela válida
              </span>
            </div>

            {hashCheck === "mismatch" && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-300 bg-accent-50 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                  <i className="ri-error-warning-line text-xl"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-accent-900">
                    Atenção: o hash informado não confere com o registro
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-accent-800">
                    O documento em mãos pode ter sido alterado depois de chancelado, ou não é o arquivo original desta
                    validação. Não aceite este papel como prova até conferir o endereço de validação e o código de
                    verificação impressos nele, e peça a versão digital a quem emitiu.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
              <h1 className="font-heading text-lg font-extrabold tracking-tight text-foreground-950">
                {seal.label || "Documento"}
              </h1>
              <p className="mt-1 text-xs text-foreground-500">
                {seal.scope ? sealScopeLabels[seal.scope] : "Documento"}
                {seal.companyName ? ` · ${seal.companyName}` : ""}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                    Código de verificação
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] font-semibold text-foreground-800">
                    {sealCodeOf(token)}
                  </p>
                </div>
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                    Chancela emitida em
                  </p>
                  <p className="mt-0.5 text-foreground-800">{formatSealDate(seal.sealedAt)}</p>
                </div>
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                    Hash SHA-256 do conteúdo
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-foreground-800">
                    {shortSealHash(seal.contentHash)}
                  </p>
                </div>
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Signatários</p>
                  <p className="mt-0.5 text-foreground-800">{seal.signerCount ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
              <h2 className="text-sm font-bold text-foreground-950">Conferir o hash impresso no documento</h2>
              <p className="mt-1 text-xs leading-relaxed text-foreground-600">
                O rodapé do documento impresso traz o hash SHA-256 do conteúdo chancelado. Cole aqui o valor impresso
                (completo ou no formato abreviado) para comparar com o registro do servidor. Se não bater, o papel não
                corresponde a este documento.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="Ex.: 9f2c1a3b…a71b"
                  aria-label="Hash SHA-256 impresso no documento"
                  className={`min-w-0 w-full flex-1 rounded-md border bg-background-50 px-3 py-2.5 font-mono text-xs text-foreground-900 outline-none placeholder:text-foreground-400 ${
                    hashCheck === "mismatch" ? "border-accent-400" : "border-background-300 focus:border-primary-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setHashInput("")}
                  disabled={!hashInput}
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ri-eraser-line text-base"></i>
                  Limpar
                </button>
              </div>

              {hashCheck === "match" && (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-3">
                  <i className="ri-checkbox-circle-line mt-0.5 text-base text-primary-700"></i>
                  <p className="text-xs leading-relaxed text-primary-800">
                    O hash informado <strong className="font-semibold">confere</strong> com o registro desta chancela.
                    O conteúdo do documento em mãos corresponde ao que foi chancelado.
                  </p>
                </div>
              )}

              {hashCheck === "mismatch" && (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-3">
                  <i className="ri-close-circle-line mt-0.5 text-base text-accent-800"></i>
                  <p className="text-xs leading-relaxed text-accent-800">
                    O hash informado <strong className="font-semibold">não confere</strong> com o registro. O documento
                    pode ter sido editado depois da chancela ou ser de outra versão. Compare com o hash completo
                    registrado abaixo e, se a divergência persistir, não aceite o documento.
                  </p>
                </div>
              )}

              {hashCheck === "incomplete" && (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-3">
                  <i className="ri-information-line mt-0.5 text-base text-secondary-800"></i>
                  <p className="text-xs leading-relaxed text-secondary-900">
                    Informe o hash completo (64 caracteres) ou a forma abreviada como aparece na chancela, com
                    reticências entre o início e o fim (ex.: 9f2c1a3b…a71b).
                  </p>
                </div>
              )}

              {hashCheck === "unavailable" && (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-background-300 bg-background-100 px-3.5 py-3">
                  <i className="ri-information-line mt-0.5 text-base text-foreground-600"></i>
                  <p className="text-xs leading-relaxed text-foreground-700">
                    Esta chancela não tem hash de conteúdo registrado — não há como conferir o valor impresso.
                  </p>
                </div>
              )}

              <div className="mt-3 rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Hash registrado no servidor
                </p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-foreground-800">{seal.contentHash || "—"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <i className="ri-file-download-line mt-0.5 text-base text-secondary-800"></i>
                <p className="text-xs leading-relaxed text-foreground-600">
                  Baixe o comprovante desta validação em PDF para guardar ou anexar ao documento recebido. Não é preciso
                  criar conta.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  printSealReceipt({
                    token,
                    code: sealCodeOf(token),
                    label: seal.label,
                    scopeLabel: seal.scope ? sealScopeLabels[seal.scope] : "Documento",
                    companyName: seal.companyName,
                    contentHash: seal.contentHash,
                    signerCount: seal.signerCount,
                    signers: seal.signers,
                    issuer: sealIssuerOf(seal.signers),
                    sealedAt: seal.sealedAt,
                  })
                }
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-download-2-line"></i>
                Baixar comprovante
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
              <h2 className="text-sm font-bold text-foreground-950">Quem assinou</h2>
              {seal.signers && seal.signers.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {seal.signers.map((s, index) => (
                    <li
                      key={`${s.name}-${index}`}
                      className="flex items-center gap-3 rounded-md border border-background-200 bg-background-100 px-3 py-2"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                        <i className="ri-quill-pen-line"></i>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground-900">{s.name}</p>
                        {s.role && <p className="truncate text-xs text-foreground-500">{s.role}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-foreground-500">Documento chancelado sem assinatura nominal registrada.</p>
              )}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
              <i className="ri-lock-2-line mt-0.5 text-lg text-secondary-800"></i>
              <div>
                <p className="text-sm font-semibold text-secondary-900">O que esta página confirma</p>
                <p className="mt-1 text-xs leading-relaxed text-secondary-800">
                  Confirma que o arquivo apresentado corresponde ao conteúdo registrado no servidor no momento da
                  chancela. Se qualquer informação do documento for alterada, o hash deixa de conferir. Dados pessoais,
                  CPF, contatos e IP não são exibidos publicamente.
                </p>
              </div>
            </div>
          </>
        )}

        {!loading && result && result.found && (
          <>
            <div
              className={`flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center md:p-6 ${
                declined ? "border-background-300 bg-background-50" : "border-primary-200 bg-primary-50"
              }`}
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${
                  declined ? "bg-background-200 text-foreground-600" : "bg-primary-100 text-primary-700"
                }`}
              >
                <i className={declined ? "ri-forbid-2-line text-2xl" : "ri-shield-check-line text-2xl"}></i>
              </span>
              <div className="min-w-0">
                <p className="font-heading text-lg font-extrabold tracking-tight text-foreground-950">
                  {declined ? "Documento cancelado — não vigente" : "Assinatura eletrônica válida"}
                </p>
                <p className="mt-0.5 text-sm text-foreground-600">
                  {declined
                    ? "Este documento foi cancelado e não pode ser considerado vigente."
                    : "Os registros conferem com o conteúdo congelado no servidor."}
                </p>
              </div>
              <span className={`ml-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusTone[result.status || "aguardando"]}`}>
                {documentStatusLabels[result.status || "aguardando"]}
              </span>
            </div>

            {divergences.length > 0 && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-accent-300 bg-accent-50 p-4">
                <i className="ri-alert-line mt-0.5 text-lg text-accent-800"></i>
                <div>
                  <p className="text-sm font-semibold text-accent-900">Divergências sinalizadas</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-accent-800">
                    {divergences.map((d) => (
                      <li key={d}>
                        {d === "content_hash_mismatch"
                          ? "O conteúdo atual não confere com o hash registrado."
                          : d === "final_hash_missing"
                            ? "Documento concluído sem hash de PDF final registrado."
                            : d === "replacement_missing"
                              ? "Documento substituído sem vínculo com a nova versão."
                              : d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
              <h1 className="font-heading text-lg font-extrabold tracking-tight text-foreground-950">
                {result.title}
              </h1>
              <p className="mt-1 text-xs text-foreground-500">
                {documentTypeLabels[(result.docType || "outro") as keyof typeof documentTypeLabels]} · Versão{" "}
                {result.version}
                {result.companyName ? ` · ${result.companyName}` : ""}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Identificador do documento</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-foreground-800">{result.documentUid || "—"}</p>
                </div>
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Congelado em</p>
                  <p className="mt-0.5 text-foreground-800">{formatDateTime(result.submittedAt)}</p>
                </div>
                <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Concluído em</p>
                  <p className="mt-0.5 text-foreground-800">{formatDateTime(result.completedAt)}</p>
                </div>
                {declined && (
                  <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Cancelado em</p>
                    <p className="mt-0.5 text-foreground-800">
                      {formatDateTime(result.cancelledAt)}
                      {result.cancelledReason ? ` · ${result.cancelledReason}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-secondary-200 bg-secondary-50 p-5 md:p-6">
              <h2 className="text-sm font-bold text-secondary-900">Classificação da assinatura</h2>
              <p className="mt-1 text-xs leading-relaxed text-secondary-800">
                {signatureLevelLabels[(result.requiredLevel || "simples") as keyof typeof signatureLevelLabels]}
                {result.certificateRequired
                  ? " — exige certificado ICP-Brasil com validação real; sem isso a conclusão é bloqueada e nada é simulado."
                  : " — não é assinatura avançada nem qualificada. O ID identifica o ato e não é prova isolada de autenticidade."}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-5 md:p-6">
              <h2 className="text-sm font-bold text-foreground-950">Assinaturas registradas</h2>
              {result.signatures && result.signatures.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {result.signatures.map((s, i) => {
                    const display: SignatureDisplay = {
                      signatureUid: s.signatureUid,
                      signerName: s.signerName,
                      signedAt: s.signedAt,
                      timezoneDisplay: s.timezoneDisplay,
                      representationSnapshot: s.representationSnapshot,
                      level: s.signatureLevel,
                    };
                    return (
                      <div key={s.signatureUid || i} className="rounded-md border border-primary-200 bg-background-50 p-3">
                        <ElectronicSignatureBlock signature={display} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-xs text-foreground-500">Nenhuma assinatura registrada ainda.</p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <i className="ri-file-download-line mt-0.5 text-base text-secondary-800"></i>
                <p className="text-xs leading-relaxed text-foreground-600">
                  Baixe o comprovante desta validação em PDF, com o identificador do documento, a situação e quem
                  assinou. Não é preciso criar conta.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  printDocumentReceipt({
                    token,
                    title: result.title,
                    docTypeLabel:
                      documentTypeLabels[(result.docType || "outro") as keyof typeof documentTypeLabels],
                    statusLabel: documentStatusLabels[result.status || "aguardando"],
                    companyName: result.companyName,
                    documentUid: result.documentUid,
                    version: result.version,
                    submittedAt: result.submittedAt,
                    completedAt: result.completedAt,
                    cancelledAt: result.cancelledAt,
                    cancelledReason: result.cancelledReason,
                    contentHash: result.contentHash,
                    finalPdfHash: result.finalPdfHash,
                    signatures: (result.signatures || []).map((s) => ({
                      name: s.signerName,
                      role: s.representationSnapshot || null,
                      signedAt: s.signedAt,
                    })),
                  })
                }
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-download-2-line"></i>
                Baixar comprovante
              </button>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
              <i className="ri-lock-2-line mt-0.5 text-lg text-secondary-800"></i>
              <div>
                <p className="text-sm font-semibold text-secondary-900">Acesso ao conteúdo completo e às evidências</p>
                <p className="mt-1 text-xs leading-relaxed text-secondary-800">
                  Esta página pública exibe apenas informações mínimas. O conteúdo completo, os dados pessoais e o
                  relatório de evidências exigem autorização (gestor da empresa ou signatário). CPF, contatos, IP e
                  documentos de saúde não são exibidos publicamente.
                </p>
                <Link
                  to="/login"
                  className="mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                >
                  <i className="ri-shield-user-line"></i>
                  Acessar com autorização
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-background-200 bg-background-50 py-6">
        <p className="text-center text-[11px] text-foreground-400">
          SSTEK · Validação de assinatura eletrônica · informações mínimas para conferência independente
        </p>
      </footer>
    </div>
  );
}