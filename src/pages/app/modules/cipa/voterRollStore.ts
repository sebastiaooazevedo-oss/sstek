import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { logElectionEvent } from "@/pages/app/modules/cipa/electionProcessStore";

/**
 * Base eleitoral da CIPA (Fase 2 do processo eleitoral).
 *
 * Persiste no Supabase, por empresa (company_ref) e por processo (election_ref):
 *
 *  - cipa_voter_rolls      → versões/snapshots da base (Em preparação → Fechada).
 *  - cipa_voter_entries    → eleitores de cada versão (elegibilidade apto/inapto).
 *  - cipa_voter_participation → CONTROLE DE PARTICIPAÇÃO (não votou / votou).
 *
 * REGRA CRÍTICA DE ARQUITETURA: a estrutura de participação registra "quem
 * estava apto e se participou" e JAMAIS guarda candidato, voto, hash de voto
 * ou qualquer identificador que permita reconstruir a escolha do eleitor. Não
 * existe (nem existirá) chave estrangeira entre participação e a urna da Fase 3.
 */

export type VoterRollStatus = "preparacao" | "fechada";

export interface VoterRollRecord {
  id: string;
  companyRef: string;
  electionRef: string;
  cipaRef: string | null;
  establishment: string;
  version: number;
  status: VoterRollStatus;
  eligibleCount: number;
  ineligibleCount: number;
  totalCount: number;
  closedAt: string | null;
  closedBy: string;
  integrityHash: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoterEntryRecord {
  id: string;
  companyRef: string;
  electionRef: string;
  rollId: string;
  collaboratorId: string | null;
  collaboratorRef: string;
  nameSnapshot: string;
  matriculaSnapshot: string;
  area: string;
  eligibility: "apto" | "inapto";
  ineligibleReason: string;
  addedBy: string;
  createdAt: string;
}

export interface ParticipationRecord {
  id: string;
  electionRef: string;
  collaboratorRef: string;
  collaboratorId: string | null;
  hasVoted: boolean;
  votedAt: string | null;
  participationRef: string;
}

export interface CompanyCollaborator {
  id: string;
  ref: string;
  name: string;
  matricula: string;
  area: string;
  roleFunction: string;
  establishment: string;
  active: boolean;
}

interface StoreState {
  rolls: VoterRollRecord[];
  entries: VoterEntryRecord[];
  participation: ParticipationRecord[];
  collaborators: CompanyCollaborator[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

const defaultActor = "Administrador";

let companyRef = "vega";
let state: StoreState = {
  rolls: [],
  entries: [],
  participation: [],
  collaborators: [],
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

export function setVoterCompanyRef(ref: string): void {
  const next = ref || "vega";
  if (next === companyRef) return;
  companyRef = next;
  state = { ...state, loaded: false };
  void loadVoterRoll();
}

/* ---------------------------- Mapeadores ---------------------------- */

function mapRoll(r: Record<string, unknown>): VoterRollRecord {
  return {
    id: String(r.id),
    companyRef: String(r.company_ref),
    electionRef: String(r.election_ref),
    cipaRef: (r.cipa_ref as string) ?? null,
    establishment: (r.establishment as string) ?? "",
    version: Number(r.version) || 1,
    status: (r.status as VoterRollStatus) ?? "preparacao",
    eligibleCount: Number(r.eligible_count) || 0,
    ineligibleCount: Number(r.ineligible_count) || 0,
    totalCount: Number(r.total_count) || 0,
    closedAt: (r.closed_at as string) ?? null,
    closedBy: (r.closed_by as string) ?? "",
    integrityHash: (r.integrity_hash as string) ?? "",
    notes: (r.notes as string) ?? "",
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapEntry(r: Record<string, unknown>): VoterEntryRecord {
  return {
    id: String(r.id),
    companyRef: String(r.company_ref),
    electionRef: String(r.election_ref),
    rollId: String(r.roll_id),
    collaboratorId: (r.collaborator_id as string) ?? null,
    collaboratorRef: (r.collaborator_ref as string) ?? "",
    nameSnapshot: (r.name_snapshot as string) ?? "",
    matriculaSnapshot: (r.matricula_snapshot as string) ?? "",
    area: (r.area as string) ?? "",
    eligibility: (r.eligibility as "apto" | "inapto") ?? "apto",
    ineligibleReason: (r.ineligible_reason as string) ?? "",
    addedBy: (r.added_by as string) ?? "",
    createdAt: String(r.created_at),
  };
}

function mapParticipation(r: Record<string, unknown>): ParticipationRecord {
  return {
    id: String(r.id),
    electionRef: String(r.election_ref),
    collaboratorRef: (r.collaborator_ref as string) ?? "",
    collaboratorId: (r.collaborator_id as string) ?? null,
    hasVoted: Boolean(r.has_voted),
    votedAt: (r.voted_at as string) ?? null,
    participationRef: (r.participation_ref as string) ?? "",
  };
}

/* ------------------------------- Load ------------------------------- */

export async function loadVoterRoll(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  try {
    const [rolls, entries, part, collabs] = await Promise.all([
      supabase.from("cipa_voter_rolls").select("*").eq("company_ref", companyRef).order("version"),
      supabase.from("cipa_voter_entries").select("*").eq("company_ref", companyRef).order("name_snapshot"),
      supabase.from("cipa_voter_participation").select("*").eq("company_ref", companyRef),
      supabase
        .from("company_collaborators")
        .select("id, ref, name, matricula, area, role_function, establishment, active")
        .order("name"),
    ]);
    if (rolls.error || entries.error || part.error || collabs.error) throw new Error("load failed");
    setState({
      rolls: (rolls.data ?? []).map(mapRoll),
      entries: (entries.data ?? []).map(mapEntry),
      participation: (part.data ?? []).map(mapParticipation),
      collaborators: (collabs.data ?? []).map((c) => ({
        id: String(c.id),
        ref: (c.ref as string) ?? "",
        name: (c.name as string) ?? "",
        matricula: (c.matricula as string) ?? "",
        area: (c.area as string) ?? "",
        roleFunction: (c.role_function as string) ?? "",
        establishment: (c.establishment as string) ?? "",
        active: Boolean(c.active),
      })),
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({ loaded: true, loading: false, error: "Não foi possível carregar a base eleitoral." });
  }
}

export function reloadVoterRoll(): Promise<void> {
  setState({ loaded: false });
  return loadVoterRoll();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void loadVoterRoll();
  return () => {
    listeners.delete(listener);
  };
}

export function getVoterRollState(): StoreState {
  return state;
}

/** Hook da base eleitoral (já fixando a empresa da sessão). */
export function useVoterRoll(company: string): StoreState {
  setVoterCompanyRef(company);
  return useSyncExternalStore(subscribe, getVoterRollState, getVoterRollState);
}

/* ---------------------------- Helpers ------------------------------- */

/** Todas as versões da base de um processo, da mais recente para a mais antiga. */
export function rollsOf(store: StoreState, electionRef: string): VoterRollRecord[] {
  return store.rolls
    .filter((r) => r.electionRef === electionRef)
    .sort((a, b) => b.version - a.version);
}

/** Versão atualmente editável (Em preparação) do processo, se existir. */
export function openRollOf(store: StoreState, electionRef: string): VoterRollRecord | undefined {
  return rollsOf(store, electionRef).find((r) => r.status === "preparacao");
}

/** Versão vigente (a última, aberta ou fechada). */
export function latestRollOf(store: StoreState, electionRef: string): VoterRollRecord | undefined {
  return rollsOf(store, electionRef)[0];
}

/** Eleitores de uma versão específica. */
export function entriesOf(store: StoreState, rollId: string): VoterEntryRecord[] {
  return store.entries.filter((e) => e.rollId === rollId);
}

/** Hash de integridade (SHA-256) do conteúdo congelado da base. */
export async function computeIntegrityHash(entries: VoterEntryRecord[]): Promise<string> {
  const canonical = [...entries]
    .sort((a, b) => (a.collaboratorRef || "").localeCompare(b.collaboratorRef || ""))
    .map((e) => `${e.collaboratorRef}|${e.eligibility}|${e.nameSnapshot}|${e.matriculaSnapshot}`)
    .join("\n");
  try {
    const bytes = new TextEncoder().encode(canonical);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

async function recalcRoll(rollId: string): Promise<void> {
  const entries = state.entries.filter((e) => e.rollId === rollId);
  const eligible = entries.filter((e) => e.eligibility === "apto").length;
  const ineligible = entries.filter((e) => e.eligibility === "inapto").length;
  try {
    await supabase
      .from("cipa_voter_rolls")
      .update({
        eligible_count: eligible,
        ineligible_count: ineligible,
        total_count: entries.length,
        updated_at: nowIso(),
      })
      .eq("id", rollId);
  } catch {
    /* ignore */
  }
}

/* ---------------------------- Processo ------------------------------ */

export interface VoterRollSeed {
  cipaRef?: string;
  establishment?: string;
}

/**
 * Garante que exista a versão 1 (Em preparação) da base do processo.
 * Cria apenas se não houver nenhuma versão; preserva o que já existe.
 */
export async function ensureVoterRoll(electionRef: string, seed: VoterRollSeed = {}): Promise<void> {
  if (!electionRef) return;
  const existing = state.rolls.find((r) => r.electionRef === electionRef);
  if (existing) return;
  try {
    await supabase.from("cipa_voter_rolls").insert({
      company_ref: companyRef,
      election_ref: electionRef,
      cipa_ref: seed.cipaRef ?? null,
      establishment: seed.establishment ?? null,
      version: 1,
      status: "preparacao",
    });
    await logElectionEvent(electionRef, "base_eleitoral_criada", "Base eleitoral criada (versão 1, em preparação).");
  } catch {
    /* ignore */
  }
  await reloadVoterRoll();
}

/* ---------------------------- Eleitores ----------------------------- */

/** Importa colaboradores selecionados para a versão aberta (sem duplicar). */
export async function importVoters(
  electionRef: string,
  rollId: string,
  collaborators: CompanyCollaborator[],
  addedBy = defaultActor
): Promise<number> {
  const existingRefs = new Set(state.entries.filter((e) => e.rollId === rollId).map((e) => e.collaboratorRef));
  const toInsert = collaborators.filter((c) => c.ref && !existingRefs.has(c.ref));
  if (!toInsert.length) return 0;
  try {
    await supabase.from("cipa_voter_entries").insert(
      toInsert.map((c) => ({
        company_ref: companyRef,
        election_ref: electionRef,
        roll_id: rollId,
        collaborator_id: c.id || null,
        collaborator_ref: c.ref,
        name_snapshot: c.name,
        matricula_snapshot: c.matricula,
        area: c.area,
        eligibility: "apto",
        added_by: addedBy,
      }))
    );
    await logElectionEvent(
      electionRef,
      "base_eleitores_importados",
      `${toInsert.length} eleitor(es) incluído(s) na base.`,
      { count: toInsert.length }
    );
  } catch {
    /* ignore */
  }
  await recalcRoll(rollId);
  await reloadVoterRoll();
  return toInsert.length;
}

/** Adiciona um eleitor avulso (cadastro manual) à versão aberta. */
export async function addVoterManual(
  electionRef: string,
  rollId: string,
  data: { name: string; matricula?: string; area?: string; collaboratorRef?: string },
  addedBy = defaultActor
): Promise<void> {
  if (!data.name.trim()) return;
  const ref = data.collaboratorRef?.trim() || `manual-${Date.now()}`;
  try {
    await supabase.from("cipa_voter_entries").insert({
      company_ref: companyRef,
      election_ref: electionRef,
      roll_id: rollId,
      collaborator_ref: ref,
      name_snapshot: data.name.trim(),
      matricula_snapshot: data.matricula?.trim() || null,
      area: data.area?.trim() || null,
      eligibility: "apto",
      added_by: addedBy,
    });
    await logElectionEvent(electionRef, "base_eleitor_incluido", `Eleitor incluído: ${data.name.trim()}.`);
  } catch {
    /* ignore */
  }
  await recalcRoll(rollId);
  await reloadVoterRoll();
}

/** Altera a elegibilidade (apto/inapto) e a justificativa de inaptidão. */
export async function updateVoterEligibility(
  electionRef: string,
  entryId: string,
  eligibility: "apto" | "inapto",
  reason = ""
): Promise<void> {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return;
  try {
    await supabase
      .from("cipa_voter_entries")
      .update({ eligibility, ineligible_reason: eligibility === "inapto" ? reason || null : null })
      .eq("id", entryId);
    await logElectionEvent(
      electionRef,
      "base_elegibilidade_alterada",
      `${entry.nameSnapshot}: ${eligibility}${eligibility === "inapto" && reason ? ` (${reason})` : ""}.`
    );
  } catch {
    /* ignore */
  }
  await recalcRoll(entry.rollId);
  await reloadVoterRoll();
}

/** Remove um eleitor da versão aberta. */
export async function removeVoter(electionRef: string, entryId: string): Promise<void> {
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return;
  try {
    await supabase.from("cipa_voter_entries").delete().eq("id", entryId);
    await logElectionEvent(electionRef, "base_eleitor_removido", `Eleitor removido: ${entry.nameSnapshot}.`);
  } catch {
    /* ignore */
  }
  await recalcRoll(entry.rollId);
  await reloadVoterRoll();
}

/* ----------------------- Versões e fechamento ----------------------- */

/** Gera nova versão (snapshot) a partir da versão vigente, preservando o histórico. */
export async function createNewVersion(electionRef: string, justification = ""): Promise<void> {
  const rolls = rollsOf(state, electionRef);
  const source = rolls[0];
  const nextVersion = (source?.version || 0) + 1;
  const sourceEntries = source ? entriesOf(state, source.id) : [];
  try {
    const inserted = await supabase
      .from("cipa_voter_rolls")
      .insert({
        company_ref: companyRef,
        election_ref: electionRef,
        cipa_ref: source?.cipaRef ?? null,
        establishment: source?.establishment ?? null,
        version: nextVersion,
        status: "preparacao",
      })
      .select("id")
      .maybeSingle();
    const newRollId = inserted.data?.id as string | undefined;
    if (newRollId && sourceEntries.length) {
      await supabase.from("cipa_voter_entries").insert(
        sourceEntries.map((e) => ({
          company_ref: companyRef,
          election_ref: electionRef,
          roll_id: newRollId,
          collaborator_id: e.collaboratorId,
          collaborator_ref: e.collaboratorRef,
          name_snapshot: e.nameSnapshot,
          matricula_snapshot: e.matriculaSnapshot,
          area: e.area,
          eligibility: e.eligibility,
          ineligible_reason: e.ineligibleReason || null,
          added_by: defaultActor,
        }))
      );
      await recalcRoll(newRollId);
    }
    await logElectionEvent(
      electionRef,
      "base_nova_versao",
      `Nova versão da base gerada (v${nextVersion})${justification ? ` — ${justification}` : ""}.`,
      { version: nextVersion }
    );
  } catch {
    /* ignore */
  }
  await reloadVoterRoll();
}

/**
 * Fecha a base eleitoral (definitiva). Congela os totais, grava responsável,
 * data/hora e o hash de integridade, e cria o controle de participação
 * (não votou) para cada eleitor apto.
 */
export async function closeVoterRoll(electionRef: string, rollId: string, closedBy = defaultActor): Promise<boolean> {
  const entries = entriesOf(state, rollId);
  const eligible = entries.filter((e) => e.eligibility === "apto");
  const ineligible = entries.filter((e) => e.eligibility === "inapto");
  const hash = await computeIntegrityHash(entries);
  try {
    await supabase
      .from("cipa_voter_rolls")
      .update({
        status: "fechada",
        closed_at: nowIso(),
        closed_by: closedBy,
        integrity_hash: hash || null,
        eligible_count: eligible.length,
        ineligible_count: ineligible.length,
        total_count: entries.length,
        updated_at: nowIso(),
      })
      .eq("id", rollId);

    if (eligible.length) {
      await supabase
        .from("cipa_voter_participation")
        .upsert(
          eligible.map((e) => ({
            company_ref: companyRef,
            election_ref: electionRef,
            roll_id: rollId,
            collaborator_id: e.collaboratorId,
            collaborator_ref: e.collaboratorRef,
            has_voted: false,
          })),
          { onConflict: "company_ref,election_ref,collaborator_ref", ignoreDuplicates: true }
        );
    }
    await logElectionEvent(
      electionRef,
      "base_fechada",
      `Base eleitoral fechada por ${closedBy}: ${eligible.length} apto(s), ${ineligible.length} inapto(s). Hash: ${hash.slice(0, 16)}…`,
      { version: state.rolls.find((r) => r.id === rollId)?.version ?? null, hash }
    );
  } catch {
    return false;
  }
  await reloadVoterRoll();
  return true;
}

/**
 * Correção excepcional após o fechamento: NÃO edita a base fechada em silêncio.
 * Cria uma nova versão a partir da definitiva, exige justificativa e registra
 * a reabertura na auditoria.
 */
export async function reopenVoterRollWithCorrection(
  electionRef: string,
  justification: string,
  responsible = defaultActor
): Promise<void> {
  if (!justification.trim()) return;
  await logElectionEvent(
    electionRef,
    "base_reaberta_correcao",
    `Correção excepcional da base fechada por ${responsible}. Justificativa: ${justification.trim()}.`,
    { responsible }
  );
  await createNewVersion(electionRef, `Correção excepcional: ${justification.trim()}`);
}

/* ---------------------------- Validação ----------------------------- */

export interface VoterRollValidation {
  ok: boolean;
  issues: string[];
}

/** Valida a base antes do fechamento, apontando pendências. */
export function validateVoterRoll(store: StoreState, electionRef: string): VoterRollValidation {
  const roll = openRollOf(store, electionRef) || latestRollOf(store, electionRef);
  const issues: string[] = [];
  if (!roll) {
    return { ok: false, issues: ["Nenhuma versão da base foi criada."] };
  }
  const entries = entriesOf(store, roll.id);
  if (!entries.length) issues.push("A base não possui eleitores.");
  const aptos = entries.filter((e) => e.eligibility === "apto");
  if (entries.length && !aptos.length) issues.push("Nenhum eleitor está apto a votar.");
  const inaptosSemMotivo = entries.filter((e) => e.eligibility === "inapto" && !e.ineligibleReason.trim());
  if (inaptosSemMotivo.length) issues.push(`${inaptosSemMotivo.length} eleitor(es) inapto(s) sem justificativa.`);
  const semMatricula = entries.filter((e) => !e.matriculaSnapshot.trim());
  if (semMatricula.length) issues.push(`${semMatricula.length} eleitor(es) sem matrícula/identificação interna.`);
  return { ok: issues.length === 0, issues };
}