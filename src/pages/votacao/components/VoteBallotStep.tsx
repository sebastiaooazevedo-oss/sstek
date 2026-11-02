import { useState } from "react";
import type { BallotInfo } from "@/pages/votacao/voteApi";

interface VoteBallotStepProps {
  ballot: BallotInfo;
  voterName: string;
  onVote: (choiceRef: string) => Promise<{ ok: boolean; message?: string }>;
}

const BLANK = "__BRANCO__";

/** Tela de votação: escolha do candidato, confirmação e os botões Branco/Corrigir/Votar. */
export default function VoteBallotStep({ ballot, voterName, onVote }: VoteBallotStepProps) {
  const [chosen, setChosen] = useState("");
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");

  const chosenCandidate = ballot.candidates.find((c) => c.ref === chosen);
  const hasChoice = chosen !== "";

  const confirmLabel = chosen === BLANK ? "VOTO EM BRANCO" : chosenCandidate?.name || "";

  const handleVote = async () => {
    if (!hasChoice) return;
    setError("");
    setVoting(true);
    const result = await onVote(chosen === BLANK ? "" : chosen);
    setVoting(false);
    if (!result.ok) setError(result.message || "Não foi possível registrar seu voto. Tente novamente.");
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
          <i className="ri-user-line"></i>
          Eleitor habilitado{voterName ? `: ${voterName}` : ""}
        </span>
        <h1 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">Escolha o seu candidato</h1>
        <p className="mt-1.5 text-sm text-foreground-600">
          Selecione um candidato (ou vote em branco) e confirme. Seu voto é <strong>secreto</strong> — ninguém saberá em quem você votou.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ballot.candidates.map((c) => {
          const active = chosen === c.ref;
          return (
            <button
              key={c.ref}
              type="button"
              onClick={() => setChosen(c.ref)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                active ? "border-primary-500 bg-primary-50" : "border-background-200 bg-background-50 hover:border-primary-300 hover:bg-background-100"
              }`}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-background-200 bg-background-100">
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt={`Foto de ${c.name}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base font-bold text-foreground-500">{c.name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground-950">{c.name}</span>
                <span className="block truncate text-[11px] text-foreground-500">
                  {c.roleFunction || "—"}
                  {c.area ? ` · ${c.area}` : ""}
                </span>
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300"
                }`}
              >
                {active && <i className="ri-check-line text-sm"></i>}
              </span>
            </button>
          );
        })}
        {ballot.candidates.length === 0 && (
          <p className="rounded-lg border border-dashed border-background-300 bg-background-50 px-4 py-6 text-center text-xs text-foreground-500 sm:col-span-2">
            Nenhum candidato cadastrado nesta eleição. Você pode registrar o voto em branco.
          </p>
        )}
      </div>

      {/* Painel de confirmação (expande ao escolher) */}
      {hasChoice && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-primary-800">
            <i className="ri-question-line"></i>
            Confirma o seu voto?
          </p>
          <p className="mt-1.5 text-lg font-extrabold tracking-tight text-foreground-950">{confirmLabel}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-primary-700/90">
            Esta ação é definitiva e não poderá ser desfeita. O registro é anônimo e não associa o seu nome à escolha.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent-800">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-background-200 bg-background-50 p-4">
        <button
          type="button"
          onClick={() => setChosen(BLANK)}
          className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
            chosen === BLANK ? "bg-secondary-500 text-background-50" : "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
          }`}
        >
          <i className="ri-checkbox-blank-circle-line"></i>
          Branco
        </button>
        <button
          type="button"
          onClick={() => setChosen("")}
          disabled={!hasChoice}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <i className="ri-arrow-go-back-line"></i>
          Corrigir
        </button>
        <button
          type="button"
          onClick={handleVote}
          disabled={!hasChoice || voting}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className={voting ? "ri-loader-4-line animate-spin" : "ri-check-double-line"}></i>
          {voting ? "Registrando…" : "Votar"}
        </button>
      </div>
    </div>
  );
}