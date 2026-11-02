import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { Link } from "react-router-dom";
import QrCode, { fiscalizacaoUrl } from "@/pages/app/modules/qrcodes/components/QrCode";
import QrPrintDialog, { stickerFormatLabel } from "@/pages/app/modules/qrcodes/components/QrPrintDialog";
import { qrScanStatus } from "@/pages/app/modules/qrcodes/qrScanStatus";
import { StatusPill } from "@/pages/app/components/ui";
import { getInitials, useAppSession } from "@/pages/app/context";
import SignatureStamp from "@/components/base/SignatureStamp";
import { useCollaboratorSignature } from "@/pages/app/signature/signatureStore";
import { getSignatureFont } from "@/pages/app/signature/signatureFonts";
import type { Collaborator } from "@/mocks/collaborators";
import { collaborators as allCollaborators } from "@/mocks/collaborators";
import type { DocumentRecord } from "@/mocks/documents";
import type { EpiDelivery } from "@/mocks/epi";
import { useEpis } from "@/pages/app/modules/epi/epiStore";
import EpiDetailModal from "@/pages/app/modules/epi/components/EpiDetailModal";
import { removeDocument, resolveDocumentUrl, useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import { useStructuredDocuments } from "@/pages/app/modules/documentos/structured/structuredStore";
import { buildStructuredPdfBody } from "@/pages/app/modules/documentos/structured/structuredPdf";
import { catBelongsToCollaborator } from "@/pages/app/modules/documentos/structured/cat/catInvestigation";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";
import { fileIcon, fileIconTone, validityBucket, type ValidityBucket } from "@/pages/app/modules/documentos/documentUtils";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { printHtml } from "@/pages/app/utils/exportPdf";
import {
  useMedicalCertificates,
  type MedicalCertificate,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import CertificateViewerModal from "@/pages/app/modules/meusdocumentos/components/CertificateViewerModal";
import MedicalFollowupModal from "@/pages/app/modules/meusdocumentos/components/MedicalFollowupModal";
import { printMedicalCertificatePdf } from "@/pages/app/modules/meusdocumentos/certificatePdf";
import { useMedicalFollowups } from "@/pages/app/modules/meusdocumentos/followupStore";
import { isoToBr } from "@/pages/app/modules/meusdocumentos/certificateInsights";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { useState } from "react";

interface CollaboratorDetailModalProps {
  open: boolean;
  onClose: () => void;
  collaborator: Collaborator | null;
  onEdit: (collaborator: Collaborator) => void;
  /** Liberado pelo perfil do usuário (permissão `collaborators.edit`). */
  canEdit?: boolean;
}

export default function CollaboratorDetailModal({
  open,
  onClose,
  collaborator,
  onEdit,
  canEdit = true,
}: CollaboratorDetailModalProps) {
  const signatureConfig = useCollaboratorSignature(collaborator?.id);
  const session = useAppSession();
  const { can } = usePermissions();
  const documents = useDocuments();
  // CATs emitidas para este colaborador (vínculo direto ou por CPF).
  const structuredRecords = useStructuredDocuments();
  const epis = useEpis();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Impressão do adesivo do QR-Code direto da ficha.
  const [printingQr, setPrintingQr] = useState(false);
  const [qrNotice, setQrNotice] = useState("");
  const [viewingDelivery, setViewingDelivery] = useState<EpiDelivery | null>(null);
  const [fichaNotice, setFichaNotice] = useState("");
  const [docFilter, setDocFilter] = useState<"todos" | ValidityBucket>("todos");
  const medicalCertificates = useMedicalCertificates();
  const [viewingCertificate, setViewingCertificate] = useState<MedicalCertificate | null>(null);
  const [followupCertificate, setFollowupCertificate] = useState<MedicalCertificate | null>(null);
  const followups = useMedicalFollowups();
  const settings = useSystemSettings();
  const leaveThreshold = settings.certificateLeaveAlertDays;
  const followupOf = (certificateId: string) =>
    followups.find((item) => item.certificateId === certificateId);

  if (!collaborator) return null;

  const manager = collaborator.managerId
    ? allCollaborators.find((c) => c.id === collaborator.managerId)
    : undefined;

  const docPct = Math.round((collaborator.documentsOk / collaborator.documentsTotal) * 100);

  // QR-Code de fiscalização: link de verificação e histórico de leituras.
  const qrUrl = fiscalizacaoUrl(session.subdomain, collaborator.id);
  const qr = qrScanStatus(collaborator.id);

  const canDelete = can("documents.delete");
  const fichas = documents.filter(
    (d) => d.scope === "colaborador" && d.collaboratorId === collaborator.id && d.typeId === "ficha-epi"
  );
  const collaboratorCertificates = medicalCertificates.filter(
    (cert) => cert.collaboratorId === collaborator.id
  );

  const collaboratorCats = structuredRecords.filter(
    (record) =>
      record.kind === "cat" &&
      catBelongsToCollaborator(record.payload as CatPayload, collaborator.id, collaborator.cpf)
  );

  const collaboratorDocs = documents.filter(
    (d) => d.scope === "colaborador" && d.collaboratorId === collaborator.id
  );
  const validDocs = collaboratorDocs.filter((d) => validityBucket(d.expiresAt, d.status) === "valido");
  const expiredDocs = collaboratorDocs.filter((d) => validityBucket(d.expiresAt, d.status) === "vencido");
  const permanentDocs = collaboratorDocs.filter((d) => validityBucket(d.expiresAt, d.status) === "permanente");
  const docFilterDefs: { id: "todos" | ValidityBucket; label: string; icon: string; count: number }[] = [
    { id: "todos", label: "Todos", icon: "ri-stack-line", count: collaboratorDocs.length },
    { id: "valido", label: "Válidos", icon: "ri-checkbox-circle-line", count: validDocs.length },
    { id: "vencido", label: "Vencidos", icon: "ri-error-warning-line", count: expiredDocs.length },
    { id: "permanente", label: "Permanentes", icon: "ri-infinity-line", count: permanentDocs.length },
  ];
  const filteredDocs =
    docFilter === "valido"
      ? validDocs
      : docFilter === "vencido"
        ? expiredDocs
        : docFilter === "permanente"
          ? permanentDocs
          : collaboratorDocs;

  const handleViewDocument = async (doc: DocumentRecord) => {
    if (doc.attachedPdfHtml) {
      printHtml(doc.name, doc.attachedPdfHtml);
      return;
    }
    const url = await resolveDocumentUrl(doc);
    if (!url) {
      setFichaNotice(`O documento "${doc.name}" não possui arquivo anexado para visualização.`);
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleViewFicha = (docId: string) => {
    const delivery = docId.startsWith("doc-epi-")
      ? epis.find((d) => d.id === docId.replace("doc-epi-", ""))
      : undefined;
    if (delivery) {
      setViewingDelivery(delivery);
      setFichaNotice("");
    } else {
      setFichaNotice("Ficha arquivada — o conteúdo completo continua disponível no módulo de Documentos.");
    }
  };

  const handleConfirmDelete = (id: string) => {
    removeDocument(id);
    setConfirmId(null);
    setFichaNotice("Ficha de EPI excluída do perfil do colaborador.");
  };

  const rows: { label: string; value: string }[] = [
    { label: "Estabelecimento / Unidade", value: collaborator.establishment || "—" },
    { label: "CPF", value: collaborator.cpf },
    { label: "Matrícula", value: collaborator.matricula },
    { label: "RG", value: collaborator.rg },
    { label: "PIS / PASEP", value: collaborator.pis },
    { label: "CTPS", value: collaborator.ctps },
    { label: "Data de admissão", value: collaborator.admissionDate },
    { label: "Data de nascimento", value: collaborator.birthDate },
    { label: "Celular", value: collaborator.phone },
    { label: "E-mail", value: collaborator.email },
    { label: "Cidade / UF", value: collaborator.city },
    { label: "Gestor / Líder responsável", value: manager ? `${manager.name} · ${manager.role}` : "Sem gestor designado" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-id-card-line"
      title="Ficha do colaborador"
      subtitle="Resumo cadastral disponível para fiscalização via QR-Code"
      footer={
        <>
          <ModalButton variant="ghost" icon="ri-printer-line" onClick={onClose}>
            Imprimir ficha
          </ModalButton>
          {canEdit ? (
            <ModalButton icon="ri-edit-line" onClick={() => onEdit(collaborator)}>
              Editar dados
            </ModalButton>
          ) : (
            <ModalButton variant="ghost" icon="ri-lock-2-line" onClick={onClose}>
              Edição bloqueada pelo perfil
            </ModalButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-background-200 bg-background-100">
          <img src={collaborator.photo} alt={collaborator.name} className="h-full w-full object-top" />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-xl font-extrabold tracking-tight text-foreground-950">{collaborator.name}</h3>
          <p className="mt-0.5 text-sm text-foreground-600">
            {collaborator.role} · {collaborator.area}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusPill status={collaborator.status} />
            {collaborator.establishment && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                <i className="ri-building-line"></i>
                {collaborator.establishment}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
              <i className="ri-file-list-3-line"></i>
              {collaborator.documentsOk}/{collaborator.documentsTotal} documentos
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-background-200 bg-background-50 p-4 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-700">Documentação em conformidade</span>
            <span className="text-sm font-bold text-foreground-950">{docPct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${docPct}%` }}></div>
          </div>
        </div>

        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-background-200 bg-background-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">{row.label}</p>
            <p className="mt-1 text-sm font-medium text-foreground-900">{row.value || "—"}</p>
          </div>
        ))}
      </div>

      {/* Alergias declaradas no cadastro */}
      <div
        className={`mt-5 rounded-lg border p-4 ${
          collaborator.allergies && collaborator.allergies.length > 0
            ? "border-accent-200 bg-accent-50"
            : "border-background-200 bg-background-50"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i
              className={`text-base ${
                collaborator.allergies && collaborator.allergies.length > 0
                  ? "ri-health-book-line text-accent-700"
                  : "ri-shield-check-line text-primary-700"
              }`}
            ></i>
            <h3 className="text-sm font-bold text-foreground-950">Alergias declaradas</h3>
          </div>
          <span className="text-[11px] font-semibold text-foreground-500">
            {collaborator.allergies && collaborator.allergies.length > 0
              ? `${collaborator.allergies.length} registro(s)`
              : "Nenhuma alergia informada"}
          </span>
        </div>

        {collaborator.allergies && collaborator.allergies.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {collaborator.allergies.map((allergy) => (
              <span
                key={allergy}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-900"
              >
                <i className="ri-alert-line"></i>
                {allergy}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-foreground-500">
            O colaborador não declarou nenhum tipo de alergia no cadastro.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex items-center gap-2">
          <i className="ri-quill-pen-line text-base text-primary-700"></i>
          <h3 className="text-sm font-bold text-foreground-950">Assinatura pessoal</h3>
        </div>
        {signatureConfig ? (
          <div className="mt-3">
            <div className="flex min-h-[80px] items-center justify-center rounded-md border border-dashed border-primary-300 bg-primary-50 px-6 py-3">
              <SignatureStamp
                name={collaborator.name}
                font={signatureConfig.fontModel}
                nameStyle={signatureConfig.nameStyle}
                imageData={signatureConfig.imageData}
                size={40}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
                <i className="ri-verified-badge-line"></i>
                Assinatura criada
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                <i className="ri-quill-pen-line"></i>
                {signatureConfig.kind === "draw"
                  ? "Desenhada à mão"
                  : `Modelo ${getSignatureFont(signatureConfig.fontModel).label}`}
              </span>
              {signatureConfig.kind === "typographic" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
                  <i className="ri-user-line"></i>
                  {signatureConfig.nameStyle === "full" ? "Nome completo" : "Nome parcial"}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
                <i className="ri-verified-badge-line"></i>
                Ativa · versão {signatureConfig.version}
              </span>
              {signatureConfig.termAcceptedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-800">
                  <i className="ri-shield-check-line"></i>
                  Termo vigente aceito
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-foreground-400">
              Prévia apenas para conferência — o colaborador gerencia a própria assinatura no perfil dele.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-4">
            <i className="ri-error-warning-line text-base text-accent-700"></i>
            <span className="text-xs text-foreground-600">
              O colaborador ainda não criou a assinatura pessoal no perfil dele.
            </span>
          </div>
        )}
      </div>

      {/* Fichas de EPI armazenadas */}
      <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-folder-shield-2-line text-base text-secondary-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">Fichas de EPI armazenadas</h3>
            <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
              {fichas.length}
            </span>
          </div>
          {!canDelete && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
              <i className="ri-lock-line"></i>
              Exclusão bloqueada pelo perfil
            </span>
          )}
        </div>

        {fichaNotice && (
          <div className="mt-3 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs text-primary-800">
            <i className="ri-information-line mt-0.5 text-base"></i>
            <span className="flex-1">{fichaNotice}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setFichaNotice("")}
              className="flex h-5 w-5 items-center justify-center rounded text-primary-700 transition-colors hover:bg-primary-100"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        {fichas.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2.5">
            {fichas.map((doc) => {
              const delivery = doc.id.startsWith("doc-epi-")
                ? epis.find((d) => d.id === doc.id.replace("doc-epi-", ""))
                : undefined;
              const signed = delivery ? delivery.status === "Assinada" : true;
              return (
                <li
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-3.5 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                    <i className="ri-shirt-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground-950">{doc.name}</p>
                      {signed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                          <i className="ri-verified-badge-line"></i>
                          Assinada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-800">
                          <i className="ri-timer-line"></i>
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      Emitida em {doc.issuedAt} · {doc.size} · {doc.fileType.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleViewFicha(doc.id)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                    >
                      <i className="ri-eye-line text-base"></i>
                      Ver
                    </button>
                    {canDelete ? (
                      confirmId === doc.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(doc.id)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600"
                          >
                            <i className="ri-check-line"></i>
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            aria-label="Cancelar exclusão"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-background-300 text-foreground-600 transition-colors hover:bg-background-50"
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(doc.id)}
                          aria-label="Excluir ficha"
                          title="Excluir ficha"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-background-300 text-foreground-600 transition-colors hover:bg-accent-50 hover:text-accent-700"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      )
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-400"
                        title="Exclusão não permitida para o seu perfil"
                      >
                        <i className="ri-lock-line"></i>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-4">
            <i className="ri-information-line text-base text-foreground-500"></i>
            <span className="text-xs text-foreground-600">
              Nenhuma ficha de EPI arquivada — as fichas assinadas ficam armazenadas aqui, junto ao perfil.
            </span>
          </div>
        )}
      </div>

      {/* Documentos do colaborador — todos, com filtro de validade */}
      <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-folder-3-line text-base text-primary-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">Documentos do colaborador</h3>
            <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
              {collaboratorDocs.length}
            </span>
          </div>
          <span className="text-[11px] text-foreground-400">
            RG, CPF, ASO, certificados, fichas de EPI e demais documentos vinculados
          </span>
        </div>

        <div className="mt-3 inline-flex flex-wrap items-center gap-1 rounded-full bg-background-100 p-1">
          {docFilterDefs.map((def) => {
            const active = docFilter === def.id;
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => setDocFilter(def.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className={`${def.icon} text-sm`}></i>
                {def.label}
                <span
                  className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                    active ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-700"
                  }`}
                >
                  {def.count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredDocs.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2.5">
            {filteredDocs.map((doc) => {
              const bucket = validityBucket(doc.expiresAt, doc.status);
              const badge =
                bucket === "valido"
                  ? { label: "Válido", icon: "ri-checkbox-circle-line", cls: "bg-primary-100 text-primary-700" }
                  : bucket === "vencido"
                    ? { label: "Vencido", icon: "ri-error-warning-line", cls: "bg-accent-100 text-accent-800" }
                    : { label: "Permanente", icon: "ri-infinity-line", cls: "bg-secondary-100 text-secondary-900" };
              return (
                <li
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-3.5 sm:flex-row sm:items-center"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${fileIconTone[doc.fileType]}`}>
                    <i className={`${fileIcon[doc.fileType]} text-lg`}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground-950">{doc.name}</p>
                      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                        <i className={badge.icon}></i>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      {doc.typeName} · Emitido em {doc.issuedAt} ·{" "}
                      {bucket === "permanente" ? "Sem validade" : `Validade ${doc.expiresAt}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleViewDocument(doc)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                    >
                      <i className="ri-eye-line text-base"></i>
                      Ver
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-4">
            <i className="ri-information-line text-base text-foreground-500"></i>
            <span className="text-xs text-foreground-600">
              Nenhum documento nesta categoria. Envie documentos no módulo de Documentos para vê-los aqui.
            </span>
          </div>
        )}
      </div>

      {/* Atestados médicos enviados pelo colaborador */}
      <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-stethoscope-line text-base text-secondary-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">Atestados médicos</h3>
            <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
              {collaboratorCertificates.length}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
            <i className="ri-lock-line"></i>
            Registro permanente · sem exclusão
          </span>
        </div>

        {collaboratorCertificates.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2.5">
            {collaboratorCertificates.map((cert) => {
              const followup = followupOf(cert.id);
              const longLeave = cert.leaveDays > 0 && cert.leaveDays >= leaveThreshold;
              return (
              <li
                key={cert.id}
                className="rounded-lg border border-background-200 bg-background-100 p-3.5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                  <i className="ri-stethoscope-line text-lg"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground-950">{cert.certificateType}</p>
                    {longLeave && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900">
                        <i className="ri-alarm-warning-line"></i>
                        Afastamento prolongado
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-foreground-500">
                    Atestado de {isoToBr(cert.issuedOn) || "—"} · CID {cert.cid || "—"} ·{" "}
                    {cert.leaveDays > 0 ? `${cert.leaveDays} dia(s) de afastamento` : "sem afastamento"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFollowupCertificate(cert)}
                    title="Registrar retorno previsto e observação do acompanhamento"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-secondary-300 bg-secondary-100 px-3 py-2 text-xs font-semibold text-secondary-900 transition-colors hover:bg-secondary-200"
                  >
                    <i className="ri-heart-pulse-line text-base"></i>
                    Acompanhar
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingCertificate(cert)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                  >
                    <i className="ri-eye-line text-base"></i>
                    Ver atestado
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void printMedicalCertificatePdf(cert, {
                        role: collaborator.role,
                        unit: collaborator.establishment,
                      })
                    }
                    title="Baixar PDF do atestado com a foto e o resumo do afastamento"
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-file-pdf-2-line text-base"></i>
                    PDF
                  </button>
                </div>
                </div>

                {(followup || longLeave) && (
                  <div className="mt-3 flex flex-col gap-2 rounded-md border border-background-200 bg-background-50 p-3 sm:flex-row sm:items-center">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        followup ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className="ri-heart-pulse-line text-base"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-foreground-800">
                        {followup
                          ? `Retorno previsto: ${isoToBr(followup.expectedReturn) || "—"}`
                          : "Afastamento prolongado sem acompanhamento registrado"}
                      </p>
                      {followup?.note ? (
                        <p className="mt-0.5 text-[11px] text-foreground-500">{followup.note}</p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-foreground-500">
                          Registre a data prevista de retorno e a observação do caso.
                        </p>
                      )}
                      {followup && (
                        <p className="mt-0.5 text-[10px] text-foreground-400">
                          {followup.updatedBy || "Gestão"} · atualizado em {isoToBr(followup.updatedAt.slice(0, 10))}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFollowupCertificate(cert)}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-100 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-200"
                    >
                      <i className="ri-edit-line text-base"></i>
                      {followup ? "Atualizar" : "Registrar"}
                    </button>
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-4">
            <i className="ri-information-line text-base text-foreground-500"></i>
            <span className="text-xs text-foreground-600">
              Nenhum atestado médico cadastrado por este colaborador.
            </span>
          </div>
        )}
      </div>

      {/* CAT — Comunicação de Acidente vinculada ao colaborador */}
      <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-first-aid-kit-line text-base text-accent-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">CAT · Comunicação de Acidente</h3>
            <span className="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-900">
              {collaboratorCats.length}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
            <i className="ri-lock-line"></i>
            Registro legal permanente
          </span>
        </div>

        {collaboratorCats.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2.5">
            {collaboratorCats.map((record) => {
              const cat = record.payload as CatPayload;
              const hasNumber = Boolean(cat.catNumber?.trim());
              const hasReceipt = Boolean(cat.receiptName);
              return (
                <li key={record.id} className="rounded-lg border border-background-200 bg-background-100 p-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                      <i className="ri-first-aid-kit-line text-lg"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground-950">{cat.accidentType}</p>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-200 px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground-700">
                          <i className="ri-shield-check-line"></i>
                          {cat.protocol}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-foreground-500">
                        Ocorrido em {isoToBr(record.date) || "—"} · CID {cat.cid || "—"} · {cat.consequence}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            hasNumber ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-900"
                          }`}
                        >
                          <i className={hasNumber ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                          {hasNumber ? `Nº oficial ${cat.catNumber}` : "Nº oficial pendente"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            hasReceipt ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-900"
                          }`}
                        >
                          <i className={hasReceipt ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                          {hasReceipt ? "Recibo de entrega anexado" : "Sem recibo de entrega"}
                        </span>
                        {cat.receiptDeliveredTo && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold text-secondary-900">
                            <i className="ri-user-received-line"></i>
                            Entregue a {cat.receiptDeliveredTo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => printHtml(`CAT — ${cat.workerName}`, buildStructuredPdfBody(record))}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                      >
                        <i className="ri-file-pdf-2-line text-base"></i>
                        Ver CAT
                      </button>
                      {hasReceipt && cat.receiptDataUrl && (
                        <button
                          type="button"
                          title="Abrir o recibo de entrega anexado"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = cat.receiptDataUrl;
                            link.target = "_blank";
                            link.rel = "noopener";
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                        >
                          <i className="ri-attachment-2 text-base"></i>
                          Recibo
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-4">
            <i className="ri-information-line text-base text-foreground-500"></i>
            <span className="text-xs text-foreground-600">
              Nenhuma CAT emitida para este colaborador. Ao registrar uma CAT no módulo de Documentos com o
              trabalhador vinculado, ela aparece aqui automaticamente.
            </span>
          </div>
        )}
      </div>

      {/* QR-Code de fiscalização — prévia, link de verificação e histórico */}
      <div className="mt-5 rounded-lg border border-background-200 bg-background-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="ri-qr-scan-2-line text-base text-secondary-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">QR-Code de fiscalização</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {qr.hasScans ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                <i className="ri-checkbox-circle-line"></i>
                QR ativo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
                <i className="ri-eye-off-line"></i>
                Sem escaneamento
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
              <i className="ri-ruler-2-line"></i>
              3 × 3 cm
            </span>
          </div>
        </div>

        {qrNotice && (
          <div className="mt-3 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs text-primary-800">
            <i className="ri-information-line mt-0.5 text-base"></i>
            <span className="flex-1">{qrNotice}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setQrNotice("")}
              className="flex h-5 w-5 items-center justify-center rounded text-primary-700 transition-colors hover:bg-primary-100"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <QrCode value={qrUrl} />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-800">
              <i className="ri-qr-scan-2-line text-sm"></i>
              {qr.total} escaneamento(s)
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Link de verificação</p>
              <p className="mt-0.5 break-all font-mono text-xs font-medium text-foreground-800">{qrUrl}</p>
            </div>

            <div className="mt-2 rounded-md border border-background-200 bg-background-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Último escaneamento</p>
              {qr.lastLog ? (
                <>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{qr.lastDate}</p>
                  <p className="mt-0.5 truncate text-[11px] text-foreground-500">
                    {qr.lastLog.source} · {qr.lastLog.device} · {qr.lastLog.location}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-xs text-foreground-500">
                  Este QR-Code ainda não foi lido em campo.
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPrintingQr(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-printer-line text-base"></i>
                Imprimir adesivo
              </button>
              <Link
                to={`/fiscalizacao/${collaborator.id}`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-external-link-line text-base"></i>
                Abrir página de fiscalização
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-foreground-400">
          O código abre o resumo de fiscalização com cursos ativos/vencidos e ficha de EPI ·{" "}
          {getInitials(collaborator.name)}-{collaborator.id.toUpperCase()}
        </p>
      </div>

      <EpiDetailModal delivery={viewingDelivery} onClose={() => setViewingDelivery(null)} />
      {printingQr && (
        <QrPrintDialog
          open
          collaborators={[collaborator]}
          companyName={session.company}
          subdomain={session.subdomain}
          onClose={() => setPrintingQr(false)}
          onPrinted={(count, format) => {
            setPrintingQr(false);
            setQrNotice(
              `Adesivo (${stickerFormatLabel[format]}) de 3 × 3 cm de ${collaborator.name} enviado para a impressora.`,
            );
          }}
        />
      )}
      <CertificateViewerModal
        certificate={viewingCertificate}
        onClose={() => setViewingCertificate(null)}
      />
      <MedicalFollowupModal
        open={followupCertificate !== null}
        certificate={followupCertificate}
        unit={collaborator.establishment}
        actor={session.name || "Gestão"}
        onClose={() => setFollowupCertificate(null)}
      />
    </Modal>
  );
}