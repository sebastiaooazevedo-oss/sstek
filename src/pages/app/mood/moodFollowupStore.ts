import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Store do "acolhimento" — a resposta do gestor a um registro de sentimento.
 * Guarda, por colaborador e por dia, o status do acompanhamento e uma nota
 * interna. É o que transforma o alerta em ação: alguém abriu a conversa,
 * acompanhou ou já acolheu o colaborador.
 */
export type FollowupStatus = "pendente" | "acompanhando" | "acolhido";

export interface MoodFollowup {
  id: string;
  collaboratorKey: string;
  collaboratorName: string;
  moodDate: string;
  mood: string;
  status: FollowupStatus;
  note: string;
  createdBy: string;
  updatedAt: string;
}

interface FollowupState {
  rows: MoodFollowup[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

interface FollowupRow {
  id: string;
  collaborator_key: string;
  collaborator_name: string;
  mood_date: string;
  mood: string;
  status: string;
  note: string | null;
  created_by: string | null;
  updated_at: string;
}

let state: FollowupState = { rows: [], loaded: false, loading: false, error: null };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<FollowupState>): void {
  state = { ...state, ...patch };
  emit();
}

function normalizeStatus(value: string): FollowupStatus {
  if (value === "acompanhando" || value === "acolhido") return value;
  return "pendente";
}

function mapRow(row: FollowupRow): MoodFollowup {
  return {
    id: row.id,
    collaboratorKey: row.collaborator_key,
    collaboratorName: row.collaborator_name,
    moodDate: row.mood_date,
    mood: row.mood,
    status: normalizeStatus(row.status),
    note: row.note ?? "",
    createdBy: row.created_by ?? "",
    updatedAt: row.updated_at,
  };
}

async function load(): Promise<void> {
  if (state.loading) return;
  setState({ loading: true });
  try {
    const { data, error } = await supabase
      .from("mood_followups")
      .select("id, collaborator_key, collaborator_name, mood_date, mood, status, note, created_by, updated_at")
      .order("updated_at", { ascending: false })
      .limit(800);
    if (error) throw error;
    setState({
      rows: (data as FollowupRow[] | null ?? []).map(mapRow),
      loaded: true,
      loading: false,
      error: null,
    });
  } catch {
    setState({
      loaded: true,
      loading: false,
      error: "Não foi possível carregar os acolhimentos registrados.",
    });
  }
}

export function reloadMoodFollowups(): Promise<void> {
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

export function getMoodFollowupState(): FollowupState {
  return state;
}

export function useMoodFollowups(): FollowupState {
  return useSyncExternalStore(subscribe, getMoodFollowupState, getMoodFollowupState);
}

export interface SaveFollowupInput {
  company: string;
  collaboratorKey: string;
  collaboratorName: string;
  moodDate: string;
  mood: string;
  status: FollowupStatus;
  note?: string;
  createdBy?: string;
}

export async function saveMoodFollowup(input: SaveFollowupInput): Promise<void> {
  const payload = {
    company: input.company,
    collaborator_key: input.collaboratorKey,
    collaborator_name: input.collaboratorName,
    mood_date: input.moodDate,
    mood: input.mood,
    status: input.status,
    note: input.note && input.note.trim() ? input.note.trim() : null,
    created_by: input.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("mood_followups")
    .upsert(payload, { onConflict: "company,collaborator_key,mood_date" });
  if (error) throw error;
  await reloadMoodFollowups();
}

/** Acolhimento mais recente de um colaborador (independente da data). */
export function latestFollowupFor(rows: MoodFollowup[], collaboratorKey: string): MoodFollowup | undefined {
  return rows.find((row) => row.collaboratorKey === collaboratorKey);
}

/** Acolhimento de um dia específico. */
export function followupFor(
  rows: MoodFollowup[],
  collaboratorKey: string,
  moodDate: string
): MoodFollowup | undefined {
  return rows.find((row) => row.collaboratorKey === collaboratorKey && row.moodDate === moodDate);
}

const STATUS_LABEL: Record<FollowupStatus, string> = {
  pendente: "Aguardando acolhimento",
  acompanhando: "Em acompanhamento",
  acolhido: "Acolhido",
};

/** Rótulo curto usado nos chips do painel. */
export function followupStatusLabel(status: FollowupStatus): string {
  return STATUS_LABEL[status];
}