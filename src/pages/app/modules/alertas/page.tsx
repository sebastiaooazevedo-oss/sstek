import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SectionCard } from "@/pages/app/components/ui";
import { useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import { colaboradorAlerts } from "@/mocks/app";
import type { AprRecord } from "@/mocks/apr";
import type { EpiDelivery } from "@/mocks/epi";
import { signApr, useAprs } from "@/pages/app/modules/apr/aprStore";
import AprSignModal from "@/pages/app/modules/apr/components/AprSignModal";
import { signEpiDelivery, useEpis } from "@/pages/app/modules/epi/epiStore";
import EpiSignModal from "@/pages/app/modules/epi/components/EpiSignModal";
import { usePendingDocuments, useSignatureActor } from "@/pages/app/signature/documentStore";
import DocumentDetailModal from "@/pages/app/modules/assinaturas/components/DocumentDetailModal";
import type { SignatureDocument } from "@/pages/app/signature/documentService";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import {
  acknowledgeDocument,
  directedDocumentsFor,
  useDocumentAcknowledgements,
} from "@/pages/app/modules/documentos/documentAckStore";
import DocumentViewerModal from "@/pages/app/modules/documentos/components/DocumentViewerModal";
import type { DocumentRecord } from "@/mocks/documents";

const levelStyles: Record<string, string> = {
  danger: "bg-accent-100 text-accent-900 border-accent-300",
  warning: "bg-accent-50 text-accent-800 border-accent-200",
  info: "bg-secondary-100 text-secondary-900 border-secondary-200",
};

export default function AlertasPage() {
  const session = useAppSession();
  const aprs = useAprs();
  const epis = useEpis();
  const actor = useSignatureActor();
  const pendingDocuments = usePendingDocuments(actor.collaboratorRef);
  const [viewingDoc, setViewingDoc] = useState<SignatureDocument | null>(null);
  const me = collaborators.find((c) => c.name === session.name);

  const myPendingAprs = me
    ? aprs.filter(
        (a) =>
          a.createdByRef !== me.id &&
          a.signatures.some((s) => s.collaboratorId === me.id && !s.signature)
      )
    : [];
  const myPendingEpis = me
    ? epis.filter((d) => d.collaboratorId === me.id && d.status === "Pendente")
    : [];
  const totalPending = myPendingAprs.length + myPendingEpis.length + pendingDocuments.length;

  const [signing, setSigning] = useState<AprRecord | null>(null);
  const [signingEpi, setSigningEpi] = useState<EpiDelivery | null>(null);
  const [notice, setNotice] = useState("");

  // Documentos direcionados ao colaborador: permanecem como alerta até serem
  // abertos. Ao visualizar, a ciência é registrada e o alerta desaparece.
  const documents = useDocuments();
  const acknowledgedIds = useDocumentAcknowledgements(session.subdomain, me?.id ?? null);
  const directedDocs = useMemo(() => directedDocumentsFor(documents, me?.id), [documents, me?.id]);
  const unreadDocs = useMemo(
    () => directedDocs.filter((doc) => !acknowledgedIds.includes(doc.id)),
    [directedDocs, acknowledgedIds]
  );
  const seenDocs = useMemo(
    () => directedDocs.filter((doc) => acknowledgedIds.includes(doc.id)),
    [directedDocs, acknowledgedIds]
  );
  const [viewingDirected, setViewingDirected] = useState<DocumentRecord | null>(null);
  const [showSeenDocs, setShowSeenDocs] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewedDocument = (doc: DocumentRecord) => {
    acknowledgeDocument(session.subdomain, me?.id ?? "", doc.id);
    setNotice(`Documento "${doc.name}" visualizado — alerta removido.`);
  };

  // Suporte ao clique na notificação do topo: /app/alertas?doc=<id> abre o
  // documento direto. O parâmetro só é limpo depois que o documento carrega.
  useEffect(() => {
    const docId = searchParams.get("doc");
    if (!docId) return;
    const found = directedDocs.find((doc) => doc.id === docId);
    if (!found) return;
    setViewingDirected(found);
    const next = new URLSearchParams(searchParams);
    next.delete("doc");
    setSearchParams(next, { replace: true });
  }, [searchParams, directedDocs, setSearchParams]);

  const handleSign = (aprId: string, collaboratorId: string, signature: string) => {
    const target = aprs.find((a) => a.id === aprId);
    signApr(aprId, collaboratorId, signature);
    setSigning(null);
    setNotice(`Aceite da APR "${target?.title || ""}" assinado com sucesso.`);
  };

  const handleSignEpi = (deliveryId: string, signature: string) => {
    const target = epis.find((d) => d.id === deliveryId);
    signEpiDelivery(deliveryId, signature);
    setSigningEpi(null);
    setNotice(`Aceite da Ficha de EPI de ${target?.date || ""} assinado com sucesso.`);
  };

  if (!me) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-notification-3-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Central de alertas do colaborador</p>
          <p className="mt-1 text-xs text-foreground-500">
            Esta área é exibida para usuários com o papel de Colaborador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-notification-3-line"></i>
            Conta
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Alertas
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Acompanhe os documentos que aguardam a sua assinatura e os avisos de vencimento.
          </p>
        </div>
        <Link
          to="/app/meusdados"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-quill-pen-line text-base"></i>
          Minha assinatura
        </Link>
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

      {/* Resumo pendências */}
      <div
        className={`mt-6 flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center md:p-6 ${
          totalPending > 0 ? "border-accent-300 bg-accent-50" : "border-primary-200 bg-primary-50"
        }`}
      >
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${
            totalPending > 0 ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
          }`}
        >
          <i className={totalPending > 0 ? "ri-pen-nib-line text-2xl" : "ri-checkbox-circle-line text-2xl"}></i>
        </span>
        <div className="min-w-0">
          <p className="font-heading text-lg font-extrabold tracking-tight text-foreground-950">
            {totalPending > 0
              ? `${totalPending} documento(s) aguardando a sua assinatura`
              : "Você está em dia com as assinaturas"}
          </p>
          <p className="mt-0.5 text-sm text-foreground-600">
            {totalPending > 0
              ? "Abra o documento abaixo, confira o conteúdo e assine com a assinatura do seu perfil."
              : "Nenhum documento pendente no momento. Continue assim!"}
          </p>
        </div>
      </div>

      {/* Documentos direcionados ao colaborador */}
      <div className="mt-6">
        <SectionCard
          title="Documentos direcionados a você"
          subtitle="Abra o documento para ficar ciente — o alerta desaparece após a visualização"
          action={
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${
                unreadDocs.length > 0
                  ? "bg-accent-500 text-background-50"
                  : "bg-secondary-100 text-secondary-900"
              }`}
            >
              <i className={unreadDocs.length > 0 ? "ri-notification-badge-line" : "ri-checkbox-circle-line"}></i>
              {unreadDocs.length > 0 ? `${unreadDocs.length} novo(s)` : "tudo visualizado"}
            </span>
          }
        >
          {unreadDocs.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {unreadDocs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border border-accent-200 bg-accent-50 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                    <i className="ri-file-text-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-background-50">
                        Novo
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground-950">{doc.name}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground-600">
                      {doc.typeName} · emitido em {doc.issuedAt || "—"} · validade {doc.expiresAt || "permanente"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDirected(doc)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-eye-line"></i>
                    Visualizar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-checkbox-circle-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum documento novo</p>
              <p className="text-xs text-foreground-500">
                Quando a gestão direcionar um documento a você, ele aparece aqui como alerta.
              </p>
            </div>
          )}

          {seenDocs.length > 0 && (
            <div className="mt-4 border-t border-background-200 pt-4">
              <button
                type="button"
                onClick={() => setShowSeenDocs((v) => !v)}
                aria-expanded={showSeenDocs}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 py-1 text-xs font-semibold text-foreground-600 transition-colors hover:text-foreground-900"
              >
                <i className={showSeenDocs ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                {showSeenDocs ? "Ocultar" : "Ver"} documentos já visualizados ({seenDocs.length})
              </button>

              {showSeenDocs && (
                <ul className="mt-3 flex flex-col gap-2">
                  {seenDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-100 px-4 py-3 sm:flex-row sm:items-center"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                        <i className="ri-file-check-line text-base"></i>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground-900">{doc.name}</p>
                        <p className="truncate text-xs text-foreground-500">
                          {doc.typeName} · emitido em {doc.issuedAt || "—"}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                        <i className="ri-eye-line"></i>
                        Ciente
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingDirected(doc)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-50"
                      >
                        <i className="ri-external-link-line"></i>
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Documentos aguardando assinatura */}
      <div className="mt-6">
        <SectionCard
          title="Documentos aguardando assinatura"
          subtitle="Acesso direto ao documento para conferência e assinatura"
          action={
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
              <i className="ri-timer-line"></i>
              {totalPending} pendente(s)
            </span>
          }
        >
          {totalPending > 0 ? (
            <ul className="flex flex-col gap-3">
              {myPendingAprs.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                    <i className="ri-clipboard-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
                        APR
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground-950">{a.title}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      {a.activity} · {a.area} · {a.date} · Resp.: {a.responsible}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSigning(a)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-pen-nib-line"></i>
                    Abrir e assinar
                  </button>
                </li>
              ))}

              {myPendingEpis.map((d) => {
                const totalItems = d.items.reduce((sum, i) => sum + i.quantity, 0);
                return (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                      <i className="ri-shirt-line text-lg"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
                          Ficha de EPI
                        </span>
                        <p className="truncate text-sm font-semibold text-foreground-950">
                          Entrega de {d.date} · {d.reason}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-foreground-500">
                        {d.items.length} tipo(s) · {totalItems} unidade(s) · {d.items.map((i) => i.name).join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSigningEpi(d)}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                    >
                      <i className="ri-pen-nib-line"></i>
                      Abrir e assinar
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-checkbox-circle-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum documento pendente</p>
              <p className="text-xs text-foreground-500">
                Quando um documento precisar da sua assinatura, ele aparece aqui.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Documentos do fluxo eletrônico */}
      {pendingDocuments.length > 0 && (
        <div className="mt-6">
          <SectionCard
            title="Assinaturas eletrônicas pendentes"
            subtitle="Visualize e baixe o documento completo antes de assinar com autenticação adicional"
            action={
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                <i className="ri-timer-line"></i>
                {pendingDocuments.length} pendente(s)
              </span>
            }
          >
            <ul className="flex flex-col gap-3">
              {pendingDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                    <i className="ri-file-shield-2-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
                        Assinatura eletrônica
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground-950">{doc.title}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground-500">
                      Versão {doc.version} · {doc.signatories.filter((s) => s.status === "assinado").length} de{" "}
                      {doc.signatories.length} assinaturas
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDoc(doc)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-pen-nib-line"></i>
                    Abrir e assinar
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}

      {/* Outros alertas */}
      <div className="mt-6">
        <SectionCard title="Outros alertas" subtitle="Vencimentos de documentos, exames e pendências">
          <ul className="flex flex-col gap-3">
            {colaboradorAlerts.map((alert) => (
              <li
                key={alert.id}
                className={`rounded-lg border p-4 ${levelStyles[alert.level]}`}
              >
                <div className="flex items-start gap-3">
                  <i className={`${alert.icon} mt-0.5 text-lg`}></i>
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">{alert.description}</p>
                    <p className="mt-2 text-[11px] font-medium opacity-75">{alert.when}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <AprSignModal
        record={signing}
        collaboratorId={me.id}
        collaboratorName={me.name}
        onClose={() => setSigning(null)}
        onSign={handleSign}
      />
      <EpiSignModal
        delivery={signingEpi}
        collaboratorName={me.name}
        onClose={() => setSigningEpi(null)}
        onSign={handleSignEpi}
      />
      <DocumentDetailModal
        doc={viewingDoc}
        onClose={() => setViewingDoc(null)}
        actor={actor}
        onChanged={setNotice}
      />
      <DocumentViewerModal
        doc={viewingDirected}
        onClose={() => setViewingDirected(null)}
        onViewed={handleViewedDocument}
      />
    </div>
  );
}