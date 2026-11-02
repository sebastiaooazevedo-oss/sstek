import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionCard } from "@/pages/app/components/ui";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { getInitials, useAppSession } from "@/pages/app/context";
import { PeriodFilterBar, periodLabel, usePeriodFilter } from "@/pages/app/components/PeriodFilter";
import { MOOD_OPTIONS, getMoodOption, isNegativeMood, moodToneChip } from "@/pages/app/mood/moodOptions";
import type { MoodId } from "@/pages/app/mood/moodOptions";
import { friendlyMoodDate, isoToBr, moodTime, resolveMoodActor } from "@/pages/app/mood/moodUtils";
import { teamMoods, useMoodState } from "@/pages/app/mood/moodStore";
import { followupStatusLabel, latestFollowupFor, useMoodFollowups } from "@/pages/app/mood/moodFollowupStore";
import { buildPeople, type PersonMoodSummary } from "@/pages/app/mood/moodPeople";
import { areasLedBy, useLeadership } from "@/pages/app/modules/leadership/leadershipStore";
import MoodTrendSection from "@/pages/app/modules/sentimento/components/MoodTrendSection";
import MoodPulseHero from "@/pages/app/modules/sentimento/components/MoodPulseHero";
import MoodPeoplePanel, { type PeopleTab } from "@/pages/app/modules/sentimento/components/MoodPeoplePanel";
import MoodPersonModal from "@/pages/app/modules/sentimento/components/MoodPersonModal";
import type { MoodTrendExport } from "@/pages/app/modules/sentimento/moodTrend";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

/**
 * Painel do gestor — "Sentimento da equipe".
 *
 * Abre com um retrato executivo do período (medidor da média + distribuição
 * clicável), segue pela evolução do sentimento e termina na lista de registros,
 * com busca, recorte por sentimento e destaque dos alertas.
 */
