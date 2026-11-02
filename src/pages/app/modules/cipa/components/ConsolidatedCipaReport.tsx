import { useMemo, useState } from "react";
import type { Cipa, CipaElection } from "@/mocks/cipa";
import { buildBuData } from "@/pages/app/modules/cipa/ballotResult";
import {
  buildConsolidatedCipaPdfBody,
  type ConsolidatedUnit,
} from "@/pages/app/modules/cipa/cipaReports";
import { indicationsOf, isElectionFinalized, type StoreState } from "@/pages/app/modules/cipa/electionVotingStore";
import { downloadCsv } from "@/pages/app/utils/exportTable";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { useAppSession } from "@/pages/app/context";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";

interface ConsolidatedCipaReportProps {
  cipas: Cipa[];
  /** Comissão selecionada no filtro do topo (o relatório tem filtro próprio). */
  cipaId?: string;
  elections: CipaElection[];
  store: StoreState;
}

interface UnitView extends ConsolidatedUnit {
  id: string;
}

/**
 * Relatório consolidado da CIPA por unidade: para cada estabelecimento, mostra o
 * período vigente do mandato, os eleitos, as indicações da empresa e a
 * composição final da comissão.
 *
 * O relatório possui o seu PRÓPRIO filtro por unidade, independente do filtro
 * de comissão do topo: ao escolher uma unidade, considera todas as comissões
 * cadastradas; sem escolha, consolida todas as unidades.
 */
