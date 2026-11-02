import SealPreview from "@/components/feature/SealPreview";
import type { AttendanceSheet } from "@/pages/app/modules/documentos/attendanceStore";
import { attendanceHasSignature } from "@/pages/app/modules/documentos/attendanceSeal";
import type { DocumentSeal } from "@/pages/app/signature/authenticitySeal";

interface AttendanceSealSectionProps {
  sheet: AttendanceSheet;
  seal: DocumentSeal | null;
  loading: boolean;
  error: boolean;
  onGenerate: () => void;
  className?: string;
}

/**
 * Prévia da chancela da Ficha de Presença. Diferente dos documentos já
 * gravados, a ficha é preenchida em tela — por isso o selo é emitido sob
 * demanda (nunca a cada tecla digitada), evitando registros de rascunho.
 */
export default function AttendanceSealSection({
  sheet,
  seal,
  loading,
  error,
  onGenerate,
  className = "",
}: AttendanceSealSectionProps) {
  const hasSignature = attendanceHasSignature(sheet);
  const canPreview = hasSignature && sheet.title.trim().length > 2;

  const blockedReason = !hasSignature
    ? "A chancela da ficha é emitida quando ao menos um participante (ou o facilitador) tem assinatura coletada. Sem assinatura não há o que chancelar."
    : seal || error || loading
      ? undefined
      : "Preencha o título da atividade e toque em “Gerar prévia da chancela” para ver o bloco que sairá no rodapé do PDF.";

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-foreground-500">
          O selo é registrado no servidor no momento da prévia e reaproveitado ao exportar, sem duplicar chancelas.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canPreview || loading}
          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className={loading ? "ri-loader-4-line animate-spin" : "ri-shield-check-line"}></i>
          {seal ? "Atualizar prévia" : "Gerar prévia da chancela"}
        </button>
      </div>

      <SealPreview seal={seal} loading={loading} blockedReason={blockedReason} />
    </div>
  );
}