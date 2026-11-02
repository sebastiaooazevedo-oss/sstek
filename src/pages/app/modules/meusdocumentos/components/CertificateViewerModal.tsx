import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import {
  getMedicalCertificateImage,
  type MedicalCertificate,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";

interface CertificateViewerModalProps {
  certificate: MedicalCertificate | null;
  onClose: () => void;
}

function formatDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function CertificateViewerModal({ certificate, onClose }: CertificateViewerModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!certificate) {
      setUrl(null);
      return;
    }
    let active = true;
    setLoading(true);
    setUrl(null);
    void getMedicalCertificateImage(certificate)
      .then((result) => {
        if (active) setUrl(result);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [certificate]);

  if (!certificate) return null;

  return (
    <Modal
      open={!!certificate}
      onClose={onClose}
      title="Atestado médico"
      subtitle={`${certificate.collaboratorName} · ${certificate.certificateType}`}
      icon="ri-stethoscope-line"
      size="lg"
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
            <i className="ri-lock-line"></i>
            Registro permanente · sem exclusão
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-external-link-line text-base"></i>
              Abrir imagem
            </a>
          )}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-background-200 bg-background-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Data</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground-900">{formatDate(certificate.issuedOn)}</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Afastamento</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground-900">
            {certificate.leaveDays > 0 ? `${certificate.leaveDays} dia(s)` : "Sem afastamento"}
          </p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">CID</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground-900">{certificate.cid || "—"}</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Cadastrado em</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground-900">
            {certificate.createdAt
              ? new Date(certificate.createdAt).toLocaleDateString("pt-BR")
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Versão</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground-900">
            v{certificate.revision}
            <span className="ml-1 text-[11px] font-medium text-foreground-500">
              {certificate.isCurrent ? "vigente" : "substituída"}
            </span>
          </p>
        </div>
      </div>

      {!certificate.hasFile && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2.5 text-[11px] leading-relaxed text-accent-900">
          <i className="ri-attachment-2 mt-0.5 text-sm"></i>
          <span>
            Este registro foi criado antes da confirmação obrigatória do arquivo e está <strong>sem arquivo anexado</strong>.
            Ele não é tratado como envio concluído. Registre uma nova versão com o documento para regularizar — o
            registro atual é preservado.
          </span>
        </p>
      )}

      {certificate.notes && (
        <div className="mt-4 rounded-lg border border-background-200 bg-background-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Observações</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground-700">{certificate.notes}</p>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-background-200 bg-background-100">
        {loading && (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-foreground-500">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            Carregando a imagem do atestado...
          </div>
        )}
        {!loading && url && (
          <img src={url} alt={`Atestado médico de ${certificate.collaboratorName}`} className="w-full object-top" />
        )}
        {!loading && !url && (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
              <i className="ri-file-image-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Imagem indisponível</p>
            <p className="text-xs text-foreground-500">
              O registro existe, mas não foi possível carregar a foto agora. Tente novamente em alguns instantes.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}