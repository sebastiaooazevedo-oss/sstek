import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { useAppSession } from "@/pages/app/context";
import type { EpiDelivery } from "@/mocks/epi";
import { addEpiDelivery } from "@/pages/app/modules/epi/epiStore";
import {
  setEpiReplacementStatus,
  useEpiReplacementRequests,
  type EpiReplacementRequest,
  type EpiReplacementStatus,
} from "@/pages/app/modules/epi/replacementStore";
import EpiDeliveryModal from "@/pages/app/modules/epi/components/EpiDeliveryModal";
import EpiReturnPhotoField from "@/pages/app/modules/epi/components/EpiReturnPhotoField";
import { getEpiReplacementRequests } from "@/pages/app/modules/epi/replacementStore";
import { attachReplacementDocuments } from "@/pages/app/modules/epi/replacementDocuments";
import {
  deadlineLabel,
  formatDeadlineMoment,
  formatSlaHours,
  replacementDeadline,
} from "@/pages/app/modules/epi/replacementSla";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";

interface EpiReplacementRequestsPanelProps {
  /** Unidade selecionada no dashboard (vazio = todas). */
  unit?: string;
}

const statusStyles: Record<EpiReplacementStatus, string> = {
  Pendente: "bg-accent-200 text-accent-900",
  "Em andamento": "bg-secondary-200 text-secondary-900",
  Concluída: "bg-primary-100 text-primary-700",
  Recusada: "bg-background-200 text-foreground-700",
};

function formatDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Painel do administrador com os pedidos de substituição de EPI.
 *
 * É o "aviso" que chega para a gestão: mostra quem pediu, qual equipamento,
 * o motivo (com o registro de perda quando houver) e a foto obrigatória.
 * O administrador pode assumir o pedido, registrar a nova entrega de EPI
 * (pré-preenchida) ou concluir o atendimento.
 */
