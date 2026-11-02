import { todayBr } from "@/pages/app/utils/exportPdf";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";

interface SignatureFooterProps {
  className?: string;
}

/**
 * Bloco de assinatura do responsável técnico + rodapé institucional.
 * É a versão em tela do mesmo rodapé gerado nos PDFs (`pdfFooter`),
 * para ser reutilizado em documentos e comprovantes impressos.
 */
export default function SignatureFooter({ className = "" }: SignatureFooterProps) {
  const settings = useSystemSettings();
  const responsible = settings.technicalResponsible.trim();
  const registration = settings.technicalRegistration.trim();
  const signLabel = responsible
    ? `${responsible}${registration ? ` · ${registration}` : ""}`
    : "Responsável Técnico de Segurança do Trabalho";

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-2">
        <div className="h-10 border-b border-foreground-400"></div>
        <span className="mt-2 block text-center text-[11px] font-medium text-foreground-500">{signLabel}</span>
        <span className="block text-center text-[10px] text-foreground-400">
          Assinatura eletrônica do responsável técnico
        </span>
      </div>
      <div className="flex flex-col gap-1 border-t border-background-300 pt-3 text-[11px] text-foreground-500 sm:flex-row sm:items-center sm:justify-between">
        <span>SSTEK · Gestão Inteligente em Segurança do Trabalho</span>
        <span>Emitido em {todayBr()}</span>
      </div>
    </div>
  );
}