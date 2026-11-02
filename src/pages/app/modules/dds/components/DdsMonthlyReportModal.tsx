import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import {
  PeriodFilterBar,
  periodLabel,
  usePeriodFilter,
} from "@/pages/app/components/PeriodFilter";
import type { DdsRecord } from "@/mocks/dds";
import { ddsThemes } from "@/mocks/dds";
import { useAppSession } from "@/pages/app/context";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";

interface DdsMonthlyReportModalProps {
  open: boolean;
  onClose: () => void;
  records: DdsRecord[];
}

export default function DdsMonthlyReportModal({ open, onClose, records }: DdsMonthlyReportModalProps) {
  const periodFilter = usePeriodFilter(records.map((r) => r.date));
  const label = periodLabel(periodFilter.value, periodFilter.months);
  const session = useAppSession();

  const [unitFilter, setUnitFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [sealing, setSealing] = useState(false);

  const units = useMemo(
    () => Array.from(new Set(records.map((r) => r.establishment).filter((u): u is string => Boolean(u)))).sort(),
    [records]
  );

  // Temas disponíveis: os do catálogo que realmente aparecem nos registros, na
  // ordem do catálogo, seguidos dos temas livres ("Outros") em ordem alfabética.
  const themes = useMemo(() => {
    const fromCatalog = ddsThemes.filter((t) => records.some((r) => r.theme === t));
    const free = Array.from(
      new Set(records.map((r) => r.theme).filter((t): t is string => Boolean(t) && !ddsThemes.includes(t)))
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [...fromCatalog, ...free];
  }, [records]);

  const monthly = useMemo(
    () =>
      records.filter(
        (r) =>
          periodFilter.matches(r.date) &&
          (!unitFilter || r.establishment === unitFilter) &&
          (!themeFilter || r.theme === themeFilter)
      ),
    [records, periodFilter.value, periodFilter.effectiveMonth, unitFilter, themeFilter]
  );

  const stats = useMemo(() => {
    const totalDds = monthly.length;
    const participations = monthly.reduce((sum, r) => sum + r.participants, 0);
    const scheduled = monthly.filter((r) => r.status === "Agendado").length;
    const average = totalDds > 0 ? Math.round(participations / totalDds) : 0;
    return { totalDds, participations, scheduled, average };
  }, [monthly]);

  const byTraining = useMemo(() => {
    const map = new Map<string, { dds: number; participants: number }>();
    monthly.forEach((r) => {
      const key = r.trainingName || r.theme || "Sem vínculo";
      const current = map.get(key) || { dds: 0, participants: 0 };
      map.set(key, { dds: current.dds + 1, participants: current.participants + r.participants });
    });
    return [...map.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.participants - a.participants);
  }, [monthly]);

  const maxParticipants = Math.max(...byTraining.map((t) => t.participants), 1);

  const handleExport = async () => {
    if (records.length === 0 || sealing) return;
    setSealing(true);
    try {
    const rows = byTraining
      .map(
        (t) => `<tr>
          <td>${escapeHtml(t.name)}</td>
          <td>${t.dds}</td>
          <td>${t.participants}</td>
        </tr>`
      )
      .join("");

    const listRows = monthly
      .map(
        (r) => `<tr>
          <td>${r.date} ${r.time}</td>
          <td>${escapeHtml(r.title)}</td>
          <td>${escapeHtml(r.facilitator)}</td>
          <td>${escapeHtml(r.area)}</td>
          <td>${escapeHtml(r.establishment || "—")}</td>
          <td>${r.participants}</td>
          <td>${escapeHtml(r.trainingName || "—")}</td>
        </tr>`
      )
      .join("");

    const unitLabel = unitFilter || "Todas as unidades";
    const themeLabel = themeFilter || "Todos os temas";

    const seal = await reportSealHtml({
      scope: "dds",
      referenceRef: `relatorio-dds|${periodFilter.value}|${periodFilter.effectiveMonth}|${unitFilter || "todas"}|${
        themeFilter || "todos"
      }`,
      referenceLabel: `Relatório mensal de DDS — ${label} · ${unitLabel} · ${themeLabel}`,
      caption: "Relatório mensal de DDS",
      issuerName: session.name,
      content: {
        documento: "relatorio-mensal-dds",
        periodo: label,
        filtroPeriodo: periodFilter.value,
        mesReferencia: periodFilter.effectiveMonth,
        unidade: unitLabel,
        tema: themeLabel,
        indicadores: stats,
        treinamentos: byTraining,
        dialogos: monthly.map((r) => ({
          id: r.id,
          data: r.date,
          hora: r.time,
          titulo: r.title,
          facilitador: r.facilitator,
          tema: r.theme,
          treinamento: r.trainingName || null,
          setor: r.area,
          unidade: r.establishment || null,
          participantes: r.participants,
          status: r.status,
        })),
      },
    });

    const body = `${pdfHeader(`Relatório de DDS · ${label}`)}
      <h1>Relatório de participações em DDS</h1>
      <p class="muted">Período de referência: ${label} · Unidade: ${escapeHtml(unitLabel)} · Tema: ${escapeHtml(themeLabel)}. Diálogo Diário de Segurança.</p>
      <div class="kpis">
        <div class="kpi"><b>${stats.totalDds}</b><span>DDS realizados</span></div>
        <div class="kpi"><b>${stats.participations}</b><span>Participações</span></div>
        <div class="kpi"><b>${stats.average}</b><span>Média por DDS</span></div>
        <div class="kpi"><b>${stats.scheduled}</b><span>Agendados</span></div>
      </div>
      <h2>Participações por treinamento</h2>
      <table>
        <thead><tr><th>Treinamento / Tema</th><th>DDS</th><th>Participações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">Sem registros no período.</td></tr>'}</tbody>
      </table>
      <h2>Detalhamento dos diálogos</h2>
      <table>
        <thead><tr><th>Data / Hora</th><th>Título</th><th>Facilitador</th><th>Setor</th><th>Unidade</th><th>Part.</th><th>Treinamento</th></tr></thead>
        <tbody>${listRows || '<tr><td colspan="7">Sem registros no período.</td></tr>'}</tbody>
      </table>
      ${pdfFooter(seal.html, seal.url)}`;

    printHtml(`Relatório de DDS — ${label}`, body);
    } finally {
      setSealing(false);
    }
  };

  const kpis = [
    { label: "DDS no período", value: `${stats.totalDds}`, icon: "ri-presentation-line", tone: "primary" },
    { label: "Participações", value: `${stats.participations}`, icon: "ri-team-line", tone: "secondary" },
    { label: "Média por DDS", value: `${stats.average}`, icon: "ri-group-line", tone: "secondary" },
    { label: "Agendados", value: `${stats.scheduled}`, icon: "ri-calendar-schedule-line", tone: "accent" },
  ];

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Relatório de participações"
      subtitle="Consolidado de DDS e participações por treinamento, com filtro por semana, mês ou período."
      icon="ri-file-chart-line"
      size="xl"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
          <ModalButton onClick={handleExport} icon="ri-file-pdf-2-line" disabled={sealing}>
            {sealing ? "Chancelando…" : "Exportar PDF"}
          </ModalButton>
        </>
      }
    >
      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-200 text-foreground-400">
            <i className="ri-presentation-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum DDS registrado</p>
          <p className="text-xs text-foreground-500">Registre diálogos para gerar o relatório.</p>
        </div>
      ) : (
        <>
          <PeriodFilterBar
            value={periodFilter.value}
            onChange={periodFilter.setValue}
            months={periodFilter.months}
            effectiveMonth={periodFilter.effectiveMonth}
          />

          {(units.length > 0 || themes.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {units.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground-500">Unidade:</span>
                  <div className="relative">
                    <select
                      value={unitFilter}
                      onChange={(e) => setUnitFilter(e.target.value)}
                      className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-56"
                    >
                      <option value="">Todas as unidades</option>
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                  </div>
                </div>
              )}
              {themes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground-500">Tema:</span>
                  <div className="relative">
                    <select
                      value={themeFilter}
                      onChange={(e) => setThemeFilter(e.target.value)}
                      className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-64"
                    >
                      <option value="">Todos os temas</option>
                      {themes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-foreground-500">
            Período: <strong className="font-semibold text-foreground-800">{label}</strong> ·{" "}
            <strong className="font-semibold text-foreground-800">{monthly.length}</strong> DDS
            {unitFilter && (
              <>
                {" "}
                · Unidade: <strong className="font-semibold text-foreground-800">{unitFilter}</strong>
              </>
            )}
            {themeFilter && (
              <>
                {" "}
                · Tema: <strong className="font-semibold text-foreground-800">{themeFilter}</strong>
              </>
            )}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-background-200 bg-background-50 p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneIcon[kpi.tone]}`}>
                  <i className={`${kpi.icon} text-base`}></i>
                </span>
                <p className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{kpi.value}</p>
                <p className="mt-0.5 text-xs font-medium text-foreground-500">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="font-heading text-sm font-bold text-foreground-950">Participações por treinamento</h4>
            {byTraining.length > 0 ? (
              <div className="mt-3 flex flex-col gap-4">
                {byTraining.map((t) => (
                  <div key={t.name}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground-800">{t.name}</span>
                      <span className="whitespace-nowrap text-sm font-semibold text-foreground-600">
                        {t.participants} participação(ões) · {t.dds} DDS
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${Math.round((t.participants / maxParticipants) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-foreground-500">Sem registros no período selecionado.</p>
            )}
          </div>

          <div className="mt-6">
            <h4 className="font-heading text-sm font-bold text-foreground-950">Diálogos do período</h4>
            <ul className="mt-3 flex flex-col gap-3">
              {monthly.map((r) => (
                <li key={r.id} className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                    <i className="ri-presentation-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">{r.title}</p>
                    <p className="truncate text-xs text-foreground-500">
                      {r.date} · {r.facilitator} · {r.trainingName || "Sem vínculo"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold text-foreground-600">
                    <i className="ri-team-line mr-1"></i>
                    {r.participants}
                  </span>
                </li>
              ))}
            </ul>
            {monthly.length === 0 && (
              <p className="mt-3 text-sm text-foreground-500">Sem registros no período selecionado.</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}