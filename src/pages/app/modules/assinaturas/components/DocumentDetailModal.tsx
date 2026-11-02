import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton, inputClass } from "@/pages/app/components/Modal";
import type { SignatureActor } from "@/pages/app/signature/signatureService";
import {
  cancelDocumentAction,
  issueChallengeAction,
  reportDivergenceAction,
  signDocumentAction,
  substituteDocumentAction,
  useDocumentSignatures,
} from "@/pages/app/signature/documentStore";
import type { IssuedChallenge } from "@/pages/app/signature/documentService";
import {
  declarationLabelFor,
  declarationTextFor,
  documentStatusLabels,
  documentTypeLabels,
  signatureLevelLabels,
  type SignatureDocument,
} from "@/pages/app/signature/documentService";
import { exportDocumentPdf, documentSealFor } from "@/pages/app/signature/documentPdf";
import { formatSealDate } from "@/pages/app/signature/authenticitySeal";
import type { SignatureDisplay } from "@/pages/app/signature/signatureDisplay";
import SealPreview from "@/components/feature/SealPreview";
import DocumentSheet from "./DocumentSheet";

interface DocumentDetailModalProps {
  doc: SignatureDocument | null;
  onClose: () => void;
  actor: SignatureActor;
  onChanged: (message: string) => void;
}

const statusTone: Record<string, string> = {
  rascunho: "bg-background-200 text-foreground-700",
  aguardando: "bg-accent-100 text-accent-800",
  parcial: "bg-secondary-100 text-secondary-900",
  concluido: "bg-primary-100 text-primary-700",
  cancelado: "bg-background-200 text-foreground-500",
};

