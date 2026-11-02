import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@/pages/app/components/Modal";
import { ChartCard, ChartLegend, ColumnChart, HBarChart } from "@/pages/app/components/charts";
import { getInitials } from "@/pages/app/context";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  useMedicalCertificates,
  type MedicalCertificate,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import {
  buildAbsenteeism,
  certificateLeaveMonth,
  certificateUnit,
  filterCertificatesByScope,
  isoToBr,
} from "@/pages/app/modules/meusdocumentos/certificateInsights";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { printAbsenteeismPdf } from "@/pages/app/modules/meusdocumentos/absenteeismPdf";
import type { Collaborator } from "@/mocks/collaborators";

interface AbsenteeismCardProps {
  /** Rótulo legível do período selecionado no dashboard. */
  periodText: string;
  /** Unidade aplicada no filtro do dashboard (vazio = todas). */
  unitLabel?: string;
  /** Mesma regra de período usada pelos demais indicadores do dashboard. */
  matchesPeriod: (date: string) => boolean;
}

interface DrillState {
  title: string;
  subtitle: string;
  certificates: MedicalCertificate[];
}

/**
 * Resumo de absenteísmo do dashboard.
 *
 * Cruza os atestados médicos recebidos no período/unidade selecionados no
 * painel e transforma os dias de afastamento em duas leituras: por mês (para
 * ver tendência) e por unidade (para ver onde o afastamento se concentra).
 */
