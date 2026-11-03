import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CHECKIN_REQUIRED_PHOTOS,
  checkinPhotoTag,
  kmRodados,
  placaConfere,
  validarHodometro,
  validarReparo,
} from "@shared/checkin";
import CameraCaptureModal from "@/components/base/CameraCaptureModal";
import { inputClass } from "@/pages/app/components/Modal";
import {
  openDeliveryFor,
  repairPriorityMeta,
  type CheckinDamage,
  type CheckinItem,
  type CheckinItemResult,
  type CheckinKind,
  type CheckinRepairRequest,
  type RepairPriority,
  type Vehicle,
  type VehicleCheckin,
  type VehicleRepairRequest,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { registrarCheckin } from "@/pages/app/modules/veiculos/vehiclesStore";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";
import DamageStep from "@/pages/app/modules/veiculos/checkin/DamageStep";
import VehicleIllustration from "@/pages/app/modules/veiculos/checkin/VehicleIllustration";
import {
  avariasPreexistentes,
  damageTypeMeta,
  fuelLabel,
  itensConferencia,
  prioridadeSugerida,
  severityMeta,
} from "@/pages/app/modules/veiculos/checkin/checkinRules";
import {
  FuelGauge,
  PhotoButtons,
  PhotoThumb,
  PlatePill,
  useCheckinUploader,
} from "@/pages/app/modules/veiculos/checkin/checkinUi";
import { diagramKindFor, diagramKindMeta } from "@/pages/app/modules/veiculos/checkin/vehicleDiagrams";

/**
 * Check-in de segurança de retirada e devolução, em etapas.
 *
 * 1. Veículo  2. Identificação  3. Conferência  4. Avarias  5. Fotos
 * 6. Reparos  7. Revisão e assinatura → tela de comprovante.
 *
 * Tudo é revalidado no servidor (função `veiculos`, ação `registrar_checkin`).
 */

interface Props {
  open: boolean;
  vehicles: Vehicle[];
  checkins: VehicleCheckin[];
  repairRequests: VehicleRepairRequest[];
  initialVehicleRef: string | null;
  initialKind: CheckinKind;
  currentUserName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

type StepKey = "veiculo" | "identificacao" | "conferencia" | "avarias" | "fotos" | "reparos" | "revisao";

const STEPS: { key: StepKey; label: string; icon: string }[] = [
  { key: "veiculo", label: "Veículo", icon: "ri-car-line" },
  { key: "identificacao", label: "Identificação", icon: "ri-dashboard-3-line" },
  { key: "conferencia", label: "Conferência", icon: "ri-list-check-3" },
  { key: "avarias", label: "Avarias", icon: "ri-map-pin-2-line" },
  { key: "fotos", label: "Fotos", icon: "ri-camera-3-line" },
  { key: "reparos", label: "Reparos", icon: "ri-tools-line" },
  { key: "revisao", label: "Revisão", icon: "ri-quill-pen-line" },
];

interface ItemState {
  result: CheckinItemResult;
  observation: string;
}

interface Saved {
  ref: string;
  detail: string;
  kind: CheckinKind;
  plate: string;
  km: number | null;
  avarias: number;
  reparos: number;
}

const repairId = () => `rp-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;

/** Mantém um pedido de reparo para cada avaria nova marcada com "solicitar reparo". */
function syncRepairs(damages: CheckinDamage[], repairs: CheckinRepairRequest[]): CheckinRepairRequest[] {
  const wanted = damages.filter((item) => item.repair && !item.preexisting);
  const wantedIds = new Set(wanted.map((item) => item.id));
  const kept = repairs
    .filter((item) => !item.damageId || wantedIds.has(item.damageId))
    .map((item) => ({ ...item, photos: [...item.photos] }));
  for (const damage of wanted) {
    const existing = kept.find((item) => item.damageId === damage.id);
    if (existing) {
      if (damage.photo && !existing.photos.includes(damage.photo)) existing.photos = [damage.photo, ...existing.photos].slice(0, 4);
      continue;
    }
    kept.push({
      id: repairId(),
      title: `${damageTypeMeta[damage.type]?.label ?? "Avaria"} — ${damage.zoneLabel}`,
      description: damage.description,
      priority: prioridadeSugerida(damage.severity),
      photos: damage.photo ? [damage.photo] : [],
      damageId: damage.id,
    });
  }
  return kept;
}

export default function CheckinWizard({
  open,
  vehicles,
  checkins,
  repairRequests,
  initialVehicleRef,
  initialKind,
  currentUserName,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [kind, setKind] = useState<CheckinKind>(initialKind);
  const [category, setCategory] = useState("");
  const [vehicleRef, setVehicleRef] = useState("");
  const [plateTyped, setPlateTyped] = useState("");
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState<number | null>(null);
  const [responsibleDocument, setResponsibleDocument] = useState("");
  const [responsibleRole, setResponsibleRole] = useState("");
  const [conferenteName, setConferenteName] = useState("");
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [damages, setDamagesState] = useState<CheckinDamage[]>([]);
  const [dismissed, setDismissed] = useState<CheckinDamage[]>([]);
  const [slotPhotos, setSlotPhotos] = useState<Record<string, string>>({});
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [repairs, setRepairs] = useState<CheckinRepairRequest[]>([]);
  const [notes, setNotes] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [camera, setCamera] = useState<{ title: string; onFile: (file: File) => Promise<void> } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { upload, uploading } = useCheckinUploader(setError);

  const activeVehicles = useMemo(() => vehicles.filter((item) => item.status !== "inativo"), [vehicles]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    activeVehicles.forEach((item) => counts.set(item.category || "Leve", (counts.get(item.category || "Leve") ?? 0) + 1));
    return Array.from(counts.entries());
  }, [activeVehicles]);

  const vehicle = activeVehicles.find((item) => item.ref === vehicleRef) ?? null;
  const openDelivery = vehicle ? openDeliveryFor(checkins, vehicle.ref) : null;
  const diagramKind = diagramKindFor(vehicle?.category ?? "");
  const itemList = itensConferencia(diagramKind);
  const responsibleName = kind === "entrega" ? currentUserName.trim() : (openDelivery?.responsibleName ?? "").trim();
  const odometerRef = kind === "devolucao" ? (openDelivery?.odometer ?? null) : (vehicle?.odometer ?? null);
  const odometerValue = odometer.trim() === "" ? null : Number(odometer);
  const plateOk = vehicle ? placaConfere(plateTyped, vehicle.plate) : false;

  const allPaths = useMemo(
    () => [
      ...Object.values(slotPhotos),
      ...extraPhotos,
      ...damages.map((item) => item.photo),
      ...repairs.flatMap((item) => item.photos),
    ].filter(Boolean),
    [slotPhotos, extraPhotos, damages, repairs]
  );
  const urls = useVehicleFileUrls(allPaths);

  const dirty = Boolean(vehicleRef) && !saved && (maxStep > 0 || plateTyped !== "");

  const resetFor = (target: Vehicle | null, nextKind: CheckinKind) => {
    setVehicleRef(target?.ref ?? "");
    setKind(nextKind);
    setPlateTyped("");
    setOdometer("");
    setFuel(null);
    setItems({});
    const previous = target ? avariasPreexistentes(checkins, target.ref, repairRequests) : [];
    setDamagesState(previous);
    setDismissed([]);
    setRepairs([]);
  };

  useEffect(() => {
    if (!open) return;
    const preset =
      initialVehicleRef && activeVehicles.some((item) => item.ref === initialVehicleRef) ? initialVehicleRef : "";
    const target = activeVehicles.find((item) => item.ref === preset) ?? null;
    const delivery = target ? openDeliveryFor(checkins, target.ref) : null;
    setStep(0);
    setMaxStep(0);
    setCategory("");
    resetFor(target, target ? (delivery ? "devolucao" : "entrega") : initialKind);
    setResponsibleDocument("");
    setResponsibleRole("");
    setConferenteName("");
    setSlotPhotos({});
    setExtraPhotos([]);
    setNotes("");
    setDeclaration(false);
    setError("");
    setSaving(false);
    setSaved(null);
    setConfirmDiscard(false);
    setCamera(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialVehicleRef, initialKind]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step, saved]);

  if (!open) return null;

  const setDamages = (next: CheckinDamage[]) => {
    setDamagesState(next);
    setRepairs((prev) => syncRepairs(next, prev));
  };

  const itemState = (key: string): ItemState => items[key] ?? { result: "conforme", observation: "" };
  const patchItem = (key: string, values: Partial<ItemState>) =>
    setItems((prev) => ({ ...prev, [key]: { ...itemState(key), ...values } }));

  const requestCamera = (title: string, onFile: (file: File) => Promise<void>) => setCamera({ title, onFile });

  const eligibility = (item: Vehicle): string => {
    const delivery = openDeliveryFor(checkins, item.ref);
    if (kind === "entrega") {
      if (delivery) return `Em uso por ${delivery.responsibleName || "outro condutor"}`;
      if (item.status === "bloqueado") return "Bloqueado por não conformidade";
      if (item.status === "manutencao") return "";
      return "";
    }
    return delivery ? "" : "Está na empresa (sem retirada aberta)";
  };

  /** Erro que impede sair da etapa atual, ou "". */
  const stepError = (key: StepKey): string => {
    if (key === "veiculo") {
      if (!vehicle) return "Escolha o veículo.";
      const reason = eligibility(vehicle);
      return reason ? `Este veículo não pode ter ${kind === "entrega" ? "retirada" : "devolução"}: ${reason}.` : "";
    }
    if (key === "identificacao") {
      if (!plateOk) return "Digite a placa do veículo que está à sua frente. Ela precisa conferir com o cadastro.";
      const odo = validarHodometro(odometerValue, odometerRef, kind);
      if (odo) return odo;
      if (fuel === null) return "Toque no marcador para informar o nível de combustível.";
      if (responsibleName.length < 3) {
        return kind === "entrega"
          ? "Não foi possível identificar você como condutor. Saia e entre novamente no sistema."
          : "O condutor da retirada em aberto não foi encontrado.";
      }
      if (conferenteName.trim().length < 3) return "A dupla conferência exige o nome do conferente da empresa.";
      return "";
    }
    if (key === "conferencia") {
      const missing = itemList.find((item) => itemState(item.key).result === "avaria" && itemState(item.key).observation.trim().length < 5);
      return missing ? `Descreva o problema encontrado em “${missing.label}”.` : "";
    }
    if (key === "fotos") {
      const missing = CHECKIN_REQUIRED_PHOTOS.filter((slot) => !slotPhotos[slot.key]).map((slot) => slot.label);
      return missing.length ? `Faltam as fotos obrigatórias: ${missing.join(", ")}.` : "";
    }
    if (key === "reparos") {
      for (let index = 0; index < repairs.length; index += 1) {
        const message = validarReparo(repairs[index], index + 1);
        if (message) return message;
      }
      return "";
    }
    if (key === "revisao") {
      return declaration ? "" : "Confirme a declaração para registrar o check-in.";
    }
    return "";
  };

  const goTo = (index: number) => {
    setError("");
    if (index <= step || index <= maxStep) {
      // Pode voltar livremente; avançar por clique só até onde já foi validado.
      for (let i = 0; i < index; i += 1) {
        const message = stepError(STEPS[i].key);
        if (message) {
          setStep(i);
          setError(message);
          return;
        }
      }
      setStep(index);
    }
  };

  const next = () => {
    const message = stepError(STEPS[step].key);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    const target = Math.min(step + 1, STEPS.length - 1);
    setStep(target);
    setMaxStep((prev) => Math.max(prev, target));
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const message = stepError(STEPS[i].key);
      if (message) {
        setStep(i);
        setError(message);
        return;
      }
    }
    if (!vehicle) return;
    const payloadItems: CheckinItem[] = itemList.map((item) => ({
      key: item.key,
      label: item.label,
      result: itemState(item.key).result,
      observation: itemState(item.key).observation.trim(),
    }));
    const photos = [
      ...CHECKIN_REQUIRED_PHOTOS.map((slot) => slotPhotos[slot.key]).filter(Boolean),
      ...extraPhotos,
    ];
    setSaving(true);
    setError("");
    const result = await registrarCheckin({
      vehicleRef: vehicle.ref,
      kind,
      responsibleName,
      responsibleDocument: responsibleDocument.trim(),
      responsibleRole: responsibleRole.trim(),
      conferenteName: conferenteName.trim(),
      odometer: odometerValue,
      fuelLevel: fuel,
      items: payloadItems,
      photos,
      notes: notes.trim(),
      plateTyped,
      damages,
      repairRequests: repairs,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível registrar o check-in.");
      return;
    }
    setSaved({
      ref: String((result as unknown as Record<string, unknown>).ref ?? ""),
      detail: result.detail || "Check-in registrado.",
      kind,
      plate: vehicle.plate,
      km: kind === "devolucao" ? kmRodados(openDelivery?.odometer ?? null, odometerValue) : null,
      avarias: damages.filter((item) => !item.preexisting).length,
      reparos: repairs.length,
    });
  };

  const close = () => {
    if (saving) return;
    if (saved) {
      onSaved(saved.detail);
      return;
    }
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const current = STEPS[step].key;
  const avariasItens = itemList.filter((item) => itemState(item.key).result === "avaria").length;
  const novasAvarias = damages.filter((item) => !item.preexisting).length;

  /* --------------------------------- Etapas --------------------------------- */

  const stepVeiculo = (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["entrega", "devolucao"] as CheckinKind[]).map((option) => {
          const active = kind === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                setError("");
                const keep = vehicle && (option === "devolucao") === Boolean(openDeliveryFor(checkins, vehicle.ref));
                resetFor(keep ? vehicle : null, option);
              }}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                active
                  ? "border-primary-500 bg-primary-50 shadow-sm"
                  : "border-background-200 bg-background-50 hover:border-primary-200"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl ${
                  active ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600"
                }`}
              >
                <i className={option === "entrega" ? "ri-key-2-line" : "ri-parking-box-line"}></i>
              </span>
              <span>
                <span className="block font-heading text-sm font-bold text-foreground-950">
                  {option === "entrega" ? "Retirada do veículo" : "Devolução do veículo"}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-foreground-500">
                  {option === "entrega"
                    ? "Você assume o veículo como condutor responsável até devolver."
                    : "O veículo volta para a empresa e a retirada aberta é encerrada."}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <p className="text-xs font-bold text-foreground-800">Tipo de veículo</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[["", activeVehicles.length] as [string, number], ...categories].map(([cat, count]) => {
            const active = category === cat;
            const meta = cat ? diagramKindMeta[diagramKindFor(cat)] : null;
            return (
              <button
                key={cat || "todos"}
                type="button"
                onClick={() => setCategory(cat)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary-500 bg-primary-500 text-background-50"
                    : "border-background-300 bg-background-50 text-foreground-700 hover:border-primary-300"
                }`}
              >
                <i className={meta?.icon ?? "ri-apps-2-line"}></i>
                {cat || "Todos"}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-background-50/20" : "bg-background-100"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-foreground-800">Escolha o veículo</p>
        {activeVehicles.length === 0 ? (
          <p className="mt-2 rounded-md border border-dashed border-background-300 px-3 py-6 text-center text-xs text-foreground-500">
            Nenhum veículo ativo. Cadastre em <strong>+ Novo veículo</strong>.
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {activeVehicles
              .filter((item) => !category || (item.category || "Leve") === category)
              .map((item) => {
                const reason = eligibility(item);
                const selected = item.ref === vehicleRef;
                const delivery = openDeliveryFor(checkins, item.ref);
                return (
                  <button
                    key={item.ref}
                    type="button"
                    disabled={Boolean(reason)}
                    onClick={() => {
                      setError("");
                      if (item.ref !== vehicleRef) resetFor(item, kind);
                    }}
                    className={`relative flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      selected
                        ? "border-primary-500 bg-primary-50 shadow-sm"
                        : reason
                          ? "cursor-not-allowed border-background-200 bg-background-100 opacity-60"
                          : "cursor-pointer border-background-200 bg-background-50 hover:border-primary-200"
                    }`}
                  >
                    <span className="h-16 w-9 shrink-0">
                      <VehicleIllustration kind={diagramKindFor(item.category)} className="pointer-events-none" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <PlatePill plate={item.plate} size="sm" />
                      <span className="mt-1 block truncate text-xs font-semibold text-foreground-900">
                        {[item.brand, item.model].filter(Boolean).join(" ") || item.category}
                      </span>
                      <span className="block truncate text-[10.5px] text-foreground-500">
                        {item.category || "—"}
                        {item.odometer !== null ? ` · ${item.odometer.toLocaleString("pt-BR")} km` : ""}
                      </span>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${
                          delivery
                            ? "bg-accent-100 text-accent-800"
                            : item.status === "bloqueado"
                              ? "bg-danger-100 text-danger-800"
                              : item.status === "manutencao"
                                ? "bg-background-200 text-foreground-700"
                                : "bg-primary-100 text-primary-700"
                        }`}
                      >
                        {delivery
                          ? `Em uso · ${delivery.responsibleName}`
                          : item.status === "bloqueado"
                            ? "Bloqueado"
                            : item.status === "manutencao"
                              ? "Em manutenção"
                              : "Disponível"}
                      </span>
                    </span>
                    {selected && <i className="ri-checkbox-circle-fill absolute right-2 top-2 text-lg text-primary-600"></i>}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );

  const stepIdentificacao = vehicle && (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-background-200 bg-background-100 p-4">
          <p className="text-xs font-bold text-foreground-800">
            Confirme a placa <span className="text-accent-600">*</span>
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            Digite a placa do veículo que está à sua frente — evita check-in no veículo errado.
          </p>
          <input
            value={plateTyped}
            onChange={(event) => setPlateTyped(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8))}
            placeholder="ABC1D23"
            aria-label="Placa digitada"
            autoComplete="off"
            className={`mt-3 w-full rounded-lg border-2 bg-background-50 px-3 py-3 text-center font-mono text-2xl font-extrabold uppercase tracking-[0.2em] text-foreground-950 outline-none transition-colors ${
              plateTyped.length >= 7 ? (plateOk ? "border-primary-500" : "border-danger-500") : "border-background-300 focus:border-primary-400"
            }`}
          />
          {plateTyped.length >= 7 && (
            <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${plateOk ? "text-primary-700" : "text-danger-700"}`}>
              <i className={plateOk ? "ri-checkbox-circle-fill" : "ri-close-circle-fill"}></i>
              {plateOk ? "Placa confere com o cadastro." : "A placa não confere com o veículo escolhido."}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-background-200 bg-background-100 p-4">
          <p className="text-xs font-bold text-foreground-800">
            Hodômetro (km) <span className="text-accent-600">*</span>
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            {odometerRef !== null
              ? `${kind === "devolucao" ? "Na retirada" : "Último registro"}: ${odometerRef.toLocaleString("pt-BR")} km`
              : "Sem registro anterior."}
          </p>
          <div className="relative mt-3">
            <i className="ri-speed-up-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-foreground-400"></i>
            <input
              value={odometer}
              onChange={(event) => setOdometer(event.target.value.replace(/\D/g, "").slice(0, 7))}
              inputMode="numeric"
              placeholder="0"
              aria-label="Hodômetro em km"
              className="w-full rounded-lg border-2 border-background-300 bg-background-50 py-3 pl-10 pr-12 font-mono text-2xl font-bold tabular-nums text-foreground-950 outline-none focus:border-primary-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground-500">km</span>
          </div>
          {kind === "devolucao" && odometerValue !== null && kmRodados(odometerRef, odometerValue) !== null && (
            <p className="mt-2 text-xs font-semibold text-primary-700">
              <i className="ri-route-line"></i> {kmRodados(odometerRef, odometerValue)?.toLocaleString("pt-BR")} km rodados nesta utilização
            </p>
          )}
          {odometerValue !== null && odometerRef !== null && odometerValue < odometerRef && (
            <p className="mt-2 text-xs font-semibold text-danger-700">
              <i className="ri-error-warning-line"></i> Menor que o último registro.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-background-200 bg-background-100 p-4">
        <p className="text-xs font-bold text-foreground-800">
          Nível de combustível <span className="text-accent-600">*</span>
        </p>
        <p className="mb-3 mt-0.5 text-[11px] text-foreground-500">Toque na barra que corresponde ao marcador do painel.</p>
        <FuelGauge value={fuel} onChange={setFuel} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground-700">Condutor responsável</span>
          <input className={`${inputClass} cursor-not-allowed bg-background-100 font-semibold`} value={responsibleName || "—"} readOnly />
          <span className="text-[11px] text-foreground-400">
            {kind === "entrega" ? "Quem faz a retirada assume o veículo." : "Quem estava com o veículo."}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground-700">
            Conferente da empresa <span className="text-accent-600">*</span>
          </span>
          <input
            className={inputClass}
            value={conferenteName}
            onChange={(event) => setConferenteName(event.target.value.slice(0, 120))}
            placeholder="Nome de quem confere pela empresa"
          />
          <span className="text-[11px] text-foreground-400">Segunda pessoa da dupla conferência.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground-700">CPF do condutor</span>
          <input
            className={inputClass}
            value={responsibleDocument}
            onChange={(event) => setResponsibleDocument(event.target.value.slice(0, 40))}
            placeholder="Opcional — preenchido pelo cadastro do colaborador"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground-700">Cargo / vínculo</span>
          <input
            className={inputClass}
            value={responsibleRole}
            onChange={(event) => setResponsibleRole(event.target.value.slice(0, 80))}
            placeholder="Ex.: motorista, técnico de campo"
          />
        </label>
      </div>
    </div>
  );

  const stepConferencia = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-foreground-500">
          Confira cada item. Se algo estiver errado, marque <strong>Problema</strong> e descreva.
        </p>
        <button
          type="button"
          onClick={() => setItems({})}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-background-300 px-2.5 py-1 text-[11px] font-semibold text-foreground-700 hover:border-primary-300 hover:text-primary-700"
        >
          <i className="ri-check-double-line"></i>
          Tudo conforme
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {itemList.map((item) => {
          const state = itemState(item.key);
          const problem = state.result === "avaria";
          return (
            <div
              key={item.key}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                problem ? "border-danger-300 bg-danger-50/50" : "border-background-200 bg-background-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    problem ? "bg-danger-100 text-danger-700" : "bg-primary-100 text-primary-700"
                  }`}
                >
                  <i className={item.icon}></i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground-900">{item.label}</span>
                  <span className="block text-[10.5px] text-foreground-500">{item.hint}</span>
                </span>
                <span className="flex shrink-0 gap-0.5 rounded-full bg-background-100 p-0.5">
                  <button
                    type="button"
                    aria-pressed={!problem}
                    aria-label={`${item.label}: conforme`}
                    onClick={() => patchItem(item.key, { result: "conforme" })}
                    className={`cursor-pointer rounded-full px-2 py-1 text-[10px] font-bold ${
                      !problem ? "bg-primary-500 text-background-50" : "text-foreground-500"
                    }`}
                  >
                    <i className="ri-check-line"></i> OK
                  </button>
                  <button
                    type="button"
                    aria-pressed={problem}
                    aria-label={`${item.label}: problema`}
                    onClick={() => patchItem(item.key, { result: "avaria" })}
                    className={`cursor-pointer rounded-full px-2 py-1 text-[10px] font-bold ${
                      problem ? "bg-danger-600 text-background-50" : "text-foreground-500"
                    }`}
                  >
                    <i className="ri-error-warning-line"></i> Problema
                  </button>
                </span>
              </div>
              {problem && (
                <textarea
                  value={state.observation}
                  onChange={(event) => patchItem(item.key, { observation: event.target.value.slice(0, 1000) })}
                  placeholder="O que foi encontrado? (obrigatório)"
                  aria-label={`Descrição do problema em ${item.label}`}
                  className="mt-2 min-h-[44px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-xs text-foreground-900 outline-none focus:border-primary-400"
                ></textarea>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const stepFotos = (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-foreground-500">
        As 5 fotos são obrigatórias e ficam como evidência do estado do veículo. Na foto do painel, o hodômetro e o
        combustível precisam estar legíveis.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {CHECKIN_REQUIRED_PHOTOS.map((slot) => {
          const path = slotPhotos[slot.key];
          const attach = async (file: File) => {
            const uploaded = await upload(file, checkinPhotoTag(slot.key));
            if (uploaded) setSlotPhotos((prev) => ({ ...prev, [slot.key]: uploaded }));
          };
          return (
            <div
              key={slot.key}
              className={`flex flex-col overflow-hidden rounded-xl border-2 ${
                path ? "border-primary-300 bg-background-50" : "border-dashed border-background-300 bg-background-100"
              }`}
            >
              <div className="relative flex aspect-[4/3] items-center justify-center bg-background-200">
                {path && urls[path] ? (
                  <img src={urls[path]} alt={`Foto ${slot.label}`} className="h-full w-full object-cover" />
                ) : (
                  <i className={`${slot.key === "painel" ? "ri-dashboard-3-line" : "ri-camera-3-line"} text-3xl text-foreground-400`}></i>
                )}
                {path && <i className="ri-checkbox-circle-fill absolute right-1.5 top-1.5 text-lg text-primary-600 drop-shadow"></i>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                <span className="text-xs font-bold text-foreground-900">{slot.label}</span>
                <span className="text-[10px] leading-tight text-foreground-500">{slot.hint}</span>
                <PhotoButtons
                  compact
                  label={path ? "Refazer" : "Foto"}
                  disabled={uploading}
                  onCamera={() => requestCamera(`Foto: ${slot.label}`, attach)}
                  onFiles={(files) => void attach(files[0])}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <p className="text-xs font-bold text-foreground-800">Fotos adicionais (opcional, até 3)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {extraPhotos.map((path) => (
            <PhotoThumb
              key={path}
              url={urls[path]}
              alt="Foto adicional"
              onRemove={() => setExtraPhotos((prev) => prev.filter((item) => item !== path))}
            />
          ))}
          {extraPhotos.length < 3 && (
            <PhotoButtons
              disabled={uploading}
              label="Adicionar"
              onCamera={() =>
                requestCamera("Foto adicional", async (file) => {
                  const path = await upload(file);
                  if (path) setExtraPhotos((prev) => [...prev, path].slice(0, 3));
                })
              }
              onFiles={async (files) => {
                const path = await upload(files[0]);
                if (path) setExtraPhotos((prev) => [...prev, path].slice(0, 3));
              }}
            />
          )}
          {uploading && (
            <span className="text-[11px] text-foreground-500">
              <i className="ri-loader-4-line animate-spin"></i> Enviando...
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const patchRepair = (id: string, values: Partial<CheckinRepairRequest>) =>
    setRepairs((prev) => prev.map((item) => (item.id === id ? { ...item, ...values } : item)));

  const stepReparos = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-[11px] text-foreground-500">
          Informe o que precisa ser reparado e registre foto. Os pedidos vão para a gestão da frota e ficam
          acompanhados no painel de check-ins. Se não houver nada a reparar, é só continuar.
        </p>
        <button
          type="button"
          onClick={() =>
            setRepairs((prev) => [
              ...prev,
              { id: repairId(), title: "", description: "", priority: "media", photos: [], damageId: "" },
            ])
          }
          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50 hover:bg-primary-600"
        >
          <i className="ri-add-line"></i>
          Solicitar reparo
        </button>
      </div>
      {repairs.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-background-300 px-4 py-8 text-center">
          <i className="ri-tools-line text-2xl text-foreground-400"></i>
          <p className="text-xs font-semibold text-foreground-700">Nenhum reparo solicitado</p>
          <p className="text-[11px] text-foreground-500">
            Avarias marcadas com “solicitar reparo” aparecem aqui automaticamente.
          </p>
        </div>
      )}
      {repairs.map((repair, index) => {
        const attach = async (file: File) => {
          const path = await upload(file);
          if (path) patchRepair(repair.id, { photos: [...repair.photos, path].slice(0, 4) });
        };
        return (
          <div key={repair.id} className="rounded-xl border border-background-200 bg-background-50 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-500">
                Reparo {index + 1}
                {repair.damageId ? " · ligado a uma avaria do mapa" : ""}
              </p>
              <button
                type="button"
                aria-label={`Remover reparo ${index + 1}`}
                onClick={() => {
                  setRepairs((prev) => prev.filter((item) => item.id !== repair.id));
                  if (repair.damageId) {
                    setDamagesState((prev) => prev.map((item) => (item.id === repair.damageId ? { ...item, repair: false } : item)));
                  }
                }}
                className="cursor-pointer rounded-md p-1 text-foreground-500 hover:bg-background-100 hover:text-danger-700"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="flex flex-col gap-2">
                <input
                  className={inputClass}
                  value={repair.title}
                  onChange={(event) => patchRepair(repair.id, { title: event.target.value.slice(0, 120) })}
                  placeholder="O que deve ser reparado? Ex.: trocar retrovisor esquerdo"
                  aria-label={`O que reparar (reparo ${index + 1})`}
                />
                <textarea
                  className={`${inputClass} min-h-[52px] resize-y text-xs`}
                  value={repair.description}
                  onChange={(event) => patchRepair(repair.id, { description: event.target.value.slice(0, 1000) })}
                  placeholder="Detalhes para a oficina (opcional)"
                ></textarea>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground-700">Prioridade</p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {(Object.keys(repairPriorityMeta) as RepairPriority[]).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => patchRepair(repair.id, { priority })}
                      className={`cursor-pointer rounded-md border px-2 py-1 text-[10.5px] font-bold ${
                        repair.priority === priority
                          ? `${repairPriorityMeta[priority].className} border-current`
                          : "border-background-300 text-foreground-600 hover:border-primary-300"
                      }`}
                    >
                      {repairPriorityMeta[priority].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {repair.photos.map((path) => (
                <PhotoThumb
                  key={path}
                  url={urls[path]}
                  alt="Foto do reparo"
                  className="h-14 w-[72px]"
                  onRemove={() => patchRepair(repair.id, { photos: repair.photos.filter((item) => item !== path) })}
                />
              ))}
              {repair.photos.length < 4 && (
                <PhotoButtons
                  compact
                  disabled={uploading}
                  onCamera={() => requestCamera(`Reparo: ${repair.title || "foto"}`, attach)}
                  onFiles={(files) => void attach(files[0])}
                />
              )}
              {repair.photos.length === 0 && (
                <span className="text-[10.5px] font-semibold text-danger-700">Foto obrigatória</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const resumo = vehicle && (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="mx-auto aspect-[240/440] w-full max-w-[180px] rounded-xl border border-background-200 bg-background-100 p-2">
          <VehicleIllustration kind={diagramKind} damages={damages} />
        </div>
        <dl className="grid grid-cols-2 gap-2 self-start text-xs sm:grid-cols-3">
          {[
            ["Operação", kind === "entrega" ? "Retirada" : "Devolução"],
            ["Placa", vehicle.plate],
            ["Veículo", [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.category],
            ["Condutor", responsibleName],
            ["Conferente", conferenteName],
            ["Hodômetro", odometerValue !== null ? `${odometerValue.toLocaleString("pt-BR")} km` : "—"],
            ["Combustível", fuelLabel(fuel)],
            ["Itens com problema", `${avariasItens} de ${itemList.length}`],
            ["Avarias novas", String(novasAvarias)],
            ["Pré-existentes", String(damages.length - novasAvarias)],
            ["Fotos", String(Object.keys(slotPhotos).length + extraPhotos.length)],
            ["Reparos solicitados", String(repairs.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-background-200 bg-background-100 px-2.5 py-1.5">
              <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">{label}</dt>
              <dd className="mt-0.5 truncate font-semibold text-foreground-900">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      {(avariasItens > 0 || novasAvarias > 0) && (
        <ul className="flex flex-col gap-1 rounded-md bg-danger-50 px-3 py-2 text-[11px] text-danger-900">
          {itemList
            .filter((item) => itemState(item.key).result === "avaria")
            .map((item) => (
              <li key={item.key}>
                <i className="ri-error-warning-line"></i> <strong>{item.label}:</strong> {itemState(item.key).observation}
              </li>
            ))}
          {damages
            .filter((item) => !item.preexisting)
            .map((item) => (
              <li key={item.id}>
                <i className="ri-map-pin-2-line"></i> <strong>{item.zoneLabel}:</strong> {damageTypeMeta[item.type]?.label} (
                {severityMeta[item.severity]?.label.toLowerCase()}){item.description ? ` — ${item.description}` : ""}
              </li>
            ))}
        </ul>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground-700">Observações</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
          className={`${inputClass} min-h-[60px] resize-y`}
          placeholder="Acessórios entregues, destino, combinação de uso..."
        ></textarea>
      </label>
      <label
        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-2 px-3.5 py-3 ${
          declaration ? "border-primary-400 bg-primary-50" : "border-background-300 bg-background-50"
        }`}
      >
        <input
          type="checkbox"
          checked={declaration}
          onChange={(event) => setDeclaration(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[oklch(var(--primary-500))]"
        />
        <span className="text-xs leading-relaxed text-foreground-800">
          Declaro que conferi o veículo <strong>{vehicle.plate}</strong> junto com <strong>{conferenteName || "o conferente"}</strong>{" "}
          e que as informações, avarias e fotos registradas correspondem ao estado do veículo neste momento.
          {kind === "entrega" ? " Assumo o veículo como condutor responsável até a devolução." : ""}
        </span>
      </label>
    </div>
  );

  const successView = saved && (
    <div className="flex flex-col items-center px-2 py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
        <i className="ri-checkbox-circle-fill text-4xl"></i>
      </span>
      <h3 className="mt-3 font-heading text-xl font-extrabold text-foreground-950">
        {saved.kind === "entrega" ? "Retirada registrada" : "Devolução registrada"}
      </h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-foreground-600">{saved.detail}</p>
      <div className="mt-4">
        <PlatePill plate={saved.plate} size="lg" />
      </div>
      <dl className="mt-5 grid w-full max-w-lg grid-cols-2 gap-2 text-left sm:grid-cols-4">
        {[
          ["Protocolo", saved.ref || "—"],
          ["Km rodados", saved.km !== null ? `${saved.km.toLocaleString("pt-BR")} km` : "—"],
          ["Avarias novas", String(saved.avarias)],
          ["Reparos", String(saved.reparos)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-background-200 bg-background-100 px-2.5 py-1.5">
            <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">{label}</dt>
            <dd className="mt-0.5 truncate font-mono text-xs font-bold text-foreground-900">{value}</dd>
          </div>
        ))}
      </dl>
      {saved.reparos > 0 && (
        <p className="mt-4 max-w-md text-[11px] text-foreground-500">
          <i className="ri-tools-line"></i> As solicitações de reparo foram enviadas para a gestão da frota.
        </p>
      )}
    </div>
  );

  const body: Record<StepKey, ReactNode> = {
    veiculo: stepVeiculo,
    identificacao: stepIdentificacao,
    conferencia: stepConferencia,
    avarias: (
      <DamageStep
        kind={diagramKind}
        damages={damages}
        onChange={setDamages}
        dismissed={dismissed}
        onDismissedChange={setDismissed}
        urls={urls}
        uploading={uploading}
        upload={(file) => upload(file)}
        requestCamera={requestCamera}
      />
    ),
    fotos: stepFotos,
    reparos: stepReparos,
    revisao: resumo,
  };

  return (
    <>
      <div
        data-modal-overlay=""
        className="fixed inset-0 z-[60] flex items-stretch justify-center bg-foreground-950/50 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label={kind === "entrega" ? "Check-in de retirada" : "Check-in de devolução"}
      >
        <div className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden bg-background-50 sm:h-auto sm:max-h-[94vh] sm:rounded-xl sm:border sm:border-background-200 sm:shadow-xl">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-3 border-b border-background-200 px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-background-50">
                <i className={`${kind === "entrega" ? "ri-key-2-line" : "ri-parking-box-line"} text-lg`}></i>
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-base font-bold tracking-tight text-foreground-950 md:text-lg">
                  Check-in de segurança · {kind === "entrega" ? "Retirada" : "Devolução"}
                </h2>
                <p className="truncate text-[11px] text-foreground-500">
                  {vehicle ? `${vehicle.plate} · ${[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.category}` : "Escolha o veículo para começar"}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={close}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-900"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>

          {/* Etapas */}
          {!saved && (
            <nav aria-label="Etapas do check-in" className="border-b border-background-200 bg-background-100 px-3 py-2.5 md:px-6">
              <ol className="flex items-center gap-1 overflow-x-auto">
                {STEPS.map((item, index) => {
                  const done = index < step;
                  const active = index === step;
                  const reachable = index <= maxStep;
                  return (
                    <li key={item.key} className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        disabled={!reachable}
                        aria-current={active ? "step" : undefined}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                          active
                            ? "bg-primary-500 text-background-50"
                            : done
                              ? "cursor-pointer bg-primary-100 text-primary-800 hover:bg-primary-200"
                              : reachable
                                ? "cursor-pointer text-foreground-700 hover:bg-background-200"
                                : "text-foreground-400"
                        }`}
                      >
                        <i className={done ? "ri-check-line" : item.icon}></i>
                        <span className={active ? "" : "hidden md:inline"}>{item.label}</span>
                      </button>
                      {index < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-background-300"></span>}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-background-200">
                <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}></div>
              </div>
            </nav>
          )}

          {confirmDiscard && !saved && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-200 bg-accent-50 px-4 py-2.5 md:px-6">
              <p className="text-xs font-semibold text-accent-900">
                <i className="ri-error-warning-line"></i> Descartar este check-in? O que foi preenchido será perdido.
              </p>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="cursor-pointer rounded-md border border-background-300 bg-background-50 px-3 py-1 text-xs font-semibold text-foreground-700"
                >
                  Continuar preenchendo
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-md bg-danger-600 px-3 py-1 text-xs font-semibold text-background-50"
                >
                  Descartar
                </button>
              </span>
            </div>
          )}

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 md:px-6">
            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-xs font-medium text-danger-800">
                <i className="ri-error-warning-line mt-0.5 text-sm"></i>
                <span>{error}</span>
              </p>
            )}
            {saved ? successView : body[current]}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between gap-3 border-t border-background-200 bg-background-50 px-4 py-3 md:px-6">
            {saved ? (
              <>
                <span></span>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600"
                >
                  <i className="ri-check-line"></i>
                  Concluir
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => (step === 0 ? close() : goTo(step - 1))}
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground-600 hover:bg-background-100"
                >
                  <i className="ri-arrow-left-line"></i>
                  {step === 0 ? "Cancelar" : "Voltar"}
                </button>
                <span className="hidden text-[11px] font-semibold text-foreground-400 sm:inline">
                  Etapa {step + 1} de {STEPS.length}
                </span>
                {current === "revisao" ? (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={saving || uploading}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
                  >
                    <i className={saving ? "ri-loader-4-line animate-spin" : "ri-shield-check-line"}></i>
                    {saving ? "Registrando..." : kind === "entrega" ? "Confirmar retirada" : "Confirmar devolução"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={next}
                    disabled={uploading}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
                  >
                    Continuar
                    <i className="ri-arrow-right-line"></i>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <CameraCaptureModal
        open={Boolean(camera)}
        title={camera?.title ?? "Foto"}
        subtitle="A foto fica gravada no check-in como evidência do estado do veículo."
        onClose={() => setCamera(null)}
        onCapture={async (file) => {
          const target = camera;
          setCamera(null);
          if (target) await target.onFile(file);
        }}
      />
    </>
  );
}
