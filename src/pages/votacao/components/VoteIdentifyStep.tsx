import { useState } from "react";
import { acceptTerm, identifyVoter, type BallotInfo } from "@/pages/votacao/voteApi";
import { voteTerm } from "@/pages/app/modules/cipa/voteTerms";

interface VoteIdentifyStepProps {
  token: string;
  ballot: BallotInfo;
  onIdentified: (cpf: string, name: string) => void;
  onAlreadyVoted: () => void;
  onClosed: () => void;
}

function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Identificação do eleitor: CPF + leitura e aceite do termo jurídico da votação. */
export default function VoteIdentifyStep({ token, ballot, onIdentified, onAlreadyVoted, onClosed }: VoteIdentifyStepProps) {
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const term = ballot.termContent?.trim() ? ballot.termContent : `${voteTerm.title}\n\n${voteTerm.intro}\n\n${voteTerm.paragraphs.join("\n\n")}`;

  const handleSubmit = async () => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return setError("Informe um CPF válido (11 dígitos).");
    if (!accepted) return setError("É necessário ler e aceitar o termo de votação para continuar.");
    setError("");
    setBusy(true);
    try {
      const data = await identifyVoter(token, digits);
      if (data.closed) return onClosed();
      if (!data.eligible) {
        setError(
          data.reason === "NOT_FOUND_CPF"
            ? "Não encontramos seu CPF na lista de eleitores desta eleição. Procure a comissão eleitoral."
            : "Seu cadastro não está apto a votar nesta eleição. Procure a comissão eleitoral."
        );
        return;
      }
      if (data.alreadyVoted) return onAlreadyVoted();
      if (!data.termAccepted) {
        const accept = await acceptTerm(token, digits, ballot.termVersion);
        if (!accept.ok) {
          setError("Não foi possível registrar o aceite do termo. Tente novamente.");
          return;
        }
      }
      onIdentified(digits, String(data.voterName || ""));
    } catch {
      setError("Não foi possível validar seus dados agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950">Identifique-se para votar</h1>
        <p className="mt-1.5 text-sm text-foreground-600">
          {ballot.title}
          {ballot.cipaName ? ` · ${ballot.cipaName}` : ""}
        </p>
      </div>

      <div className="rounded-lg border border-background-200 bg-background-50 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground-700">CPF do eleitor <span className="text-accent-600">*</span></span>
          <input
            value={cpf}
            inputMode="numeric"
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-primary-400"
          />
        </label>
      </div>

      <div className="rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-2 border-b border-background-200 px-5 py-3">
          <i className="ri-file-shield-2-line text-base text-primary-700"></i>
          <h2 className="text-sm font-bold text-foreground-950">{voteTerm.title}</h2>
        </div>
        <div className="max-h-64 overflow-y-auto whitespace-pre-line px-5 py-4 text-xs leading-relaxed text-foreground-700">
          {term}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 border-t border-background-200 px-5 py-4">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-background-300 text-primary-500"
          />
          <span className="text-xs font-medium leading-relaxed text-foreground-800">
            Li o termo, tenho ciência dos trâmites do processo eleitoral e concordo integralmente com ele. Declaro que meus dados (CPF) são verdadeiros e que o voto é secreto e pessoal.
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent-800">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <i className={busy ? "ri-loader-4-line animate-spin" : "ri-login-circle-line"}></i>
        {busy ? "Validando…" : "Acessar a votação"}
      </button>
    </div>
  );
}