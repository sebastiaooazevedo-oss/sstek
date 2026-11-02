import { useSyncExternalStore } from "react";
import type { RoleId } from "@/mocks/app";

/**
 * Store compartilhado das permissões sobre documentos.
 *
 * Uma ficha/documento assinado é um registro de conformidade: por isso a
 * exclusão só é permitida para os perfis (papéis) autorizados na parametrização
 * do sistema. Nesta fase os dados ficam em memória (modo demonstração), no
 * mesmo padrão dos stores de EPI, APR, documentos e liderança; a migração para
 * o banco acontece junto com a autenticação real, sem mudar a interface.
 */
export interface DocumentPermissionsSettings {
  /** Perfis (papéis) autorizados a excluir documentos assinados. */
  deleteRoles: RoleId[];
  /**
   * Perfis autorizados a publicar/substituir o Regulamento Interno.
   * Somente quem estiver marcado aqui pode subir um novo PDF de regulamento.
   */
  regulationUploadRoles: RoleId[];
}

/** Todos os papéis disponíveis para a parametrização. */
export const ALL_DOC_ROLES: RoleId[] = ["super", "admin", "colaborador"];

const defaultPermissions: DocumentPermissionsSettings = {
  deleteRoles: ["super", "admin"],
  regulationUploadRoles: ["super", "admin"],
};

let permissions: DocumentPermissionsSettings = {
  deleteRoles: [...defaultPermissions.deleteRoles],
  regulationUploadRoles: [...defaultPermissions.regulationUploadRoles],
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeDocumentPermissions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDocumentPermissions(): DocumentPermissionsSettings {
  return permissions;
}

export function useDocumentPermissions(): DocumentPermissionsSettings {
  return useSyncExternalStore(subscribeDocumentPermissions, getDocumentPermissions, getDocumentPermissions);
}

export function resetDocumentPermissions(): void {
  permissions = {
    deleteRoles: [...defaultPermissions.deleteRoles],
    regulationUploadRoles: [...defaultPermissions.regulationUploadRoles],
  };
  emit();
}

export function setDeleteRoles(roles: RoleId[]): void {
  permissions = { ...permissions, deleteRoles: roles };
  emit();
}

export function toggleDeleteRole(role: RoleId): void {
  const has = permissions.deleteRoles.includes(role);
  setDeleteRoles(
    has ? permissions.deleteRoles.filter((r) => r !== role) : [...permissions.deleteRoles, role]
  );
}

/** Indica se um perfil pode excluir documentos (parametrização). */
export function canDeleteDocuments(role: RoleId): boolean {
  return permissions.deleteRoles.includes(role);
}

/** Indica se um perfil pode publicar/substituir o Regulamento Interno. */
export function canPublishRegulation(role: RoleId): boolean {
  return permissions.regulationUploadRoles.includes(role);
}

export function setRegulationUploadRoles(roles: RoleId[]): void {
  permissions = { ...permissions, regulationUploadRoles: roles };
  emit();
}

export function toggleRegulationUploadRole(role: RoleId): void {
  const has = permissions.regulationUploadRoles.includes(role);
  setRegulationUploadRoles(
    has
      ? permissions.regulationUploadRoles.filter((r) => r !== role)
      : [...permissions.regulationUploadRoles, role]
  );
}