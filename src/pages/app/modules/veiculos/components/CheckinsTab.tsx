import { useState } from "react";
import {
  checkinKindMeta,
  formatDateTimeBr,
  openDeliveryFor,
  type CheckinKind,
  type Vehicle,
  type VehicleCheckin,
  type VehicleRepairRequest,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import CheckinDetailModal from "@/pages/app/modules/veiculos/checkin/CheckinDetailModal";
import VehicleIllustration from "@/pages/app/modules/veiculos/checkin/VehicleIllustration";
import { avariasNovas, fuelLabel } from "@/pages/app/modules/veiculos/checkin/checkinRules";
import { PlatePill } from "@/pages/app/modules/veiculos/checkin/checkinUi";
import { diagramKindFor } from "@/pages/app/modules/veiculos/checkin/vehicleDiagrams";

interface Props {
  vehicles: Vehicle[];
  checkins: VehicleCheckin[];
  repairs: VehicleRepairRequest[];
  canCheckin: boolean;
  /** Pode ver todos os check-ins (painel "Check-ins realizados"). */
  canReport: boolean;
  currentUserName: string;
  onNew: (vehicleRef: string | null, kind: CheckinKind) => void;
  onOpenReport: () => void;
}

function since(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `há ${Math.max(1, Math.floor(diff / 60000))} min`;
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

/** Aba operacional do check-in: iniciar retirada/devolução e ver quem está com cada veículo. */
export default function CheckinsTab({
  vehicles,
  checkins,
  repairs,
  canCheckin,
  canReport,
  currentUserName,
  onNew,
  onOpenReport,
}: Props) {
  const [detailRef, setDetailRef] = useState<string | null>(null);
  const vehicleByRef = (ref: string) => vehicles.find((item) => item.ref === ref) ?? null;
  const emUso = checkins
    .filter((item) => item.kind === "entrega" && item.status === "aberta")
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  const disponiveis = vehicles.filter(
    (vehicle) => vehicle.status !== "inativo" && vehicle.status !== "bloqueado" && !openDeliveryFor(checkins, vehicle.ref)
  ).length;
  const me = currentUserName.trim().toLowerCase();
  const recentes = checkins
    .filter((item) => canReport || item.responsibleName.trim().toLowerCase() === me || item.performedByName.trim().toLowerCase() === me)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
    .slice(0, 6);
  const detail = checkins.find((item) => item.ref === detailRef) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-background-200 bg-background-50">
        <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-xl text-background-50">
              <i className="ri-shield-check-line"></i>
            </span>
            <div>
              <h2 className="font-heading text-base font-bold text-foreground-950">Check-in de segurança do veículo</h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-foreground-500">
                Retirada e devolução em etapas: confirmação da placa, hodômetro, combustível, conferência de segurança,
                mapa de avarias com foto e solicitação de reparo. Quem retira assume o veículo até devolver.
              </p>
            </div>
          </div>
          {canCheckin && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNew(null, "entrega")}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
              >
                <i className="ri-key-2-line"></i>
                Retirar veículo
              </button>
              <button
                type="button"
                onClick={() => onNew(null, "devolucao")}
                disabled={emUso.length === 0}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-primary-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="ri-parking-box-line"></i>
                Devolver veículo
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 divide-x divide-background-200 border-t border-background-200 bg-background-100 text-center">
          {[
            ["Disponíveis", disponiveis, "text-primary-700"],
            ["Em uso", emUso.length, "text-accent-800"],
            ["Reparos em aberto", repairs.filter((item) => item.status === "aberta" || item.status === "em_andamento").length, "text-danger-700"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="px-2 py-2.5">
              <p className={`font-heading text-lg font-extrabold tabular-nums ${tone}`}>{value}</p>
              <p className="text-[10.5px] font-semibold text-foreground-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground-900">
          <i className="ri-steering-2-line text-accent-700"></i>
          Veículos em uso agora
        </h3>
        {emUso.length === 0 ? (
          <p className="rounded-xl border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
            Nenhum veículo fora da empresa no momento.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {emUso.map((item) => {
              const vehicle = vehicleByRef(item.vehicleRef);
              return (
                <div key={item.ref} className="flex items-center gap-3 rounded-xl border border-accent-200 bg-background-50 p-3">
                  <span className="h-16 w-9 shrink-0">
                    <VehicleIllustration kind={diagramKindFor(vehicle?.category ?? item.vehicleCategory)} className="pointer-events-none" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <PlatePill plate={item.plateSnapshot} size="sm" />
                    <p className="mt-1 truncate text-xs font-semibold text-foreground-900">{item.responsibleName}</p>
                    <p className="truncate text-[10.5px] text-foreground-500">
                      Retirou {since(item.performedAt)} · {item.odometer?.toLocaleString("pt-BR") ?? "—"} km · {fuelLabel(item.fuelLevel)}
                    </p>
                  </div>
                  {canCheckin && (
                    <button
                      type="button"
                      onClick={() => onNew(item.vehicleRef, "devolucao")}
                      className="shrink-0 cursor-pointer rounded-md bg-primary-100 px-2.5 py-1.5 text-[11px] font-bold text-primary-800 hover:bg-primary-200"
                    >
                      Devolver
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground-900">
            <i className="ri-history-line text-primary-700"></i>
            {canReport ? "Últimos check-ins" : "Meus últimos check-ins"}
          </h3>
          {canReport && (
            <button type="button" onClick={onOpenReport} className="cursor-pointer text-xs font-semibold text-primary-700 underline">
              Ver todos com filtros
            </button>
          )}
        </div>
        {recentes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-background-300 px-4 py-6 text-center text-xs text-foreground-500">
            Nenhum check-in registrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-background-200 overflow-hidden rounded-xl border border-background-200 bg-background-50">
            {recentes.map((item) => {
              const novas = avariasNovas(item).length;
              return (
                <li key={item.ref}>
                  <button
                    type="button"
                    onClick={() => setDetailRef(item.ref)}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-background-100"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checkinKindMeta[item.kind].className}`}>
                      <i className={checkinKindMeta[item.kind].icon}></i>
                    </span>
                    <PlatePill plate={item.plateSnapshot} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-foreground-900">
                        {checkinKindMeta[item.kind].short} · {item.responsibleName}
                      </span>
                      <span className="block truncate text-[10.5px] text-foreground-500">
                        {formatDateTimeBr(item.performedAt)} · conferido por {item.conferenteName}
                      </span>
                    </span>
                    {novas > 0 && (
                      <span className="shrink-0 rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-bold text-danger-800">
                        {novas} avaria{novas > 1 ? "s" : ""}
                      </span>
                    )}
                    <i className="ri-arrow-right-s-line text-foreground-400"></i>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
