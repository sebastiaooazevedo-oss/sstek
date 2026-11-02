import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import {
  platformApi,
  type PlatformInvoiceCompany,
  type PlatformSealRow,
} from "@/pages/app/modules/plataforma/platformApi";
import {
  sealCodeOf,
  sealOriginLabels,
  sealOriginOf,
  sealScopeLabels,
  shortSealHash,
  type SealOrigin,
  type SealScope,
} from "@/pages/app/signature/authenticitySeal";
import { printSealReceipt } from "@/pages/app/signature/sealReceipt";
import { buildValidationUrl } from "@/pages/app/signature/validationQr";
import { downloadCsv } from "@/pages/app/utils/exportTable";

type PeriodKey = "today" | "7d" | "30d" | "all" | "custom";

/** Tipos de chancela disponíveis para filtro (valores gravados no servidor). */
const scopeFilterOptions: { value: string; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "epi", label: "EPI" },
  { value: "dds", label: "DDS" },
  { value: "apr", label: "APR" },
  { value: "cipa", label: "CIPA" },
  { value: "presenca", label: "Ficha de Presença" },
  { value: "assinatura", label: "Assinaturas" },
  { value: "documento", label: "Documentos" },
];

const scopeMeta: Record<string, { icon: string; tone: string }> = {
  assinatura: { icon: "ri-quill-pen-line", tone: "bg-primary-100 text-primary-700" },
  epi: { icon: "ri-shield-user-line", tone: "bg-secondary-100 text-secondary-900" },
  dds: { icon: "ri-team-line", tone: "bg-accent-100 text-accent-900" },
  apr: { icon: "ri-alert-line", tone: "bg-accent-100 text-accent-900" },
  cipa: { icon: "ri-building-4-line", tone: "bg-secondary-100 text-secondary-900" },
  presenca: { icon: "ri-list-check-2", tone: "bg-accent-100 text-accent-900" },
  documento: { icon: "ri-file-text-line", tone: "bg-background-200 text-foreground-700" },
  outro: { icon: "ri-file-text-line", tone: "bg-background-200 text-foreground-700" },
};

function metaOf(scope: string): { icon: string; tone: string } {
  return scopeMeta[scope] ?? scopeMeta.outro;
}

function scopeLabelOf(scope: string): string {
  return sealScopeLabels[scope as SealScope] ?? scope;
}

/** Etiqueta que separa quem assinou: colaborador (documento) ou gestor (relatório). */
const originMeta: Record<SealOrigin, { icon: string; tone: string }> = {
  gestor: { icon: "ri-user-star-line", tone: "bg-secondary-100 text-secondary-900" },
  colaborador: { icon: "ri-quill-pen-line", tone: "bg-primary-100 text-primary-700" },
  "sem-assinatura": { icon: "ri-shield-line", tone: "bg-background-200 text-foreground-700" },
};

function originOf(row: PlatformSealRow): SealOrigin {
  return sealOriginOf(row.signers, row.signer_count);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function sealRange(period: PeriodKey, start: string, end: string): { from: string | null; to: string | null } {
  const now = new Date();
  if (period === "today") {
    const initial = new Date(now);
    initial.setHours(0, 0, 0, 0);
    return { from: initial.toISOString(), to: null };
  }
  if (period === "7d") return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: null };
  if (period === "30d") return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: null };
  if (period === "all") return { from: null, to: null };
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

function receiptFor(row: PlatformSealRow) {
  printSealReceipt({
    token: row.validation_token,
    code: row.code || sealCodeOf(row.validation_token),
    label: row.reference_label,
    scopeLabel: scopeLabelOf(row.scope),
    companyName: row.company_name,
    contentHash: row.content_hash,
    signerCount: row.signer_count,
    signers: row.signers,
    issuer: row.issuer,
    sealedAt: row.sealed_at,
  });
}

