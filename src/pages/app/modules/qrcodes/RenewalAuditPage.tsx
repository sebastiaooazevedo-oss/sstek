import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppSession } from "@/pages/app/context";
import { useCollaborators } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { resolveQrCode, useQrIdentifiers } from "@/pages/app/modules/qrcodes/qrIdentifierStore";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { collaborators as seedCollaborators } from "@/mocks/collaborators";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Converte o ISO do log em `DD/MM/AAAA HH:mm`. */
function formatIsoDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/**
 * Auditoria das renovações de QR-Code.
 *
 * Responde as três perguntas que a fiscalização faz primeiro: quem renovou,
 * quando renovou e por qual motivo. Mostra também o identificador interno
 * anterior e o novo — nunca a URL completa nem token de acesso.
 */
export default function RenewalAuditPage() {
  const session = useAppSession();
  const store = useCollaborators(session.subdomain);
  const { log, version } = useQrIdentifiers(session.subdomain);

  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [order, setOrder] = useState<"recent" | "oldest">("recent");

  const baseList = store.loaded && store.collaborators.length > 0 ? store.collaborators : seedCollaborators;
  const activeList = useMemo(() => baseList.filter((c) => c.status !== "Desligado"), [baseList]);

  const legacyList = useMemo(
    () => activeList.filter((c) => !resolveQrCode(session.subdomain, c.id).opaque),
    // O version força o recálculo quando um código é renovado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeList, session.subdomain, version],
  );

  const actors = useMemo(
    () => Array.from(new Set(log.map((entry) => entry.actor).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [log],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = log.filter((entry) => {
      const matchTerm =
        !term ||
        entry.collaboratorName.toLowerCase().includes(term) ||
        entry.actor.toLowerCase().includes(term) ||
        entry.reason.toLowerCase().includes(term) ||
        entry.previousCode.toLowerCase().includes(term) ||
        entry.newCode.toLowerCase().includes(term);
      const matchActor = !actorFilter || entry.actor === actorFilter;
      return matchTerm && matchActor;
    });
    return [...rows].sort((a, b) => {
      const left = new Date(a.at).getTime() || 0;
      const right = new Date(b.at).getTime() || 0;
      return order === "recent" ? right - left : left - right;
    });
  }, [log, search, actorFilter, order]);

  const distinctCollaborators = new Set(log.map((entry) => entry.collaboratorId)).size;
  const lastRenewal = useMemo(() => {
    if (log.length === 0) return "";
    return [...log].sort((a, b) => (new Date(b.at).getTime() || 0) - (new Date(a.at).getTime() || 0))[0].at;
  }, [log]);

  const stats = [
    { label: "Renovações registradas", value: String(log.length), icon: "ri-refresh-line", tone: "primary" },
    { label: "Colaboradores renovados", value: String(distinctCollaborators), icon: "ri-user-follow-line", tone: "secondary" },
    { label: "Adesivos ainda em legado", value: String(legacyList.length), icon: "ri-history-line", tone: "accent" },
    {
      label: "Última renovação",
      value: lastRenewal ? formatIsoDateTime(lastRenewal).slice(0, 10) : "—",
      icon: "ri-calendar-check-line",
      tone: "secondary",
    },
  ];

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const exportHeaders = ["Data/hora", "Colaborador", "Responsável", "Motivo", "Identificador anterior", "Identificador novo"];
  const buildExportRows = () =>
    filtered.map((entry) => [
      formatIsoDateTime(entry.at),
      entry.collaboratorName,
      entry.actor,
      entry.reason,
      entry.previousCode,
      entry.newCode,
    ]);

  const handleExportPdf = () => {
    const rows = buildExportRows();
    const body = `
      ${pdfHeader(`Auditoria de renovações de QR-Code · ${session.company}`)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${log.length}</b><span>Renovações registradas</span></div>
        <div class="kpi"><b>${distinctCollaborators}</b><span>Colaboradores renovados</span></div>
        <div class="kpi"><b>${legacyList.length}</b><span>Adesivos ainda em legado</span></div>
      </div>
      <h2>Renovações (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      <p class="note">O QR-Code é persistente: reimprimir não renova o código. A expiração de sessão de consulta não altera o QR impresso.</p>
      ${pdfFooter()}
    `;
    printHtml("Auditoria de renovações de QR-Code — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("auditoria-renovacoes-qrcode-sstek.csv", exportHeaders, buildExportRows());
  };

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
            <i className="ri-file-shield-2-line"></i>
            Rastreabilidade
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Auditoria de renovações
          </h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-foreground-600">
            Toda renovação de identificador de QR-Code fica registrada aqui com o responsável, a data/hora e o motivo.
            O QR é persistente — reimpressão não gera renovação.
          </p>
        </div>
        <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} />
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

      {/* Pendência de reimpressão */}
      {legacyList.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2.5">
            <i className="ri-printer-line mt-0.5 text-base text-accent-800"></i>
            <p className="text-xs leading-relaxed text-accent-900">
              <strong className="font-semibold">{legacyList.length} colaborador(es)</strong> ainda usam a referência
              legada e precisam de adesivo reimpresso. A migração não é automática: o código antigo continua válido até
              ser renovado de forma explícita.
            </p>
          </div>
          <Link
            to="/app/qrcodes"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-accent-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-700"
          >
            <i className="ri-external-link-line"></i>
            Gerar lote de reimpressão
          </Link>
        </div>
      )}

      {/* Filtros */}
      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-4 md:flex-row md:items-center md:p-5">
        <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
          <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
            <i className="ri-search-line text-base"></i>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por colaborador, responsável, motivo ou identificador..."
            className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-52"
            >
              <option value="">Todos os responsáveis</option>
              {actors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as "recent" | "oldest")}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-48"
            >
              <option value="recent">Mais recentes primeiro</option>
              <option value="oldest">Mais antigas primeiro</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          {(search || actorFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActorFilter("");
              }}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="mt-5 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-file-shield-2-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">
              {log.length === 0 ? "Nenhuma renovação registrada" : "Nenhuma renovação encontrada"}
            </p>
            <p className="max-w-[52ch] text-xs leading-relaxed text-foreground-500">
              {log.length === 0
                ? "Todos os QR-Codes em uso mantêm o identificador original. A renovação só acontece quando alguém com a permissão “Renovar QR-code do colaborador” executa a ação com motivo registrado."
                : "Ajuste os filtros para localizar a renovação."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-background-200 bg-background-100">
                  {["Data/hora", "Colaborador", "Responsável", "Motivo", "Anterior", "Novo"].map((title) => (
                    <th
                      key={title}
                      className="whitespace-nowrap px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-foreground-500"
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-background-200/70 last:border-b-0 hover:bg-background-100/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-foreground-700">
                      {formatIsoDateTime(entry.at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground-950">{entry.collaboratorName}</p>
                      <p className="text-[10.5px] text-foreground-400">Ref. interna {entry.collaboratorId}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-foreground-700">{entry.actor}</td>
                    <td className="max-w-[280px] px-4 py-3 text-xs leading-relaxed text-foreground-600">{entry.reason}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded bg-background-200 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-foreground-700">
                        {entry.previousCode}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded bg-primary-100 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-primary-800">
                        {entry.newCode}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota de escopo */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-secondary-200 bg-secondary-100/60 px-4 py-3">
        <i className="ri-information-line mt-0.5 text-base text-secondary-800"></i>
        <div className="text-[11.5px] leading-relaxed text-secondary-900/90">
          <p className="font-semibold text-secondary-900">Escopo deste registro</p>
          <p className="mt-1">
            O histórico acima é gravado neste ambiente administrativo da empresa {session.company}. A gravação
            definitiva, com invalidação do código anterior e das sessões externas vinculadas, depende do serviço de
            sessão no backend — ainda pendente. Por isso este painel serve como auditoria operacional e não substitui
            trilha de auditoria imutável no servidor. Não são registrados tokens secretos nem URLs completas de acesso.
          </p>
        </div>
      </div>
    </div>
  );
}