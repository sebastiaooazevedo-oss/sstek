import { useMemo } from "react";
import type { CipaElection } from "@/mocks/cipa";
import { buildBuData } from "@/pages/app/modules/cipa/ballotResult";
import { buildBuPdfBody, buildAttendanceReportPdfBody, buildResultFinalAtaPdfBody } from "@/pages/app/modules/cipa/ballotPdf";
import { configOf, type StoreState } from "@/pages/app/modules/cipa/electionVotingStore";
import { electionSeatLabel } from "@/pages/app/modules/cipa/cipaUtils";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  addDocument,
  buildAttendanceReportDocument,
  buildBuDocument,
  buildResultFinalAtaDocument,
} from "@/pages/app/modules/documentos/documentsStore";
import { printHtml } from "@/pages/app/utils/exportPdf";

interface BallotResultPanelProps {
  election: CipaElection;
  cipaName: string;
  companyRef: string;
  store: StoreState;
  finalized: boolean;
}

/**
 * Resultado do pleito: exibe a apuração completa (eleitos, não eleitos, votos,
 * habilitados, votantes e ausentes) e emite o Boletim de Urna (BU), a Ata de
 * Resultado Final e o Relatório de comparecimento.
 */
export default function BallotResultPanel({ election, cipaName, store, finalized }: BallotResultPanelProps) {
  const collaborators = useCollaboratorsList();
  const bu = useMemo(() => buildBuData(store, election), [store, election]);
  const status = configOf(store, election.id)?.status ?? "rascunho";

  const nameByRef = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [collaborators]);

  const absentees = useMemo(
    () =>
      store.participations
        .filter((p) => p.electionRef === election.id && !p.hasVoted)
        .map((p) => nameByRef.get(p.collaboratorRef) || p.collaboratorRef)
        .sort((a, b) => a.localeCompare(b)),
    [store.participations, election.id, nameByRef]
  );

  const closed = status === "encerrada";

  const exportBu = () => {
    const doc = buildBuDocument(election, cipaName, bu);
    if (!finalized) addDocument(doc);
    printHtml(`Boletim de Urna — ${election.title}`, buildBuPdfBody(election, cipaName, bu));
  };

  const exportAtaFinal = () => {
    const doc = buildResultFinalAtaDocument(election, cipaName, bu);
    if (!finalized) addDocument(doc);
    printHtml(`Ata de Resultado Final — ${election.title}`, buildResultFinalAtaPdfBody(election, cipaName, bu));
  };

  const exportComparecimento = () => {
    const doc = buildAttendanceReportDocument(election, cipaName, bu, absentees);
    if (!finalized) addDocument(doc);
    printHtml(`Relatório de comparecimento — ${election.title}`, buildAttendanceReportPdfBody(election, cipaName, bu, absentees));
  };

  if (!closed && !finalized) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
          <i className="ri-lock-2-line text-2xl"></i>
        </span>
        <p className="text-sm font-semibold text-foreground-800">Resultado disponível após encerrar a votação</p>
        <p className="max-w-md text-xs text-foreground-500">
          Por garantia do sigilo, a apuração só é exibida depois que a urna é encerrada. Encerre a votação na aba
          <strong> Urna</strong> para apurar o resultado.
        </p>
      </div>
    );
  }

  const elected = bu.ranking.filter((r) => r.seat === "titular" || r.seat === "suplente");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Habilitados" value={String(bu.eligible)} tone="default" />
        <Kpi label="Votaram" value={String(bu.voted)} tone="primary" />
        <Kpi label="Brancos" value={String(bu.blank)} tone="default" />
        <Kpi label="Ausentes" value={String(bu.absent)} tone="accent" />
      </div>
      <p className="-mt-2 text-[11px] text-foreground-400">
        <i className="ri-information-line mr-1"></i>
        Apuração <strong>confidencial</strong>: exibimos apenas contagens. O voto é secreto e nunca revela quem votou em quem.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={exportBu} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600">
          <i className="ri-file-list-3-line text-base"></i> Boletim de Urna (BU)
        </button>
        <button type="button" onClick={exportAtaFinal} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100">
          <i className="ri-draft-line text-base"></i> Ata de Resultado Final
        </button>
        <button type="button" onClick={exportComparecimento} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100">
          <i className="ri-user-forbid-line text-base"></i> Relatório de comparecimento
        </button>
      </div>

      {/* Eleitos */}
      <section className="rounded-lg border border-primary-200 bg-primary-50/70 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-award-line text-base text-primary-700"></i>
          Eleitos ({elected.length})
        </h3>
        {elected.length === 0 && <p className="mt-2 text-xs text-foreground-500">Nenhum candidato eleito registrado.</p>}
        <div className="mt-3 flex flex-col gap-2">
          {elected.map((r) => (
            <div key={`${r.name}-${r.position}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-bold text-background-50">{r.position}</span>
                <span className="min-w-0 truncate text-sm font-medium text-foreground-900">{r.name}</span>
                <span className="hidden truncate text-xs text-foreground-400 sm:inline">{r.roleFunction}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${r.seat === "titular" ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-800"}`}>
                  {r.seat === "titular" ? "Titular" : "Suplente"}
                </span>
                <strong className="text-sm font-bold text-foreground-950">{r.votes}</strong>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Resultado completo */}
      <section className="border-t border-background-200 pt-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-bar-chart-2-line text-base text-primary-700"></i>
          Resultado completo da apuração
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          {bu.ranking.length === 0 && <p className="text-xs text-foreground-500">Nenhuma cédula registrada.</p>}
          {bu.ranking.map((r) => (
            <div key={`${r.name}-${r.position}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground-800">
                <strong className="mr-1.5 font-semibold text-foreground-500">{r.position}º</strong>
                {r.name}
                <span className="ml-2 text-xs text-foreground-400">{r.roleFunction}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={`text-[11px] font-semibold ${r.seat === "nao-eleito" ? "text-foreground-400" : "text-primary-700"}`}>{electionSeatLabel(r.seat)}</span>
                <strong className="text-sm font-bold text-foreground-950">{r.votes}</strong>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-md border border-background-200 bg-background-100 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-foreground-700">Votos em branco</span>
            <strong className="text-sm font-bold text-foreground-950">{bu.blank}</strong>
          </div>
          <div className="flex items-center justify-between rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-primary-700">Total de votos válidos</span>
            <strong className="text-sm font-bold text-primary-700">{bu.total}</strong>
          </div>
        </div>
        {bu.integrityHash && (
          <p className="mt-3 break-all rounded-md bg-background-100 px-2.5 py-1.5 text-[10px] text-foreground-500" title="Hash de integridade da urna (SHA-256)">
            <i className="ri-fingerprint-line mr-1"></i>
            {bu.integrityHash}
          </p>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "default" | "primary" | "accent" }) {
  const toneClass = tone === "primary" ? "bg-primary-100 text-primary-700" : tone === "accent" ? "bg-accent-100 text-accent-800" : "bg-background-100 text-foreground-900";
  return (
    <div className={`rounded-md px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}