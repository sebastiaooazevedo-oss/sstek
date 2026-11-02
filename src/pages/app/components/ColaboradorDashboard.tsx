import { useState } from "react";
import { Link } from "react-router-dom";
import { KpiCard, SectionCard, StatusPill } from "@/pages/app/components/ui";
import {
  colaboradorAlerts,
  colaboradorKpis,
  myDocuments,
  myEpis,
  myTrainings,
} from "@/mocks/app";
import { collaborators } from "@/mocks/collaborators";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import type { AprRecord } from "@/mocks/apr";
import type { EpiDelivery } from "@/mocks/epi";
import { signApr, useAprs } from "@/pages/app/modules/apr/aprStore";
import AprSignModal from "@/pages/app/modules/apr/components/AprSignModal";
import { signEpiDelivery, useEpis } from "@/pages/app/modules/epi/epiStore";
import EpiSignModal from "@/pages/app/modules/epi/components/EpiSignModal";
import EpiMyReplacementsPanel from "@/pages/app/modules/epi/components/EpiMyReplacementsPanel";
import { computeEpiInUse } from "@/pages/app/modules/epi/epiUtils";
import MoodSummaryCard from "@/pages/app/modules/sentimento/components/MoodSummaryCard";
import CipaAlertsPanel from "@/pages/app/modules/cipa/components/CipaAlertsPanel";
import AtaPendingSignaturesPanel from "@/pages/app/modules/cipa/components/AtaPendingSignaturesPanel";
import TechnicalSignaturePendingPanel from "@/pages/app/modules/cipa/components/TechnicalSignaturePendingPanel";
import MoodTeamPanel from "@/pages/app/modules/sentimento/components/MoodTeamPanel";
import { subordinatesOf } from "@/pages/app/modules/leadership/leadershipStore";
import { useAppSession } from "@/pages/app/context";

const levelStyles: Record<string, string> = {
  danger: "bg-accent-100 text-accent-900 border-accent-300 dark:bg-accent-950 dark:text-accent-100 dark:border-accent-800",
  warning: "bg-accent-50 text-accent-800 border-accent-200 dark:bg-accent-950 dark:text-accent-100 dark:border-accent-800",
  info: "bg-secondary-100 text-secondary-900 border-secondary-200 dark:bg-secondary-950 dark:text-secondary-100 dark:border-secondary-800",
};

type AprTab = "pendentes" | "historico";

