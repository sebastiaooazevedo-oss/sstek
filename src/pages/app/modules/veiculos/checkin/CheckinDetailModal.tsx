import { useMemo, useState } from "react";
import { CHECKIN_REQUIRED_PHOTOS, checkinPhotoSlotOf } from "@shared/checkin";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import {
  checkinKindMeta,
  checkinStatusMeta,
  formatDateTimeBr,
  repairPriorityMeta,
  repairStatusMeta,
  type VehicleCheckin,
  type VehicleRepairRequest,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";
import VehicleIllustration from "@/pages/app/modules/veiculos/checkin/VehicleIllustration";
import { damageTypeMeta, fuelLabel, kmDoCheckin, severityMeta } from "@/pages/app/modules/veiculos/checkin/checkinRules";
import { FuelGauge, PlatePill } from "@/pages/app/modules/veiculos/checkin/checkinUi";
import { diagramKindFor } from "@/pages/app/modules/veiculos/checkin/vehicleDiagrams";

interface Props {
  checkin: VehicleCheckin | null;
  checkins: VehicleCheckin[];
  repairs: VehicleRepairRequest[];
  onClose: () => void;
  onOpen: (ref: string) => void;
}

/** Ficha completa de um check-in realizado (somente leitura). */
export default function CheckinDetailModal({ checkin, checkins, repairs, onClose, onOpen }: Props) {
  const [zoom, setZoom] = useState<string | null>(null);
  const paths = useMemo(
    () =>
      checkin
        ? [
            ...checkin.photos,
            ...checkin.damages.map((item) => item.photo),
            ...checkin.repairRequests.flatMap((item) => item.photos),
            ...repairs.filter((item) => item.checkinRef === checkin.ref).flatMap((item) => item.photos),
          ].filter(Boolean)
        : [],
    [checkin, repairs]
  );
  const urls = useVehicleFileUrls(paths);
  if (!checkin) return null;

  const kind = diagramKindFor(checkin.vehicleCategory);
  const linked = checkin.linkedRef
    ? checkins.find((item) => item.ref === checkin.linkedRef)
    : checkins.find((item) => item.linkedRef === checkin.ref);
  const km = kmDoCheckin(checkin, checkins);
  const repairsOfCheckin = repairs.filter((item) => item.checkinRef === checkin.ref);
  const slotLabel = (path: string) => {
    const slot = checkinPhotoSlotOf(path);
    return CHECKIN_REQUIRED_PHOTOS.find((item) => item.key === slot)?.label ?? "Foto adicional";
  };
  const problems = checkin.items.filter((item) => item.result === "avaria");

  const Photo = ({ path, label }: { path: string; label: string }) => (
    <button
      type="button"
      onClick={() => setZoom(path)}
      className="group flex cursor-zoom-in flex-col overflow-hidden rounded-lg border border-background-200 bg-background-100 text-left"
    >
      <span className="block aspect-[4/3] w-full bg-background-200">
        {urls[path] ? (
          <img src={urls[path]} alt={label} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center text-foreground-400">
            <i className="ri-image-line"></i>
          </span>
        )}
      </span>
      <span className="truncate px-2 py-1 text-[10.5px] font-semibold text-foreground-700">{label}</span>
    </button>
  );

  return (
    <Modal
      open
      onClose={zoom ? () => setZoom(null) : onClose}
      size="2xl"
      icon={checkinKindMeta[checkin.kind].icon}
      title={`${checkinKindMeta[checkin.kind].short} · ${checkin.plateSnapshot}`}
      subtitle={`${formatDateTimeBr(checkin.performedAt)} · protocolo ${checkin.ref}`}
      footer={
        <ModalButton variant="ghost" onClick={onClose}>
          Fechar
        </ModalButton>
      }
    >
      {zoom ? (
        <div className="flex flex-col items-center gap-3">
          {urls[zoom] && <img src={urls[zoom]} alt="Foto ampliada" className="max-h-[60vh] rounded-lg object-contain" />}
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="cursor-pointer rounded-md border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700"
          >
            <i className="ri-arrow-left-line"></i> Voltar à ficha
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <PlatePill plate={checkin.plateSnapshot} />
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${checkinKindMeta[checkin.kind].className}`}>
              {checkinKindMeta[checkin.kind].label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${checkinStatusMeta[checkin.status].className}`}>
              {checkinStatusMeta[checkin.status].label}
            </span>
            {checkin.plateConfirmed && (
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10.5px] font-bold text-primary-700">
                <i className="ri-checkbox-circle-line"></i> Placa conferida
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
            <div className="mx-auto aspect-[240/440] w-full max-w-[200px] rounded-xl border border-background-200 bg-background-100 p-2">
              <VehicleIllustration kind={kind} damages={checkin.damages} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {[
                  ["Condutor", checkin.responsibleName],
                  ["CPF / cargo", [checkin.responsibleDocument, checkin.responsibleRole].filter(Boolean).join(" · ")],
                  ["Conferente", checkin.conferenteName],
                  ["Hodômetro", checkin.odometer !== null ? `${checkin.odometer.toLocaleString("pt-BR")} km` : "—"],
                  ["Km rodados", km !== null ? `${km.toLocaleString("pt-BR")} km` : "—"],
                  ["Categoria", checkin.vehicleCategory],
                  ["Registrado por", checkin.performedByName],
                  ["Data", formatDateTimeBr(checkin.performedAt)],
                  ["Encerrada em", checkin.closedAt ? formatDateTimeBr(checkin.closedAt) : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-background-200 bg-background-100 px-2.5 py-1.5">
                    <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">{label}</dt>
                    <dd className="mt-0.5 truncate font-semibold text-foreground-900">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
                <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">
                  Combustível · {fuelLabel(checkin.fuelLevel)}
                </p>
                <FuelGauge value={checkin.fuelLevel} />
              </div>
              {linked && (
                <button
                  type="button"
                  onClick={() => onOpen(linked.ref)}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3 py-2 text-left text-xs text-secondary-900 hover:border-secondary-400"
                >
                  <i className="ri-links-line"></i>
                  <span>
                    {linked.kind === "entrega" ? "Retirada" : "Devolução"} ligada: {formatDateTimeBr(linked.performedAt)} ·{" "}
                    {linked.odometer !== null ? `${linked.odometer.toLocaleString("pt-BR")} km` : "—"} · ver ficha
                  </span>
                </button>
              )}
            </div>
          </div>

          <section>
            <h3 className="text-xs font-bold text-foreground-800">
              Avarias no mapa ({checkin.damages.length})
            </h3>
            {checkin.damages.length === 0 ? (
              <p className="mt-1 text-[11px] text-foreground-500">Nenhuma avaria marcada.</p>
            ) : (
              <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {checkin.damages.map((damage, index) => (
                  <li key={damage.id} className="flex gap-2.5 rounded-md border border-background-200 bg-background-50 p-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-background-50 ${
                        damage.preexisting ? "bg-foreground-500" : "bg-danger-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {damage.photo && (
                      <button type="button" onClick={() => setZoom(damage.photo)} className="h-12 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded bg-background-200">
                        {urls[damage.photo] && <img src={urls[damage.photo]} alt="Avaria" className="h-full w-full object-cover" />}
                      </button>
                    )}
                    <div className="min-w-0 text-[11px]">
                      <p className="font-semibold text-foreground-900">{damage.zoneLabel}</p>
                      <p className="text-foreground-600">
                        {damageTypeMeta[damage.type]?.label} ·{" "}
                        <span className={`rounded px-1 font-bold ${severityMeta[damage.severity]?.className}`}>
                          {severityMeta[damage.severity]?.label}
                        </span>
                        {damage.preexisting ? " · pré-existente" : ""}
                      </p>
                      {damage.description && <p className="text-foreground-500">{damage.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold text-foreground-800">
              Conferência de segurança ({checkin.items.length - problems.length}/{checkin.items.length} conforme)
            </h3>
            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {checkin.items.map((item) => (
                <li
                  key={item.key}
                  className={`flex items-start gap-1.5 rounded px-2 py-1 text-[11px] ${
                    item.result === "avaria" ? "bg-danger-50 text-danger-900" : "text-foreground-700"
                  }`}
                >
                  <i className={item.result === "avaria" ? "ri-close-circle-fill text-danger-600" : "ri-checkbox-circle-fill text-primary-600"}></i>
                  <span>
                    {item.label}
                    {item.observation ? ` — ${item.observation}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-bold text-foreground-800">Fotos ({checkin.photos.length})</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {checkin.photos.map((path) => (
                <Photo key={path} path={path} label={slotLabel(path)} />
              ))}
            </div>
          </section>

          {(checkin.repairRequests.length > 0 || repairsOfCheckin.length > 0) && (
            <section>
              <h3 className="text-xs font-bold text-foreground-800">Solicitações de reparo</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {(repairsOfCheckin.length > 0 ? repairsOfCheckin : checkin.repairRequests).map((repair) => {
                  const tracked = "status" in repair ? (repair as VehicleRepairRequest) : null;
                  return (
                    <li key={"ref" in repair ? String(repair.ref) : repair.id} className="rounded-md border border-background-200 bg-background-50 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground-900">{repair.title}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${repairPriorityMeta[repair.priority].className}`}>
                          {repairPriorityMeta[repair.priority].label}
                        </span>
                        {tracked && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${repairStatusMeta[tracked.status].className}`}>
                            {repairStatusMeta[tracked.status].label}
                          </span>
                        )}
                      </div>
                      {repair.description && <p className="mt-0.5 text-[11px] text-foreground-600">{repair.description}</p>}
                      {tracked?.resolution && (
                        <p className="mt-0.5 text-[11px] text-primary-800">
                          <i className="ri-check-line"></i> {tracked.resolution}
                        </p>
                      )}
                      <div className="mt-1.5 flex gap-1.5">
                        {repair.photos.map((path) => (
                          <button key={path} type="button" onClick={() => setZoom(path)} className="h-12 w-16 cursor-zoom-in overflow-hidden rounded bg-background-200">
                            {urls[path] && <img src={urls[path]} alt="Foto do reparo" className="h-full w-full object-cover" />}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {checkin.notes && (
            <section>
              <h3 className="text-xs font-bold text-foreground-800">Observações</h3>
              <p className="mt-1 whitespace-pre-line text-[11px] text-foreground-700">{checkin.notes}</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