function exportSealsCsv(rows: PlatformSealRow[]): void {
  const stamp = new Date();
  const dateTag = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(
    stamp.getDate()
  ).padStart(2, "0")}`;
  downloadCsv(
    `chancelas-emitidas-${dateTag}.csv`,
    [
      "Empresa",
      "Subdomínio",
      "Tipo de chancela",
      "Origem da chancela",
      "Documento",
      "Referência interna",
      "Código de verificação",
      "Emissor",
      "Signatários",
      "Nomes dos signatários",
      "Hash SHA-256",
      "Chancela emitida em",
      "Endereço de validação",
    ],
    rows.map((row) => [
      row.company_name || "—",
      row.company_subdomain || "—",
      scopeLabelOf(row.scope),
      sealOriginLabels[originOf(row)],
      row.reference_label || "—",
      row.reference_ref || "—",
      row.code || sealCodeOf(row.validation_token),
      row.issuer || "—",
      String(Number(row.signer_count ?? 0)),
      (row.signers || []).map((s) => s.name).filter(Boolean).join(" | "),
      row.content_hash || "—",
      formatDateTime(row.sealed_at),
      buildValidationUrl(row.validation_token),
    ])
  );
}

export default function SealsPanel() {
  const [companies, setCompanies] = useState<PlatformInvoiceCompany[]>([]);
  const [seals, setSeals] = useState<PlatformSealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("all");
  const [scope, setScope] = useState("all");
  const [issuer, setIssuer] = useState("all");
  const [issuers, setIssuers] = useState<string[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlatformSealRow | null>(null);
  const [visible, setVisible] = useState(40);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = sealRange(period, startDate, endDate);
      const data = await platformApi.sealsOverview({
        companyId: companyId === "all" ? null : companyId,
        scope: scope === "all" ? null : scope,
        issuer: issuer === "all" ? null : issuer,
        from: range.from,
        to: range.to,
        limit: 500,
      });
      setSeals(data.seals);
      setCompanies(data.companies);
      setIssuers(data.issuers ?? []);
      setVisible(40);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as chancelas emitidas.");
    } finally {
      setLoading(false);
    }
  }, [companyId, scope, issuer, period, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const issuerOptions = useMemo(() => {
    const list = [...issuers];
    if (issuer !== "all" && !list.some((name) => name.toLowerCase() === issuer.toLowerCase())) {
      list.push(issuer);
    }
    return list.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [issuers, issuer]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return seals;
    return seals.filter((row) =>
      [
        row.company_name,
        row.company_subdomain,
        row.reference_label,
        row.reference_ref,
        scopeLabelOf(row.scope),
        row.issuer,
        row.code,
        row.validation_token,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [seals, search]);

  const stats = useMemo(() => {
    const companyKeys = new Set(seals.map((row) => row.company_id));
    const docKeys = new Set(seals.map((row) => `${row.company_id}:${row.reference_ref}`));
    const signers = seals.reduce((total, row) => total + Number(row.signer_count ?? 0), 0);
    return { total: seals.length, companies: companyKeys.size, documents: docKeys.size, signers };
  }, [seals]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Chancelas no período", value: stats.total, icon: "ri-shield-check-line" },
          { label: "Empresas com chancela", value: stats.companies, icon: "ri-building-2-line" },
          { label: "Documentos distintos", value: stats.documents, icon: "ri-file-list-3-line" },
          { label: "Assinaturas registradas", value: stats.signers, icon: "ri-quill-pen-line" },
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Período</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodKey)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="all">Todo o histórico</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Tipo de chancela</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              {scopeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Emitido por</span>
            <select
              value={issuer}
              onChange={(event) => setIssuer(event.target.value)}
              className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-800 outline-none focus:border-primary-400"
            >
              <option value="all">Todos os emissores</option>
              {issuerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {period === "custom" ? (
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
          ) : (
            <div className="hidden lg:block"></div>
          )}

          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Buscar</span>
            <div className="flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2">
              <i className="ri-search-line text-sm text-foreground-400"></i>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Empresa, documento, emissor, código de verificação…"
                className="w-full bg-transparent text-xs outline-none placeholder:text-foreground-400"
              />
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground-500">
            <span>
              {filtered.length} chancela(s)
              {issuer !== "all" ? ` emitida(s) por ${issuer}` : ""} · registro imutável, emitido apenas pelo servidor
            </span>
            {issuer !== "all" && (
              <button
                type="button"
                onClick={() => setIssuer("all")}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-700 hover:bg-background-300"
              >
                <i className="ri-close-line"></i>
                Limpar emissor
              </button>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportSealsCsv(filtered)}
              disabled={filtered.length === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="ri-file-excel-2-line"></i>
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-refresh-line"></i>
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-4 flex items-center justify-center rounded-lg border border-background-200 bg-background-50 py-14">
          <span className="flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-loader-4-line animate-spin text-lg"></i>
            Carregando as chancelas emitidas…
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
                Nenhuma chancela encontrada com esses filtros. Chancelas são criadas quando um documento recebe
                assinatura eletrônica.
              </p>
            )}
            {filtered.slice(0, visible).map((row) => {
              const meta = metaOf(row.scope);
              const originKey = originOf(row);
              const origin = originMeta[originKey];
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <i className={`${meta.icon} text-sm`}></i>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground-900">
                        {row.reference_label || "Documento sem título"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-foreground-600">
                        <span>{row.company_name || "Empresa não identificada"}</span>
                        <span>· {scopeLabelOf(row.scope)}</span>
                        <span>· {formatDateTime(row.sealed_at)}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-foreground-600">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${origin.tone}`}
                        >
                          <i className={origin.icon}></i>
                          {sealOriginLabels[originKey]}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 font-semibold text-secondary-900">
                          <i className="ri-user-star-line"></i>
                          Emissor: {row.issuer || "—"}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-foreground-500">
                        <span className="rounded-full bg-background-100 px-2 py-0.5 font-mono font-semibold text-foreground-700">
                          {row.code || sealCodeOf(row.validation_token)}
                        </span>
                        <span className="rounded-full bg-background-100 px-2 py-0.5">
                          {Number(row.signer_count ?? 0)} signatário(s)
                        </span>
                        <span className="rounded-full bg-background-100 px-2 py-0.5 font-mono">
                          {shortSealHash(row.content_hash)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-eye-line"></i>
                      Detalhes
                    </button>
                    <a
                      href={buildValidationUrl(row.validation_token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
                    >
                      <i className="ri-external-link-line"></i>
                      Validar
                    </a>
                    <button
                      type="button"
                      onClick={() => receiptFor(row)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-secondary-600 dark:text-foreground-950"
                    >
                      <i className="ri-download-2-line"></i>
                      Comprovante
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > visible && (
            <div className="border-t border-background-200 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setVisible((current) => current + 40)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-arrow-down-line"></i>
                Mostrar mais ({filtered.length - visible} restantes)
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-background-200 bg-background-100 px-3.5 py-3 text-[11px] leading-relaxed text-foreground-600">
          <i className="ri-shield-keyhole-line mt-0.5 text-sm text-secondary-700"></i>
          <span>
            <strong>Chancela é registro, não permissão:</strong> o painel apenas consulta e baixa comprovantes. Nenhum
            selo pode ser criado, editado ou apagado por aqui — a emissão acontece exclusivamente no servidor, no
            momento em que o documento recebe assinatura eletrônica. O <strong>Emissor</strong> é o gestor que gerou o
            relatório impresso; em documentos assinados por colaboradores ele aparece como “—”, porque não existe
            gestor emitente. A etiqueta <strong>Assinado por colaborador</strong> marca os documentos assinados pelo
            próprio colaborador (EPI, ata, APR, termos) e <strong>Emitido por gestor</strong> marca os relatórios
            consolidados gerados por um gestor.
          </span>
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Chancela de autenticidade"
        subtitle="Registro do servidor vinculado ao QR-Code impresso no documento."
        icon="ri-shield-check-line"
        footer={
          selected ? (
            <>
              <a
                href={buildValidationUrl(selected.validation_token)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100"
              >
                <i className="ri-external-link-line"></i>
                Abrir validação pública
              </a>
              <button
                type="button"
                onClick={() => receiptFor(selected)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
              >
                <i className="ri-download-2-line"></i>
                Baixar comprovante
              </button>
            </>
          ) : null
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Empresa</p>
                <p className="mt-0.5 text-foreground-800">{selected.company_name || "—"}</p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Tipo</p>
                <p className="mt-0.5 text-foreground-800">{scopeLabelOf(selected.scope)}</p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Origem da chancela
                </p>
                <p className="mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      originMeta[originOf(selected)].tone
                    }`}
                  >
                    <i className={originMeta[originOf(selected)].icon}></i>
                    {sealOriginLabels[originOf(selected)]}
                  </span>
                </p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Documento</p>
                <p className="mt-0.5 break-words text-foreground-800">{selected.reference_label || "—"}</p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Código de verificação
                </p>
                <p className="mt-0.5 font-mono text-[12px] font-semibold text-foreground-800">
                  {selected.code || sealCodeOf(selected.validation_token)}
                </p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Emissor</p>
                <p className="mt-0.5 break-words text-foreground-800">
                  {selected.issuer || "Documento assinado (sem gestor emissor)"}
                </p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Chancela emitida em</p>
                <p className="mt-0.5 text-foreground-800">{formatDateTime(selected.sealed_at)}</p>
              </div>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Signatários</p>
                <p className="mt-0.5 text-foreground-800">{Number(selected.signer_count ?? 0)}</p>
              </div>
            </div>

            <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                Hash SHA-256 do conteúdo
              </p>
              <p className="mt-0.5 break-all font-mono text-[10px] text-foreground-700">{selected.content_hash}</p>
            </div>

            <div>
              <p className="text-sm font-bold text-foreground-950">Quem assinou</p>
              {selected.signers && selected.signers.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-2">
                  {selected.signers.map((signer, index) => (
                    <li
                      key={`${signer.name}-${index}`}
                      className="flex items-center gap-3 rounded-md border border-background-200 bg-background-100 px-3 py-2"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                        <i className="ri-quill-pen-line"></i>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground-900">{signer.name}</p>
                        <p className="truncate text-[11px] text-foreground-500">
                          {signer.role || "Signatário"}
                          {signer.signedAt ? ` · ${formatDateTime(signer.signedAt)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-foreground-500">Chancela emitida sem assinatura nominal registrada.</p>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-3 text-[11px] leading-relaxed text-secondary-800">
              <i className="ri-lock-2-line mt-0.5 text-sm"></i>
              <span>
                O comprovante registra os dados desta chancela e o endereço público de conferência. Ele não reproduz o
                conteúdo do documento nem expõe CPF, contatos ou informações de saúde.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}