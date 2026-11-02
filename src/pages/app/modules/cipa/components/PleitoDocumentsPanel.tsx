import { useMemo, useState } from "react";
import type { Cipa, CipaElection } from "@/mocks/cipa";
import { useAtas } from "@/pages/app/modules/cipa/cipaStore";
import { electionCommitteeAta, electionWindowLabel } from "@/pages/app/modules/cipa/cipaUtils";
import { buildBuData } from "@/pages/app/modules/cipa/ballotResult";
import {
  buildAttendanceReportPdfBody,
  buildBuPdfBody,
  buildCandidateFichaPdfBody,
  buildResultFinalAtaPdfBody,
} from "@/pages/app/modules/cipa/ballotPdf";
import {
  buildDossierPdfBody,
  buildEditalPdfBody,
  buildPossePdfBody,
  buildResultadoEditalPdfBody,
  defaultDossierParts,
} from "@/pages/app/modules/cipa/editalPdf";
import { configOf, type StoreState } from "@/pages/app/modules/cipa/electionVotingStore";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  addDocument,
  buildAttendanceReportDocument,
  buildBuDocument,
  buildCandidateFichaDocument,
  buildDossierDocument,
  buildEditalDocument,
  buildPosseDocument,
  buildResultFinalAtaDocument,
  buildResultadoDocument,
  useDocuments,
} from "@/pages/app/modules/documentos/documentsStore";
import { printHtml } from "@/pages/app/utils/exportPdf";
import {
  technicalSignatureBlockedMessage,
  useTechnicalSignatureGate,
} from "@/pages/app/modules/cipa/technicalSignatureGate";
import { technicalSignatureInfo } from "@/pages/app/modules/cipa/technicalSignatureStore";

interface PleitoDocumentsPanelProps {
  election: CipaElection;
  cipa?: Cipa;
  cipaName: string;
  companyRef: string;
  store: StoreState;
  finalized: boolean;
}

/**
 * Documentos do pleito: reúne o período vigente da CIPA e todas as peças do
 * processo eleitoral (edital de convocação, fichas de cadastro de candidatos,
 * edital de resultado, BU, ata de resultado final, relatório de comparecimento,
 * termo de posse e dossiê), permitindo (re)gerá-las e anexá-las a Documentos.
 */
