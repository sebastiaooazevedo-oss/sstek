import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import type { CipaElection } from "@/mocks/cipa";
import { VOTE_TERM_VERSION, voteTerm } from "@/pages/app/modules/cipa/voteTerms";
import { electionWindowIso } from "@/pages/app/modules/cipa/cipaUtils";

/**
 * Store da urna eletrônica da CIPA (lado administrativo).
 *
 * Persiste a configuração da votação (janela, termo e token público), a lista
 * de candidatos da cédula, as cédulas anônimas (somente leitura — a escrita é
 * feita pela edge function `cipa-vote`) e o controle de participação (quem já
 * votou / quem não compareceu).
 *
 * SIGILO: as cédulas carregadas aqui NÃO têm vínculo com o eleitor. Apuramos
 * apenas contagens; nunca o par eleitor×candidato.
 */

export type BallotStatus = "rascunho" | "aberta" | "encerrada";

export interface BallotConfig {
  id: string;
  electionRef: string;
  cipaRef: string | null;
  cipaName: string;
  establishment: string;
  electionTitle: string;
  voteStartAt: string | null;
  voteEndAt: string | null;
  status: BallotStatus;
  publicToken: string;
  termVersion: string;
  termContent: string;
  openedAt: string | null;
  closedAt: string | null;
  integrityHash: string;
}

export interface BallotCandidate {
  id: string;
  electionRef: string;
  candidateRef: string;
  name: string;
  roleFunction: string;
  area: string;
  photoUrl: string;
  sortOrder: number;
}

export interface Ballot {
  id: string;
  electionRef: string;
  choiceRef: string | null;
  castAt: string;
}

export interface ParticipationLite {
  id: string;
  electionRef: string;
  collaboratorRef: string;
  hasVoted: boolean;
  votedAt: string | null;
}

/**
 * Indicação da empresa (representantes do empregador) para compor a CIPA do
 * novo mandato. Podem ser registradas a qualquer momento do processo (antes,
 * durante ou após a votação). Ao serem confirmadas, entram na composição da
 * comissão junto com os eleitos.
 */
export interface MandateIndication {
  id: string;
  electionRef: string;
  cipaRef: string | null;
  name: string;
  cpf: string;
  roleFunction: string;
  area: string;
  registration: string;
  memberRole: string;
  representation: string;
  confirmed: boolean;
  confirmedAt: string | null;
}

/** Encerramento (aceite final) do processo eleitoral e sua inviolabilidade. */
export interface FinalizationLite {
  electionRef: string;
  finalizedAt: string | null;
  finalizedBy: string | null;
  finalHash: string;
  buSnapshot: Record<string, unknown> | null;
}

export interface StoreState {
  configs: BallotConfig[];
  candidates: BallotCandidate[];
  ballots: Ballot[];
  participations: ParticipationLite[];
  indications: MandateIndication[];
  finalizations: FinalizationLite[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

let companyRef = "vega";
let state: StoreState = {
  configs: [],
  candidates: [],
  ballots: [],
  participations: [],
  indications: [],
  finalizations: [],
  loaded: false,
  loading: false,
  error: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  emit();
}

export function setBallotCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false };
  void loadBallotStore();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapConfig(r: Record<string, unknown>): BallotConfig {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    cipaRef: (r.cipa_ref as string) ?? null,
    cipaName: (r.cipa_name as string) ?? "",
    establishment: (r.establishment as string) ?? "",
    electionTitle: (r.election_title as string) ?? "",
    voteStartAt: (r.vote_start_at as string) ?? null,
    voteEndAt: (r.vote_end_at as string) ?? null,
    status: (r.status as BallotStatus) ?? "rascunho",
    publicToken: String(r.public_token),
    termVersion: (r.term_version as string) ?? VOTE_TERM_VERSION,
    termContent: (r.term_content as string) ?? "",
    openedAt: (r.opened_at as string) ?? null,
    closedAt: (r.closed_at as string) ?? null,
    integrityHash: (r.integrity_hash as string) ?? "",
  };
}

function mapCandidate(r: Record<string, unknown>): BallotCandidate {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    candidateRef: String(r.candidate_ref),
    name: (r.name as string) ?? "",
    roleFunction: (r.role_function as string) ?? "",
    area: (r.area as string) ?? "",
    photoUrl: (r.photo_url as string) ?? "",
    sortOrder: Number(r.sort_order) || 0,
  };
}

function mapBallot(r: Record<string, unknown>): Ballot {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    choiceRef: (r.choice_ref as string) ?? null,
    castAt: String(r.cast_at),
  };
}

