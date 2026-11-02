import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";
import { updateSetting, useSystemSettings } from "@/pages/app/settings/settingsStore";
import { DEFAULT_RENEWAL_SLA_DAYS } from "@/pages/app/modules/documentos/renewalStore";
import { documentTypes } from "@/mocks/documents";

const PRESETS = [7, 15, 30, 45, 60, 90];
const IDLE_PRESETS = [3, 5, 7, 10, 15];
const WARNING_PRESETS = [1, 3, 5, 7, 10];
const MANAGER_WARNING_PRESETS = [5, 7, 10, 15, 20];
const ESCALATION_PRESETS = [2, 3, 5, 7, 10];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Prazo (SLA) de renovação por tipo de documento.
 *
 * O prazo conta a partir da abertura da solicitação e define a data-limite de
 * conclusão. Ele alimenta o alerta de atraso na fila de solicitações, a
 * aderência ao SLA e o relatório por unidade.
 */
export default function DocumentRenewalSlaSettings() {
  const session = useAppSession();
  const settings = useSystemSettings();
  const stored = settings.documentRenewalSlaDays;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [idleDraft, setIdleDraft] = useState<string | null>(null);
  const [warningDraft, setWarningDraft] = useState<string | null>(null);
  const [managerWarningDraft, setManagerWarningDraft] = useState<string | null>(null);
  const [escalationDraft, setEscalationDraft] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ tone: "ok" | "error" | "info"; message: string } | null>(
    null
  );
  const [search, setSearch] = useState("");

  const actor = { name: session.name };

  const commit = (typeId: string, raw: string) => {
    const next = { ...stored };
    const value = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(value) || value <= 0) delete next[typeId];
    else next[typeId] = Math.min(365, value);
    updateSetting("documentRenewalSlaDays", next, actor);
    setDraft((prev) => {
      const copy = { ...prev };
      delete copy[typeId];
      return copy;
    });
  };

  const idleDays = settings.documentRenewalIdleDays;
  const warningDays = Math.max(0, Math.round(settings.documentRenewalSlaWarningDays));
  const managerWarningDays = Math.max(0, Math.round(settings.documentRenewalManagerWarningDays));
  const escalationDays = Math.max(0, Math.round(settings.documentRenewalEscalationDays));

  // Aviso antecipado do prazo: 0 desliga o aviso, o alerta de estouro continua.
  const commitWarningDays = (raw: string) => {
    const value = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(value) || value < 0) {
      setWarningDraft(null);
      return;
    }
    updateSetting("documentRenewalSlaWarningDays", Math.min(60, value), actor);
    setWarningDraft(null);
  };

  // Aviso ao gestor: janela independente da janela do responsável pela tratativa.
  const commitManagerWarningDays = (raw: string) => {
    const value = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(value) || value < 0) {
      setManagerWarningDraft(null);
      return;
    }
    updateSetting("documentRenewalManagerWarningDays", Math.min(60, value), actor);
    setManagerWarningDraft(null);
  };

  // Escalonamento: dias após um aviso sem movimentação para reavisar o gestor.
  const commitEscalationDays = (raw: string) => {
    const value = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(value) || value < 0) {
      setEscalationDraft(null);
      return;
    }
    updateSetting("documentRenewalEscalationDays", Math.min(60, value), actor);
    setEscalationDraft(null);
  };

  // Envio de validação do e-mail de prazo: usa o mesmo modelo do aviso real,
  // marcado como teste, para conferir remetente e entrega antes de depender dele.
  const handleSendTest = async () => {
    const email = testEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setTestFeedback({ tone: "error", message: "Informe um e-mail válido para receber o aviso de teste." });
      return;
    }
    setTestSending(true);
    setTestFeedback(null);
    const days = managerWarningDays > 0 ? managerWarningDays : settings.documentRenewalSlaWarningDays || 3;
    const dueAt = new Date(Date.now() + days * 86400000).toISOString();
    try {
      const { data, error } = await supabase.functions.invoke("notify-renewal-deadline", {
        body: {
          companyName: session.company || "Sua empresa",
          test: true,
          groups: [
            {
              audience: "gestor",
              recipient: email,
              label: session.name || "Gestão",
              requests: [
                {
                  requestId: "teste-parametrizacao",
                  documentName: "Documento de exemplo (teste)",
                  documentTypeName: "ASO — Atestado de Saúde Ocupacional",
                  collaboratorName: "Colaborador de exemplo",
                  ownerName: "Responsável de exemplo",
                  managerName: session.name || "Gestor",
                  unit: "Unidade de exemplo",
                  dueAt,
                  slaDays: 30,
                  remainingDays: days,
                },
              ],
            },
          ],
        },
      });
      if (error) throw error;
      const result = (data ?? {}) as { sent?: boolean; reason?: string; detail?: string };
      if (result.sent === true) {
        setTestFeedback({
          tone: "ok",
          message: `Aviso de teste enviado para ${email}. Confira a caixa de entrada (e o spam) para validar o remetente.`,
        });
      } else if (result.reason === "resend-not-configured") {
        setTestFeedback({
          tone: "error",
          message:
            "O envio ainda não está configurado no backend: falta RESEND_API_KEY e RESEND_FROM_DOMAIN nos secrets da função.",
        });
      } else {
        setTestFeedback({
          tone: "error",
          message:
            result.detail || "O provedor recusou o envio do teste. Verifique o domínio verificado no Resend e tente novamente.",
        });
      }
    } catch {
      setTestFeedback({
        tone: "error",
        message: "Não foi possível acionar o envio de teste agora. Verifique a conexão e tente novamente.",
      });
    } finally {
      setTestSending(false);
    }
  };

  const commitIdleDays = (raw: string) => {    const value = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(value) || value <= 0) {
      setIdleDraft(null);
      return;
    }
    updateSetting("documentRenewalIdleDays", Math.min(120, Math.max(1, value)), actor);
    setIdleDraft(null);
  };

  const applyPresetToAll = (days: number) => {
    const next: Record<string, number> = {};
    documentTypes.forEach((type) => {
      next[type.id] = days;
    });
    updateSetting("documentRenewalSlaDays", next, actor);
    setDraft({});
  };

  const resetAll = () => {
    updateSetting("documentRenewalSlaDays", {}, actor);
    setDraft({});
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documentTypes;
    return documentTypes.filter((type) => type.name.toLowerCase().includes(term));
  }, [search]);

  const customCount = documentTypes.filter((type) => {
    const value = Number(stored[type.id]);
    return Number.isFinite(value) && value > 0;
  }).length;

  const averageDays = useMemo(() => {
    const values = documentTypes.map((type) => {
      const value = Number(stored[type.id]);
      return Number.isFinite(value) && value > 0 ? value : DEFAULT_RENEWAL_SLA_DAYS;
    });
    if (values.length === 0) return DEFAULT_RENEWAL_SLA_DAYS;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [stored]);

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-timer-flash-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold text-foreground-950">
              Prazo (SLA) de renovação de documentos
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
              Defina em quantos dias a renovação de cada tipo de documento deve ser concluída. O prazo
              começa na abertura da solicitação e vira a data-limite usada no alerta de atraso, na
              aderência ao SLA e no relatório por unidade.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
            <i className="ri-equalizer-2-line"></i>
            {customCount} de {documentTypes.length} com prazo próprio
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
            <i className="ri-timer-line"></i>
            média de {averageDays} dia(s)
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-background-200 bg-background-100/70 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
            <i className="ri-pause-circle-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground-900">Aviso de tratativa paralisada</p>
            <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-foreground-600">
              Se a solicitação ficar sem nenhuma movimentação — tarefa concluída, agendamento, e-mail,
              anexo ou delegação — por mais dias do que o limite abaixo, ela aparece no sino de
              notificações e fica marcada como <strong className="font-semibold">parada</strong> na fila de
              tratativas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {IDLE_PRESETS.map((preset) => {
            const active = idleDays === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => commitIdleDays(String(preset))}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-accent-300 bg-accent-100 text-accent-900"
                    : "border-background-300 bg-background-50 text-foreground-600 hover:border-accent-300 hover:bg-accent-50"
                }`}
              >
                {preset} dias
              </button>
            );
          })}
          <div className="ml-1 flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              value={idleDraft ?? String(idleDays)}
              aria-label="Dias sem movimentação para avisar no sino"
              onChange={(event) => setIdleDraft(event.target.value)}
              onBlur={(event) => commitIdleDays(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitIdleDays((event.target as HTMLInputElement).value);
                }
              }}
              className="w-16 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-right text-[12px] font-semibold text-foreground-900 outline-none transition-colors focus:border-accent-400"
            />
            <span className="text-[11px] font-semibold text-foreground-500">dia(s)</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-background-200 bg-background-100/70 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
            <i className="ri-time-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground-900">
              Aviso de prazo ao responsável da tratativa
            </p>
            <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-foreground-600">
              Quantos dias <strong className="font-semibold">antes</strong> da data-limite o responsável
              pela condução passa a ver a tratativa no atalho{" "}
              <strong className="font-semibold">Vencendo</strong> da fila e recebe o e-mail automático de
              prazo. É o aviso mais próximo do vencimento.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {WARNING_PRESETS.map((preset) => {
            const active = warningDays === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => commitWarningDays(String(preset))}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-accent-300 bg-accent-100 text-accent-900"
                    : "border-background-300 bg-background-50 text-foreground-600 hover:border-accent-300 hover:bg-accent-50"
                }`}
              >
                {preset} dia(s) antes
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => commitWarningDays("0")}
            aria-pressed={warningDays === 0}
            title="Não avisar o responsável antes do prazo (o alerta de SLA estourado continua)"
            className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              warningDays === 0
                ? "border-secondary-300 bg-secondary-100 text-secondary-900"
                : "border-background-300 bg-background-50 text-foreground-600 hover:border-secondary-300 hover:bg-secondary-50"
            }`}
          >
            <i className="ri-notification-off-line text-xs"></i>
            Desligado
          </button>
          <div className="ml-1 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={warningDraft ?? String(warningDays)}
              aria-label="Dias de antecedência do aviso ao responsável da tratativa"
              onChange={(event) => setWarningDraft(event.target.value)}
              onBlur={(event) => commitWarningDays(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitWarningDays((event.target as HTMLInputElement).value);
                }
              }}
              className="w-16 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-right text-[12px] font-semibold text-foreground-900 outline-none transition-colors focus:border-accent-400"
            />
            <span className="text-[11px] font-semibold text-foreground-500">dia(s)</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-background-200 bg-background-100/70 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
            <i className="ri-user-star-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground-900">
              Aviso de prazo ao gestor
            </p>
            <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-foreground-600">
              Segunda janela, com prazo próprio: quantos dias antes da data-limite o{" "}
              <strong className="font-semibold">gestor</strong> é avisado no sino de notificações e por
              e-mail. Gerenciar antes do responsável costuma dar tempo de remanejar clínica, turma ou
              fornecedor.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {MANAGER_WARNING_PRESETS.map((preset) => {
            const active = managerWarningDays === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => commitManagerWarningDays(String(preset))}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-secondary-300 bg-secondary-100 text-secondary-900"
                    : "border-background-300 bg-background-50 text-foreground-600 hover:border-secondary-300 hover:bg-secondary-50"
                }`}
              >
                {preset} dia(s) antes
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => commitManagerWarningDays("0")}
            aria-pressed={managerWarningDays === 0}
            title="Não avisar o gestor antes do prazo (o alerta de SLA estourado continua)"
            className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              managerWarningDays === 0
                ? "border-secondary-300 bg-secondary-100 text-secondary-900"
                : "border-background-300 bg-background-50 text-foreground-600 hover:border-secondary-300 hover:bg-secondary-50"
            }`}
          >
            <i className="ri-notification-off-line text-xs"></i>
            Desligado
          </button>
          <div className="ml-1 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={managerWarningDraft ?? String(managerWarningDays)}
              aria-label="Dias de antecedência do aviso ao gestor"
              onChange={(event) => setManagerWarningDraft(event.target.value)}
              onBlur={(event) => commitManagerWarningDays(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitManagerWarningDays((event.target as HTMLInputElement).value);
                }
              }}
              className="w-16 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-right text-[12px] font-semibold text-foreground-900 outline-none transition-colors focus:border-secondary-400"
            />
            <span className="text-[11px] font-semibold text-foreground-500">dia(s)</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-background-200 bg-background-100/70 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger-100 text-danger-800">
            <i className="ri-arrow-up-double-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-foreground-900">Escalonamento ao gestor</p>
            <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-foreground-600">
              Se depois de um aviso de prazo a tratativa ficar <strong className="font-semibold">sem nenhuma
              movimentação</strong> por mais dias do que o limite abaixo, o gestor é avisado novamente por e-mail —
              mesmo que o prazo já tenha estourado. Um escalonamento por data-limite.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {ESCALATION_PRESETS.map((preset) => {
            const active = escalationDays === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => commitEscalationDays(String(preset))}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-danger-300 bg-danger-100 text-danger-900"
                    : "border-background-300 bg-background-50 text-foreground-600 hover:border-danger-300 hover:bg-danger-50"
                }`}
              >
                {preset} dias
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => commitEscalationDays("0")}
            aria-pressed={escalationDays === 0}
            title="Não reavisar o gestor quando a tratativa fica parada"
            className={`inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              escalationDays === 0
                ? "border-secondary-300 bg-secondary-100 text-secondary-900"
                : "border-background-300 bg-background-50 text-foreground-600 hover:border-secondary-300 hover:bg-secondary-50"
            }`}
          >
            <i className="ri-notification-off-line text-xs"></i>
            Desligado
          </button>
          <div className="ml-1 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={escalationDraft ?? String(escalationDays)}
              aria-label="Dias após o aviso para escalonar ao gestor"
              onChange={(event) => setEscalationDraft(event.target.value)}
              onBlur={(event) => commitEscalationDays(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitEscalationDays((event.target as HTMLInputElement).value);
                }
              }}
              className="w-16 rounded-md border border-background-300 bg-background-50 px-2 py-1.5 text-right text-[12px] font-semibold text-foreground-900 outline-none transition-colors focus:border-danger-400"
            />
            <span className="text-[11px] font-semibold text-foreground-500">dia(s)</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground-900">
            <i className="ri-mail-check-line text-sm text-primary-700"></i>
            Enviar aviso de teste
          </p>
          <p className="max-w-2xl text-[11px] leading-relaxed text-foreground-600">
            Valide o envio antes de depender dele: o teste usa o mesmo modelo e o mesmo remetente configurado no
            backend, marcado como <strong className="font-semibold">[TESTE]</strong>. Nenhuma tratativa real é avisada.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex w-full items-center rounded-lg border border-background-300 bg-background-50 pl-1 pr-2 transition-colors focus-within:border-primary-400 sm:max-w-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground-400">
              <i className="ri-mail-line text-sm"></i>
            </span>
            <input
              type="email"
              value={testEmail}
              onChange={(event) => {
                setTestEmail(event.target.value);
                setTestFeedback(null);
              }}
              placeholder={session.email || "seu.email@empresa.com.br"}
              aria-label="E-mail que vai receber o aviso de teste"
              className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSendTest()}
            disabled={testSending}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-wait disabled:opacity-60"
          >
            <i className={testSending ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
            {testSending ? "Enviando teste..." : "Enviar aviso de teste"}
          </button>
        </div>
        {testFeedback && (
          <p
            className={`flex items-start gap-1.5 rounded-md border px-2.5 py-2 text-[11px] leading-snug ${
              testFeedback.tone === "ok"
                ? "border-primary-200 bg-primary-50 text-primary-900"
                : "border-danger-200 bg-danger-50 text-danger-800"
            }`}
          >
            <i
              className={
                testFeedback.tone === "ok" ? "ri-checkbox-circle-line mt-0.5" : "ri-error-warning-line mt-0.5"
              }
            ></i>
            <span>{testFeedback.message}</span>
          </p>
        )}
      </div>

      <div className="border-b border-background-200 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground-600">Aplicar em todos os tipos</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPresetToAll(preset)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                >
                  <i className="ri-timer-line text-sm"></i>
                  {preset} dias
                </button>
              ))}
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
              >
                <i className="ri-restart-line text-sm"></i>
                Usar padrão ({DEFAULT_RENEWAL_SLA_DAYS} dias)
              </button>
            </div>
          </div>

          <div className="flex items-center rounded-lg border border-background-300 bg-background-50 pl-1 pr-2 transition-colors focus-within:border-primary-400 lg:w-72">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tipo de documento..."
              className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
          </div>
        </div>
      </div>

      <ul className="max-h-[420px] divide-y divide-background-100 overflow-y-auto">
        {filtered.map((type) => {
          const storedValue = Number(stored[type.id]);
          const hasCustom = Number.isFinite(storedValue) && storedValue > 0;
          const inputValue = draft[type.id] ?? (hasCustom ? String(storedValue) : "");
          return (
            <li
              key={type.id}
              className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    type.scope === "empresa"
                      ? "bg-secondary-100 text-secondary-800"
                      : "bg-background-100 text-foreground-600"
                  }`}
                >
                  <i className={type.scope === "empresa" ? "ri-building-2-line" : "ri-user-line"}></i>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-foreground-900">{type.name}</p>
                  <p className="text-[10px] text-foreground-500">
                    {type.scope === "empresa" ? "Documento da empresa" : "Documento do colaborador"}
                    {hasCustom ? ` · prazo próprio de ${storedValue} dia(s)` : " · usa o prazo padrão"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    inputMode="numeric"
                    value={inputValue}
                    placeholder={String(DEFAULT_RENEWAL_SLA_DAYS)}
                    aria-label={`Prazo de renovação para ${type.name}`}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((prev) => ({ ...prev, [type.id]: value }));
                    }}
                    onBlur={(event) => commit(type.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commit(type.id, (event.target as HTMLInputElement).value);
                      }
                    }}
                    className="w-20 rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-right text-[12px] font-semibold text-foreground-900 outline-none transition-colors focus:border-primary-400"
                  />
                  <span className="text-[11px] font-semibold text-foreground-500">dia(s)</span>
                </div>
                {hasCustom && (
                  <button
                    type="button"
                    onClick={() => commit(type.id, "")}
                    title="Voltar ao prazo padrão"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-foreground-800"
                  >
                    <i className="ri-restart-line text-xs"></i>
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-5 py-8 text-center text-xs text-foreground-500">
            Nenhum tipo de documento encontrado para esta busca.
          </li>
        )}
      </ul>

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-600">
        <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          Tipos sem prazo próprio usam o padrão de{" "}
          <strong className="font-semibold">{DEFAULT_RENEWAL_SLA_DAYS} dias</strong>. Ao alterar um prazo, as
          solicitações já abertas mantêm a data-limite calculada na abertura — o novo prazo vale para as
          próximas.
        </span>
      </div>
    </section>
  );
}