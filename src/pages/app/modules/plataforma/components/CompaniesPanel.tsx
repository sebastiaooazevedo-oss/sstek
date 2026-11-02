import { useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass } from "@/pages/app/components/Modal";
import {
  platformApi,
  type PlatformCompany,
  type PlatformCompanyAdmin,
} from "@/pages/app/modules/plataforma/platformApi";
import CompanyFormModal from "@/pages/app/modules/plataforma/components/CompanyFormModal";
import CompanyAdminsModal from "@/pages/app/modules/plataforma/components/CompanyAdminsModal";
import { tenantHost } from "@/core/domain";

interface CompaniesPanelProps {
  companies: PlatformCompany[];
  admins: PlatformCompanyAdmin[];
  reservedSubdomains: string[];
  onRefresh: () => Promise<void>;
  notify: (message: string | null, error?: string | null) => void;
}

const statusLabel: Record<string, string> = {
  active: "Ativa",
  suspended: "Suspensa",
  trial: "Trial",
};

function statusClass(status: string): string {
  if (status === "suspended") return "bg-accent-200 text-accent-900";
  if (status === "trial") return "bg-secondary-100 text-secondary-900";
  return "bg-primary-100 text-primary-700";
}

export default function CompaniesPanel({
  companies,
  admins,
  reservedSubdomains,
  onRefresh,
  notify,
}: CompaniesPanelProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformCompany | null>(null);
  const [adminsFor, setAdminsFor] = useState<PlatformCompany | null>(null);
  const [suspendFor, setSuspendFor] = useState<PlatformCompany | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [supportFor, setSupportFor] = useState<PlatformCompany | null>(null);
  const [supportReason, setSupportReason] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesTerm =
        !term ||
        company.name.toLowerCase().includes(term) ||
        company.subdomain.toLowerCase().includes(term) ||
        (company.cnpj ?? "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || company.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  const totals = useMemo(
    () => ({
      total: companies.length,
      active: companies.filter((c) => c.status === "active").length,
      suspended: companies.filter((c) => c.status === "suspended").length,
      collaborators: companies.reduce((sum, c) => sum + c.collaborators, 0),
    }),
    [companies]
  );

  async function toggleStatus(company: PlatformCompany) {
    if (company.status !== "suspended") {
      setSuspendFor(company);
      setReason("");
      setModalError(null);
      return;
    }
    setBusy(true);
    try {
      const result = await platformApi.setCompanyStatus(company.id, "active");
      notify(result.detail || "Empresa reativada.");
      await onRefresh();
    } catch (err) {
      notify(null, err instanceof Error ? err.message : "Não foi possível reativar a empresa.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSuspend() {
    if (!suspendFor) return;
    setModalError(null);
    if (reason.trim().length < 5) {
      setModalError("Descreva o motivo da suspensão (mínimo 5 caracteres).");
      return;
    }
    setBusy(true);
    try {
      const result = await platformApi.setCompanyStatus(suspendFor.id, "suspended", reason.trim());
      notify(result.detail || "Empresa suspensa.");
      setSuspendFor(null);
      await onRefresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Não foi possível suspender a empresa.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSupport() {
    if (!supportFor) return;
    setModalError(null);
    if (supportReason.trim().length < 8) {
      setModalError("Descreva o motivo do acesso de suporte (mínimo 8 caracteres).");
      return;
    }
    setBusy(true);
    try {
      const result = await platformApi.supportAccess(supportFor.id, supportReason.trim());
      notify(result.detail || "Acesso de suporte registrado.");
      setSupportFor(null);
      setSupportReason("");
      await onRefresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Não foi possível registrar o acesso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Empresas cadastradas", value: String(totals.total), icon: "ri-building-2-line" },
          { label: "Empresas ativas", value: String(totals.active), icon: "ri-checkbox-circle-line" },
          { label: "Empresas suspensas", value: String(totals.suspended), icon: "ri-pause-circle-line" },
          { label: "Colaboradores geridos", value: totals.collaborators.toLocaleString("pt-BR"), icon: "ri-team-line" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-background-200 bg-background-50 px-4 py-3.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-foreground-500">
              <i className={`${item.icon} text-secondary-700`}></i>
              {item.label}
            </div>
            <p className="mt-1.5 font-heading text-xl font-extrabold text-foreground-950">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex w-full items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2 sm:max-w-xs">
            <i className="ri-search-line text-sm text-foreground-400"></i>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou subdomínio"
              className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-400"
            />
          </div>
          <div className="flex items-center gap-1 rounded-full bg-background-100 p-1">
            {[
              { id: "all", label: "Todas" },
              { id: "active", label: "Ativas" },
              { id: "suspended", label: "Suspensas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? "bg-background-50 text-foreground-900"
                    : "text-foreground-500 hover:text-foreground-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-add-line"></i>
          Nova empresa
        </button>
      </div>

      <div className="mt-4 space-y-2.5">
        {filtered.length === 0 && (
          <p className="rounded-lg border border-background-200 bg-background-50 px-4 py-8 text-center text-sm text-foreground-500">
            Nenhuma empresa encontrada com esses filtros.
          </p>
        )}
        {filtered.map((company) => {
          const companyAdmins = admins.filter((admin) => admin.company_id === company.id);
          const primaryAdmin = companyAdmins.find((admin) => admin.is_primary_admin) ?? null;
          return (
            <div key={company.id} className="rounded-lg border border-background-200 bg-background-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground-950">{company.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(company.status)}`}>
                      {statusLabel[company.status] ?? company.status}
                    </span>
                    <span className="rounded-full bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-700">
                      Plano {company.plan}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-600">
                    <span className="inline-flex items-center gap-1">
                      <i className="ri-global-line"></i>
                      {tenantHost(company.subdomain)}
                    </span>
                    <span>{company.collaborators} colaboradores</span>
                    <span>{companyAdmins.length} administrador(es)</span>
                    {company.cnpj && <span>CNPJ {company.cnpj}</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-900">
                      <i className="ri-lock-2-line"></i>
                      Admin principal
                    </span>
                    {primaryAdmin ? (
                      <span className="text-foreground-700">
                        {primaryAdmin.name}
                        {primaryAdmin.email ? ` · ${primaryAdmin.email}` : ""}
                        {!primaryAdmin.auth_user_id ? " · primeiro acesso pendente" : ""}
                      </span>
                    ) : (
                      <span className="text-accent-900">Sem administrador responsável cadastrado</span>
                    )}
                  </p>
                  {company.status === "suspended" && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-md bg-accent-50 px-2.5 py-2 text-[11px] leading-relaxed text-accent-900">
                      <i className="ri-lock-2-line mt-0.5"></i>
                      <span>
                        Suspensa em {new Date(company.suspended_at ?? company.updated_at).toLocaleString("pt-BR")}
                        {company.suspension_reason ? ` · ${company.suspension_reason}` : ""} — dados preservados.
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(company);
                      setFormOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-edit-line"></i>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminsFor(company)}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-shield-user-line"></i>
                    Administradores
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSupportFor(company);
                      setSupportReason("");
                      setModalError(null);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-customer-service-2-line"></i>
                    Suporte
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleStatus(company)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      company.status === "suspended"
                        ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                        : "bg-accent-500 text-accent-950 hover:bg-accent-600"
                    }`}
                  >
                    <i className={company.status === "suspended" ? "ri-play-circle-line" : "ri-pause-circle-line"}></i>
                    {company.status === "suspended" ? "Reativar" : "Suspender"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-md bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-git-branch-line mt-0.5 text-sm"></i>
        <span>
          Subdomínios reservados para a administração (não podem ser cadastrados):{" "}
          <strong>{reservedSubdomains.join(", ")}</strong>.
        </span>
      </p>

      {formOpen && (
        <CompanyFormModal
          key={editing?.id ?? "new-company"}
          open={formOpen}
          company={editing}
          admins={admins}
          onClose={() => setFormOpen(false)}
          onSaved={async (message) => {
            notify(message);
            await onRefresh();
          }}
        />
      )}

      <CompanyAdminsModal
        open={Boolean(adminsFor)}
        company={adminsFor}
        admins={admins}
        onClose={() => setAdminsFor(null)}
        onSaved={async (message) => {
          notify(message);
          await onRefresh();
        }}
      />

      <Modal
        open={Boolean(suspendFor)}
        onClose={() => setSuspendFor(null)}
        title="Suspender empresa"
        subtitle="O acesso fica bloqueado, mas nenhum dado é excluído."
        icon="ri-pause-circle-line"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setSuspendFor(null)}>
              Cancelar
            </ModalButton>
            <ModalButton icon="ri-lock-2-line" onClick={() => void confirmSuspend()} disabled={busy}>
              {busy ? "Suspendendo…" : "Suspender acesso"}
            </ModalButton>
          </>
        }
      >
        <p className="text-sm text-foreground-700">
          Empresa: <strong>{suspendFor?.name}</strong>
        </p>
        <Field label="Motivo da suspensão" required className="mt-4">
          <textarea
            className={`${inputClass} min-h-24`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: inadimplência do plano S2, solicitação do cliente…"
          ></textarea>
        </Field>
        {modalError && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{modalError}</span>
          </p>
        )}
      </Modal>

      <Modal
        open={Boolean(supportFor)}
        onClose={() => setSupportFor(null)}
        title="Acesso de suporte"
        subtitle="Acesso explícito e auditado aos dados da empresa."
        icon="ri-customer-service-2-line"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setSupportFor(null)}>
              Cancelar
            </ModalButton>
            <ModalButton icon="ri-file-shield-2-line" onClick={() => void confirmSupport()} disabled={busy}>
              {busy ? "Registrando…" : "Registrar acesso"}
            </ModalButton>
          </>
        }
      >
        <p className="text-sm text-foreground-700">
          Empresa: <strong>{supportFor?.name}</strong>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-foreground-500">
          O registro guarda autor, empresa, motivo e data/hora. Use apenas quando houver solicitação formal do cliente.
        </p>
        <Field label="Motivo do acesso" required className="mt-4">
          <textarea
            className={`${inputClass} min-h-24`}
            value={supportReason}
            onChange={(e) => setSupportReason(e.target.value)}
            placeholder="Ex.: chamado #4821 — conferência de importação de colaboradores."
          ></textarea>
        </Field>
        {modalError && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{modalError}</span>
          </p>
        )}
      </Modal>
    </div>
  );
}