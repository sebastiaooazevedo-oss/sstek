import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  checkinConditionItems,
  openDeliveryFor,
  type CheckinItem,
  type CheckinItemResult,
  type CheckinKind,
  type Vehicle,
  type VehicleCheckin,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { registrarCheckin, uploadVehicleFile } from "@/pages/app/modules/veiculos/vehiclesStore";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";
import CameraCaptureModal from "@/components/base/CameraCaptureModal";

interface Props {
  open: boolean;
  vehicles: Vehicle[];
  checkins: VehicleCheckin[];
  initialVehicleRef: string | null;
  initialKind: CheckinKind;
  /** Nome do colaborador logado — ele assume o veículo na retirada. */
  currentUserName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface ItemState {
  result: CheckinItemResult;
  observation: string;
}

const blankItems = (): Record<string, ItemState> => {
  const map: Record<string, ItemState> = {};
  checkinConditionItems.forEach((item) => {
    map[item.key] = { result: "conforme", observation: "" };
  });
  return map;
};

export default function CheckinModal({
  open,
  vehicles,
  checkins,
  initialVehicleRef,
  initialKind,
  currentUserName,
  onClose,
  onSaved,
}: Props) {
  const [vehicleRef, setVehicleRef] = useState("");
  const [kind, setKind] = useState<CheckinKind>(initialKind);
  const [responsibleDocument, setResponsibleDocument] = useState("");
  const [responsibleRole, setResponsibleRole] = useState("");
  const [conferenteName, setConferenteName] = useState("");
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Record<string, ItemState>>(blankItems);
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status !== "inativo"),
    [vehicles]
  );
  const vehicle = activeVehicles.find((item) => item.ref === vehicleRef) ?? null;
  const openDelivery = vehicle ? openDeliveryFor(checkins, vehicle.ref) : null;
  const urls = useVehicleFileUrls(photos);

  /**
   * Condutor responsável é derivado, não digitado:
   * - retirada: o colaborador logado que executou o checklist assume o veículo;
   * - devolução: quem estava com o veículo até aquele momento.
   */
  const responsibleName =
    kind === "entrega" ? currentUserName.trim() : (openDelivery?.responsibleName ?? "").trim();

  useEffect(() => {
    if (!open) return;
    const preset =
      initialVehicleRef && activeVehicles.some((item) => item.ref === initialVehicleRef)
        ? initialVehicleRef
        : activeVehicles[0]?.ref ?? "";
    setVehicleRef(preset);
    const presetVehicle = activeVehicles.find((item) => item.ref === preset) ?? null;
    const delivery = presetVehicle ? openDeliveryFor(checkins, presetVehicle.ref) : null;
    setKind(delivery ? "devolucao" : initialKind);
    setOdometer(presetVehicle && presetVehicle.odometer !== null ? String(presetVehicle.odometer) : "");
    setResponsibleDocument("");
    setResponsibleRole("");
    setConferenteName("");
    setFuelLevel("");
    setNotes("");
    setItems(blankItems());
    setPhotos([]);
    setError("");
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialVehicleRef, initialKind]);

  const changeVehicle = (ref: string) => {
    setVehicleRef(ref);
    const target = activeVehicles.find((item) => item.ref === ref) ?? null;
    const delivery = target ? openDeliveryFor(checkins, target.ref) : null;
    setKind(delivery ? "devolucao" : "entrega");
    setOdometer(target && target.odometer !== null ? String(target.odometer) : "");
  };

  const patchItem = (key: string, values: Partial<ItemState>) =>
    setItems((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { result: "conforme", observation: "" }), ...values } }));

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    const uploaded: string[] = [];
    let failure = "";
    for (const file of files.slice(0, 4)) {
      if (!file.type.startsWith("image/")) {
        failure = "Apenas imagens são aceitas no check-in.";
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        failure = "Imagem acima de 8 MB. Reduza a foto e tente novamente.";
        continue;
      }
      const result = await uploadVehicleFile(file);
      if (!result) {
        failure = "Falha no envio da foto. Verifique a conexão e tente novamente.";
        continue;
      }
      uploaded.push(result.path);
    }
    setUploading(false);
    if (uploaded.length > 0) setPhotos((prev) => [...prev, ...uploaded].slice(0, 6));
    if (failure) setError(failure);
  };

  const attach = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
  };

  const submit = async () => {
    setError("");
    if (!vehicle) {
      setError("Selecione o veículo do check-in.");
      return;
    }
    if (kind === "entrega" && openDelivery) {
      setError("Este veículo já tem uma entrega em aberto. Registre a devolução primeiro.");
      return;
    }
    if (kind === "devolucao" && !openDelivery) {
      setError("Este veículo não tem entrega em aberto. Registre a entrega primeiro.");
      return;
    }
    if (responsibleName.length < 3) {
      setError(
        kind === "entrega"
          ? "Não foi possível identificar você como condutor responsável. Saia e entre novamente no sistema."
          : "O condutor responsável da retirada em aberto não foi encontrado. Abra a ficha do veículo e confira o histórico."
      );
      return;
    }
    if (conferenteName.trim().length < 3) {
      setError("A dupla conferência exige o nome do conferente da empresa.");
      return;
    }
    const odometerValue = odometer.trim() === "" ? null : Number(odometer);
    if (odometerValue === null || !Number.isInteger(odometerValue) || odometerValue < 0) {
      setError("Informe o hodômetro do veículo (número inteiro).");
      return;
    }
    if (openDelivery && kind === "devolucao" && openDelivery.odometer !== null && odometerValue < openDelivery.odometer) {
      setError(`O hodômetro da devolução não pode ser menor que o da entrega (${openDelivery.odometer} km).`);
      return;
    }
    const fuelValue = fuelLevel.trim() === "" ? null : Number(fuelLevel);
    if (fuelValue === null || !Number.isInteger(fuelValue) || fuelValue < 0 || fuelValue > 100) {
      setError("Informe o nível de combustível entre 0 e 100%.");
      return;
    }
    if (photos.length === 0) {
      setError("O check-in exige pelo menos uma foto das condições do veículo.");
      return;
    }
    const payloadItems: CheckinItem[] = checkinConditionItems.map((item) => {
      const state = items[item.key] ?? { result: "conforme", observation: "" };
      return {
        key: item.key,
        label: item.label,
        result: state.result,
        observation: state.observation.trim(),
      };
    });
    const withoutNote = payloadItems.find((item) => item.result === "avaria" && item.observation.length < 5);
    if (withoutNote) {
      setError(`Descreva a avaria encontrada em “${withoutNote.label}”.`);
      return;
    }

    setSaving(true);
    const result = await registrarCheckin({
      vehicleRef: vehicle.ref,
      kind,
      responsibleName,
      responsibleDocument: responsibleDocument.trim(),
      responsibleRole: responsibleRole.trim(),
      conferenteName: conferenteName.trim(),
      odometer: odometerValue,
      fuelLevel: fuelValue,
      items: payloadItems,
      photos,
      notes: notes.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível registrar o check-in.");
      return;
    }
    onSaved(result.detail || "Check-in registrado.");
  };

  const avarias = checkinConditionItems.filter((item) => items[item.key]?.result === "avaria").length;

  return (
    <>
      <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={kind === "entrega" ? "ri-logout-box-r-line" : "ri-login-box-line"}
      title={kind === "entrega" ? "Checklist de retirada" : "Checklist de devolução"}
      subtitle={
        kind === "entrega"
          ? "Você está retirando o veículo pela placa: ao finalizar, o veículo fica em uso sob a sua responsabilidade como condutor responsável."
          : "Ao finalizar, o veículo volta para a empresa e fica sem condutor responsável. A retirada correspondente é encerrada."
      }
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-save-3-line" disabled={saving || uploading}>
            {saving ? "Registrando..." : kind === "entrega" ? "Confirmar retirada" : "Confirmar devolução"}
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Veículo" required>
            <select className={selectClass} value={vehicleRef} onChange={(event) => changeVehicle(event.target.value)}>
              {activeVehicles.length === 0 && <option value="">Nenhum veículo ativo</option>}
              {activeVehicles.map((item) => (
                <option key={item.ref} value={item.ref}>
                  {item.plate} · {item.model || item.category || "veículo"}
                  {openDeliveryFor(checkins, item.ref) ? " · em uso" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de checklist" required>
            <select className={selectClass} value={kind} onChange={(event) => setKind(event.target.value as CheckinKind)}>
              <option value="entrega" disabled={Boolean(openDelivery)}>
                Retirada do veículo (eu assumo como condutor)
              </option>
              <option value="devolucao" disabled={!openDelivery}>
                Devolução à empresa
              </option>
            </select>
          </Field>
        </div>

        {openDelivery ? (
          <div className="rounded-lg border border-accent-200 bg-accent-50 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-accent-900">
              <i className="ri-user-follow-line"></i>
              Veículo em uso — condutor responsável: {openDelivery.responsibleName || "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-accent-800">
              Entregue em {openDelivery.performedAt ? new Date(openDelivery.performedAt).toLocaleString("pt-BR") : "—"}
              {openDelivery.odometer !== null && ` · ${openDelivery.odometer.toLocaleString("pt-BR")} km`}
              {openDelivery.fuelLevel !== null && ` · tanque ${openDelivery.fuelLevel}%`}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-background-300 bg-background-100 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground-800">
              <i className="ri-information-line"></i>
              Sem condutor responsável
            </p>
            <p className="mt-0.5 text-[11px] text-foreground-600">
              O veículo está na empresa. Ao finalizar a retirada, você passa a constar como condutor responsável.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Condutor responsável"
            required
            hint={
              kind === "entrega"
                ? "Definido automaticamente: quem executa o checklist de retirada assume o veículo."
                : "Quem estava com o veículo. Ao finalizar, o veículo fica sem condutor responsável."
            }
          >
            <div className="relative">
              <i className="ri-user-star-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
              <input
                className={`${inputClass} cursor-not-allowed bg-background-100 pl-9 font-semibold text-foreground-800`}
                value={responsibleName || "—"}
                readOnly
                aria-readonly="true"
              />
            </div>
          </Field>
          <Field label="CPF do condutor" hint="Opcional. Se você estiver cadastrado como colaborador, preenchemos automaticamente.">
            <input
              className={inputClass}
              value={responsibleDocument}
              onChange={(event) => setResponsibleDocument(event.target.value.slice(0, 40))}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Cargo / vínculo do condutor">
            <input
              className={inputClass}
              value={responsibleRole}
              onChange={(event) => setResponsibleRole(event.target.value.slice(0, 80))}
              placeholder="Ex.: motorista, técnico de campo"
            />
          </Field>
          <Field label="Conferente da empresa" required hint="Segunda pessoa da dupla conferência.">
            <input
              className={inputClass}
              value={conferenteName}
              onChange={(event) => setConferenteName(event.target.value.slice(0, 120))}
              placeholder="Nome de quem confere pela empresa"
            />
          </Field>
          <Field label="Hodômetro (km)" required hint="Na devolução não pode ser menor que o da entrega.">
            <input
              className={inputClass}
              value={odometer}
              onChange={(event) => setOdometer(event.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Nível de combustível (%)" required>
            <input
              className={inputClass}
              value={fuelLevel}
              onChange={(event) => setFuelLevel(event.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="0 a 100"
              inputMode="numeric"
            />
          </Field>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground-700">
            Conferência das condições <span className="text-accent-600">*</span>
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            Marque o que estiver em ordem. Toda avaria precisa de descrição.
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {checkinConditionItems.map((item) => {
              const state = items[item.key] ?? { result: "conforme", observation: "" };
              return (
                <div
                  key={item.key}
                  className={`rounded-md border px-3 py-2 ${
                    state.result === "avaria"
                      ? "border-danger-200 bg-danger-50/50"
                      : "border-background-200 bg-background-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground-800">{item.label}</span>
                    <div className="flex shrink-0 gap-1 rounded-full bg-background-100 p-1">
                      {(["conforme", "avaria"] as CheckinItemResult[]).map((option) => {
                        const active = state.result === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => patchItem(item.key, { result: option })}
                            className={`cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                              active
                                ? option === "avaria"
                                  ? "bg-danger-600 text-background-50"
                                  : "bg-primary-100 text-primary-700"
                                : "text-foreground-500 hover:text-foreground-800"
                            }`}
                          >
                            {option === "avaria" ? "Avaria" : "Conforme"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {state.result === "avaria" && (
                    <textarea
                      value={state.observation}
                      onChange={(event) => patchItem(item.key, { observation: event.target.value.slice(0, 1000) })}
                      placeholder="Descreva a avaria encontrada (obrigatório)"
                      className="mt-2 min-h-[48px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
                    ></textarea>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground-700">
            Fotos das condições <span className="text-accent-600">*</span>
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            Pelo menos uma foto é obrigatória. As imagens ficam em bucket privado com link temporário.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:border-primary-300 hover:text-primary-700"
            >
              <i className="ri-camera-line"></i>
              Tirar foto
            </button>
            <label
              htmlFor="checkin-gallery"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:border-primary-300 hover:text-primary-700"
            >
              <i className="ri-image-add-line"></i>
              Galeria / arquivo
            </label>
            <input
              id="checkin-gallery"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void attach(event.target.files);
                event.target.value = "";
              }}
            />
            {uploading && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                Enviando...
              </span>
            )}
            <span className="text-[11px] font-medium text-foreground-600">{photos.length}/6 foto(s)</span>
          </div>
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((path) => (
                <span
                  key={path}
                  className="relative h-14 w-20 overflow-hidden rounded-md border border-background-200 bg-background-200"
                >
                  {urls[path] ? (
                    <img src={urls[path]} alt="Foto do check-in" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-foreground-400">
                      <i className="ri-image-line"></i>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setPhotos((prev) => prev.filter((item) => item !== path))}
                    className="absolute right-0 top-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-bl-md bg-foreground-950/70 text-[10px] text-background-50"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Field label="Observações do checklist">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
            className={`${inputClass} min-h-[64px] resize-y`}
            placeholder="Contexto da entrega/devolução, acessórios, combinação de uso"
          ></textarea>
        </Field>

        {avarias > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-[11px] font-medium text-danger-800">
            <i className="ri-alert-line mt-0.5 text-sm"></i>
            <span>
              {avarias} avaria(s) registrada(s). Elas ficam gravadas no check-in e não podem ser excluídas depois.
            </span>
          </p>
        )}
      </div>
    </Modal>

      <CameraCaptureModal
        open={cameraOpen}
        title={kind === "entrega" ? "Foto da retirada" : "Foto da devolução"}
        subtitle="A foto é obrigatória no checklist e fica gravada como evidência das condições do veículo."
        onClose={() => setCameraOpen(false)}
        onCapture={async (file) => {
          await uploadFiles([file]);
          setCameraOpen(false);
        }}
      />
    </>
  );
}