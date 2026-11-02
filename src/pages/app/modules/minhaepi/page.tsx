import { useMemo, useState } from "react";
import { SectionCard, StatusPill } from "@/pages/app/components/ui";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { getInitials, useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import EpiMyReplacementsPanel from "@/pages/app/modules/epi/components/EpiMyReplacementsPanel";
import type { EpiDelivery } from "@/mocks/epi";
import { signEpiDelivery, useEpis } from "@/pages/app/modules/epi/epiStore";
import EpiSignModal from "@/pages/app/modules/epi/components/EpiSignModal";
import EpiDetailModal from "@/pages/app/modules/epi/components/EpiDetailModal";
import { brDateToTs, computeEpiInUse } from "@/pages/app/modules/epi/epiUtils";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";

/**
 * "Minha ficha de EPI" — visão do colaborador sobre os próprios equipamentos.
 * Reúne os EPIs em uso hoje (com a validade de cada CA) e o histórico das
 * entregas, permitindo assinar o aceite das fichas pendentes.
 */
export default function MinhaEpiPage() {
  const session = useAppSession();
  const deliveries = useEpis();
  const registeredCollaborators = useCollaboratorsList();
  const [signing, setSigning] = useState<EpiDelivery | null>(null);
  const [detail, setDetail] = useState<EpiDelivery | null>(null);
  const [notice, setNotice] = useState("");
  const [quickRequest, setQuickRequest] = useState<{ name: string; ca: string; validity: string } | null>(null);
  const [quickSignal, setQuickSignal] = useState(0);

  const me =
    registeredCollaborators.find((c) => c.name === session.name) ||
    registeredCollaborators.find(
      (c) => c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()
    ) ||
    collaborators.find((c) => c.name === session.name) ||
    collaborators.find((c) => c.email === session.email);

  const myDeliveries = useMemo(
    () =>
      deliveries
        .filter((d) => (me ? d.collaboratorId === me.id : d.collaboratorName === session.name))
        .slice()
        .sort((a, b) => brDateToTs(b.date) - brDateToTs(a.date)),
    [deliveries, me, session.name]
  );

  const inUse = useMemo(
    () => (me ? computeEpiInUse(deliveries, me.id, session.name) : []),
    [deliveries, me, session.name]
  );

  const pending = myDeliveries.filter((d) => d.status === "Pendente");
  const signed = myDeliveries.filter((d) => d.status === "Assinada");
  const totalItems = inUse.reduce((sum, item) => sum + item.quantity, 0);

  const handleSign = (deliveryId: string, signature: string) => {
    const target = deliveries.find((d) => d.id === deliveryId);
    signEpiDelivery(deliveryId, signature);
    setSigning(null);
    setNotice(`Aceite da Ficha de EPI de ${target?.date || ""} assinado com sucesso.`);
  };

  const buildExportRows = () =>
    inUse.map((item) => [item.name, item.ca, item.validity, item.status, item.lastDate]);

  const handleExportPdf = () => {
    const rows = buildExportRows();
    const history = myDeliveries.map((d) => [
      d.date,
      d.reason,
      String(d.items.reduce((s, i) => s + i.quantity, 0)),
      d.status === "Assinada" ? "Assinado" : "Pendente",
    ]);
    const body = `${pdfHeader("Minha ficha de EPI")}
      <h1>Minha ficha de Equipamentos de Proteção Individual</h1>
      <p class="muted">
        Colaborador: ${escapeHtml(me?.name || session.name)} · Função: ${escapeHtml(me?.role || "—")} ·
        Área: ${escapeHtml(me?.area || "—")}
      </p>
      <h2>EPIs em uso</h2>
      ${tableHtml(["Equipamento", "CA", "Validade", "Situação", "Última entrega"], rows)}
      <h2>Histórico de entregas e aceites</h2>
      ${tableHtml(["Data", "Motivo", "Itens (un)", "Aceite"], history)}
      ${pdfFooter()}`;
    printHtml("Minha ficha de EPI — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv(
      "minha-ficha-epi-sstek.csv",
      ["Equipamento", "CA", "Validade", "Situação", "Última entrega"],
      buildExportRows()
    );
  };

  if (!me) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-user-search-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Perfil de colaborador não localizado</p>
          <p className="mt-1 text-xs text-foreground-500">
            Esta ficha é exibida para usuários com o papel de Colaborador.
          </p>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "EPIs em uso", value: `${inUse.length}`, icon: "ri-shirt-line", tone: "primary" },
    { label: "Itens em posse", value: `${totalItems}`, icon: "ri-stack-line", tone: "secondary" },
    { label: "Aceites pendentes", value: `${pending.length}`, icon: "ri-timer-line", tone: "accent" },
    { label: "Aceites assinados", value: `${signed.length}`, icon: "ri-verified-badge-line", tone: "secondary" },
  ];

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-shirt-line"></i>
            Meu espaço
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Minha ficha de EPI
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Consulte os equipamentos em uso, a validade de cada CA e o seu histórico de entregas.
          </p>
        </div>
        <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} disabled={inUse.length === 0} />
      </div>

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

      {/* Cartão do colaborador */}
      <div className="mt-6 flex items-center gap-4 rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-sm font-bold text-secondary-900">
          {getInitials(me.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground-950">{me.name}</p>
          <p className="truncate text-xs text-foreground-500">
            {me.role} · {me.area}
          </p>
        </div>
        <span className="hidden whitespace-nowrap rounded-full bg-background-100 px-3 py-1 text-[11px] font-semibold text-foreground-700 sm:inline-flex">
          Matrícula interna {me.id.toUpperCase()}
        </span>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneIcon[kpi.tone]}`}>
              <i className={`${kpi.icon} text-lg`}></i>
            </span>
            <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{kpi.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Aceites pendentes */}
      {pending.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-accent-300 bg-accent-50 p-4 sm:flex-row sm:items-center md:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-pen-nib-line text-xl"></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground-950">
              Você tem {pending.length} aceite(s) de EPI aguardando a sua assinatura
            </p>
            <p className="mt-0.5 text-xs text-foreground-600">
              Assine abaixo para confirmar o recebimento dos equipamentos entregues.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSigning(pending[0])}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-pen-nib-line"></i>
            Assinar agora
          </button>
        </div>
      )}

      {/* EPIs em uso */}
      <div className="mt-6">
        <SectionCard title="EPIs em uso" subtitle="Equipamentos em posse, com CA e validade do certificado">
          {inUse.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-background-200 text-left">
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Equipamento</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">CA</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Última entrega</th>
                    <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Validade</th>
                    <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Situação</th>
                    <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inUse.map((item) => (
                    <tr key={item.ca} className="border-b border-background-100 last:border-0">
                      <td className="py-3.5">
                        <p className="text-sm font-semibold text-foreground-950">{item.name}</p>
                        <p className="text-xs text-foreground-500">
                          {item.quantity} unidade(s)
                        </p>
                      </td>
                      <td className="py-3.5 text-sm text-foreground-700">{item.ca}</td>
                      <td className="whitespace-nowrap py-3.5 text-sm text-foreground-700">{item.lastDate}</td>
                      <td className="whitespace-nowrap py-3.5 text-sm text-foreground-700">{item.validity}</td>
                      <td className="py-3.5 text-right">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickRequest({ name: item.name, ca: item.ca, validity: item.validity });
                            setQuickSignal((current) => current + 1);
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          <i className="ri-loop-left-line text-base"></i>
                          Solicitar troca
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-shirt-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum EPI em uso registrado</p>
              <p className="text-xs text-foreground-500">
                Os equipamentos entregues a você aparecerão aqui.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <EpiMyReplacementsPanel
          collaboratorId={me.id}
          collaboratorName={me.name}
          items={inUse.map((item) => ({ name: item.name, ca: item.ca, validity: item.validity }))}
          requestItem={quickRequest}
          requestSignal={quickSignal}
        />
      </div>

      {/* Histórico de entregas */}
      <div className="mt-6">
        <SectionCard
          title="Histórico de entregas e aceites"
          subtitle="Todas as entregas registradas, com o aceite a assinar quando pendente"
        >
          {myDeliveries.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {myDeliveries.map((delivery) => {
                const itemsTotal = delivery.items.reduce((s, i) => s + i.quantity, 0);
                const isSigned = delivery.status === "Assinada";
                return (
                  <li
                    key={delivery.id}
                    className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                        isSigned ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className="ri-shirt-line text-lg"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground-950">
                        Entrega de {delivery.date} · {delivery.reason}
                      </p>
                      <p className="truncate text-xs text-foreground-500">
                        {delivery.items.length} tipo(s) · {itemsTotal} unidade(s) ·{" "}
                        {delivery.items.map((i) => i.name).join(", ")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isSigned ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                      }`}
                    >
                      <i className={isSigned ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
                      {isSigned ? "Assinado" : "Pendente"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetail(delivery)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-eye-line text-base"></i>
                        Ver ficha
                      </button>
                      {!isSigned && (
                        <button
                          type="button"
                          onClick={() => setSigning(delivery)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                        >
                          <i className="ri-pen-nib-line text-base"></i>
                          Assinar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                <i className="ri-history-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhuma entrega registrada</p>
              <p className="text-xs text-foreground-500">
                Quando o SESMT registrar uma entrega de EPI, ela aparecerá aqui.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      <EpiSignModal
        delivery={signing}
        collaboratorName={me.name}
        onClose={() => setSigning(null)}
        onSign={handleSign}
      />
      <EpiDetailModal delivery={detail} onClose={() => setDetail(null)} />
    </div>
  );
}