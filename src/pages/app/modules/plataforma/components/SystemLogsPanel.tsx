import { useCallback, useEffect, useMemo, useState } from "react";
import {
  platformApi,
  type PlatformInvoiceCompany,
  type PlatformSystemLog,
} from "@/pages/app/modules/plataforma/platformApi";

type PeriodKey = "today" | "7d" | "30d" | "custom";
type ActionGroup = "all" | "created" | "deleted" | "updated" | "secret";

const moduleLabels: Record<string, string> = {
  colaboradores: "Colaboradores",
  documentos: "Documentos",
  epi: "Entregas de EPI",
  dds: "DDS",
  cipa: "CIPA",
  pesquisas: "Pesquisas",
  config: "Configurações",
  apr: "APR",
  assinaturas: "Assinaturas",
  plataforma: "Plataforma",
  sistema: "Sistema",
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  super: "Superadministrador",
};

const actionLabels: Record<string, string> = {
  created: "Inclusão",
  deleted: "Remoção",
  updated: "Alteração",
  imported: "Importação em lote",
  secret_vote_recorded: "Voto registrado (sigiloso)",
  upload_started: "Envio iniciado",
  upload_failed: "Falha no envio",
  upload_cancelled: "Envio cancelado",
  activated: "Base ativada",
  company_created: "Empresa cadastrada",
  company_updated: "Empresa atualizada",
  company_suspended: "Empresa suspensa",
  company_reactivated: "Empresa reativada",
  domain_saved: "Subdomínio atualizado",
  company_admin_linked: "Administrador vinculado",
  company_admin_updated: "Vínculo atualizado",
  support_access: "Acesso de suporte",
  caepi_batch_activated: "Base CAEPI ativada",
  access_denied: "Acesso negado",
  platform_panel_access: "Acesso ao painel global",
  platform_parameters_saved: "Parametrização atualizada",
  platform_permissions_saved: "Perfis e permissões atualizados",
  license_saved: "Licença atualizada",
  invoice_status_changed: "Cobrança atualizada",
  collaborators_imported: "Importação de colaboradores",
};

function iconFor(entry: PlatformSystemLog): string {
  if (entry.secret) return "ri-lock-2-line";
  if (entry.source === "platform") return "ri-shield-star-line";
  if (entry.action === "created" || entry.action === "imported") return "ri-add-circle-line";
  if (entry.action === "deleted") return "ri-delete-bin-6-line";
  if (entry.action === "updated") return "ri-edit-line";
  return "ri-history-line";
}

function toneFor(entry: PlatformSystemLog): string {
  if (entry.secret) return "bg-secondary-100 text-secondary-900";
  if (entry.source === "platform") return "bg-background-200 text-foreground-700";
  if (entry.action === "deleted") return "bg-accent-100 text-accent-900";
  if (entry.action === "created" || entry.action === "imported") return "bg-primary-100 text-primary-700";
  return "bg-secondary-100 text-secondary-900";
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function rangeFor(period: PeriodKey, start: string, end: string): { from: string | null; to: string | null } {
  const now = new Date();
  if (period === "today") {
    const initial = new Date(now);
    initial.setHours(0, 0, 0, 0);
    return { from: initial.toISOString(), to: null };
  }
  if (period === "7d") return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: null };
  if (period === "30d") return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: null };
  let from: string | null = null;
  let to: string | null = null;
  if (start) {
    const value = new Date(`${start}T00:00:00`);
    if (!Number.isNaN(value.getTime())) from = value.toISOString();
  }
  if (end) {
    const value = new Date(`${end}T23:59:59.999`);
    if (!Number.isNaN(value.getTime())) to = value.toISOString();
  }
  return { from, to };
}

function matchesGroup(entry: PlatformSystemLog, group: ActionGroup): boolean {
  if (group === "all") return true;
  if (group === "secret") return entry.secret;
  if (group === "created") return entry.action === "created" || entry.action === "imported";
  if (group === "deleted") return entry.action === "deleted";
  return entry.action === "updated";
}

