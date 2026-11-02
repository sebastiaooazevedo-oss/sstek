import { useMemo, useState } from "react";
import { addAta, updateAta, useAtas, useCipas, useMeetings } from "@/pages/app/modules/cipa/cipaStore";
import AtaFormModal from "@/pages/app/modules/cipa/components/AtaFormModal";
import AtaApprovalModal from "@/pages/app/modules/cipa/components/AtaApprovalModal";
import AtaSealPreview from "@/pages/app/modules/cipa/components/AtaSealPreview";
import AtaApprovalGrid from "@/pages/app/modules/cipa/components/AtaApprovalGrid";
import { ataApprovalStatus, ataSignedCount, brDateToTime, collaboratorIdByName, ensureRequiredApprovers, isAtaFullyApproved, type AtaApprover } from "@/pages/app/modules/cipa/cipaUtils";
import { addDocument, buildAtaDocument } from "@/pages/app/modules/documentos/documentsStore";
import { ataSealHtml, buildAtaPdfBody } from "@/pages/app/modules/cipa/ataPdf";
import { ataApprovalSignatureImages } from "@/pages/app/modules/cipa/ataSignatureImages";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { printHtml } from "@/pages/app/utils/exportPdf";
import type { CipaAta } from "@/mocks/cipa";

interface AtasTabProps {
  cipaId: string;
}

type ApprovalFilter = "todas" | "aprovada" | "aguardando";

const approvalFilters: { id: ApprovalFilter; label: string; icon: string }[] = [
  { id: "todas", label: "Todas", icon: "ri-list-check-2" },
  { id: "aprovada", label: "Aprovadas", icon: "ri-verified-badge-line" },
  { id: "aguardando", label: "Aguardando aprovação", icon: "ri-timer-line" },
];

