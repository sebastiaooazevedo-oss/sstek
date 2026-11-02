import { supabase } from "@/lib/supabase";
import type { TechnicalSignatureScope } from "@/pages/app/modules/cipa/technicalSignatureStore";

/**
 * Aviso por e-mail ao Responsável Técnico quando a emissão de um documento
 * técnico é solicitada e ele ainda está pendente de assinatura.
 *
 * O envio acontece em uma Edge Function (`notify-technical-signature`) para que
 * a chave do Resend nunca chegue ao navegador. Cada documento é avisado uma vez
 * por sessão, para não encher a caixa de entrada do RT.
 */

const notifiedKeys = new Set<string>();

export interface TechnicalSignatureNotifyInput {
  scope: TechnicalSignatureScope;
  referenceRef: string;
  documentLabel: string;
  documentDescription?: string;
  responsibleName: string;
  responsibleEmail: string;
  requestedBy: string;
  companyName: string;
}

export async function notifyTechnicalSignaturePending(
  input: TechnicalSignatureNotifyInput
): Promise<boolean> {
  const key = `${input.scope}:${input.referenceRef}`;
  if (!input.responsibleEmail || notifiedKeys.has(key)) return false;
  notifiedKeys.add(key);
  try {
    const { data, error } = await supabase.functions.invoke("notify-technical-signature", {
      body: {
        to: input.responsibleEmail,
        responsibleName: input.responsibleName,
        documentLabel: input.documentLabel,
        documentDescription: input.documentDescription || "",
        requestedBy: input.requestedBy,
        companyName: input.companyName,
      },
    });
    if (error) throw error;
    if (!data || data.sent !== true) {
      notifiedKeys.delete(key);
      return false;
    }
    return true;
  } catch {
    notifiedKeys.delete(key);
    return false;
  }
}