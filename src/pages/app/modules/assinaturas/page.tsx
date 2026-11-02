import { useMemo, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { KpiCard, SectionCard } from "@/pages/app/components/ui";
import {
  useSignatureActor,
  useSignatureDocuments,
} from "@/pages/app/signature/documentStore";
import {
  documentStatusLabels,
  documentTypeLabels,
  type SignatureDocument,
  type SignatureDocumentStatus,
} from "@/pages/app/signature/documentService";
import DocumentDraftModal from "./components/DocumentDraftModal";
import DocumentDetailModal from "./components/DocumentDetailModal";

const statusOrder: SignatureDocumentStatus[] = ["rascunho", "aguardando", "parcial", "concluido", "cancelado"];

const statusTone: Record<SignatureDocumentStatus, string> = {
  rascunho: "bg-background-200 text-foreground-700",
  aguardando: "bg-accent-100 text-accent-800",
  parcial: "bg-secondary-100 text-secondary-900",
  concluido: "bg-primary-100 text-primary-700",
  cancelado: "bg-background-200 text-foreground-500",
};

const typeIcon: Record<string, string> = {
  epi: "ri-shirt-line",
  dds: "ri-presentation-line",
  certificado: "ri-award-line",
  apr: "ri-clipboard-line",
  outro: "ri-file-text-line",
};

export default function AssinaturasPage() {
  const session = useAppSession();
  const actor = useSignatureActor();
  const documents = useSignatureDocuments();
  const isManager = session.role === "admin" || session.role === "super";

  const [filter, setFilter] = useState<"todos" | "meus-pendentes" | SignatureDocumentStatus>("todos");
  const [search, setSearch] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [editing, setEditing] = useState<SignatureDocument | null>(null);
  const [viewing, setViewing] = useState<SignatureDocument | null>(null);
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => {
    const base: Record<string, number> = { total: documents.length };
    statusOrder.forEach((s) => {
      base[s] = documents.filter((d) => d.status === s).length;
    });
    return base;
  }, [documents]);

  const myPendingCount = useMemo(
    () =>
      documents.filter(
        (d) =>
          (d.status === "aguardando" || d.status === "parcial") &&
          d.signatories.some((s) => s.collaboratorRef === actor.collaboratorRef && s.status === "pendente")
      ).length,
    [documents, actor.collaboratorRef]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (filter === "meus-pendentes") {
        const pending =
          (d.status === "aguardando" || d.status === "parcial") &&
          d.signatories.some((s) => s.collaboratorRef === actor.collaboratorRef && s.status === "pendente");
        if (!pending) return false;
      } else if (filter !== "todos" && d.status !== filter) {
        return false;
      }
      if (term && !d.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [documents, filter, search, actor.collaboratorRef]);

  const handleSaved = (message: string) => setNotice(message);
  const handleOpen = (doc: SignatureDocument) => setViewing(doc);
  const handleEdit = (doc: SignatureDocument) => {
    setEditing(doc);
    setDraftOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-file-shield-2-line"></i>
            Assinatura eletrônica
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Assinaturas
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Documentos com estados, signatários, posições de assinatura e autenticação adicional validados no servidor.
          </p>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDraftOpen(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Novo documento
          </button>
        )}
      </div>

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-900"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {myPendingCount > 0 && !isManager && (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-accent-300 bg-accent-50 px-5 py-4 dark:border-accent-800 dark:bg-accent-950">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-pen-nib-line text-xl"></i>
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground-950">
              {myPendingCount} documento(s) aguardando a sua assinatura
            </p>
            <p className="text-xs text-foreground-600">Abra o documento, confira o conteúdo e assine com autenticação adicional.</p>
          </div>
          <button
            type="button"
            onClick={() => setFilter("meus-pendentes")}
            className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            Ver pendentes
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon="ri-file-list-3-line" label="Documentos" value={String(counts.total)} delta="no total" trend="up" tone="primary" />
        <KpiCard icon="ri-timer-line" label="Aguardando assinaturas" value={String(counts.aguardando)} delta="em aberto" trend="up" tone="accent" />
        <KpiCard icon="ri-list-check-2" label="Parcialmente assinado" value={String(counts.parcial)} delta="em andamento" trend="up" tone="secondary" />
        <KpiCard icon="ri-checkbox-circle-line" label="Concluídos" value={String(counts.concluido)} delta="encerrados" trend="up" tone="primary" />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Documentos"
          subtitle="Estados: Rascunho, Aguardando assinaturas, Parcialmente assinado, Concluído e Cancelado"
          action={
            <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 sm:flex">
              <span className="flex h-9 w-9 items-center justify-center text-foreground-400">
                <i className="ri-search-line text-base"></i>
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título"
                className="w-40 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-56"
              />
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter("todos")}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === "todos" ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600 hover:bg-background-200"
              }`}
            >
              Todos
              <span className="text-[10px] opacity-80">{counts.total}</span>
            </button>
            {!isManager && (
              <button
                type="button"
                onClick={() => setFilter("meus-pendentes")}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === "meus-pendentes" ? "bg-accent-500 text-background-50" : "bg-accent-100 text-accent-800 hover:bg-accent-200"
                }`}
              >
                Meus pendentes
                <span className="text-[10px] opacity-80">{myPendingCount}</span>
              </button>
            )}
            {statusOrder.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === s ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600 hover:bg-background-200"
                }`}
              >
                {documentStatusLabels[s]}
                <span className="text-[10px] opacity-80">{counts[s]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                <i className="ri-file-shield-2-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum documento neste filtro</p>
              <p className="text-xs text-foreground-500">
                {isManager ? "Crie um novo documento para iniciar um fluxo de assinatura." : "Você não tem documentos aqui no momento."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((doc) => {
                const signed = doc.signatories.filter((s) => s.status === "assinado").length;
                const total = doc.signatories.length;
                const isMinePending =
                  (doc.status === "aguardando" || doc.status === "parcial") &&
                  doc.signatories.some((s) => s.collaboratorRef === actor.collaboratorRef && s.status === "pendente");
                return (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                      <i className={`${typeIcon[doc.docType] || "ri-file-text-line"} text-lg`}></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone[doc.status]}`}>
                          {documentStatusLabels[doc.status]}
                        </span>
                        <span className="rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-700">
                          v{doc.version}
                        </span>
                        {isMinePending && (
                          <span className="rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-background-50">
                            Sua assinatura pendente
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold text-foreground-950">{doc.title}</p>
                      <p className="truncate text-xs text-foreground-500">
                        {documentTypeLabels[doc.docType]} · {signed}/{total} assinaturas
                        {doc.basePdfHash ? " · PDF-base com hash" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isManager && doc.status === "rascunho" && (
                        <button
                          type="button"
                          onClick={() => handleEdit(doc)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-edit-line"></i>
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpen(doc)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                      >
                        <i className="ri-eye-line"></i>
                        Abrir
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <DocumentDraftModal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        actor={actor}
        editing={editing}
        onSaved={handleSaved}
      />
      <DocumentDetailModal doc={viewing} onClose={() => setViewing(null)} actor={actor} onChanged={handleSaved} />
    </div>
  );
}