function mapParticipation(r: Record<string, unknown>): ParticipationLite {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    collaboratorRef: (r.collaborator_ref as string) ?? "",
    hasVoted: Boolean(r.has_voted),
    votedAt: (r.voted_at as string) ?? null,
  };
}

function mapIndication(r: Record<string, unknown>): MandateIndication {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    cipaRef: (r.cipa_ref as string) ?? null,
    name: (r.name as string) ?? "",
    cpf: (r.cpf as string) ?? "",
    roleFunction: (r.role_function as string) ?? "",
    area: (r.area as string) ?? "",
    registration: (r.registration as string) ?? "",
    memberRole: (r.member_role as string) ?? "Titular",
    representation: (r.representation as string) ?? "Empregador",
    confirmed: Boolean(r.confirmed),
    confirmedAt: (r.confirmed_at as string) ?? null,
  };
}

function mapFinalization(r: Record<string, unknown>): FinalizationLite {
  return {
    electionRef: String(r.election_ref),
    finalizedAt: (r.finalized_at as string) ?? null,
    finalizedBy: (r.finalized_by as string) ?? null,
    finalHash: (r.final_hash as string) ?? "",
    buSnapshot: (r.bu_snapshot as Record<string, unknown>) ?? null,
  };
}

/* ------------------------------- Load ------------------------------- */

