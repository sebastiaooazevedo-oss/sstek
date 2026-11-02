import { useState, type ReactNode } from "react";
import { useAppSession } from "@/pages/app/context";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  documentsInExpiryWindow,
  managersInScope,
  sendDocumentExpiryAlerts,
} from "@/pages/app/modules/documentos/expiryEmailNotifier";
import {
  alertRecipients,
  isValidEmail,
  saveDocumentExpiryAlertConfig,
  type DocumentExpiryAlertConfig,
  useDocumentExpiryAlertConfig,
} from "@/pages/app/modules/documentos/documentExpiryAlertStore";
import {
  WEEKDAY_OPTIONS,
  sendWeeklyExpirySummary,
  weeklyScheduleLabel,
  weeklySummaryDocuments,
} from "@/pages/app/modules/documentos/weeklyExpirySummary";

const DAY_PRESETS = [15, 30, 45, 60, 90];

/** Alternador reutilizado nas três opções complementares do aviso. */
function ToggleSwitch({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? "bg-primary-500" : "bg-background-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform dark:bg-background-950 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      ></span>
    </button>
  );
}

interface ComplementaryOptionProps {
  icon: string;
  title: string;
  description: string;
  checked: boolean;
  toggleLabel: string;
  onToggle: () => void;
  children?: ReactNode;
}

