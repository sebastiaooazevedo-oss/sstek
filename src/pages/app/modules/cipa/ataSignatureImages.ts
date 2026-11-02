import { useEffect, useState } from "react";
import { defaultSignatureFontId } from "@/pages/app/signature/signatureFonts";
import { getCollaboratorSignature, preloadSignatures } from "@/pages/app/signature/signatureStore";
import { renderSignaturePng, resolveSignatureName } from "@/pages/app/signature/signatureUtils";
import type { CipaAta } from "@/mocks/cipa";

/**
 * Resolve a representação visual da assinatura de um signatário para uso nos
 * PDFs. Usa a assinatura registrada no perfil do colaborador (traço desenhado
 * ou assinatura tipográfica renderizada em PNG). Quando ainda não existe uma
 * assinatura no perfil, gera a representação tipográfica com o nome, para que
 * o documento nunca saia com o campo vazio.
 */
export async function resolveSignatureImage(
  collaboratorId: string | null | undefined,
  name: string
): Promise<string> {
  await preloadSignatures();
  const config = collaboratorId ? getCollaboratorSignature(collaboratorId) : null;

  if (config?.kind === "draw" && config.imageData) return config.imageData;

  const text = name.trim();
  if (!text) return "";
  const label = config ? resolveSignatureName(text, config.nameStyle) : text;
  return renderSignaturePng(label, config?.fontModel || defaultSignatureFontId);
}

/**
 * Cache das imagens já resolvidas por aprovação, para que a geração síncrona
 * de documentos (lote, visualização) também mostre a assinatura real.
 */
const imageCache: Record<string, string> = {};

/** Imagens conhecidas das aprovações da ata (snapshot salvo ou cache). */
export function cachedAtaSignatureImages(ata: CipaAta): Record<string, string> {
  return ata.approvals.reduce<Record<string, string>>((acc, approval) => {
    const image = approval.representationSnapshot || imageCache[approval.id];
    if (image) acc[approval.id] = image;
    return acc;
  }, {});
}

/**
 * Pré-carrega, por aprovação, a imagem de assinatura usada no PDF da ata.
 * Aprovações já com representação salva são reaproveitadas sem novo render.
 */
export async function ataApprovalSignatureImages(ata: CipaAta): Promise<Record<string, string>> {
  const entries = await Promise.all(
    ata.approvals.map(async (approval) => {
      if (approval.representationSnapshot) return [approval.id, approval.representationSnapshot] as const;
      const image = await resolveSignatureImage(approval.collaboratorId, approval.name);
      return [approval.id, image] as const;
    })
  );
  return entries.reduce<Record<string, string>>((acc, [id, image]) => {
    if (image) {
      imageCache[id] = image;
      acc[id] = image;
    }
    return acc;
  }, {});
}

/**
 * Hook de apoio à tela: devolve a assinatura de cada aprovação da ata, com
 * fallback para a assinatura do perfil quando o snapshot ainda não foi salvo.
 */
export function useAtaSignatureImages(ata: CipaAta): Record<string, string> {
  const [images, setImages] = useState<Record<string, string>>(() => cachedAtaSignatureImages(ata));

  useEffect(() => {
    let active = true;
    void ataApprovalSignatureImages(ata).then((next) => {
      if (active) setImages(next);
    });
    return () => {
      active = false;
    };
  }, [ata]);

  return images;
}