import { useMemo, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { KpiCard, SectionCard } from "@/pages/app/components/ui";
import { useSignatureActor, useSignatureDocuments } from "@/pages/app/signature/documentStore";
import {
  documentStatusLabels,
  documentTypeLabels,
  getDocumentEvidence,
  type SignatureDocType,
  type SignatureDocument,
  type SignatureDocumentStatus,
} from "@/pages/app/signature/documentService";
import type { SignatureDisplay } from "@/pages/app/signature/signatureDisplay";
import { exportDocumentPdf } from "@/pages/app/signature/documentPdf";
import { exportEvidenceCsv, exportEvidenceJson, exportEvidencePdf } from "@/pages/app/signature/evidenceExport";
import DocumentDetailModal from "@/pages/app/modules/assinaturas/components/DocumentDetailModal";
import BackToDocuments from "@/pages/app/components/BackToDocuments";

const statusOrder: SignatureDocumentStatus[] = ["parcial", "concluido", "cancelado"];

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

export default function AssinadosPage({ embedded = false }: { embedded?: boolean }) {
  const session = useAppSession();
  const actor = useSignatureActor();
  const documents = useSignatureDocuments();
  const isManager = session.role === "admin" || session.role === "super";

  const [status, setStatus] = useState<"todos" | SignatureDocumentStatus>("todos");
  const [docType, setDocType] = useState<"todos" | SignatureDocType>("todos");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SignatureDocument | null>(null);

  // "Documentos assinados" = tudo que saiu do rascunho e já tem ao menos uma assinatura.
  const signed = useMemo(
    () => documents.filter((d) => d.status !== "rascunho"),
    [documents]
  );

  const counts = useMemo(() => {
    const base: Record<string, number> = { total: signed.length };
    statusOrder.forEach((s) => {
      base[s] = signed.filter((d) => d.status === s).length;
    });
    return base;
  }, [signed]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return signed.filter((d) => {
      if (status !== "todos" && d.status !== status) return false;
      if (docType !== "todos" && d.docType !== docType) return false;
      if (term && !d.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [signed, status, docType, search]);

  const runExport = async (
    doc: SignatureDocument,
    kind: "document" | "evidence-pdf" | "evidence-csv" | "evidence-json"
  ) => {
    setMenuId(null);
    setBusyId(doc.id);
    setError("");
    setNotice("");
    try {
      const evidence = await getDocumentEvidence(actor, doc.id);
      if (kind === "document") {
        const map: Record<string, SignatureDisplay> = {};
        evidence.signatures.forEach((s) => {
          if (s.signatoryId) {
            map[s.signatoryId] = {
              signatureUid: s.signatureUid,
              signerName: s.signerName,
              signedAt: s.signedAt,
              timezoneDisplay: s.timezoneDisplay,
              representationSnapshot: s.representationSnapshot,
            };
          }
        });
        exportDocumentPdf(doc, map);
        setNotice("Documento exportado em PDF com as assinaturas preservadas.");
      } else if (kind === "evidence-pdf") {
        exportEvidencePdf(evidence);
        setNotice("Relatório de evidências exportado em PDF.");
      } else if (kind === "evidence-csv") {
        exportEvidenceCsv(evidence);
        setNotice("Evidências exportadas em planilha (CSV).");
      } else {
        exportEvidenceJson(evidence);
        setNotice("Pacote JSON de preservação independente gerado.");
      }
    } catch (err) {
      setError((err as Error).message || "Não foi possível exportar. Confira sua autorização de acesso.");
    } finally {
      setBusyId(null);
    }
  };

  if (!isManager) {
    return (
      <div className={embedded ? "" : "mx-auto max-w-[1100px]"}>
        {!embedded && <BackToDocuments />}
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-lock-2-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Área restrita à gestão</p>
          <p className="mt-1 text-xs text-foreground-500">
            A exportação de documentos assinados e evidências exige autorização de gestor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1200px]"}>
      {!embedded && <BackToDocuments />}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-folder-shield-2-line"></i>
            Conformidade
          </p>
          <h1
            className={`mt-2 font-heading font-extrabold tracking-tight text-foreground-950 ${
              embedded ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
            }`}
          >
            Documentos assinados
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Filtre, baixe o documento e exporte as evidências para auditoria, fiscalização e preservação independente.
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

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon="ri-file-shield-2-line" label="Documentos assinados" value={String(counts.total)} delta="com assinatura" trend="up" tone="primary" />
        <KpiCard icon="ri-list-check-2" label="Parciais" value={String(counts.parcial)} delta="em andamento" trend="up" tone="secondary" />
        <KpiCard icon="ri-checkbox-circle-line" label="Concluídos" value={String(counts.concluido)} delta="cerrados" trend="up" tone="primary" />
        <KpiCard icon="ri-forbid-2-line" label="Cancelados" value={String(counts.cancelado)} delta="não vigentes" trend="down" tone="accent" />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Filtros"
          subtitle="Refine por situação, tipo e título do documento"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus("todos")}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  status === "todos" ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600 hover:bg-background-200"
                }`}
              >
                Todos
                <span className="text-[10px] opacity-80">{counts.total}</span>
              </button>
              {statusOrder.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    status === s ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {documentStatusLabels[s]}
                  <span className="text-[10px] opacity-80">{counts[s]}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as "todos" | SignatureDocType)}
                className="appearance-none rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
              >
                <option value="todos">Todos os tipos</option>
                {(Object.keys(documentTypeLabels) as SignatureDocType[]).map((t) => (
                  <option key={t} value={t}>
                    {documentTypeLabels[t]}
                  </option>
                ))}
              </select>
              <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3">
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
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Documentos" subtitle={`${filtered.length} documento(s) neste filtro`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                <i className="ri-folder-shield-2-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum documento neste filtro</p>
              <p className="text-xs text-foreground-500">Ajuste os filtros ou aguarde novas assinaturas.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((doc) => {
                const signedCount = doc.signatories.filter((s) => s.status === "assinado").length;
                const total = doc.signatories.length;
                const busy = busyId === doc.id;
                return (
                  <li
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 lg:flex-row lg:items-center"
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
                        {doc.finalPdfHash && (
                          <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                            PDF final com hash
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold text-foreground-950">{doc.title}</p>
                      <p className="truncate text-xs text-foreground-500">
                        {documentTypeLabels[doc.docType]} · {signedCount}/{total} assinaturas
                        {doc.documentUid ? ` · ${doc.documentUid.slice(0, 8)}…` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(doc)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-eye-line"></i>
                        Abrir
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runExport(doc, "document")}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-60"
                      >
                        <i className="ri-file-pdf-2-line"></i>
                        Documento
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setMenuId((v) => (v === doc.id ? null : doc.id))}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                        >
                          <i className="ri-download-2-line"></i>
                          Evidências
                          <i className={`ri-arrow-down-s-line transition-transform ${menuId === doc.id ? "rotate-180" : ""}`}></i>
                        </button>
                        {menuId === doc.id && (
                          <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-md border border-background-200 bg-background-50 py-1.5">
                            <button
                              type="button"
                              onClick={() => runExport(doc, "evidence-pdf")}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground-700 transition-colors hover:bg-background-100"
                            >
                              <i className="ri-file-pdf-2-line text-base text-accent-700"></i>
                              Relatório de evidências (PDF)
                            </button>
                            <button
                              type="button"
                              onClick={() => runExport(doc, "evidence-csv")}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground-700 transition-colors hover:bg-background-100"
                            >
                              <i className="ri-file-excel-2-line text-base text-primary-700"></i>
                              Evidências (CSV)
                            </button>
                            <button
                              type="button"
                              onClick={() => runExport(doc, "evidence-json")}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground-700 transition-colors hover:bg-background-100"
                            >
                              <i className="ri-code-box-line text-base text-secondary-700"></i>
                              Pacote JSON (preservação)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <DocumentDetailModal
        doc={viewing}
        onClose={() => setViewing(null)}
        actor={actor}
        onChanged={setNotice}
      />
    </div>
  );
}