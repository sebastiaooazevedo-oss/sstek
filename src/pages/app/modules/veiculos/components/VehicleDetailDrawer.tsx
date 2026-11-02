import { useEffect, useState } from "react";
import {
  buildPendencies,
  checkinKindMeta,
  checkinsForVehicle,
  epcKindLabels,
  extraPhotos,
  formatDateTimeBr,
  inspectionResultMeta,
  openDeliveryFor,
  ownershipLabels,
  photosForSlot,
  vehiclePhotoSlots,
  vehicleStatusMeta,
  type CheckinKind,
  type Vehicle,
  type VehicleAlertRecord,
  type VehicleBlock,
  type VehicleCheckin,
  type VehicleDocument,
  type VehicleEpcLink,
  type VehicleInspection,
  type InspectionFinding,
  type VehicleRequirement,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";
import VehicleDocumentHistory from "@/pages/app/modules/veiculos/components/VehicleDocumentHistory";

interface Props {
  vehicle: Vehicle | null;
  documents: VehicleDocument[];
  requirements: VehicleRequirement[];
  alerts: VehicleAlertRecord[];
  inspections: VehicleInspection[];
  findings: InspectionFinding[];
  blocks: VehicleBlock[];
  epcLinks: VehicleEpcLink[];
  checkins: VehicleCheckin[];
  canEdit: boolean;
  canManage: boolean;
  canUnblock: boolean;
  canCheckin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddDocument: () => void;
  onReplaceDocument: (doc: VehicleDocument) => void;
  onNotify: (doc: VehicleDocument) => void;
  onInactivate: (motivo: string) => Promise<string | null>;
  onOpenInspections: () => void;
  onOpenCustody: () => void;
  onNewCheckin: (kind: CheckinKind) => void;
}

const pendencyMeta: Record<string, { label: string; className: string }> = {
  ausente: { label: "Ausente", className: "bg-danger-100 text-danger-800" },
  vencido: { label: "Vencido", className: "bg-danger-100 text-danger-800" },
  vencendo: { label: "Vencendo", className: "bg-accent-100 text-accent-800" },
  em_dia: { label: "Em dia", className: "bg-primary-100 text-primary-700" },
  nao_aplicavel: { label: "Não aplicável", className: "bg-background-200 text-foreground-600" },
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground-900">{value || "—"}</p>
    </div>
  );
}

