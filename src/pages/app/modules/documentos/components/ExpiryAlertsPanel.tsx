import { useMemo, useState } from "react";
import type { DocumentRecord } from "@/mocks/documents";
import { daysUntilExpiry, expiryDaysLabel, canRequestRenewal } from "@/pages/app/modules/documentos/documentUtils";
import { renewalStatusMeta, type RenewalRequest } from "@/pages/app/modules/documentos/renewalStore";

interface ExpiryAlertsPanelProps {
  documents: DocumentRecord[];
  /** Abre o cadastro/edição de validade do documento escolhido. */
  onEditValidity: (doc: DocumentRecord) => void;
  /** Abre (ou cria) a solicitação de renovação do documento. */
  onRequestRenewal: (doc: DocumentRecord) => void;
  /** Solicitação em andamento/concluída do documento, quando existir. */
  requestFor: (documentId: string) => RenewalRequest | null;
  /** Janela (em dias) parametrizada no ambiente administrativo. */
  alertDays: number;
  /** Quantidade de e-mails cadastrados para receber o aviso. */
  recipientCount: number;
  /** Dispara agora o aviso por e-mail. */
  onNotifyByEmail: () => void;
  notifying: boolean;
  /** Mensagem do último envio (sucesso ou motivo de não ter enviado). */
  emailFeedback: string;
}

type TabKey = "vencidos" | "vencendo" | "sem-validade";

interface ExpiryEntry {
  doc: DocumentRecord;
  days: number;
}

const tabMeta: { id: TabKey; label: string; icon: string }[] = [
  { id: "vencidos", label: "Vencidos", icon: "ri-error-warning-line" },
  { id: "vencendo", label: "Vencendo", icon: "ri-timer-line" },
  { id: "sem-validade", label: "Sem validade", icon: "ri-calendar-event-line" },
];

function daysBadge(days: number): string {
  if (days < 0) return "bg-danger-100 text-danger-800 ring-1 ring-danger-200";
  if (days <= 7) return "bg-accent-200 text-accent-900";
  if (days <= 30) return "bg-accent-100 text-accent-800";
  return "bg-secondary-100 text-secondary-900";
}