export default function PleitoDocumentsPanel({ election, cipa, cipaName, store, finalized }: PleitoDocumentsPanelProps) {
  const docs = useDocuments();
  const atas = useAtas();
  const collaborators = useCollaboratorsList();
  // Dossiê é documento técnico: só sai com a assinatura do RT.
  const gate = useTechnicalSignatureGate();
  const [exportNotice, setExportNotice] = useState("");

  const bu = useMemo(() => buildBuData(store, election), [store, election]);
  const status = configOf(store, election.id)?.status ?? "rascunho";
  const closed = status === "encerrada";

  const absentees = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c) => map.set(c.id, c.name));
    return store.participations
      .filter((p) => p.electionRef === election.id && !p.hasVoted)
      .map((p) => map.get(p.collaboratorRef) || p.collaboratorRef)
      .sort((a, b) => a.localeCompare(b));
  }, [store.participations, election.id, collaborators]);

  const pleitoDocs = useMemo(
    () => docs.filter((d) => d.electionId === election.id),
    [docs, election.id]
  );

  const locked = finalized;

  const gen = (fn: () => void) => {
    if (locked) return;
    fn();
  };

  const generateEdital = () =>
    gen(() => {
      addDocument(buildEditalDocument(election, cipaName));
      printHtml(`Edital de Convocação — ${election.title}`, buildEditalPdfBody(election, cipaName));
    });

  const generateResultado = () =>
    gen(() => {
      addDocument(buildResultadoDocument(election, cipaName));
      printHtml(`Edital de Resultado — ${election.title}`, buildResultadoEditalPdfBody(election, cipaName));
    });

  const generatePosse = () =>
    gen(() => {
      addDocument(buildPosseDocument(election, cipaName));
      printHtml(`Termo de Posse — ${election.title}`, buildPossePdfBody(election, cipaName));
    });

  const generateDossie = async () => {
    if (locked) return;
    const ata = electionCommitteeAta(election, atas);
    const result = await gate.guard(
      "dossie-eleicao",
      election.id,
      `Dossiê do Processo Eleitoral — ${election.title}`,
      `${cipaName} · Processo ${election.processNumber || "—"}`
    );
    if (result !== "signed") {
      setExportNotice(technicalSignatureBlockedMessage(result, gate.responsible?.name));
      return;
    }
    setExportNotice("");
    const technical = technicalSignatureInfo("dossie-eleicao", election.id) ?? undefined;
    addDocument(buildDossierDocument(election, cipaName, ata, defaultDossierParts, [], technical));
    printHtml(
      `Dossiê do Processo Eleitoral — ${election.title}`,
      buildDossierPdfBody(election, cipaName, ata, defaultDossierParts, [], "", "", technical)
    );
  };

  const generateBu = () =>
    gen(() => {
      addDocument(buildBuDocument(election, cipaName, bu));
      printHtml(`Boletim de Urna — ${election.title}`, buildBuPdfBody(election, cipaName, bu));
    });

  const generateAtaFinal = () =>
    gen(() => {
      addDocument(buildResultFinalAtaDocument(election, cipaName, bu));
      printHtml(`Ata de Resultado Final — ${election.title}`, buildResultFinalAtaPdfBody(election, cipaName, bu));
    });

  const generateComparecimento = () =>
    gen(() => {
      addDocument(buildAttendanceReportDocument(election, cipaName, bu, absentees));
      printHtml(`Relatório de comparecimento — ${election.title}`, buildAttendanceReportPdfBody(election, cipaName, bu, absentees));
    });

  const generateFicha = (candidateId: string) =>
    gen(() => {
      const candidate = election.candidates.find((c) => c.id === candidateId);
      if (!candidate) return;
      addDocument(buildCandidateFichaDocument(election, candidate, cipaName));
      printHtml(`Ficha de candidato — ${candidate.name}`, buildCandidateFichaPdfBody(candidate, election, cipaName));
    });

  const candidates = election.candidates.filter((c) => c.name.trim());

  return (
    <div className="flex flex-col gap-5">
      {/* Período vigente da CIPA */}
      <section className="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-secondary-900">
          <i className="ri-government-line text-base"></i>
          Período vigente da CIPA
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Comissão</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{cipa?.name || cipaName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Mandato</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{cipa?.mandateNumber || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Vigência</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">
              {cipa?.mandateStart || "—"} a {cipa?.mandateEnd || "—"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-foreground-500">
          Processo eleitoral: {election.processNumber || "sem nº"} · Janela de votação: {electionWindowLabel(election)}
        </p>
      </section>

      {locked && (
        <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
          <i className="ri-lock-2-line"></i>
          Processo encerrado — os documentos do pleito estão preservados e não podem ser alterados.
        </div>
      )}

      {exportNotice && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
          <i className="ri-lock-2-line mt-0.5 text-base"></i>
          <span className="flex-1">{exportNotice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setExportNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-accent-100 dark:hover:bg-accent-900"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {/* Geração */}
      <section className="rounded-lg border border-background-200 bg-background-50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-folder-shield-2-line text-base text-primary-700"></i>
          Peças do processo eleitoral
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DocButton icon="ri-megaphone-line" label="Edital de Convocação" onClick={generateEdital} disabled={locked} />
          <DocButton icon="ri-award-line" label="Edital de Resultado" onClick={generateResultado} disabled={locked || !closed} title={!closed ? "Disponível após encerrar a votação" : undefined} />
          <DocButton icon="ri-file-list-3-line" label="Boletim de Urna (BU)" onClick={generateBu} disabled={locked || !closed} title={!closed ? "Disponível após encerrar a votação" : undefined} />
          <DocButton icon="ri-draft-line" label="Ata de Resultado Final" onClick={generateAtaFinal} disabled={locked || !closed} title={!closed ? "Disponível após encerrar a votação" : undefined} />
          <DocButton icon="ri-user-forbid-line" label="Relatório de comparecimento" onClick={generateComparecimento} disabled={locked || !closed} title={!closed ? "Disponível após encerrar a votação" : undefined} />
          <DocButton icon="ri-user-star-line" label="Termo de Posse" onClick={generatePosse} disabled={locked} />
          <DocButton icon="ri-folder-shield-2-line" label="Dossiê" onClick={() => void generateDossie()} disabled={locked} />
        </div>

        {candidates.length > 0 && (
          <div className="mt-4 border-t border-background-200 pt-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Fichas de cadastro de candidatos ({candidates.length})</p>
            <div className="flex flex-wrap items-center gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => generateFicha(c.id)}
                  disabled={locked}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-50"
                >
                  <i className="ri-file-user-line"></i>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Documentos já anexados ao pleito */}
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
          Documentos do pleito em Documentos ({pleitoDocs.length})
        </p>
        <div className="overflow-hidden rounded-lg border border-background-200">
          {pleitoDocs.length === 0 && (
            <p className="px-4 py-5 text-center text-xs text-foreground-500">
              Nenhum documento do pleito anexado ainda. Gere as peças acima.
            </p>
          )}
          {pleitoDocs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-background-100 px-4 py-2.5 last:border-b-0">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background-100 text-foreground-500">
                  <i className={d.fileType === "img" ? "ri-image-line" : "ri-file-pdf-2-line"}></i>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground-900">{d.name}</p>
                  <p className="truncate text-[11px] text-foreground-500">{d.typeName} · emitido em {d.issuedAt}</p>
                </div>
              </div>
              {d.attachedPdfHtml ? (
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-700">
                  <i className="ri-attachment-2"></i> PDF anexado
                </span>
              ) : (
                <span className="whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-500">
                  Registrado
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
      {gate.modal}
    </div>
  );
}

function DocButton({ icon, label, onClick, disabled, title }: { icon: string; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <i className={`${icon} text-base`}></i>
      {label}
    </button>
  );
}