export default function SystemLogsPanel() {
  const [companies, setCompanies] = useState<PlatformInvoiceCompany[]>([]);
  const [logs, setLogs] = useState<PlatformSystemLog[]>([]);
  const [counts, setCounts] = useState({ total: 0, created: 0, deleted: 0, secret: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("all");
  const [role, setRole] = useState("all");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [group, setGroup] = useState<ActionGroup>("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(80);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = rangeFor(period, startDate, endDate);
      const data = await platformApi.systemLogs({
        companyId: companyId === "all" ? null : companyId,
        role,
        from: range.from,
        to: range.to,
        limit: 500,
      });
      setLogs(data.logs);
      setCounts(data.counts);
      setCompanies(data.companies);
      setVisible(80);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os logs.");
    } finally {
      setLoading(false);
    }
  }, [companyId, role, period, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (!matchesGroup(entry, group)) return false;
      if (!term) return true;
      return [entry.detail, entry.actorName, entry.companyName, entry.entity, moduleLabels[entry.module] ?? entry.module]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [logs, group, search]);

  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Data/hora", "Empresa", "Módulo", "Ação", "Perfil", "Autor", "Detalhe", "Sigiloso"].join(";");
    const rows = filtered.map((entry) =>
      [
        formatDateTime(entry.createdAt),
        entry.companyName ?? "",
        moduleLabels[entry.module] ?? entry.module,
        actionLabels[entry.action] ?? entry.action,
        roleLabels[entry.actorRole ?? ""] ?? entry.actorRole ?? "Sistema",
        entry.actorName ?? "",
        entry.secret ? "Voto registrado — escolha não registrada" : entry.detail,
        entry.secret ? "Sim" : "Não",
      ]
        .map(escape)
        .join(";")
    );
    const csv = `\uFEFF${[header, ...rows].join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `logs-sistema-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Registros no período", value: counts.total, icon: "ri-history-line" },
          { label: "Inclusões e importações", value: counts.created, icon: "ri-add-circle-line" },
          { label: "Remoções", value: counts.deleted, icon: "ri-delete-bin-6-line" },
          { label: "Votos sigilosos", value: counts.secret, icon: "ri-lock-2-line" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-background-200 bg-background-50 px-4 py-3.5">
            <p className="flex items-center gap-2 text-[11px] font-medium text-foreground-500">
              <i className={`${item.icon} text-secondary-700`}></i>
              {item.label}
            </p>
            <p className="mt-1.5 font-heading text-xl font-extrabold text-foreground-950">
              {item.value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-background-200 bg-background-50 p-3.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Empresa</span>
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              <option value="all">Todas as empresas</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Perfil</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              <option value="all">Todos os perfis</option>
              <option value="admin">Administrador</option>
              <option value="colaborador">Colaborador</option>
              <option value="super">Superadministrador</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Período</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodKey)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Tipo de evento</span>
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value as ActionGroup)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              <option value="all">Todos</option>
              <option value="created">Inclusões</option>
              <option value="deleted">Remoções</option>
              <option value="updated">Alterações</option>
              <option value="secret">Votos sigilosos</option>
            </select>
          </label>

          {period === "custom" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">De</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
                />
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Buscar</span>
            <div className="flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2">
              <i className="ri-search-line text-sm text-foreground-400"></i>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Autor, empresa, documento, detalhe…"
                className="w-full bg-transparent text-xs outline-none placeholder:text-foreground-400"
              />
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-foreground-500">
            {filtered.length} registro(s) · trilha append-only, sem edição ou exclusão
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-refresh-line"></i>
              Atualizar
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-foreground-950"
            >
              <i className="ri-download-2-line"></i>
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-4 flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-14">
          <span className="flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            Carregando a trilha de auditoria…
          </span>
        </div>
      )}

      {error && !loading && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 px-4 py-4 text-sm text-accent-900 sm:flex-row sm:items-center sm:justify-between">
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

      {!loading && !error && (
        <div className="mt-4 overflow-hidden rounded-lg border border-background-200 bg-background-50">
          <div className="divide-y divide-background-100">
            {filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-xs text-foreground-500">
                Nenhum registro encontrado com esses filtros.
              </p>
            )}
            {filtered.slice(0, visible).map((entry) => (
              <div
                key={entry.uid}
                className={`flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between ${
                  entry.secret ? "bg-secondary-50/70" : ""
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneFor(entry)}`}>
                    <i className={`${iconFor(entry)} text-sm`}></i>
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground-900">
                      {actionLabels[entry.action] ?? entry.action}
                      <span className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-medium text-foreground-600">
                        {moduleLabels[entry.module] ?? entry.module}
                      </span>
                      {entry.secret && (
                        <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-bold text-secondary-900">
                          Sigilo preservado
                        </span>
                      )}
                    </p>
                    <p className="mt-1 break-words text-[11px] leading-relaxed text-foreground-600">{entry.detail}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-foreground-500">
                      <span>{entry.actorName || "Sistema"}</span>
                      {entry.actorRole && <span>· {roleLabels[entry.actorRole] ?? entry.actorRole}</span>}
                      {entry.companyName && <span>· {entry.companyName}</span>}
                      <span>· {formatDateTime(entry.createdAt)}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filtered.length > visible && (
            <div className="border-t border-background-200 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setVisible((current) => current + 80)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-arrow-down-line"></i>
                Mostrar mais ({filtered.length - visible} restantes)
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-md border border-background-200 bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-lock-2-line mt-0.5 text-sm text-secondary-700"></i>
        <span>
          <strong>Votação sigilosa:</strong> a trilha registra quem votou e em que momento, mas a opção escolhida nunca é
          gravada — nem no log, nem em tabela associada ao eleitor. O sigilo é garantido pelo próprio desenho do banco.
        </span>
      </div>
    </div>
  );
}