import { useMemo } from "react";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { useAppSession } from "@/pages/app/context";
import type { Collaborator } from "@/mocks/collaborators";

/**
 * Responsável Técnico (RT) de Segurança do Trabalho da empresa.
 *
 * A fonte principal é o cadastro de colaboradores (interruptor "Este
 * colaborador é o Responsável Técnico"). Quando ninguém foi marcado, o nome
 * parametrizado em Configurações → Dados da empresa serve de referência.
 */
export interface TechnicalResponsible {
  collaboratorId: string | null;
  name: string;
  /** E-mail do RT, usado para avisar sobre documentos pendentes de assinatura. */
  email: string;
}

export function resolveTechnicalResponsible(
  collaborators: Collaborator[],
  settingsName: string
): TechnicalResponsible | null {
  const flagged = collaborators.find((c) => c.technicalResponsible);
  if (flagged) return { collaboratorId: flagged.id, name: flagged.name, email: flagged.email || "" };
  const name = (settingsName || "").trim();
  if (!name) return null;
  const match = collaborators.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
  return { collaboratorId: match ? match.id : null, name, email: match?.email || "" };
}

/** Hook do RT da empresa, com o cadastro e a parametrização já resolvidos. */
export function useTechnicalResponsible(): TechnicalResponsible | null {
  const collaborators = useCollaboratorsList();
  const settings = useSystemSettings();
  return useMemo(
    () => resolveTechnicalResponsible(collaborators, settings.technicalResponsible),
    [collaborators, settings.technicalResponsible]
  );
}

interface SessionSignerInfo {
  /** O usuário logado é o Responsável Técnico da empresa. */
  isTechnicalResponsible: boolean;
  /** Cadastro do usuário logado (quando ele é colaborador da empresa). */
  collaboratorId: string | null;
  collaboratorName: string;
}

/** Verifica se quem está logado pode assinar como Responsável Técnico. */
export function useTechnicalSigner(): SessionSignerInfo {
  const session = useAppSession();
  const collaborators = useCollaboratorsList();
  const responsible = useTechnicalResponsible();

  return useMemo(() => {
    const me = collaborators.find(
      (c) => c.name.trim().toLowerCase() === session.name.trim().toLowerCase()
    );
    const nameMatches =
      Boolean(responsible) &&
      responsible!.name.trim().toLowerCase() === session.name.trim().toLowerCase();
    const idMatches =
      Boolean(responsible?.collaboratorId) &&
      Boolean(me) &&
      responsible!.collaboratorId === me!.id;
    return {
      isTechnicalResponsible: Boolean(responsible) && (nameMatches || idMatches),
      collaboratorId: me?.id ?? null,
      collaboratorName: me?.name ?? session.name,
    };
  }, [collaborators, responsible, session.name]);
}