export default function ConsolidatedCipaReport({ cipas, elections, store }: ConsolidatedCipaReportProps) {
  const [unitSel, setUnitSel] = useState("");
  const [sealing, setSealing] = useState(false);
  const session = useAppSession();

  const unitOptions = useMemo(() => {
    const seen = new Set<string>();
    cipas.forEach((c) => {
      const key = c.unit || c.name;
      if (key) seen.add(key);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [cipas]);

  const unitFilter = unitSel;

  const units = useMemo<UnitView[]>(() => {
    const pool = unitSel ? cipas.filter((c) => (c.unit || c.name) === unitSel) : cipas;
    return pool.map((cipa) => {
      const cipaElections = elections.filter((e) => e.cipaId === cipa.id);
      const election =
        cipaElections.find((e) => isElectionFinalized(store, e.id)) ||
        cipaElections.find((e) => e.status === "Publicada" || e.status === "Apurada") ||
        cipaElections[0];

      const bu = election ? buildBuData(store, election) : undefined;
      const elected = bu
        ? bu.ranking
            .filter((r) => r.seat === "titular" || r.seat === "suplente")
            .map((r) => ({ name: r.name, roleFunction: r.roleFunction, seat: r.seat, votes: r.votes }))
        : [];
      const indications = election
        ? indicationsOf(store, election.id).map((i) => ({
            name: i.name,
            memberRole: i.memberRole,
            representation: i.representation,
            confirmed: i.confirmed,
          }))
        : [];
      const composition = cipa.members.map((m) => ({
        name: m.name,
        memberRole: m.memberRole,
        representation: m.representation,
        roleFunction: m.roleFunction,
      }));

      return {
        id: cipa.id,
        cipaName: cipa.name,
        unit: cipa.unit,
        status: cipa.status,
        mandate: cipa.mandateNumber,
        mandateStart: cipa.mandateStart,
        mandateEnd: cipa.mandateEnd,
        electionTitle: election?.title || "",
        electionProcess: election?.processNumber || "",
        elected,
        indications,
        composition,
      };
    });
  }, [cipas, unitSel, elections, store]);

  const totals = useMemo(
    () => ({
      elected: units.reduce((sum, u) => sum + u.elected.length, 0),
      indications: units.reduce((sum, u) => sum + u.indications.length, 0),
      composition: units.reduce((sum, u) => sum + u.composition.length, 0),
    }),
    [units]
  );

  const handlePdf = async () => {
    if (sealing) return;
    setSealing(true);
    try {
      const unitLabel = unitFilter || "Todas as unidades";
      const seal = await reportSealHtml({
        scope: "cipa",
        referenceRef: `relatorio-cipa-unidades|${unitFilter || "todas"}`,
        referenceLabel: `Relatório consolidado da CIPA — ${unitLabel}`,
        caption: "Relatório consolidado da CIPA",
        issuerName: session.name,
        content: {
          documento: "relatorio-cipa-por-unidade",
          unidade: unitLabel,
          unidades: units,
        },
      });
      printHtml(
        "Relatório consolidado da CIPA por unidade",
        buildConsolidatedCipaPdfBody(units, unitFilter, seal.html, seal.url)
      );
    } finally {
      setSealing(false);
    }
  };

  const handleCsv = () => {
    const headers = ["Unidade", "Comissão", "Mandato", "Vigência", "Situação", "Eleitos", "Indicações", "Composição"];
    const rows = units.map((u) => [
      u.unit || "—",
      u.cipaName,
      u.mandate || "—",
      `${u.mandateStart || "—"} a ${u.mandateEnd || "—"}`,
      u.status || "—",
      String(u.elected.length),
      String(u.indications.length),
      String(u.composition.length),
    ]);
    downloadCsv("relatorio-cipa-por-unidade.csv", headers, rows);
  };

  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-200 text-foreground-500">
          <i className="ri-file-chart-2-line text-2xl"></i>
        </span>
        <p className="text-sm font-semibold text-foreground-800">Nenhuma comissão para consolidar</p>
        <p className="max-w-md text-xs text-foreground-500">Cadastre uma CIPA/estabelecimento para gerar o relatório.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Relatório consolidado por unidade</h2>
          <p className="mt-0.5 text-sm text-foreground-600">
            Período vigente, eleitos, indicações da empresa e composição final de cada comissão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <i className="ri-map-pin-2-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
            <select
              value={unitSel}
              onChange={(e) => setUnitSel(e.target.value)}
              aria-label="Filtrar o relatório por unidade"
              className="appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-9 pr-9 text-xs font-semibold text-foreground-800 outline-none transition-colors focus:border-primary-400"
            >
              <option value="">Todas as unidades</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
          <button
            type="button"
            onClick={() => void handlePdf()}
            disabled={sealing}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className={sealing ? "ri-loader-4-line animate-spin text-base" : "ri-file-pdf-2-line text-base"}></i>
            {sealing ? "Chancelando…" : "Relatório (PDF)"}
          </button>
          <button
            type="button"
            onClick={handleCsv}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-file-excel-2-line text-base"></i>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-background-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Unidades</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground-900">{units.length}</p>
        </div>
        <div className="rounded-md bg-primary-100 px-3 py-2 text-primary-700">
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Eleitos</p>
          <p className="mt-0.5 text-sm font-semibold">{totals.elected}</p>
        </div>
        <div className="rounded-md bg-secondary-100 px-3 py-2 text-secondary-800">
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Indicações</p>
          <p className="mt-0.5 text-sm font-semibold">{totals.indications}</p>
        </div>
        <div className="rounded-md bg-accent-100 px-3 py-2 text-accent-800">
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Composição</p>
          <p className="mt-0.5 text-sm font-semibold">{totals.composition}</p>
        </div>
      </div>

      {unitFilter && (
        <p className="flex items-center gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-2.5 text-xs font-semibold text-secondary-900">
          <i className="ri-filter-3-line"></i>
          Exibindo somente: {unitFilter}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {units.map((u) => (
          <div key={u.id} className="rounded-lg border border-background-200 bg-background-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <i className="ri-government-line text-xl"></i>
                </span>
                <div>
                  <h3 className="font-heading text-base font-bold text-foreground-950">{u.cipaName}</h3>
                  <p className="mt-0.5 text-xs text-foreground-500">{u.unit || "—"}</p>
                </div>
              </div>
              <span className="whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-800">
                Mandato {u.mandate || "—"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md bg-background-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Início</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground-900">{u.mandateStart || "—"}</p>
              </div>
              <div className="rounded-md bg-background-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Fim</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground-900">{u.mandateEnd || "—"}</p>
              </div>
              <div className="rounded-md bg-background-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Situação</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground-900">{u.status || "—"}</p>
              </div>
              <div className="rounded-md bg-background-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Processo</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground-900">{u.electionProcess || "—"}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Eleitos ({u.elected.length})
                </p>
                {u.elected.length === 0 ? (
                  <p className="text-xs text-foreground-500">Nenhum processo eleitoral apurado.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {u.elected.map((r, i) => (
                      <div key={`${r.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-primary-50 px-3 py-2">
                        <span className="min-w-0 truncate text-xs font-medium text-foreground-900">
                          {r.name}
                          <span className="ml-1.5 text-[10px] text-foreground-400">{r.roleFunction}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${r.seat === "titular" ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-800"}`}>
                            {r.seat === "titular" ? "Tit." : "Sup."}
                          </span>
                          <strong className="text-xs font-bold text-foreground-950">{r.votes}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Indicações da empresa ({u.indications.length})
                </p>
                {u.indications.length === 0 ? (
                  <p className="text-xs text-foreground-500">Nenhuma indicação registrada.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {u.indications.map((n, i) => (
                      <div key={`${n.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-secondary-50 px-3 py-2">
                        <span className="min-w-0 truncate text-xs font-medium text-foreground-900">
                          {n.name}
                          <span className="ml-1.5 text-[10px] text-foreground-400">{n.memberRole}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${n.confirmed ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"}`}>
                          {n.confirmed ? "Confirmada" : "Aguardando"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                  Composição final ({u.composition.length})
                </p>
                {u.composition.length === 0 ? (
                  <p className="text-xs text-foreground-500">Composição não informada.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {u.composition.map((m, i) => (
                      <div key={`${m.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-background-100 px-3 py-2">
                        <span className="min-w-0 truncate text-xs font-medium text-foreground-900">
                          {m.name}
                          <span className="ml-1.5 text-[10px] text-foreground-400">{m.roleFunction}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-background-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground-600">
                          {m.memberRole}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}