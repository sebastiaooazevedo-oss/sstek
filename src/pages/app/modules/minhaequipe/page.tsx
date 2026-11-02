import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DaysPill, SectionCard } from "@/pages/app/components/ui";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { getInitials, useAppSession } from "@/pages/app/context";
import { collaborators, type Collaborator } from "@/mocks/collaborators";
import { epiExpiryAlerts } from "@/mocks/epi";
import {
  areasLedBy,
  subordinatesByArea,
  subordinatesByPerson,
  subordinatesOf,
  useLeadership,
} from "@/pages/app/modules/leadership/leadershipStore";
import { getMoodOption, isNegativeMood } from "@/pages/app/mood/moodOptions";
import { findTodayMood, useMoodState } from "@/pages/app/mood/moodStore";
import type { MoodEntry } from "@/pages/app/mood/moodStore";
import { todayIso } from "@/pages/app/mood/moodUtils";
import { escapeHtml, pdfFooter, pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import CollaboratorDetailModal from "@/pages/app/modules/colaboradores/components/CollaboratorDetailModal";
import TeamMoodTrend, { type TeamTrendCapture } from "@/pages/app/modules/minhaequipe/components/TeamMoodTrend";
import CatOpenPanel from "@/pages/app/modules/documentos/components/CatOpenPanel";
import { useStructuredDocuments } from "@/pages/app/modules/documentos/structured/structuredStore";

/**
 * "Minha equipe" — visão do líder sobre quem está sob sua responsabilidade.
 * Reúne os liderados vinculados por nome (vínculo individual no cadastro) e por
 * área/setor (função), mostra o sentimento do dia de cada um (humor + alerta)
 * com atalho para o painel de sentimento, filtra rapidamente os casos de atenção
 * do dia, sinaliza quantos EPIs de cada liderado estão a vencer/vencidos e traz
 * o atalho para a ficha de cada colaborador. Todo o painel — liderados com
 * humor, EPIs a vencer e o gráfico de evolução do sentimento — pode ser
 * exportado em PDF. Admin/Super têm visão de supervisão (toda a operação).
 */
export default function MinhaEquipePage() {
  const session = useAppSession();
  const leadership = useLeadership();
  const { rows: moodRows } = useMoodState();
  const structuredRecords = useStructuredDocuments();
  const [detail, setDetail] = useState<Collaborator | null>(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const trendExport = useRef<TeamTrendCapture | null>(null);

  const isSupervisor = session.role === "admin" || session.role === "super";
  const me =
    collaborators.find((c) => c.name === session.name) ||
    collaborators.find((c) => c.email === session.email);

  const byName = useMemo(() => (me ? subordinatesByPerson(me.id) : []), [me]);
  const byArea = useMemo(() => (me ? subordinatesByArea(me.id) : []), [me, leadership]);
  const leaderAreas = useMemo(() => (me ? areasLedBy(me.id) : []), [me, leadership]);

  const team = useMemo(() => {
    if (me) return subordinatesOf(me.id);
    return isSupervisor ? collaborators.filter((c) => c.status !== "Desligado") : [];
  }, [me, isSupervisor, leadership]);

  const teamIds = useMemo(() => new Set(team.map((c) => c.id)), [team]);
  const teamIdList = useMemo(() => team.map((c) => c.id), [team]);
  const teamCpfList = useMemo(() => team.map((c) => c.cpf).filter(Boolean), [team]);
  const nameIds = useMemo(() => new Set(byName.map((c) => c.id)), [byName]);
  const areaIds = useMemo(() => new Set(byArea.map((c) => c.id)), [byArea]);

  const teamAlerts = useMemo(
    () => epiExpiryAlerts.filter((a) => teamIds.has(a.collaboratorId)),
    [teamIds]
  );
  const alertsExpired = teamAlerts.filter((a) => a.days < 0).length;
  const alertsSoon = teamAlerts.filter((a) => a.days >= 0).length;

  // Quantidade de EPIs a vencer/vencidos por colaborador (para o chip no card).
  const epiCountByMember = useMemo(() => {
    const map = new Map<string, { total: number; expired: number }>();
    teamAlerts.forEach((alert) => {
      const current = map.get(alert.collaboratorId) ?? { total: 0, expired: 0 };
      current.total += 1;
      if (alert.days < 0) current.expired += 1;
      map.set(alert.collaboratorId, current);
    });
    return map;
  }, [teamAlerts]);

  // Sentimento do dia de cada liderado (humor + alerta).
  const today = todayIso();
  const moodToday = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    team.forEach((member) => {
      const entry = findTodayMood(moodRows, member.id, today);
      if (entry) map.set(member.id, entry);
    });
    return map;
  }, [team, moodRows, today]);

  // Registros de sentimento apenas da equipe (alimenta o gráfico de evolução).
  const teamMoodEntries = useMemo(
    () => moodRows.filter((entry) => teamIds.has(entry.userKey)),
    [moodRows, teamIds]
  );

  const moodRegistered = moodToday.size;
  const alertIds = useMemo(
    () =>
      new Set(
        team
          .filter((member) => {
            const entry = moodToday.get(member.id);
            return entry ? isNegativeMood(entry.mood) : false;
          })
          .map((member) => member.id)
      ),
    [team, moodToday]
  );
  const moodAlerts = alertIds.size;

  // Liderados exibidos (respeitando o filtro "somente alerta hoje").
  const fByPerson = onlyAlerts ? byName.filter((m) => alertIds.has(m.id)) : byName;
  const fByArea = onlyAlerts ? byArea.filter((m) => alertIds.has(m.id)) : byArea;
  const fSupervision = onlyAlerts ? team.filter((m) => alertIds.has(m.id)) : team;
  const visibleCount = me ? fByPerson.length + fByArea.length : fSupervision.length;

  const kpis = [
    { label: "Colaboradores na equipe", value: `${team.length}`, icon: "ri-team-line", tone: "primary" },
    { label: "Com alerta hoje", value: `${moodAlerts}`, icon: "ri-alert-line", tone: "accent" },
    { label: "EPIs a vencer/vencidos", value: `${teamAlerts.length}`, icon: "ri-shield-cross-line", tone: "accent" },
    { label: "Registraram o humor hoje", value: `${moodRegistered}/${team.length}`, icon: "ri-emotion-line", tone: "primary" },
  ];

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const epiBadgeOf = (member: Collaborator): { total: number; expired: number } | undefined =>
    epiCountByMember.get(member.id);

  const renderMember = (member: Collaborator, linkLabel: string) => {
    const mood = moodToday.get(member.id);
    const option = mood ? getMoodOption(mood.mood) : undefined;
    const negative = mood ? isNegativeMood(mood.mood) : false;
    const epi = epiBadgeOf(member);
    return (
      <li
        key={`${member.id}-${linkLabel}`}
        className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-100 text-sm font-bold text-secondary-900">
          {member.photo ? (
            <img src={member.photo} alt={member.name} className="h-full w-full object-top" />
          ) : (
            getInitials(member.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground-950">{member.name}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
              <i className="ri-links-line"></i>
              {linkLabel}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-foreground-500">
            {member.role} · {member.area}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/sentimento"
            title="Abrir o painel de sentimento"
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              negative
                ? "bg-accent-100 text-accent-900 hover:bg-accent-200"
                : option
                  ? "bg-primary-100 text-primary-700 hover:bg-primary-200"
                  : "bg-background-200 text-foreground-500 hover:bg-background-300"
            }`}
          >
            {option ? <span className="text-sm">{option.emoji}</span> : <i className="ri-emotion-line"></i>}
            {option ? option.label : "Sem registro hoje"}
            {negative && <i className="ri-alert-line"></i>}
          </Link>
          {epi && (
            <span
              title={`${epi.total} EPI(s) a vencer/vencido(s) de ${member.name}`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${
                epi.expired > 0 ? "bg-accent-200 text-accent-900" : "bg-accent-100 text-accent-800"
              }`}
            >
              <i className="ri-shield-cross-line"></i>
              {epi.expired > 0 ? `${epi.total} EPI em alerta` : `${epi.total} EPI a vencer`}
            </span>
          )}
          <button
            type="button"
            onClick={() => setDetail(member)}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-50"
          >
            <i className="ri-id-card-line text-base"></i>
            Ver ficha
          </button>
        </div>
      </li>
    );
  };

  const emptyTeam = (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
        <i className="ri-team-line text-2xl"></i>
      </span>
      <p className="text-sm font-semibold text-foreground-800">Você ainda não lidera uma equipe</p>
      <p className="max-w-md text-xs leading-relaxed text-foreground-500">
        Quando um gestor designar colaboradores sob a sua responsabilidade — por nome no cadastro ou por área/setor
        nas Configurações — eles aparecem aqui com atalho para a ficha de cada um.
      </p>
    </div>
  );

  const linkLabelOf = (member: Collaborator): string => {
    if (nameIds.has(member.id)) return "por nome";
    if (areaIds.has(member.id)) return "por área";
    return member.area;
  };

  const epiLabelOf = (member: Collaborator): string => {
    const epi = epiBadgeOf(member);
    if (!epi || epi.total === 0) return "—";
    return epi.expired > 0 ? `${epi.total} (${epi.expired} vencido${epi.expired > 1 ? "s" : ""})` : `${epi.total}`;
  };

  const buildTeamRows = (): string[][] =>
    team.map((member) => {
      const mood = moodToday.get(member.id);
      const option = mood ? getMoodOption(mood.mood) : undefined;
      const negative = mood ? isNegativeMood(mood.mood) : false;
      return [
        member.name,
        member.role,
        member.area,
        linkLabelOf(member),
        option ? `${option.emoji} ${option.label}` : "Sem registro hoje",
        epiLabelOf(member),
        negative ? "Alerta negativo" : option ? "Dentro do esperado" : "—",
      ];
    });

  const buildEpiRows = (): string[][] =>
    teamAlerts.map((item) => [
      item.collaboratorName,
      item.collaboratorRole,
      item.epi,
      item.ca,
      item.expires,
      item.days < 0 ? `Vencido há ${Math.abs(item.days)} dia(s)` : `Vence em ${item.days} dia(s)`,
    ]);

  const teamTableHeaders = ["Colaborador", "Função", "Área", "Vínculo", "Humor de hoje", "EPI a vencer", "Situação"];

  const handleExportPdf = () => {
    const teamRows = buildTeamRows();
    const epiRows = buildEpiRows();
    const epiBlock = epiRows.length
      ? tableHtml(["Colaborador", "Função", "Equipamento (EPI)", "CA", "Validade", "Situação"], epiRows)
      : '<p class="muted">Nenhum EPI com validade próxima do vencimento ou vencido na equipe.</p>';
    const trend = trendExport.current;
    const trendBlock =
      trend && trend.chartSvg
        ? `<h2>Evolução do sentimento da equipe (anexo visual)</h2>${trend.summaryHtml}<div class="chart">${trend.chartSvg}</div>`
        : "";

    // Capa com resumo executivo do dia (alertas, EPIs e registros).
    const alertMembers = team.filter((m) => alertIds.has(m.id));
    const pendingMoods = team.length - moodRegistered;
    const coverHighlights: string[] = [
      moodAlerts > 0
        ? `<li><strong>${moodAlerts} alerta(s) de sentimento</strong> hoje${
            alertMembers.length ? `: ${escapeHtml(alertMembers.map((m) => m.name).join(", "))}` : ""
          }.</li>`
        : `<li>Nenhum alerta de sentimento negativo hoje na equipe.</li>`,
      teamAlerts.length > 0
        ? `<li><strong>${teamAlerts.length} EPI(s) a vencer/vencido(s)</strong> — ${alertsExpired} vencido(s) e ${alertsSoon} a vencer.</li>`
        : `<li>Todos os EPIs da equipe estão com o CA dentro da validade.</li>`,
      `<li><strong>${moodRegistered} de ${team.length}</strong> colaborador(es) registraram o humor hoje${
        pendingMoods > 0 ? ` — ${pendingMoods} ainda sem registro` : ""
      }.</li>`,
    ];
    const cover = `<section class="cover">
      ${pdfHeader("Minha equipe · Resumo executivo do dia")}
      <div class="cover-hero">
        <p class="cover-eyebrow">Liderança · Resumo executivo</p>
        <h1 class="cover-title">Resumo executivo do dia</h1>
        <p class="cover-sub">${escapeHtml(session.name)} · ${team.length} colaborador(es) sob sua responsabilidade</p>
        <p class="cover-date">${todayBr()}</p>
      </div>
      <div class="cover-kpis">
        <div class="cover-kpi${moodAlerts > 0 ? " is-alert" : ""}"><b>${moodAlerts}</b><span>Alertas de sentimento hoje</span></div>
        <div class="cover-kpi${teamAlerts.length > 0 ? " is-alert" : ""}"><b>${teamAlerts.length}</b><span>EPIs a vencer/vencidos</span></div>
        <div class="cover-kpi"><b>${moodRegistered}/${team.length}</b><span>Registros de humor hoje</span></div>
      </div>
      <h2>Destaques do dia</h2>
      <ul class="cover-list">${coverHighlights.join("")}</ul>
      <div class="cover-note"><strong>Leitura rápida:</strong> ${
        moodAlerts > 0 || teamAlerts.length > 0
          ? "há pontos de atenção que merecem prioridade hoje — confira as seções Liderados e EPI a vencer nas páginas seguintes."
          : "não há alertas de sentimento nem EPIs críticos hoje — a equipe está dentro do esperado."
      }</div>
      <div class="cover-meta"><span>SSTEK · Gestão Inteligente em Segurança do Trabalho</span><span>Minha equipe · ${escapeHtml(session.name)}</span></div>
    </section>`;

    const body = `${cover}
      ${pdfHeader("Minha equipe · Liderança")}
      <h1>Minha equipe</h1>
      <p class="muted">
        Colaboradores sob responsabilidade do líder — vínculos por nome e por área/setor — com o sentimento do dia,
        os Equipamentos de Proteção Individual (EPI) a vencer na equipe e a evolução do sentimento do time.
      </p>
      <div class="kpis">
        <div class="kpi"><b>${team.length}</b><span>Colaboradores na equipe</span></div>
        <div class="kpi"><b>${byName.length}</b><span>Vinculados por nome</span></div>
        <div class="kpi"><b>${byArea.length}</b><span>Vinculados por área</span></div>
        <div class="kpi"><b>${moodRegistered}/${team.length}</b><span>Registraram o humor hoje</span></div>
        <div class="kpi"><b>${moodAlerts}</b><span>Alertas de sentimento hoje</span></div>
        <div class="kpi"><b>${teamAlerts.length}</b><span>EPI a vencer/vencido</span></div>
      </div>
      ${
        leaderAreas.length > 0
          ? `<p class="muted">Áreas sob liderança: <strong>${escapeHtml(leaderAreas.join(", "))}</strong></p>`
          : ""
      }
      <h2>Liderados e sentimento do dia</h2>
      ${tableHtml(teamTableHeaders, teamRows)}
      <h2>EPI a vencer na equipe</h2>
      <p class="muted">${alertsExpired} vencido(s) e ${alertsSoon} a vencer — validade do CA dos equipamentos da equipe.</p>
      ${epiBlock}
      ${trendBlock}
      ${pdfFooter()}`;
    printHtml("Minha equipe — liderança", body);
  };

  const handleExportCsv = () => {
    downloadCsv("minha-equipe.csv", teamTableHeaders, buildTeamRows());
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-team-line"></i>
            Liderança
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Minha equipe
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Acompanhe os colaboradores sob sua responsabilidade — sentimento do dia, ficha de cada um e os EPIs a
            vencer na equipe.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/app/sentimento"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-emotion-line text-base"></i>
            Sentimento da equipe
          </Link>
          <ExportMenu
            onExportPdf={handleExportPdf}
            onExportCsv={handleExportCsv}
            disabled={team.length === 0}
          />
        </div>
      </div>

      {team.length === 0 ? (
        <div className="mt-6">{emptyTeam}</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneIcon[kpi.tone]}`}>
                  <i className={`${kpi.icon} text-lg`}></i>
                </span>
                <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground-500">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Sentimento de hoje da equipe */}
          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  moodAlerts > 0 ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
                }`}
              >
                <i className={moodAlerts > 0 ? "ri-emotion-unhappy-line text-lg" : "ri-emotion-happy-line text-lg"}></i>
              </span>
              <div>
                <p className="text-sm font-bold text-foreground-950">
                  Sentimento de hoje: {moodRegistered}/{team.length} registraram
                </p>
                <p className="text-xs text-foreground-500">
                  {moodAlerts > 0
                    ? `${moodAlerts} colaborador(es) com sentimento negativo hoje — considere um acolhimento.`
                    : "Nenhum alerta de sentimento negativo hoje na sua equipe."}
                </p>
              </div>
            </div>
            <Link
              to="/app/sentimento"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100"
            >
              <i className="ri-arrow-right-line"></i>
              Abrir painel de sentimento
            </Link>
          </div>

          {me && leaderAreas.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-100/60 px-4 py-3 text-xs text-secondary-900">
              <i className="ri-node-tree text-base"></i>
              <span className="font-semibold">Áreas sob sua liderança:</span>
              {leaderAreas.map((area) => (
                <span key={area} className="rounded-full bg-background-50 px-2.5 py-0.5 font-semibold">
                  {area}
                </span>
              ))}
            </div>
          )}

          {/* Filtro: somente casos de atenção de hoje */}
          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-1 rounded-full bg-background-100 p-1">
              <button
                type="button"
                onClick={() => setOnlyAlerts(false)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  !onlyAlerts ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-team-line text-base"></i>
                Todos
              </button>
              <button
                type="button"
                onClick={() => setOnlyAlerts(true)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  onlyAlerts ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className="ri-alert-line text-base"></i>
                Somente alerta hoje
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    onlyAlerts ? "bg-background-50/25 text-background-50" : "bg-accent-200 text-accent-900"
                  }`}
                >
                  {moodAlerts}
                </span>
              </button>
            </div>
            <span className="text-xs text-foreground-500">
              {onlyAlerts
                ? `Exibindo ${visibleCount} caso(s) de atenção de hoje`
                : "Mostrando todos os colaboradores sob sua responsabilidade"}
            </span>
          </div>

          {onlyAlerts && visibleCount === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-emotion-happy-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum alerta de sentimento hoje</p>
              <p className="max-w-md text-xs leading-relaxed text-foreground-500">
                Nenhum colaborador da sua equipe registrou sentimento negativo hoje. Bom sinal — sua equipe está bem.
              </p>
              <button
                type="button"
                onClick={() => setOnlyAlerts(false)}
                className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100"
              >
                <i className="ri-list-check"></i>
                Ver todos os liderados
              </button>
            </div>
          ) : (
            <>
              {/* Liderados por nome */}
              {fByPerson.length > 0 && (
                <div className="mt-6">
                  <SectionCard
                    title="Liderados por nome"
                    subtitle="Vínculo individual definido no cadastro (Gestor / Líder responsável)"
                  >
                    <ul className="flex flex-col gap-3">{fByPerson.map((m) => renderMember(m, "por nome"))}</ul>
                  </SectionCard>
                </div>
              )}

              {/* Liderados por área */}
              {fByArea.length > 0 && (
                <div className="mt-6">
                  <SectionCard
                    title="Liderados por área/setor"
                    subtitle="Colaboradores dos setores pelos quais você responde (vínculo por função)"
                  >
                    <ul className="flex flex-col gap-3">{fByArea.map((m) => renderMember(m, "por área"))}</ul>
                  </SectionCard>
                </div>
              )}

              {/* Visão de supervisão (Admin/Super) */}
              {!me && fSupervision.length > 0 && (
                <div className="mt-6">
                  <SectionCard
                    title="Colaboradores sob supervisão"
                    subtitle="Visão ampliada de gestão — toda a operação ativa"
                  >
                    <ul className="flex flex-col gap-3">
                      {fSupervision.map((m) => renderMember(m, m.area))}
                    </ul>
                  </SectionCard>
                </div>
              )}
            </>
          )}

          {/* CATs em aberto da equipe — mesmas pendências legais da área de Documentos */}
          <CatOpenPanel
            records={structuredRecords}
            collaboratorIds={teamIdList}
            collaboratorCpfs={teamCpfList}
            className="mt-6"
            title="CATs em aberto na sua equipe"
            description="Comunicação de Acidente de Trabalho dos seus liderados que ainda precisam de nº oficial do eSocial / Empregador Web ou do recibo de entrega ao trabalhador (Lei 8.213/91, art. 22, §2º)."
          />

          {/* EPI a vencer na equipe */}
          <div className="mt-6">
            <SectionCard
              title="EPI a vencer na equipe"
              subtitle={`${alertsExpired} vencido(s) e ${alertsSoon} a vencer — validade do CA dos equipamentos da sua equipe`}
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
              {teamAlerts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                      <tr className="border-b border-background-200 text-left">
                        <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Colaborador</th>
                        <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Equipamento (EPI)</th>
                        <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">CA</th>
                        <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Validade</th>
                        <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamAlerts.map((item) => (
                        <tr key={item.id} className="border-b border-background-100 last:border-0">
                          <td className="py-3.5">
                            <button
                              type="button"
                              onClick={() => setDetail(collaborators.find((c) => c.id === item.collaboratorId) || null)}
                              className="text-left"
                            >
                              <p className="text-sm font-semibold text-foreground-950 hover:text-primary-600">
                                {item.collaboratorName}
                              </p>
                              <p className="text-xs text-foreground-500">{item.collaboratorRole}</p>
                            </button>
                          </td>
                          <td className="py-3.5 text-sm text-foreground-700">{item.epi}</td>
                          <td className="py-3.5 text-sm text-foreground-600">{item.ca}</td>
                          <td className="whitespace-nowrap py-3.5 text-sm text-foreground-700">{item.expires}</td>
                          <td className="py-3.5 text-right">
                            {item.days < 0 ? (
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-200 px-2.5 py-1 text-[11px] font-semibold text-accent-900">
                                <i className="ri-error-warning-line"></i>
                                Vencido há {Math.abs(item.days)} dias
                              </span>
                            ) : (
                              <DaysPill days={item.days} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <i className="ri-checkbox-circle-line text-2xl"></i>
                  </span>
                  <p className="text-sm font-semibold text-foreground-800">Nenhum EPI a vencer na equipe</p>
                  <p className="text-xs text-foreground-500">
                    Todos os equipamentos da sua equipe estão com o CA dentro da validade.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Evolução do sentimento da equipe (também anexada ao PDF) */}
          <div className="mt-6">
            <TeamMoodTrend entries={teamMoodEntries} capture={trendExport} />
          </div>
        </>
      )}

      <CollaboratorDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        collaborator={detail}
        onEdit={() => setDetail(null)}
      />
    </div>
  );
}