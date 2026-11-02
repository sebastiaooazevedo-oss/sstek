import { useEffect, useRef, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  extraPhotos,
  isValidPlate,
  missingPhotoSlots,
  normalizePlateInput,
  ownershipLabels,
  photoSlotOfPath,
  photosForSlot,
  vehicleCategories,
  vehicleFuels,
  vehiclePhotoSlots,
  vehicleStatusMeta,
  vehicleStatusOptions,
  type Vehicle,
  type VehicleOwnership,
  type VehicleStatus,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { salvarVeiculo, uploadVehicleFile } from "@/pages/app/modules/veiculos/vehiclesStore";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";

interface Props {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  plate: string;
  renavam: string;
  chassis: string;
  brand: string;
  model: string;
  year: string;
  category: string;
  fuel: string;
  internalCode: string;
  establishment: string;
  costCenter: string;
  ownership: VehicleOwnership;
  ownerName: string;
  tankCapacity: string;
  odometer: string;
  notes: string;
  status: VehicleStatus;
  photos: string[];
}

const emptyForm = (): FormState => ({
  plate: "",
  renavam: "",
  chassis: "",
  brand: "",
  model: "",
  year: "",
  category: "Leve",
  fuel: "Diesel S10",
  internalCode: "",
  establishment: "",
  costCenter: "",
  ownership: "proprio",
  ownerName: "",
  tankCapacity: "",
  odometer: "",
  notes: "",
  status: "disponivel",
  photos: [],
});

const fromVehicle = (vehicle: Vehicle): FormState => ({
  plate: vehicle.plate,
  renavam: vehicle.renavam,
  chassis: vehicle.chassis,
  brand: vehicle.brand,
  model: vehicle.model,
  year: vehicle.year === null ? "" : String(vehicle.year),
  category: vehicle.category || "Leve",
  fuel: vehicle.fuel || "Diesel S10",
  internalCode: vehicle.internalCode,
  establishment: vehicle.establishment,
  costCenter: vehicle.costCenter,
  ownership: vehicle.ownership,
  ownerName: vehicle.ownerName,
  tankCapacity: vehicle.tankCapacity === null ? "" : String(vehicle.tankCapacity),
  odometer: vehicle.odometer === null ? "" : String(vehicle.odometer),
  notes: vehicle.notes,
  status: vehicle.status,
  photos: vehicle.photos,
});

export default function VehicleFormModal({ open, vehicle, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<string | null>(null);
  const previews = useVehicleFileUrls(form.photos);
  const extras = extraPhotos(form.photos);

  useEffect(() => {
    if (!open) return;
    setForm(vehicle ? fromVehicle(vehicle) : emptyForm());
    setError("");
    setSaving(false);
    setUploadingSlot(null);
  }, [open, vehicle]);

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));

  const pickPhoto = (slotKey: string | null) => {
    pendingSlotRef.current = slotKey;
    fileRef.current?.click();
  };

  const handleUpload = async (file: File | null) => {
    const slotKey = pendingSlotRef.current;
    pendingSlotRef.current = null;
    if (!file) return;
    if (!slotKey && form.photos.length >= 6) {
      setError("Limite de 6 fotos por veículo.");
      return;
    }
    setUploadingSlot(slotKey ?? "extra");
    setError("");
    const result = await uploadVehicleFile(file, slotKey ?? "");
    setUploadingSlot(null);
    if (!result) {
      setError("Não foi possível enviar a foto. Verifique o formato do arquivo e tente novamente.");
      return;
    }
    setForm((prev) => {
      const kept = slotKey
        ? prev.photos.filter((path) => photoSlotOfPath(path) !== slotKey)
        : prev.photos;
      // Mantém as 4 laterais na ordem fixa e deixa as avulsas no fim, com teto de 6.
      const slotPaths = vehiclePhotoSlots
        .map((slot) => kept.find((path) => photoSlotOfPath(path) === slot.key))
        .filter((path): path is string => Boolean(path));
      const loose = kept.filter((path) => photoSlotOfPath(path) === null);
      const merged = slotKey ? [...slotPaths, result.path, ...loose] : [...kept, result.path];
      return { ...prev, photos: merged.slice(0, 6) };
    });
  };

  const removePhoto = (path: string) => {
    patch({ photos: form.photos.filter((item) => item !== path) });
  };

  const submit = async () => {
    setError("");
    if (!isValidPlate(form.plate)) {
      setError("Placa inválida. Use ABC1234 (padrão antigo) ou ABC1D23 (Mercosul).");
      return;
    }
    if (form.ownership !== "proprio" && !form.ownerName.trim()) {
      setError("Informe o proprietário ou a locadora do veículo.");
      return;
    }
    if (form.year && (!/^\d{4}$/.test(form.year) || Number(form.year) < 1900)) {
      setError("Ano inválido.");
      return;
    }
    if (form.odometer && (!/^\d+$/.test(form.odometer) || Number(form.odometer) < 0)) {
      setError("Hodômetro deve ser um número inteiro maior ou igual a zero.");
      return;
    }
    if (form.tankCapacity && !(Number(form.tankCapacity) > 0)) {
      setError("Capacidade do tanque deve ser maior que zero.");
      return;
    }
    const missingSides = missingPhotoSlots(form.photos);
    if (missingSides.length > 0) {
      setError(`Anexe as 4 fotos obrigatórias do veículo. Faltando: ${missingSides.join(", ")}.`);
      return;
    }

    setSaving(true);
    const result = await salvarVeiculo({
      ref: vehicle?.ref ?? "",
      plate: form.plate,
      renavam: form.renavam,
      chassis: form.chassis,
      brand: form.brand,
      model: form.model,
      year: form.year ? Number(form.year) : null,
      category: form.category,
      fuel: form.fuel,
      internalCode: form.internalCode,
      establishment: form.establishment,
      costCenter: form.costCenter,
      ownership: form.ownership,
      ownerName: form.ownerName,
      tankCapacity: form.tankCapacity ? Number(form.tankCapacity) : null,
      odometer: form.odometer ? Number(form.odometer) : null,
      photos: form.photos.slice(0, 6),
      notes: form.notes,
      status: form.status,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível salvar o veículo.");
      return;
    }
    onSaved(result.detail || "Veículo salvo.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-truck-line"
      title={vehicle ? `Editar veículo ${vehicle.plate}` : "Novo veículo"}
      subtitle="A placa identifica o veículo na tela, mas o histórico usa um ID interno — corrigir a placa não rompe documentos nem registros."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-save-3-line" disabled={saving || Boolean(uploadingSlot)}>
            {saving ? "Salvando..." : "Salvar veículo"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-xs font-medium text-danger-800">
            <i className="ri-error-warning-line mt-0.5 text-sm"></i>
            <span>{error}</span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Placa" required hint="Somente letras e números">
            <input
              className={`${inputClass} font-mono uppercase tracking-wider`}
              value={form.plate}
              onChange={(event) => patch({ plate: normalizePlateInput(event.target.value) })}
              placeholder="ABC1D23"
              maxLength={7}
            />
          </Field>
          <Field label="Renavam">
            <input
              className={inputClass}
              value={form.renavam}
              onChange={(event) => patch({ renavam: event.target.value })}
              placeholder="00000000000"
            />
          </Field>
          <Field label="Chassi">
            <input
              className={`${inputClass} font-mono uppercase`}
              value={form.chassis}
              onChange={(event) => patch({ chassis: event.target.value.toUpperCase() })}
              placeholder="9BWZZZ377VT004251"
            />
          </Field>
          <Field label="Marca">
            <input
              className={inputClass}
              value={form.brand}
              onChange={(event) => patch({ brand: event.target.value })}
              placeholder="Volkswagen"
            />
          </Field>
          <Field label="Modelo">
            <input
              className={inputClass}
              value={form.model}
              onChange={(event) => patch({ model: event.target.value })}
              placeholder="Delivery 9.170"
            />
          </Field>
          <Field label="Ano">
            <input
              className={inputClass}
              value={form.year}
              onChange={(event) => patch({ year: event.target.value.replace(/\D/g, "").slice(0, 4) })}
              placeholder="2023"
            />
          </Field>
          <Field label="Categoria">
            <select
              className={selectClass}
              value={form.category}
              onChange={(event) => patch({ category: event.target.value })}
            >
              {vehicleCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Combustível">
            <select
              className={selectClass}
              value={form.fuel}
              onChange={(event) => patch({ fuel: event.target.value })}
            >
              {vehicleFuels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Situação">
            <select
              className={selectClass}
              value={form.status}
              onChange={(event) => patch({ status: event.target.value as VehicleStatus })}
            >
              {vehicleStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {vehicleStatusMeta[item].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Identificação interna">
            <input
              className={inputClass}
              value={form.internalCode}
              onChange={(event) => patch({ internalCode: event.target.value })}
              placeholder="FROTA-07"
            />
          </Field>
          <Field label="Estabelecimento">
            <input
              className={inputClass}
              value={form.establishment}
              onChange={(event) => patch({ establishment: event.target.value })}
              placeholder="Filial Campinas"
            />
          </Field>
          <Field label="Centro de custo">
            <input
              className={inputClass}
              value={form.costCenter}
              onChange={(event) => patch({ costCenter: event.target.value })}
              placeholder="CC-4102"
            />
          </Field>
          <Field label="Propriedade">
            <select
              className={selectClass}
              value={form.ownership}
              onChange={(event) => patch({ ownership: event.target.value as VehicleOwnership })}
            >
              {(Object.keys(ownershipLabels) as VehicleOwnership[]).map((item) => (
                <option key={item} value={item}>
                  {ownershipLabels[item]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={form.ownership === "proprio" ? "Proprietário" : "Proprietário / locadora"}
            required={form.ownership !== "proprio"}
            className="md:col-span-1 lg:col-span-2"
          >
            <input
              className={inputClass}
              value={form.ownerName}
              onChange={(event) => patch({ ownerName: event.target.value })}
              placeholder={form.ownership === "proprio" ? "Opcional quando próprio" : "Razão social da locadora"}
            />
          </Field>
          <Field label="Capacidade do tanque (L)" hint="Opcional">
            <input
              className={inputClass}
              value={form.tankCapacity}
              onChange={(event) => patch({ tankCapacity: event.target.value.replace(/[^\d.]/g, "") })}
              placeholder="70"
            />
          </Field>
          <Field label="Hodômetro atual (km)">
            <input
              className={inputClass}
              value={form.odometer}
              onChange={(event) => patch({ odometer: event.target.value.replace(/\D/g, "") })}
              placeholder="48210"
            />
          </Field>
          <Field label="Observações" className="md:col-span-2 lg:col-span-3">
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={form.notes}
              onChange={(event) => patch({ notes: event.target.value.slice(0, 2000) })}
              placeholder="Informações de uso, restrições, particularidades do veículo."
            ></textarea>
          </Field>
        </div>

        <div className="rounded-lg border border-background-200 bg-background-100 p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground-800">
                Fotos das 4 laterais <span className="text-accent-600">*</span>
              </p>
              <p className="text-[11px] text-foreground-500">
                Obrigatórias no cadastro: frente, lateral esquerda, lateral direita e traseira. Arquivos ficam
                privados, com link temporário.
              </p>
            </div>
            <span className="rounded-full bg-background-200 px-2 py-1 text-[10px] font-bold text-foreground-600">
              {vehiclePhotoSlots.length - missingPhotoSlots(form.photos).length}/{vehiclePhotoSlots.length} anexadas
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vehiclePhotoSlots.map((slot) => {
              const path = photosForSlot(form.photos, slot.key)[0] ?? null;
              const busy = uploadingSlot === slot.key;
              return (
                <div
                  key={slot.key}
                  className={`overflow-hidden rounded-md border bg-background-50 ${
                    path ? "border-primary-200" : "border-dashed border-background-300"
                  }`}
                >
                  <div className="relative h-24 w-full bg-background-200">
                    {path && previews[path] ? (
                      <img
                        src={previews[path]}
                        alt={`${slot.label} do veículo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground-400">
                        <i className={`${slot.icon} text-lg`}></i>
                        <span className="text-[10px] font-semibold">sem foto</span>
                      </span>
                    )}
                    {path && (
                      <button
                        type="button"
                        aria-label={`Remover foto da ${slot.label}`}
                        onClick={() => removePhoto(path)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-foreground-950/70 text-background-50 transition-colors hover:bg-danger-700"
                      >
                        <i className="ri-close-line text-xs"></i>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-foreground-800">{slot.label}</p>
                      <p className="truncate text-[10px] text-foreground-500">{slot.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => pickPhoto(slot.key)}
                      disabled={Boolean(uploadingSlot)}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2 py-1 text-[10px] font-semibold text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <i className={busy ? "ri-loader-4-line animate-spin" : "ri-camera-line"}></i>
                      {busy ? "Enviando" : path ? "Trocar" : "Anexar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-background-200 pt-3">
            <p className="text-[11px] text-foreground-500">Fotos extras (opcional, até 2) — danos, placa, odômetro.</p>
            <button
              type="button"
              onClick={() => pickPhoto(null)}
              disabled={Boolean(uploadingSlot) || form.photos.length >= 6}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className={uploadingSlot === "extra" ? "ri-loader-4-line animate-spin" : "ri-image-add-line"}></i>
              {uploadingSlot === "extra" ? "Enviando..." : "Adicionar foto extra"}
            </button>
          </div>

          {extras.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {extras.map((path) => (
                <div
                  key={path}
                  className="group relative h-16 w-24 overflow-hidden rounded-md border border-background-300 bg-background-200"
                >
                  {previews[path] ? (
                    <img src={previews[path]} alt="Foto extra do veículo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-foreground-400">
                      <i className="ri-image-line"></i>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Remover foto extra"
                    onClick={() => removePhoto(path)}
                    className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-foreground-950/70 text-background-50 transition-colors hover:bg-danger-700"
                  >
                    <i className="ri-close-line text-[10px]"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleUpload(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </Modal>
  );
}