function ComplementaryOption({
  icon,
  title,
  description,
  checked,
  toggleLabel,
  onToggle,
  children,
}: ComplementaryOptionProps) {
  return (
    <div className="border-t border-background-200 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className={`${icon} text-base`}></i>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground-900">{title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  checked ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
                }`}
              >
                {checked ? "Ativado" : "Desativado"}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">{description}</p>
          </div>
        </div>
        <ToggleSwitch checked={checked} label={toggleLabel} onToggle={onToggle} />
      </div>
      {children}
    </div>
  );
}

/**
 * Parametrização do aviso de vencimento de documentos.
 *
 * Define a janela (em dias) em que o documento entra no alerta e quem recebe:
 * SESMT, outros e-mails, gestor/líder responsável (apenas os documentos da
 * equipe dele), PDF agrupado por unidade e resumo semanal.
 */
export default function DocumentExpiryAlertSettings() {
  const session = useAppSession();
  const config: DocumentExpiryAlertConfig = useDocumentExpiryAlertConfig();
  const documents = useDocuments();
  const collaborators = useCollaboratorsList();
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sendingWeekly, setSendingWeekly] = useState(false);
  const [weeklyFeedback, setWeeklyFeedback] = useState("");

  const recipients = alertRecipients(config);
  const inWindow = documentsInExpiryWindow(documents, config.daysBefore);
  const managers = managersInScope(documents, collaborators, config.daysBefore);
  const weeklyEntries = weeklySummaryDocuments(documents);

  const commitDays = (raw: string) => {
    const days = Math.round(Number(raw));
    if (!Number.isFinite(days) || days < 1) return;
    saveDocumentExpiryAlertConfig({ daysBefore: Math.min(365, days) });
  };

  const addEmail = () => {
    const value = emailDraft.trim().toLowerCase();
    if (!value) return;
    if (!isValidEmail(value)) {
      setEmailError("Informe um e-mail válido, como sesmt@empresa.com.br.");
      return;
    }
    if (recipients.includes(value)) {
      setEmailError("Este e-mail já está cadastrado para receber os alertas.");
      return;
    }
    saveDocumentExpiryAlertConfig({ extraEmails: [...config.extraEmails, value] });
    setEmailDraft("");
    setEmailError("");
    setFeedback("");
  };

  const removeEmail = (email: string) => {
    saveDocumentExpiryAlertConfig({ extraEmails: config.extraEmails.filter((item) => item !== email) });
    setFeedback("");
  };

  const handleSendNow = async () => {
    setSending(true);
    setFeedback("");
    const result = await sendDocumentExpiryAlerts({
      documents,
      config,
      companyName: session.company || "Sua empresa",
      collaborators,
    });
    setFeedback(result.message);
    setSending(false);
  };

  const handleSendWeekly = async () => {
    setSendingWeekly(true);
    setWeeklyFeedback("");
    const result = await sendWeeklyExpirySummary({
      documents,
      config,
      companyName: session.company || "Sua empresa",
      force: true,
    });
    setWeeklyFeedback(result.message);
    setSendingWeekly(false);
  };

  const sesmtValid = !config.sesmtEmail || isValidEmail(config.sesmtEmail);

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-mail-send-line text-lg"></i>
        </span>
        <div>
          <h2 className="font-heading text-base font-bold text-foreground-950">Alertas de vencimento de documentos</h2>
          <p className="mt-0.5 text-xs text-foreground-500">
            Defina a janela de antecedência e quem recebe o e-mail quando um documento entra nesse prazo.
          </p>
        </div>
      </div>

      {/* Liga/desliga o envio automático */}
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground-900">Enviar aviso por e-mail</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                config.enabled ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
              }`}
            >
              {config.enabled ? "Ativado" : "Desativado"}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
            Quando ativado, o sistema verifica os vencimentos sempre que a área de Documentos é aberta pela gestão e
            envia um e-mail com a lista dos documentos vencidos e dos que entram na janela de antecedência. Cada
            documento é avisado <strong className="font-semibold">uma única vez por validade</strong> — ao renovar a
            data, um novo aviso é gerado.
          </p>
        </div>

        <ToggleSwitch
          checked={config.enabled}
          label="Enviar aviso de vencimento por e-mail"
          onToggle={() => saveDocumentExpiryAlertConfig({ enabled: !config.enabled })}
        />
      </div>

      {/* Janela de antecedência */}
      <div className="border-t border-background-200 p-5">
        <h3 className="text-sm font-semibold text-foreground-900">Janela de antecedência</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          O documento entra no alerta (e no e-mail) quando faltarem{" "}
          <strong className="font-semibold">este número de dias ou menos</strong> para o vencimento. Documentos já
          vencidos continuam listados até a validade ser renovada.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {DAY_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => saveDocumentExpiryAlertConfig({ daysBefore: preset })}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                preset === config.daysBefore
                  ? "bg-primary-500 text-background-50"
                  : "border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
              }`}
            >
              <i className="ri-timer-line text-sm"></i>
              {preset} dias
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-foreground-600">Dias de antecedência</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                inputMode="numeric"
                value={config.daysBefore}
                onChange={(e) => commitDays(e.target.value)}
                aria-label="Dias de antecedência do aviso de vencimento"
                className="w-24 rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-right text-sm font-semibold text-foreground-900 outline-none transition-colors focus:border-primary-400"
              />
              <span className="text-xs font-semibold text-foreground-500">dia(s)</span>
            </div>
          </label>

          <div className="flex flex-col justify-end">
            <p className="text-[11px] font-semibold text-foreground-600">Hoje na janela de aviso</p>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-foreground-900">
              <i className="ri-file-warning-line text-base text-accent-700"></i>
              {inWindow.length} documento(s)
              <span className="text-xs font-normal text-foreground-500">
                ({inWindow.filter((entry) => entry.days < 0).length} vencido(s))
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Destinatários */}
      <div className="border-t border-background-200 p-5">
        <h3 className="text-sm font-semibold text-foreground-900">Quem recebe os alertas</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          O e-mail do SESMT é o destinatário principal. Você pode cadastrar outros e-mails — por exemplo, a diretoria,
          o jurídico ou o responsável técnico — e todos recebem o mesmo aviso.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-foreground-600">E-mail do SESMT</span>
            <input
              type="email"
              value={config.sesmtEmail}
              onChange={(e) => saveDocumentExpiryAlertConfig({ sesmtEmail: e.target.value })}
              placeholder="sesmt@empresa.com.br"
              className={`w-full box-border rounded-md border bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400 ${
                sesmtValid ? "border-background-300" : "border-accent-400"
              }`}
            />
            <span className={`text-[11px] ${sesmtValid ? "text-foreground-500" : "text-accent-800"}`}>
              {sesmtValid
                ? "Recebe o aviso assim que um documento entra na janela."
                : "E-mail inválido — corrija para que o aviso possa ser enviado."}
            </span>
          </label>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-foreground-600">Outros e-mails</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value);
                  setEmailError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                placeholder="diretoria@empresa.com.br"
                className="w-full min-w-0 box-border rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400"
              />
              <button
                type="button"
                onClick={addEmail}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2.5 text-xs font-semibold text-background-50 transition-colors hover:bg-secondary-600"
              >
                <i className="ri-add-line text-base"></i>
                Adicionar
              </button>
            </div>
            {emailError ? (
              <span className="text-[11px] text-accent-800">{emailError}</span>
            ) : (
              <span className="text-[11px] text-foreground-500">
                Pressione Enter ou clique em Adicionar para incluir.
              </span>
            )}
          </div>
        </div>

        {config.extraEmails.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {config.extraEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full border border-background-300 bg-background-100 py-1 pl-3 pr-1 text-xs font-medium text-foreground-700"
              >
                <i className="ri-mail-line text-sm text-secondary-700"></i>
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  aria-label={`Remover ${email}`}
                  className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
                >
                  <i className="ri-close-line text-xs"></i>
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2.5 rounded-md border border-background-200 bg-background-100 px-4 py-3 text-xs text-foreground-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <i className="ri-contacts-book-line mt-0.5 text-base text-secondary-700"></i>
            <span>
              <strong className="font-semibold text-foreground-800">{recipients.length}</strong> destinatário(s)
              recebendo os alertas
              {recipients.length > 0 ? `: ${recipients.join(", ")}` : " — cadastre ao menos um e-mail."}
            </span>
          </span>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={sending || recipients.length === 0}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
              sending || recipients.length === 0
                ? "cursor-not-allowed bg-background-300 text-foreground-500"
                : "cursor-pointer bg-primary-500 text-background-50 hover:bg-primary-600"
            }`}
          >
            <i className={sending ? "ri-loader-4-line animate-spin text-base" : "ri-send-plane-line text-base"}></i>
            {sending ? "Enviando..." : "Enviar verificação agora"}
          </button>
        </div>

        {feedback && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-2.5 text-xs text-primary-800">
            <i className="ri-information-line mt-0.5 text-base"></i>
            {feedback}
          </p>
        )}
      </div>

      {/* Aviso ao gestor/líder */}
      <ComplementaryOption
        icon="ri-user-star-line"
        title="Avisar o gestor/líder responsável"
        description="Quando o documento é de um colaborador, o gestor vinculado a ele recebe um e-mail só com os documentos da própria equipe. O SESMT continua recebendo a base inteira."
        checked={config.notifyManagers}
        toggleLabel="Avisar também o gestor responsável"
        onToggle={() => saveDocumentExpiryAlertConfig({ notifyManagers: !config.notifyManagers })}
      >
        {config.notifyManagers && (
          <div className="mt-3 rounded-md border border-background-200 bg-background-100 px-4 py-3">
            {managers.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-[11px] font-semibold text-foreground-700">
                  <i className="ri-team-line text-sm text-secondary-700"></i>
                  {managers.length} gestor(es) receberiam aviso hoje
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {managers.map((manager) => (
                    <li
                      key={manager.email}
                      className="inline-flex items-center gap-1.5 rounded-full border border-background-300 bg-background-50 px-2.5 py-1 text-[11px] text-foreground-700"
                    >
                      <i className="ri-shield-user-line text-xs text-secondary-700"></i>
                      {manager.name}
                      <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
                        {manager.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground-600">
                <i className="ri-information-line mt-0.5 text-sm text-secondary-700"></i>
                Nenhum gestor com e-mail cadastrado aparece na janela de aviso agora. O vínculo gestor › colaborador é
                definido em Colaboradores.
              </p>
            )}
          </div>
        )}
      </ComplementaryOption>

      {/* PDF agrupado por unidade */}
      <ComplementaryOption
        icon="ri-file-pdf-2-line"
        title="Anexar lista completa em PDF"
        description="O e-mail do SESMT passa a levar um PDF com todos os documentos vencidos e a vencer, agrupados por unidade (estabelecimento), com validade e situação de cada um — pronto para anexar em fiscalização ou reunião."
        checked={config.attachPdf}
        toggleLabel="Anexar PDF com a lista agrupada por unidade"
        onToggle={() => saveDocumentExpiryAlertConfig({ attachPdf: !config.attachPdf })}
      >
        {config.attachPdf && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-background-200 bg-background-100 px-4 py-2.5 text-[11px] leading-relaxed text-foreground-600">
            <i className="ri-attachment-2 mt-0.5 text-sm text-secondary-700"></i>
            O PDF é gerado no backend no momento do envio. Documentos sem unidade entram no grupo{" "}
            <strong className="font-semibold">Corporativo (todas as unidades)</strong>. O mesmo anexo é usado no resumo
            semanal, quando ativo.
          </p>
        )}
      </ComplementaryOption>

      {/* Resumo semanal */}
      <ComplementaryOption
        icon="ri-calendar-todo-line"
        title="Resumo semanal por e-mail"
        description="Um e-mail por semana ao SESMT com o que venceu (ainda pendente) e o que vence nos próximos 7 dias. Resolve o caso de documentos que entram e saem da janela sem ninguém abrir a tela."
        checked={config.weeklySummary}
        toggleLabel="Enviar resumo semanal de vencimentos"
        onToggle={() => saveDocumentExpiryAlertConfig({ weeklySummary: !config.weeklySummary })}
      >
        {config.weeklySummary && (
          <div className="mt-3 flex flex-col gap-3 rounded-md border border-background-200 bg-background-100 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-end gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground-600">Dia da semana</span>
                  <div className="relative">
                    <select
                      value={config.weeklyWeekday}
                      onChange={(e) =>
                        saveDocumentExpiryAlertConfig({ weeklyWeekday: Number(e.target.value) })
                      }
                      className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-48"
                    >
                      {WEEKDAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                  </div>
                </label>
                <span className="mb-1 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                  {weeklyEntries.length} no resumo agora
                </span>
              </span>

              <button
                type="button"
                onClick={handleSendWeekly}
                disabled={sendingWeekly || recipients.length === 0}
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                  sendingWeekly || recipients.length === 0
                    ? "cursor-not-allowed bg-background-300 text-foreground-500"
                    : "cursor-pointer bg-secondary-500 text-background-50 hover:bg-secondary-600"
                }`}
              >
                <i
                  className={
                    sendingWeekly ? "ri-loader-4-line animate-spin text-base" : "ri-mail-send-line text-base"
                  }
                ></i>
                {sendingWeekly ? "Enviando..." : "Enviar resumo agora"}
              </button>
            </div>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground-600">
              <i className="ri-information-line mt-0.5 text-sm text-secondary-700"></i>
              <span>
                {weeklyScheduleLabel(config)}
                {" · "}envio automático no primeiro acesso da gestão a partir do dia escolhido, respeitando o intervalo
                mínimo de 6 dias entre resumos.
              </span>
            </p>

            {weeklyFeedback && (
              <p className="flex items-start gap-2 rounded-md border border-secondary-200 bg-background-50 px-3 py-2 text-[11px] text-secondary-900">
                <i className="ri-checkbox-circle-line mt-0.5 text-sm"></i>
                {weeklyFeedback}
              </p>
            )}
          </div>
        )}
      </ComplementaryOption>

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-600">
        <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          A janela de antecedência também define quando o documento aparece como{" "}
          <strong className="font-semibold">Vencendo</strong> na lista de Documentos e passa a contar no alerta do sino.
          O envio dos e-mails usa o serviço Resend, configurado no painel do Supabase (secrets{" "}
          <code className="rounded bg-background-200 px-1 py-0.5 text-[11px]">RESEND_API_KEY</code> e{" "}
          <code className="rounded bg-background-200 px-1 py-0.5 text-[11px]">RESEND_FROM_DOMAIN</code>).
        </span>
      </div>
    </section>
  );
}