export default function AtasTab({ cipaId }: AtasTabProps) {
  const atas = useAtas();
  const cipas = useCipas();
  const meetings = useMeetings();
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("todas");
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<CipaAta | null>(null);
  const registeredCollaborators = useCollaboratorsList();
  const settings = useSystemSettings();

  /** Responsável Técnico designado no cadastro (fallback: parametrização da empresa). */
  const technicalResponsible = useMemo<AtaApprover | null>(() => {
    const flagged = registeredCollaborators.find((c) => c.technicalResponsible);
    if (flagged) {
      return { role: "Responsável Técnico", name: flagged.name, collaboratorId: flagged.id };
    }
    const name = settings.technicalResponsible.trim();
    if (!name) return null;
    return { role: "Responsável Técnico", name, collaboratorId: collaboratorIdByName(name) };
  }, [registeredCollaborators, settings.technicalResponsible]);

  /** Toda ata exibe os signatários obrigatórios, mesmo os que ainda não assinaram. */
  const preparedAtas = useMemo(
    () =>
      atas.map((ata) =>
        ensureRequiredApprovers(ata, cipas.find((c) => c.id === ata.cipaId), technicalResponsible)
      ),
    [atas, cipas, technicalResponsible]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return preparedAtas
      .filter((a) => (!cipaId || a.cipaId === cipaId))
      .filter((a) => approvalFilter === "todas" || ataApprovalStatus(a) === approvalFilter)
      .filter((a) => !term || a.title.toLowerCase().includes(term) || a.content.toLowerCase().includes(term) || a.number.includes(term))
      .sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date));
  }, [preparedAtas, cipaId, search, approvalFilter]);

  const scopeCounts = useMemo(() => {
    const scoped = preparedAtas.filter((a) => !cipaId || a.cipaId === cipaId);
    return {
      todas: scoped.length,
      aprovada: scoped.filter((a) => ataApprovalStatus(a) === "aprovada").length,
      aguardando: scoped.filter((a) => ataApprovalStatus(a) === "aguardando").length,
    };
  }, [preparedAtas, cipaId]);

  /**
   * Salva a coleta de aprovação. Cada alteração atualiza o registro da ata
   * na tela de Documentos com a sua situação (aprovada / aguardando). Quando
   * a ata fica aprovada por completo, o PDF é gerado e anexado no registro.
   */
  const handleAddAta = async (ata: CipaAta) => {
    const cipa = cipas.find((c) => c.id === ata.cipaId);
    const prepared = ensureRequiredApprovers(ata, cipa, technicalResponsible);
    const signatureImages = await ataApprovalSignatureImages(prepared);
    addAta(prepared);
    addDocument(buildAtaDocument(prepared, cipa?.name, cipa?.unit, signatureImages));
  };

  const persistAta = async (ata: CipaAta) => {
    const cipa = cipas.find((c) => c.id === ata.cipaId);
    const prepared = ensureRequiredApprovers(ata, cipa, technicalResponsible);
    const signatureImages = await ataApprovalSignatureImages(prepared);
    updateAta(prepared);
    addDocument(buildAtaDocument(prepared, cipa?.name, cipa?.unit, signatureImages));
  };

  const exportAta = async (ata: CipaAta) => {
    const cipa = cipas.find((c) => c.id === ata.cipaId);
    const [sealHtml, signatureImages] = await Promise.all([
      ataSealHtml(ata, cipa?.name || "—"),
      ataApprovalSignatureImages(ata),
    ]);
    printHtml(
      `Ata da CIPA — ${ata.title}`,
      buildAtaPdfBody(ata, cipa?.name || "—", cipa?.unit || "", sealHtml, signatureImages)
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Atas de reunião</h2>
          <p className="mt-0.5 text-sm text-foreground-600">Registre as deliberações, participantes e o registro fotográfico de cada reunião.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-add-line text-base"></i>
          Nova ata
        </button>
      </div>

      <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
        <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
          <i className="ri-search-line text-base"></i>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, número ou conteúdo..."
          className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
        />
      </div>

      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-background-300 bg-background-50 p-1">
        {approvalFilters.map((f) => {
          const active = approvalFilter === f.id;
          const count = scopeCounts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setApprovalFilter(f.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"
              }`}
            >
              <i className={`${f.icon} text-base`}></i>
              {f.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        {filtered.map((ata) => {
          const cipa = cipas.find((c) => c.id === ata.cipaId);
          const meeting = meetings.find((m) => m.id === ata.meetingId);
          const isOpen = openId === ata.id;
          return (
            <div key={ata.id} className="rounded-lg border border-background-200 bg-background-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                    <i className="ri-file-text-line text-xl"></i>
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground-950">{ata.title}</h3>
                    <p className="mt-0.5 text-xs text-foreground-500">
                      {cipa?.name || "—"} · Ata nº {ata.number || "—"} · {ata.date}
                    </p>
                    {meeting && <p className="mt-0.5 text-xs text-foreground-400">Vinculada à {meeting.title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ata.approvals.length > 0 && (
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isAtaFullyApproved(ata) ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-800"
                      }`}
                    >
                      <i className={isAtaFullyApproved(ata) ? "ri-shield-check-line" : "ri-timer-line"}></i>
                      {isAtaFullyApproved(ata) ? "Aprovada" : "Aguardando aprovação"}
                    </span>
                  )}
                  {ata.photos.length > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
                      <i className="ri-camera-line"></i>
                      {ata.photos.length}
                    </span>
                  )}
                  {ata.approvals.length > 0 && (
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        ata.approvals.every((a) => a.representationSnapshot || a.signedAt)
                          ? "bg-primary-100 text-primary-700"
                          : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className="ri-quill-pen-line"></i>
                      {ataSignedCount(ata)}/{ata.approvals.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setApprovalTarget(ata)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-quill-pen-line text-base"></i>
                    Coletar aprovação
                  </button>
                  {isAtaFullyApproved(ata) ? (
                    <button
                      type="button"
                      onClick={() => void exportAta(ata)}
                      title="Baixar o PDF da ata aprovada"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                    >
                      <i className="ri-download-2-line text-base"></i>
                      Baixar PDF
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void exportAta(ata)}
                      title="Pré-visualizar o PDF da ata"
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-file-pdf-2-line text-base"></i>
                      PDF
                    </button>
                  )}
                </div>
              </div>

              <p className={`mt-3 text-sm leading-relaxed text-foreground-700 ${isOpen ? "" : "line-clamp-2"}`}>{ata.content}</p>

              {isOpen && (
                <div className="mt-4 grid grid-cols-1 gap-5 border-t border-background-100 pt-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Deliberações</p>
                    <ul className="flex flex-col gap-1.5">
                      {ata.decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                          <i className="ri-arrow-right-s-line mt-0.5 text-primary-600"></i>
                          {d}
                        </li>
                      ))}
                      {ata.decisions.length === 0 && <li className="text-sm text-foreground-400">—</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Participantes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ata.participants.map((p, i) => (
                        <span key={i} className="rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-medium text-foreground-700">
                          {p}
                        </span>
                      ))}
                      {ata.participants.length === 0 && <span className="text-sm text-foreground-400">—</span>}
                    </div>
                  </div>
                  {ata.approvals.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Aprovação da ata</p>
                      <AtaApprovalGrid ata={ata} />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <AtaSealPreview ata={ata} cipaName={cipa?.name || "—"} />
                  </div>
                  {ata.photos.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Registro fotográfico</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {ata.photos.map((p) => (
                          <div key={p.id} className="h-28 w-full overflow-hidden rounded-lg border border-background-200">
                            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : ata.id)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100"
              >
                <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                {isOpen ? "Ocultar detalhes" : "Ver ata completa"}
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-file-text-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma ata registrada</p>
          <p className="text-xs text-foreground-500">Registre a ata da primeira reunião da comissão.</p>
        </div>
      )}

      <AtaFormModal open={formOpen} onClose={() => setFormOpen(false)} onSave={handleAddAta} cipas={cipas} meetings={meetings} />
      <AtaApprovalModal
        ata={approvalTarget}
        cipa={cipas.find((c) => c.id === approvalTarget?.cipaId)}
        technicalResponsible={technicalResponsible}
        onClose={() => setApprovalTarget(null)}
        onSave={persistAta}
      />
    </div>
  );
}