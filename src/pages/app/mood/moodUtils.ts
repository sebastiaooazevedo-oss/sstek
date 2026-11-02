import type { AppSession } from "@/pages/app/context";
import { getCollaboratorStoreState } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { collaborators } from "@/mocks/collaborators";

/**
 * Quem é o autor do registro de sentimento.
 * Um colaborador é identificado pelo seu id na base (e carrega o gestor
 * responsável designado no cadastro). Admin/Super não são colaboradores:
 * identificamos pelo e-mail e marcamos como gestores (visão de supervisão).
 */
export interface MoodActor {
  userKey: string;
  userName: string;
  role: string;
  company: string;
  area: string;
  establishment: string;
  collaboratorId: string | null;
  managerKey: string | null;
  managerName: string | null;
  isManager: boolean;
}

/** Unidade (estabelecimento) do colaborador no cadastro real. */
function establishmentOf(session: AppSession, name: string): string {
  const list = getCollaboratorStoreState().collaborators;
  const byEmail = session.email
    ? list.find((c) => c.email && c.email.toLowerCase() === session.email.toLowerCase())
    : undefined;
  const found = byEmail || list.find((c) => c.name === name);
  return found?.establishment ?? "";
}

export function resolveMoodActor(session: AppSession): MoodActor {
  const me =
    collaborators.find((c) => c.name === session.name) ||
    collaborators.find((c) => c.email === session.email);
  const establishment = establishmentOf(session, session.name);

  if (me) {
    const manager = me.managerId ? collaborators.find((c) => c.id === me.managerId) : undefined;
    const managesOthers = collaborators.some((c) => c.managerId === me.id);
    return {
      userKey: me.id,
      userName: me.name,
      role: session.role,
      company: session.company,
      area: me.area,
      establishment: establishment || me.establishment || "",
      collaboratorId: me.id,
      managerKey: manager?.id ?? null,
      managerName: manager?.name ?? null,
      isManager: session.role === "admin" || session.role === "super" || managesOthers,
    };
  }

  return {
    userKey: session.email,
    userName: session.name,
    role: session.role,
    company: session.company,
    area: "",
    establishment,
    collaboratorId: null,
    managerKey: null,
    managerName: null,
    isManager: session.role === "admin" || session.role === "super",
  };
}

/** Data local de hoje no formato "YYYY-MM-DD". */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" (formato usado pelos filtros de período). */
export function isoToBr(iso: string): string {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Data no formato amigável: "Hoje", "Ontem" ou "DD/MM/YYYY". */
export function friendlyMoodDate(iso: string): string {
  if (iso === todayIso()) return "Hoje";
  const base = new Date(`${iso}T00:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");
  if (iso === `${y}-${m}-${d}`) return "Ontem";
  if (Number.isNaN(base.getTime())) return isoToBr(iso);
  return base.toLocaleDateString("pt-BR");
}

/** Horário (HH:mm) do registro. */
export function moodTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}