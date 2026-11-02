import { useMemo, useState } from "react";
import type { Cipa, CipaAta, CipaElection } from "@/mocks/cipa";
import { buildBuData } from "@/pages/app/modules/cipa/ballotResult";
import {
  buildClosedElectionPdfBody,
  buildClosedElectionsBatchPdfBody,
  type ClosedElectionEntry,
} from "@/pages/app/modules/cipa/cipaReports";
import { finalizationOf, isElectionFinalized, type StoreState } from "@/pages/app/modules/cipa/electionVotingStore";
import { electionCommitteeAta, electionWindowLabel, toDisplayDate } from "@/pages/app/modules/cipa/cipaUtils";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { batchPdfForDocument, useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { useAppSession } from "@/pages/app/context";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";
import { logAudit } from "@/pages/app/modules/config/systemLogStore";

interface ClosedElectionsPanelProps {
  elections: CipaElection[];
  cipas: Cipa[];
  atas: CipaAta[];
  store: StoreState;
  cipaId: string;
}

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

/**
 * Painel "Eleições encerradas": lista os processos eleitorais concluídos
 * (aceite final registrado), mostra os dossiês preservados de cada pleito e
 * permite baixar o arquivo completo de cada um ou reunir vários em um único
 * PDF em lote.
 */
export default function ClosedElectionsPanel({ elections, cipas, atas, store, cipaId }: ClosedElectionsPanelProps) {
  const docs = useDocuments();
  const collaborators = useCollaboratorsList();
  const session = useAppSession();
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [sealing, setSealing] = useState(false);

  const nameByRef = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [collaborators]);

  const entries = useMemo<ClosedElectionEntry[]>(() => {
    const pool = cipaId ? elections.filter((e) => e.cipaId === cipaId) : elections;
    return pool
      .filter((e) => isElectionFinalized(store, e.id))
      .map((e) => {
        const cipa = cipas.find((c) => c.id === e.cipaId);
        const fin = finalizationOf(store, e.id);
        const dossierDoc = docs.find((d) => d.typeId === "dossie-cipa" && d.electionId === e.id);
        const absentees = store.participations
          .filter((p) => p.electionRef === e.id && !p.hasVoted)
          .map((p) => nameByRef.get(p.collaboratorRef) || p.collaboratorRef)
          .sort((a, b) => a.localeCompare(b));
        return {
          election: e,
          cipa,
          cipaName: cipa?.name || "—",
          ata: electionCommitteeAta(e, atas),
          bu: buildBuData(store, e),
          absentees,
          finalizedAt: fin?.finalizedAt ?? null,
          finalizedBy: fin?.finalizedBy ?? null,
          finalHash: fin?.finalHash ?? "",
          dossierParts: dossierDoc?.dossierParts,
          dossierAttachments: dossierDoc?.dossierAttachments,
        };
      });
  }, [elections, cipas, atas, store, cipaId, docs, nameByRef]);

  const unitFilter = useMemo(() => {
    if (!cipaId) return "";
    const c = cipas.find((x) => x.id === cipaId);
    return c?.unit || c?.name || "";
  }, [cipaId, cipas]);

  const toggle = (id: string) => {
    setNotice("");
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allSelected = entries.length > 0 && selected.length === entries.length;

  const toggleAll = () => {
    setNotice("");
    setSelected(allSelected ? [] : entries.map((e) => e.election.id));
  };

  // Conteudo canonico do arquivo do pleito — base do hash SHA-256 da chancela.
  // Precisa cobrir o que sai no papel: identificacao, urnas, eleitos, ausentes
  // e o hash de encerramento do processo.
  const entrySealContent = (entry: ClosedElectionEntry) => ({
    documento: "arquivo-pleito-cipa",
    eleicao: entry.election.title,
    processNumber: entry.election.processNumber || null,
    comissao: entry.cipaName,
    unidade: entry.cipa?.unit || entry.election.establishment || null,
    mandato: entry.cipa?.mandateNumber || null,
    janelaVotacao: electionWindowLabel(entry.election),
    votacao: toDisplayDate(entry.election.voteDate),
    encerradoEm: entry.finalizedAt,
    encerradoPor: entry.finalizedBy,
    hashEncerramento: entry.finalHash || null,
    habilitados: entry.bu.eligible,
    votaram: entry.bu.voted,
    ausentes: entry.bu.absent,
    eleitos: entry.bu.ranking
      .filter((r) => r.seat === "titular" || r.seat === "suplente")
      .map((r) => ({ nome: r.name, funcao: r.roleFunction, situacao: r.seat, votos: r.votes })),
    candidatos: entry.election.candidates
      .filter((c) => c.name.trim())
      .map((c) => ({ nome: c.name, funcao: c.roleFunction, area: c.area, votos: c.votes })),
    ausentesNomes: entry.absentees,
    dossiePecas: entry.dossierParts ?? null,
    dossieAnexos: entry.dossierAttachments ?? [],
  });

  const handleSingle = async (entry: ClosedElectionEntry) => {
    if (sealing) return;
    setSealing(true);
    try {
      const seal = await reportSealHtml({
        scope: "cipa",
        referenceRef: `arquivo-pleito|${entry.election.id}|${entry.finalHash || "sem-hash"}`,
        referenceLabel: `Arquivo do pleito — ${entry.election.title}`,
        caption: "Arquivo de pleito encerrado da CIPA",
        issuerName: session.name,
        content: entrySealContent(entry),
      });
      printHtml(
        `Arquivo do pleito — ${entry.election.title}`,
        buildClosedElectionPdfBody(entry, seal.html, seal.url),
        { actor: session.name, seal: seal.code ? { code: seal.code, url: seal.url } : undefined }
      );
      // Auditoria: registra quem baixou o arquivo e qual chancela foi emitida
      // para aquele pleito (o registro do selo continua no servidor).
      void logAudit({
        module: "cipa",
        area: "download",
        action: "downloaded",
        entity: "closed_election",
        entityId: entry.election.id,
        detail: seal.code
          ? `Arquivo do pleito baixado (chancela ${seal.code}): ${entry.election.title}`
          : `Arquivo do pleito baixado sem chancela (falha ao registrar o selo): ${entry.election.title}`,
        actorName: session.name,
      });
    } finally {
      setSealing(false);
    }
  };

  const handleBatch = async () => {
    const chosen = entries.filter((e) => selected.includes(e.election.id));
    if (!chosen.length) {
      setNotice("Selecione ao menos um pleito para baixar em lote.");
      return;
    }
    if (sealing) return;
    setSealing(true);
    try {
      const seal = await reportSealHtml({
        scope: "cipa",
        referenceRef: `arquivo-pleitos-lote|${unitFilter || "todas"}|${chosen.length}`,
        referenceLabel: `Arquivo de ${chosen.length} pleito(s) encerrado(s)${unitFilter ? ` · ${unitFilter}` : ""}`,
        caption: "Arquivo de pleitos encerrados da CIPA",
        issuerName: session.name,
        content: {
          documento: "arquivo-pleitos-cipa-lote",
          unidade: unitFilter || "Todas as unidades",
          pleitos: chosen.map((entry) => entrySealContent(entry)),
        },
      });
      printHtml(
        `Arquivo de pleitos encerrados · ${chosen.length} pleito(s)`,
        buildClosedElectionsBatchPdfBody(chosen, unitFilter, seal.html, seal.url),
        { actor: session.name, seal: seal.code ? { code: seal.code, url: seal.url } : undefined }
      );
      void logAudit({
        module: "cipa",
        area: "download",
        action: "downloaded",
        entity: "closed_election_batch",
        entityId: chosen.map((entry) => entry.election.id).join(","),
        detail: seal.code
          ? `Arquivo de ${chosen.length} pleito(s) baixado em lote (chancela ${seal.code})${unitFilter ? ` · ${unitFilter}` : ""}`
          : `Arquivo de ${chosen.length} pleito(s) baixado em lote sem chancela${unitFilter ? ` · ${unitFilter}` : ""}`,
        actorName: session.name,
      });
      setNotice(`Reunindo ${chosen.length} pleito(s) para impressão em lote...`);
    } finally {
      setSealing(false);
    }
  };

  const openDoc = (name: string, html: string | undefined) => {
    if (html) printHtml(name, html);
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
          <i className="ri-archive-2-line text-2xl"></i>
        </span>
        <p className="text-sm font-semibold text-foreground-800">Nenhuma eleição encerrada</p>
        <p className="max-w-md text-xs text-foreground-500">
          Quando um processo eleitoral receber o <strong>aceite final</strong> (Encerramento), ele aparece aqui com o
          dossiê preservado e disponível para download em lote.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Eleições encerradas</h2>
          <p className="mt-0.5 text-sm text-foreground-600">
            Pleitos concluídos com dossiê preservado e inviolável — prontos para arquivo e auditoria.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className={allSelected ? "ri-checkbox-multiple-line" : "ri-checkbox-blank-line"}></i>
            {allSelected ? "Limpar seleção" : "Selecionar todos"}
          </button>
          <button
            type="button"
            onClick={handleBatch}
            disabled={selected.length === 0 || sealing}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className={sealing ? "ri-loader-4-line animate-spin text-base" : "ri-download-2-line text-base"}></i>
            {sealing ? "Chancelando…" : `Baixar em lote${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-2.5 text-xs font-semibold text-secondary-900 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-100">
          <i className="ri-information-line"></i>
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {entries.map((entry) => {
          const e = entry.election;
          const elected = entry.bu.ranking.filter((r) => r.seat === "titular" || r.seat === "suplente");
          const pleitoDocs = docs.filter((d) => d.electionId === e.id);
          const isOpen = expanded === e.id;
          const checked = selected.includes(e.id);
          return (
            <div
              key={e.id}
              className={`rounded-lg border bg-background-50 p-5 ${checked ? "border-primary-300" : "border-background-200"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={checked ? "Remover da seleção" : "Selecionar para o lote"}
                    onClick={() => toggle(e.id)}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      checked ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300 bg-background-50 hover:border-primary-400"
                    }`}
                  >
                    {checked && <i className="ri-check-line text-xs"></i>}
                  </button>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground-950">{e.title}</h3>
                    <p className="mt-0.5 text-xs text-foreground-500">
                      {entry.cipaName} · {e.processNumber || "sem nº"}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground-400">
                      <i className="ri-calendar-check-line mr-1"></i>
                      Encerrado em {fmtDateTime(entry.finalizedAt)}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-500 px-2.5 py-1 text-[11px] font-semibold text-background-50">
                  <i className="ri-lock-2-line"></i>
                  Encerrado
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Habilitados</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{entry.bu.eligible}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Votaram</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{entry.bu.voted}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Eleitos</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{elected.length}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Ausentes</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{entry.bu.absent}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-500">
                <span className="flex items-center gap-1.5">
                  <i className="ri-user-star-line"></i>
                  {elected.length} eleito(s) (titulares/suplentes)
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-calendar-line"></i>
                  Votação: {toDisplayDate(e.voteDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-attachment-2"></i>
                  {pleitoDocs.length} documento(s) preservado(s)
                </span>
              </div>

              {entry.finalHash && (
                <p className="mt-3 break-all rounded-md bg-background-100 px-2.5 py-1.5 text-[10px] text-foreground-500" title="Hash de integridade do processo (SHA-256)">
                  <i className="ri-fingerprint-line mr-1"></i>
                  {entry.finalHash}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-background-100 pt-4">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100"
                >
                  <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                  {isOpen ? "Ocultar dossiês" : "Ver dossiês preservados"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSingle(entry)}
                  disabled={sealing}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-100 px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-500 hover:text-background-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ri-file-pdf-2-line text-base"></i>
                  Baixar arquivo do pleito (PDF)
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 overflow-hidden rounded-lg border border-background-200">
                  {pleitoDocs.length === 0 && (
                    <p className="px-4 py-4 text-center text-xs text-foreground-500">
                      Nenhum documento arquivado ainda — use "Baixar arquivo do pleito" para recompor as peças.
                    </p>
                  )}
                  {pleitoDocs.map((d) => {
                    const html = batchPdfForDocument(d);
                    return (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-background-100 px-4 py-2.5 last:border-b-0">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background-100 text-foreground-500">
                            <i className={d.fileType === "img" ? "ri-image-line" : "ri-file-pdf-2-line"}></i>
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground-900">{d.name}</p>
                            <p className="truncate text-[11px] text-foreground-500">
                              {d.typeName} · emitido em {d.issuedAt}
                            </p>
                          </div>
                        </div>
                        {html ? (
                          <button
                            type="button"
                            onClick={() => openDoc(d.name, html)}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                          >
                            <i className="ri-eye-line"></i>
                            Abrir
                          </button>
                        ) : (
                          <span className="whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[10px] font-semibold text-foreground-500">
                            Registrado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}