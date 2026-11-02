import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import type { MoodId } from "./moodOptions";
import type { MoodActor } from "./moodUtils";

/**
 * Store compartilhado do "sentimento do dia".
 * Carrega os registros de `daily_moods` e mantém a lista reativa para o
 * modal obrigatório, o resumo do colaborador e o painel do gestor.
 * A gravação usa upsert na chave (user_key, mood_date), garantindo um
 * único registro por pessoa e por dia mesmo com cliques repetidos.
 */
export interface MoodEntry {
  id: string;
  userKey: string;
  userName: string;
  role: string;
  company: string;
  area: string;
  establishment: string;
  managerKey: string | null;
  managerName: string | null;
  mood: MoodId;
  moodScore: number;
  reason: string;
  moodDate: string;
  createdAt: string;
}

interface MoodState {
  rows: MoodEntry[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

interface MoodRow {
  id: string;
  user_key: string;
  user_name: string;
  role: string | null;
  company: string | null;
  area: string | null;
  establishment: string | null;
  manager_key: string | null;
  manager_name: string | null;
  mood: string;
  mood_score: number;
  reason: string | null;
  mood_date: string;
  created_at: string;
}

let state: MoodState = { rows: [], loaded: false, loading: false, error: null };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<MoodState>): void {
  state = { ...state, ...patch };
  emit();
}

function mapRow(row: MoodRow): MoodEntry {
  return {
    id: row.id,
    userKey: row.user_key,
    userName: row.user_name,
    role: row.role ?? "",
    company: row.company ?? "",
    area: row.area ?? "",
    establishment: row.establishment ?? "",
    managerKey: row.manager_key ?? null,
    managerName: row.manager_name ?? null,
    mood: row.mood as MoodId,
    moodScore: row.mood_score,
    reason: row.reason ?? "",
    moodDate: row.mood_date,
    createdAt: row.created_at,
  };
}

async function load(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  try {
    const { data, error } = await supabase
      .from("daily_moods")
      .select(
        "id, user_key, user_name, role, company, area, establishment, manager_key, manager_name, mood, mood_score, reason, mood_date, created_at"
      )
      .order("mood_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    setState({ rows: (data as MoodRow[] | null ?? []).map(mapRow), loaded: true, loading: false, error: null });
  } catch {
    setState({
      loaded: true,
      loading: false,
      error: "Não foi possível carregar os registros de sentimento.",
    });
  }
}

export function reloadMoods(): Promise<void> {
  setState({ loaded: false });
  return load();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!state.loaded && !state.loading) void load();
  return () => {
    listeners.delete(listener);
  };
}

export function getMoodState(): MoodState {
  return state;
}

export function useMoodState(): MoodState {
  return useSyncExternalStore(subscribe, getMoodState, getMoodState);
}

export interface RecordMoodInput {
  actor: MoodActor;
  mood: MoodId;
  moodScore: number;
  reason?: string;
  moodDate: string;
}

export async function recordMood(input: RecordMoodInput): Promise<void> {
  const { actor } = input;
  const payload = {
    user_key: actor.userKey,
    user_name: actor.userName,
    role: actor.role,
    company: actor.company,
    area: actor.area || null,
    establishment: actor.establishment || null,
    manager_key: actor.managerKey ?? null,
    manager_name: actor.managerName ?? null,
    mood: input.mood,
    mood_score: input.moodScore,
    reason: input.reason && input.reason.trim() ? input.reason.trim() : null,
    mood_date: input.moodDate,
  };
  const { error } = await supabase
    .from("daily_moods")
    .upsert(payload, { onConflict: "user_key,mood_date" });
  if (error) throw error;
  await reloadMoods();
}

/* ------------------------------------------------------------------ */
/* Seletores                                                           */
/* ------------------------------------------------------------------ */

/** Registros do próprio autor (histórico pessoal). */
export function ownMoods(rows: MoodEntry[], actor: MoodActor): MoodEntry[] {
  return rows.filter((r) => r.userKey === actor.userKey);
}

/**
 * Registros visíveis para o gestor.
 * Admin/Super têm visão de supervisão (todos); os demais veem apenas os
 * colaboradores que lhes foram designados como liderados — tanto pelo vínculo
 * individual (por nome) quanto pelas áreas/setores sob sua responsabilidade
 * (por função), informadas em `leaderAreas`.
 */
export function teamMoods(rows: MoodEntry[], actor: MoodActor, leaderAreas: string[] = []): MoodEntry[] {
  if (actor.role === "admin" || actor.role === "super") return rows;
  if (actor.collaboratorId) {
    const id = actor.collaboratorId;
    const areaSet = new Set(leaderAreas);
    return rows.filter((r) => r.managerKey === id || (r.area && areaSet.has(r.area)));
  }
  return [];
}

/** Registro de hoje para uma chave de usuário. */
export function findTodayMood(rows: MoodEntry[], userKey: string | null, date: string): MoodEntry | undefined {
  if (!userKey) return undefined;
  return rows.find((r) => r.userKey === userKey && r.moodDate === date);
}