export default function SentimentoPage() {
  const session = useAppSession();
  const actor = useMemo(() => resolveMoodActor(session), [session]);
  const { rows, error } = useMoodState();
  const leadership = useLeadership();

  const [search, setSearch] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [moodFilter, setMoodFilter] = useState<MoodId | null>(null);
  const [unitFilter, setUnitFilter] = useState("");
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("moods");
  const [selectedPerson, setSelectedPerson] = useState<PersonMoodSummary | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const followups = useMoodFollowups();
  const trendExport = useRef<MoodTrendExport | null>(null);

  const leaderAreas = useMemo(() => areasLedBy(actor.collaboratorId), [actor, leadership]);
  const team = useMemo(() => teamMoods(rows, actor, leaderAreas), [rows, actor, leaderAreas]);

  // Unidades disponíveis no recorte do gestor (registro + cadastro antigo).
  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    team.forEach((entry) => entry.establishment && units.add(entry.establishment));
    return Array.from(units).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [team]);

  const periodFilter = usePeriodFilter(team.map((entry) => isoToBr(entry.moodDate)));
  const periodText = periodLabel(periodFilter.value, periodFilter.months);

  const periodEntries = useMemo(
    () =>
      team.filter(
        (entry) =>
          periodFilter.matches(isoToBr(entry.moodDate)) && (!unitFilter || entry.establishment === unitFilter)
      ),
    [team, periodFilter.matches, unitFilter]
  );

  const periodTotal = periodEntries.length;
  const periodAverage =
    periodTotal > 0 ? periodEntries.reduce((sum, e) => sum + e.moodScore, 0) / periodTotal : 0;
  const periodPositives = periodEntries.filter((e) => e.moodScore >= 4).length;
  const periodPositivePct = periodTotal > 0 ? Math.round((periodPositives / periodTotal) * 100) : 0;
  const periodNegatives = periodEntries.filter((e) => isNegativeMood(e.mood));
  const people = useMemo(() => buildPeople(periodEntries), [periodEntries]);

  // Atalhos externos (sino do topo e dashboard) abrem a aba de atenção e a
  // ficha da pessoa direto, sem exigir que o gestor procure na lista.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const personKey = searchParams.get("pessoa");
    if (tabParam === "attention") setPeopleTab("attention");
    if (!personKey) return;
    const found = people.find((person) => person.userKey === personKey);
    if (found) {
      setPeopleTab("attention");
      setSelectedPerson(found);
    }
  }, [searchParams, people]);

  const closePerson = () => {
    setSelectedPerson(null);
    if (searchParams.has("pessoa") || searchParams.has("tab")) {
      const next = new URLSearchParams(searchParams);
      next.delete("pessoa");
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  };

  const followupLabel = (userKey: string): string => {
    const record = latestFollowupFor(followups.rows, userKey);
    return record ? followupStatusLabel(record.status) : "Sem acolhimento";
  };

  const distribution = MOOD_OPTIONS.map((option) => ({
    option,
    count: periodEntries.filter((e) => e.mood === option.id).length,
  }));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return periodEntries.filter((entry) => {
      if (onlyAlerts && !isNegativeMood(entry.mood)) return false;
      if (moodFilter && entry.mood !== moodFilter) return false;
      if (term && !entry.userName.toLowerCase().includes(term) && !entry.area.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [periodEntries, search, onlyAlerts, moodFilter]);

  const total = filtered.length;
  const average = total > 0 ? filtered.reduce((sum, e) => sum + e.moodScore, 0) / total : 0;
  const negativeList = filtered.filter((e) => isNegativeMood(e.mood));
  const activeFilters = Boolean(search.trim() || onlyAlerts || moodFilter || unitFilter);

  const handleExportPdf = () => {
    const rowsList = filtered.map((e) => {
      const option = getMoodOption(e.mood);
      return [
        e.userName,
        e.area || "—",
        `${option?.emoji ?? ""} ${option?.label ?? "—"}`,
        e.reason || "—",
        followupLabel(e.userKey),
        `${isoToBr(e.moodDate)} ${moodTime(e.createdAt)}`,
      ];
    });
    const trend = trendExport.current;
    const chartBlock = trend?.chartSvg ? `<div class="chart">${trend.chartSvg}</div>` : "";
    const trendBlock = trend?.summaryHtml
      ? `<h2>Evolução do sentimento</h2>${chartBlock}${trend.summaryHtml}`
      : "";
    const areaBlock =
      trend && trend.areaRows.length > 0
        ? `<h2>Tendência por área/setor</h2>${tableHtml(
            ["Área", "Registros", "Média", "Alertas", "% Positivo", "Variação"],
            trend.areaRows
          )}`
        : "";
    const body = `${pdfHeader(`Sentimento da equipe · ${periodText}`)}
      <h1>Sentimento da equipe</h1>
      <p class="muted">Período de referência: ${escapeHtml(periodText)}${unitFilter ? ` · Unidade: ${escapeHtml(unitFilter)}` : ""} · ${total} registro(s) · média ${average.toFixed(1)}/5 · ${negativeList.length} alerta(s).</p>
      <div class="kpis">
        <div class="kpi"><b>${total}</b><span>Registros</span></div>
        <div class="kpi"><b>${periodPositivePct}%</b><span>Positivos</span></div>
        <div class="kpi"><b>${negativeList.length}</b><span>Alertas</span></div>
      </div>
      ${trendBlock}
      ${areaBlock}
      <h2>Registros</h2>
      ${tableHtml(["Colaborador", "Área", "Sentimento", "Motivo", "Acolhimento", "Registrado em"], rowsList)}
      ${pdfFooter()}`;
    printHtml(`Sentimento da equipe — ${periodText}`, body);
  };

  const handleExportCsv = () => {
    const rowsList = filtered.map((e) => {
      const option = getMoodOption(e.mood);
      return [
        e.userName,
        e.area || "",
        option?.label ?? "",
        e.reason || "",
        followupLabel(e.userKey),
        `${isoToBr(e.moodDate)} ${moodTime(e.createdAt)}`,
      ];
    });
    downloadCsv(
      `sentimento-da-equipe-${periodFilter.value.mode}.csv`,
      ["Colaborador", "Área", "Sentimento", "Motivo", "Acolhimento", "Registrado em"],
      rowsList
    );
  };

  const clearFilters = () => {
    setSearch("");
    setOnlyAlerts(false);
    setMoodFilter(null);
    setUnitFilter("");
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-emotion-line"></i>
            Gestão de pessoas
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Sentimento da equipe
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Acompanhe como os colaboradores sob sua responsabilidade estão se sentindo.
          </p>
        </div>
        <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} disabled={total === 0} />
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6">
        <MoodPulseHero
          total={periodTotal}
          average={periodAverage}
          positivePct={periodPositivePct}
          negativeCount={periodNegatives.length}
          distribution={distribution}
          selectedMood={moodFilter}
          onSelectMood={setMoodFilter}
          periodText={periodText}
        />
      </div>

      {periodNegatives.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent-300 bg-accent-50 p-4 md:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-emotion-unhappy-line text-xl"></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground-950">
              {periodNegatives.length} registro(s) de sentimento negativo no período
            </p>
            <p className="mt-0.5 text-xs text-foreground-600">
              Colaboradores que marcaram Triste ou Muito Triste. Um acolhimento próximo faz diferença.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOnlyAlerts(true);
              setMoodFilter(null);
              setPeopleTab("attention");
            }}
            className="hidden cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-3 py-2 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-100 sm:inline-flex"
          >
            <i className="ri-filter-3-line"></i>
            Ver alertas
          </button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-background-200 bg-background-50 p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-calendar-2-line text-lg"></i>
            </span>
            <div>
              <p className="text-sm font-bold text-foreground-950">Período</p>
              <p className="text-xs text-foreground-500">Filtre os registros para consultar um dia ou intervalo.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="w-full cursor-pointer appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-9 text-xs font-semibold text-foreground-900 outline-none focus:border-primary-400"
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
            <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1.5 text-xs font-semibold text-secondary-900">
              <i className="ri-filter-3-line"></i>
              Exibindo: {periodText}
            </span>
          </div>
        </div>
        <PeriodFilterBar
          value={periodFilter.value}
          onChange={periodFilter.setValue}
          months={periodFilter.months}
          effectiveMonth={periodFilter.effectiveMonth}
          className="mt-4"
        />
      </div>

      <div className="mt-6">
        <MoodPeoplePanel
          people={people}
          selectedMood={moodFilter}
          onSelectMood={setMoodFilter}
          onOpenPerson={setSelectedPerson}
          tab={peopleTab}
          onTabChange={setPeopleTab}
          followups={followups.rows}
          periodText={periodText}
        />
      </div>

      <div className="mt-6">
        <MoodTrendSection entries={periodEntries} periodText={periodText} exportRef={trendExport} />
      </div>

      <div className="mt-6">
        <SectionCard
          title="Registros"
          subtitle="Sentimento informado por cada colaborador"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
                <span className="flex h-9 w-9 items-center justify-center text-foreground-400">
                  <i className="ri-search-line text-base"></i>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="w-40 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 sm:w-52"
                />
              </div>
              <button
                type="button"
                onClick={() => setOnlyAlerts((v) => !v)}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  onlyAlerts
                    ? "border-accent-300 bg-accent-100 text-accent-900"
                    : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className="ri-alert-line"></i>
                Somente alertas
              </button>
            </div>
          }
        >
          {activeFilters && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-background-200 bg-background-100 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                <i className="ri-filter-3-line"></i>
                Filtros ativos
              </span>
              {moodFilter && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                  {getMoodOption(moodFilter)?.emoji} {getMoodOption(moodFilter)?.label}
                </span>
              )}
              {onlyAlerts && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800">
                  <i className="ri-alert-line"></i>
                  Somente alertas
                </span>
              )}
              {unitFilter && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                  <i className="ri-building-4-line"></i>
                  {unitFilter}
                </span>
              )}
              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
                  <i className="ri-search-line"></i>
                  “{search.trim()}”
                </span>
              )}
              <span className="text-[11px] font-medium text-foreground-500">
                {total} de {periodTotal} registro(s)
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-foreground-600 transition-colors hover:bg-background-200 hover:text-foreground-900"
              >
                <i className="ri-close-line"></i>
                Limpar
              </button>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {filtered.map((entry) => {
                const option = getMoodOption(entry.mood);
                const negative = isNegativeMood(entry.mood);
                return (
                  <div
                    key={entry.id}
                    className={`group flex flex-col gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm sm:flex-row sm:items-center ${
                      negative ? "border-accent-200 bg-accent-50" : "border-background-200 bg-background-100"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold ${moodToneChip(entry.mood)}`}
                      >
                        {getInitials(entry.userName)}
                      </span>
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-background-50 bg-background-50 text-sm">
                        {option?.emoji ?? "•"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground-950">{entry.userName}</p>
                        <span className="rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-600">
                          {option?.label ?? "—"}
                        </span>
                        {entry.area && <span className="text-[11px] text-foreground-400">{entry.area}</span>}
                        {negative && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-200 px-2.5 py-0.5 text-[10px] font-bold text-accent-900">
                            <i className="ri-alert-line"></i>
                            Alerta
                          </span>
                        )}
                      </div>
                      {entry.reason && (
                        <p className="mt-1.5 text-xs italic leading-relaxed text-foreground-600">“{entry.reason}”</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                      <span className="whitespace-nowrap text-[11px] font-semibold text-foreground-500">
                        {friendlyMoodDate(entry.moodDate)}
                      </span>
                      <span className="whitespace-nowrap text-[11px] text-foreground-400">{moodTime(entry.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                <i className="ri-emotion-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">
                {activeFilters ? "Nenhum registro com esses filtros" : "Nenhum registro no período"}
              </p>
              <p className="text-xs text-foreground-500">
                {activeFilters ? "Tente outro sentimento ou limpe os filtros." : "Ajuste o período para ver outros registros."}
              </p>
              {activeFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-1 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-refresh-line"></i>
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      <MoodPersonModal
        person={selectedPerson}
        open={selectedPerson !== null}
        onClose={closePerson}
        company={actor.company}
        editorName={actor.userName}
      />
    </div>
  );
}