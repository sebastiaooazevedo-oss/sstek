import { supabase } from "@/lib/supabase";

/**
 * Ponte com o "signature-engine" (edge function). Toda a validação de regra de
 * assinatura acontece no servidor; aqui apenas enviamos a intenção e tratamos
 * o retorno. Erros de bloqueio chegam com um código estável (ex.: TERM_NOT_ACCEPTED,
 * REAUTH_REQUIRED, REPRESENTATION_NOT_ACTIVATED) para a interface reagir.
 */
export class SignatureEngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface SignatureActor {
  collaboratorRef: string;
  collaboratorName: string;
  collaboratorEmail?: string | null;
  subdomain?: string;
}

async function invokeEngine<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("signature-engine", { body });

  if (error) {
    let code = "ENGINE_ERROR";
    let message = (error as { message?: string }).message || "Falha ao comunicar com o servidor de assinatura.";
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.clone().json();
        if (parsed && parsed.error) {
          code = String(parsed.error);
          message = String(parsed.message || parsed.error);
        }
      } catch {
        /* corpo de erro não-JSON: mantém a mensagem genérica */
      }
    }
    throw new SignatureEngineError(code, message);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.error) {
    throw new SignatureEngineError(String(result.error), String(result.message || result.error));
  }
  return result as T;
}

export async function callSignatureEngine<T = Record<string, unknown>>(
  action: string,
  actor: SignatureActor,
  extra: Record<string, unknown> = {}
): Promise<T> {
  return invokeEngine<T>({
    action,
    subdomain: actor.subdomain ?? "vega",
    collaboratorRef: actor.collaboratorRef,
    collaboratorName: actor.collaboratorName,
    collaboratorEmail: actor.collaboratorEmail ?? null,
    ...extra,
  });
}

/** Chamada sem sessão (ex.: validação pública por token de documento). */
export async function callSignatureEnginePublic<T = Record<string, unknown>>(
  action: string,
  extra: Record<string, unknown> = {}
): Promise<T> {
  return invokeEngine<T>({ action, ...extra });
}