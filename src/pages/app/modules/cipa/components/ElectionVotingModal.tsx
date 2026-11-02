import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import type { Cipa, CipaElection } from "@/mocks/cipa";
import { configOf, isElectionFinalized, useElectionVoting } from "@/pages/app/modules/cipa/electionVotingStore";
import BallotUrnaPanel from "@/pages/app/modules/cipa/components/BallotUrnaPanel";
import BallotResultPanel from "@/pages/app/modules/cipa/components/BallotResultPanel";
import MandateIndicationsPanel from "@/pages/app/modules/cipa/components/MandateIndicationsPanel";
import FinalizationPanel from "@/pages/app/modules/cipa/components/FinalizationPanel";
import PleitoDocumentsPanel from "@/pages/app/modules/cipa/components/PleitoDocumentsPanel";

interface ElectionVotingModalProps {
  open: boolean;
  onClose: () => void;
  election: CipaElection | null;
  cipa?: Cipa;
  cipaName: string;
  companyRef: string;
  onCompose?: () => void;
}

type VoteTab = "urna" | "resultado" | "indicacoes" | "encerramento" | "documentos";

const tabs: { id: VoteTab; label: string; icon: string }[] = [
  { id: "urna", label: "Urna", icon: "ri-checkbox-multiple-line" },
  { id: "resultado", label: "Resultado (BU)", icon: "ri-file-list-3-line" },
  { id: "indicacoes", label: "Indicações da empresa", icon: "ri-user-star-line" },
  { id: "encerramento", label: "Encerramento", icon: "ri-lock-2-line" },
  { id: "documentos", label: "Documentos do pleito", icon: "ri-folder-shield-2-line" },
];

/**
 * Painel do processo eleitoral da CIPA (urna eletrônica): reúne a urna, a
 * apuração com o Boletim de Urna, as indicações da empresa, o encerramento
 * (aceite final) e todos os documentos do pleito.
 */
export default function ElectionVotingModal({ open, onClose, election, cipa, cipaName, companyRef, onCompose }: ElectionVotingModalProps) {
  const store = useElectionVoting(companyRef);
  const [tab, setTab] = useState<VoteTab>("urna");

  const electionId = election?.id || "";
  const config = useMemo(() => configOf(store, electionId), [store, electionId]);
  const finalized = useMemo(() => isElectionFinalized(store, electionId), [store, electionId]);

  if (!open || !election) return null;

  const status = config?.status ?? "rascunho";
  const statusLabel = finalized ? "Encerrado" : status === "aberta" ? "Votação aberta" : status === "encerrada" ? "Apurado" : "Rascunho";
  const statusTone = finalized || status === "encerrada" ? "bg-primary-100 text-primary-700" : status === "aberta" ? "bg-accent-100 text-accent-800" : "bg-background-200 text-foreground-600";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Processo eleitoral da CIPA"
      subtitle={`${election.title} · ${cipaName}`}
      icon="ri-checkbox-multiple-line"
      size="xl"
      footer={
        <>
          {status === "encerrada" && onCompose && !finalized && (
            <button
              type="button"
              onClick={onCompose}
              className="mr-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-secondary-600"
            >
              <i className="ri-user-star-line text-base"></i>
              Compor a CIPA (novo mandato)
            </button>
          )}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {store.error && (
          <div className="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-error-warning-line"></i>
            {store.error}
          </div>
        )}

        {/* Abas */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 rounded-full border border-background-200 bg-background-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.id ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-50"
                }`}
              >
                <i className={`${t.icon} text-base`}></i>
                {t.label}
              </button>
            ))}
          </div>
          <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${statusTone}`}>
            <i className={finalized ? "ri-lock-2-line" : status === "aberta" ? "ri-live-line" : "ri-timer-line"}></i>
            {statusLabel}
          </span>
        </div>

        {tab === "urna" && <BallotUrnaPanel election={election} cipa={cipa} cipaName={cipaName} companyRef={companyRef} store={store} finalized={finalized} />}
        {tab === "resultado" && <BallotResultPanel election={election} cipaName={cipaName} companyRef={companyRef} store={store} finalized={finalized} />}
        {tab === "indicacoes" && <MandateIndicationsPanel election={election} cipa={cipa} cipaName={cipaName} companyRef={companyRef} store={store} finalized={finalized} />}
        {tab === "encerramento" && <FinalizationPanel election={election} cipaName={cipaName} companyRef={companyRef} store={store} finalized={finalized} />}
        {tab === "documentos" && <PleitoDocumentsPanel election={election} cipa={cipa} cipaName={cipaName} companyRef={companyRef} store={store} finalized={finalized} />}
      </div>
    </Modal>
  );
}