export default function VehicleDetailDrawer({
  vehicle,
  documents,
  requirements,
  alerts,
  inspections,
  findings,
  blocks,
  epcLinks,
  checkins,
  canEdit,
  canManage,
  canUnblock,
  canCheckin,
  onClose,
  onEdit,
  onAddDocument,
  onReplaceDocument,
  onNotify,
  onInactivate,
  onOpenInspections,
  onOpenCustody,
  onNewCheckin,
}: Props) {
  const [inactivating, setInactivating] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ownBlockHistory = vehicle ? blocks.filter((item) => item.vehicleRef === vehicle.ref) : [];
  const ownCheckins = vehicle ? checkinsForVehicle(checkins, vehicle.ref) : [];
  const openDelivery = vehicle ? openDeliveryFor(checkins, vehicle.ref) : null;
  const evidencePaths = Array.from(
    new Set(ownBlockHistory.flatMap((block) => block.releaseEvidence))
  ).filter(Boolean);
  const evidenceUrls = useVehicleFileUrls(evidencePaths);
  const photos = useVehicleFileUrls(vehicle?.photos ?? []);

  useEffect(() => {
    setInactivating(false);
    setMotivo("");
    setError("");
  }, [vehicle?.ref]);

  useEffect(() => {
    if (!vehicle) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [vehicle, onClose]);

  if (!vehicle) return null;

  const status = vehicleStatusMeta[vehicle.status];
  const pendencies = buildPendencies(vehicle, requirements, documents);
  const ownAlerts = alerts.filter((item) => item.vehicleRef === vehicle.ref).slice(0, 5);
  const ownInspections = inspections.filter((item) => item.vehicleRef === vehicle.ref).slice(0, 3);
  const ownFindings = findings.filter((item) => item.vehicleRef === vehicle.ref);
  const openFindings = ownFindings.filter((item) => item.status !== "resolvido").length;
  const treatedFindings = ownFindings.filter((item) => item.status === "resolvido").length;
  const ownEpc = epcLinks.filter((item) => item.vehicleRef === vehicle.ref && item.status === "ativo");

  const confirmInactivate = async () => {
    setError("");
    if (motivo.trim().length < 10) {
      setError("Descreva o motivo com pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    const failure = await onInactivate(motivo.trim());
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    setInactivating(false);
    setMotivo("");
  };

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <button
        type="button"
        aria-label="Fechar ficha do veículo"
        onClick={onClose}
        className="absolute inset-0 bg-foreground-950/40"
      ></button>

      <aside className="relative flex h-full w-full max-w-[600px] flex-col border-l border-background-200 bg-background-50 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-background-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl font-extrabold tracking-tight text-foreground-950">
                {vehicle.plate}
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>
                {status.label}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-foreground-500">
              {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || "Veículo sem modelo informado"}
              {vehicle.internalCode ? ` · ${vehicle.internalCode}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <section className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <InfoRow label="Renavam" value={vehicle.renavam} />
              <InfoRow label="Chassi" value={vehicle.chassis} />
              <InfoRow label="Categoria" value={vehicle.category} />
              <InfoRow label="Combustível" value={vehicle.fuel} />
              <InfoRow label="Propriedade" value={ownershipLabels[vehicle.ownership]} />
              <InfoRow label="Proprietário / locadora" value={vehicle.ownerName} />
              <InfoRow label="Estabelecimento" value={vehicle.establishment} />
              <InfoRow label="Centro de custo" value={vehicle.costCenter} />
              <InfoRow
                label="Hodômetro"
                value={vehicle.odometer === null ? "—" : `${vehicle.odometer.toLocaleString("pt-BR")} km`}
              />
              <InfoRow
                label="Tanque"
                value={vehicle.tankCapacity === null ? "—" : `${vehicle.tankCapacity} L`}
              />
              <InfoRow label="Identificação interna" value={vehicle.internalCode} />
              <InfoRow label="Ano" value={vehicle.year ? String(vehicle.year) : "—"} />
            </div>
            {vehicle.notes && (
              <p className="mt-3 border-t border-background-200 pt-3 text-xs leading-relaxed text-foreground-600">
                {vehicle.notes}
              </p>
            )}
          </section>

          {vehicle.photos.length > 0 && (
            <section className="mt-4">
              <h3 className="font-heading text-sm font-bold text-foreground-950">Fotos do veículo</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {vehiclePhotoSlots.map((slot) => {
                  const path = photosForSlot(vehicle.photos, slot.key)[0] ?? null;
                  return (
                    <div
                      key={slot.key}
                      className="overflow-hidden rounded-md border border-background-200 bg-background-50"
                    >
                      <div className="flex h-24 w-full items-center justify-center bg-background-200">
                        {path && photos[path] ? (
                          <a href={photos[path]} target="_blank" rel="noreferrer" className="h-full w-full">
                            <img
                              src={photos[path]}
                              alt={`${slot.label} do veículo ${vehicle.plate}`}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ) : (
                          <span className="flex flex-col items-center gap-1 text-foreground-400">
                            <i className={`${slot.icon} text-lg`}></i>
                            <span className="text-[10px] font-semibold">sem foto</span>
                          </span>
                        )}
                      </div>
                      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground-500">
                        {slot.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              {extraPhotos(vehicle.photos).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {extraPhotos(vehicle.photos).map((path) => (
                    <div
                      key={path}
                      className="h-20 w-28 overflow-hidden rounded-md border border-background-200 bg-background-200"
                    >
                      {photos[path] ? (
                        <a href={photos[path]} target="_blank" rel="noreferrer">
                          <img
                            src={photos[path]}
                            alt={`Foto extra do veículo ${vehicle.plate}`}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-foreground-400">
                          <i className="ri-image-line"></i>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="mt-5">
            <h3 className="font-heading text-sm font-bold text-foreground-950">Pendências documentais</h3>
            <p className="text-[11px] text-foreground-500">
              Cruzamento entre as exigências configuradas pela empresa e os documentos vigentes.
            </p>
            {pendencies.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-background-300 bg-background-100 px-3 py-3 text-xs text-foreground-500">
                Nenhuma exigência aplicável a esta categoria. Configure em “Exigências documentais”.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {pendencies.map((item) => {
                  const meta = pendencyMeta[item.situation] ?? pendencyMeta.nao_aplicavel;
                  return (
                    <li
                      key={item.requirement.ref}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-background-200 px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground-800">
                        <i className="ri-file-text-line text-foreground-400"></i>
                        <span className="truncate">{item.requirement.typeLabel}</span>
                        {item.requirement.required ? (
                          <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-bold text-foreground-600">
                            obrigatório
                          </span>
                        ) : (
                          <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-500">
                            recomendado
                          </span>
                        )}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="mt-5">
            <VehicleDocumentHistory
              vehicle={vehicle}
              documents={documents}
              canManage={canManage}
              onAdd={onAddDocument}
              onReplace={onReplaceDocument}
              onNotify={onNotify}
            />
          </div>

          <section className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-sm font-bold text-foreground-950">
                Histórico de bloqueios e liberações
              </h3>
              <button
                type="button"
                onClick={onOpenInspections}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary-700 hover:text-primary-800"
              >
                Abrir aba Inspeções
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
            <p className="text-[11px] text-foreground-500">
              Nada é apagado: cada bloqueio e cada liberação ficam registrados com autor, justificativa e evidências.
            </p>
            {ownBlockHistory.length === 0 ? (
              <p className="mt-2 rounded-md border border-dashed border-background-300 bg-background-100 px-3 py-3 text-xs text-foreground-500">
                Nenhum bloqueio registrado para este veículo.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {ownBlockHistory.map((block) => (
                  <li
                    key={block.ref}
                    className={`rounded-md border px-3 py-2.5 ${
                      block.status === "ativo"
                        ? "border-danger-200 bg-danger-50"
                        : "border-background-200 bg-background-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground-900">
                        <i className={block.status === "ativo" ? "ri-lock-line text-danger-700" : "ri-lock-unlock-line text-primary-700"}></i>
                        {block.status === "ativo" ? "Bloqueio ativo" : "Bloqueio liberado"}
                      </p>
                      <span className="text-[10px] text-foreground-500">
                        {block.status === "ativo"
                          ? `desde ${formatDateTimeBr(block.blockedAt)}`
                          : `${formatDateTimeBr(block.blockedAt)} → ${formatDateTimeBr(block.releasedAt)}`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground-700">{block.reason}</p>
                    <p className="mt-0.5 text-[10px] text-foreground-500">
                      Bloqueado por {block.blockedByName || "—"}
                    </p>
                    {block.status === "liberado" && (
                      <div className="mt-1.5 rounded-md bg-background-100 px-2.5 py-2">
                        <p className="text-[10px] text-foreground-600">
                          <strong className="font-semibold text-foreground-800">Liberado por</strong>{" "}
                          {block.releasedByName || "—"} em {formatDateTimeBr(block.releasedAt)}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-600">
                          <strong className="font-semibold text-foreground-800">Justificativa:</strong>{" "}
                          {block.releaseJustification || "—"}
                        </p>
                        {block.releaseEvidence.length > 0 && (
                          <div className="mt-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-400">
                              Evidências anexadas
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {block.releaseEvidence.map((path, index) => (
                                <span key={`${block.ref}-${path}`} className="inline-flex items-center">
                                  {evidenceUrls[path] ? (
                                    <a
                                      href={evidenceUrls[path]}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 text-[10px] font-semibold text-primary-700 hover:bg-background-100"
                                    >
                                      <i className="ri-attachment-2"></i>
                                      Evidência {index + 1}
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-background-300 bg-background-100 px-2 py-1 text-[10px] text-foreground-500">
                                      <i className="ri-attachment-2"></i>
                                      Evidência {index + 1}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {block.status === "ativo" && canUnblock && (
                      <button
                        type="button"
                        onClick={onOpenInspections}
                        className="mt-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-danger-700 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-danger-800"
                      >
                        <i className="ri-lock-unlock-line"></i>
                        Liberar na aba Inspeções
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-sm font-bold text-foreground-950">
                Checklist de retirada e devolução
              </h3>
              <button
                type="button"
                onClick={onOpenCustody}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary-700 hover:text-primary-800"
              >
                Abrir aba Checklist
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
            {openDelivery ? (
              <div className="mt-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5">
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-accent-900">
                  <i className="ri-user-follow-line"></i>
                  Condutor responsável: {openDelivery.responsibleName || "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-accent-800">
                  Entregue em {formatDateTimeBr(openDelivery.performedAt)} · conferido por {openDelivery.conferenteName || "—"}
                  {openDelivery.odometer !== null && ` · ${openDelivery.odometer.toLocaleString("pt-BR")} km`}
                </p>
                {canCheckin && (
                  <button
                    type="button"
                    onClick={() => onNewCheckin("devolucao")}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-primary-700"
                  >
                    <i className="ri-login-box-line"></i>
                    Registrar devolução
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-3 py-2.5">
                <p className="text-[11px] text-foreground-600">
                  Sem condutor responsável — o veículo está na empresa.
                </p>
                {canCheckin && (
                  <button
                    type="button"
                    onClick={() => onNewCheckin("entrega")}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    <i className="ri-logout-box-r-line"></i>
                    Registrar retirada
                  </button>
                )}
              </div>
            )}
            {ownCheckins.length === 0 ? (
              <p className="mt-2 text-[11px] text-foreground-500">Nenhum checklist registrado para este veículo.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {ownCheckins.slice(0, 5).map((checkin) => {
                  const meta = checkinKindMeta[checkin.kind];
                  const avarias = checkin.items.filter((item) => item.result === "avaria").length;
                  return (
                    <li
                      key={checkin.ref}
                      className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-background-200 px-3 py-2 text-[11px] text-foreground-600"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <i className={`${meta.icon} text-foreground-400`}></i>
                        <span className="font-semibold text-foreground-800">{meta.short}</span>
                        <span className="truncate">{checkin.responsibleName || "—"}</span>
                      </span>
                      <span className="text-foreground-500">
                        {formatDateTimeBr(checkin.performedAt)}
                        {checkin.odometer !== null && ` · ${checkin.odometer.toLocaleString("pt-BR")} km`}
                        {avarias > 0 && ` · ${avarias} avaria(s)`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading text-sm font-bold text-foreground-950">Inspeções de segurança</h3>
              <button
                type="button"
                onClick={onOpenInspections}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary-700 hover:text-primary-800"
              >
                Abrir aba Inspeções
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
            <p className="mt-1 text-[11px] text-foreground-500">
              {ownFindings.length === 0
                ? "Nenhum achado registrado nas inspeções deste veículo."
                : `${openFindings} achado(s) aberto(s) · ${treatedFindings} tratado(s)`}
            </p>
            {ownInspections.length === 0 ? (
              <p className="mt-2 text-[11px] text-foreground-500">
                Nenhuma inspeção registrada para este veículo.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {ownInspections.map((inspection) => {
                  const meta = inspectionResultMeta[inspection.result];
                  return (
                    <li
                      key={inspection.ref}
                      className="rounded-md border border-background-200 px-3 py-2 text-[11px] text-foreground-600"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold text-foreground-800">
                          {inspection.templateName || "Checklist"} v{inspection.templateVersion}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5">
                        {formatDateTimeBr(inspection.performedAt)} · {inspection.performedByName || "—"}
                        {inspection.odometer !== null &&
                          ` · ${inspection.odometer.toLocaleString("pt-BR")} km`}
                        {` · ${inspection.totalFindings} achado(s)`}
                      </p>
                      {ownFindings.filter((item) => item.inspectionRef === inspection.ref).length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-1">
                          {ownFindings
                            .filter((item) => item.inspectionRef === inspection.ref)
                            .map((finding) => (
                              <div
                                key={finding.ref}
                                className={`rounded-md border px-2.5 py-1.5 ${
                                  finding.status === "resolvido"
                                    ? "border-primary-200 bg-primary-50"
                                    : "border-accent-200 bg-accent-50"
                                }`}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold text-foreground-900">
                                    {finding.itemLabel}
                                  </span>
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                                      finding.status === "resolvido"
                                        ? "bg-primary-100 text-primary-700"
                                        : "bg-accent-100 text-accent-800"
                                    }`}
                                  >
                                    {finding.status === "resolvido" ? "tratado" : "aberto"}
                                  </span>
                                </div>
                                {finding.description && (
                                  <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-600">
                                    {finding.description}
                                  </p>
                                )}
                                {finding.status === "resolvido" ? (
                                  <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-600">
                                    <strong className="font-semibold text-foreground-800">Tratativa:</strong>{" "}
                                    {finding.resolutionNotes || "—"} · {finding.resolvedByName || "—"} ·{" "}
                                    {formatDateTimeBr(finding.resolvedAt)}
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-[10px] text-foreground-500">
                                    Sem tratativa registrada. Registre na aba Inspeções.
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-5">
            <h3 className="font-heading text-sm font-bold text-foreground-950">
              EPCs e acessórios vinculados
            </h3>
            {ownEpc.length === 0 ? (
              <p className="mt-2 text-[11px] text-foreground-500">
                Nenhum equipamento ativo vinculado a este veículo.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {ownEpc.map((link) => (
                  <li
                    key={link.ref}
                    className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border border-background-200 px-3 py-2 text-[11px] text-foreground-600"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <i className="ri-shield-cross-line text-foreground-400"></i>
                      <span className="truncate font-semibold text-foreground-800">{link.epiName}</span>
                      {link.identification && (
                        <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-bold text-foreground-600">
                          {link.identification}
                        </span>
                      )}
                    </span>
                    <span className="text-foreground-500">
                      {epcKindLabels[link.kind]} · qtd. {link.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-5">
            <h3 className="font-heading text-sm font-bold text-foreground-950">Avisos de vencimento registrados</h3>
            {ownAlerts.length === 0 ? (
              <p className="mt-2 text-[11px] text-foreground-500">Nenhum aviso registrado para este veículo.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {ownAlerts.map((item) => (
                  <li key={item.id} className="rounded-md border border-background-200 px-3 py-2 text-[11px] text-foreground-600">
                    <span className="font-semibold text-foreground-800">{formatDateTimeBr(item.createdAt)}</span>
                    {" · "}
                    {item.sentTo || "registro interno"}
                    {item.daysBefore !== null && ` · ${item.daysBefore} dias antes`}
                    {item.actorName && ` · por ${item.actorName}`}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="border-t border-background-200 px-5 py-4">
          {inactivating ? (
            <div className="flex flex-col gap-2">
              {error && (
                <p className="rounded-md bg-danger-100 px-3 py-2 text-[11px] font-medium text-danger-800">{error}</p>
              )}
              <label className="text-[11px] font-semibold text-foreground-700">
                Motivo da inativação (obrigatório)
                <textarea
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value.slice(0, 500))}
                  className="mt-1 min-h-[64px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  placeholder="Ex.: veículo devolvido à locadora em 02/11/2026."
                ></textarea>
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInactivating(false);
                    setError("");
                  }}
                  className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmInactivate}
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-danger-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className="ri-archive-line"></i>
                  {saving ? "Inativando..." : "Confirmar inativação"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] leading-relaxed text-foreground-400">
                Veículos não são excluídos: inativar preserva documentos e histórico.
              </p>
              <div className="flex flex-wrap gap-2">
                {canEdit && vehicle.status !== "inativo" && (
                  <button
                    type="button"
                    onClick={() => setInactivating(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-forbid-2-line"></i>
                    Inativar
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-700"
                  >
                    <i className="ri-edit-line"></i>
                    Editar cadastro
                  </button>
                )}
              </div>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}