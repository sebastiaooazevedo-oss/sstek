import SealPreview from "@/components/feature/SealPreview";
import { ataSeal } from "@/pages/app/modules/cipa/ataPdf";
import { useDocumentSeal } from "@/pages/app/signature/useDocumentSeal";
import type { CipaAta } from "@/mocks/cipa";

interface AtaSealPreviewProps {
  ata: CipaAta;
  cipaName: string;
}

/** Prévia do bloco de chancela da ata, montada a partir das aprovações assinadas. */
export default function AtaSealPreview({ ata, cipaName }: AtaSealPreviewProps) {
  const signed = ata.approvals.filter((a) => Boolean(a.representationSnapshot || a.signedAt));
  const stamp = signed.map((a) => a.signedAt || "manual").join("|");
  const { seal, loading } = useDocumentSeal({
    key: `${ata.id}:${signed.length}:${stamp}`,
    ready: signed.length > 0,
    load: () => ataSeal(ata, cipaName || "—"),
  });

  return (
    <SealPreview
      seal={seal}
      loading={loading}
      blockedReason={
        signed.length > 0
          ? undefined
          : "A chancela é emitida automaticamente quando presidente e/ou secretário assinam a aprovação da ata."
      }
    />
  );
}