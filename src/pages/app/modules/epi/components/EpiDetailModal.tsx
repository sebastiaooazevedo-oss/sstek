import { useRef, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { getInitials, useAppSession } from "@/pages/app/context";
import QrCode, { brandQrDataUrl, fiscalizacaoUrl } from "@/pages/app/modules/qrcodes/components/QrCode";
import type { EpiDelivery } from "@/mocks/epi";
import { buildEpiAcceptanceBody, epiSeal, epiSealHtml } from "@/pages/app/modules/epi/epiUtils";
import ConsultaCaModal from "@/pages/app/modules/epi/components/ConsultaCaModal";
import SealPreview from "@/components/feature/SealPreview";
import { sealPrintHtml } from "@/pages/app/signature/authenticitySeal";
import { useDocumentSeal } from "@/pages/app/signature/useDocumentSeal";

interface EpiDetailModalProps {
  delivery: EpiDelivery | null;
  onClose: () => void;
}

function buildQrBody(name: string, role: string, url: string, qrImage: string): string {
  return `${pdfHeader("QR-Code de fiscalização")}
    <h1>QR-Code de fiscalização do colaborador</h1>
    <p class="muted">
      Aponte a câmera do celular para o código abaixo para abrir a página pública de fiscalização
      com o resumo do cadastro, treinamentos e ficha de EPI deste colaborador.
    </p>
    <div class="grid">
      <div><strong>Colaborador:</strong> ${escapeHtml(name)}</div>
      <div><strong>Função:</strong> ${escapeHtml(role) || "—"}</div>
    </div>
    <div style="text-align:center;margin-top:20px;">
      <img src="${qrImage}" alt="QR-Code de ${escapeHtml(name)}" style="width:3cm;height:3cm;" />
    </div>
    <p class="muted" style="text-align:center;margin-top:8px;">${escapeHtml(url)}</p>
    ${pdfFooter()}`;
}

export default function EpiDetailModal({ delivery, onClose }: EpiDetailModalProps) {
  const session = useAppSession();
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [consultCa, setConsultCa] = useState<string | null>(null);

  const sealReady = Boolean(delivery?.signature);
  const { seal, loading: sealLoading } = useDocumentSeal({
    key: delivery ? `${delivery.id}:${sealReady ? "signed" : "pending"}` : "",
    ready: sealReady,
    load: () => (delivery ? epiSeal(delivery) : Promise.resolve(null)),
  });

  if (!delivery) return null;

  const totalItems = delivery.items.reduce((sum, item) => sum + item.quantity, 0);
  const qrUrl = fiscalizacaoUrl(session.subdomain, delivery.collaboratorId);

  const handleExport = async () => {
    const sealHtml = seal ? sealPrintHtml(seal) : await epiSealHtml(delivery);
    printHtml(`Ficha de EPI — ${delivery.collaboratorName}`, buildEpiAcceptanceBody(delivery, sealHtml));
  };

  const handlePrintQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    const qrImage = canvas ? brandQrDataUrl(canvas) : "";
    if (!qrImage) return;
    printHtml(
      `QR-Code — ${delivery.collaboratorName}`,
      buildQrBody(delivery.collaboratorName, delivery.collaboratorRole, qrUrl, qrImage)
    );
  };

  return (
    <Modal
      open={!!delivery}
      onClose={onClose}
      title="Ficha de EPI"
      subtitle={`${delivery.collaboratorName} · ${delivery.date}`}
      icon="ri-shirt-line"
      size="xl"
      footer={
        <>
          <span
            className={`mr-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
              delivery.status === "Assinada" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
            }`}
          >
            <i className={delivery.status === "Assinada" ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
            {delivery.status === "Assinada" ? "Aceite assinado" : "Aceite pendente"}
          </span>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
          <ModalButton variant="ghost" onClick={handlePrintQr} icon="ri-qr-code-line">
            Imprimir QR-Code
          </ModalButton>
          <ModalButton onClick={() => void handleExport()} icon="ri-file-pdf-2-line">
            Exportar PDF
          </ModalButton>
        </>
      }
    >
      <div className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-sm font-bold text-secondary-900">
          {getInitials(delivery.collaboratorName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground-950">{delivery.collaboratorName}</p>
          <p className="truncate text-xs text-foreground-500">
            {delivery.collaboratorRole || "—"} · {delivery.area || "—"}
          </p>
        </div>
        <span className="ml-auto whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
          {delivery.reason}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-background-200 bg-background-50 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Data da entrega</p>
          <p className="mt-1 text-sm font-semibold text-foreground-900">{delivery.date}</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-50 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Itens entregues</p>
          <p className="mt-1 text-sm font-semibold text-foreground-900">{delivery.items.length} tipo(s)</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-50 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Quantidade total</p>
          <p className="mt-1 text-sm font-semibold text-foreground-900">{totalItems} unidade(s)</p>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="font-heading text-sm font-bold text-foreground-950">Equipamentos entregues</h4>
        <div className="mt-3 overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 bg-background-100 text-left">
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">EPI</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">CA</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Qtde</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Consultar</th>
              </tr>
            </thead>
            <tbody>
              {delivery.items.map((item, index) => (
                <tr key={`${item.ca}-${index}`} className="border-b border-background-100 last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-foreground-600">{item.ca}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-foreground-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setConsultCa(item.ca)}
                      aria-label={`Consultar CA ${item.ca}`}
                      title="Consultar CA"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200 hover:text-primary-700"
                    >
                      <i className="ri-search-eye-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {delivery.photo && (
        <div className="mt-5">
          <h4 className="font-heading text-sm font-bold text-foreground-950">Foto da entrega</h4>
          <div className="mt-3 h-56 w-full max-w-sm overflow-hidden rounded-lg border border-background-200 bg-background-100">
            <img
              src={delivery.photo}
              alt={`Foto da entrega de EPI de ${delivery.collaboratorName}`}
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>
      )}

      {delivery.notes && (
        <div className="mt-5 rounded-lg border border-background-200 bg-background-100 p-4">
          <h4 className="text-sm font-bold text-foreground-950">Observações</h4>
          <p className="mt-2 text-sm leading-relaxed text-foreground-600">{delivery.notes}</p>
        </div>
      )}

      <div className="mt-5">
        <h4 className="font-heading text-sm font-bold text-foreground-950">Aceite do colaborador</h4>
        {delivery.signature ? (
          <div className="mt-3 flex items-center gap-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
            <img src={delivery.signature} alt={`Assinatura de ${delivery.collaboratorName}`} className="h-12" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700">
              <i className="ri-verified-badge-line"></i>
              Assinatura coletada em {delivery.date}
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-accent-200 bg-accent-100/70 px-4 py-3">
            <i className="ri-timer-line text-lg text-accent-800"></i>
            <span className="text-xs font-semibold text-accent-900">
              Aceite eletrônico pendente de assinatura do colaborador.
            </span>
          </div>
        )}
      </div>

      <SealPreview
        className="mt-5"
        seal={seal}
        loading={sealLoading}
        blockedReason={
          delivery.signature
            ? undefined
            : "A chancela é emitida automaticamente quando o colaborador assina o aceite. Sem assinatura não há o que chancelar."
        }
      />

      <div className="mt-5">
        <h4 className="font-heading text-sm font-bold text-foreground-950">QR-Code de fiscalização</h4>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div ref={qrRef}>
            <QrCode value={qrUrl} />
          </div>
          <div className="min-w-0">
            <p className="text-xs leading-relaxed text-foreground-600">
              Aponte a câmera do celular para abrir a página pública de fiscalização deste colaborador,
              com o resumo do cadastro, treinamentos e ficha de EPI.
            </p>
            <p className="mt-2 break-all rounded-md bg-background-100 px-3 py-2 text-[11px] font-medium text-foreground-700">
              {qrUrl}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-background-200 bg-background-100 p-4">
        <div className="mb-4 flex items-center gap-2">
          <i className="ri-pen-nib-line text-base text-primary-700"></i>
          <h3 className="text-sm font-bold text-foreground-950">Assinatura do responsável técnico</h3>
        </div>
        <SignatureFooter />
      </div>

      <ConsultaCaModal
        open={consultCa !== null}
        onClose={() => setConsultCa(null)}
        initialCa={consultCa || ""}
      />
    </Modal>
  );
}