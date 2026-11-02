import type { BallotInfo, VoteConfirmation } from "@/pages/votacao/voteApi";

type OutcomeVariant = "success" | "already" | "closed" | "notfound" | "error";

interface VoteOutcomeProps {
  variant: OutcomeVariant;
  ballot?: BallotInfo | null;
  confirmation?: VoteConfirmation | null;
  message?: string;
}

const config: Record<OutcomeVariant, { icon: string; tone: string; title: string; text: string }> = {
  success: { icon: "ri-checkbox-circle-line", tone: "bg-primary-100 text-primary-700", title: "Voto registrado com sucesso!", text: "" },
  already: {
    icon: "ri-shield-check-line",
    tone: "bg-secondary-100 text-secondary-800",
    title: "Você já votou nesta eleição",
    text: "O sistema registra apenas um voto por CPF. Se você acredita que houve um erro, procure a comissão eleitoral.",
  },
  closed: {
    icon: "ri-lock-2-line",
    tone: "bg-accent-100 text-accent-800",
    title: "Votação encerrada",
    text: "O período de votação desta eleição foi encerrado e não são mais aceitos votos.",
  },
  notfound: {
    icon: "ri-error-warning-line",
    tone: "bg-accent-100 text-accent-800",
    title: "Votação não encontrada",
    text: "Este link de votação não corresponde a nenhuma urna ativa. Confira o endereço recebido por e-mail.",
  },
  error: {
    icon: "ri-wifi-off-line",
    tone: "bg-background-200 text-foreground-600",
    title: "Não foi possível abrir a urna",
    text: "Houve uma falha de conexão. Verifique sua internet e atualize a página para tentar novamente.",
  },
};

/** Telas finais da urna: sucesso, já votou, votação encerrada, não encontrada e erro. */
export default function VoteOutcome({ variant, ballot, confirmation, message }: VoteOutcomeProps) {
  const meta = config[variant];
  const info = confirmation;

  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-background-200 bg-background-50 px-6 py-10 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-full ${meta.tone}`}>
        <i className={`${meta.icon} text-3xl`}></i>
      </span>
      <div>
        <h1 className="font-heading text-xl font-extrabold tracking-tight text-foreground-950">{meta.title}</h1>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-foreground-600">{message || meta.text}</p>
      </div>

      {variant === "success" && info && (
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-100/60 p-5 text-left">
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Elei&ccedil;&atilde;o" value={info.electionTitle} />
            <Row label="Comiss&atilde;o / local" value={`${info.cipaName}${info.establishment ? ` · ${info.establishment}` : ""}`} />
            <Row label="Encerramento da vota&ccedil;&atilde;o" value={info.endAtLabel} />
            <Row label="Protocolo do voto" value={info.protocol} mono />
          </dl>
          <p className="mt-4 flex items-start gap-1.5 rounded-md bg-background-50 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-500">
            <i className="ri-mail-check-line mt-0.5"></i>
            Enviaremos um e-mail de confirmação informando que o e-mail correspondente ao seu CPF realizou o voto. Por sigilo, ele não informa em quem você votou.
          </p>
        </div>
      )}

      {variant === "closed" && ballot && (
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-4 text-left text-sm text-foreground-700">
          <p className="font-semibold text-foreground-900">{ballot.title}</p>
          {ballot.cipaName && <p className="mt-0.5 text-xs text-foreground-500">{ballot.cipaName}{ballot.establishment ? ` · ${ballot.establishment}` : ""}</p>}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-foreground-500">{label}</dt>
      <dd className={`text-right font-semibold text-foreground-900 ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</dd>
    </div>
  );
}