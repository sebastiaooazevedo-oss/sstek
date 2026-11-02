import { useSyncExternalStore } from "react";
import { initialElections, type CipaElection } from "@/mocks/cipa";

/**
 * Fachada do módulo CIPA.
 *
 * As comissões, a agenda de reuniões, as atas e o plano de ações agora são
 * persistidos no Supabase pelo `cipaCoreStore` (reexportado abaixo) e as
 * inspeções pelo `cipaInspectionsStore`. Assim os consumidores (página, visão
 * geral, alertas, topbar, Documentos) continuam usando a mesma API sem nada
 * mudar no código deles.
 *
 * OBS.: os processos eleitorais (composição das eleições, candidatos e votos)
 * ainda rodam em memória nesta etapa — a governança do processo já é
 * persistida pelo `electionProcessStore`.
 */

export {
  getCipas,
  addCipa,
  updateCipa,
  removeCipa,
  useCipas,
  getMeetings,
  addMeeting,
  updateMeeting,
  removeMeeting,
  useMeetings,
  getAtas,
  addAta,
  updateAta,
  removeAta,
  useAtas,
  getActions,
  addAction,
  updateAction,
  removeAction,
  useActions,
} from "./cipaCoreStore";

export { getInspections, addInspection, useInspections, setCipaInspectionsCompanyRef } from "./cipaInspectionsStore";

/* ---------------------------- Eleições ----------------------------- */

let elections: CipaElection[] = [...initialElections];

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getElections(): CipaElection[] {
  return elections;
}

export function addElection(election: CipaElection): void {
  elections = [election, ...elections];
  emit();
}

export function updateElection(election: CipaElection): void {
  elections = elections.map((e) => (e.id === election.id ? election : e));
  emit();
}

export function useElections(): CipaElection[] {
  return useSyncExternalStore(subscribe, getElections, getElections);
}