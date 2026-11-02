import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SectionCard } from "@/pages/app/components/ui";
import { getInitials, useAppSession } from "@/pages/app/context";
import { collaborators as mockCollaborators } from "@/mocks/collaborators";
import type { Collaborator } from "@/mocks/collaborators";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { addApr, getAprStoreState, useAprs } from "@/pages/app/modules/apr/aprStore";
import AprFormModal from "@/pages/app/modules/apr/components/AprFormModal";
import type { AprRecord } from "@/mocks/apr";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import {
  EXPIRY_ALERT_DAYS,
  daysUntilExpiry,
  expiryDaysLabel,
} from "@/pages/app/modules/documentos/documentUtils";
import {
  acknowledgeDocument,
  useDocumentAcknowledgements,
} from "@/pages/app/modules/documentos/documentAckStore";
import DocumentViewerModal from "@/pages/app/modules/documentos/components/DocumentViewerModal";
import type { DocumentRecord } from "@/mocks/documents";
import {
  useMedicalCertificateStoreState,
  useMedicalCertificatesHistory,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import MedicalCertificateUploadModal from "@/pages/app/modules/meusdocumentos/components/MedicalCertificateUploadModal";
import CertificateViewerModal from "@/pages/app/modules/meusdocumentos/components/CertificateViewerModal";
import CatCollaboratorSection from "@/pages/app/modules/meusdocumentos/components/CatCollaboratorSection";
import PersonalDocumentModal, {
  type PersonalDocumentKind,
} from "@/pages/app/modules/meusdocumentos/components/PersonalDocumentModal";
import type { MedicalCertificate } from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";

function formatIsoDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function MeusDocumentosPage() {
  const session = useAppSession();
  const registered = useCollaboratorsList();
  const me: Collaborator | undefined =
    registered.find((c) => c.name === session.name) ||
    registered.find((c) => c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()) ||
    mockCollaborators.find((c) => c.name === session.name);

  const aprs = useAprs();
  const certificateHistory = useMedicalCertificatesHistory();
  const certificateStore = useMedicalCertificateStoreState();
  const versioningSupported = certificateStore.versioningSupported;
  const certificates = useMemo(
    () => certificateHistory.filter((c) => c.isCurrent),
    [certificateHistory]
  );
  const documents = useDocuments();
  const acknowledged = useDocumentAcknowledgements(session.subdomain, me?.id ?? null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [personalDoc, setPersonalDoc] = useState<PersonalDocumentKind | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [correcting, setCorrecting] = useState<MedicalCertificate | null>(null);
  const [showCertHistory, setShowCertHistory] = useState(false);
  const [viewingCertificate, setViewingCertificate] = useState<MedicalCertificate | null>(null);
  const [aprFormOpen, setAprFormOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<DocumentRecord | null>(null);
  const [notice, setNotice] = useState("");

  const myCertificates = useMemo(
    () => certificates.filter((c) => c.collaboratorId === me?.id),
    [certificates, me?.id]
  );

  // Versões anteriores (substituídas) do próprio colaborador. Preservadas no
  // histórico: nunca são apagadas nem reescritas.
  const mySupersededCertificates = useMemo(
    () =>
      certificateHistory.filter(
        (c) => c.collaboratorId === me?.id && !c.isCurrent
      ),
    [certificateHistory, me?.id]
  );

  // APRs cadastradas por este colaborador que ainda não foram concluídas.
  // Uma vez assinadas, elas passam a viver apenas no painel da gestão.
  const myPendingAprs = useMemo(
    () =>
      aprs.filter(
        (a) => a.createdByRef === me?.id && a.status !== "Concluída"
      ),
    [aprs, me?.id]
  );

  const myDocuments = useMemo(
    () =>
      me
        ? documents.filter(
            (d) => d.collaboratorId === me.id && d.visibleToCollaborator
          )
        : [],
    [documents, me]
  );

  // Documentos do próprio colaborador com validade vencida ou próxima do
  // vencimento. O colaborador não altera a data (isso é da gestão), mas recebe
  // o aviso para procurar o SESMT.
  const myExpiringDocs = useMemo(
    () =>
      myDocuments
        .map((doc) => ({ doc, days: daysUntilExpiry(doc.expiresAt) }))
        .filter((entry): entry is { doc: DocumentRecord; days: number } => entry.days !== null && entry.days <= EXPIRY_ALERT_DAYS)
        .sort((a, b) => a.days - b.days),
    [myDocuments]
  );

  // Atalhos vindos da busca do topo e de notificações.
  useEffect(() => {
    const docKind = searchParams.get("doc");
    const certId = searchParams.get("cert");
    const documentRef = searchParams.get("document");
    const newApr = searchParams.get("apr");

    let shouldClear = false;
    if (docKind === "contrato" || docKind === "ficha") {
      setPersonalDoc(docKind);
      shouldClear = true;
    }
    if (certId) {
      const found = certificates.find((c) => c.id === certId);
      if (found) setViewingCertificate(found);
      shouldClear = true;
    }
    if (documentRef) {
      const found = documents.find((d) => d.id === documentRef);
      if (found) setViewingDocument(found);
      shouldClear = true;
    }
    if (newApr === "1") {
      setAprFormOpen(true);
      shouldClear = true;
    }
    if (shouldClear) {
      const next = new URLSearchParams(searchParams);
      next.delete("doc");
      next.delete("cert");
      next.delete("document");
      next.delete("apr");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, certificates, documents, setSearchParams]);

  if (!me) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-file-list-3-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Meus documentos</p>
          <p className="mt-1 text-xs text-foreground-500">
            Esta área é exibida para usuários com o papel de Colaborador.
          </p>
        </div>
      </div>
    );
  }

  const handleAprCreated = (record: AprRecord) => {
    void (async () => {
      await addApr({
        ...record,
        createdByRef: me.id,
        createdByName: me.name,
        origin: "colaborador",
      });
      if (getAprStoreState().error) {
        setNotice("Não foi possível enviar a APR. Verifique a conexão e tente novamente.");
        return;
      }
      setNotice(
        record.status === "Concluída"
          ? `APR "${record.title}" cadastrada e assinada. Ela já foi enviada ao painel do administrador.`
          : `APR "${record.title}" cadastrada. Ela fica aqui até todos os executantes assinarem e então segue para a gestão.`
      );
    })();
  };

  const handleDocumentViewed = (doc: DocumentRecord) => {
    acknowledgeDocument(session.subdomain, me.id, doc.id);
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-file-list-3-line"></i>
            Meu espaço
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Meus documentos
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Contrato, ficha cadastral, atestados médicos e APRs vinculados a você.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-upload-cloud-2-line text-base"></i>
            Cadastrar atestado
          </button>
          <Link
            to="/app/minhaepi"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-shirt-line text-base"></i>
            Minha ficha de EPI
          </Link>
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

      {/* Alerta de vencimento dos documentos do colaborador */}
      {myExpiringDocs.length > 0 && (
        <div className="mt-5 rounded-lg border border-accent-300 bg-accent-50 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
              <i className="ri-alarm-warning-line text-xl"></i>
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold tracking-tight text-foreground-950">
                {myExpiringDocs.length === 1
                  ? "1 documento seu está vencido ou perto de vencer"
                  : `${myExpiringDocs.length} documentos seus estão vencidos ou perto de vencer`}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
                Procure o SESMT da sua empresa para renovar antes do prazo.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {myExpiringDocs.slice(0, 3).map(({ doc, days }) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-xs font-medium text-foreground-800">{doc.name}</span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        days < 0 ? "bg-accent-200 text-accent-900" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className={days < 0 ? "ri-error-warning-line" : "ri-timer-line"}></i>
                      {expiryDaysLabel(days)}
                    </span>
                    <span className="text-[10px] text-foreground-500">validade {doc.expiresAt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-user-settings-line text-lg"></i>
          </span>
          <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">2</p>
          <p className="mt-0.5 text-xs font-medium text-foreground-500">Documentos pessoais fixos</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className="ri-stethoscope-line text-lg"></i>
          </span>
          <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
            {myCertificates.length}
          </p>
          <p className="mt-0.5 text-xs font-medium text-foreground-500">Atestados médicos registrados</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-clipboard-line text-lg"></i>
          </span>
          <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
            {myPendingAprs.length}
          </p>
          <p className="mt-0.5 text-xs font-medium text-foreground-500">APR aguardando assinaturas</p>
        </div>
      </div>

      {/* Documentos pessoais */}
      <div className="mt-6">
        <SectionCard
          title="Documentos pessoais"
          subtitle="Cópias digitais ligadas ao seu vínculo — consulta e download liberados, exclusão bloqueada"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                kind: "contrato" as PersonalDocumentKind,
                title: "Contrato de Trabalho",
                description: "Função, unidade, admissão e condições contratuais.",
                icon: "ri-file-user-line",
                tone: "bg-primary-100 text-primary-700",
              },
              {
                kind: "ficha" as PersonalDocumentKind,
                title: "Ficha Cadastral",
                description: "Seus dados de identificação, vínculo e contato.",
                icon: "ri-id-card-line",
                tone: "bg-secondary-100 text-secondary-800",
              },
            ].map((item) => (
              <div
                key={item.kind}
                className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                  <i className={`${item.icon} text-lg`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-950">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground-500">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPersonalDoc(item.kind)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                >
                  <i className="ri-eye-line"></i>
                  Visualizar
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Atestados médicos */}
      <div className="mt-6">
        <SectionCard
          title="Atestados médicos"
          subtitle="Envie a foto do atestado. O registro entra no seu perfil e a gestão é avisada na hora"
          action={
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-camera-line text-base"></i>
              Cadastrar atestado
            </button>
          }
        >
          <p className="mb-4 flex items-start gap-2 rounded-md bg-accent-50 px-3 py-2.5 text-[11px] leading-relaxed text-accent-900">
            <i className="ri-lock-line mt-0.5 text-sm"></i>
            O cadastro só é concluído depois que o arquivo é confirmado no armazenamento. Se o envio falhar, nada é
            registrado e você pode tentar de novo. Depois de finalizado, o atestado não pode ser editado nem excluído:
            para corrigir, registre uma nova versão — o original e o arquivo original permanecem no histórico.
          </p>

          {myCertificates.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {myCertificates.map((cert) => (
                <li
                  key={cert.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                    <i className="ri-stethoscope-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">{cert.certificateType}</p>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      Atestado de {formatIsoDate(cert.issuedOn)} · CID {cert.cid || "—"} ·{" "}
                      {cert.leaveDays > 0 ? `${cert.leaveDays} dia(s) de afastamento` : "sem afastamento"}
                    </p>
                  </div>
                  {!cert.hasFile ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-200 px-3 py-1 text-[11px] font-semibold text-accent-900">
                      <i className="ri-attachment-2"></i>
                      Sem arquivo
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
                      <i className="ri-shield-check-line"></i>
                      Vigente{cert.revision > 1 ? ` · v${cert.revision}` : ""}
                    </span>
                  )}
                  {versioningSupported && cert.isCurrent && (
                    <button
                      type="button"
                      onClick={() => setCorrecting(cert)}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-git-branch-line"></i>
                      {cert.hasFile ? "Corrigir" : "Anexar arquivo"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingCertificate(cert)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                  >
                    <i className="ri-eye-line"></i>
                    Ver atestado
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-camera-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum atestado cadastrado</p>
              <p className="max-w-md text-xs leading-relaxed text-foreground-500">
                Teve um atestado médico? Fotografe o documento e cadastre por aqui. O SESMT recebe o aviso
                automaticamente e o registro fica guardado no seu perfil.
              </p>
            </div>
          )}
          {mySupersededCertificates.length > 0 && (
            <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-4">
              <button
                type="button"
                onClick={() => setShowCertHistory((value) => !value)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground-700">
                  <i className="ri-history-line"></i>
                  Versões anteriores preservadas ({mySupersededCertificates.length})
                </span>
                <i className={showCertHistory ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
              </button>
              {showCertHistory && (
                <ul className="mt-3 flex flex-col gap-2">
                  {mySupersededCertificates.map((cert) => (
                    <li
                      key={cert.id}
                      className="flex flex-col gap-2 rounded-md border border-background-200 bg-background-100 px-3 py-2.5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground-800">
                          {cert.certificateType} · v{cert.revision}
                        </p>
                        <p className="truncate text-[11px] text-foreground-500">
                          Atestado de {formatIsoDate(cert.issuedOn)} · CID {cert.cid || "—"}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-700">
                        <i className="ri-arrow-right-line"></i>
                        Substituído
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingCertificate(cert)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-eye-line"></i>
                        Ver
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Documentos emitidos */}
      {myDocuments.length > 0 && (
        <div className="mt-6">
          <SectionCard
            title="Documentos emitidos para você"
            subtitle="Fichas de EPI, ASOs e demais documentos gerados pela empresa no seu nome"
          >
            <ul className="flex flex-col gap-2">
              {myDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-100 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                    <i className="ri-file-text-line text-base"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-900">{doc.name}</p>
                    <p className="truncate text-xs text-foreground-500">
                      {doc.typeName} · emitido em {doc.issuedAt || "—"} · validade {doc.expiresAt || "permanente"}
                    </p>
                  </div>
                  {(() => {
                    const days = daysUntilExpiry(doc.expiresAt);
                    if (days === null) return null;
                    return (
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          days < 0
                            ? "bg-accent-200 text-accent-900"
                            : days <= EXPIRY_ALERT_DAYS
                              ? "bg-accent-100 text-accent-800"
                              : "bg-primary-100 text-primary-700"
                        }`}
                      >
                        <i className={days < 0 ? "ri-error-warning-line" : "ri-calendar-check-line"}></i>
                        {days < 0 ? expiryDaysLabel(days) : `Válido · ${expiryDaysLabel(days)}`}
                      </span>
                    );
                  })()}
                  {acknowledged.includes(doc.id) ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                      <i className="ri-eye-line"></i>
                      Ciente
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
                      <i className="ri-notification-badge-line"></i>
                      Novo
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setViewingDocument(doc)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                  >
                    <i className="ri-external-link-line"></i>
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}

      {/* CAT — Comunicação de Acidente de Trabalho */}
      <CatCollaboratorSection collaboratorId={me.id} cpf={me.cpf} />

      {/* APR */}
      <div className="mt-6">
        <SectionCard
          title="APR · Análise Preliminar de Risco"
          subtitle="Cadastre a APR da sua atividade, assine o aceite e ela segue direto para o painel do administrador"
          action={
            <button
              type="button"
              onClick={() => setAprFormOpen(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-add-line text-base"></i>
              Cadastrar APR
            </button>
          }
        >
          <p className="mb-4 flex items-start gap-2 rounded-md bg-secondary-100 px-3 py-2.5 text-[11px] leading-relaxed text-secondary-900">
            <i className="ri-information-line mt-0.5 text-sm"></i>
            Toda APR exige o número da solicitação. Depois de assinada por todos os executantes, ela sai daqui e
            passa a constar apenas no painel do administrador.
          </p>

          {myPendingAprs.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {myPendingAprs.map((apr) => {
                const signed = apr.signatures.filter((s) => s.signature).length;
                return (
                  <li
                    key={apr.id}
                    className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                      <i className="ri-clipboard-line text-lg"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground-950">{apr.title}</p>
                      <p className="mt-0.5 truncate text-xs text-foreground-500">
                        Solicitação {apr.requestNumber || "—"} · {apr.date} · {signed}/{apr.signatures.length}{" "}
                        assinatura(s)
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-800">
                      <i className="ri-timer-line"></i>
                      Aguardando assinatura
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-checkbox-circle-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhuma APR pendente</p>
              <p className="max-w-md text-xs leading-relaxed text-foreground-500">
                Não há APR aguardando assinatura sua. Ao cadastrar e assinar uma nova análise, ela é enviada
                automaticamente para a gestão.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      <p className="mt-6 flex items-center gap-2 text-[11px] text-foreground-400">
        <i className="ri-information-line"></i>
        Identificação interna: {getInitials(me.name)}-{me.id.toUpperCase()} · {session.company}
      </p>

      <PersonalDocumentModal
        kind={personalDoc}
        collaborator={me}
        companyName={session.company}
        onClose={() => setPersonalDoc(null)}
      />
      <MedicalCertificateUploadModal
        open={uploadOpen || Boolean(correcting)}
        onClose={() => {
          setUploadOpen(false);
          setCorrecting(null);
        }}
        collaboratorId={me.id}
        collaboratorName={me.name}
        area={me.area}
        establishment={me.establishment}
        createdBy={session.email || session.name}
        replacesId={correcting?.id ?? null}
        originalLabel={correcting ? `${correcting.certificateType} de ${formatIsoDate(correcting.issuedOn)}` : ""}
        onCreated={() => {
          const wasCorrection = Boolean(correcting);
          setUploadOpen(false);
          setCorrecting(null);
          setNotice(
            wasCorrection
              ? "Correção registrada como nova versão. O atestado anterior continua preservado no histórico."
              : "Atestado médico cadastrado. O arquivo foi confirmado no armazenamento e o registro é definitivo."
          );
        }}
      />
      <CertificateViewerModal
        certificate={viewingCertificate}
        onClose={() => setViewingCertificate(null)}
      />
      <AprFormModal
        open={aprFormOpen}
        onClose={() => setAprFormOpen(false)}
        onCreate={handleAprCreated}
        preset={{
          responsible: me.name,
          establishment: me.establishment,
          participantId: me.id,
        }}
      />
      <DocumentViewerModal
        doc={viewingDocument}
        onClose={() => setViewingDocument(null)}
        onViewed={handleDocumentViewed}
      />
    </div>
  );
}