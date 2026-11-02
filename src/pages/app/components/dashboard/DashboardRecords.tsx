import { Link } from "react-router-dom";
import { DaysPill, SectionCard } from "@/pages/app/components/ui";
import type { ExpiringDoc, EpiDelivery } from "@/mocks/app";
import type { EpiExpiryAlert } from "@/mocks/epi";

interface DashboardRecordsProps {
  expiringDocs: ExpiringDoc[];
  recentEpi: EpiDelivery[];
  epiExpiry: EpiExpiryAlert[];
}

/**
 * Bloco de registros operacionais do dashboard (tabelas de apoio).
 * Fica isolado para o painel executivo não carregar listas longas na
 * primeira dobra — o administrador consulta quando quiser.
 */
export default function DashboardRecords({ expiringDocs, recentEpi, epiExpiry }: DashboardRecordsProps) {
  const epiSoon = epiExpiry.filter((item) => item.status === "Vencendo").length;
  const epiExpired = epiExpiry.filter((item) => item.status === "Vencido").length;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Documentos a vencer"
        subtitle="Ordenados por proximidade do vencimento"
        action={
          <Link
            to="/app/documentos/impressao-em-lote"
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
          >
            <i className="ri-printer-line"></i>
            Impressão em lote
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Documento</th>
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Colaborador</th>
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Função</th>
                <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Vencimento</th>
                <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {expiringDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-foreground-500">
                    Nenhum documento a vencer nesta unidade.
                  </td>
                </tr>
              )}
              {expiringDocs.map((doc) => (
                <tr key={doc.id} className="border-b border-background-100 last:border-0">
                  <td className="py-3.5 text-sm font-semibold text-foreground-950">{doc.document}</td>
                  <td className="py-3.5 text-sm text-foreground-700">{doc.collaborator}</td>
                  <td className="py-3.5">
                    <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-medium text-foreground-700">
                      {doc.role}
                    </span>
                  </td>
                  <td className="py-3.5 text-sm text-foreground-700">{doc.due}</td>
                  <td className="py-3.5 text-right">
                    <DaysPill days={doc.days} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Entregas de EPI recentes" subtitle="Registros com CA e data/hora de finalização">
          <ul className="flex flex-col gap-3">
            {recentEpi.length === 0 && (
              <li className="rounded-lg border border-dashed border-background-300 px-4 py-6 text-center text-sm text-foreground-500">
                Nenhuma entrega de EPI nesta unidade.
              </li>
            )}
            {recentEpi.map((epi) => (
              <li key={epi.id} className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                  <i className="ri-shirt-line text-lg"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{epi.epi}</p>
                  <p className="truncate text-xs text-foreground-500">
                    {epi.collaborator} · CA {epi.ca}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-foreground-500">{epi.date}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="EPI a vencer · validade por CA"
          subtitle={`${epiSoon} item(ns) vencendo e ${epiExpired} com CA vencido — exige substituição`}
          action={
            <Link
              to="/app/epi"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
            >
              <i className="ri-arrow-right-line"></i>
              Abrir módulo
            </Link>
          }
        >
          <ul className="flex flex-col gap-2">
            {epiExpiry.length === 0 && (
              <li className="rounded-lg border border-dashed border-background-300 px-4 py-6 text-center text-sm text-foreground-500">
                Nenhum EPI a vencer nesta unidade.
              </li>
            )}
            {epiExpiry.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-100 p-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground-950">{item.collaboratorName}</p>
                  <p className="truncate text-xs text-foreground-500">
                    {item.epi} · CA {item.ca}
                  </p>
                </div>
                {item.days < 0 ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-200 px-2.5 py-1 text-[11px] font-semibold text-accent-900">
                    <i className="ri-error-warning-line"></i>
                    Vencido há {Math.abs(item.days)}d
                  </span>
                ) : (
                  <DaysPill days={item.days} />
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}