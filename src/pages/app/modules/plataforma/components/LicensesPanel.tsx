import { useCallback, useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { platformApi, type PlatformLicenseRow } from "@/pages/app/modules/plataforma/platformApi";

const planPrice: Record<string, number> = { S1: 149, S2: 449, S3: 1290 };

const licenseStatusLabel: Record<string, string> = {
  active: "Ativa",
  trial: "Em teste",
  suspended: "Suspensa",
  canceled: "Cancelada",
};

const cycleLabel: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const statusTone: Record<string, string> = {
  active: "bg-primary-100 text-primary-700",
  trial: "bg-secondary-100 text-secondary-900",
  suspended: "bg-accent-200 text-accent-900",
  canceled: "bg-background-200 text-foreground-600",
};

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return value;
  }
}

interface EditState {
  companyId: string;
  companyName: string;
  plan: string;
  seats: string;
  monthlyValue: string;
  billingCycle: string;
  status: string;
  nextDueDate: string;
  notes: string;
}

export default function LicensesPanel() {
  const [rows, setRows] = useState<PlatformLicenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await platformApi.licenses();
      setRows(data.licenses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as licenças.");
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

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const planOk = planFilter === "all" || row.plan === planFilter;
        const statusOk = statusFilter === "all" || row.status === statusFilter;
        return planOk && statusOk;
      }),
    [rows, planFilter, statusFilter]
  );

  const totals = useMemo(() => {
    const active = rows.filter((row) => row.status === "active" || row.status === "trial");
    return {
      contracts: active.length,
      mrr: active.reduce((acc, row) => acc + (row.status === "trial" ? 0 : row.monthlyValue), 0),
      seats: rows.reduce((acc, row) => acc + row.seats, 0),
      collaborators: rows.reduce((acc, row) => acc + row.collaborators, 0),
    };
  }, [rows]);

  const openEdit = (row: PlatformLicenseRow) => {
    setEditing({
      companyId: row.companyId,
      companyName: row.companyName,
      plan: row.plan,
      seats: String(row.seats ?? 0),
      monthlyValue: String(row.monthlyValue ?? 0),
      billingCycle: row.billingCycle,
      status: row.status,
      nextDueDate: row.nextDueDate ? row.nextDueDate.slice(0, 10) : "",
      notes: row.notes ?? "",
    });
  };

  const changePlan = (plan: string) => {
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            plan,
            monthlyValue: prev.monthlyValue === "0" || prev.monthlyValue === "" ? String(planPrice[plan] ?? 0) : prev.monthlyValue,
          }
        : prev
    );
  };

  const save = async () => {
    if (!editing) return;
    const seats = Number(editing.seats);
    const value = Number(editing.monthlyValue.replace(",", "."));
    if (!Number.isFinite(seats) || seats < 0) {
      setError("Informe um número de assentos válido.");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setError("Informe um valor mensal válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await platformApi.saveLicense({
        companyId: editing.companyId,
        plan: editing.plan,
        seats,
        monthlyValue: value,
        billingCycle: editing.billingCycle,
        status: editing.status,
        nextDueDate: editing.nextDueDate || null,
        notes: editing.notes || null,
      });
      setEditing(null);
      setMessage("Licença atualizada e registrada na auditoria.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a licença.");
    } finally {
      setSaving(false);
    }
  };

  const exportHeaders = [
    "Empresa",
    "Subdomínio",
    "Plano",
    "Assentos",
    "Colaboradores",
    "Mensalidade",
    "Ciclo",
    "Próximo vencimento",
    "Situação",
  ];

  const toExportRow = (row: PlatformLicenseRow): string[] => [
    row.companyName,
    `${row.subdomain}.sstek.com`,
    row.plan,
    String(row.seats),
    String(row.collaborators),
    money(row.monthlyValue),
    cycleLabel[row.billingCycle] ?? row.billingCycle,
    formatDate(row.nextDueDate),
    licenseStatusLabel[row.status] ?? row.status,
  ];

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `licencas-planos-${stamp}.csv`,
      exportHeaders,
      filtered.map((row) => toExportRow(row))
    );
  };

  const exportPdf = () => {
    const body = `${pdfHeader("Licenças & planos")}
      <h1>Licenças &amp; planos</h1>
      <p class="muted">${filtered.length} contrato(s) · valores em reais (BRL)</p>
      <div class="kpis">
        <div class="kpi"><b>${totals.contracts}</b><span>Contratos ativos</span></div>
        <div class="kpi"><b>${money(totals.mrr)}</b><span>Receita recorrente</span></div>
        <div class="kpi"><b>${totals.seats}</b><span>Assentos contratados</span></div>
        <div class="kpi"><b>${totals.collaborators}</b><span>Colaboradores cadastrados</span></div>
      </div>
      ${tableHtml(exportHeaders, filtered.map((row) => toExportRow(row)))}
      <div class="foot"><span>SSTEK · Administração da plataforma</span><span>Emitido em ${todayBr()}</span></div>`;
    printHtml("Licenças e planos", body);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-16">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando licenças…
        </span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 px-4 py-4 text-sm text-accent-900 sm:flex-row sm:items-center sm:justify-between">
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
          { label: "Contratos ativos", value: String(totals.contracts), icon: "ri-file-list-3-line", tone: "bg-primary-100 text-primary-700" },
          { label: "Receita recorrente (MRR)", value: money(totals.mrr), icon: "ri-line-chart-line", tone: "bg-accent-100 text-accent-800" },
          { label: "Assentos contratados", value: String(totals.seats), icon: "ri-user-3-line", tone: "bg-secondary-100 text-secondary-900" },
          { label: "Colaboradores cadastrados", value: String(totals.collaborators), icon: "ri-team-line", tone: "bg-primary-100 text-primary-700" },
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
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todos os planos</option>
            <option value="S1">Licença S1</option>
            <option value="S2">Licença S2</option>
            <option value="S3">Licença S3</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
          >
            <option value="all">Todas as situações</option>
            <option value="active">Ativa</option>
            <option value="trial">Em teste</option>
            <option value="suspended">Suspensa</option>
            <option value="canceled">Cancelada</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-[11px] text-foreground-500">
            {filtered.length} empresa(s) · valores em reais (BRL)
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
                {["Empresa", "Plano", "Assentos", "Colaboradores", "Mensalidade", "Ciclo", "Próximo vencimento", "Situação", ""].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-foreground-500">
                    Nenhuma licença encontrada com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.companyId} className="border-b border-background-100 last:border-0">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-foreground-950">{row.companyName}</p>
                    <p className="text-xs text-foreground-500">{row.subdomain}.sstek.com</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-semibold text-foreground-700">
                      {row.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-foreground-700">{row.seats}</td>
                  <td className="px-4 py-3.5 text-sm text-foreground-700">{row.collaborators}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-foreground-900">{money(row.monthlyValue)}</td>
                  <td className="px-4 py-3.5 text-xs text-foreground-600">{cycleLabel[row.billingCycle] ?? row.billingCycle}</td>
                  <td className="px-4 py-3.5 text-xs text-foreground-600">{formatDate(row.nextDueDate)}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        statusTone[row.status] ?? "bg-background-200 text-foreground-700"
                      }`}
                    >
                      {licenseStatusLabel[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-edit-line"></i>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Licença · ${editing.companyName}` : "Licença"}
        subtitle="Plano, assentos e cobrança recorrente da empresa. Toda alteração fica registrada na auditoria."
        icon="ri-bank-card-line"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </ModalButton>
            <ModalButton icon="ri-save-3-line" onClick={() => void save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar licença"}
            </ModalButton>
          </>
        }
      >
        {editing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Plano" required>
              <select value={editing.plan} onChange={(e) => changePlan(e.target.value)} className={selectClass}>
                <option value="S1">Licença S1 — até 10 colaboradores</option>
                <option value="S2">Licença S2 — até 60 colaboradores</option>
                <option value="S3">Licença S3 — sob consulta</option>
              </select>
            </Field>
            <Field label="Situação" required>
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                className={selectClass}
              >
                <option value="active">Ativa</option>
                <option value="trial">Em teste</option>
                <option value="suspended">Suspensa</option>
                <option value="canceled">Cancelada</option>
              </select>
            </Field>
            <Field label="Assentos contratados" required hint="Número de colaboradores previstos no contrato.">
              <input
                type="number"
                min={0}
                value={editing.seats}
                onChange={(e) => setEditing({ ...editing, seats: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Mensalidade (R$)" required hint={`Sugestão do plano: ${money(planPrice[editing.plan] ?? 0)}`}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editing.monthlyValue}
                onChange={(e) => setEditing({ ...editing, monthlyValue: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Ciclo de cobrança">
              <select
                value={editing.billingCycle}
                onChange={(e) => setEditing({ ...editing, billingCycle: e.target.value })}
                className={selectClass}
              >
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </Field>
            <Field label="Próximo vencimento">
              <input
                type="date"
                value={editing.nextDueDate}
                onChange={(e) => setEditing({ ...editing, nextDueDate: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <textarea
                rows={3}
                maxLength={500}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Condições comerciais, descontos ou observações do contrato."
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}