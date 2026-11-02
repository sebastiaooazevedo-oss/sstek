import { supabase } from "@/lib/supabase";

/**
 * Cliente da urna eletrônica (página pública de votação).
 *
 * Toda a lógica sensível (identificação por CPF, aceite do termo e registro do
 * voto) roda na edge function `cipa-vote`, que usa a service role. O cliente
 * aqui é apenas a interface pública.
 */

export interface BallotCandidateInfo {
  ref: string;
  name: string;
  roleFunction: string;
  area: string;
  photoUrl: string;
}

export interface BallotInfo {
  title: string;
  cipaName: string;
  establishment: string;
  startAt: string | null;
  endAt: string | null;
  termVersion: string;
  termContent: string;
  candidates: BallotCandidateInfo[];
}

export type WindowState = "rascunho" | "em-breve" | "aberta" | "encerrada";

export interface VoteConfirmation {
  electionTitle: string;
  cipaName: string;
  establishment: string;
  endAtLabel: string;
  protocol: string;
  voterName: string;
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("cipa-vote", { body });
  if (error) throw error;
  return (data as Record<string, unknown>) ?? {};
}

export async function getBallot(token: string): Promise<{ ok: boolean; windowState?: WindowState; ballot?: BallotInfo }> {
  return (await call({ action: "get_ballot", token })) as { ok: boolean; windowState?: WindowState; ballot?: BallotInfo };
}

export async function identifyVoter(token: string, cpf: string): Promise<Record<string, unknown>> {
  return call({ action: "identify", token, cpf });
}

export async function acceptTerm(token: string, cpf: string, termVersion: string): Promise<Record<string, unknown>> {
  return call({ action: "accept_term", token, cpf, termVersion });
}

export async function castVote(token: string, cpf: string, choiceRef: string): Promise<Record<string, unknown>> {
  return call({ action: "cast_vote", token, cpf, choiceRef });
}