import { useCallback, useRef, useState, type ReactElement } from "react";
import TechnicalSignatureModal, {
  type TechnicalSignatureRequest,
} from "@/pages/app/modules/cipa/components/TechnicalSignatureModal";
import {
  useTechnicalSignatures,
  type TechnicalSignatureScope,
} from "@/pages/app/modules/cipa/technicalSignatureStore";
import { useTechnicalResponsible, useTechnicalSigner } from "@/pages/app/modules/cipa/technicalResponsible";
import { notifyTechnicalSignaturePending } from "@/pages/app/modules/cipa/technicalSignatureNotify";
import { useAppSession } from "@/pages/app/context";
import { getSettings } from "@/pages/app/settings/settingsStore";

/**
 * Resultado do bloqueio de emissão de um documento técnico:
 * - signed: documento já assinado pelo RT (ou o próprio RT assinou agora);
 * - cancelled: o RT abriu a assinatura e desistiu;
 * - waiting: quem está exportando não é o RT — falta a assinatura dele;
 * - waiting-notified: idem, e o RT acabou de ser avisado por e-mail;
 * - no-responsible: a empresa não tem RT definido.
 */
export type TechnicalSignatureGateResult =
  | "signed"
  | "cancelled"
  | "waiting"
  | "waiting-notified"
  | "no-responsible";

export function technicalSignatureBlockedMessage(
  result: TechnicalSignatureGateResult,
  responsibleName?: string | null
): string {
  if (result === "no-responsible") {
    return "Defina o Responsável Técnico no cadastro de colaboradores (ou em Configurações › Dados da empresa) antes de emitir este documento.";
  }
  if (result === "waiting" || result === "waiting-notified") {
    const base = `A emissão definitiva está bloqueada até a assinatura eletrônica do Responsável Técnico${
      responsibleName ? ` (${responsibleName})` : ""
    }. Ele recebe a pendência no painel dele.`;
    return result === "waiting-notified"
      ? `${base} Também enviamos um aviso por e-mail para ele agora.`
      : base;
  }
  if (result === "cancelled") return "Emissão cancelada: o documento ainda não foi assinado pelo Responsável Técnico.";
  return "";
}

type GateRequest = TechnicalSignatureRequest;

/**
 * Porteiro da emissão definitiva de documentos técnicos da CIPA.
 *
 * Uso na tela:
 *   const gate = useTechnicalSignatureGate();
 *   const result = await gate.guard("ficha-cipa", cipa.id, `Ficha da CIPA — ${cipa.name}`);
 *   if (result !== "signed") { aviso(technicalSignatureBlockedMessage(result, gate.responsible?.name)); return; }
 *   printHtml(...);
 *   ...
 *   {gate.modal}
 */
export function useTechnicalSignatureGate() {
  const signatures = useTechnicalSignatures();
  const responsible = useTechnicalResponsible();
  const signer = useTechnicalSigner();
  const session = useAppSession();
  const [request, setRequest] = useState<GateRequest | null>(null);
  const resolver = useRef<((signed: boolean) => void) | null>(null);

  const has = useCallback(
    (scope: TechnicalSignatureScope, referenceRef: string) =>
      signatures.some((signature) => signature.scope === scope && signature.referenceRef === referenceRef),
    [signatures]
  );

  const guard = useCallback(
    async (
      scope: TechnicalSignatureScope,
      referenceRef: string,
      label: string,
      description?: string
    ): Promise<TechnicalSignatureGateResult> => {
      if (has(scope, referenceRef)) return "signed";
      if (!responsible) return "no-responsible";
      if (!signer.isTechnicalResponsible) {
        // A emissão foi solicitada e continua pendente: avisa o RT por e-mail
        // (uma vez por documento por sessão).
        const settings = getSettings();
        const notified = await notifyTechnicalSignaturePending({
          scope,
          referenceRef,
          documentLabel: label,
          documentDescription: description,
          responsibleName: responsible.name,
          responsibleEmail: responsible.email,
          requestedBy: session.name,
          companyName: settings.companyLegalName || "Sua empresa",
        });
        return notified ? "waiting-notified" : "waiting";
      }
      return new Promise<TechnicalSignatureGateResult>((resolve) => {
        resolver.current = (signed) => resolve(signed ? "signed" : "cancelled");
        setRequest({ scope, referenceRef, label, description });
      });
    },
    [has, responsible, signer.isTechnicalResponsible, session.name]
  );

  const close = (signed: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(signed);
  };

  const modal: ReactElement = (
    <TechnicalSignatureModal request={request} responsible={responsible} onClose={close} />
  );

  return {
    guard,
    has,
    modal,
    responsible,
    isSigner: signer.isTechnicalResponsible,
  };
}