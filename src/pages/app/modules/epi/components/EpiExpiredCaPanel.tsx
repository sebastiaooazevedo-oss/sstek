import { useState } from "react";
import { Link } from "react-router-dom";
import { useEpis } from "@/pages/app/modules/epi/epiStore";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  useExpiredCaAlerts,
  type ExpiredCaItem,
  type ExpiredCaRow,
} from "@/pages/app/modules/epi/expiredCaAlerts";
import EpiReplacementModal, {
  type EpiReplacementInitial,
} from "@/pages/app/modules/epi/components/EpiReplacementModal";

interface EpiExpiredCaPanelProps {
  /** Unidade selecionada no dashboard (vazio = todas). */
  unit?: string;
}

/**
 * Alerta do painel do Administrador: colaboradores que estão com EPI em uso
 * cujo CA já venceu. Considera apenas a ficha ativa (última entrega de cada CA)
 * e ignora equipamentos já devolvidos.
 */
export default function EpiExpiredCaPanel({ unit = "" }: EpiExpiredCaPanelProps) {
  const deliveries = useEpis();
  const collaborators = useCollaboratorsList();
  const { rows } = useExpiredCaAlerts(deliveries, collaborators);
  const [expanded, setExpanded] = useState(false);
  const [requestInitial, setRequestInitial] = useState<EpiReplacementInitial | undefined>();
  const [notice, setNotice] = useState("");

  const openReplacement = (row: ExpiredCaRow, item?: ExpiredCaItem) => {
    const target = item || row.items[0];
    if (!target) return;
    setRequestInitial({
      collaboratorId: row.collaboratorId,
      collaboratorName: row.name,
      collaboratorRole: row.role,
      area: row.area,
      establishment: row.establishment,
      epiName: target.name,
      ca: target.ca,
      validity: target.validity,
    });
    setNotice("");
  };

  const scoped = unit ? rows.filter((row) => row.establishment === unit) : rows;
  if (!scoped.length) return null;

  const totalItems = scoped.reduce((sum, row) => sum + row.items.length, 0);
  const visible = expanded ? scoped : scoped.slice(0, 4);
  const hasMore = scoped.length > visible.length;

  return (
    <section className="rounded-lg border border-accent-300 bg-accent-50 p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-200 text-accent-900">
            <i className="ri-shield-cross-line text-xl"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground-950">
              {scoped.length} colaborador(es) com CA vencido em ficha de EPI ativa
            </p>
            <p className="mt-0.5 text-xs text-foreground-600">
              {totalItems} equipamento(s) em uso com certificado vencido
              {unit ? ` · ${unit}` : ""}. Substitua o EPI e registre a nova entrega.
            </p>
          </div>
        </div>
        <Link
          to="/app/epi"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600"
        >
          <i className="ri-shirt-line"></i>
          Abrir EPI
        </Link>
      </div>

      {notice && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-primary-200 bg-background-50 px-3.5 py-2.5 text-xs text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-sm"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-5 w-5 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-2.5">
        {visible.map((row) => (
          <li
            key={row.collaboratorId}
            className="rounded-lg border border-accent-200 bg-background-50 p-3.5"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-foreground-950">{row.name}</p>
              <span className="text-xs text-foreground-500">
                {row.role || "—"}
                {row.area ? ` · ${row.area}` : ""}
                {row.establishment ? ` · ${row.establishment}` : ""}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-200 px-2.5 py-1 text-[11px] font-semibold text-accent-900">
                <i className="ri-error-warning-line"></i>
                vencido há {row.worstDays} dia(s)
              </span>
              <button
                type="button"
                onClick={() => openReplacement(row)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-accent-600"
              >
                <i className="ri-loop-left-line"></i>
                Registrar substituição
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {row.items.map((item) => (
                <button
                  key={`${row.collaboratorId}-${item.ca}-${item.validity}`}
                  type="button"
                  title="Solicitar substituição deste equipamento"
                  onClick={() => openReplacement(row, item)}
                  className="inline-flex flex-wrap items-center gap-1.5 rounded-md border border-accent-300 bg-accent-100 px-2 py-1 text-left text-[11px] font-medium text-accent-900 transition-colors hover:bg-accent-200"
                >
                  <i className="ri-shirt-line"></i>
                  {item.name}
                  <span className="text-accent-800/80">· CA {item.ca}</span>
                  <span className="font-semibold">· venceu em {item.validity}</span>
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {scoped.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-100"
        >
          <i className={expanded ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
          {expanded ? "Mostrar menos" : `Ver todos os ${scoped.length} colaboradores`}
        </button>
      )}

      {hasMore && !expanded && (
        <p className="mt-2 text-[11px] text-foreground-500">
          Exibindo os {visible.length} casos mais críticos.
        </p>
      )}

      <EpiReplacementModal
        open={!!requestInitial}
        onClose={() => setRequestInitial(undefined)}
        initial={requestInitial}
        onCreated={setNotice}
      />
    </section>
  );
}