export default function ColaboradorDashboard() {
  const session = useAppSession();
  const aprs = useAprs();
  const epis = useEpis();
  const registeredCollaborators = useCollaboratorsList();
  const me =
    registeredCollaborators.find((c) => c.name === session.name) ||
    registeredCollaborators.find(
      (c) => c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()
    ) ||
    collaborators.find((c) => c.name === session.name);
  const leadsOthers = me ? subordinatesOf(me.id).length > 0 : false;

  // APRs criadas pelo próprio colaborador não aparecem aqui: enquanto estão
  // pendentes ficam em "Meus documentos" e, depois de assinadas, seguem
  // exclusivamente para o painel do administrador.
  const myPendingAprs = me
    ? aprs.filter(
        (a) =>
          a.createdByRef !== me.id &&
          a.signatures.some((s) => s.collaboratorId === me.id && !s.signature)
      )
    : [];
  const mySignedAprs = me
    ? aprs.filter(
        (a) =>
          a.createdByRef !== me.id &&
          a.signatures.some((s) => s.collaboratorId === me.id && s.signature)
      )
    : [];
  const myPendingEpis = me
    ? epis.filter((d) => d.collaboratorId === me.id && d.status === "Pendente")
    : [];
  const epiInUse = me ? computeEpiInUse(epis, me.id, session.name) : [];

  const [aprTab, setAprTab] = useState<AprTab>("pendentes");
  const [signing, setSigning] = useState<AprRecord | null>(null);
  const [signingEpi, setSigningEpi] = useState<EpiDelivery | null>(null);
  const [notice, setNotice] = useState("");

  const listedAprs = aprTab === "pendentes" ? myPendingAprs : mySignedAprs;

  const handleSign = (aprId: string, collaboratorId: string, signature: string) => {
    const target = aprs.find((a) => a.id === aprId);
    signApr(aprId, collaboratorId, signature);
    setSigning(null);
    setNotice(`Aceite da APR "${target?.title || ""}" assinado com sucesso.`);
  };

  const handleSignEpi = (deliveryId: string, signature: string) => {
    const target = epis.find((d) => d.id === deliveryId);
    signEpiDelivery(deliveryId, signature);
    setSigningEpi(null);
    setNotice(`Aceite da Ficha de EPI de ${target?.date || ""} assinado com sucesso.`);
  };

  const aprTabs: { id: AprTab; label: string; icon: string; count: number }[] = [
    { id: "pendentes", label: "Pendentes", icon: "ri-timer-line", count: myPendingAprs.length },
    { id: "historico", label: "Histórico de aceites", icon: "ri-history-line", count: mySignedAprs.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {colaboradorKpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            {...(kpi.id === "epis"
              ? { ...kpi, value: `${epiInUse.length}`, delta: epiInUse.length ? "itens em posse" : "sem EPIs" }
              : kpi)}
          />
        ))}
      </div>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-900"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <CipaAlertsPanel />

      <AtaPendingSignaturesPanel
        collaboratorId={me?.id || ""}
        collaboratorName={me?.name || session.name}
      />

      <TechnicalSignaturePendingPanel />

      <MoodSummaryCard />

      {leadsOthers && <MoodTeamPanel />}

      <SectionCard
        title="APRs · Análise Preliminar de Risco"
        subtitle="Assine os aceites pendentes da sua atividade e consulte o seu histórico"
        action={
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
            <i className="ri-shield-check-line"></i>
            {myPendingAprs.length} pendente(s)
          </span>
        }
      >
        <div className="mb-4 inline-flex items-center gap-1 rounded-full bg-background-100 px-1 py-1">
          {aprTabs.map((t) => {
            const active = aprTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAprTab(t.id)}
                className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                }`}
              >
                <i className={`${t.icon} text-base`}></i>
                {t.label}
                <span
                  className={`rounded-full px-1.5 text-[11px] font-bold ${
                    active ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {listedAprs.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {listedAprs.map((a) => {
              const signedMine = Boolean(a.signatures.find((s) => s.collaboratorId === me?.id)?.signature);
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                      signedMine ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                    }`}
                  >
                    <i className="ri-clipboard-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">{a.title}</p>
                    <p className="truncate text-xs text-foreground-500">
                      {a.activity} · {a.area} · {a.date} · Resp.: {a.responsible}
                    </p>
                  </div>
                  {aprTab === "pendentes" ? (
                    <button
                      type="button"
                      onClick={() => setSigning(a)}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                    >
                      <i className="ri-pen-nib-line"></i>
                      Assinar aceite
                    </button>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
                      <i className="ri-verified-badge-line"></i>
                      Aceite assinado
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={aprTab === "pendentes" ? "ri-checkbox-circle-line text-2xl" : "ri-history-line text-2xl"}></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">
              {aprTab === "pendentes" ? "Nenhuma APR pendente" : "Nenhum aceite no histórico"}
            </p>
            <p className="text-xs text-foreground-500">
              {aprTab === "pendentes"
                ? "Você está em dia com os aceites de análise de risco."
                : "Os aceites que você assinar aparecerão aqui."}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Aceites de EPI pendentes"
        subtitle="Fichas de EPI aguardando a sua assinatura de recebimento"
        action={
          <Link
            to="/app/minhaepi"
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
          >
            <i className="ri-file-list-3-line"></i>
            Ver minha ficha
          </Link>
        }
      >
        {myPendingEpis.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {myPendingEpis.map((d) => {
              const totalItems = d.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                    <i className="ri-shirt-line text-lg"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">
                      Entrega de {d.date} · {d.reason}
                    </p>
                    <p className="truncate text-xs text-foreground-500">
                      {d.items.length} tipo(s) · {totalItems} unidade(s) · {d.items.map((i) => i.name).join(", ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSigningEpi(d)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-pen-nib-line"></i>
                    Assinar aceite
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-checkbox-circle-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhum aceite de EPI pendente</p>
            <p className="text-xs text-foreground-500">Você já assinou o recebimento de todos os EPIs entregues.</p>
          </div>
        )}
      </SectionCard>

      <EpiMyReplacementsPanel
        collaboratorId={me?.id || ""}
        collaboratorName={me?.name || session.name}
        items={epiInUse.map((item) => ({ name: item.name, ca: item.ca, validity: item.validity }))}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          title="Minha ficha de EPI"
          subtitle="Itens em uso, CA e validade"
          className="lg:col-span-2"
          action={
            <Link to="/app/minhaepi" className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex">
              <i className="ri-file-list-3-line"></i>
              Ver ficha completa
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-background-200 text-left">
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">EPI</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">CA</th>
                  <th className="pb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Validade</th>
                  <th className="pb-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {epiInUse.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-foreground-500">
                      Nenhum EPI em uso registrado ainda.
                    </td>
                  </tr>
                )}
                {epiInUse.map((item) => (
                  <tr key={item.ca} className="border-b border-background-100 last:border-0">
                    <td className="py-3.5 text-sm font-semibold text-foreground-950">{item.name}</td>
                    <td className="py-3.5 text-sm text-foreground-700">{item.ca}</td>
                    <td className="py-3.5 text-sm text-foreground-700">{item.validity}</td>
                    <td className="py-3.5 text-right">
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Meus alertas"
          subtitle="Vencimentos e pendências"
          action={
            <Link to="/app/alertas" className="whitespace-nowrap text-xs font-semibold text-primary-600 hover:text-primary-700">
              Ver todos
            </Link>
          }
        >
          <ul className="flex flex-col gap-3">
            {colaboradorAlerts.map((alert) => (
              <li key={alert.id} className={`rounded-lg border p-4 ${levelStyles[alert.level]}`}>
                <div className="flex items-start gap-3">
                  <i className={`${alert.icon} mt-0.5 text-lg`}></i>
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">{alert.description}</p>
                    <p className="mt-2 text-[11px] font-medium opacity-75">{alert.when}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Meus documentos"
          subtitle="Você pode visualizar e baixar, sem excluir"
          action={
            <Link to="/app/meusdocumentos" className="whitespace-nowrap text-xs font-semibold text-primary-600 hover:text-primary-700">
              Ver todos
            </Link>
          }
        >
          <ul className="flex flex-col gap-2">
            {myDocuments.slice(0, 5).map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                  <i className="ri-file-text-line text-base"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{doc.name}</p>
                  <p className="text-xs text-foreground-500">
                    {doc.type} · {doc.size}
                  </p>
                </div>
                <StatusPill status={doc.status} />
                <button
                  type="button"
                  aria-label="Baixar documento"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200 hover:text-primary-600"
                >
                  <i className="ri-download-2-line text-lg"></i>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Meus treinamentos"
          subtitle="Certificados e reciclagens"
          action={
            <Link to="/app/meustreinamentos" className="whitespace-nowrap text-xs font-semibold text-primary-600 hover:text-primary-700">
              Ver todos
            </Link>
          }
        >
          <ul className="flex flex-col gap-3">
            {myTrainings.map((t) => (
              <li key={t.id} className="flex items-center gap-4 rounded-lg border border-background-200 bg-background-100 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                  <i className="ri-award-line text-lg"></i>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-950">{t.name}</p>
                  <p className="text-xs text-foreground-500">
                    {t.load} · vence {t.date}
                  </p>
                </div>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <AprSignModal
        record={signing}
        collaboratorId={me?.id || ""}
        collaboratorName={me?.name || session.name}
        onClose={() => setSigning(null)}
        onSign={handleSign}
      />
      <EpiSignModal
        delivery={signingEpi}
        collaboratorName={me?.name || session.name}
        onClose={() => setSigningEpi(null)}
        onSign={handleSignEpi}
      />
    </div>
  );
}