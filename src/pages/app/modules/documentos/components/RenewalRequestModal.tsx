import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadDocumentFile } from "@/pages/app/modules/documentos/documentsStore";
import {
  assumeRenewalRequest,
  completeRenewalTask,
  concludeRenewal,
  delegateRenewalRequest,
  formatDay,
  formatStamp,
  markRenewalNotified,
  openTasks,
  removeRenewalAttachment,
  renewalNoticeAudienceMeta,
  renewalProgress,
  renewalSlaInfo,
  renewalStatusMeta,
  saveRenewalSchedule,
  addRenewalAttachments,
  toBrDate,
  toDateInputValue,
  type RenewalRequest,
  type RenewalStatus,
} from "@/pages/app/modules/documentos/renewalStore";
import RenewalScheduleForm, {
  type ScheduleDraft,
} from "@/pages/app/modules/documentos/components/RenewalScheduleForm";
import RenewalTaskList from "@/pages/app/modules/documentos/components/RenewalTaskList";
import Modal from "@/pages/app/components/Modal";

interface RenewalRequestModalProps {
  open: boolean;
  request: RenewalRequest | null;
  canEdit: boolean;
  userName: string;
  companyName: string;
  /** Pessoas disponíveis para receber a tratativa por delegação. */
  team?: { name: string; email: string }[];
  onClose: () => void;
}

const steps: { id: RenewalStatus; label: string }[] = [
  { id: "aberta", label: "Aberta" },
  { id: "em-tratativa", label: "Em tratativa" },
  { id: "aguardando-exames", label: "Aguardando exames" },
  { id: "documento-recebido", label: "Documento recebido" },
  { id: "concluida", label: "Concluída" },
];