export default function AbsenteeismCard({ periodText, unitLabel = "", matchesPeriod }: AbsenteeismCardProps) {
  const navigate = useNavigate();
  const certificates = useMedicalCertificates();
  const collaborators = useCollaboratorsList();
  const settings = useSystemSettings();
  const [drill, setDrill] = useState<DrillState | null>(null);

  const threshold = settings.certificateLeaveAlertDays;

  const collaboratorsById = useMemo(() => {
    const map = new Map<string, Collaborator>();
    collaborators.forEach((c) => map.set(c.id, c));
    return map;
  }, [collaborators]);

  const scoped = useMemo(
    () => filterCertificatesByScope(certificates, collaboratorsById, { matchesPeriod, unitLabel }),
    [certificates, collaboratorsById, matchesPeriod, unitLabel]
  );

  const summary = useMemo(() => buildAbsenteeism(scoped, collaboratorsById), [scoped, collaboratorsById]);

  const longLeaves = useMemo(
    () => scoped.filter((cert) => (cert.leaveDays || 0) >= threshold),
    [scoped, threshold]
  );

  const unitLabelOf = (cert: MedicalCertificate) =>
    certificateUnit(cert, collaboratorsById) || "Sem unidade cadastrada";

  const openMonth = (key: string) => {
    const month = summary.months.find((m) => m.key === key);
    const list = scoped.filter((cert) => certificateLeaveMonth(cert) === key);
    setDrill({
      title: `Absenteísmo de ${month?.label ?? key}`,
      subtitle: `${unitLabel || "Todas as unidades"} · ${periodText}`,
      certificates: list,
    });
  };

  const openUnit = (unit: string) => {
    const list = scoped.filter((cert) => unitLabelOf(cert) === unit);
    setDrill({
      title: `Absenteísmo · ${unit}`,
      subtitle: `${periodText} · ${list.length} atestado(s)`,
      certificates: list,
    });
  };

  const exportPdf = () => {
    printAbsenteeismPdf({
      summary,
      certificates: scoped,
      collaboratorsById,
      periodText,
      unitLabel,
      threshold,
      longLeaves: longLeaves.length,
    });
  };

  const unitBars = summary.units.map((unit) => ({
    id: unit.unit,
    label: unit.unit,
    value: unit.days,
    tone: "accent" as const,
    hint: `${unit.certificates} atestado(s) · ${unit.people} colaborador(es)`,
  }));

  return (
    <>
      <ChartCard
        title="Absenteísmo"
        subtitle={`Dias de afastamento por unidade e por mês em ${periodText} · ${unitLabel || "Todas as unidades"}`}
        legend={
          <>
            <ChartLegend items={[{ label: "Dias de afastamento", tone: "accent" }]} />
            {longLeaves.length > 0 && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-bold text-accent-900">
                <i className="ri-alarm-warning-line"></i>
                {longLeaves.length} acima de {threshold} dia(s)
              </span>
            )}
          </>
        }
        hint="Clique em um mês ou em uma unidade para ver os atestados que compõem os dias"
        action={
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-file-pdf-2-line text-base"></i>
            Exportar
          </button>
        }
      >
        {summary.certificates === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-calendar-check-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhum atestado no recorte</p>
            <p className="text-xs text-foreground-500">
              Sem atestados recebidos neste período e unidade, não há dias de afastamento para apurar.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              <div className="rounded-lg border border-background-200 bg-background-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Dias de afastamento</p>
                <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{summary.totalDays}</p>
                <p className="text-[10px] text-foreground-500">{summary.withLeave} atestado(s) com afastamento</p>
              </div>
              <div className="rounded-lg border border-background-200 bg-background-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Colaboradores</p>
                <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{summary.people}</p>
                <p className="text-[10px] text-foreground-500">com atestado no período</p>
              </div>
              <div className="rounded-lg border border-background-200 bg-background-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Média por pessoa</p>
                <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">
                  {String(summary.daysPerPerson).replace(".", ",")}
                </p>
                <p className="text-[10px] text-foreground-500">dias por colaborador afastado</p>
              </div>
              <div className="rounded-lg border border-background-200 bg-background-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Maior afastamento</p>
                <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{summary.longestLeave}</p>
                <p className="text-[10px] text-foreground-500">dias em um único atestado</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Dias de afastamento por mês
                </p>
                <ColumnChart
                  categories={summary.months.map((month) => ({ key: month.key, label: month.label }))}
                  series={[
                    {
                      id: "dias",
                      label: "Dias de afastamento",
                      tone: "accent",
                      values: summary.months.map((month) => month.days),
                    },
                  ]}
                  height={190}
                  suffix=" d"
                  onSelect={openMonth}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Dias por unidade
                </p>
                <HBarChart data={unitBars} suffix=" d" onSelect={openUnit} />
              </div>
            </div>

            {summary.months.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-background-200 text-left text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                      <th className="px-2 py-2">Unidade</th>
                      {summary.months.map((month) => (
                        <th key={month.key} className="px-2 py-2 text-center">
                          {month.label}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="px-2 py-2 text-right">Pessoas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.units.map((unit) => (
                      <tr key={unit.unit} className="border-b border-background-100 last:border-0">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => openUnit(unit.unit)}
                            className="cursor-pointer text-left font-semibold text-foreground-800 transition-colors hover:text-primary-700"
                          >
                            {unit.unit}
                          </button>
                        </td>
                        {summary.months.map((month) => {
                          const days = scoped
                            .filter(
                              (cert) =>
                                unitLabelOf(cert) === unit.unit && certificateLeaveMonth(cert) === month.key
                            )
                            .reduce((sum, cert) => sum + (cert.leaveDays || 0), 0);
                          return (
                            <td key={month.key} className="px-2 py-2 text-center text-foreground-600">
                              {days > 0 ? days : <span className="text-foreground-300">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-bold text-foreground-950">{unit.days}</td>
                        <td className="px-2 py-2 text-right text-foreground-600">{unit.people}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-background-200 bg-background-100">
                      <td className="px-2 py-2 font-bold text-foreground-900">Total</td>
                      {summary.months.map((month) => (
                        <td key={month.key} className="px-2 py-2 text-center font-bold text-foreground-900">
                          {month.days}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-extrabold text-foreground-950">{summary.totalDays}</td>
                      <td className="px-2 py-2 text-right font-bold text-foreground-900">{summary.people}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </ChartCard>

      <Modal
        open={drill !== null}
        onClose={() => setDrill(null)}
        title={drill?.title ?? ""}
        subtitle={drill?.subtitle}
        icon="ri-calendar-line"
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => {
              setDrill(null);
              navigate("/app/colaboradores");
            }}
            className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-team-line text-base"></i>
            Abrir colaboradores
          </button>
        }
      >
        {drill && drill.certificates.length === 0 ? (
          <p className="text-sm text-foreground-500">Nenhum atestado neste recorte.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {drill?.certificates.map((cert) => (
              <li
                key={cert.id}
                className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-100 p-3.5 sm:flex-row sm:items-center"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[11px] font-bold text-secondary-900">
                  {getInitials(cert.collaboratorName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{cert.collaboratorName}</p>
                  <p className="truncate text-[11px] text-foreground-600">
                    {cert.certificateType} · emitido em {isoToBr(cert.issuedOn) || "—"} · {unitLabelOf(cert)}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    (cert.leaveDays || 0) >= threshold
                      ? "bg-accent-100 text-accent-900"
                      : "bg-secondary-100 text-secondary-900"
                  }`}
                >
                  <i className="ri-time-line"></i>
                  {cert.leaveDays || 0} dia(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}