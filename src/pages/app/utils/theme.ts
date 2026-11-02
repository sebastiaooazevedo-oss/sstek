import { useSyncExternalStore } from "react";

/**
 * Tema do sistema.
 *
 * Há três preferências possíveis:
 * - "light": sempre claro;
 * - "dark": sempre escuro;
 * - "system": segue a preferência do sistema operacional (Automático),
 *   reagindo em tempo real se o usuário mudar o tema do SO.
 *
 * O tema efetivo é aplicado pela classe `.dark` no elemento raiz, que reescreve
 * as variáveis de cor do design (ver src/index.css). A preferência fica salva
 * no navegador e, na primeira visita, assume "Automático".
 */

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

const STORAGE_KEY = "sstek_theme";
const listeners = new Set<() => void>();

function readStored(): ThemePreference | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* ignora ambientes sem localStorage */
  }
  return null;
}

const media =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function systemPrefersDark(): boolean {
  return !!media && media.matches;
}

function resolve(preference: ThemePreference): ThemeMode {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}

let preference: ThemePreference = readStored() ?? "system";
let mode: ThemeMode = resolve(preference);

function apply(next: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.style.colorScheme = next;
}

apply(mode);

function emit(): void {
  listeners.forEach((listener) => listener());
}

if (media) {
  const onSystemChange = () => {
    if (preference !== "system") return;
    mode = resolve(preference);
    apply(mode);
    emit();
  };
  if (typeof media.addEventListener === "function") media.addEventListener("change", onSystemChange);
  else if (typeof media.addListener === "function") media.addListener(onSystemChange);
}

export function getTheme(): ThemeMode {
  return mode;
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignora */
  }
  mode = resolve(next);
  apply(mode);
  emit();
}

export function setTheme(next: ThemeMode): void {
  setThemePreference(next);
}

/**
 * Alterna rapidamente pelo ciclo Claro → Escuro → Automático, usado pelo botão
 * compacto da barra superior.
 */
export function toggleTheme(): void {
  const order: ThemePreference[] = ["light", "dark", "system"];
  const index = order.indexOf(preference);
  setThemePreference(order[(index + 1) % order.length]);
}

export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeTheme, getThemePreference, getThemePreference);
}