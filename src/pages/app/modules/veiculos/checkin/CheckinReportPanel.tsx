import { useEffect, useMemo, useState } from "react";
import { TAMANHOS_PAGINA, paginar, periodoLabels, type ConsultaPeriodo, type TamanhoPagina } from "@/core/listing";
import {
  checkinKindMeta,
  formatDateTimeBr,
  type CheckinKind,
  type Vehicle,
  type VehicleCheckin,
  type VehicleRepairRequest,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import CheckinDetailModal from "@/pages/app/modules/veiculos/checkin/CheckinDetailModal";
import RepairRequestsView from "@/pages/app/modules/veiculos/checkin/RepairRequestsView";
import {
  avariasNovas,
  checkinsParaCsv,
  condutoresDe,
  filtrarCheckins,
  filtroVazio,
  kmDoCheckin,
  resumoCheckins,
  temAvaria,
  type FiltroCheckins,
} from "@/pages/app/modules/veiculos/checkin/checkinRules";
import { PlatePill } from "@/pages/app/modules/veiculos/checkin/checkinUi";

interface Props {
  vehicles: Vehicle[];
  checkins: VehicleCheckin[];
  repairs: VehicleRepairRequest[];
  canManageRepairs: boolean;
  onToast: (kind: "ok" | "err", text: string) => void;
}

const PERIODOS: ConsultaPeriodo[] = ["all", "today", "7d", "30d", "custom"];

/**
 * Painel "Check-ins realizados" — só para perfis com a permissão
 * `vehicles.checkinReport`. Filtra por período, condutor, placa e tipo,
 * exporta CSV/PDF e acompanha as solicitações de reparo.
 */
export default function CheckinReportPanel({ vehicles, checkins, repairs, canManageRepairs, onToast }: Props) {
  const [view, setView] = useState<"checkins" | "reparos">("checkins");
  const [filtro, setFiltro] = useState<FiltroCheckins>(filtroVazio);
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState<TamanhoPagina>(10);
  const [detailRef, setDetailRef] = useState<string | null>(null);

  const lista = useMemo(() => filtrarCheckins(checkins, filtro), [checkins, filtro]);
  const resumo = useMemo(() => resumoCheckins(lista, checkins, repairs), [lista, checkins, repairs]);
  const page = paginar(lista, pagina, tamanho);
  const condutores = useMemo(() => condutoresDe(checkins), [checkins]);
  const detail = checkins.find((item) => item.ref === detailRef) ?? null;
  const filtrosAtivos =
    filtro.periodo !== "all" || filtro.condutor || filtro.placa || filtro.tipo || filtro.somenteAvaria || filtro.veiculo;

  useEffect(() => setPagina(1), [filtro, tamanho]);

  const patch = (values: Partial<FiltroCheckins>) => setFiltro((prev) => ({ ...prev, ...values }));

  const exportCsv = () => {
    const csv = "﻿" + checkinsParaCsv(lista, checkins);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checkins-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast("ok", `${lista.length} check-in(s) exportado(s) em CSV.`);
  };

  const exportPdf = () => {
    const rows = lista
      .map(
        (item) =>
          `<tr><td>${formatDateTimeBr(item.performedAt)}</td><td>${item.kind === "entrega" ? "Retirada" : "Devolução"}</td><td>${escapeHtml(
            item.plateSnapshot
          )}</td><td>${escapeHtml(item.responsibleName)}</td><td>${escapeHtml(item.conferenteName)}</td><td>${
            item.odometer ?? ""
          }</td><td>${kmDoCheckin(item, checkins) ?? ""}</td><td>${item.fuelLevel ?? ""}%</td><td>${avariasNovas(item).length}</td><td>${
            item.repairRequests.length
          }</td></tr>`
      )
      .join("");
    const filtrosTexto = [
      periodoLabels[filtro.periodo] + (filtro.periodo === "custom" ? ` (${filtro.de || "…"} a ${filtro.ate || "…"})` : ""),
      filtro.condutor && `condutor: ${filtro.condutor}`,
      filtro.placa && `placa: ${filtro.placa}`,
      filtro.tipo && `tipo: ${filtro.tipo === "entrega" ? "retirada" : "devolução"}`,
      filtro.somenteAvaria && "somente com avaria",
    ]
      .filter(Boolean)
      .join(" · ");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Check-ins realizados</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}h1{font-size:16px;margin:0}p{color:#555;margin:4px 0 12px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f1f5f9}</style></head>
<body><h1>Check-ins realizados</h1><p>${escapeHtml(filtrosTexto)} · ${lista.length} registro(s) · gerado em ${formatDateTimeBr(
      new Date().toISOString()
    )}</p><table><thead><tr><th>Data</th><th>Tipo</th><th>Placa</th><th>Condutor</th><th>Conferente</th><th>Hodômetro</th><th>Km rodados</th><th>Combustível</th><th>Avarias</th><th>Reparos</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      onToast("err", "O navegador bloqueou a janela de impressão. Libere pop-ups para este site.");
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const kpis: { label: string; value: string; icon: string; tone: string; onClick?: () => void }[] = [
    { label: "Check-ins no filtro", value: String(resumo.total), icon: "ri-file-list-3-line", tone: "bg-primary-100 text-primary-700" },
    {
      label: "Retiradas",
      value: String(resumo.retiradas),
      icon: "ri-key-2-line",
      tone: "bg-secondary-100 text-secondary-800",
      onClick: () => patch({ tipo: "entrega" }),
    },
    {
      label: "Devoluções",
      value: String(resumo.devolucoes),
      icon: "ri-parking-box-line",
      tone: "bg-primary-100 text-primary-700",
      onClick: () => patch({ tipo: "devolucao" }),
    },
    { label: "Em uso agora", value: String(resumo.emUso), icon: "ri-steering-2-line", tone: "bg-accent-100 text-accent-800" },
    {
      label: "Com avaria",
      value: String(resumo.comAvaria),
      icon: "ri-error-warning-line",
      tone: "bg-danger-100 text-danger-800",
      onClick: () => patch({ somenteAvaria: true }),
    },
    { label: "Km rodados", value: resumo.kmRodados.toLocaleString("pt-BR"), icon: "ri-route-line", tone: "bg-background-200 text-foreground-700" },
    {
      label: "Reparos em aberto",
      value: String(resumo.reparosAbertos),
      icon: "ri-tools-line",
      tone: "bg-accent-100 text-accent-800",
      onClick: () => setView("reparos"),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-background-100 p-1" role="tablist" aria-label="Painel de check-ins">
          {(
            [
              ["checkins", "Check-ins realizados", "ri-file-list-3-line"],
              ["reparos", `Solicitações de reparo (${resumo.reparosAbertos})`, "ri-tools-line"],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === key ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              <i className={icon}></i>
              {label}
            </button>
          ))}
        </div>
        {view === "checkins" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={lista.length === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:border-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="ri-file-excel-2-line"></i>
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={lista.length === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:border-primary-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="ri-printer-line"></i>
              Imprimir / PDF
            </button>
          </div>
        )}
      </div>

      {view === "reparos" ? (
        <RepairRequestsView repairs={repairs} canManage={canManageRepairs} onOpenCheckin={setDetailRef} onToast={onToast} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
            {kpis.map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                onClick={kpi.onClick}
                disabled={!kpi.onClick}
                className={`flex flex-col gap-1.5 rounded-xl border border-background-200 bg-background-50 p-3 text-left transition-colors ${
                  kpi.onClick ? "cursor-pointer hover:border-primary-300" : "cursor-default"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.tone}`}>
                  <i className={kpi.icon}></i>
                </span>
                <span className="font-heading text-xl font-extrabold tabular-nums text-foreground-950">{kpi.value}</span>
                <span className="text-[10.5px] font-semibold text-foreground-500">{kpi.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-background-200 bg-background-50 p-3.5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
              {PERIODOS.map((periodo) => (
                <button
                  key={periodo}
                  type="button"
                  onClick={() => patch({ periodo })}
                  aria-pressed={filtro.periodo === periodo}
                  className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filtro.periodo === periodo ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-700 hover:bg-background-200"
                  }`}
                >
                  {periodo === "custom" ? "Período" : periodoLabels[periodo]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
              {filtro.periodo === "custom" && (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-foreground-600">De</span>
                    <input
                      type="date"
                      aria-label="De"
                      value={filtro.de}
                      onChange={(event) => patch({ de: event.target.value })}
                      className="rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-sm outline-none focus:border-primary-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-foreground-600">Até</span>
                    <input
                      type="date"
                      aria-label="Até"
                      value={filtro.ate}
                      onChange={(event) => patch({ ate: event.target.value })}
                      className="rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-sm outline-none focus:border-primary-400"
                    />
                  </label>
                </>
              )}
              <label className="flex flex-col gap-1 lg:col-span-2">
                <span className="text-[11px] font-semibold text-foreground-600">Condutor</span>
                <input
                  list="checkin-condutores"
                  aria-label="Filtrar por condutor"
                  value={filtro.condutor}
                  onChange={(event) => patch({ condutor: event.target.value })}
                  placeholder="Nome do condutor"
                  className="rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-sm outline-none focus:border-primary-400"
                />
                <datalist id="checkin-condutores">
                  {condutores.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground-600">Placa</span>
                <input
                  aria-label="Filtrar por placa"
                  value={filtro.placa}
                  onChange={(event) => patch({ placa: event.target.value.toUpperCase().slice(0, 8) })}
                  placeholder="ABC1D23"
                  list="checkin-placas"
                  className="rounded-md border border-background-300 bg-background-50 px-2.5 py-2 font-mono text-sm uppercase outline-none focus:border-primary-400"
                />
                <datalist id="checkin-placas">
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.ref} value={vehicle.plate} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground-600">Tipo</span>
                <select
                  aria-label="Filtrar por tipo"
                  value={filtro.tipo}
                  onChange={(event) => patch({ tipo: event.target.value as CheckinKind | "" })}
                  className="rounded-md border border-background-300 bg-background-50 px-2.5 py-2 text-sm outline-none focus:border-primary-400"
                >
                  <option value="">Retiradas e devoluções</option>
                  <option value="entrega">Só retiradas</option>
                  <option value="devolucao">Só devoluções</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 self-end rounded-md border border-background-300 px-2.5 py-2 text-xs font-semibold text-foreground-700">
                <input
                  type="checkbox"
                  checked={filtro.somenteAvaria}
                  onChange={(event) => patch({ somenteAvaria: event.target.checked })}
                  className="h-4 w-4 accent-[oklch(var(--primary-500))]"
                />
                Só com avaria
              </label>
            </div>
            {filtrosAtivos && (
              <button
                type="button"
                onClick={() => setFiltro(filtroVazio)}
                className="w-fit cursor-pointer text-xs font-semibold text-primary-700 underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-background-200 bg-background-50">
            {lista.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
                <i className="ri-search-line text-2xl text-foreground-400"></i>
                <p className="text-sm font-semibold text-foreground-700">Nenhum check-in encontrado</p>
                <p className="text-xs text-foreground-500">Ajuste o período ou os filtros.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="bg-background-100 text-[10px] font-bold uppercase tracking-wide text-foreground-500">
                    <tr>
                      <th className="px-3 py-2.5">Data / hora</th>
                      <th className="px-3 py-2.5">Tipo</th>
                      <th className="px-3 py-2.5">Placa</th>
                      <th className="px-3 py-2.5">Condutor</th>
                      <th className="px-3 py-2.5">Conferente</th>
                      <th className="px-3 py-2.5 text-right">Hodômetro</th>
                      <th className="px-3 py-2.5 text-right">Km rodados</th>
                      <th className="px-3 py-2.5 text-right">Comb.</th>
                      <th className="px-3 py-2.5">Ocorrências</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-200">
                    {page.itens.map((item) => {
                      const km = kmDoCheckin(item, checkins);
                      const novas = avariasNovas(item).length;
                      const itens = item.items.filter((it) => it.result === "avaria").length;
                      return (
                        <tr key={item.ref} className="cursor-pointer hover:bg-background-100" onClick={() => setDetailRef(item.ref)}>
                          <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-foreground-900">{formatDateTimeBr(item.performedAt)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${checkinKindMeta[item.kind].className}`}>
                              <i className={checkinKindMeta[item.kind].icon}></i>
                              {checkinKindMeta[item.kind].short}
                            </span>
                            {item.status === "aberta" && (
                              <span className="ml-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[9.5px] font-bold text-accent-800">em uso</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <PlatePill plate={item.plateSnapshot} size="sm" />
                          </td>
                          <td className="px-3 py-2.5 font-medium text-foreground-900">{item.responsibleName}</td>
                          <td className="px-3 py-2.5 text-foreground-600">{item.conferenteName}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                            {item.odometer !== null ? item.odometer.toLocaleString("pt-BR") : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                            {km !== null ? km.toLocaleString("pt-BR") : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{item.fuelLevel !== null ? `${item.fuelLevel}%` : "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex flex-wrap gap-1">
                              {!temAvaria(item) && item.repairRequests.length === 0 && (
                                <span className="text-[10.5px] font-semibold text-primary-700">
                                  <i className="ri-checkbox-circle-line"></i> Sem ocorrência
                                </span>
                              )}
                              {novas > 0 && (
                                <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold text-danger-800">
                                  {novas} avaria{novas > 1 ? "s" : ""}
                                </span>
                              )}
                              {itens > 0 && (
                                <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
                                  {itens} item{itens > 1 ? "s" : ""}
                                </span>
                              )}
                              {item.repairRequests.length > 0 && (
                                <span className="rounded-full bg-secondary-100 px-1.5 py-0.5 text-[10px] font-bold text-secondary-800">
                                  {item.repairRequests.length} reparo{item.repairRequests.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary-700">
                              Ver <i className="ri-arrow-right-s-line"></i>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {lista.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-background-200 px-3 py-2.5 text-xs text-foreground-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {page.de}–{page.ate} de {page.total}
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5">
                    <span>Por página</span>
                    <select
                      aria-label="Registros por página"
                      value={tamanho}
                      onChange={(event) => setTamanho(Number(event.target.value) as TamanhoPagina)}
                      className="rounded-md border border-background-300 bg-background-50 px-2 py-1 text-xs outline-none"
                    >
                      {TAMANHOS_PAGINA.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    aria-label="Página anterior"
                    disabled={page.pagina <= 1}
                    onClick={() => setPagina(page.pagina - 1)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-background-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  <span className="whitespace-nowrap">
                    Página {page.pagina} de {page.totalPaginas}
                  </span>
                  <button
                    type="button"
                    aria-label="Próxima página"
                    disabled={page.pagina >= page.totalPaginas}
                    onClick={() => setPagina(page.pagina + 1)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-background-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <CheckinDetailModal
        checkin={detail}
        checkins={checkins}
        repairs={repairs}
        onClose={() => setDetailRef(null)}
        onOpen={setDetailRef}
      />
    </div>
  );
}

function escapeHtml(value: string): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string
  );
}
