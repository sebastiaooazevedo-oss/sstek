import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { KpiCard, SectionCard } from "@/pages/app/components/ui";
import { getInitials, useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import {
  canPublishRegulation,
} from "@/pages/app/modules/documentos/documentPermissionsStore";
import {
  resolveRegulationFileUrl,
  signaturesForRegulation,
  useCurrentRegulation,
  usePreviousRegulations,
  useRegulationSignatures,
  useRegulationStoreState,
  type InternalRegulation,
  type RegulationSignatureRecord,
} from "@/pages/app/modules/regulamento/regulationStore";
import RegulationReader from "@/pages/app/modules/regulamento/components/RegulationReader";
import UploadRegulationModal from "@/pages/app/modules/regulamento/components/UploadRegulationModal";

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-BR");
}

interface SignatureMap {
  byCollaborator: Map<string, RegulationSignatureRecord>;
}

function buildSignatureMap(
  signatures: RegulationSignatureRecord[],
  regulationId: string | null
): SignatureMap {
  const map = new Map<string, RegulationSignatureRecord>();
  if (regulationId) {
    signaturesForRegulation(signatures, regulationId).forEach((sig) => {
      map.set(sig.collaboratorId, sig);
    });
  }
  return { byCollaborator: map };
}

export default function AdminRegulationPanel() {
  const session = useAppSession();
  const current = useCurrentRegulation();
  const previous = usePreviousRegulations();
  const signatures = useRegulationSignatures();
  const storeState = useRegulationStoreState();

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "assinados" | "pendentes">("todos");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<InternalRegulation | null>(null);
  const [openingFile, setOpeningFile] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const canPublish = canPublishRegulation(session.role);

  const activeCollaborators = useMemo(
    () => collaborators.filter((c) => c.status !== "Desligado"),
    []
  );

  const currentSignatures = useMemo(
    () => buildSignatureMap(signatures, current?.id ?? null),
    [signatures, current?.id]
  );

  const signedActive = useMemo(
    () => activeCollaborators.filter((c) => currentSignatures.byCollaborator.has(c.id)).length,
    [activeCollaborators, currentSignatures]
  );

  const pendingActive = activeCollaborators.length - signedActive;
  const adoption = activeCollaborators.length
    ? Math.round((signedActive / activeCollaborators.length) * 100)
    : 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeCollaborators
      .filter((collab) => {
        const sig = currentSignatures.byCollaborator.get(collab.id);
        if (filter === "assinados" && !sig) return false;
        if (filter === "pendentes" && sig) return false;
        if (term) {
          const haystack = `${collab.name} ${collab.role} ${collab.area}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const sa = currentSignatures.byCollaborator.get(a.id) ? 1 : 0;
        const sb = currentSignatures.byCollaborator.get(b.id) ? 1 : 0;
        return sa - sb;
      });
  }, [activeCollaborators, currentSignatures, filter, search]);

  const handleOpenFile = async (regulation: InternalRegulation) => {
    setError("");
    setOpeningFile(true);
    try {
      const url = await resolveRegulationFileUrl(regulation);
      if (!url) {
        setError("Não foi possível gerar o link do PDF desta versão.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } finally {
      setOpeningFile(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-book-read-line"></i>
            Conformidade
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Regulamento Interno
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-foreground-600">
            Publique o PDF do regulamento e acompanhe quem já leu e assinou a versão vigente. Cada nova publicação
            invalida a anterior e exige nova assinatura de todos os colaboradores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {current && (
            <button
              type="button"
              onClick={() => setPreview(current)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-eye-line text-base"></i>
              Visualizar
            </button>
          )}
          {current?.storagePath && (
            <button
              type="button"
              disabled={openingFile}
              onClick={() => void handleOpenFile(current)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-60"
            >
              <i className="ri-file-pdf-2-line text-base"></i>
              Abrir PDF
            </button>
          )}
          <button
            type="button"
            disabled={!canPublish}
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ri-upload-cloud-2-line text-base"></i>
            Publicar nova versão
          </button>
        </div>
      </div>

      {!canPublish && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-lock-2-line mt-0.5 text-base"></i>
          <span>
            Seu perfil não está parametrizado para publicar o Regulamento Interno. A troca do PDF é permitida apenas
            aos perfis autorizados em Configurações → Exclusão de documentos.
          </span>
        </div>
      )}

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

      {storeState.error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900">
          <i className="ri-wifi-off-line mt-0.5 text-base"></i>
          <span className="flex-1">{storeState.error} Os dados exibidos podem estar desatualizados.</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon="ri-book-read-line"
          label="Versão vigente"
          value={current ? `v${current.version}` : "—"}
          delta={current ? `${current.pageCount} páginas` : "sem publicação"}
          trend="up"
          tone="primary"
        />
        <KpiCard
          icon="ri-checkbox-circle-line"
          label="Já leram e assinaram"
          value={String(signedActive)}
          delta={`de ${activeCollaborators.length} colaboradores`}
          trend="up"
          tone="primary"
        />
        <KpiCard
          icon="ri-time-line"
          label="Faltam assinar"
          value={String(pendingActive)}
          delta={pendingActive > 0 ? "pendência ativa" : "todos em dia"}
          trend={pendingActive > 0 ? "down" : "up"}
          tone="accent"
        />
        <KpiCard
          icon="ri-bar-chart-2-line"
          label="Adesão"
          value={`${adoption}%`}
          delta={`${previous.length} versão(ões) anterior(es)`}
          trend="up"
          tone="secondary"
        />
      </div>

      {!current ? (
        <div className="mt-6 rounded-lg border border-dashed border-background-300 bg-background-50 px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-upload-cloud-2-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Nenhum regulamento publicado</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground-500">
            Envie o PDF do Regulamento Interno para disponibilizar a leitura e a assinatura de ciência aos
            colaboradores.
          </p>
          {canPublish && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-upload-cloud-2-line text-base"></i>
              Publicar regulamento
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Versão vigente */}
          <div className="mt-6 rounded-lg border border-background-200 bg-background-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <i className="ri-book-2-line text-xl"></i>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-800">
                      <i className="ri-shield-check-line"></i>
                      Vigente · v{current.version}
                    </span>
                    <span className="rounded-full bg-background-100 px-2.5 py-0.5 text-[11px] font-medium text-foreground-600">
                      {current.pageCount} páginas
                    </span>
                    {current.fileSize && (
                      <span className="rounded-full bg-background-100 px-2.5 py-0.5 text-[11px] font-medium text-foreground-600">
                        PDF · {current.fileSize}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-foreground-950">{current.title}</p>
                  <p className="mt-0.5 text-xs text-foreground-500">
                    Publicado em {formatDateTime(current.publishedAt)}
                    {current.publishedBy ? ` por ${current.publishedBy}` : ""}
                  </p>
                  {current.summary && (
                    <p className="mt-1.5 line-clamp-2 max-w-2xl text-xs leading-relaxed text-foreground-600">
                      {current.summary}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0 rounded-lg border border-background-200 bg-background-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Adesão</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-background-200">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${adoption}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-foreground-900">{adoption}%</span>
                </div>
                <p className="mt-1 text-[11px] text-foreground-500">
                  {signedActive} assinaram · {pendingActive} pendentes
                </p>
              </div>
            </div>
          </div>

          {/* Quem assinou / falta assinar */}
          <div className="mt-6">
            <SectionCard
              title="Quem já leu e assinou"
              subtitle={`Acompanhamento da versão vigente (v${current.version}) — assim como os demais documentos da empresa.`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {(["todos", "assinados", "pendentes"] as const).map((id) => {
                    const active = filter === id;
                    const label = id === "todos" ? "Todos" : id === "assinados" ? "Assinados" : "Pendentes";
                    const count =
                      id === "todos" ? activeCollaborators.length : id === "assinados" ? signedActive : pendingActive;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFilter(id)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-primary-500 text-background-50"
                            : "bg-background-100 text-foreground-600 hover:bg-background-200"
                        }`}
                      >
                        {label}
                        <span className="text-[10px] opacity-80">{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3">
                  <span className="flex h-9 w-9 items-center justify-center text-foreground-400">
                    <i className="ri-search-line text-base"></i>
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar colaborador"
                    className="w-44 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-56"
                  />
                </div>
              </div>

              <ul className="mt-4 flex flex-col gap-2">
                {filtered.map((collab) => {
                  const sig = currentSignatures.byCollaborator.get(collab.id);
                  return (
                    <li
                      key={collab.id}
                      className="flex flex-col gap-2 rounded-md border border-background-200 bg-background-100 p-3 sm:flex-row sm:items-center"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-background-50">
                        {getInitials(collab.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground-950">{collab.name}</p>
                        <p className="truncate text-[11px] text-foreground-500">
                          {collab.role} · {collab.area}
                          {collab.establishment ? ` · ${collab.establishment}` : ""}
                        </p>
                      </div>
                      {sig ? (
                        <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                            <i className="ri-checkbox-circle-line"></i>
                            Assinado
                          </span>
                          <span className="text-[11px] text-foreground-400">{formatDateTime(sig.signedAt)}</span>
                        </div>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
                          <i className="ri-time-line"></i>
                          Aguardando leitura e assinatura
                        </span>
                      )}
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="rounded-md border border-dashed border-background-300 px-4 py-8 text-center text-xs text-foreground-500">
                    Nenhum colaborador neste filtro.
                  </li>
                )}
              </ul>
            </SectionCard>
          </div>
        </>
      )}

      {/* Histórico de versões */}
      <div className="mt-6">
        <SectionCard
          title="Histórico de versões"
          subtitle="As versões substituídas permanecem arquivadas, sinalizadas como não vigentes, com o registro de quem assinou cada uma."
        >
          {previous.length === 0 ? (
            <div className="rounded-md border border-dashed border-background-300 px-4 py-8 text-center text-xs text-foreground-500">
              Ainda não há versões anteriores. Ao publicar um novo regulamento, a versão atual passa para este
              histórico.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {previous.map((reg) => {
                const versionSignatures = signaturesForRegulation(signatures, reg.id);
                const expanded = expandedVersion === reg.id;
                return (
                  <li key={reg.id} className="rounded-lg border border-background-200 bg-background-100 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-600">
                            <i className="ri-forbid-2-line"></i>
                            Substituído · não vigente
                          </span>
                          <span className="rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-700">
                            v{reg.version}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-foreground-950">{reg.title}</p>
                        <p className="mt-0.5 text-[11px] text-foreground-500">
                          Publicado em {formatDate(reg.publishedAt)}
                          {reg.replacedAt ? ` · Substituído em ${formatDate(reg.replacedAt)}` : ""}
                          {reg.replacedBy ? ` por ${reg.replacedBy}` : ""} · {versionSignatures.length} assinatura(s)
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {reg.storagePath && (
                          <button
                            type="button"
                            onClick={() => void handleOpenFile(reg)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                          >
                            <i className="ri-file-pdf-2-line"></i>
                            Abrir PDF
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedVersion(expanded ? null : reg.id)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className={`${expanded ? "ri-eye-off-line" : "ri-eye-line"}`}></i>
                          {expanded ? "Ocultar assinaturas" : "Ver assinaturas"}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-background-200 pt-3">
                        {versionSignatures.length === 0 ? (
                          <span className="text-xs text-foreground-500">Nenhuma assinatura registrada.</span>
                        ) : (
                          versionSignatures.map((sig) => (
                            <span
                              key={sig.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-background-50 px-2.5 py-1 text-[11px] font-medium text-foreground-700"
                            >
                              <i className="ri-checkbox-circle-line text-primary-600"></i>
                              {sig.collaboratorName}
                              <span className="text-foreground-400">{formatDate(sig.signedAt)}</span>
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <UploadRegulationModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        currentVersion={current?.version ?? 0}
        publishedBy={session.name}
        onPublished={(message) => {
          setNotice(message);
          setError("");
        }}
      />

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        size="xl"
        icon="ri-eye-line"
        title={preview?.title ?? "Regulamento Interno"}
        subtitle={`Visualização do administrador · versão ${preview?.version ?? "—"}`}
      >
        {preview && (
          <RegulationReader
            regulation={preview}
            signature={null}
            signer={null}
            preview
          />
        )}
      </Modal>
    </div>
  );
}