function defaultValidity(): string {
  const date = new Date();
  const target = new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(
    target.getDate()
  ).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fluxo completo da renovação.
 *
 * Abrir -> responsável se apropria -> agenda e registra exames -> comunica
 * colaborador e gestor -> recebe exames/documento -> conclui atualizando a
 * validade. Cada tarefa guarda o dia e a hora, sem possibilidade de desfazer.
 */
export default function RenewalRequestModal({
  open,
  request,
  canEdit,
  userName,
  companyName,
  team = [],
  onClose,
}: RenewalRequestModalProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [newValidity, setNewValidity] = useState(defaultValidity);
  const [updatedDocName, setUpdatedDocName] = useState("");
  const [conclusionError, setConclusionError] = useState("");
  const [conclusionDone, setConclusionDone] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateName, setDelegateName] = useState("");
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateNote, setDelegateNote] = useState("");
  const [delegateError, setDelegateError] = useState("");
  const [delegateDone, setDelegateDone] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !request) return;
    setEmailNotice("");
    setEmailSending(false);
    setUploading(false);
    setConclusionError("");
    setConclusionDone(false);
    setDelegateOpen(false);
    setDelegateName("");
    setDelegateEmail("");
    setDelegateNote("");
    setDelegateError("");
    setDelegateDone("");
    setNewValidity(request.newExpiresAt ? toDateInputValue(request.newExpiresAt) : defaultValidity());
    setUpdatedDocName(request.updatedDocumentName || request.documentName);
  }, [open, request?.id, request?.newExpiresAt, request?.updatedDocumentName]);

  if (!request) return null;

  const meta = renewalStatusMeta[request.status];
  const concluded = request.status === "concluida";
  const locked = concluded || !canEdit;
  const reached = steps.findIndex((step) => step.id === request.status);
  const pending = openTasks(request);
  const progress = renewalProgress(request);
  const hasAppointment = Boolean(request.appointmentDate && request.appointmentLocation);
  const missingRecipients = !request.collaboratorEmail && !request.managerEmail;
  const canConclude =
    !locked && pending.length === 0 && request.attachments.length > 0 && Boolean(newValidity);

  const sla = renewalSlaInfo(request);
  const deadlineNotices = [...(request.deadlineNotices ?? [])].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );

  const handleDelegate = () => {
    const result = delegateRenewalRequest(
      request.id,
      { toName: delegateName, toEmail: delegateEmail, note: delegateNote },
      userName
    );
    if (!result.ok) {
      setDelegateError(result.reason || "Não foi possível delegar a tratativa.");
      return;
    }
    setDelegateError("");
    setDelegateDone(`Tratativa delegada para ${delegateName.trim()}. Você continua acompanhando o andamento.`);
    setDelegateOpen(false);
    setDelegateName("");
    setDelegateEmail("");
    setDelegateNote("");
  };

  const completeCommunicationTask = () => {
    const task = request.tasks.find((item) => {
      if (item.done) return false;
      const label = item.label.toLowerCase();
      return label.includes("comunicar") || label.includes("informar");
    });
    if (task) completeRenewalTask(request.id, task.id, userName);
  };

  const handleSaveSchedule = (draft: ScheduleDraft) => {
    saveRenewalSchedule(request.id, draft, userName);
    setEmailNotice("");
  };

  const handleSendEmail = async () => {
    if (!hasAppointment) {
      setEmailNotice("Preencha e salve a data, o horário e o local do agendamento antes de enviar.");
      return;
    }
    setEmailSending(true);
    setEmailNotice("");
    try {
      const { data, error } = await supabase.functions.invoke("notify-document-renewal", {
        body: {
          companyName,
          sender: userName,
          documentName: request.documentName,
          documentTypeName: request.documentTypeName,
          collaboratorName: request.collaboratorName || "",
          collaboratorEmail: request.collaboratorEmail || "",
          managerName: request.managerName || "",
          managerEmail: request.managerEmail || "",
          clinicName: request.clinicName,
          clinicContact: request.clinicContact,
          appointmentDate: toBrDate(request.appointmentDate),
          appointmentTime: request.appointmentTime,
          location: request.appointmentLocation,
          examsRequired: request.examsRequired,
          exams: request.exams,
          notes: request.notes,
        },
      });
      if (error) throw error;
      const result = (data ?? {}) as { sent?: boolean; reason?: string; detail?: string };

      if (result.sent === true) {
        markRenewalNotified(request.id, {
          emailStatus: "sent",
          feedback: "Agendamento enviado ao colaborador e ao gestor responsável.",
          by: userName,
        });
        completeCommunicationTask();
        setEmailNotice("E-mail enviado com sucesso. A solicitação passou a \"Aguardando exames\".");
      } else if (result.reason === "resend-not-configured") {
        markRenewalNotified(request.id, {
          emailStatus: "not-configured",
          feedback:
            "O envio de e-mail ainda não está configurado no backend (Resend). Registre a comunicação manualmente.",
          by: userName,
        });
        setEmailNotice(
          "O envio de e-mail ainda não está configurado no backend (Resend). Use \"Registrar comunicação feita\" para seguir com a tratativa."
        );
      } else if (result.reason === "no-recipients") {
        markRenewalNotified(request.id, {
          emailStatus: "error",
          feedback: "Colaborador e gestor estão sem e-mail cadastrado.",
          by: userName,
        });
        setEmailNotice("Não há e-mail cadastrado para o colaborador nem para o gestor.");
      } else {
        markRenewalNotified(request.id, {
          emailStatus: "error",
          feedback: result.detail || "Falha no envio do e-mail.",
          by: userName,
        });
        setEmailNotice(result.detail || "Não foi possível enviar o e-mail agora. Tente novamente.");
      }
    } catch {
      markRenewalNotified(request.id, {
        emailStatus: "error",
        feedback: "Não foi possível acionar o envio de e-mail.",
        by: userName,
      });
      setEmailNotice("Não foi possível acionar o envio de e-mail. Verifique a conexão e tente novamente.");
    } finally {
      setEmailSending(false);
    }
  };

  const handleRegisterManual = () => {
    markRenewalNotified(request.id, {
      emailStatus: "not-configured",
      feedback: "Comunicação registrada manualmente pelo responsável.",
      by: userName,
      manual: true,
    });
    completeCommunicationTask();
    setEmailNotice("Comunicação registrada. A solicitação passou a \"Aguardando exames\".");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const entries: { name: string; size: string }[] = [];
    const list = Array.from(files);
    for (let index = 0; index < list.length; index += 1) {
      const file = list[index];
      entries.push({ name: file.name, size: formatSize(file.size) });
      try {
        await uploadDocumentFile(file, index);
      } catch {
        /* o registro do recebimento continua mesmo se o upload falhar */
      }
    }
    addRenewalAttachments(request.id, entries, userName);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConclude = () => {
    const result = concludeRenewal(request.id, {
      newExpiresAt: toBrDate(newValidity),
      updatedDocumentName: updatedDocName.trim() || request.documentName,
      by: userName,
    });
    if (!result.ok) {
      setConclusionError(result.reason || "Não foi possível concluir a renovação.");
      return;
    }
    setConclusionError("");
    setConclusionDone(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-loop-right-line"
      title="Solicitação de renovação"
      subtitle={`${request.code ? `${request.code} · ` : ""}${request.documentName} · ${request.documentTypeName}`}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-close-line"></i>
          Fechar
        </button>
      }
    >
      {/* Situação + etapas */}
      <div className="rounded-xl border border-background-200 bg-background-100 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              title="Número público da solicitação"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-background-50 px-2 py-1 font-mono text-[11px] font-bold tracking-tight text-foreground-700 ring-1 ring-inset ring-background-200"
            >
              <i className="ri-hashtag text-[10px]"></i>
              {request.code || "—"}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}></span>
              {meta.label}
            </span>
          </div>
          <span className="text-[10px] font-medium text-foreground-500">
            {concluded
              ? `Concluída em ${formatStamp(request.completedAt)}`
              : `${request.tasks.length - pending.length} de ${request.tasks.length} tarefas · ${progress}%`}
          </span>
        </div>

        {sla && (
          <div
            className={`mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${
              concluded
                ? request.completedAt && new Date(request.completedAt) > new Date(sla.dueAt)
                  ? "bg-danger-100 text-danger-800"
                  : "bg-primary-100 text-primary-800"
                : sla.late
                  ? "bg-danger-100 text-danger-800"
                  : sla.remainingDays <= 3
                    ? "bg-accent-100 text-accent-900"
                    : "bg-background-50 text-foreground-600"
            }`}
          >
            <i className={sla.late ? "ri-alarm-warning-line" : "ri-timer-line"}></i>
            <span>Prazo (SLA): {sla.days} dia(s) · vence em {formatDay(sla.dueAt)}</span>
            {!concluded && (
              <span className="text-[10px] font-bold">
                {sla.late
                  ? `· estourado há ${Math.abs(sla.remainingDays)} dia(s)`
                  : sla.dueToday
                    ? "· vence hoje"
                    : `· ${sla.remainingDays} dia(s) restantes`}
              </span>
            )}
            {concluded && (
              <span className="text-[10px] font-bold">
                {request.completedAt && new Date(request.completedAt) > new Date(sla.dueAt)
                  ? "· concluída fora do prazo"
                  : "· concluída no prazo"}
              </span>
            )}
          </div>
        )}

        <ol className="mt-3 flex items-start gap-1 overflow-x-auto">
          {steps.map((step, index) => {
            const done = concluded || index <= reached;
            const current = !concluded && index === reached;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      done
                        ? "bg-primary-500 text-background-50"
                        : "border border-background-300 bg-background-50 text-foreground-400"
                    } ${current ? "ring-2 ring-primary-200" : ""}`}
                  >
                    {done ? <i className="ri-check-line text-[11px]"></i> : index + 1}
                  </span>
                  <span
                    className={`whitespace-nowrap text-[9px] font-semibold ${
                      done ? "text-foreground-800" : "text-foreground-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <span
                    className={`mt-[-14px] h-0.5 min-w-[10px] flex-1 rounded-full ${
                      done && index < reached ? "bg-primary-400" : "bg-background-300"
                    }`}
                  ></span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Identificação */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-background-200 bg-background-50 px-4 py-3.5 sm:grid-cols-3">
        {[
          { label: "Nº da solicitação", value: request.code || "—", icon: "ri-hashtag" },
          { label: "Colaborador", value: request.collaboratorName || "Documento da empresa", icon: "ri-user-line" },
          { label: "CPF", value: request.collaboratorCpf || "—", icon: "ri-id-card-line" },
          { label: "Função", value: request.collaboratorRole || "—", icon: "ri-briefcase-line" },
          { label: "Unidade", value: request.unit || "Corporativo", icon: "ri-building-line" },
          { label: "Validade atual", value: request.currentExpiresAt, icon: "ri-calendar-line" },
          { label: "Aberta em", value: formatStamp(request.createdAt), icon: "ri-time-line" },
          { label: "Aberta por", value: request.createdBy || "Sistema", icon: "ri-user-star-line" },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-foreground-400">
              <i className={`${item.icon} text-[10px]`}></i>
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-[12px] font-medium text-foreground-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Responsável */}
      {!concluded && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 ${
            request.ownerName ? "border-primary-200 bg-primary-50" : "border-danger-300 bg-danger-50"
          }`}
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  request.ownerName ? "bg-primary-100 text-primary-700" : "bg-danger-100 text-danger-800"
                }`}
              >
                <i className={request.ownerName ? "ri-user-follow-line" : "ri-user-unfollow-line"}></i>
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-foreground-900">
                  {request.ownerName
                    ? `Tratativa sob responsabilidade de ${request.ownerName}`
                    : "Esta solicitação está sem responsável"}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-foreground-600">
                  {request.ownerName
                    ? request.ownerEmail
                      ? `${request.ownerEmail} · assumida em ${formatStamp(request.ownerAt)}`
                      : `Assumida em ${formatStamp(request.ownerAt)}`
                    : "Toda solicitação precisa de uma pessoa responsável para conduzir a tratativa."}
                </p>
                {request.delegatedFromName && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-background-50 px-2 py-0.5 text-[10px] font-semibold text-secondary-900">
                    <i className="ri-git-branch-line"></i>
                    Delegada por {request.delegatedFromName}
                    {request.delegatedAt ? ` em ${formatStamp(request.delegatedAt)}` : ""}
                    <span className="font-normal text-foreground-500">· segue acompanhando</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {!request.ownerName && canEdit && (
                <button
                  type="button"
                  onClick={() => assumeRenewalRequest(request.id, userName)}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-danger-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-danger-700"
                >
                  <i className="ri-hand-heart-line"></i>
                  Assumir solicitação
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setDelegateOpen((prev) => !prev);
                    setDelegateError("");
                    setDelegateDone("");
                  }}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-primary-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                >
                  <i className="ri-git-branch-line"></i>
                  {request.ownerName ? "Delegar tratativa" : "Definir responsável"}
                </button>
              )}
            </div>
          </div>

          {delegateDone && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-md border border-primary-200 bg-primary-100 px-2.5 py-2 text-[10px] leading-snug text-primary-900">
              <i className="ri-checkbox-circle-line mt-0.5"></i>
              <span>{delegateDone}</span>
            </p>
          )}

          {delegateOpen && canEdit && (
            <div className="mt-3 rounded-lg border border-background-200 bg-background-50 px-3 py-3">
              <p className="text-[11px] font-bold text-foreground-900">Delegar a condução da tratativa</p>
              <p className="mt-0.5 text-[10px] leading-snug text-foreground-500">
                A pessoa escolhida passa a conduzir o agendamento, os exames e a conclusão. Você continua
                acompanhando o andamento e a solicitação fica registrada no histórico.
              </p>

              {team.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {team.slice(0, 8).map((person) => (
                    <button
                      key={`${person.name}-${person.email}`}
                      type="button"
                      onClick={() => {
                        setDelegateName(person.name);
                        setDelegateEmail(person.email);
                        setDelegateError("");
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        delegateName === person.name
                          ? "border-primary-300 bg-primary-100 text-primary-800"
                          : "border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
                      }`}
                    >
                      <i className="ri-user-line"></i>
                      {person.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground-700">Pessoa responsável *</span>
                  <input
                    value={delegateName}
                    onChange={(event) => {
                      setDelegateName(event.target.value);
                      setDelegateError("");
                    }}
                    placeholder="Nome de quem vai conduzir"
                    className="w-full rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground-700">E-mail (opcional)</span>
                  <input
                    type="email"
                    value={delegateEmail}
                    onChange={(event) => setDelegateEmail(event.target.value)}
                    placeholder="pessoa@empresa.com.br"
                    className="w-full rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400"
                  />
                </label>
              </div>

              <label className="mt-2 flex min-w-0 flex-col gap-1">
                <span className="text-[10px] font-semibold text-foreground-700">Observação (opcional)</span>
                <input
                  value={delegateNote}
                  onChange={(event) => setDelegateNote(event.target.value)}
                  placeholder="Ex.: fico acompanhando o agendamento com a clínica"
                  className="w-full rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400"
                />
              </label>

              {delegateError && (
                <p className="mt-2 flex items-start gap-1.5 rounded-md border border-danger-200 bg-danger-50 px-2.5 py-2 text-[10px] leading-snug text-danger-800">
                  <i className="ri-error-warning-line mt-0.5"></i>
                  <span>{delegateError}</span>
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDelegateOpen(false)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelegate}
                  disabled={!delegateName.trim()}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="ri-send-plane-line"></i>
                  Delegar tratativa
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canEdit && !concluded && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-background-200 bg-background-100 px-3.5 py-2.5 text-[11px] text-foreground-600">
          <i className="ri-eye-line"></i>
          Você está em modo de leitura. Apenas gestores/SESMT conduzem a tratativa.
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-4">
          <RenewalScheduleForm request={request} canEdit={canEdit} onSave={handleSaveSchedule} />

          {/* Comunicação */}
          <section className="rounded-xl border border-background-200 bg-background-50 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                <i className="ri-mail-send-line text-base"></i>
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground-950">Comunicar agendamento</h3>
                <p className="text-[10px] text-foreground-500">
                  Envia para o colaborador e para o gestor responsável.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2 py-1 text-[10px] font-medium text-foreground-600">
                <i className="ri-user-line"></i>
                {request.collaboratorEmail || "colaborador sem e-mail"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background-100 px-2 py-1 text-[10px] font-medium text-foreground-600">
                <i className="ri-user-star-line"></i>
                {request.managerEmail || "gestor sem e-mail"}
              </span>
            </div>

            {request.notifiedAt && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary-700">
                <i className="ri-mail-check-line"></i>
                Comunicado em {formatStamp(request.notifiedAt)}
              </p>
            )}

            {emailNotice && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md border border-accent-200 bg-accent-50 px-2.5 py-2 text-[10px] leading-snug text-accent-900">
                <i className="ri-information-line mt-0.5"></i>
                <span>{emailNotice}</span>
              </p>
            )}

            {!locked && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSendEmail()}
                  disabled={emailSending || !hasAppointment || missingRecipients}
                  title={
                    missingRecipients
                      ? "Cadastre o e-mail do colaborador ou do gestor para enviar"
                      : !hasAppointment
                        ? "Preencha e salve data, horário e local do agendamento"
                        : "Enviar agendamento por e-mail"
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className={emailSending ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
                  {emailSending ? "Enviando..." : "Enviar agendamento por e-mail"}
                </button>
                <button
                  type="button"
                  onClick={handleRegisterManual}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-100"
                >
                  <i className="ri-check-double-line"></i>
                  Registrar comunicação feita
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <RenewalTaskList request={request} canEdit={canEdit} userName={userName} />

          {/* Anexos */}
          <section className="rounded-xl border border-background-200 bg-background-50">
            <div className="flex items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                  <i className="ri-attachment-2 text-base"></i>
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground-950">Exames e documento novo</h3>
                  <p className="text-[10px] text-foreground-500">
                    Tudo fica vinculado ao documento principal.
                  </p>
                </div>
              </div>
              <span className="whitespace-nowrap text-[10px] font-semibold text-foreground-500">
                {request.attachments.length} anexo(s)
              </span>
            </div>

            <div className="px-4 py-3">
              <ul className="flex flex-col gap-1.5">
                {request.attachments.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-md border border-background-200 bg-background-100 px-2.5 py-2"
                  >
                    <i className="ri-file-pdf-2-line text-sm text-danger-700"></i>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-foreground-900">{file.name}</p>
                      <p className="text-[9px] text-foreground-500">
                        {file.size} · {formatStamp(file.at)}
                      </p>
                    </div>
                    {!locked && (
                      <button
                        type="button"
                        aria-label={`Remover ${file.name}`}
                        onClick={() => removeRenewalAttachment(request.id, file.id, userName)}
                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-danger-100 hover:text-danger-700"
                      >
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    )}
                  </li>
                ))}
                {request.attachments.length === 0 && (
                  <li className="rounded-md border border-dashed border-background-300 px-3 py-2 text-[10px] text-foreground-500">
                    Nenhum arquivo recebido ainda.
                  </li>
                )}
              </ul>

              {!locked && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    onChange={(event) => void handleFiles(event.target.files)}
                    className="hidden"
                    aria-label="Enviar exames e documento novo"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-primary-400 bg-primary-50 px-3 py-2.5 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    <i className={uploading ? "ri-loader-4-line animate-spin" : "ri-upload-2-line"}></i>
                    {uploading ? "Enviando arquivos..." : "Anexar exames / novo documento"}
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Conclusão */}
          <section
            className={`rounded-xl border px-4 py-3.5 ${
              concluded ? "border-primary-200 bg-primary-50" : "border-background-200 bg-background-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-md ${
                  concluded ? "bg-primary-100 text-primary-700" : "bg-background-100 text-foreground-600"
                }`}
              >
                <i className={concluded ? "ri-shield-check-line" : "ri-flag-line"}></i>
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground-950">
                  {concluded ? "Renovação concluída" : "Concluir renovação"}
                </h3>
                <p className="text-[10px] text-foreground-500">
                  {concluded
                    ? "Registro travado, sem edição posterior."
                    : "Atualiza a validade do documento real e encerra a solicitação."}
                </p>
              </div>
            </div>

            {concluded ? (
              <div className="mt-3 grid gap-2 text-[11px] text-foreground-700">
                <p className="flex items-center gap-1.5">
                  <i className="ri-checkbox-circle-line text-primary-700"></i>
                  Concluída em <strong className="font-semibold">{formatStamp(request.completedAt)}</strong>
                </p>
                <p className="flex items-center gap-1.5">
                  <i className="ri-file-text-line text-primary-700"></i>
                  Documento atualizado: <strong className="font-semibold">{request.updatedDocumentName}</strong>
                </p>
                <p className="flex items-center gap-1.5">
                  <i className="ri-calendar-check-line text-primary-700"></i>
                  Nova validade: <strong className="font-semibold">{request.newExpiresAt}</strong>
                </p>
                <p className="flex items-center gap-1.5">
                  <i className="ri-attachment-2 text-primary-700"></i>
                  {request.attachments.length} arquivo(s) vinculado(s) ao documento
                </p>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground-700">
                    Documento que está sendo atualizado
                  </span>
                  <input
                    value={updatedDocName}
                    disabled={locked}
                    onChange={(event) => setUpdatedDocName(event.target.value)}
                    className="w-full rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400 disabled:bg-background-100"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[10px] font-semibold text-foreground-700">Nova validade</span>
                  <input
                    type="date"
                    value={newValidity}
                    disabled={locked}
                    onChange={(event) => setNewValidity(event.target.value)}
                    className="w-full rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] text-foreground-900 outline-none focus:border-primary-400 disabled:bg-background-100"
                  />
                </label>

                <ul className="flex flex-col gap-1 text-[10px] text-foreground-600">
                  <li className="flex items-center gap-1.5">
                    <i
                      className={
                        pending.length === 0
                          ? "ri-checkbox-circle-fill text-primary-600"
                          : "ri-circle-line text-foreground-400"
                      }
                    ></i>
                    {pending.length === 0
                      ? "Todas as tarefas concluídas"
                      : `${pending.length} tarefa(s) ainda aberta(s)`}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <i
                      className={
                        request.attachments.length > 0
                          ? "ri-checkbox-circle-fill text-primary-600"
                          : "ri-circle-line text-foreground-400"
                      }
                    ></i>
                    {request.attachments.length > 0
                      ? "Documento e exames anexados"
                      : "Anexe o documento novo (e os exames) para concluir"}
                  </li>
                </ul>

                {conclusionError && (
                  <p className="flex items-start gap-1.5 rounded-md border border-danger-200 bg-danger-50 px-2.5 py-2 text-[10px] leading-snug text-danger-800">
                    <i className="ri-error-warning-line mt-0.5"></i>
                    <span>{conclusionError}</span>
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConclude}
                  disabled={!canConclude}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="ri-flag-2-line"></i>
                  Concluir renovação (definitivo)
                </button>
                {conclusionDone && (
                  <p className="flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-100 px-2.5 py-2 text-[10px] font-semibold text-primary-800">
                    <i className="ri-checkbox-circle-line"></i>
                    Renovação concluída e validade atualizada.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Avisos de prazo enviados */}
      <div className="mt-4 rounded-xl border border-background-200 bg-background-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
            <i className="ri-mail-check-line"></i>
            Avisos de prazo enviados
          </p>
          <span className="whitespace-nowrap rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
            {deadlineNotices.length} envio(s)
          </span>
        </div>

        {deadlineNotices.length === 0 ? (
          <p className="mt-2 rounded-md border border-dashed border-background-300 px-3 py-2 text-[10px] text-foreground-500">
            Nenhum aviso de prazo enviado para esta tratativa até agora. Os respectivos e-mails aparecem aqui com
            destinatário, público e data.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {deadlineNotices.map((notice) => {
              const audience = renewalNoticeAudienceMeta[notice.audience];
              return (
                <li
                  key={notice.id}
                  className="flex flex-col gap-1 rounded-md border border-background-200 bg-background-100 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] ${
                        audience?.chip || "bg-background-200 text-foreground-700"
                      }`}
                    >
                      <i className={audience?.icon || "ri-mail-line"}></i>
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-foreground-900">
                        {audience?.label || notice.audience}
                        <span className="font-normal text-foreground-500">· {notice.recipient}</span>
                      </p>
                      <p className="text-[10px] text-foreground-500">
                        Prazo em {formatDay(notice.dueAt)} ·{" "}
                        {notice.remainingDays < 0
                          ? `atrasada há ${Math.abs(notice.remainingDays)} dia(s)`
                          : notice.remainingDays === 0
                            ? "vencia no dia do envio"
                            : `${notice.remainingDays} dia(s) restantes`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-foreground-600">
                    {formatStamp(notice.sentAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Histórico */}
      <div className="mt-4 rounded-xl border border-background-200 bg-background-100 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
          <i className="ri-history-line"></i>
          Histórico da tratativa
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {[...request.log].reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="flex items-start gap-2 text-[10px] leading-snug text-foreground-600">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary-400"></span>
              <span className="min-w-0">
                <strong className="font-semibold text-foreground-800">{formatStamp(entry.at)}</strong>{" "}
                — {entry.label}
                {entry.by ? ` · ${entry.by}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}