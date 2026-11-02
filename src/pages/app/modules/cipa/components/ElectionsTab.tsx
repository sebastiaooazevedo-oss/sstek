import { useMemo, useState } from "react";
import { addElection, updateElection, useAtas, useCipas, useElections } from "@/pages/app/modules/cipa/cipaStore";
import ElectionFormModal from "@/pages/app/modules/cipa/components/ElectionFormModal";
import CandidateRegistrationModal from "@/pages/app/modules/cipa/components/CandidateRegistrationModal";
import DossierModal from "@/pages/app/modules/cipa/components/DossierModal";
import ElectionProcessModal from "@/pages/app/modules/cipa/components/ElectionProcessModal";
import VoterRollModal from "@/pages/app/modules/cipa/components/VoterRollModal";
import ElectionVotingModal from "@/pages/app/modules/cipa/components/ElectionVotingModal";
import ElectionCompositionModal from "@/pages/app/modules/cipa/components/ElectionCompositionModal";
import ClosedElectionsPanel from "@/pages/app/modules/cipa/components/ClosedElectionsPanel";
import ConsolidatedCipaReport from "@/pages/app/modules/cipa/components/ConsolidatedCipaReport";
import { useAppSession } from "@/pages/app/context";
import { useElectionProcess } from "@/pages/app/modules/cipa/electionProcessStore";
import { isElectionFinalized, useElectionVoting } from "@/pages/app/modules/cipa/electionVotingStore";
import { latestRollOf, useVoterRoll } from "@/pages/app/modules/cipa/voterRollStore";
import { processPhase, processStatusClass } from "@/pages/app/modules/cipa/electionProcess";
import {
  candidacyState,
  electionCommitteeAta,
  electionStatusClass,
  isAtaFullyApproved,
  rankCandidates,
  toDisplayDate,
} from "@/pages/app/modules/cipa/cipaUtils";
import { buildDossierPdfBody, buildEditalPdfBody, buildPossePdfBody, buildResultadoEditalPdfBody } from "@/pages/app/modules/cipa/editalPdf";
import {
  addDocument,
  buildDossierDocument,
  buildEditalDocument,
  buildElectionAttachmentDocument,
  buildPosseDocument,
  buildResultadoDocument,
  useDocuments,
} from "@/pages/app/modules/documentos/documentsStore";
import { fileIcon } from "@/pages/app/modules/documentos/documentUtils";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";
import {
  technicalSignatureBlockedMessage,
  useTechnicalSignatureGate,
} from "@/pages/app/modules/cipa/technicalSignatureGate";
import { technicalSignatureInfo } from "@/pages/app/modules/cipa/technicalSignatureStore";
import { logAudit } from "@/pages/app/modules/config/systemLogStore";
import type { CipaElection, ElectionCandidate } from "@/mocks/cipa";
import type { DossierAttachment, DossierParts, DocumentRecord } from "@/mocks/documents";

interface ElectionsTabProps {
  cipaId: string;
}

type ElectionSubTab = "processos" | "encerradas" | "consolidado";

const subTabs: { id: ElectionSubTab; label: string; icon: string }[] = [
  { id: "processos", label: "Processos", icon: "ri-checkbox-multiple-line" },
  { id: "encerradas", label: "Eleições encerradas", icon: "ri-archive-2-line" },
  { id: "consolidado", label: "Relatório por unidade", icon: "ri-file-chart-2-line" },
];

