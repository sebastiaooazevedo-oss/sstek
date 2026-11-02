import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { KpiCard, SectionCard } from "@/pages/app/components/ui";
import { useSignatureActor } from "@/pages/app/signature/documentStore";
import {
  documentTypeLabels,
  getGovernance,
  runSignatureTests,
  signerRoleLabels,
  type Governance,
  type RetentionPolicyRow,
  type SignatureDocType,
  type SignatureLevel,
  type SignaturePolicyRow,
  type TestResult,
  type TestSummary,
} from "@/pages/app/signature/documentService";
import {
  CertificateConfigModal,
  PolicyEditModal,
  RetentionEditModal,
} from "./components/PolicyEditors";

const levelTone: Record<SignatureLevel, string> = {
  simples: "bg-background-200 text-foreground-700",
  avancada: "bg-accent-100 text-accent-800",
  qualificada: "bg-primary-100 text-primary-700",
};

const levelShort: Record<SignatureLevel, string> = {
  simples: "Simples",
  avancada: "Avançada",
  qualificada: "Qualificada",
};

const typeIcon: Record<string, string> = {
  epi: "ri-shirt-line",
  dds: "ri-presentation-line",
  certificado: "ri-award-line",
  apr: "ri-clipboard-line",
  outro: "ri-file-text-line",
};

const testTone: Record<string, string> = {
  pass: "bg-primary-100 text-primary-700",
  warn: "bg-accent-100 text-accent-800",
  fail: "bg-accent-200 text-accent-900",
};

