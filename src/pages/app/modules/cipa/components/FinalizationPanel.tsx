import { useMemo, useState } from "react";
import type { CipaElection } from "@/mocks/cipa";
import { buildBuData, buSnapshot } from "@/pages/app/modules/cipa/ballotResult";
import { configOf, finalizationOf, finalizeVoting, type StoreState } from "@/pages/app/modules/cipa/electionVotingStore";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  addDocument,
  buildAttendanceReportDocument,
  buildBuDocument,
  buildResultFinalAtaDocument,
} from "@/pages/app/modules/documentos/documentsStore";

interface FinalizationPanelProps {
  election: CipaElection;
  cipaName: string;
  companyRef: string;
  store: StoreState;
  finalized: boolean;
}

/**
 * Encerramento do processo eleitoral com o aceite final do administrador.
 * Gera os documentos finais (BU, Ata de Resultado Final e Relatório de
 * comparecimento) e, em seguida, trava o processo — urna, indicações e
 * documentos do pleito tornam-se invioláveis no banco.
 */
export default function FinalizationPanel({ election, cipaName, store, finalized }: FinalizationPanelProps) {
  const collaborators = useCollaboratorsList();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const status = configOf(store, election.id)?.status ?? "rascunho";
  const closed = status === "encerrada";
  const fin = finalizationOf(store, election.id);
  const isFinalized = finalized || Boolean(fin?.finalizedAt);

  const bu = useMemo(() => buildBuData(store, election), [store, election]);

  const absentees = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c) => map.set(c.id, c.name));
    return store.participations
      .filter((p) => p.electionRef === election.id && !p.hasVoted)
      .map((p) => map.get(p.collaboratorRef) || p.collaboratorRef)
      .sort((a, b) => a.localeCompare(b));
  }, [store.participations, election.id, collaborators]);

  const generateFinalDocuments = () => {
    addDocument(buildBuDocument(election, cipaName, bu));
    addDocument(buildResultFinalAtaDocument(election, cipaName, bu));
    addDocument(buildAttendanceReportDocument(election, cipaName, bu, absentees));
  };

  const handleFinalize = async () => {
    setBusy(true);
    generateFinalDocuments();
    await finalizeVoting(election.id, buSnapshot(election, cipaName, bu), "Administrador");
    setBusy(false);
    setConfirming(false);
    setDone(true);
  };

  if (isFinalized) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-lock-2-line text-lg"></i>
          </span>
          <div>
            <p className="text-sm font-bold text-foreground-950">Processo encerrado e inviolável</p>
            <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
              O aceite final foi registrado. A urna, as indicações e os documentos do pleito não podem mais ser
              alterados.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-background-100 px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Encerrado em</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">
              {fin?.finalizedAt ? new Date(fin.finalizedAt).toLocaleString("pt-BR") : "—"}
            </p>
          </div>
          <div className="rounded-md bg-background-100 px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Responsável pelo aceite</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{fin?.finalizedBy || "—"}</p>
          </div>
        </div>
        {fin?.finalHash && (
          <p className="break-all rounded-md bg-background-100 px-2.5 py-2 text-[10px] text-foreground-500" title="Hash de integridade do processo (SHA-256)">
            <i className="ri-fingerprint-line mr-1"></i>
            {fin.finalHash}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-background-200 bg-background-50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
          Checklist para o encerramento
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          <Check ok={closed} label="Votação encerrada (urna fechada e apurada)" />
          <Check ok={bu.ranking.length > 0} label="Cédulas registradas e apuração disponível" />
          <Check ok label={`Documentos finais gerados automaticamente ao concluir (BU, ata de resultado final e comparecimento)`} optional />
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs leading-relaxed text-accent-800">
        <i className="ri-alert-line mt-0.5"></i>
        <span>
          O aceite final é <strong>irreversível</strong>. Após concluir, o processo eleitoral e seus documentos ficam
          invioláveis (Blindado) e não podem mais ser editados — inclusive a composição e as indicações.
        </span>
      </div>

      {(done || busy) && (
        <p className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-700">
          <i className={busy ? "ri-loader-4-line animate-spin" : "ri-checkbox-circle-line"}></i>
          {busy ? "Encerrando o processo eleitoral…" : "Processo encerrado com sucesso. Documentos finais anexados ao pleito."}
        </p>
      )}

      {!closed ? (
        <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-5 text-center text-xs text-foreground-500">
          Encerre a votação na aba <strong>Urna</strong> para liberar o aceite final do processo.
        </p>
      ) : confirming ? (
        <div className="flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50/60 p-4">
          <p className="text-sm font-semibold text-foreground-900">
            Confirmar o encerramento definitivo do processo eleitoral?
          </p>
          <p className="text-xs leading-relaxed text-foreground-600">
            Serão gerados e anexados o Boletim de Urna, a Ata de Resultado Final e o Relatório de comparecimento. Depois
            disso, o processo fica inviolável.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFinalize}
              disabled={busy}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2 text-xs font-semibold text-background-50 hover:bg-accent-600 disabled:opacity-50"
            >
              <i className="ri-lock-2-line"></i> Confirmar aceite final
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-md border border-background-300 px-4 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-shield-check-line text-base"></i>
            Concluir e encerrar (aceite final)
          </button>
          <button
            type="button"
            onClick={generateFinalDocuments}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-file-list-3-line"></i> Gerar documentos finais (sem encerrar)
          </button>
        </div>
      )}
    </div>
  );
}

function Check({ ok, label, optional }: { ok: boolean; label: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-400"}`}>
        <i className={ok ? "ri-check-line" : "ri-subtract-line"}></i>
      </span>
      <span className={ok ? "text-foreground-800" : "text-foreground-500"}>{label}</span>
      {optional && <span className="text-[10px] uppercase tracking-wide text-foreground-400">(automático)</span>}
    </div>
  );
}