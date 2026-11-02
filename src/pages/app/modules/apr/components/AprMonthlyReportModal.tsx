import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import {
  PeriodFilterBar,
  periodLabel,
  usePeriodFilter,
} from "@/pages/app/components/PeriodFilter";
import type { AprRecord } from "@/mocks/apr";
import { riskLevel } from "@/pages/app/modules/apr/aprUtils";
import { useAppSession } from "@/pages/app/context";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";

interface AprMonthlyReportModalProps {
  open: boolean;
  onClose: () => void;
  records: AprRecord[];
}

export default function AprMonthlyReportModal({ open, onClose, records }: AprMonthlyReportModalProps) {
  const periodFilter = usePeriodFilter(records.map((r) => r.date));
  const label = periodLabel(periodFilter.value, periodFilter.months);
  const session = useAppSession();
  const [unitFilter, setUnitFilter] = useState("");
  const [requestFilter, setRequestFilter] = useState("");
  const [sealing, setSealing] = useState(false);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.establishment) set.add(r.establishment);
    });
    return Array.from(set);
  }, [records]);

  const monthly = useMemo(() => {
    const requestTerm = requestFilter.trim().toLowerCase();
    return records.filter((r) => {
      if (!periodFilter.matches(r.date)) return false;
      if (unitFilter && r.establishment !== unitFilter) return false;
      if (!requestTerm) return true;
      return r.requestNumber.toLowerCase().includes(requestTerm);
    });
  }, [records, periodFilter.value, periodFilter.effectiveMonth, unitFilter, requestFilter]);

  const criticalOf = (record: AprRecord) =>
    record.risks.filter((r) => riskLevel(r.severity, r.probability).tone === "accent").length;

  const stats = useMemo(() => {
    const totalAprs = monthly.length;
    const criticalRisks = monthly.reduce((sum, r) => sum + criticalOf(r), 0);
    const pendingSignatures = monthly.reduce(
      (sum, r) => sum + r.signatures.filter((s) => !s.signature).length,
      0
    );
    const concluded = monthly.filter((r) => r.status === "Concluída").length;
    return { totalAprs, criticalRisks, pendingSignatures, concluded };
  }, [monthly]);

  const criticalBySector = useMemo(() => {
    const map = new Map<string, { critical: number; aprs: number; risks: number }>();
    monthly.forEach((r) => {
      const current = map.get(r.area) || { critical: 0, aprs: 0, risks: 0 };
      map.set(r.area, {
        critical: current.critical + criticalOf(r),
        aprs: current.aprs + 1,
        risks: current.risks + r.risks.length,
      });
    });
    return [...map.entries()]
      .map(([area, data]) => ({ area, ...data }))
      .sort((a, b) => b.critical - a.critical || b.risks - a.risks);
  }, [monthly]);

  const pendingList = useMemo(() => {
    const rows: { collaborator: string; role: string; aprTitle: string; area: string; date: string }[] = [];
    monthly.forEach((r) => {
      r.signatures
        .filter((s) => !s.signature)
        .forEach((s) => {
          rows.push({
            collaborator: s.collaboratorName,
            role: s.collaboratorRole || "—",
            aprTitle: r.title,
            area: r.area,
            date: r.date,
          });
        });
    });
    return rows;
  }, [monthly]);

  const maxCritical = Math.max(...criticalBySector.map((s) => s.critical), 1);

  const handleExport = async () => {
    if (records.length === 0 || sealing) return;
    setSealing(true);
    try {
    const sectorRows = criticalBySector
      .map(
        (s) => `<tr>
          <td>${escapeHtml(s.area)}</td>
          <td>${s.aprs}</td>
          <td>${s.risks}</td>
          <td>${s.critical}</td>
        </tr>`
      )
      .join("");

    const pendingRows = pendingList
      .map(
        (p) => `<tr>
          <td>${escapeHtml(p.collaborator)}</td>
          <td>${escapeHtml(p.role)}</td>
          <td>${escapeHtml(p.aprTitle)}</td>
          <td>${escapeHtml(p.area)}</td>
          <td>${escapeHtml(p.date)}</td>
        </tr>`
      )
      .join("");

    const unitLabel = unitFilter || "Todas as unidades";
    const requestLabel = requestFilter.trim() ? `Solicitação ${requestFilter.trim()}` : "Todas as solicitações";

    const seal = await reportSealHtml({
      scope: "apr",
      referenceRef: `relatorio-apr|${periodFilter.value}|${periodFilter.effectiveMonth}|${unitFilter || "todas"}|${
        requestFilter.trim() || "todas"
      }`,
      referenceLabel: `Relatório mensal de APR — ${label} · ${unitLabel} · ${requestLabel}`,
      caption: "Relatório mensal de APR",
      issuerName: session.name,
      content: {
        documento: "relatorio-mensal-apr",
        periodo: label,
        filtroPeriodo: periodFilter.value,
        mesReferencia: periodFilter.effectiveMonth,
        unidade: unitLabel,
        solicitacao: requestLabel,
        indicadores: stats,
        setores: criticalBySector,
        aceitesPendentes: pendingList,
        aprs: monthly.map((r) => ({
          id: r.id,
          data: r.date,
          titulo: r.title,
          setor: r.area,
          unidade: r.establishment || null,
          situacao: r.status,
          riscos: r.risks.map((risk) => ({
            perigo: risk.hazard,
            risco: risk.risk,
            controle: risk.control,
            severidade: risk.severity,
            probabilidade: risk.probability,
            nivel: riskLevel(risk.severity, risk.probability).label,
          })),
          assinaturas: r.signatures.map((s) => ({
            nome: s.collaboratorName,
            funcao: s.collaboratorRole,
            assinado: Boolean(s.signature),
          })),
        })),
      },
    });

    const body = `${pdfHeader(`Relatório de APR · ${label}`)}
      <h1>Relatório de Análise Preliminar de Risco</h1>
      <p class="muted">Período de referência: ${label} · Unidade: ${escapeHtml(unitLabel)} · ${escapeHtml(
        requestLabel
      )}. Consolida os riscos críticos por setor e os aceites pendentes de assinatura.</p>
      <div class="kpis">
        <div class="kpi"><b>${stats.totalAprs}</b><span>APRs no período</span></div>
        <div class="kpi"><b>${stats.criticalRisks}</b><span>Riscos críticos</span></div>
        <div class="kpi"><b>${stats.pendingSignatures}</b><span>Aceites pendentes</span></div>
        <div class="kpi"><b>${stats.concluded}</b><span>APRs concluídas</span></div>
      </div>
      <h2>Riscos críticos por setor</h2>
      <table>
        <thead><tr><th>Setor</th><th>APRs</th><th>Riscos</th><th>Riscos críticos</th></tr></thead>
        <tbody>${sectorRows || '<tr><td colspan="4">Sem registros no período.</td></tr>'}</tbody>
      </table>
      <h2>Aceites pendentes de assinatura</h2>
      <table>
        <thead><tr><th>Colaborador</th><th>Função</th><th>APR</th><th>Setor</th><th>Data</th></tr></thead>
        <tbody>${pendingRows || '<tr><td colspan="5">Nenhum aceite pendente no período.</td></tr>'}</tbody>
      </table>
      ${pdfFooter(seal.html, seal.url)}`;

    printHtml(`Relatório de APR — ${label}`, body);
    } finally {
      setSealing(false);
    }
  };

  const kpis = [
    { label: "APRs no período", value: `${stats.totalAprs}`, icon: "ri-clipboard-line", tone: "primary" },
    { label: "Riscos críticos", value: `${stats.criticalRisks}`, icon: "ri-alert-line", tone: "accent" },
    { label: "Aceites pendentes", value: `${stats.pendingSignatures}`, icon: "ri-timer-line", tone: "accent" },
    { label: "APRs concluídas", value: `${stats.concluded}`, icon: "ri-verified-badge-line", tone: "secondary" },
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
      title="Relatório de APR"
      subtitle="Consolidado de riscos críticos por setor e aceites pendentes, com filtro por semana, mês ou período."
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
            <i className="ri-clipboard-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma APR registrada</p>
          <p className="text-xs text-foreground-500">Registre análises de risco para gerar o relatório.</p>
        </div>
      ) : (
        <>
          <PeriodFilterBar
            value={periodFilter.value}
            onChange={periodFilter.setValue}
            months={periodFilter.months}
            effectiveMonth={periodFilter.effectiveMonth}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-64"
              >
                <option value="">Todas as unidades</option>
                {unitOptions.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
            <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
              <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
                <i className="ri-hashtag text-base"></i>
              </span>
              <input
                type="search"
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                placeholder="Nº da solicitação"
                aria-label="Filtrar relatório por número da solicitação"
                className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 sm:w-52"
              />
            </div>
            {(unitFilter || requestFilter) && (
              <button
                type="button"
                onClick={() => {
                  setUnitFilter("");
                  setRequestFilter("");
                }}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
              >
                <i className="ri-close-circle-line text-base"></i>
                Limpar filtros
              </button>
            )}
          </div>

          <p className="mt-3 text-xs text-foreground-500">
            Período: <strong className="font-semibold text-foreground-800">{label}</strong> ·{" "}
            <strong className="font-semibold text-foreground-800">{monthly.length}</strong> APR(s)
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
            <h4 className="font-heading text-sm font-bold text-foreground-950">Riscos críticos por setor</h4>
            {criticalBySector.length > 0 ? (
              <div className="mt-3 flex flex-col gap-4">
                {criticalBySector.map((s) => (
                  <div key={s.area}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground-800">{s.area}</span>
                      <span className="whitespace-nowrap text-sm font-semibold text-foreground-600">
                        {s.critical} crítico(s) · {s.aprs} APR(s)
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
                      <div
                        className="h-full rounded-full bg-accent-500"
                        style={{ width: `${Math.round((s.critical / maxCritical) * 100)}%` }}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-heading text-sm font-bold text-foreground-950">Aceites pendentes de assinatura</h4>
              <span className="text-[11px] font-medium text-foreground-500">{pendingList.length} pendência(s)</span>
            </div>
            {pendingList.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-3">
                {pendingList.map((p, index) => (
                  <li
                    key={`${p.collaborator}-${index}`}
                    className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                      <i className="ri-timer-line text-lg"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground-950">{p.collaborator}</p>
                      <p className="truncate text-xs text-foreground-500">
                        {p.role} · {p.aprTitle}
                      </p>
                    </div>
                    <span className="hidden whitespace-nowrap rounded-md bg-background-200 px-2 py-1 text-xs font-medium text-foreground-700 sm:block">
                      {p.area}
                    </span>
                    <span className="whitespace-nowrap text-xs text-foreground-500">{p.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-background-300 px-4 py-5">
                <i className="ri-checkbox-circle-line text-lg text-primary-600"></i>
                <span className="text-sm text-foreground-600">Todos os aceites do período foram assinados.</span>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}