export default function DocumentDetailModal({ doc, onClose, actor, onChanged }: DocumentDetailModalProps) {
  const signatures = useDocumentSignatures(doc?.id ?? null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [working, setWorking] = useState(false);
  const [challenge, setChallenge] = useState<IssuedChallenge | null>(null);
  const [code, setCode] = useState("");
  const [divergenceOpen, setDivergenceOpen] = useState(false);
  const [divergenceText, setDivergenceText] = useState("");

  useEffect(() => {
    setError("");
    setInfo("");
    setWorking(false);
    setChallenge(null);
    setCode("");
    setDivergenceOpen(false);
    setDivergenceText("");
  }, [doc?.id]);

  const signaturesBySignatory = useMemo(() => {
    const map: Record<string, SignatureDisplay> = {};
    signatures.forEach((s) => {
      if (!s.signatoryId) return;
      map[s.signatoryId] = {
        signatureUid: s.signatureUid,
        signerName: s.signerName,
        signedAt: s.signedAt,
        timezoneDisplay: s.timezoneDisplay,
        representationSnapshot: s.representationSnapshot,
        level: s.signatureLevel,
      };
    });
    return map;
  }, [signatures]);

  const mySignatory = useMemo(
    () => doc?.signatories.find((s) => s.collaboratorRef === actor.collaboratorRef) ?? null,
    [doc, actor.collaboratorRef]
  );

  const canSign =
    !!doc &&
    !!mySignatory &&
    mySignatory.status === "pendente" &&
    (doc.status === "aguardando" || doc.status === "parcial");
  const canManage = !!doc && (doc.status === "aguardando" || doc.status === "parcial");
  const canSubstitute = !!doc && !doc.supersededByDocumentId && doc.status !== "rascunho";

  if (!doc) return null;

  const signedCount = doc.signatories.filter((s) => s.status === "assinado").length;
  const seal = documentSealFor(doc);

  const handleIssueChallenge = async () => {
    setWorking(true);
    setError("");
    setInfo("");
    try {
      const issued = await issueChallengeAction(actor, doc.id);
      setChallenge(issued);
      setCode("");
      setInfo(
        `Código de uso único enviado para ${issued.maskedContact}. Validade de 10 minutos e limite de ${issued.maxAttempts} tentativas.`
      );
    } catch (err) {
      setError((err as Error).message || "Não foi possível emitir o desafio de autenticação.");
    } finally {
      setWorking(false);
    }
  };

  const handleSign = async () => {
    if (!challenge) {
      await handleIssueChallenge();
      return;
    }
    if (code.trim().length < 6) {
      setError("Informe o código de 6 dígitos recebido no contato verificado.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await signDocumentAction(actor, { documentId: doc.id, challengeId: challenge.challengeId, code: code.trim() });
      setChallenge(null);
      setCode("");
      onChanged("Assinatura registrada com sucesso no servidor, vinculada à versão do documento.");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível assinar o documento.");
    } finally {
      setWorking(false);
    }
  };

  const handleDivergence = async () => {
    if (!divergenceText.trim()) {
      setError("Descreva a divergência encontrada.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await reportDivergenceAction(actor, { documentId: doc.id, message: divergenceText.trim() });
      setDivergenceOpen(false);
      setDivergenceText("");
      onChanged("Divergência registrada. Nenhuma concordância foi registrada.");
    } catch (err) {
      setError((err as Error).message || "Não foi possível registrar a divergência.");
    } finally {
      setWorking(false);
    }
  };

  const handleCancel = async () => {
    setWorking(true);
    setError("");
    try {
      await cancelDocumentAction(actor, { documentId: doc.id, reason: "cancelado pelo gestor" });
      onChanged("Documento cancelado. As evidências anteriores foram preservadas.");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível cancelar o documento.");
    } finally {
      setWorking(false);
    }
  };

  const handleSubstitute = async () => {
    setWorking(true);
    setError("");
    try {
      await substituteDocumentAction(actor, doc.id);
      onChanged("Nova versão criada por substituição. O documento anterior foi preservado com suas evidências.");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível substituir o documento.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      size="xl"
      icon="ri-file-shield-2-line"
      title={doc.title}
      subtitle={`${documentTypeLabels[doc.docType]} · Versão ${doc.version} · ${signedCount}/${doc.signatories.length} assinaturas`}
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={() => exportDocumentPdf(doc, signaturesBySignatory)} icon="ri-download-2-line">
            Baixar documento
          </ModalButton>
          {canManage && (
            <ModalButton variant="ghost" onClick={handleCancel} icon="ri-forbid-2-line">
              Cancelar
            </ModalButton>
          )}
          {canSubstitute && (
            <ModalButton variant="ghost" onClick={handleSubstitute} icon="ri-file-copy-2-line">
              Substituir (nova versão)
            </ModalButton>
          )}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone[doc.status]}`}>
              {documentStatusLabels[doc.status]}
            </span>
            {doc.supersedesDocumentId && (
              <span className="rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                Substitui versão anterior
              </span>
            )}
            {doc.supersededByDocumentId && (
              <span className="rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-800">
                Substituído por nova versão
              </span>
            )}
          </div>
          <DocumentSheet doc={doc} signaturesBySignatory={signaturesBySignatory} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
              Declaração · {declarationLabelFor(doc.declarationType)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground-800">
              {doc.declarationText || declarationTextFor(doc.declarationType)}
            </p>
          </div>

          <div className="rounded-lg border border-background-200 bg-background-50 p-4">
            <p className="text-xs font-semibold text-foreground-700">Signatários</p>
            <ul className="mt-3 flex flex-col gap-2">
              {doc.signatories.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-md border border-background-200 px-3 py-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold ${
                      s.status === "assinado" ? "bg-primary-100 text-primary-700" : "bg-background-100 text-foreground-500"
                    }`}
                  >
                    <i className={s.status === "assinado" ? "ri-check-line" : "ri-time-line"}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-900">
                      {s.name}
                      {mySignatory?.id === s.id && <span className="ml-1 text-[10px] font-bold text-primary-600">(você)</span>}
                    </p>
                    <p className="truncate text-[11px] text-foreground-500">
                      {s.roleLabel || "—"} · {s.status === "assinado" ? "Assinado" : "Pendente"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {info && (
            <div className="flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-xs text-primary-800">
              <i className="ri-shield-keyhole-line mt-0.5 text-base"></i>
              <div>
                {info}
                {challenge?.devCode && (
                  <p className="mt-1 font-semibold">
                    Modo demonstração — código: <span className="tracking-widest">{challenge.devCode}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {canSign && (
            <div className="rounded-lg border border-primary-300 bg-primary-50 p-4">
              <p className="text-sm font-semibold text-primary-900">Assinatura eletrônica</p>
              <p className="mt-1 text-xs leading-relaxed text-primary-900/90">
                Antes de confirmar, visualize e baixe o documento completo. A assinatura exige uma ação explícita e
                autenticação adicional com código de uso único no seu contato verificado.
              </p>

              {challenge && (
                <div className="mt-3">
                  <label className="text-[11px] font-semibold text-primary-900">Código de uso único</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="000000"
                    className={`${inputClass} mt-1 tracking-[0.4em]`}
                  />
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={handleSign}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                >
                  <i className="ri-fingerprint-line"></i>
                  {working ? "Processando..." : challenge ? "Confirmar assinatura" : "Assinar com autenticação"}
                </button>
                <button
                  type="button"
                  onClick={() => setDivergenceOpen((v) => !v)}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-error-warning-line"></i>
                  Informar divergência
                </button>
              </div>

              {divergenceOpen && (
                <div className="mt-3 rounded-md border border-accent-200 bg-background-50 p-3">
                  <p className="text-[11px] leading-relaxed text-foreground-500">
                    A divergência é registrada <strong className="font-semibold">sem</strong> registrar concordância
                    com o documento.
                  </p>
                  <textarea
                    value={divergenceText}
                    onChange={(e) => setDivergenceText(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Descreva o que está divergente…"
                    className={`${inputClass} mt-2 resize-none`}
                  />
                  <button
                    type="button"
                    disabled={working}
                    onClick={handleDivergence}
                    className="mt-2 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600 disabled:opacity-60"
                  >
                    <i className="ri-send-plane-line"></i>
                    Registrar divergência
                  </button>
                </div>
              )}
            </div>
          )}

          {mySignatory?.status === "assinado" && (
            <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-xs text-primary-800">
              <i className="ri-checkbox-circle-line text-base"></i>
              Você já assinou esta versão. Outros signatários continuam autorizados.
            </div>
          )}

          <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
            <p className="text-xs font-semibold text-secondary-900">Classificação da assinatura</p>
            <p className="mt-1 text-[11px] leading-relaxed text-secondary-800">
              {signatureLevelLabels[doc.requiredLevel]}
              {doc.certificateRequired
                ? " — a política exige certificado. Sem integração e validação reais (ICP-Brasil), a conclusão fica bloqueada; nenhum certificado ou selo é simulado."
                : " — o método atual (representação visual + código de uso único) não é assinatura avançada nem qualificada."}
            </p>
          </div>

          <div className="rounded-lg border border-background-200 bg-background-100 p-4 text-[11px] leading-relaxed text-foreground-500">
            <p className="font-semibold text-foreground-700">Integridade e preservação (servidor)</p>
            <p className="mt-1 break-all">Documento (UUID): {doc.documentUid || doc.id}</p>
            <p className="break-all">Conteúdo: {doc.contentHash || "—"}</p>
            <p className="break-all">PDF-base: {doc.basePdfHash || "—"}</p>
            <p className="break-all">PDF final: {doc.finalPdfHash || "—"}</p>
            <p className="break-all">Relatório de evidências: {doc.evidenceReportHash || "—"}</p>
          </div>

          <SealPreview
            seal={seal}
            loading={false}
            revoked={doc.status === "cancelado"}
            revokedNote={
              doc.status === "cancelado"
                ? [
                    doc.cancelledAt ? `Cancelado em ${formatSealDate(doc.cancelledAt)}` : "Cancelado pelo gestor",
                    doc.cancelledReason ? `motivo: ${doc.cancelledReason}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") + "."
                : undefined
            }
            blockedReason={
              seal
                ? undefined
                : "A chancela é emitida quando o documento é congelado e recebe a primeira assinatura. Enquanto estiver em rascunho ou sem assinatura registrada, não existe selo para imprimir."
            }
          />
        </div>
      </div>
    </Modal>
  );
}