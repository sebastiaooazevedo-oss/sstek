import { useSyncExternalStore } from "react";
import type { RoleId } from "@/mocks/app";
import { collaborators, type Collaborator } from "@/mocks/collaborators";

/**
 * Store compartilhado da hierarquia de liderança.
 *
 * Um líder enxerga os resultados de quem está "abaixo" dele por dois caminhos:
 *  - por pessoa: vínculo individual no cadastro do colaborador (`managerId`);
 *  - por função/área: o líder é responsável por TODO um setor/área.
 *
 * A parametrização também registra QUAIS perfis (papéis) podem alocar líderes.
 * Os dados desta fase ficam em memória (modo demonstração), no mesmo padrão dos
 * stores de EPI, APR e documentos; a migração para o banco acontece junto com a
 * autenticação real, sem mudar a interface.
 */
export interface LeadershipSettings {
  /** Área/setor → id do colaborador responsável (líder da área). */
  leaderByArea: Record<string, string>;
  /** Perfis (papéis) autorizados a alocar líderes. */
  allocationRoles: RoleId[];
}

/** Todos os papéis disponíveis para a parametrização. */
export const ALL_ROLES: RoleId[] = ["super", "admin", "colaborador"];

const defaultLeadership: LeadershipSettings = {
  // Sementes coerentes com os vínculos individuais já existentes no cadastro:
  // Marcos (Supervisor) lidera a Produção e Larissa (Eng. de Segurança) o SESMT.
  leaderByArea: { Produção: "c-008", SESMT: "c-011" },
  allocationRoles: ["admin", "super"],
};

let leadership: LeadershipSettings = {
  leaderByArea: { ...defaultLeadership.leaderByArea },
  allocationRoles: [...defaultLeadership.allocationRoles],
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeLeadership(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLeadership(): LeadershipSettings {
  return leadership;
}

export function useLeadership(): LeadershipSettings {
  return useSyncExternalStore(subscribeLeadership, getLeadership, getLeadership);
}

export function resetLeadership(): void {
  leadership = {
    leaderByArea: { ...defaultLeadership.leaderByArea },
    allocationRoles: [...defaultLeadership.allocationRoles],
  };
  emit();
}

/** Define (ou remove, com string vazia) o líder responsável por uma área/setor. */
export function setAreaLeader(area: string, leaderId: string): void {
  const next = { ...leadership.leaderByArea };
  if (leaderId) next[area] = leaderId;
  else delete next[area];
  leadership = { ...leadership, leaderByArea: next };
  emit();
}

export function setAllocationRoles(roles: RoleId[]): void {
  leadership = { ...leadership, allocationRoles: roles };
  emit();
}

export function toggleAllocationRole(role: RoleId): void {
  const has = leadership.allocationRoles.includes(role);
  setAllocationRoles(
    has ? leadership.allocationRoles.filter((r) => r !== role) : [...leadership.allocationRoles, role]
  );
}

/** Indica se um perfil pode alocar líderes (parametrização). */
export function canAllocateLeaders(role: RoleId): boolean {
  return leadership.allocationRoles.includes(role);
}

/** Líder designado para uma área/setor (ou undefined). */
export function leaderOfArea(area: string): Collaborator | undefined {
  const id = leadership.leaderByArea[area];
  return id ? collaborators.find((c) => c.id === id) : undefined;
}

/** Áreas/setores sob a responsabilidade de um colaborador. */
export function areasLedBy(collaboratorId: string | null): string[] {
  if (!collaboratorId) return [];
  return Object.entries(leadership.leaderByArea)
    .filter(([, id]) => id === collaboratorId)
    .map(([area]) => area);
}

/**
 * Quem está "abaixo" de um líder: pelos vínculos individuais (por nome) e
 * pelas áreas/setores pelos quais ele é responsável (por função/área).
 */
export function subordinatesOf(collaboratorId: string | null): Collaborator[] {
  if (!collaboratorId) return [];
  const areas = new Set(areasLedBy(collaboratorId));
  return collaborators.filter(
    (c) => c.id !== collaboratorId && (c.managerId === collaboratorId || areas.has(c.area))
  );
}

/** Liderados vinculados individualmente (por nome, via `managerId`). */
export function subordinatesByPerson(collaboratorId: string | null): Collaborator[] {
  if (!collaboratorId) return [];
  return collaborators.filter((c) => c.id !== collaboratorId && c.managerId === collaboratorId);
}

/**
 * Liderados vinculados por função/área (o líder responde por todo o setor).
 * Exclui quem já aparece como liderado por nome, para não contar duas vezes.
 */
export function subordinatesByArea(collaboratorId: string | null): Collaborator[] {
  if (!collaboratorId) return [];
  const areas = new Set(areasLedBy(collaboratorId));
  const byPerson = new Set(subordinatesByPerson(collaboratorId).map((c) => c.id));
  return collaborators.filter(
    (c) => c.id !== collaboratorId && !byPerson.has(c.id) && areas.has(c.area)
  );
}

/** Indica se um colaborador lidera alguém (por pessoa ou por área). */
export function isLeader(collaboratorId: string | null): boolean {
  return subordinatesOf(collaboratorId).length > 0;
}