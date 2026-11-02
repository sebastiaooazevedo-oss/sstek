import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import EpiReplacementModal, {
  type EpiReplacementEquipment,
  type EpiReplacementInitial,
} from "@/pages/app/modules/epi/components/EpiReplacementModal";
import {
  useEpiReplacementRequests,
  type EpiReplacementStatus,
} from "@/pages/app/modules/epi/replacementStore";
import {
  formatDeadlineMoment,
  replacementDeadline,
} from "@/pages/app/modules/epi/replacementSla";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";

interface EpiMyReplacementsPanelProps {
  collaboratorId: string;
  collaboratorName: string;
  items: EpiReplacementEquipment[];
  /** Disparado por um botão "Solicitar troca" fora do painel. */
  requestItem?: EpiReplacementEquipment | null;
  requestSignal?: number;
  className?: string;
}

const statusStyles: Record<EpiReplacementStatus, string> = {
  Pendente: "bg-accent-100 text-accent-800",
  "Em andamento": "bg-secondary-200 text-secondary-900",
  Concluída: "bg-primary-100 text-primary-700",
  Recusada: "bg-background-200 text-foreground-700",
};

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

/**
 * Área do colaborador para pedir a troca de um EPI.
 *
 * Ele escolhe o equipamento, informa o motivo (inclusive perda, com registro
 * obrigatório) e anexa a foto. O pedido aparece aqui com a situação e chega
 * para o administrador/SESMT no painel de gestão.
 */
export default function EpiMyReplacementsPanel({
  collaboratorId,
  collaboratorName,
  items,
  requestItem,
  requestSignal = 0,
  className = "",
}: EpiMyReplacementsPanelProps) {
  const requests = useEpiReplacementRequests();
  const { replacementSlaHours } = useSystemSettings();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<EpiReplacementInitial | undefined>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!requestSignal) return;
    setInitial(
      requestItem
        ? {
            collaboratorId,
            collaboratorName,
            epiName: requestItem.name,
            ca: requestItem.ca,
            validity: requestItem.validity,
          }
        : { collaboratorId, collaboratorName }
    );
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSignal]);

  const mine = useMemo(
    () =>
      requests.filter(
        (request) =>
          (collaboratorId && request.collaboratorId === collaboratorId) ||
          (collaboratorName && request.collaboratorName === collaboratorName)
      ),
    [requests, collaboratorId, collaboratorName]
  );

  const pending = mine.filter((request) => request.status === "Pendente" || request.status === "Em andamento");
  const sorted = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const openRequest = () => {
    setInitial({ collaboratorId, collaboratorName });
    setOpen(true);
  };

  return (
    <>
      <SectionCard
        title="Solicitações de troca de EPI"
        subtitle="Precisa substituir um equipamento? Registre o motivo e a foto — o SESMT é avisado na hora."
        className={className}
        action={
          <button
            type="button"
            onClick={openRequest}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-loop-left-line"></i>
            Solicitar troca
          </button>
        }
      >
        {notice && (
          <div className="mb-4 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs text-primary-800">
            <i className="ri-checkbox-circle-line mt-0.5 text-sm"></i>
            <span className="flex-1">{notice}</span>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setNotice("")}
              className="flex h-5 w-5 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-4 flex flex-col gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3.5 py-2.5 sm:flex-row sm:items-center">
            <span className="flex items-center gap-2 text-xs font-semibold text-accent-900">
              <i className="ri-timer-line"></i>
              {pending.length} pedido(s) em atendimento pelo SESMT
            </span>
            <span className="text-[11px] text-foreground-600 sm:ml-auto">
              Você pode continuar usando o equipamento até a troca, se ele estiver em condições seguras.
            </span>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
              <i className="ri-loop-left-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhuma solicitação registrada</p>
            <p className="text-xs text-foreground-500">
              Se um EPI estiver danificado, desgastado ou perdido, abra um pedido de troca com foto.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sorted.slice(0, 6).map((request) => {
              const deadline = replacementDeadline(request.createdAt, request.reason, replacementSlaHours);
              const isOpen = request.status === "Pendente" || request.status === "Em andamento";
              return (
              <li
                key={request.id}
                className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-3.5 sm:flex-row sm:items-center"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-50">
                  {request.photo ? (
                    <img
                      src={request.photo}
                      alt={`Foto do EPI ${request.epiName}`}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-foreground-400">
                      <i className="ri-image-line"></i>
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{request.epiName}</p>
                  <p className="truncate text-xs text-foreground-500">
                    CA {request.ca || "—"} · Motivo: {request.reason} · {formatDate(request.createdAt)}
                  </p>
                  {request.lossDetail && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-accent-800">{request.lossDetail}</p>
                  )}
                  {isOpen && deadline && (
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        deadline.overdue ? "text-accent-700" : "text-foreground-500"
                      }`}
                    >
                      <i className="ri-time-line mr-1"></i>
                      {deadline.overdue ? "Prazo de atendimento vencido" : "Previsão de atendimento"} até{" "}
                      {formatDeadlineMoment(deadline.dueAt)}
                    </p>
                  )}
                </div>
                {request.returnPhoto && (
                  <div className="flex shrink-0 items-center gap-2 rounded-md border border-background-200 bg-background-50 px-2 py-1.5">
                    <div className="h-10 w-10 overflow-hidden rounded bg-background-100">
                      <img
                        src={request.returnPhoto}
                        alt="EPI antigo devolvido"
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <span className="text-[11px] font-medium leading-tight text-foreground-600">
                      EPI antigo
                      <br />
                      devolvido
                    </span>
                  </div>
                )}
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[request.status]}`}
                >
                  <i
                    className={
                      request.status === "Concluída"
                        ? "ri-checkbox-circle-line"
                        : request.status === "Pendente"
                          ? "ri-timer-line"
                          : "ri-loader-4-line"
                    }
                  ></i>
                  {request.status}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <EpiReplacementModal
        open={open}
        onClose={() => setOpen(false)}
        initial={initial || { collaboratorId, collaboratorName }}
        equipmentOptions={items}
        selfService
        onCreated={setNotice}
      />
    </>
  );
}