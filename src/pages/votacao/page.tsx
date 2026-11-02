import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VoteLayout from "@/pages/votacao/components/VoteLayout";
import VoteIdentifyStep from "@/pages/votacao/components/VoteIdentifyStep";
import VoteBallotStep from "@/pages/votacao/components/VoteBallotStep";
import VoteOutcome from "@/pages/votacao/components/VoteOutcome";
import { castVote, getBallot, type BallotInfo, type VoteConfirmation } from "@/pages/votacao/voteApi";

type Step = "loading" | "notfound" | "closed" | "identify" | "ballot" | "success" | "already" | "error";

/**
 * Página pública da urna eletrônica da CIPA.
 *
 * Fluxo: identificação por CPF + aceite do termo → tela de votação (escolha e
 * confirmação) → comprovante. Toda a validação roda no servidor (edge function
 * `cipa-vote`), garantindo um voto por CPF e o sigilo da cédula.
 */
export default function VotacaoPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("loading");
  const [ballot, setBallot] = useState<BallotInfo | null>(null);
  const [cpf, setCpf] = useState("");
  const [voterName, setVoterName] = useState("");
  const [confirmation, setConfirmation] = useState<VoteConfirmation | null>(null);

  const load = useCallback(async () => {
    setStep("loading");
    try {
      const data = await getBallot(token);
      if (!data.ok) return setStep("notfound");
      setBallot(data.ballot ?? null);
      setStep(data.windowState === "aberta" ? "identify" : "closed");
    } catch {
      setStep("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVote = async (choiceRef: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const data = await castVote(token, cpf, choiceRef);
      if (data.ok) {
        setConfirmation((data.confirmation as VoteConfirmation) ?? null);
        setStep("success");
        return { ok: true };
      }
      if (data.error === "ALREADY_VOTED") {
        setStep("already");
        return { ok: true };
      }
      if (data.error === "CLOSED") {
        setStep("closed");
        return { ok: true };
      }
      return { ok: false, message: "Não foi possível registrar seu voto. Tente novamente." };
    } catch {
      return { ok: false, message: "Falha de conexão ao registrar o voto. Verifique sua internet e tente novamente." };
    }
  };

  if (step === "loading") {
    return (
      <VoteLayout>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-primary-600"></i>
          <p className="text-sm text-foreground-600">Carregando a urna eletrônica…</p>
        </div>
      </VoteLayout>
    );
  }

  return (
    <VoteLayout>
      {step === "identify" && ballot && (
        <VoteIdentifyStep
          token={token}
          ballot={ballot}
          onIdentified={(value, name) => {
            setCpf(value);
            setVoterName(name);
            setStep("ballot");
          }}
          onAlreadyVoted={() => setStep("already")}
          onClosed={() => setStep("closed")}
        />
      )}
      {step === "ballot" && ballot && <VoteBallotStep ballot={ballot} voterName={voterName} onVote={handleVote} />}
      {step === "success" && <VoteOutcome variant="success" confirmation={confirmation} />}
      {step === "already" && <VoteOutcome variant="already" />}
      {step === "closed" && <VoteOutcome variant="closed" ballot={ballot} />}
      {step === "notfound" && <VoteOutcome variant="notfound" />}
      {step === "error" && <VoteOutcome variant="error" />}
    </VoteLayout>
  );
}