import { useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  platformApi,
  type PlatformCompany,
  type PlatformDomain,
} from "@/pages/app/modules/plataforma/platformApi";

interface DomainsPanelProps {
  domains: PlatformDomain[];
  companies: PlatformCompany[];
  onRefresh: () => Promise<void>;
  notify: (message: string | null, error?: string | null) => void;
}

const dnsLabel: Record<string, string> = {
  pending: "Pendente",
  configured: "Configurado",
  verified: "Verificado",
  failed: "Falhou",
};

function statusChip(status: string) {
  if (status === "verified" || status === "configured") return "bg-primary-100 text-primary-700";
  if (status === "failed") return "bg-accent-200 text-accent-900";
  return "bg-secondary-100 text-secondary-900";
}

export default function DomainsPanel({ domains, companies, onRefresh, notify }: DomainsPanelProps) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PlatformDomain | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [domain, setDomain] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [dnsStatus, setDnsStatus] = useState("pending");
  const [httpsStatus, setHttpsStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const companyName = useMemo(() => {
    const map = new Map(companies.map((company) => [company.id, company.name]));
    return (id: string) => map.get(id) ?? "Empresa removida";
  }, [companies]);

  const filtered = domains.filter((item) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return item.domain.includes(term) || companyName(item.company_id).toLowerCase().includes(term);
  });

  function openNew() {
    setEditing(null);
    setCompanyId(companies[0]?.id ?? "");
    setDomain("");
    setIsPrimary(false);
    setDnsStatus("pending");
    setHttpsStatus("pending");
    setNotes("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(item: PlatformDomain) {
    setEditing(item);
    setCompanyId(item.company_id);
    setDomain(item.domain);
    setIsPrimary(item.is_primary);
    setDnsStatus(item.dns_status);
    setHttpsStatus(item.https_status);
    setNotes(item.notes ?? "");
    setError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setError(null);
    if (!domain.trim()) {
      setError("Informe o domínio ou subdomínio.");
      return;
    }
    setSaving(true);
    try {
      await platformApi.upsertDomain({
        domainId: editing?.id ?? null,
        companyId,
        domain: domain.trim(),
        isPrimary,
        dnsStatus,
        httpsStatus,
        notes: notes.trim(),
      });
      notify(editing ? "Domínio atualizado." : "Domínio cadastrado.");
      setFormOpen(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o domínio.");
    } finally {
      setSaving(false);
    }
  }

  const pending = domains.filter((d) => d.dns_status !== "verified" || d.https_status !== "verified").length;

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2 md:max-w-sm">
          <i className="ri-search-line text-sm text-foreground-400"></i>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar domínio ou empresa"
            className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
            {pending} com pendência externa
          </span>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
          >
            <i className="ri-add-line"></i>
            Novo domínio
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-background-200 bg-background-100 text-[11px] uppercase tracking-wide text-foreground-500">
                <th className="px-4 py-3 font-semibold">Domínio / subdomínio</th>
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">DNS</th>
                <th className="px-4 py-3 font-semibold">HTTPS</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-foreground-500">
                    Nenhum domínio encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-background-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-2 font-medium text-foreground-900">
                      {item.domain}
                      {item.is_primary && (
                        <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                          Principal
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-700">{companyName(item.company_id)}</td>
                  <td className="px-4 py-3 text-xs text-foreground-600">
                    {item.kind === "subdomain" ? "Subdomínio SSTEK" : "Domínio próprio"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(item.dns_status)}`}>
                      {dnsLabel[item.dns_status] ?? item.dns_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(item.https_status)}`}>
                      {dnsLabel[item.https_status] ?? item.https_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
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

      <p className="mt-4 flex items-start gap-2 rounded-md bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-information-line mt-0.5 text-sm"></i>
        <span>
          O cadastro aqui é o <strong>registro no sistema</strong> (quem é dono do subdomínio). A configuração real em
          DNS, hospedagem e certificado HTTPS é uma dependência externa: só marque “Verificado” depois de confirmar a
          resolução e o certificado no provedor.
        </span>
      </p>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar domínio" : "Novo domínio"}
        subtitle="Registro do subdomínio e status da configuração externa."
        icon="ri-global-line"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </ModalButton>
            <ModalButton icon="ri-save-3-line" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </ModalButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Empresa" required className="sm:col-span-2">
            <select className={selectClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Domínio" required hint="Ex.: empresa.sstek.com ou sst.você.com.br" className="sm:col-span-2">
            <input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="empresa.sstek.com" />
          </Field>
          <Field label="Status DNS">
            <select className={selectClass} value={dnsStatus} onChange={(e) => setDnsStatus(e.target.value)}>
              <option value="pending">Pendente</option>
              <option value="configured">Configurado</option>
              <option value="verified">Verificado</option>
              <option value="failed">Falhou</option>
            </select>
          </Field>
          <Field label="Status HTTPS">
            <select className={selectClass} value={httpsStatus} onChange={(e) => setHttpsStatus(e.target.value)}>
              <option value="pending">Pendente</option>
              <option value="configured">Configurado</option>
              <option value="verified">Verificado</option>
              <option value="failed">Falhou</option>
            </select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Chamado, provedor, prazo…" />
          </Field>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-foreground-700">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-background-300 accent-primary-500"
          />
          Marcar como domínio principal da empresa
        </label>
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{error}</span>
          </p>
        )}
      </Modal>
    </div>
  );
}