export default function EpiReplacementRequestsPanel({ unit = "" }: EpiReplacementRequestsPanelProps) {
  const requests = useEpiReplacementRequests();
  const session = useAppSession();
  const { replacementSlaHours } = useSystemSettings();
  const [tab, setTab] = useState<"abertos" | "concluidos">("abertos");
  const [target, setTarget] = useState<EpiReplacementRequest | null>(null);
  const [preview, setPreview] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const scoped = useMemo(
    () => (unit ? requests.filter((item) => item.establishment === unit) : requests),
    [requests, unit]
  );

  const open = scoped.filter((item) => item.status === "Pendente" || item.status === "Em andamento");
  const closed = scoped.filter((item) => item.status === "Concluída" || item.status === "Recusada");

  // Prazo de atendimento calculado por motivo (parametrizado em Configurações).
  // Pedidos atrasados sobem para o topo da lista.
  const decorated = scoped.map((request) => ({
    request,
    deadline: replacementDeadline(request.createdAt, request.reason, replacementSlaHours),
  }));
  const openRows = decorated
    .filter(({ request }) => request.status === "Pendente" || request.status === "Em andamento")
    .sort((a, b) => {
      const aOverdue = a.deadline?.overdue ? 0 : 1;
      const bOverdue = b.deadline?.overdue ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aDue = a.deadline?.dueAt.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.deadline?.dueAt.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return b.request.createdAt.localeCompare(a.request.createdAt);
    });
  const closedRows = decorated.filter(
    ({ request }) => request.status === "Concluída" || request.status === "Recusada"
  );
  const visible = tab === "abertos" ? openRows : closedRows;
  const overdueCount = openRows.filter(({ deadline }) => deadline?.overdue).length;

  if (!scoped.length) return null;

  const updateStatus = async (request: EpiReplacementRequest, status: EpiReplacementStatus) => {
    if (busy) return;
    setBusy(request.id);
    const notes =
      status === "Em andamento"
        ? "Pedido assumido pelo responsável do SESMT."
        : status === "Concluída"
          ? "Atendimento concluído."
          : "";
    const ok = await setEpiReplacementStatus(request.id, status, notes, session.name);
    if (ok && status === "Concluída") {
      // Conclusão sem nova entrega também arquiva a foto do pedido e o registro
      // de devolução do EPI antigo em Documentos.
      const latest = getEpiReplacementRequests().find((item) => item.id === request.id) || request;
      attachReplacementDocuments(latest);
    }
    setBusy("");
    setNotice(
      ok
        ? status === "Em andamento"
          ? `Pedido de ${request.collaboratorName} assumido.`
          : `Pedido de ${request.collaboratorName} concluído.`
        : "Não foi possível atualizar o pedido. Tente novamente."
    );
  };

  const handleDelivery = (delivery: EpiDelivery) => {
    const request = target;
    if (!request) return;
    setTarget(null);
    void (async () => {
      const ok = await addEpiDelivery(delivery);
      if (!ok) {
        setNotice("Não foi possível registrar a entrega de EPI. O pedido continua aberto.");
        return;
      }
      await setEpiReplacementStatus(
        request.id,
        "Concluída",
        `Nova entrega registrada em ${delivery.date}.`,
        session.name
      );
      // Anexa em Documentos a foto do pedido, a devolução do EPI antigo (com o
      // histórico) e a nova Ficha de EPI.
      const latest = getEpiReplacementRequests().find((item) => item.id === request.id) || request;
      attachReplacementDocuments(latest, delivery);
      setNotice(`Pedido de ${request.collaboratorName} atendido com a entrega de ${delivery.date}.`);
    })();
  };

  return (
    <section className="rounded-lg border border-primary-200 bg-primary-50 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-loop-left-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground-950">
              {open.length} pedido(s) de substituição de EPI aguardando atendimento
            </p>
            {overdueCount > 0 && (
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-2.5 py-1 text-[11px] font-semibold text-background-50">
                <i className="ri-alarm-warning-line"></i>
                {overdueCount} fora do prazo de atendimento
              </span>
            )}
            <p className="mt-0.5 text-xs text-foreground-600">
              Abertos pelo SESMT ou pelo próprio colaborador
              {unit ? ` · ${unit}` : ""}. Confira a foto e o motivo antes de providenciar a troca.
            </p>
          </div>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background-50 px-1 py-1">
          <button
            type="button"
            onClick={() => setTab("abertos")}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "abertos" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className="ri-time-line"></i>
            Abertos ({open.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("concluidos")}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "concluidos" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            <i className="ri-checkbox-circle-line"></i>
            Concluídos ({closed.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-primary-200 bg-background-50 px-3.5 py-2.5 text-xs text-primary-800">
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

      {visible.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-primary-200 bg-background-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-foreground-800">
            {tab === "abertos" ? "Nenhum pedido em aberto" : "Nenhum pedido concluído ainda"}
          </p>
          <p className="mt-1 text-xs text-foreground-500">
            {tab === "abertos"
              ? "Todos os pedidos de substituição já foram atendidos."
              : "Os pedidos atendidos aparecem aqui com a data de conclusão."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {visible.map(({ request, deadline }) => {
            const isOpen = request.status === "Pendente" || request.status === "Em andamento";
            const late = Boolean(deadline?.overdue && isOpen);
            return (
            <li
              key={request.id}
              className={`rounded-lg border bg-background-50 p-3.5 ${
                late ? "border-accent-400 ring-1 ring-accent-200" : "border-background-200"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setPreview(request.photo)}
                  title="Ampliar foto do EPI"
                  className="h-24 w-full shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-100 sm:w-24"
                >
                  {request.photo ? (
                    <img
                      src={request.photo}
                      alt={`Foto do EPI de ${request.collaboratorName}`}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-foreground-400">
                      <i className="ri-image-line text-xl"></i>
                    </span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-foreground-950">{request.collaboratorName}</p>
                    <span className="text-xs text-foreground-500">
                      {request.collaboratorRole || "—"}
                      {request.area ? ` · ${request.area}` : ""}
                      {request.establishment ? ` · ${request.establishment}` : ""}
                    </span>
                    <span
                      className={`ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[request.status]}`}
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
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary-100 px-2 py-1 text-[11px] font-semibold text-secondary-900">
                      <i className="ri-shirt-line"></i>
                      {request.epiName}
                    </span>
                    <span className="rounded-md bg-background-100 px-2 py-1 text-[11px] font-medium text-foreground-700">
                      CA {request.ca || "—"}
                      {request.validity ? ` · validade ${request.validity}` : ""}
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                        request.reason === "Perda"
                          ? "bg-accent-200 text-accent-900"
                          : "bg-background-100 text-foreground-700"
                      }`}
                    >
                      Motivo: {request.reason}
                    </span>
                    {isOpen && deadline && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                          deadline.overdue
                            ? "bg-accent-500 text-background-50"
                            : deadline.critical
                              ? "bg-accent-200 text-accent-900"
                              : "bg-secondary-100 text-secondary-900"
                        }`}
                      >
                        <i className={deadline.overdue ? "ri-alarm-warning-line" : "ri-timer-line"}></i>
                        {deadlineLabel(deadline)}
                      </span>
                    )}
                    <span className="text-[11px] text-foreground-400">
                      {request.origin === "colaborador" ? "Aberto pelo colaborador" : "Aberto pelo SESMT"} ·{" "}
                      {formatDateTime(request.createdAt)}
                    </span>
                  </div>

                  {isOpen && deadline && (
                    <p
                      className={`mt-1.5 text-[11px] font-medium ${
                        deadline.overdue ? "text-accent-700" : "text-foreground-500"
                      }`}
                    >
                      <i className="ri-time-line mr-1"></i>
                      Prazo de {formatSlaHours(deadline.hours)} para o motivo {request.reason} · limite{" "}
                      {formatDeadlineMoment(deadline.dueAt)}
                      {deadline.overdue ? " · atrasado" : ""}
                    </p>
                  )}

                  {request.lossDetail && (
                    <div className="mt-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-[11px] leading-relaxed text-accent-900">
                      <i className="ri-file-warning-line mr-1"></i>
                      {request.lossDetail}
                    </div>
                  )}

                  {request.notes && (
                    <p className="mt-2 text-[11px] text-foreground-600">
                      <span className="font-semibold">Observações:</span> {request.notes}
                    </p>
                  )}

                  <EpiReturnPhotoField
                    request={request}
                    onSaved={() => {
                      // Pedido já concluído: reanexa o registro de devolução em
                      // Documentos com a nova foto do equipamento devolvido.
                      if (request.status !== "Concluída") return;
                      const latest = getEpiReplacementRequests().find((item) => item.id === request.id);
                      if (latest) attachReplacementDocuments(latest);
                    }}
                  />

                  {request.status === "Concluída" && request.resolvedAt && (
                    <p className="mt-2 text-[11px] text-primary-700">
                      <i className="ri-checkbox-circle-line mr-1"></i>
                      Concluído em {formatDateTime(request.resolvedAt)}
                      {request.resolutionNotes ? ` · ${request.resolutionNotes}` : ""}
                    </p>
                  )}

                  {(request.status === "Pendente" || request.status === "Em andamento") && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTarget(request);
                          setNotice("");
                        }}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                      >
                        <i className="ri-shirt-line"></i>
                        Registrar entrega
                      </button>
                      {request.status === "Pendente" && (
                        <button
                          type="button"
                          disabled={busy === request.id}
                          onClick={() => void updateStatus(request, "Em andamento")}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-60"
                        >
                          <i className="ri-user-follow-line"></i>
                          Assumir pedido
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy === request.id}
                        onClick={() => void updateStatus(request, "Concluída")}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-60"
                      >
                        <i className="ri-check-line"></i>
                        Concluir sem nova entrega
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <EpiDeliveryModal
        open={!!target}
        onClose={() => setTarget(null)}
        onCreate={handleDelivery}
        initialCollaboratorId={target?.collaboratorId}
        initialItems={
          target ? [{ name: target.epiName, ca: target.ca, quantity: 1 }] : undefined
        }
        initialReason="Substituição"
      />

      <Modal
        open={!!preview}
        onClose={() => setPreview("")}
        title="Foto do EPI"
        subtitle="Registro fotográfico anexado ao pedido de substituição."
        icon="ri-image-line"
        size="lg"
        footer={
          <ModalButton variant="ghost" onClick={() => setPreview("")} icon="ri-close-line">
            Fechar
          </ModalButton>
        }
      >
        {preview && (
          <img
            src={preview}
            alt="Foto do EPI anexada ao pedido"
            className="mx-auto max-h-[60vh] w-auto rounded-md border border-background-200 object-contain"
          />
        )}
      </Modal>
    </section>
  );
}