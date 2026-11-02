import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppSession } from "@/pages/app/context";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import ExportMenu from "@/pages/app/components/ExportMenu";
import ConsultasExternasTable from "@/pages/app/modules/qrcodes/components/ConsultasExternasTable";
import {
  dentroDoPeriodo,
  fetchConsultasExternas,
  formatConsultaCpf,
  formatConsultaDateTime,
  isToday,
  periodoLabels,
  totalPorOrgao,
  type ConsultaExterna,
  type ConsultaPeriodo,
} from "@/pages/app/modules/qrcodes/consultasExternasApi";
import { pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

/**
 * Relatório das consultas externas da ficha de verificação.
 *
 * Responde o que a fiscalização e a LGPD cobram primeiro: quem consultou,
 * de qual órgão, com qual finalidade e em que data/hora. Lê direto da tabela
 * `fiscalizacao_consultas`, que o RLS limita à empresa do usuário logado.
 *
 * Os filtros (período, busca, órgão, ordenação) são aplicados sobre a página
 * carregada — a contagem por órgão respeita o período escolhido.
 */
export default function ConsultasExternasPage() {
  const session = useAppSession();
  const { can, loading: carregandoPermissao } = usePermissions();
  const podeConsultar = can("qrcodes.consultas");

  const [consultas, setConsultas] = useState<ConsultaExterna[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orgaoFilter, setOrgaoFilter] = useState("");
  const [periodo, setPeriodo] = useState<ConsultaPeriodo>("all");
  const [order, setOrder] = useState<"recent" | "oldest">("recent");

  const carregar = useCallback(async () => {
    setLoading(true);
    const resultado = await fetchConsultasExternas();
    setConsultas(resultado.data);
    setError(resultado.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (carregandoPermissao || !podeConsultar) {
      setLoading(false);
      return;
    }
    void carregar();
  }, [carregandoPermissao, podeConsultar, carregar]);

  const orgaos = useMemo(
    () => Array.from(new Set(consultas.map((item) => item.orgao).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [consultas],
  );

  /** Consultas dentro do período escolhido — base dos totais por órgão. */
  const noPeriodo = useMemo(
    () => consultas.filter((item) => dentroDoPeriodo(item.createdAt, periodo)),
    [consultas, periodo],
  );

  const totaisPorOrgao = useMemo(() => totalPorOrgao(noPeriodo), [noPeriodo]);
  const maiorTotalOrgao = totaisPorOrgao[0]?.total ?? 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const rows = noPeriodo.filter((item) => {
      const matchTerm =
        !term ||
        item.nome.toLowerCase().includes(term) ||
        item.orgao.toLowerCase().includes(term) ||
        item.finalidade.toLowerCase().includes(term) ||
        item.codigoQr.toLowerCase().includes(term) ||
        (digits.length >= 3 && item.cpf.includes(digits));
      const matchOrgao = !orgaoFilter || item.orgao === orgaoFilter;
      return matchTerm && matchOrgao;
    });
    return [...rows].sort((a, b) => {
      const left = new Date(a.createdAt).getTime() || 0;
      const right = new Date(b.createdAt).getTime() || 0;
      return order === "recent" ? right - left : left - right;
    });
  }, [noPeriodo, search, orgaoFilter, order]);

  const stats = useMemo(() => {
    const distinct = new Set(noPeriodo.map((item) => item.cpf)).size;
    const hoje = consultas.filter((item) => isToday(item.createdAt)).length;
    const ultima = consultas[0]?.createdAt ?? "";
    return [
      {
        label: `Consultas · ${periodoLabels[periodo].toLowerCase()}`,
        value: String(noPeriodo.length),
        icon: "ri-file-search-line",
        tone: "primary",
      },
      { label: "Consultantes distintos", value: String(distinct), icon: "ri-user-search-line", tone: "secondary" },
      { label: "Órgãos atendidos", value: String(totaisPorOrgao.length), icon: "ri-building-4-line", tone: "accent" },
      {
        label: "Consultas hoje",
        value: String(hoje),
        icon: "ri-calendar-check-line",
        tone: "secondary",
      },
    ];
  }, [consultas, noPeriodo, periodo, totaisPorOrgao]);

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const exportHeaders = ["Data/hora", "Quem consultou", "CPF", "Órgão/empresa", "Finalidade", "QR lido", "Termo aceito"];
  const buildExportRows = () =>
    filtered.map((item) => [
      formatConsultaDateTime(item.createdAt),
      item.nome,
      formatConsultaCpf(item.cpf),
      item.orgao,
      item.finalidade || "Não informada",
      item.codigoQr,
      item.termoPersonalizado ? "Termo da empresa" : "Termo padrão",
    ]);

  const handleExportPdf = () => {
    const rows = buildExportRows();
    const orgaoRows = totaisPorOrgao.map((item) => [item.orgao, String(item.total)]);
    const body = `
      ${pdfHeader(`Consultas externas à ficha de verificação · ${session.company}`)}
      <h2>Resumo · ${periodoLabels[periodo]}</h2>
      <div class="kpis">
        <div class="kpi"><b>${noPeriodo.length}</b><span>Consultas no período</span></div>
        <div class="kpi"><b>${new Set(noPeriodo.map((item) => item.cpf)).size}</b><span>Consultantes distintos</span></div>
        <div class="kpi"><b>${totaisPorOrgao.length}</b><span>Órgãos atendidos</span></div>
        <div class="kpi"><b>${consultas.filter((item) => isToday(item.createdAt)).length}</b><span>Consultas hoje</span></div>
      </div>
      <h2>Total por órgão (${totaisPorOrgao.length})</h2>
      ${tableHtml(["Órgão / empresa", "Consultas"], orgaoRows)}
      <h2>Consultas (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      <p class="note">Cada linha corresponde a uma solicitação registrada com identificação do consultante, aceite do termo LGPD e data/hora. Tokens de acesso e URLs completas não são gravados.</p>
      ${pdfFooter()}
    `;
    printHtml("Consultas externas à ficha de verificação — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("consultas-externas-ficha-verificacao-sstek.csv", exportHeaders, buildExportRows());
  };

  if (!carregandoPermissao && !podeConsultar) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
          <i className="ri-lock-2-line text-3xl"></i>
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold text-foreground-950">Acesso restrito</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">
          O relatório de consultas externas contém dados pessoais de quem consultou as fichas. Ele exige a permissão
          “Consultar o relatório de consultas externas”, liberada em Perfis &amp; permissões.
        </p>
        <Link
          to="/app/qrcodes"
          className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-arrow-left-line"></i>
          Voltar para QR-Codes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/app/qrcodes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 transition-colors hover:text-primary-700"
          >
            <i className="ri-arrow-left-line"></i>
            Voltar para QR-Codes
          </Link>
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-shield-keyhole-line"></i>
            Rastreabilidade LGPD
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Consultas externas à ficha
          </h1>
          <p className="mt-1.5 max-w-[76ch] text-sm text-foreground-600">
            Quem consultou a ficha de verificação, de qual órgão, com qual finalidade e em que data/hora. Cada linha
            é uma solicitação registrada no servidor após a identificação e o aceite do termo.
          </p>
        </div>
        <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} disabled={filtered.length === 0} />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneIcon[stat.tone]}`}>
              <i className={`${stat.icon} text-lg`}></i>
            </span>
            <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{stat.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 md:flex-row md:items-center md:p-5">
        <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
          <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
            <i className="ri-search-line text-base"></i>
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar por nome, CPF, órgão, finalidade ou código do QR..."
            className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Período */}
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-background-300 bg-background-100 p-1">
            {(["today", "7d", "30d", "all"] as ConsultaPeriodo[]).map((key) => {
              const ativo = periodo === key;
              const label = key === "today" ? "Hoje" : key === "7d" ? "7 dias" : key === "30d" ? "Mês" : "Tudo";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriodo(key)}
                  aria-pressed={ativo}
                  className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    ativo
                      ? "bg-primary-600 text-background-50"
                      : "text-foreground-600 hover:bg-background-50 hover:text-foreground-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <select
              value={orgaoFilter}
              onChange={(event) => setOrgaoFilter(event.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-56"
            >
              <option value="">Todos os órgãos</option>
              {orgaos.map((orgao) => (
                <option key={orgao} value={orgao}>
                  {orgao}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={order}
              onChange={(event) => setOrder(event.target.value as "recent" | "oldest")}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-48"
            >
              <option value="recent">Mais recentes primeiro</option>
              <option value="oldest">Mais antigas primeiro</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          {(search || orgaoFilter || periodo !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setOrgaoFilter("");
                setPeriodo("all");
              }}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Total por órgão */}
      <div className="mt-5 rounded-lg border border-background-200 bg-background-50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
              <i className="ri-building-4-line text-base"></i>
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground-950">Total de consultas por órgão</h2>
              <p className="text-[11px] text-foreground-500">{periodoLabels[periodo]}</p>
            </div>
          </div>
          <span className="text-[11.5px] font-semibold text-foreground-600">
            {noPeriodo.length} consulta(s) · {totaisPorOrgao.length} órgão(s)
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-xs text-foreground-500">Carregando totais...</p>
        ) : totaisPorOrgao.length === 0 ? (
          <p className="px-5 py-6 text-xs text-foreground-500">
            Nenhuma consulta registrada neste período. Escolha outro período ou registre uma consulta pelo QR-Code.
          </p>
        ) : (
          <div className="divide-y divide-background-200/70">
            {totaisPorOrgao.map((item) => {
              const largura = maiorTotalOrgao > 0 ? Math.max(6, Math.round((item.total / maiorTotalOrgao) * 100)) : 0;
              const selecionado = orgaoFilter === item.orgao;
              return (
                <button
                  key={item.orgao}
                  type="button"
                  onClick={() => setOrgaoFilter(selecionado ? "" : item.orgao)}
                  title={selecionado ? "Remover filtro deste órgão" : "Filtrar a tabela por este órgão"}
                  className={`flex w-full cursor-pointer flex-col gap-1.5 px-5 py-2.5 text-left transition-colors hover:bg-background-100 ${
                    selecionado ? "bg-background-100" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-[12.5px] font-semibold text-foreground-900">{item.orgao}</span>
                    <span className="shrink-0 font-mono text-[11.5px] font-bold text-foreground-700">
                      {item.total}
                      <span className="ml-1 font-sans text-[10.5px] font-medium text-foreground-400">
                        {Math.round((item.total / Math.max(1, noPeriodo.length)) * 100)}%
                      </span>
                    </span>
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-background-200">
                    <span className="block h-full rounded-full bg-primary-500" style={{ width: `${largura}%` }}></span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="mt-5 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <ConsultasExternasTable
          consultas={filtered}
          total={consultas.length}
          loading={loading}
          error={error}
          onRetry={() => void carregar()}
        />
      </div>

      {/* Nota de escopo */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-secondary-200 bg-secondary-100/60 px-4 py-3">
        <i className="ri-information-line mt-0.5 text-base text-secondary-800"></i>
        <div className="text-[11.5px] leading-relaxed text-secondary-900/90">
          <p className="font-semibold text-secondary-900">O que este relatório registra</p>
          <p className="mt-1">
            Nome, órgão, CPF, finalidade informada, código do QR lido, data/hora e o aceite do termo (com hash do texto
            vigente). A gravação é feita pela função do servidor — o navegador do visitante não tem permissão para
            inserir registros. Tokens de acesso, URLs completas e o conteúdo da ficha não são gravados. O filtro de
            período e os totais por órgão consideram a página carregada de registros.
          </p>
        </div>
      </div>
    </div>
  );
}