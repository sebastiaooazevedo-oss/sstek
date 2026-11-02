import { useEffect, useMemo, useState } from "react";
import { inputClass } from "@/pages/app/components/Modal";
import type { Cipa, CipaElection } from "@/mocks/cipa";
import {
  candidatesOf,
  closeVoting,
  configOf,
  openVoting,
  participationSummary,
  publishBallot,
  sendVotingInvites,
  tallyBallots,
  votingLink,
  type StoreState,
} from "@/pages/app/modules/cipa/electionVotingStore";
import { electionWindowLabel } from "@/pages/app/modules/cipa/cipaUtils";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

interface BallotUrnaPanelProps {
  election: CipaElection;
  cipa?: Cipa;
  cipaName: string;
  companyRef: string;
  store: StoreState;
  finalized: boolean;
}

type Feedback = { tone: "ok" | "warn"; text: string } | null;

/** Painel de controle da urna: publicar, abrir/encerrar, link e ausentes. */
export default function BallotUrnaPanel({ election, cipa, cipaName, store, finalized }: BallotUrnaPanelProps) {
  const collaborators = useCollaboratorsList();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const electionId = election.id;
  const config = useMemo(() => configOf(store, electionId), [store, electionId]);
  const candidates = useMemo(() => candidatesOf(store, electionId), [store, electionId]);
  const tally = useMemo(() => tallyBallots(store, electionId), [store, electionId]);
  const participation = useMemo(() => participationSummary(store, electionId), [store, electionId]);

  const nameByRef = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [collaborators]);

  const absentees = useMemo(() => {
    return store.participations
      .filter((p) => p.electionRef === electionId && !p.hasVoted)
      .map((p) => nameByRef.get(p.collaboratorRef) || p.collaboratorRef)
      .sort((a, b) => a.localeCompare(b));
  }, [store.participations, electionId, nameByRef]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const status = config?.status ?? "rascunho";
  const locked = finalized;

  const handlePublish = async () => {
    setBusy(true);
    await publishBallot(election, cipaName, cipa?.id ?? null);
    setBusy(false);
    setFeedback({ tone: "ok", text: "Urna publicada com candidatos, janela de votação e termo de votação." });
  };

  const handleOpen = async () => {
    setBusy(true);
    const afterPublish = await publishBallot(election, cipaName, cipa?.id ?? null);
    await openVoting(election.id, "Administrador");
    const token = configOf(afterPublish, election.id)?.publicToken;
    let inviteMsg = "Votação aberta. Copie e compartilhe o link com os colaboradores.";
    if (token) {
      const result = await sendVotingInvites(token);
      if (result.emailEnabled) {
        inviteMsg = `Votação aberta. ${result.sent} convite(s) enviado(s) por e-mail.`;
      } else {
        inviteMsg = "Votação aberta. O envio por e-mail ainda não está ativado — copie e compartilhe o link abaixo.";
      }
    }
    setBusy(false);
    setFeedback({ tone: "ok", text: inviteMsg });
  };

  const handleResend = async () => {
    if (!config) return;
    setBusy(true);
    const result = await sendVotingInvites(config.publicToken);
    setBusy(false);
    setFeedback(
      result.emailEnabled
        ? { tone: "ok", text: `${result.sent} convite(s) reenviado(s) por e-mail.` }
        : { tone: "warn", text: "O envio por e-mail ainda não está ativado (configure o Resend). Use o link para compartilhar." }
    );
  };

  const handleClose = async () => {
    setBusy(true);
    await closeVoting(election.id, "Administrador");
    setBusy(false);
    setFeedback({ tone: "ok", text: "Votação encerrada. Registrado o hash de integridade da urna." });
  };

  const copyLink = async () => {
    if (!config) return;
    try {
      await navigator.clipboard.writeText(votingLink(config.publicToken));
      setFeedback({ tone: "ok", text: "Link de votação copiado." });
    } catch {
      setFeedback({ tone: "warn", text: "Não foi possível copiar automaticamente. Selecione o link manualmente." });
    }
  };

  const windowLabel = electionWindowLabel(election);
  const link = config ? votingLink(config.publicToken) : "";

  const exportAbsentees = () => {
    const title = `Ausentes do pleito — ${election.title}`;
    const body = `${pdfHeader("CIPA · Relatório de comparecimento")}
      <h1>Relatório de comparecimento</h1>
      <p class="muted">${escapeHtml(election.title)} · ${escapeHtml(cipaName)} · ${escapeHtml(windowLabel)}</p>
      <div class="grid">
        <div><strong>Eleitores aptos:</strong> ${participation.eligible}</div>
        <div><strong>Votaram:</strong> ${participation.voted}</div>
        <div><strong>Não compareceram:</strong> ${participation.absent}</div>
      </div>
      <h2>Colaboradores que não compareceram</h2>
      ${absentees.length ? tableHtml(["#", "Colaborador"], absentees.map((name, i) => [String(i + 1), name])) : "<p>Nenhum ausente registrado.</p>"}
      <p class="muted">O voto é secreto: este relatório informa apenas comparecimento, sem qualquer vínculo com a escolha do eleitor.</p>
      ${pdfFooter()}`;
    printHtml(title, body);
  };

  const exportAbsenteesCsv = () => {
    downloadCsv(
      `ausentes-pleito-cipa-${election.id}.csv`,
      ["#", "Colaborador", "Compareceu"],
      absentees.map((name, i) => [String(i + 1), name, "Não"])
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCell label="Situação da urna" value={status === "aberta" ? "Aberta" : status === "encerrada" ? "Encerrada" : "Rascunho"} tone={status === "aberta" ? "accent" : status === "encerrada" ? "primary" : "default"} />
        <InfoCell label="Candidatos" value={String(candidates.length)} />
        <InfoCell label="Votos registrados" value={String(tally.total)} />
        <InfoCell label="Comparecimento" value={`${participation.voted}/${participation.eligible}`} />
      </div>
      <p className="-mt-2 text-[11px] text-foreground-400">
        <i className="ri-time-line mr-1"></i>
        Janela de votação: {windowLabel}
        {config?.openedAt && <> · aberta em {new Date(config.openedAt).toLocaleString("pt-BR")}</>}
        {config?.closedAt && <> · encerrada em {new Date(config.closedAt).toLocaleString("pt-BR")}</>}
      </p>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3.5 py-2.5 text-xs font-semibold ${
            feedback.tone === "ok" ? "border-primary-200 bg-primary-50 text-primary-700" : "border-accent-200 bg-accent-50 text-accent-800"
          }`}
        >
          <i className={feedback.tone === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
          {feedback.text}
        </div>
      )}

      {locked && (
        <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-700">
          <i className="ri-lock-2-line"></i>
          Processo encerrado e inviolável — a urna não aceita mais alterações.
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePublish}
          disabled={busy || locked}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-50"
        >
          <i className="ri-upload-2-line text-base"></i>
          Publicar / atualizar urna
        </button>
        {status !== "aberta" && status !== "encerrada" && (
          <button
            type="button"
            onClick={handleOpen}
            disabled={busy || locked}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            <i className="ri-play-circle-line text-base"></i>
            Abrir votação e enviar convites
          </button>
        )}
        {status === "aberta" && (
          <>
            <button
              type="button"
              onClick={handleResend}
              disabled={busy || locked}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-50"
            >
              <i className="ri-mail-send-line text-base"></i>
              Reenviar convites
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={busy || locked}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600 disabled:opacity-50"
            >
              <i className="ri-lock-2-line text-base"></i>
              Encerrar votação
            </button>
          </>
        )}
      </div>

      {/* Link público */}
      {config && (
        <div className="rounded-lg border border-background-200 bg-background-100/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground-400">Link público de votação</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input readOnly className={`${inputClass} flex-1 font-mono text-xs`} value={link} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600"
            >
              <i className="ri-file-copy-line"></i>
              Copiar
            </button>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-500">
            <i className="ri-shield-check-line mt-0.5"></i>
            O eleitor abre este link, identifica-se com o CPF, aceita o termo e vota. O voto é secreto e o sistema controla um voto por CPF.
          </p>
        </div>
      )}

      {/* Ausentes */}
      {config && (
        <section className="border-t border-background-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-user-forbid-line text-base text-accent-700"></i>
              Quem não compareceu ({absentees.length})
            </h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportAbsentees} disabled={!absentees.length} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-40">
                <i className="ri-file-pdf-2-line"></i> PDF
              </button>
              <button type="button" onClick={exportAbsenteesCsv} disabled={!absentees.length} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-40">
                <i className="ri-file-excel-2-line"></i> CSV
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-foreground-500">
            Baseado no controle de participação da base eleitoral. Não expressa em quem cada um votou (o voto é secreto).
          </p>
          <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-background-200 bg-background-50">
            {absentees.length === 0 && <p className="px-4 py-5 text-center text-xs text-foreground-500">Nenhum ausente registrado (ou a base eleitoral ainda não foi fechada).</p>}
            {absentees.map((name) => (
              <div key={name} className="border-b border-background-100 px-4 py-2 text-sm text-foreground-800 last:border-b-0">{name}</div>
            ))}
          </div>
        </section>
      )}

      {!config && (
        <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-5 text-center text-xs text-foreground-500">
          Nenhuma urna publicada para esta eleição. Clique em <strong>Publicar / atualizar urna</strong> para preparar a votação.
        </p>
      )}
    </div>
  );
}

function InfoCell({ label, value, tone }: { label: string; value: string; tone?: "primary" | "accent" | "default" }) {
  const toneClass =
    tone === "primary" ? "bg-primary-100 text-primary-700" : tone === "accent" ? "bg-accent-100 text-accent-800" : "bg-background-100 text-foreground-900";
  return (
    <div className={`rounded-md px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold" title={value}>{value || "—"}</p>
    </div>
  );
}