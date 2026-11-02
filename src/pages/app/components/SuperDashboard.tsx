import {
  HorizontalBars,
  KpiCard,
  MiniBars,
  RingStat,
  SectionCard,
  StatusPill,
} from "@/pages/app/components/ui";
import {
  licenseDistribution,
  revenueByMonth,
  superKpis,
  tenants,
} from "@/mocks/app";
import { tenantHost } from "@/core/domain";

export default function SuperDashboard() {
  const totalLicenses = licenseDistribution.reduce((acc, l) => acc + l.value, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {superKpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          title="Receita recorrente por mês"
          subtitle="MRR consolidado de todos os subdomínios (em milhares de R$)"
          className="lg:col-span-2"
          action={
            <span className="hidden items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700 sm:flex">
              <i className="ri-arrow-up-line"></i>
              +6,2% no mês
            </span>
          }
        >
          <MiniBars data={revenueByMonth} tone="primary" suffix="k" />
        </SectionCard>

        <SectionCard title="Distribuição de licenças" subtitle={`${totalLicenses} contratos ativos`}>
          <RingStat percent={Math.round((licenseDistribution[0].value / totalLicenses) * 100)} value={`${totalLicenses}`} label="Contratos ativos" tone="accent" />
          <div className="mt-6 flex flex-col gap-3">
            {licenseDistribution.map((lic) => (
              <div key={lic.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-foreground-700">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      lic.tone === "primary" ? "bg-primary-500" : lic.tone === "accent" ? "bg-accent-500" : "bg-secondary-500"
                    }`}
                  ></span>
                  {lic.label}
                </span>
                <span className="text-sm font-semibold text-foreground-900">{lic.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Empresas contratantes"
        subtitle="Contratos, subdomínios e status de cobrança"
        action={
          <button type="button" className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex">
            <i className="ri-add-line"></i>
            Nova empresa
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Empresa</th>
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Plano</th>
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Colaboradores</th>
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Mensalidade</th>
                <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.subdomain} className="border-b border-background-100 last:border-0">
                  <td className="py-3.5">
                    <p className="text-sm font-semibold text-foreground-950">{t.name}</p>
                    <p className="text-xs text-foreground-500">{tenantHost(t.subdomain)}</p>
                  </td>
                  <td className="py-3.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-semibold text-foreground-700">{t.plan}</span>
                  </td>
                  <td className="py-3.5 text-sm text-foreground-700">{t.collaborators}</td>
                  <td className="py-3.5 text-sm font-medium text-foreground-800">{t.mrr}</td>
                  <td className="py-3.5 text-right">
                    <StatusPill status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Crescimento de tenants" subtitle="Novas empresas por trimestre">
          <HorizontalBars
            data={[
              { label: "1º tri", value: 18 },
              { label: "2º tri", value: 27 },
              { label: "3º tri", value: 34 },
              { label: "4º tri (prev.)", value: 41 },
            ]}
            tone="secondary"
          />
        </SectionCard>

        <SectionCard title="Saúde da plataforma" subtitle="Indicadores operacionais">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Uptime", value: "99,98%", icon: "ri-server-line" },
              { label: "Logs de QR-Code hoje", value: "1.284", icon: "ri-qr-scan-2-line" },
              { label: "Bases importadas", value: "312", icon: "ri-file-upload-line" },
              { label: "Tickets abertos", value: "9", icon: "ri-customer-service-2-line" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-background-200 bg-background-100 p-4">
                <i className={`${item.icon} text-lg text-secondary-700`}></i>
                <p className="mt-3 font-heading text-lg font-extrabold text-foreground-950">{item.value}</p>
                <p className="text-xs text-foreground-500">{item.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}