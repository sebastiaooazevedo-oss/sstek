import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusPill } from "@/pages/app/components/ui";
import { useAppSession } from "@/pages/app/context";
import QrCode, { fiscalizacaoUrl } from "@/pages/app/modules/qrcodes/components/QrCode";
import QrFichaModal from "@/pages/app/modules/qrcodes/components/QrFichaModal";
import QrPrintDialog, { stickerFormatLabel } from "@/pages/app/modules/qrcodes/components/QrPrintDialog";
import QrPublicBaseCard from "@/pages/app/modules/qrcodes/components/QrPublicBaseCard";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import ScanLogModal from "@/pages/app/modules/qrcodes/components/ScanLogModal";
import { collaborators as seedCollaborators, type Collaborator } from "@/mocks/collaborators";
import { useCollaborators } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { defaultQrProfile, qrProfiles, scanLogs } from "@/mocks/qrcodes";
import { resolveQrCode, useQrIdentifiers } from "@/pages/app/modules/qrcodes/qrIdentifierStore";
import QrKindBadge from "@/pages/app/modules/qrcodes/components/QrKindBadge";

type PendingFilter = "" | "ok" | "pending";
type KindFilter = "" | "legacy" | "opaque";

export default function QrCodesPage() {
  const session = useAppSession();
  const store = useCollaborators(session.subdomain);
  const settings = useSystemSettings();
  // A grade usa o código vigente de cada colaborador: quando um QR é renovado,
  // esta assinatura muda e todos os códigos são redesenhados.
  const qrState = useQrIdentifiers(session.subdomain);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("");
  const [selected, setSelected] = useState<string[]>([]);

  const [ficha, setFicha] = useState<Collaborator | null>(null);
  const [logTarget, setLogTarget] = useState<Collaborator | null>(null);
  const [notice, setNotice] = useState("");
  const [printBatch, setPrintBatch] = useState<Collaborator[] | null>(null);

  /**
   * A grade usa o cadastro real da empresa. A base de demonstração só entra
   * enquanto o cadastro ainda está carregando, para a tela não nascer vazia.
   */
  const baseList = store.loaded && store.collaborators.length > 0 ? store.collaborators : seedCollaborators;

  const list = useMemo(() => baseList.filter((c) => c.status !== "Desligado"), [baseList]);

  /**
   * Situação do identificador de cada colaborador.
   * `legacy` = adesivo ainda com referência previsível e precisa ser reimpresso.
   * O `qrState.version` entra na conta para recalcular logo após uma renovação.
   */
  const kindOf = (id: string): "legacy" | "opaque" =>
    resolveQrCode(session.subdomain, id).opaque ? "opaque" : "legacy";

  const legacyList = useMemo(
    () => list.filter((c) => !resolveQrCode(session.subdomain, c.id).opaque),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, session.subdomain, qrState.version],
  );

  const areas = useMemo(
    () => Array.from(new Set(list.map((c) => c.area).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [list],
  );

  const profileFor = (id: string) => qrProfiles[id] || defaultQrProfile;
  const logsFor = (id: string) => scanLogs.filter((l) => l.collaboratorId === id);

  const hasPending = (c: Collaborator) => {
    const p = qrProfiles[c.id];
    if (p) {
      return p.trainings.some((t) => t.status === "Vencido") || p.epis.some((e) => e.status === "Vencido");
    }
    // Colaborador do cadastro real: usa os contadores gravados na ficha dele.
    return c.trainingsExpired > 0 || (c.documentsTotal > 0 && c.documentsOk < c.documentsTotal);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((c) => {
      const matchTerm =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.role.toLowerCase().includes(term) ||
        c.cpf.includes(term);
      const matchArea = !areaFilter || c.area === areaFilter;
      const matchPending =
        !pendingFilter || (pendingFilter === "pending" ? hasPending(c) : !hasPending(c));
      const matchKind = !kindFilter || kindOf(c.id) === kindFilter;
      return matchTerm && matchArea && matchPending && matchKind;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [list, search, areaFilter, pendingFilter, kindFilter, qrState.version]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.includes(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !filtered.some((c) => c.id === id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...filtered.map((c) => c.id)])));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const stats = useMemo(
    () => [
      { label: "QR-Codes ativos", value: String(list.length), icon: "ri-qr-code-line", tone: "primary" },
      { label: "Escaneamentos registrados", value: String(scanLogs.length), icon: "ri-qr-scan-2-line", tone: "secondary" },
      { label: "Adesivos em identificador legado", value: String(legacyList.length), icon: "ri-history-line", tone: "accent" },
      { label: "Colaboradores com pendência", value: String(list.filter(hasPending).length), icon: "ri-error-warning-line", tone: "accent" },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, legacyList.length]
  );

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-qr-scan-2-line"></i>
            Fiscalização em campo
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            QR-Codes de fiscalização
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Cada colaborador tem um QR-Code que abre o resumo do cadastro, cursos e ficha de EPI para o fiscal.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
            <i className="ri-ruler-2-line text-sm"></i>
            Etiqueta, selo de capacete ou folha A4 3 × 8 · QR-Code de 3 × 3 cm
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/app/qrcodes/consultas"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-user-search-line text-base"></i>
            Consultas externas
          </Link>
          <Link
            to="/app/qrcodes/renovacoes"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-file-shield-2-line text-base"></i>
            Auditoria de renovações
          </Link>
          <button
            type="button"
            disabled={legacyList.length === 0}
            onClick={() => setPrintBatch(legacyList)}
            title="Monta um lote de impressão apenas com quem ainda usa o identificador legado"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-accent-300 bg-accent-50 px-4 py-2.5 text-sm font-semibold text-accent-900 transition-colors hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ri-history-line text-base"></i>
            Reimprimir só legados ({legacyList.length})
          </button>
          <button
            type="button"
            onClick={() => (allSelected ? setSelected([]) : setSelected(filtered.map((c) => c.id)))}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-checkbox-multiple-line text-base"></i>
            {allSelected ? "Limpar seleção" : "Selecionar todos"}
          </button>
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              setPrintBatch(list.filter((c) => selected.includes(c.id)));
              setSelected([]);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ri-printer-line text-base"></i>
            Imprimir em lote
          </button>
        </div>
      </div>

      <QrPublicBaseCard
        subdomain={session.subdomain}
        sampleRef={list[0]?.id}
        onNotice={setNotice}
      />

      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome, função ou CPF..."
            className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-48"
            >
              <option value="">Todas as áreas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={pendingFilter}
              onChange={(e) => setPendingFilter(e.target.value as PendingFilter)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-52"
            >
              <option value="">Todas as situações</option>
              <option value="ok">Sem pendências</option>
              <option value="pending">Com pendências</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          <div className="relative">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-52"
            >
              <option value="">Todos os identificadores</option>
              <option value="legacy">Legado — reimprimir</option>
              <option value="opaque">Opaco — atualizado</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>

          {(search || areaFilter || pendingFilter || kindFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setAreaFilter("");
                setPendingFilter("");
                setKindFilter("");
              }}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar
            </button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <p className="mt-3 text-xs font-medium text-foreground-600">{selected.length} QR-Code(s) selecionado(s)</p>
      )}

      {/* Grade de QR-Codes */}
      {filtered.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-qr-scan-2-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhum colaborador encontrado</p>
          <p className="text-xs text-foreground-500">Ajuste os filtros para visualizar os QR-Codes.</p>
        </div>
      ) : (
        <div
          key={`${settings.publicBaseUrl}-${qrState.version}`}
          className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {filtered.map((c) => {
            const logs = logsFor(c.id);
            const pending = hasPending(c);
            const checked = selected.includes(c.id);
            return (
              <div
                key={c.id}
                className={`flex flex-col rounded-lg border bg-background-50 p-4 transition-colors ${
                  checked ? "border-primary-400 ring-1 ring-primary-200" : "border-background-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Selecionar ${c.name}`}
                      className="h-4 w-4 accent-primary-500"
                    />
                  </label>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      pending ? "bg-accent-200 text-accent-900" : "bg-primary-100 text-primary-700"
                    }`}
                  >
                    <i className={pending ? "ri-alert-line" : "ri-shield-check-line"}></i>
                    {pending ? "Com pendência" : "Conforme"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <QrKindBadge
                    opaque={kindOf(c.id) === "opaque"}
                    version={resolveQrCode(session.subdomain, c.id).version}
                  />
                  {kindOf(c.id) === "legacy" && (
                    <span className="text-[10px] font-medium text-foreground-400">reimprimir o adesivo</span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-background-200 bg-background-100">
                    <img src={c.photo} alt={c.name} className="h-full w-full object-top" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground-950">{c.name}</p>
                    <p className="truncate text-xs text-foreground-500">
                      {c.role} · {c.area}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col items-center">
                  <QrCode value={fiscalizacaoUrl(session.subdomain, c.id)} />
                  <p className="mt-2 break-all text-center text-[11px] text-foreground-400">
                    {fiscalizacaoUrl(session.subdomain, c.id)}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg border border-background-200 bg-background-100 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground-600">
                    <i className="ri-qr-scan-2-line"></i>
                    {logs.length} escaneamento(s)
                  </span>
                  <StatusPill status={c.status} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFicha(c)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-eye-line text-sm"></i>
                    Ver ficha
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTarget(c)}
                    title="Ver logs de escaneamento"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-600 transition-colors hover:bg-background-100 hover:text-secondary-700"
                  >
                    <i className="ri-history-line text-base"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintBatch([c])}
                    title="Imprimir QR-Code"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-background-300 text-foreground-600 transition-colors hover:bg-background-100 hover:text-accent-700"
                  >
                    <i className="ri-printer-line text-base"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <QrFichaModal
        open={!!ficha}
        collaborator={ficha}
        profile={ficha ? profileFor(ficha.id) : defaultQrProfile}
        companyName={session.company}
        subdomain={session.subdomain}
        actorName={session.name}
        logs={ficha ? logsFor(ficha.id) : []}
        onClose={() => setFicha(null)}
        onNotice={setNotice}
      />

      <ScanLogModal
        open={!!logTarget}
        collaborator={logTarget}
        logs={logTarget ? logsFor(logTarget.id) : []}
        onClose={() => setLogTarget(null)}
      />

      {printBatch && printBatch.length > 0 && (
        <QrPrintDialog
          open
          collaborators={printBatch}
          companyName={session.company}
          subdomain={session.subdomain}
          onClose={() => setPrintBatch(null)}
          onPrinted={(count, format) => {
            const allLegacy = (printBatch ?? []).every(
              (c) => !resolveQrCode(session.subdomain, c.id).opaque,
            );
            setNotice(
              `${count} adesivo(s) de 3 × 3 cm enviados para a impressão (${stickerFormatLabel[format]}).${
                allLegacy
                  ? " O lote manteve o identificador atual: reimprimir não renova o QR-Code, o código só muda por renovação autorizada."
                  : ""
              }`,
            );
            setPrintBatch(null);
          }}
        />
      )}
    </div>
  );
}