export default function ExpiryAlertsPanel({
  documents,
  onEditValidity,
  onRequestRenewal,
  requestFor,
  alertDays,
  recipientCount,
  onNotifyByEmail,
  notifying,
  emailFeedback,
}: ExpiryAlertsPanelProps) {
  const [tabOverride, setTabOverride] = useState<TabKey | null>(null);
  const windowDays = Math.max(1, Math.round(alertDays));

  const { expired, expiring, permanent } = useMemo(() => {
    const expiredList: ExpiryEntry[] = [];
    const expiringList: ExpiryEntry[] = [];
    const permanentList: DocumentRecord[] = [];

    documents.forEach((doc) => {
      // Documento já substituído está resolvido: fica no histórico, não entra
      // nos alertas de vencimento nem na cobrança de renovação.
      if (doc.supersededByRef) return;
      const days = daysUntilExpiry(doc.expiresAt);
      if (days === null) {
        permanentList.push(doc);
        return;
      }
      if (days < 0) expiredList.push({ doc, days });
      else if (days <= windowDays) expiringList.push({ doc, days });
    });

    expiredList.sort((a, b) => a.days - b.days);
    expiringList.sort((a, b) => a.days - b.days);
    permanentList.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return { expired: expiredList, expiring: expiringList, permanent: permanentList };
  }, [documents, windowDays]);

  const counts: Record<TabKey, number> = {
    vencidos: expired.length,
    vencendo: expiring.length,
    "sem-validade": permanent.length,
  };

  const fallbackTab: TabKey = expired.length > 0 ? "vencidos" : expiring.length > 0 ? "vencendo" : "vencidos";
  const tab = tabOverride ?? fallbackTab;
  const entries = tab === "vencidos" ? expired : tab === "vencendo" ? expiring : [];
  const hasIssues = expired.length > 0 || expiring.length > 0;
  const hasExpired = expired.length > 0;

  return (
    <section
      className={`mt-6 rounded-lg border p-4 md:p-5 ${
        hasExpired
          ? "border-danger-300 bg-danger-50"
          : hasIssues
            ? "border-accent-300 bg-accent-50"
            : "border-primary-200 bg-primary-50"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              hasExpired
                ? "bg-danger-100 text-danger-800"
                : hasIssues
                  ? "bg-accent-100 text-accent-800"
                  : "bg-primary-100 text-primary-700"
            }`}
          >
            <i
              className={`${
                hasExpired ? "ri-error-warning-line" : hasIssues ? "ri-alarm-warning-line" : "ri-shield-check-line"
              } text-xl`}
            ></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">
              Alertas de vencimento
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
              {hasIssues
                ? `${expired.length} documento(s) vencido(s) e ${expiring.length} vencendo nos próximos ${windowDays} dias. Abra a solicitação de renovação e providencie o documento novo antes de uma fiscalização.`
                : `Nenhum documento vencido ou perto do vencimento (janela de ${windowDays} dias). Ainda assim, você pode cadastrar validade nos documentos que hoje são permanentes.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tabMeta.map((item) => {
            const active = tab === item.id;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTabOverride(item.id)}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? item.id === "vencidos"
                      ? "bg-danger-600 text-background-50"
                      : item.id === "vencendo"
                        ? "bg-accent-600 text-background-50"
                        : "bg-secondary-600 text-background-50"
                    : "border border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className={`${item.icon} text-sm`}></i>
                {item.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active
                      ? "bg-background-50/20 text-background-50"
                      : count > 0 && item.id === "vencidos"
                        ? "bg-danger-200 text-danger-900"
                        : count > 0 && item.id !== "sem-validade"
                          ? "bg-accent-200 text-accent-900"
                          : "bg-background-200 text-foreground-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onNotifyByEmail}
            disabled={notifying || recipientCount === 0}
            title={
              recipientCount === 0
                ? "Cadastre o e-mail do SESMT em Configurações › Alertas de vencimento de documentos"
                : "Enviar agora o aviso de vencimento por e-mail"
            }
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              notifying || recipientCount === 0
                ? "cursor-not-allowed bg-background-200 text-foreground-500"
                : "cursor-pointer bg-secondary-500 text-background-50 hover:bg-secondary-600"
            }`}
          >
            <i className={notifying ? "ri-loader-4-line animate-spin text-sm" : "ri-mail-send-line text-sm"}></i>
            {notifying ? "Enviando..." : "Avisar por e-mail"}
          </button>
        </div>
      </div>

      {(emailFeedback || recipientCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-background-200 bg-background-50 px-3.5 py-2 text-[11px] text-foreground-600">
          <i className="ri-mail-check-line text-sm text-secondary-700"></i>
          <span>
            {emailFeedback ||
              `O aviso por e-mail é enviado para ${recipientCount} destinatário(s) quando o documento entra na janela de ${windowDays} dias.`}
          </span>
        </div>
      )}

      <div className="mt-4">
        {entries.length > 0 && (
          <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            {entries.map(({ doc, days }) => {
              const request = requestFor(doc.id);
              // Peças de pleito (edital de convocação da CIPA) não entram na fila
              // de renovação: o pleito termina e a próxima edição é um novo
              // edital, dentro de um novo processo eleitoral.
              const renewalAllowed = canRequestRenewal(doc);
              return (
              <li
                key={doc.id}
                className="flex flex-col gap-2.5 rounded-lg border border-background-200 bg-background-50 px-3.5 py-3 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    days < 0 ? "bg-danger-100 text-danger-800" : "bg-accent-100 text-accent-800"
                  }`}
                >
                  <i className={`${days < 0 ? "ri-close-circle-line" : "ri-timer-line"} text-base`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{doc.name}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground-500">
                    {doc.typeName} · validade {doc.expiresAt}
                    {doc.collaboratorName ? ` · ${doc.collaboratorName}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${daysBadge(days)}`}
                >
                  <i className={days < 0 ? "ri-error-warning-line" : "ri-calendar-check-line"}></i>
                  {expiryDaysLabel(days)}
                </span>
                {!renewalAllowed ? (
                  <span
                    title="Peça de processo eleitoral: o pleito tem prazo próprio. Encerrado, emita um novo edital em um novo processo eleitoral da CIPA."
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-semibold text-secondary-900"
                  >
                    <i className="ri-government-line"></i>
                    Pleito encerrado · sem renovação
                  </span>
                ) : request ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${renewalStatusMeta[request.status].chip}`}
                    >
                      <i className={renewalStatusMeta[request.status].icon}></i>
                      {renewalStatusMeta[request.status].label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRequestRenewal(doc)}
                      className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-arrow-right-line"></i>
                      Abrir solicitação
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRequestRenewal(doc)}
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-danger-600 px-3 py-1.5 text-xs font-semibold text-background-50 transition-colors hover:bg-danger-700"
                  >
                    <i className="ri-loop-right-line"></i>
                    Solicitar renovação
                  </button>
                )}
              </li>
              );
            })}
          </ul>
        )}

        {tab === "sem-validade" && permanent.length > 0 && (
          <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
            {permanent.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2.5 rounded-lg border border-background-200 bg-background-50 px-3.5 py-3 sm:flex-row sm:items-center"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                  <i className="ri-file-unknow-line text-base"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{doc.name}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground-500">
                    {doc.typeName} · sem data de validade cadastrada
                    {doc.collaboratorName ? ` · ${doc.collaboratorName}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEditValidity(doc)}
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-primary-400 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                >
                  <i className="ri-add-line"></i>
                  Definir validade
                </button>
              </li>
            ))}
          </ul>
        )}

        {entries.length === 0 && tab !== "sem-validade" && (
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-checkbox-circle-line text-xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">
              {tab === "vencidos" ? "Nenhum documento vencido" : "Nenhum vencimento próximo"}
            </p>
            <p className="text-xs text-foreground-500">
              {tab === "vencidos"
                ? "Todos os documentos com validade estão dentro do prazo."
                : `Nenhum documento vence nos próximos ${windowDays} dias.`}
            </p>
          </div>
        )}

        {tab === "sem-validade" && permanent.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-checkbox-circle-line text-xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Todos os documentos têm validade</p>
            <p className="text-xs text-foreground-500">Não há documentos permanentes sem data de vencimento.</p>
          </div>
        )}
      </div>
    </section>
  );
}