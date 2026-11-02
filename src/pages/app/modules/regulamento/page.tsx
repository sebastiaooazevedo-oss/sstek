import { useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import { KpiCard, SectionCard } from "@/pages/app/components/ui";
import {
  firstSignatureFor,
  signaturesForRegulation,
  useCurrentRegulation,
  usePreviousRegulations,
  useRegulationSignatures,
  useRegulationStoreState,
} from "@/pages/app/modules/regulamento/regulationStore";
import RegulationReader from "@/pages/app/modules/regulamento/components/RegulationReader";
import AdminRegulationPanel from "@/pages/app/modules/regulamento/components/AdminRegulationPanel";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-BR");
}

export default function RegulamentoPage() {
  const session = useAppSession();
  const isManager = session.role === "admin" || session.role === "super";
  const current = useCurrentRegulation();
  const previous = usePreviousRegulations();
  const signatures = useRegulationSignatures();
  const storeState = useRegulationStoreState();

  if (isManager) {
    return <AdminRegulationPanel />;
  }

  const me =
    collaborators.find((c) => c.name === session.name) ||
    collaborators.find((c) => c.email === session.email) ||
    null;

  const mySignature = current
    ? firstSignatureFor(signatures, current.id, me?.id ?? null)
    : null;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
          <i className="ri-book-read-line"></i>
          Meu espaço
        </p>
        <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
          Regulamento Interno
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm text-foreground-600">
          Leia todas as páginas do regulamento vigente e registre sua assinatura de ciência. Ao publicar uma nova
          versão, você precisará ler e assinar novamente.
        </p>
      </div>

      {storeState.error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900">
          <i className="ri-wifi-off-line mt-0.5 text-base"></i>
          <span className="flex-1">{storeState.error} Os dados exibidos podem estar desatualizados.</span>
        </div>
      )}

      {storeState.loading && !storeState.loaded ? (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-lg border border-background-200 bg-background-50 py-16 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando o regulamento…
        </div>
      ) : !current ? (
        <div className="mt-8 rounded-lg border border-dashed border-background-300 bg-background-50 px-6 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-book-2-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Nenhum regulamento publicado</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground-500">
            Assim que o administrador publicar o Regulamento Interno, ele aparecerá aqui para leitura e assinatura.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiCard
              icon="ri-book-read-line"
              label="Versão vigente"
              value={`v${current.version}`}
              delta={`${current.pageCount} páginas`}
              trend="up"
              tone="primary"
            />
            <KpiCard
              icon={mySignature ? "ri-checkbox-circle-line" : "ri-time-line"}
              label="Sua assinatura"
              value={mySignature ? "Assinado" : "Pendente"}
              delta={mySignature ? formatDate(mySignature.signedAt) : "leia e assine"}
              trend="up"
              tone={mySignature ? "primary" : "accent"}
            />
            <KpiCard
              icon="ri-history-line"
              label="Versões anteriores"
              value={String(previous.length)}
              delta="não vigentes"
              trend="up"
              tone="secondary"
            />
          </div>

          <div className="mt-6">
            <RegulationReader
              regulation={current}
              signature={mySignature}
              signer={
                me
                  ? {
                      id: me.id,
                      name: me.name,
                      email: me.email,
                      role: me.role,
                    }
                  : null
              }
            />
          </div>
        </>
      )}

      {previous.length > 0 && (
        <div className="mt-6">
          <SectionCard
            title="Versões anteriores do regulamento"
            subtitle="Continuam disponíveis para consulta, mas estão sinalizadas como não vigentes. A assinatura válida é a da versão atual."
          >
            <ul className="flex flex-col gap-2">
              {previous.map((reg) => {
                const signed = firstSignatureFor(signatures, reg.id, me?.id ?? null);
                const total = signaturesForRegulation(signatures, reg.id).length;
                return (
                  <li
                    key={reg.id}
                    className="flex flex-col gap-2 rounded-md border border-background-200 bg-background-100 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-600">
                          <i className="ri-forbid-2-line"></i>
                          Não vigente
                        </span>
                        <span className="rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-700">
                          v{reg.version}
                        </span>
                        <span className="text-[11px] text-foreground-400">{total} assinatura(s)</span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-semibold text-foreground-950">{reg.title}</p>
                      <p className="text-[11px] text-foreground-500">
                        Publicado em {formatDate(reg.publishedAt)}
                        {reg.replacedAt ? ` · Substituído em ${formatDate(reg.replacedAt)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        signed
                          ? "bg-primary-100 text-primary-700"
                          : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      <i className={signed ? "ri-checkbox-circle-line" : "ri-close-circle-line"}></i>
                      {signed ? `Você assinou em ${formatDate(signed.signedAt)}` : "Você não assinou esta versão"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}