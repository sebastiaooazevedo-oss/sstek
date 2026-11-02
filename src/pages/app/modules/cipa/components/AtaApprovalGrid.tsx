import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";
import { useAtaSignatureImages } from "@/pages/app/modules/cipa/ataSignatureImages";
import type { CipaAta } from "@/mocks/cipa";

interface AtaApprovalGridProps {
  ata: CipaAta;
}

/**
 * Aprovação da ata: mostra a assinatura eletrônica real de cada signatário
 * (presidente, secretário e responsável técnico), usando a representação
 * salva ou a assinatura registrada no perfil do colaborador.
 */
export default function AtaApprovalGrid({ ata }: AtaApprovalGridProps) {
  const images = useAtaSignatureImages(ata);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ata.approvals.map((appr) => {
        const image = appr.representationSnapshot || images[appr.id] || "";
        const signed = Boolean(image || appr.signedAt);
        return (
          <div key={appr.id} className="rounded-lg border border-background-200 bg-background-50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground-950">{appr.name}</p>
                <p className="text-[11px] text-foreground-500">{appr.role}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  signed ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
                }`}
              >
                <i className={signed ? "ri-verified-badge-line" : "ri-timer-line"}></i>
                {signed ? "Assinado" : "Pendente"}
              </span>
            </div>
            <div className="mt-3 flex min-h-[64px] items-center justify-center rounded-md border border-dashed border-background-300 bg-background-50 px-4 py-2">
              {image ? (
                <img src={image} alt={`Assinatura de ${appr.name}`} className="max-h-12 object-contain" />
              ) : (
                <span className="text-[12px] italic text-foreground-500">{appr.name}</span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-foreground-500">
              {signed
                ? `Registrado em ${formatSignatureTimestamp(appr.signedAt)}`
                : "Aguardando assinatura do responsável"}
            </p>
            {appr.signatureUid && (
              <p className="mt-0.5 break-all text-[10px] text-foreground-400">ID: {appr.signatureUid}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}