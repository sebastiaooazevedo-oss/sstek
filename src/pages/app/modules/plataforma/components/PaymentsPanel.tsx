import { useCallback, useEffect, useMemo, useState } from "react";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { platformApi, type PlatformInvoiceCompany, type PlatformInvoiceRow } from "@/pages/app/modules/plataforma/platformApi";

const invoiceStatusLabel: Record<string, string> = {
  paid: "Paga",
  pending: "Em aberto",
  overdue: "Em atraso",
  canceled: "Cancelada",
};

const invoiceStatusTone: Record<string, string> = {
  paid: "bg-primary-100 text-primary-700",
  pending: "bg-secondary-100 text-secondary-900",
  overdue: "bg-accent-200 text-accent-900",
  canceled: "bg-background-200 text-foreground-600",
};

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(reference: string): string {
  if (!/^\d{4}-\d{2}$/.test(reference)) return reference;
  const [year, month] = reference.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const slice = value.slice(0, 10);
  try {
    return new Date(`${slice}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return slice;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export default function PaymentsPanel() {
  const [invoices, setInvoices] = useState<PlatformInvoiceRow[]>([]);
  const [companies, setCompanies] = useState<PlatformInvoiceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformApi.payments();
      setInvoices(data.invoices ?? []);
      setCompanies(data.companies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os pagamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const months = useMemo(
    () => Array.from(new Set(invoices.map((invoice) => invoice.reference_month))).sort((a, b) => b.localeCompare(a)),
    [invoices]
  );

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const totals = useMemo(() => {
    const monthSet = invoices.filter((invoice) => invoice.reference_month === currentMonth);
    const sum = (list: PlatformInvoiceRow[]) => list.reduce((acc, invoice) => acc + invoice.amount, 0);
    return {
      received: sum(monthSet.filter((invoice) => invoice.status === "paid")),
      open: sum(monthSet.filter((invoice) => invoice.status === "pending")),
      overdue: sum(invoices.filter((invoice) => invoice.status === "overdue")),
      invoiced: sum(monthSet),
    };
  }, [invoices, currentMonth]);

  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        const monthOk = monthFilter === "all" || invoice.reference_month === monthFilter;
        const statusOk = statusFilter === "all" || invoice.status === statusFilter;
        const companyOk = companyFilter === "all" || invoice.company_id === companyFilter;
        return monthOk && statusOk && companyOk;
      }),
    [invoices, monthFilter, statusFilter, companyFilter]
  );

  const setStatus = async (invoice: PlatformInvoiceRow, status: string) => {
    setBusyId(invoice.id);
    setError(null);
    try {
      await platformApi.updateInvoice(invoice.id, status, status === "paid" ? "manual" : undefined);
      setMessage(
        status === "paid"
          ? `Cobrança de ${monthLabel(invoice.reference_month)} marcada como paga.`
          : `Cobrança de ${monthLabel(invoice.reference_month)} reaberta.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a cobrança.");
    } finally {
      setBusyId(null);
    }
  };

  const exportHeaders = [
    "Competência",
    "Empresa",
    "Plano",
    "Valor",
    "Vencimento",
    "Situação",
    "Pagamento",
  ];

  const toExportRow = (invoice: PlatformInvoiceRow): string[] => [
    monthLabel(invoice.reference_month),
    invoice.company_name ?? "—",
    invoice.company_plan ?? "—",
    money(invoice.amount),
    formatDate(invoice.due_date),
    invoiceStatusLabel[invoice.status] ?? invoice.status,
    invoice.status === "paid" ? formatDateTime(invoice.paid_at) : "—",
  ];

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `pagamentos-${stamp}.csv`,
      exportHeaders,
      filtered.map((invoice) => toExportRow(invoice))
    );
  };

  const exportPdf = () => {
    const body = `${pdfHeader("Pagamentos")}
      <h1>Pagamentos</h1>
      <p class="muted">${filtered.length} cobrança(s) · valores em reais (BRL)</p>
      <div class="kpis">
        <div class="kpi"><b>${money(totals.received)}</b><span>Recebido no mês</span></div>
        <div class="kpi"><b>${money(totals.open)}</b><span>Em aberto no mês</span></div>
        <div class="kpi"><b>${money(totals.overdue)}</b><span>Em atraso (total)</span></div>
        <div class="kpi"><b>${money(totals.invoiced)}</b><span>Faturado no mês</span></div>
      </div>
      ${tableHtml(exportHeaders, filtered.map((invoice) => toExportRow(invoice)))}
      <div class="foot"><span>SSTEK · Administração da plataforma</span><span>Emitido em ${todayBr()}</span></div>`;
    printHtml("Pagamentos", body);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-16">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando pagamentos…
        </span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 px-4 py-4 text-sm text-accent-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <i className="ri-error-warning-line mt-0.5"></i>
            {error}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-accent-700"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        </div>
      )}

      {message && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-xs leading-relaxed text-primary-900">
          <i className="ri-checkbox-circle-line mt-0.5 text-sm"></i>
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Recebido no mês", value: money(totals.received), icon: "ri-money-dollar-circle-line", tone: "bg-primary-100 text-primary-700" },
          { label: "Em aberto no mês", value: money(totals.open), icon: "ri-time-line", tone: "bg-secondary-100 text-secondary-900" },
          { label: "Em atraso (total)", value: money(totals.overdue), icon: "ri-alarm-warning-line", tone: "bg-accent-100 text-accent-800" },
          { label: "Faturado no mês", value: money(totals.invoiced), icon: "ri-file-list-3-line", tone: "bg-background-200 text-foreground-700" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-background-200 bg-background-50 p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.tone}`}>
              <i className={`${kpi.icon} text-lg`}></i>
            </span>
            <p className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">{kpi.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todos os meses</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todas as situações</option>
            <option value="paid">Pagas</option>
            <option value="pending">Em aberto</option>
            <option value="overdue">Em atraso</option>
            <option value="canceled">Canceladas</option>
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todas as empresas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-[11px] text-foreground-500">
            {filtered.length} cobrança(s) · valores em reais (BRL)
          </p>
          <ExportMenu
            compact
            disabled={filtered.length === 0}
            onExportCsv={exportCsv}
            onExportPdf={exportPdf}
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                {["Competência", "Empresa", "Plano", "Valor", "Vencimento", "Situação", "Pagamento", ""].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-foreground-500">
                    Nenhuma cobrança encontrada com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((invoice) => (
                <tr key={invoice.id} className="border-b border-background-100 last:border-0">
                  <td className="px-4 py-3.5 text-sm font-semibold text-foreground-900">
                    {monthLabel(invoice.reference_month)}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-foreground-900">{invoice.company_name ?? "—"}</p>
                    {invoice.company_subdomain && (
                      <p className="text-xs text-foreground-500">{invoice.company_subdomain}.sstek.com</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-semibold text-foreground-700">
                      {invoice.company_plan ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-foreground-900">{money(invoice.amount)}</td>
                  <td className="px-4 py-3.5 text-xs text-foreground-600">{formatDate(invoice.due_date)}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        invoiceStatusTone[invoice.status] ?? "bg-background-200 text-foreground-700"
                      }`}
                    >
                      {invoiceStatusLabel[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-foreground-600">
                    {invoice.status === "paid" ? formatDateTime(invoice.paid_at) : "—"}
                    {invoice.method && invoice.status === "paid" && (
                      <span className="ml-1 text-foreground-400">({invoice.method})</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {invoice.status === "paid" ? (
                      <button
                        type="button"
                        disabled={busyId === invoice.id}
                        onClick={() => void setStatus(invoice, "pending")}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i className="ri-arrow-go-back-line"></i>
                        Reabrir
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === invoice.id || invoice.status === "canceled"}
                        onClick={() => void setStatus(invoice, "paid")}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <i className={busyId === invoice.id ? "ri-loader-4-line animate-spin" : "ri-check-line"}></i>
                        Marcar paga
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-foreground-400">
        <i className="ri-shield-check-line mt-0.5 text-primary-600"></i>
        Cada alteração de cobrança registra autor, empresa, competência, valor e data/hora na auditoria da plataforma.
      </p>
    </div>
  );
}