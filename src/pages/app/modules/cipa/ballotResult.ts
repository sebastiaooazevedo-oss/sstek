import type { CipaElection } from "@/mocks/cipa";
import { electionWindowLabel, type ElectionSeat } from "@/pages/app/modules/cipa/cipaUtils";
import {
  candidatesOf,
  configOf,
  participationSummary,
  tallyBallots,
  type StoreState,
} from "@/pages/app/modules/cipa/electionVotingStore";

/**
 * Apuração formal da urna (Boletim de Urna).
 *
 * Monta o resultado completo do pleito — votos por candidato, eleitos e não
 * eleitos, habilitados, votantes, ausentes e brancos — a partir das cédulas
 * ANÔNIMAS e do controle de participação. Nunca relaciona eleitor a voto.
 */

export interface BuRank {
  name: string;
  roleFunction: string;
  area: string;
  votes: number;
  position: number;
  seat: ElectionSeat;
}

export interface BuData {
  eligible: number;
  voted: number;
  absent: number;
  blank: number;
  total: number;
  ranking: BuRank[];
  windowLabel: string;
  openedAt: string | null;
  closedAt: string | null;
  integrityHash: string;
}

function seatFor(index: number, votes: number, titular: number, suplente: number, configured: boolean): ElectionSeat {
  if (votes <= 0) return "nao-eleito";
  if (!configured || index < titular) return "titular";
  if (index < titular + suplente) return "suplente";
  return "nao-eleito";
}

/** Constrói o Boletim de Urna (apuração completa) de uma eleição. */
export function buildBuData(store: StoreState, election: CipaElection): BuData {
  const cfg = configOf(store, election.id);
  const tally = tallyBallots(store, election.id);
  const part = participationSummary(store, election.id);
  const cands = candidatesOf(store, election.id);

  const titular = Math.max(0, Number(election.titularVacancies) || 0);
  const suplente = Math.max(0, Number(election.suplenteVacancies) || 0);
  const configured = titular > 0 || suplente > 0;

  let ranking: BuRank[];
  if (cands.length) {
    ranking = cands
      .map((c) => ({ name: c.name, roleFunction: c.roleFunction, area: c.area, votes: tally.perCandidate[c.candidateRef] ?? 0 }))
      .sort((a, b) => b.votes - a.votes)
      .map((c, i) => ({ ...c, position: i + 1, seat: seatFor(i, c.votes, titular, suplente, configured) }));
  } else {
    ranking = election.candidates
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name, roleFunction: c.roleFunction, area: c.area, votes: Number(c.votes) || 0 }))
      .sort((a, b) => b.votes - a.votes)
      .map((c, i) => ({ ...c, position: i + 1, seat: seatFor(i, c.votes, titular, suplente, configured) }));
  }

  const total = tally.total || ranking.reduce((sum, r) => sum + r.votes, 0);
  const eligible = part.eligible || Number(election.eligibleVoters) || 0;
  const voted = part.voted || total;
  const absent = Math.max(0, eligible - voted);

  return {
    eligible,
    voted,
    absent,
    blank: tally.blank,
    total,
    ranking,
    windowLabel: electionWindowLabel(election),
    openedAt: cfg?.openedAt ?? null,
    closedAt: cfg?.closedAt ?? null,
    integrityHash: cfg?.integrityHash ?? "",
  };
}

/** Snapshot serializável do BU para gravação no encerramento do processo. */
export function buSnapshot(election: CipaElection, cipaName: string, bu: BuData): Record<string, unknown> {
  return {
    electionId: election.id,
    title: election.title,
    processNumber: election.processNumber,
    cipaName,
    windowLabel: bu.windowLabel,
    openedAt: bu.openedAt,
    closedAt: bu.closedAt,
    integrityHash: bu.integrityHash,
    eligible: bu.eligible,
    voted: bu.voted,
    absent: bu.absent,
    blank: bu.blank,
    total: bu.total,
    ranking: bu.ranking.map((r) => ({ ...r })),
    capturedAt: new Date().toISOString(),
  };
}