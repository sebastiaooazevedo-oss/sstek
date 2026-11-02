import { createContext, useContext } from "react";
import type { RoleId } from "@/mocks/app";

/**
 * Sessão exibida na interface.
 *
 * Os valores chegam de `session_context()` (banco) — este contexto apenas
 * transporta o que já foi autorizado. Os padrões são neutros de propósito:
 * se algum componente for renderizado fora do provedor, ele não herda
 * identidade, empresa ou papel de demonstração.
 */
export interface AppSession {
  role: RoleId;
  subdomain: string;
  email: string;
  name: string;
  company: string;
}

export const AppSessionContext = createContext<AppSession>({
  role: "colaborador",
  subdomain: "",
  email: "",
  name: "",
  company: "",
});

export function useAppSession(): AppSession {
  return useContext(AppSessionContext);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}