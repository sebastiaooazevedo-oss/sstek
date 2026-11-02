import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import {
  PeriodFilterBar,
  periodLabel,
  usePeriodFilter,
} from "@/pages/app/components/PeriodFilter";
import type { EpiDelivery } from "@/mocks/epi";
import { useAppSession } from "@/pages/app/context";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";

interface EpiMonthlyReportModalProps {
  open: boolean;
  onClose: () => void;
  deliveries: EpiDelivery[];
}

export default function EpiMonthlyReportModal({ open, onClose, deliveries }: EpiMonthlyReportModalProps) {
  const periodFilter = usePeriodFilter(deliveries.map((d) => d.date));
  const label = periodLabel(periodFilter.value, periodFilter.months);
  const session = useAppSession();

  const [unitFilter, setUnitFilter] = useState("");
  const [sealing, setSealing] = useState(false);

  const units = useMemo(
    () => Array.from(new Set(deliveries.map((d) => d.establishment).filter((u): u is string => Boolean(u)))).sort(),
    [deliveries]
  );

  const monthly = useMemo(
    () => deliveries.filter((d) => periodFilter.matches(d.date) && (!unitFilter || d.establishment === unitFilter)),
    [deliveries, periodFilter.value, periodFilter.effectiveMonth, unitFilter]
  );

  const itemsOf = (delivery: EpiDelivery) => delivery.items.reduce((sum, item) => sum + item.quantity, 0);

  const stats = useMemo(() => {
    const totalDeliveries = monthly.length;
    const totalItems = monthly.reduce((sum, d) => sum + itemsOf(d), 0);
    const signed = monthly.filter((d) => d.status === "Assinada").length;
    const pending = monthly.filter((d) => d.status === "Pendente").length;
    return { totalDeliveries, totalItems, signed, pending };
  }, [monthly]);

  const byCollaborator = useMemo(() => {
    const map = new Map<
      string,
      { name: string; role: string; area: string; deliveries: number; items: number; signed: number; pending: number }
    >();
    monthly.forEach((d) => {
      const current =
        map.get(d.collaboratorId) ||
        { name: d.collaboratorName, role: d.collaboratorRole, area: d.area, deliveries: 0, items: 0, signed: 0, pending: 0 };
      map.set(d.collaboratorId, {
        ...current,
        deliveries: current.deliveries + 1,
        items: current.items + itemsOf(d),
        signed: current.signed + (d.status === "Assinada" ? 1 : 0),
        pending: current.pending + (d.status === "Pendente" ? 1 : 0),
      });
    });
    return [...map.values()].sort((a, b) => b.deliveries - a.deliveries || b.items - a.items);
  }, [monthly]);

  const maxDeliveries = Math.max(...byCollaborator.map((c) => c.deliveries), 1);

  const handleExport = async () => {
    if (deliveries.length === 0 || sealing) return;
    setSealing(true);
    try {

    const collaboratorRows = byCollaborator
      .map(
        (c) => `<tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.role) || "—"}</td>
          <td>${escapeHtml(c.area) || "—"}</td>
          <td>${c.deliveries}</td>
          <td>${c.items}</td>
          <td>${c.signed}</td>
          <td>${c.pending}</td>
        </tr>`
      )
      .join("");

    const deliveryRows = monthly
      .map(
        (d) => `<tr>
          <td>${escapeHtml(d.date)}</td>
          <td>${escapeHtml(d.collaboratorName)}</td>
          <td>${escapeHtml(d.establishment || "—")}</td>
          <td>${escapeHtml(d.reason)}</td>
          <td>${d.items.length}</td>
          <td>${itemsOf(d)}</td>
          <td>${d.status === "Assinada" ? "Assinado" : "Pendente"}</td>
        </tr>`
      )
      .join("");

    const unitLabel = unitFilter || "Todas as unidades";

    const seal = await reportSealHtml({
      scope: "epi",
      referenceRef: `relatorio-epi|${periodFilter.value}|${periodFilter.effectiveMonth}|${unitFilter || "todas"}`,
      referenceLabel: `Relatório mensal de EPI — ${label} · ${unitLabel}`,
      caption: "Relatório mensal de EPI",
      issuerName: session.name,
      content: {
        documento: "relatorio-mensal-epi",
        periodo: label,
        filtroPeriodo: periodFilter.value,
        mesReferencia: periodFilter.effectiveMonth,
        unidade: unitLabel,
        indicadores: stats,
        colaboradores: byCollaborator,
        entregas: monthly.map((d) => ({
          id: d.id,
          data: d.date,
          colaborador: d.collaboratorName,
          funcao: d.collaboratorRole,
          setor: d.area,
          unidade: d.establishment || null,
          motivo: d.reason,
          itens: d.items.map((item) => ({ nome: item.name, ca: item.ca, quantidade: item.quantity })),
          status: d.status,
        })),
      },
    });

    const body = `${pdfHeader(`Relatório de EPI · ${label}`)}
      <h1>Relatório de entregas e aceites de EPI</h1>
      <p class="muted">Período de referência: ${label} · Unidade: ${escapeHtml(unitLabel)}. Consolida as entregas de Equipamentos de Proteção Individual e a situação dos aceites por colaborador.</p>
      <div class="kpis">
        <div class="kpi"><b>${stats.totalDeliveries}</b><span>Entregas no período</span></div>
        <div class="kpi"><b>${stats.totalItems}</b><span>Itens entregues</span></div>
        <div class="kpi"><b>${stats.signed}</b><span>Aceites assinados</span></div>
        <div class="kpi"><b>${stats.pending}</b><span>Aceites pendentes</span></div>
      </div>
      <h2>Entregas e aceites por colaborador</h2>
      <table>
        <thead><tr><th>Colaborador</th><th>Função</th><th>Setor</th><th>Entregas</th><th>Itens</th><th>Assinados</th><th>Pendentes</th></tr></thead>
        <tbody>${collaboratorRows || '<tr><td colspan="7">Sem registros no período.</td></tr>'}</tbody>
      </table>
      <h2>Detalhamento das entregas</h2>
      <table>
        <thead><tr><th>Data</th><th>Colaborador</th><th>Unidade</th><th>Motivo</th><th>Tipos</th><th>Qtde</th><th>Aceite</th></tr></thead>
        <tbody>${deliveryRows || '<tr><td colspan="7">Sem registros no período.</td></tr>'}</tbody>
      </table>
      ${pdfFooter(seal.html, seal.url)}`;

    printHtml(`Relatório de EPI — ${label}`, body);
    } finally {
      setSealing(false);
    }
  };

  const kpis = [
    { label: "Entregas no período", value: `${stats.totalDeliveries}`, icon: "ri-shirt-line", tone: "primary" },
    { label: "Itens entregues", value: `${stats.totalItems}`, icon: "ri-stack-line", tone: "secondary" },
    { label: "Aceites assinados", value: `${stats.signed}`, icon: "ri-verified-badge-line", tone: "secondary" },
    { label: "Aceites pendentes", value: `${stats.pending}`, icon: "ri-timer-line", tone: "accent" },
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
      title="Relatório de EPI"
      subtitle="Consolidado de entregas e aceites por colaborador, com filtro por semana, mês ou período."
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
      {deliveries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-200 text-foreground-400">
            <i className="ri-shirt-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma entrega registrada</p>
          <p className="text-xs text-foreground-500">Registre entregas de EPI para gerar o relatório.</p>
        </div>
      ) : (
        <>
          <PeriodFilterBar
            value={periodFilter.value}
            onChange={periodFilter.setValue}
            months={periodFilter.months}
            effectiveMonth={periodFilter.effectiveMonth}
          />

          {units.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground-500">Unidade:</span>
              <div className="relative">
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-64"
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

          <p className="mt-3 text-xs text-foreground-500">
            Período: <strong className="font-semibold text-foreground-800">{label}</strong>
            {unitFilter && (
              <> · Unidade: <strong className="font-semibold text-foreground-800">{unitFilter}</strong></>
            )}{" "}
            · <strong className="font-semibold text-foreground-800">{monthly.length}</strong> entrega(s)
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
            <h4 className="font-heading text-sm font-bold text-foreground-950">Entregas e aceites por colaborador</h4>
            {byCollaborator.length > 0 ? (
              <div className="mt-3 flex flex-col gap-4">
                {byCollaborator.map((c) => (
                  <div key={`${c.name}-${c.role}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground-800">
                        {c.name} <span className="text-foreground-400">· {c.role || "—"}</span>
                      </span>
                      <span className="whitespace-nowrap text-sm font-semibold text-foreground-600">
                        {c.deliveries} entrega(s) · {c.items} item(ns)
                        {c.pending > 0 && <span className="ml-1 text-accent-700">· {c.pending} pendente(s)</span>}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${Math.round((c.deliveries / maxDeliveries) * 100)}%` }}
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
            <h4 className="font-heading text-sm font-bold text-foreground-950">Entregas do período</h4>
            <ul className="mt-3 flex flex-col gap-3">
              {monthly.map((d) => (
                <li key={d.id} className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                    <i className="ri-shirt-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">{d.collaboratorName}</p>
                    <p className="truncate text-xs text-foreground-500">
                      {d.reason} · {itemsOf(d)} item(ns) · {d.collaboratorRole}
                    </p>
                  </div>
                  <span className="hidden whitespace-nowrap text-xs text-foreground-500 sm:block">{d.date}</span>
                  <span
                    className={`hidden items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold sm:flex ${
                      d.status === "Assinada" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                    }`}
                  >
                    <i className={d.status === "Assinada" ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
                    {d.status === "Assinada" ? "Assinado" : "Pendente"}
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