export async function loadBallotStore(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  try {
    const [configs, candidates, ballots, participation, indications, finalizations] = await Promise.all([
      supabase.from("cipa_ballot_config").select("*").eq("company_ref", companyRef),
      supabase.from("cipa_ballot_candidates").select("*").eq("company_ref", companyRef).order("sort_order"),
      supabase.from("cipa_ballots").select("id, election_ref, choice_ref, cast_at").eq("company_ref", companyRef),
      supabase.from("cipa_voter_participation").select("id, election_ref, collaborator_ref, has_voted, voted_at").eq("company_ref", companyRef),
      supabase.from("cipa_mandate_indications").select("*").eq("company_ref", companyRef).order("created_at"),
      supabase.from("cipa_elections").select("election_ref, finalized_at, finalized_by, final_hash, bu_snapshot").eq("company_ref", companyRef),
    ]);
    if (configs.error || candidates.error || ballots.error || participation.error) throw new Error("load failed");
    setState({
      configs: (configs.data ?? []).map((r) => mapConfig(r as Record<string, unknown>)),
      candidates: (candidates.data ?? []).map((r) => mapCandidate(r as Record<string, unknown>)),
      ballots: (ballots.data ?? []).map((r) => mapBallot(r as Record<string, unknown>)),
      participations: (participation.data ?? []).map((r) => mapParticipation(r as Record<string, unknown>)),
      indications: (indications.data ?? []).map((r) => mapIndication(r as Record<string, unknown>)),
      finalizations: (finalizations.data ?? []).map((r) => mapFinalization(r as Record<string, unknown>)),
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar a urna da eleição." });
  }
}

export function reloadBallotStore(): Promise<void> {
  setState({ loaded: false });
  return loadBallotStore();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadBallotStore();
  return () => {
    listeners.delete(listener);
  };
}

export function getBallotState(): StoreState {
  return state;
}

export function useElectionVoting(company: string): StoreState {
  setBallotCompanyRef(company);
  return useSyncExternalStore(subscribe, getBallotState, getBallotState);
}

/* ------------------------------ Helpers ----------------------------- */

export function configOf(store: StoreState, electionRef: string): BallotConfig | undefined {
  return store.configs.find((c) => c.electionRef === electionRef);
}

export function candidatesOf(store: StoreState, electionRef: string): BallotCandidate[] {
  return store.candidates.filter((c) => c.electionRef === electionRef).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function ballotsOf(store: StoreState, electionRef: string): Ballot[] {
  return store.ballots.filter((b) => b.electionRef === electionRef);
}

export function participationsOf(store: StoreState, electionRef: string): ParticipationLite[] {
  return store.participations.filter((p) => p.electionRef === electionRef);
}

export function indicationsOf(store: StoreState, electionRef: string): MandateIndication[] {
  return store.indications.filter((i) => i.electionRef === electionRef);
}

export function finalizationOf(store: StoreState, electionRef: string): FinalizationLite | undefined {
  return store.finalizations.find((f) => f.electionRef === electionRef);
}

/** O processo eleitoral já recebeu o aceite final (encerrado e inviolável)? */
export function isElectionFinalized(store: StoreState, electionRef: string): boolean {
  return Boolean(finalizationOf(store, electionRef)?.finalizedAt);
}

export interface BallotTally {
  total: number;
  blank: number;
  perCandidate: Record<string, number>;
}

/** Apuração confidencial: apenas contagens por candidato + brancos. */
export function tallyBallots(store: StoreState, electionRef: string): BallotTally {
  const ballots = ballotsOf(store, electionRef);
  const perCandidate: Record<string, number> = {};
  let blank = 0;
  ballots.forEach((b) => {
    if (b.choiceRef) perCandidate[b.choiceRef] = (perCandidate[b.choiceRef] ?? 0) + 1;
    else blank += 1;
  });
  return { total: ballots.length, blank, perCandidate };
}

export interface ParticipationSummary {
  eligible: number;
  voted: number;
  absent: number;
}

/** Resumo de comparecimento (a partir do controle de participação). */
export function participationSummary(store: StoreState, electionRef: string): ParticipationSummary {
  const rows = participationsOf(store, electionRef);
  const voted = rows.filter((r) => r.hasVoted).length;
  return { eligible: rows.length, voted, absent: rows.length - voted };
}

async function sha256(value: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

/* ---------------------------- Escritas ------------------------------ */

/** Publica/atualiza a configuração da urna (janela, termo e candidatos). */
export async function publishBallot(election: CipaElection, cipaName: string, cipaRef: string | null): Promise<StoreState> {
  const { startAt, endAt } = electionWindowIso(election);
  const establishment = election.establishment ?? "";
  try {
    const { data, error } = await supabase
      .from("cipa_ballot_config")
      .upsert(
        {
          company_ref: companyRef,
          election_ref: election.id,
          cipa_ref: cipaRef,
          cipa_name: cipaName,
          establishment,
          election_title: election.title,
          vote_start_at: startAt,
          vote_end_at: endAt,
          term_version: VOTE_TERM_VERSION,
          term_content: `${voteTerm.title}\n\n${voteTerm.intro}\n\n${voteTerm.paragraphs.join("\n\n")}\n\n${voteTerm.footer}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_ref,election_ref" }
      )
      .select("*")
      .maybeSingle();
    if (error) throw error;
    const configId = data?.id as string | undefined;
    if (configId) {
      await supabase.from("cipa_ballot_candidates").delete().eq("company_ref", companyRef).eq("election_ref", election.id);
      if (election.candidates.length) {
        await supabase.from("cipa_ballot_candidates").insert(
          election.candidates.map((c, index) => ({
            company_ref: companyRef,
            election_ref: election.id,
            candidate_ref: c.id,
            name: c.name,
            role_function: c.roleFunction || null,
            area: c.area || null,
            photo_url: c.photoUrl || null,
            sort_order: index,
          }))
        );
      }
    }
  } catch {
    setState({ error: "Não foi possível publicar a urna da eleição." });
  }
  await reloadBallotStore();
  return state;
}

/** Abre a votação (status aberta) — grava a data/hora de abertura. */
export async function openVoting(electionId: string, by = "Administrador"): Promise<void> {
  try {
    await supabase
      .from("cipa_ballot_config")
      .update({ status: "aberta", opened_at: new Date().toISOString(), opened_by: by, updated_at: new Date().toISOString() })
      .eq("company_ref", companyRef)
      .eq("election_ref", electionId);
  } catch {
    setState({ error: "Não foi possível abrir a votação." });
  }
  await reloadBallotStore();
}

/** Encerra a votação e grava o hash de integridade da urna. */
export async function closeVoting(electionId: string, by = "Administrador"): Promise<void> {
  const ballots = ballotsOf(state, electionId);
  const canonical = [...ballots]
    .sort((a, b) => (a.castAt || "").localeCompare(b.castAt || ""))
    .map((b) => `${b.choiceRef ?? "BRANCO"}|${b.castAt}`)
    .join("\n");
  const hash = await sha256(canonical);
  try {
    await supabase
      .from("cipa_ballot_config")
      .update({
        status: "encerrada",
        closed_at: new Date().toISOString(),
        closed_by: by,
        integrity_hash: hash || null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_ref", companyRef)
      .eq("election_ref", electionId);
  } catch {
    setState({ error: "Não foi possível encerrar a votação." });
  }
  await reloadBallotStore();
}

export interface InviteResult {
  ok: boolean;
  total: number;
  sent: number;
  emailEnabled: boolean;
  link: string;
}

/** Dispara os convites por e-mail (best-effort; depende do Resend configurado). */
export async function sendVotingInvites(publicToken: string): Promise<InviteResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  try {
    const { data, error } = await supabase.functions.invoke("cipa-vote", {
      body: { action: "send_invites", token: publicToken, origin },
    });
    if (error) throw error;
    return (data as InviteResult) ?? { ok: false, total: 0, sent: 0, emailEnabled: false, link: "" };
  } catch {
    return { ok: false, total: 0, sent: 0, emailEnabled: false, link: "" };
  }
}

/** URL pública da urna (link a ser enviado aos colaboradores). */
export function votingLink(publicToken: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/votacao/${publicToken}`;
}

/* --------------------------- Indicações ----------------------------- */

export interface IndicationInput {
  name: string;
  cpf?: string;
  roleFunction?: string;
  area?: string;
  registration?: string;
  memberRole: string;
  representation: string;
}

/** Registra uma indicação da empresa (pode ser antes, durante ou após a votação). */
export async function addIndication(electionRef: string, cipaRef: string | null, input: IndicationInput): Promise<void> {
  try {
    await supabase.from("cipa_mandate_indications").insert({
      company_ref: companyRef,
      election_ref: electionRef,
      cipa_ref: cipaRef,
      name: input.name,
      cpf: input.cpf || null,
      role_function: input.roleFunction || null,
      area: input.area || null,
      registration: input.registration || null,
      member_role: input.memberRole,
      representation: input.representation,
    });
  } catch {
    setState({ error: "Não foi possível registrar a indicação da empresa." });
  }
  await reloadBallotStore();
}

/** Atualiza os dados de uma indicação da empresa. */
export async function updateIndication(id: string, input: Partial<IndicationInput>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = input.name;
  if (input.cpf !== undefined) payload.cpf = input.cpf || null;
  if (input.roleFunction !== undefined) payload.role_function = input.roleFunction || null;
  if (input.area !== undefined) payload.area = input.area || null;
  if (input.registration !== undefined) payload.registration = input.registration || null;
  if (input.memberRole !== undefined) payload.member_role = input.memberRole;
  if (input.representation !== undefined) payload.representation = input.representation;
  try {
    await supabase.from("cipa_mandate_indications").update(payload).eq("id", id);
  } catch {
    setState({ error: "Não foi possível atualizar a indicação." });
  }
  await reloadBallotStore();
}

/** Remove uma indicação da empresa. */
export async function removeIndication(id: string): Promise<void> {
  try {
    await supabase.from("cipa_mandate_indications").delete().eq("id", id);
  } catch {
    setState({ error: "Não foi possível remover a indicação." });
  }
  await reloadBallotStore();
}

/** Confirma as indicações da empresa (passam a compor a CIPA junto com os eleitos). */
export async function confirmIndications(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const now = new Date().toISOString();
    await supabase
      .from("cipa_mandate_indications")
      .update({ confirmed: true, confirmed_at: now, updated_at: now })
      .in("id", ids);
  } catch {
    setState({ error: "Não foi possível confirmar as indicações." });
  }
  await reloadBallotStore();
}

/* --------------------------- Encerramento --------------------------- */

/**
 * Aplica o aceite final do administrador: grava o encerramento do processo no
 * registro da eleição (data/hora, autor, hash e snapshot do BU). A partir daí,
 * os gatilhos do banco tornam a urna, as indicações e os documentos do pleito
 * invioláveis. Deve ser chamado após a geração dos documentos finais.
 */
export async function finalizeVoting(electionRef: string, snapshot: Record<string, unknown>, actor = "Administrador"): Promise<string> {
  const hash = await sha256(JSON.stringify(snapshot));
  const now = new Date().toISOString();
  try {
    await supabase.from("cipa_elections").upsert(
      {
        company_ref: companyRef,
        election_ref: electionRef,
        status: "processo-concluido",
        finalized_at: now,
        finalized_by: actor,
        final_hash: hash,
        bu_snapshot: snapshot,
        updated_at: now,
      },
      { onConflict: "company_ref,election_ref" }
    );
    try {
      await supabase.from("cipa_election_events").insert({
        company_ref: companyRef,
        election_ref: electionRef,
        action: "processo_encerrado",
        actor,
        detail: "Aceite final do administrador: processo eleitoral encerrado e inviolável.",
        payload: snapshot,
      });
    } catch {
      /* auditoria é best-effort */
    }
  } catch {
    setState({ error: "Não foi possível encerrar o processo eleitoral." });
  }
  await reloadBallotStore();
  return hash;
}