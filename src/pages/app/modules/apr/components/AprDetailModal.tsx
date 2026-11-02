import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { printHtml } from "@/pages/app/utils/exportPdf";
import type { AprRecord } from "@/mocks/apr";
import { aprSeal, aprSealHtml, buildAprBody, riskLevel } from "@/pages/app/modules/apr/aprUtils";
import SealPreview from "@/components/feature/SealPreview";
import { sealPrintHtml } from "@/pages/app/signature/authenticitySeal";
import { useDocumentSeal } from "@/pages/app/signature/useDocumentSeal";

interface AprDetailModalProps {
  record: AprRecord | null;
  onClose: () => void;
}

const levelTone: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-800",
  accent: "bg-accent-100 text-accent-800",
};

export default function AprDetailModal({ record, onClose }: AprDetailModalProps) {
  const sealReady = Boolean(record?.signatures.some((s) => Boolean(s.signature)));
  const { seal, loading: sealLoading } = useDocumentSeal({
    key: record ? `${record.id}:${sealReady ? "signed" : "pending"}` : "",
    ready: sealReady,
    load: () => (record ? aprSeal(record) : Promise.resolve(null)),
  });

  if (!record) return null;

  const signed = record.signatures.filter((s) => s.signature).length;

  const handleExport = async () => {
    const sealHtml = seal ? sealPrintHtml(seal) : await aprSealHtml(record);
    printHtml(`APR — ${record.title}`, buildAprBody(record, sealHtml));
  };

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title="Análise Preliminar de Risco"
      subtitle={`${record.title} · ${record.date}`}
      icon="ri-clipboard-line"
      size="xl"
      footer={
        <>
          <span
            className={`mr-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
              record.status === "Concluída" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
            }`}
          >
            <i className={record.status === "Concluída" ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
            {record.status === "Concluída" ? "Aceite concluído" : "Aceite pendente"}
          </span>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
          <ModalButton onClick={() => void handleExport()} icon="ri-file-pdf-2-line">
            Exportar PDF
          </ModalButton>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 bg-background-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
            {record.activity}
          </span>
          <span className="rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
            {record.area}
          </span>
          {record.origin === "colaborador" && (
            <span className="rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
              Enviada pelo colaborador
            </span>
          )}
        </div>
        <h4 className="mt-3 font-heading text-base font-bold text-foreground-950">{record.title}</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Nº da solicitação</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-900">{record.requestNumber || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Local</p>
            <p className="mt-0.5 text-sm text-foreground-800">{record.location}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Data</p>
            <p className="mt-0.5 text-sm text-foreground-800">{record.date}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Responsável</p>
            <p className="mt-0.5 text-sm text-foreground-800">{record.responsible}</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="font-heading text-sm font-bold text-foreground-950">
          Riscos identificados e medidas de controle
        </h4>
        <div className="mt-3 overflow-x-auto rounded-lg border border-background-200">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 bg-background-100 text-left">
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Perigo</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Risco</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-foreground-400">Sev.</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-foreground-400">Prob.</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Nível</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Medidas de controle</th>
              </tr>
            </thead>
            <tbody>
              {record.risks.map((risk) => {
                const level = riskLevel(risk.severity, risk.probability);
                return (
                  <tr key={risk.id} className="border-b border-background-100 last:border-0">
                    <td className="px-4 py-3 text-sm text-foreground-700">{risk.hazard}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground-900">{risk.risk}</td>
                    <td className="px-4 py-3 text-center text-sm text-foreground-600">{risk.severity}</td>
                    <td className="px-4 py-3 text-center text-sm text-foreground-600">{risk.probability}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${levelTone[level.tone]}`}>
                        {level.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground-600">{risk.control || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {record.notes && (
        <div className="mt-5 rounded-lg border border-background-200 bg-background-100 p-4">
          <h4 className="text-sm font-bold text-foreground-950">Observações</h4>
          <p className="mt-2 text-sm leading-relaxed text-foreground-600">{record.notes}</p>
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-heading text-sm font-bold text-foreground-950">Aceite dos executantes</h4>
          <span className="text-[11px] font-medium text-foreground-500">
            {signed} de {record.signatures.length} assinatura(s)
          </span>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {record.signatures.map((sign) => (
            <li
              key={sign.collaboratorId}
              className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-900">{sign.collaboratorName}</p>
                <p className="truncate text-xs text-foreground-500">{sign.collaboratorRole || "—"}</p>
              </div>
              {sign.signature ? (
                <div className="flex items-center gap-3">
                  <img src={sign.signature} alt={`Assinatura de ${sign.collaboratorName}`} className="h-10" />
                  <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-primary-700 sm:flex">
                    <i className="ri-verified-badge-line"></i>
                    Assinado
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-800">
                  <i className="ri-timer-line"></i>
                  Assinatura pendente
                </span>
              )}
            </li>
          ))}
          {record.signatures.length === 0 && (
            <li className="rounded-lg border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
              Nenhum executante vinculado a esta APR.
            </li>
          )}
        </ul>
      </div>

      <SealPreview
        className="mt-5"
        seal={seal}
        loading={sealLoading}
        blockedReason={
          sealReady
            ? undefined
            : "A chancela é emitida automaticamente quando os executantes assinam o aceite da APR. Sem assinatura não há o que chancelar."
        }
      />
    </Modal>
  );
}