export default function PoliticasPage() {
  const session = useAppSession();
  const actor = useSignatureActor();
  const isManager = session.role === "admin" || session.role === "super";

  const [governance, setGovernance] = useState<Governance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [policyModal, setPolicyModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SignaturePolicyRow | null>(null);
  const [retentionModal, setRetentionModal] = useState(false);
  const [editingRetention, setEditingRetention] = useState<RetentionPolicyRow | null>(null);
  const [certModal, setCertModal] = useState(false);

  const [tests, setTests] = useState<{ summary: TestSummary; results: TestResult[] } | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getGovernance(actor);
      setGovernance(data);
    } catch (err) {
      setError((err as Error).message || "Não foi possível carregar as políticas de assinatura.");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    void load();
  }, [load]);

  const policies = governance?.policies ?? [];
  const retention = governance?.retention ?? [];
  const cert = governance?.certificateConfig ?? null;

  const byType = useMemo(() => {
    const map = new Map<SignatureDocType, SignaturePolicyRow[]>();
    policies
      .filter((p) => p.is_active)
      .forEach((p) => {
        const list = map.get(p.doc_type) ?? [];
        list.push(p);
        map.set(p.doc_type, list);
      });
    const order: SignatureDocType[] = ["epi", "certificado", "dds", "apr", "outro"];
    return order.filter((t) => map.has(t)).map((t) => [t, map.get(t) ?? []] as const);
  }, [policies]);

  const categoriesCovered = new Set(policies.filter((p) => p.is_active).map((p) => p.doc_type)).size;
  const certConfigured = Boolean(cert?.enabled && cert?.provider && cert?.validation_endpoint);

  const handleRunTests = async () => {
    setRunningTests(true);
    setError("");
    try {
      const res = await runSignatureTests(actor);
      setTests({ summary: res.summary, results: res.tests });
    } catch (err) {
      setError((err as Error).message || "Não foi possível executar o dossiê de testes.");
    } finally {
      setRunningTests(false);
    }
  };

  if (!isManager) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-lock-2-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Área restrita à gestão</p>
          <p className="mt-1 text-xs text-foreground-500">
            A configuração de políticas de assinatura e retenção exige perfil de gestor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-shield-keyhole-line"></i>
            Governança da assinatura
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Políticas de assinatura
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Nível exigido por categoria documental e papel, com fundamento legal, versão, aprovação responsável,
            retenção e integração de certificado — tudo validado no servidor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingPolicy(null);
              setPolicyModal(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Nova política
          </button>
          <button
            type="button"
            onClick={handleRunTests}
            disabled={runningTests}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:opacity-60"
          >
            <i className={`${runningTests ? "ri-loader-4-line animate-spin" : "ri-test-tube-line"} text-base`}></i>
            Executar testes
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon="ri-shield-keyhole-line"
          label="Políticas ativas"
          value={String(policies.filter((p) => p.is_active).length)}
          delta={loading ? "carregando" : "vigentes"}
          trend="up"
          tone="primary"
        />
        <KpiCard
          icon="ri-stack-line"
          label="Categorias cobertas"
          value={String(categoriesCovered)}
          delta="com política"
          trend="up"
          tone="secondary"
        />
        <KpiCard
          icon="ri-archive-2-line"
          label="Retenção configurada"
          value={String(retention.length)}
          delta="categorias"
          trend="up"
          tone="secondary"
        />
        <KpiCard
          icon="ri-award-line"
          label="Certificado ICP-Brasil"
          value={certConfigured ? "Ativo" : "Não config."}
          delta={certConfigured ? "validado no servidor" : "sem simulação"}
          trend="up"
          tone="accent"
        />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Política por categoria documental e papel"
          subtitle="Referências: MP 2.200-2/2001, art. 10; Lei 14.063/2020; NR-1 (1.6/1.7); NR-6 (6.5.1d/6.5.1.1); LGPD e normas específicas."
        >
          {loading ? (
            <p className="text-sm text-foreground-500">Carregando políticas…</p>
          ) : byType.length === 0 ? (
            <div className="rounded-lg border border-dashed border-background-300 px-6 py-10 text-center text-sm text-foreground-500">
              Nenhuma política cadastrada. Use “Nova política” para definir o nível por categoria e papel.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {byType.map(([docType, rows]) => (
                <div key={docType}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                      <i className={`${typeIcon[docType] || "ri-file-text-line"} text-sm`}></i>
                    </span>
                    <p className="text-sm font-bold text-foreground-950">{documentTypeLabels[docType]}</p>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {rows.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-col gap-2 rounded-md border border-background-200 bg-background-100 p-3 lg:flex-row lg:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
                              {signerRoleLabels[p.signer_role] || p.signer_role}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${levelTone[p.required_level]}`}>
                              {levelShort[p.required_level]}
                            </span>
                            {p.requires_certificate && (
                              <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-800">
                                Exige certificado
                              </span>
                            )}
                            <span className="rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-700">
                              v{p.policy_version}
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground-600">
                            {p.legal_fundamento}
                          </p>
                          <p className="mt-0.5 text-[11px] text-foreground-400">
                            Aprovação: {p.approved_by || "—"}
                            {p.approved_at ? ` · ${new Date(p.approved_at).toLocaleDateString("pt-BR")}` : ""}
                            {p.legal_references && p.legal_references.length > 0
                              ? ` · ${p.legal_references.length} referência(s)`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPolicy(p);
                            setPolicyModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-edit-line"></i>
                          Editar (nova versão)
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Retenção e backup por categoria"
          subtitle="Prazo de guarda, exigência de backup e base legal. Diferencia o horário do servidor do carimbo de tempo independente."
        >
          <ul className="flex flex-col gap-2">
            {retention.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md border border-background-200 bg-background-100 p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                  <i className={`${typeIcon[r.doc_type] || "ri-file-text-line"} text-base`}></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-900">{documentTypeLabels[r.doc_type]}</p>
                  <p className="truncate text-[11px] text-foreground-500">
                    {r.retention_years} anos · {r.backup_required ? "backup exigido" : "sem backup"} ·{" "}
                    {r.legal_basis || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRetention(r);
                    setRetentionModal(true);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900"
                  aria-label="Editar retenção"
                >
                  <i className="ri-pencil-line"></i>
                </button>
              </li>
            ))}
            {retention.length === 0 && (
              <li className="rounded-md border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
                Nenhuma retenção configurada.
              </li>
            )}
          </ul>
        </SectionCard>

        <SectionCard
          title="Integração de certificado ICP-Brasil"
          subtitle="Não simulamos certificados, selos ou resultados de validação."
        >
          <div
            className={`flex items-start gap-3 rounded-md border px-4 py-3 ${
              certConfigured ? "border-primary-200 bg-primary-50" : "border-accent-200 bg-accent-50"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                certConfigured ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
              }`}
            >
              <i className={certConfigured ? "ri-verified-badge-line text-lg" : "ri-alert-line text-lg"}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-950">
                {certConfigured ? "Integração habilitada" : "Integração não configurada"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground-600">
                {certConfigured
                  ? "Provedor e endpoint registrados. A validação real da cadeia precisa ser exercida no servidor antes de concluir o ato."
                  : "Documentos cuja política exija certificado ficam bloqueados até haver integração e validação reais. Nenhum resultado é simulado."}
              </p>
              {cert?.provider && (
                <p className="mt-1 break-all text-[11px] text-foreground-500">Provedor: {cert.provider}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCertModal(true)}
            className="mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-settings-3-line text-base"></i>
            Configurar integração
          </button>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Dossiê de testes"
          subtitle="Executa verificações reais no servidor: isolamento entre empresas, signatário não designado, desafio expirado/reutilizado, alteração após envio, conclusão apenas com todos, arquivo adulterado, edição de imagem, cancelamento e falha de certificado."
        >
          {!tests ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                <i className="ri-test-tube-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhuma execução ainda</p>
              <p className="text-xs text-foreground-500">Use “Executar testes” no topo da página.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700">
                  <i className="ri-checkbox-circle-line"></i>
                  {tests.summary.pass} passaram
                </span>
                {tests.summary.warn > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1.5 text-xs font-semibold text-accent-800">
                    <i className="ri-error-warning-line"></i>
                    {tests.summary.warn} avisos
                  </span>
                )}
                {tests.summary.fail > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-200 px-3 py-1.5 text-xs font-semibold text-accent-900">
                    <i className="ri-close-circle-line"></i>
                    {tests.summary.fail} falhas
                  </span>
                )}
                <span className="text-xs text-foreground-500">{tests.summary.total} verificações</span>
              </div>
              <ul className="mt-4 flex flex-col gap-2">
                {tests.results.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-start gap-3 rounded-md border border-background-200 bg-background-100 p-3"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${testTone[t.status]}`}
                    >
                      <i
                        className={
                          t.status === "pass"
                            ? "ri-check-line"
                            : t.status === "warn"
                              ? "ri-error-warning-line"
                              : "ri-close-line"
                        }
                      ></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-900">{t.name.replace(/_/g, " ")}</p>
                      <p className="text-[11px] leading-relaxed text-foreground-500">{t.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>
      </div>

      <PolicyEditModal
        open={policyModal}
        onClose={() => setPolicyModal(false)}
        actor={actor}
        policy={editingPolicy}
        onSaved={(m) => {
          setNotice(m);
          void load();
        }}
      />
      <RetentionEditModal
        open={retentionModal}
        onClose={() => setRetentionModal(false)}
        actor={actor}
        retention={editingRetention}
        onSaved={(m) => {
          setNotice(m);
          void load();
        }}
      />
      <CertificateConfigModal
        open={certModal}
        onClose={() => setCertModal(false)}
        actor={actor}
        config={cert}
        onSaved={(m) => {
          setNotice(m);
          void load();
        }}
      />
    </div>
  );
}