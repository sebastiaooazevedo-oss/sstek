import AuthenticitySeal from "@/components/feature/AuthenticitySeal";
import type { SealDisplay } from "@/pages/app/signature/authenticitySeal";

interface SealPreviewProps {
  seal: SealDisplay | null;
  loading: boolean;
  /** Explica por que a chancela ainda não pode ser emitida (documento sem assinatura). */
  blockedReason?: string;
  /** Documento cancelado: a chancela continua no histórico, mas não vale mais. */
  revoked?: boolean;
  /** Complemento do aviso de revogação (ex.: data e motivo do cancelamento). */
  revokedNote?: string;
  className?: string;
}

/**
 * Prévia visual do bloco de chancela (QR + código + hash) que será impresso no
 * rodapé do PDF. Mostra exatamente o mesmo componente usado nos documentos.
 */
export default function SealPreview({
  seal,
  loading,
  blockedReason,
  revoked = false,
  revokedNote,
  className = "",
}: SealPreviewProps) {
  return (
    <section
      className={`rounded-lg border ${
        revoked ? "border-accent-300 bg-accent-50/60" : "border-background-200 bg-background-100"
      } p-4 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md ${
              revoked ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
            }`}
          >
            <i className={`${revoked ? "ri-forbid-2-line" : "ri-shield-check-line"} text-sm`}></i>
          </span>
          <h4 className="font-heading text-sm font-bold text-foreground-950">Prévia da chancela de autenticidade</h4>
        </div>
        <span
          className={`text-[11px] font-semibold ${revoked ? "text-accent-800" : "text-foreground-500"}`}
        >
          {revoked ? "Chancela revogada — não vale mais" : "Bloco impresso no rodapé do PDF"}
        </span>
      </div>

      {revoked && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-accent-300 bg-accent-100 px-4 py-3 text-xs leading-relaxed text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base text-accent-800"></i>
          <div>
            <p className="font-bold">Documento cancelado: esta chancela não tem mais validade.</p>
            <p className="mt-1">
              O código e o QR-Code abaixo foram emitidos antes do cancelamento e permanecem apenas como registro
              histórico do que existia naquele momento. Eles <strong className="font-semibold">não comprovam</strong>{" "}
              mais o documento: a conferência pública passa a responder que ele não está vigente.
            </p>
            {revokedNote && <p className="mt-1 font-medium">{revokedNote}</p>}
          </div>
        </div>
      )}

      <div className="mt-3">
        {loading && (
          <div className="animate-pulse rounded-lg border-2 border-primary-500/30 bg-background-50 px-4 py-3.5">
            <div className="flex items-stretch gap-3">
              <div className="h-24 w-24 shrink-0 rounded bg-background-200"></div>
              <div className="min-w-0 flex-1 border-l border-dashed border-background-300 pl-3.5">
                <div className="h-2.5 w-40 rounded bg-background-200"></div>
                <div className="mt-2 h-3 w-56 rounded bg-background-200"></div>
                <div className="mt-2 h-2 w-32 rounded bg-background-200"></div>
                <div className="mt-3 h-2 w-full max-w-sm rounded bg-background-200"></div>
                <div className="mt-1.5 h-2 w-3/4 max-w-xs rounded bg-background-200"></div>
              </div>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground-500">
              <i className="ri-loader-4-line animate-spin text-sm"></i>
              Registrando a chancela no servidor…
            </p>
          </div>
        )}

        {!loading && seal && (
          <div className="relative">
            <div className={revoked ? "pointer-events-none opacity-45 grayscale" : ""}>
              <AuthenticitySeal seal={seal} />
            </div>
            {revoked && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="-rotate-6 rounded-md border-2 border-accent-600 bg-background-50/95 px-3.5 py-1.5 font-heading text-sm font-extrabold uppercase tracking-[0.2em] text-accent-700">
                  Sem validade
                </span>
              </div>
            )}
          </div>
        )}

        {!loading && !seal && blockedReason && (
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-4 py-3 text-xs leading-relaxed text-foreground-600">
            <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
            <span>{blockedReason}</span>
          </div>
        )}

        {!loading && !seal && !blockedReason && (
          <div className="flex items-start gap-2.5 rounded-lg border border-accent-200 bg-accent-100/70 px-4 py-3 text-xs leading-relaxed text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base text-accent-800"></i>
            <span>
              Não foi possível registrar a chancela agora. O PDF ainda pode ser exportado, mas sairá sem o bloco de
              autenticidade — tente novamente em instantes.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}