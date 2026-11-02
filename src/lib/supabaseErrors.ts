import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase";

/**
 * Tratamento de falhas de rede na camada de autenticação.
 *
 * O Supabase pode rejeitar a promise do fetch (em vez de devolver `{ error }`)
 * quando o navegador não consegue abrir conexão — aparelho sem internet,
 * extensão/bloqueador barrando `*.supabase.co`, DNS da rede ou preview offline.
 * Aqui traduzimos isso em mensagem acionável em português.
 */

const NETWORK_HINTS = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
  "fetch failed",
  "err_name_not_resolved",
  "err_internet_disconnected",
  "err_connection",
  "timeout",
  "timed out",
  "aborterror",
  "the operation was aborted",
];

export const NETWORK_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor da plataforma. Verifique sua conexão com a internet e se algum bloqueador de anúncios ou extensão de privacidade está barrando o acesso, depois tente novamente.";

/** A mensagem recebida indica falha de rede/conexão (e não de credenciais)? */
export function isNetworkAuthError(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return NETWORK_HINTS.some((hint) => normalized.includes(hint));
}

/** Converte o texto bruto do Supabase em mensagem amigável. */
export function friendlyAuthError(message: string | null | undefined): string {
  if (!message) return "Não foi possível concluir a operação. Tente novamente.";
  if (isNetworkAuthError(message)) return NETWORK_ERROR_MESSAGE;
  if (message.toLowerCase().includes("invalid login")) return "E-mail ou senha incorretos.";
  if (message.toLowerCase().includes("email not confirmed"))
    return "É necessário confirmar o e-mail antes do primeiro acesso.";
  return message;
}

/**
 * Testa se o navegador alcança o projeto Supabase.
 * Usado como diagnóstico depois de uma falha de rede.
 */
export async function checkSupabaseReachability(timeoutMs = 8000): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: supabaseAnonKey },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}