export default function ElectionsTab({ cipaId }: ElectionsTabProps) {
  const elections = useElections();
  const cipas = useCipas();
  const atas = useAtas();
  const docs = useDocuments();
  const [lightbox, setLightbox] = useState<DocumentRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CipaElection | null>(null);
  const [regOpen, setRegOpen] = useState(false);
  const [regTargetId, setRegTargetId] = useState<string | null>(null);
  const [regEditing, setRegEditing] = useState<ElectionCandidate | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierTargetId, setDossierTargetId] = useState<string | null>(null);
  const [processOpen, setProcessOpen] = useState(false);
  const [processTargetId, setProcessTargetId] = useState<string | null>(null);
  const [baseOpen, setBaseOpen] = useState(false);
  const [baseTargetId, setBaseTargetId] = useState<string | null>(null);
  const [votingOpen, setVotingOpen] = useState(false);
  const [votingTargetId, setVotingTargetId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTargetId, setComposeTargetId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<ElectionSubTab>("processos");
  // Emissão definitiva do dossiê condicionada à assinatura do RT.
  const gate = useTechnicalSignatureGate();
  const [exportNotice, setExportNotice] = useState("");
  const session = useAppSession();
  const processState = useElectionProcess(session.subdomain);
  const votingState = useElectionVoting(session.subdomain);
  const voterState = useVoterRoll(session.subdomain);

  const filtered = useMemo(() => elections.filter((e) => !cipaId || e.cipaId === cipaId), [elections, cipaId]);

  const openProcesses = useMemo(() => filtered.filter((e) => candidacyState(e).phase === "aberta"), [filtered]);

  const regTarget = elections.find((e) => e.id === regTargetId) || null;
  const dossierTarget = elections.find((e) => e.id === dossierTargetId) || null;
  const processTarget = elections.find((e) => e.id === processTargetId) || null;
  const baseTarget = elections.find((e) => e.id === baseTargetId) || null;
  const votingTarget = elections.find((e) => e.id === votingTargetId) || null;
  const composeTarget = elections.find((e) => e.id === composeTargetId) || null;
  // Dossiê já persistido desta eleição (pré-preenche o modal ao reabrir).
  const dossierDoc = dossierTarget
    ? docs.find((d) => d.typeId === "dossie-cipa" && d.electionId === dossierTarget.id)
    : undefined;

  const handleSave = (election: CipaElection) => {
    const exists = elections.some((e) => e.id === election.id);
    if (exists) updateElection(election);
    else addElection(election);
    const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "—";
    // Gera/anexa automaticamente o Edital de Convocação quando o processo está
    // recebendo inscrições, usando as informações já preenchidas no painel.
    const st = candidacyState(election);
    if (election.status === "Inscrições" || st.phase === "aberta") {
      addDocument(buildEditalDocument(election, cipaName));
    }
    // Após a apuração (Apurada/Publicada), anexa o Edital de Resultado com a
    // lista de eleitos, também montado a partir das informações do painel.
    if (election.status === "Apurada" || election.status === "Publicada") {
      addDocument(buildResultadoDocument(election, cipaName));
    }
    // Publicada: o Termo de Posse dos eleitos e o Dossiê do Processo Eleitoral
    // (convocação + ata da comissão + resultado + posse) viram documentos
    // próprios, anexados automaticamente em Documentos.
    if (election.status === "Publicada") {
      addDocument(buildPosseDocument(election, cipaName));
      addDocument(buildDossierDocument(election, cipaName, electionCommitteeAta(election, atas)));
    }
  };

  const generateEdital = (election: CipaElection) => {
    const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "—";
    addDocument(buildEditalDocument(election, cipaName));
    printHtml(`Edital de Convocação — ${election.title}`, buildEditalPdfBody(election, cipaName));
  };

  const generateResult = (election: CipaElection) => {
    const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "—";
    addDocument(buildResultadoDocument(election, cipaName));
    printHtml(`Edital de Resultado — ${election.title}`, buildResultadoEditalPdfBody(election, cipaName));
  };

  const generatePosse = (election: CipaElection) => {
    const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "—";
    addDocument(buildPosseDocument(election, cipaName));
    printHtml(`Termo de Posse — ${election.title}`, buildPossePdfBody(election, cipaName));
  };

  const openDossier = (election: CipaElection) => {
    setDossierTargetId(election.id);
    setDossierOpen(true);
  };

  const generateDossier = async (
    election: CipaElection,
    parts: DossierParts,
    attachments: DossierAttachment[] = []
  ) => {
    const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "—";
    const ata = electionCommitteeAta(election, atas);
    // Antes de montar o dossiê definitivo, exige a assinatura do RT.
    const gateResult = await gate.guard(
      "dossie-eleicao",
      election.id,
      `Dossiê do Processo Eleitoral — ${election.title}`,
      `${cipaName} · Processo ${election.processNumber || "—"} · Ano ${election.year || "—"}`
    );
    if (gateResult !== "signed") {
      setExportNotice(technicalSignatureBlockedMessage(gateResult, gate.responsible?.name));
      return;
    }
    setExportNotice("");
    const technical = technicalSignatureInfo("dossie-eleicao", election.id) ?? undefined;
    // Arquivos externos (ex.: edital assinado em papel) viram documentos
    // próprios vinculados à eleição, além de constarem no dossiê.
    attachments.forEach((attachment) => addDocument(buildElectionAttachmentDocument(election, attachment)));
    const attachmentNames = attachments.map((attachment) => attachment.name);
    addDocument(buildDossierDocument(election, cipaName, ata, parts, attachmentNames, technical));

    // Chancela: o hash cobre exatamente o que é impresso no dossiê — quais
    // peças entraram, a ata vinculada, os anexos externos e os candidatos.
    const selectedParts = (["convocacao", "ata", "resultado", "posse"] as const).filter((key) => parts[key]);
    const seal = await reportSealHtml({
      scope: "cipa",
      referenceRef: `dossie-eleicao|${election.id}|${selectedParts.join("-")}|${attachmentNames.join("|")}`,
      referenceLabel: `Dossiê do processo eleitoral — ${election.title}`,
      caption: "Dossiê do processo eleitoral da CIPA",
      issuerName: session.name,
      content: {
        documento: "dossie-processo-eleitoral-cipa",
        eleicao: election.title,
        processo: election.processNumber || null,
        ano: election.year || null,
        status: election.status,
        comissao: cipaName,
        unidade: cipas.find((c) => c.id === election.cipaId)?.unit || election.establishment || null,
        pecas: selectedParts,
        ata: ata ? { titulo: ata.title, data: ata.date, aprovada: isAtaFullyApproved(ata) } : null,
        anexosExternos: attachmentNames,
        candidatos: election.candidates
          .filter((c) => c.name.trim())
          .map((c) => ({ nome: c.name, funcao: c.roleFunction, area: c.area, votos: c.votes })),
      },
    });

    printHtml(
      `Dossiê do Processo Eleitoral — ${election.title}`,
      buildDossierPdfBody(election, cipaName, ata, parts, attachmentNames, seal.html, seal.url, technical),
      { actor: session.name, seal: seal.code ? { code: seal.code, url: seal.url } : undefined }
    );

    void logAudit({
      module: "cipa",
      area: "download",
      action: "downloaded",
      entity: "dossier_election",
      entityId: election.id,
      detail: seal.code
        ? `Dossiê do processo eleitoral baixado (chancela ${seal.code}): ${election.title}`
        : `Dossiê do processo eleitoral baixado sem chancela (falha ao registrar o selo): ${election.title}`,
      actorName: session.name,
    });
  };

  const openRegistration = (election: CipaElection, candidate: ElectionCandidate | null = null) => {
    setRegTargetId(election.id);
    setRegEditing(candidate);
    setRegOpen(true);
  };

  const saveCandidate = (candidate: ElectionCandidate, electionId: string) => {
    const target = elections.find((e) => e.id === electionId);
    if (!target) return;
    const exists = target.candidates.some((c) => c.id === candidate.id);
    const candidates = exists
      ? target.candidates.map((c) => (c.id === candidate.id ? candidate : c))
      : [...target.candidates, candidate];
    updateElection({ ...target, candidates });
  };

  const addVote = (election: CipaElection, candidateId: string) => {
    updateElection({
      ...election,
      candidates: election.candidates.map((c) => (c.id === candidateId ? { ...c, votes: c.votes + 1 } : c)),
    });
  };

  const exportResult = (election: CipaElection) => {
    const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "—";
    const total = election.candidates.reduce((s, c) => s + c.votes, 0);
    const ranked = [...election.candidates].sort((a, b) => b.votes - a.votes);
    const rows = ranked
      .map((c, i) => `<tr><td>${i + 1}º</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.roleFunction) || "—"}</td><td>${escapeHtml(c.area) || "—"}</td><td>${c.votes}</td><td>${total ? Math.round((c.votes / total) * 100) : 0}%</td></tr>`)
      .join("");
    const body = `${pdfHeader("Eleição da CIPA · Apuração")}
      <h1>${escapeHtml(election.title)}</h1>
      <p class="muted">${escapeHtml(cipaName)} · Processo ${escapeHtml(election.processNumber) || "—"}</p>
      <div class="grid">
        <div><strong>Ano:</strong> ${escapeHtml(election.year) || "—"}</div>
        <div><strong>Situação:</strong> ${escapeHtml(election.status)}</div>
        <div><strong>Eleitores aptos:</strong> ${election.eligibleVoters}</div>
        <div><strong>Votos válidos:</strong> ${total}</div>
        <div><strong>Votação:</strong> ${escapeHtml(election.voteDate) || "—"}</div>
      </div>
      <h2>Resultado da apuração</h2>
      <table><thead><tr><th>#</th><th>Candidato</th><th>Função</th><th>Área</th><th>Votos</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>
      ${pdfFooter()}`;
    printHtml(`Apuração — ${election.title}`, body);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5 rounded-full border border-background-200 bg-background-100 p-1">
        {subTabs.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-50 hover:text-foreground-900"
              }`}
            >
              <i className={`${t.icon} text-base`}></i>
              {t.label}
            </button>
          );
        })}
      </div>

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

      {subTab === "encerradas" && (
        <ClosedElectionsPanel elections={elections} cipas={cipas} atas={atas} store={votingState} cipaId={cipaId} />
      )}

      {subTab === "consolidado" && (
        <ConsolidatedCipaReport cipas={cipas} cipaId={cipaId} elections={elections} store={votingState} />
      )}

      {subTab === "processos" && (
        <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Eleições da CIPA</h2>
          <p className="mt-0.5 text-sm text-foreground-600">Conduza o processo eleitoral conforme a NR-5: inscrições, votação, apuração e posse.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-add-line text-base"></i>
          Nova eleição
        </button>
      </div>

      {openProcesses.length > 0 && (
        <section className="rounded-lg border border-accent-200 bg-accent-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-background-50">
                <i className="ri-megaphone-line text-xl"></i>
              </span>
              <div>
                <h2 className="font-heading text-base font-bold text-foreground-950">Inscrições abertas para candidatura</h2>
                <p className="mt-0.5 text-sm text-foreground-600">Aviso público a todos os empregados interessados em concorrer às vagas da CIPA.</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-accent-800">
              <i className="ri-live-line"></i>
              {openProcesses.length} processo(s) recebendo inscrições
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {openProcesses.map((e) => {
              const st = candidacyState(e);
              const cipa = cipas.find((c) => c.id === e.cipaId);
              return (
                <div key={e.id} className="rounded-lg border border-background-200 bg-background-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-sm font-bold text-foreground-950">{e.title}</h3>
                      <p className="mt-0.5 text-[11px] text-foreground-500">{cipa?.name || "—"} · {e.processNumber || "—"}</p>
                    </div>
                    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
                      <i className="ri-timer-line"></i>
                      {st.daysLeft > 0 ? `${st.daysLeft} dia(s)` : "último dia"}
                    </span>
                  </div>
                  {e.notice && <p className="mt-2.5 text-xs leading-relaxed text-foreground-600">{e.notice}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground-500">
                    <span className="flex items-center gap-1.5">
                      <i className="ri-calendar-line"></i>
                      Inscrições: {st.start} a {st.end}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="ri-user-follow-line"></i>
                      {e.candidates.length} inscrito(s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openRegistration(e)}
                    className="mt-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600"
                  >
                    <i className="ri-user-add-line text-base"></i>
                    Quero me candidatar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filtered.map((e) => {
          const cipa = cipas.find((c) => c.id === e.cipaId);
          const total = e.candidates.reduce((s, c) => s + c.votes, 0);
          const ranking = rankCandidates(e);
          const titularVacancies = Number(e.titularVacancies) || 0;
          const suplenteVacancies = Number(e.suplenteVacancies) || 0;
          const hasVacancies = titularVacancies > 0 || suplenteVacancies > 0;
          const st = candidacyState(e);
          const proc = processState.processes.find((p) => p.electionRef === e.id);
          const roll = latestRollOf(voterState, e.id);
          const finalized = isElectionFinalized(votingState, e.id);
          // Anexos externos (arquivos que o sistema não gera) vinculados a esta
          // eleição — viram documentos em Documentos e também aparecem no card.
          const attachments = docs.filter((d) => d.electionId === e.id && d.typeId === "anexo-eleicao-cipa");
          const phaseLabel =
            st.phase === "aberta" ? "Inscrições abertas" : st.phase === "nao-iniciada" ? "Inscrições em breve" : "Inscrições encerradas";
          const phaseTone =
            st.phase === "aberta"
              ? "bg-accent-100 text-accent-800"
              : st.phase === "nao-iniciada"
                ? "bg-secondary-100 text-secondary-800"
                : "bg-background-200 text-foreground-600";
          return (
            <div key={e.id} className="rounded-lg border border-background-200 bg-background-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                    <i className="ri-checkbox-multiple-line text-xl"></i>
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground-950">{e.title}</h3>
                    <p className="mt-0.5 text-xs text-foreground-500">
                      {cipa?.name || "—"} · {e.processNumber || "sem nº"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${electionStatusClass(e.status)}`}>{e.status}</span>
                  {finalized && (
                    <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-500 px-2.5 py-1 text-[11px] font-semibold text-background-50" title="Processo encerrado e inviolável">
                      <i className="ri-lock-2-line"></i>
                      Encerrado
                    </span>
                  )}
                  {proc && (
                    <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${processStatusClass(proc.status)}`}>
                      <i className={processPhase(proc.status).icon}></i>
                      {processPhase(proc.status).label}
                    </span>
                  )}
                  {roll && (
                    <span
                      className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        roll.status === "fechada" ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-700"
                      }`}
                      title="Base eleitoral"
                    >
                      <i className={roll.status === "fechada" ? "ri-lock-2-line" : "ri-edit-2-line"}></i>
                      Base {roll.status === "fechada" ? "fechada" : "em preparo"} · {roll.status === "fechada" ? roll.eligibleCount : roll.totalCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Eleitores</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{e.eligibleVoters}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Votos</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{total}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Inscritos</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{e.candidates.length}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Votação</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{toDisplayDate(e.voteDate)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-100/60 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${phaseTone}`}>
                    <i className={st.phase === "aberta" ? "ri-live-line" : "ri-timer-line"}></i>
                    {phaseLabel}
                  </span>
                  <span className="text-[11px] text-foreground-500">
                    <i className="ri-calendar-line mr-1.5"></i>
                    {st.start} a {st.end}
                    {st.phase === "aberta" && st.daysLeft >= 0 && (
                      <strong className="ml-1.5 font-semibold text-accent-700">
                        · {st.daysLeft > 0 ? `${st.daysLeft} dia(s) restante(s)` : "último dia"}
                      </strong>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openRegistration(e)}
                  disabled={finalized}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ri-user-add-line text-base"></i>
                  Inscrever candidato
                </button>
              </div>

              <div className="mt-4 border-t border-background-100 pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">Apuração dos votos</p>
                  {hasVacancies && (
                    <span className="flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-semibold text-secondary-800">
                      <i className="ri-award-line"></i>
                      {titularVacancies} titular(es) · {suplenteVacancies} suplente(s)
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {ranking.map((r, i) => {
                    const c = r.candidate;
                    const seatChip =
                      r.seat === "titular"
                        ? "bg-primary-100 text-primary-700"
                        : r.seat === "suplente"
                          ? "bg-secondary-100 text-secondary-800"
                          : "bg-background-200 text-foreground-500";
                    return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-600"}`}>
                            {i + 1}
                          </span>
                          {c.photoUrl ? (
                            <img
                              src={c.photoUrl}
                              alt={`Foto de ${c.name}`}
                              className="h-7 w-7 shrink-0 rounded-full border border-background-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-200 text-[10px] font-bold text-foreground-500">
                              {c.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="truncate font-medium text-foreground-900">{c.name}</span>
                          {hasVacancies && c.votes > 0 && (
                            <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:inline ${seatChip}`}>
                              {r.seat === "titular" ? "Titular" : "Suplente"}
                            </span>
                          )}
                          <span className="hidden truncate text-xs text-foreground-400 sm:inline">{c.roleFunction}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-foreground-950">{c.votes}</strong>
                          <button
                            type="button"
                            onClick={() => openRegistration(e, c)}
                            disabled={finalized}
                            title="Editar ficha de inscrição"
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-background-200 text-foreground-600 transition-colors hover:bg-secondary-500 hover:text-background-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <i className="ri-edit-line text-sm"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => addVote(e, c.id)}
                            disabled={finalized}
                            title="Registrar 1 voto"
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-100 text-primary-700 transition-colors hover:bg-primary-500 hover:text-background-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <i className="ri-add-line text-sm"></i>
                          </button>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background-200">
                        <div className="h-full rounded-full bg-secondary-500" style={{ width: `${total ? (c.votes / total) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="mt-4 rounded-lg border border-background-200 bg-background-100/60 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <i className="ri-attachment-2 text-sm text-primary-700"></i>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                      Anexos externos ({attachments.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {attachments.map((doc) =>
                      doc.previewDataUrl ? (
                        <button
                          key={doc.id}
                          type="button"
                          aria-label={`Ampliar ${doc.name}`}
                          title={doc.name}
                          onClick={() => setLightbox(doc)}
                          className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-50"
                        >
                          <img src={doc.previewDataUrl} alt={doc.name} className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-foreground-950/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <i className="ri-zoom-in-line text-sm text-background-50"></i>
                          </span>
                        </button>
                      ) : (
                        <span
                          key={doc.id}
                          title={doc.name}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-background-200 bg-background-50 text-foreground-500"
                        >
                          <i className={`${fileIcon[doc.fileType]} text-lg`}></i>
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-background-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setProcessTargetId(e.id);
                    setProcessOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-100 px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-500 hover:text-background-50"
                >
                  <i className="ri-route-line text-base"></i>
                  Processo eleitoral
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBaseTargetId(e.id);
                    setBaseOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-100 px-3 py-2 text-xs font-semibold text-secondary-800 transition-colors hover:bg-secondary-500 hover:text-background-50"
                >
                  <i className="ri-group-line text-base"></i>
                  Base eleitoral
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVotingTargetId(e.id);
                    setVotingOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-100 px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-500 hover:text-background-50"
                >
                  <i className="ri-checkbox-multiple-line text-base"></i>
                  Urna / Votação
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposeTargetId(e.id);
                    setComposeOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-100 px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-500 hover:text-background-50"
                >
                  <i className="ri-user-star-line text-base"></i>
                  Compor CIPA
                </button>
                <button
                  type="button"
                  onClick={() => generateEdital(e)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-megaphone-line text-base"></i>
                  Edital (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => generateResult(e)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-award-line text-base"></i>
                  Edital de Resultado
                </button>
                <button
                  type="button"
                  onClick={() => generatePosse(e)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-user-star-line text-base"></i>
                  Termo de Posse
                </button>
                <button
                  type="button"
                  onClick={() => openDossier(e)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-folder-shield-2-line text-base"></i>
                  Dossiê (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => exportResult(e)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-file-pdf-2-line text-base"></i>
                  Apuração (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(e);
                    setFormOpen(true);
                  }}
                  disabled={finalized}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ri-edit-line text-base"></i>
                  Editar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-checkbox-multiple-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum processo eleitoral</p>
          <p className="text-xs text-foreground-500">Crie a eleição da CIPA para o próximo mandato.</p>
        </div>
      )}
        </>
      )}

      <VoterRollModal
        open={baseOpen}
        onClose={() => setBaseOpen(false)}
        election={baseTarget}
        cipaName={cipas.find((c) => c.id === baseTarget?.cipaId)?.name || "—"}
        cipa={cipas.find((c) => c.id === baseTarget?.cipaId)}
        companyRef={session.subdomain}
      />
      <ElectionProcessModal
        open={processOpen}
        onClose={() => setProcessOpen(false)}
        election={processTarget}
        cipaName={cipas.find((c) => c.id === processTarget?.cipaId)?.name || "—"}
        cipa={cipas.find((c) => c.id === processTarget?.cipaId)}
        companyRef={session.subdomain}
      />
      <ElectionFormModal open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} cipas={cipas} editing={editing} />
      {lightbox && lightbox.previewDataUrl && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-foreground-950/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div
            className="flex max-h-[80vh] max-w-[90vw] flex-col overflow-hidden rounded-lg border border-background-200 bg-background-50"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-background-200 px-4 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground-800">{lightbox.name}</span>
              <button
                type="button"
                aria-label="Fechar pré-visualização"
                onClick={() => setLightbox(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <img src={lightbox.previewDataUrl} alt={lightbox.name} className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
      <ElectionVotingModal
        open={votingOpen}
        onClose={() => setVotingOpen(false)}
        election={votingTarget}
        cipa={cipas.find((c) => c.id === votingTarget?.cipaId)}
        cipaName={cipas.find((c) => c.id === votingTarget?.cipaId)?.name || "—"}
        companyRef={session.subdomain}
        onCompose={() => {
          setComposeTargetId(votingTargetId);
          setComposeOpen(true);
        }}
      />
      <ElectionCompositionModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        election={composeTarget}
        cipa={cipas.find((c) => c.id === composeTarget?.cipaId)}
        cipaName={cipas.find((c) => c.id === composeTarget?.cipaId)?.name || "—"}
        companyRef={session.subdomain}
      />
      <DossierModal
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        electionTitle={dossierTarget?.title || ""}
        cipaName={cipas.find((c) => c.id === dossierTarget?.cipaId)?.name || "—"}
        ata={dossierTarget ? electionCommitteeAta(dossierTarget, atas) : undefined}
        ataApproved={(() => {
          const ata = dossierTarget ? electionCommitteeAta(dossierTarget, atas) : undefined;
          return ata ? isAtaFullyApproved(ata) : false;
        })()}
        initialParts={dossierDoc?.dossierParts}
        initialAttachments={dossierDoc?.dossierAttachments}
        onConfirm={async (parts, attachments) => {
          if (dossierTarget) await generateDossier(dossierTarget, parts, attachments);
          setDossierOpen(false);
        }}
      />
      <CandidateRegistrationModal
        open={regOpen}
        onClose={() => setRegOpen(false)}
        onSave={saveCandidate}
        election={regTarget}
        elections={elections}
        cipaName={cipas.find((c) => c.id === regTarget?.cipaId)?.name || "—"}
        editing={regEditing}
      />
      {gate.modal}
    </div>
  );
}