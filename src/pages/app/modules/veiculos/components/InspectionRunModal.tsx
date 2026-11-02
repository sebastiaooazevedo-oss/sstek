import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  checklistsForVehicle,
  criticalityMeta,
  itemAnswerMeta,
  type ChecklistItem,
  type ChecklistTemplate,
  type ItemAnswer,
  type Vehicle,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { registrarInspecao, uploadVehicleFile } from "@/pages/app/modules/veiculos/vehiclesStore";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";
import CameraCaptureModal from "@/components/base/CameraCaptureModal";

interface Props {
  open: boolean;
  vehicles: Vehicle[];
  checklists: ChecklistTemplate[];
  initialVehicleRef: string | null;
  onClose: () => void;
  onSaved: (message: string, blocked: boolean) => void;
}

interface AnswerState {
  result: ItemAnswer;
  observation: string;
  justification: string;
  photoPaths: string[];
  correctiveAction: string;
}

const blankAnswer = (): AnswerState => ({
  result: "conforme",
  observation: "",
  justification: "",
  photoPaths: [],
  correctiveAction: "",
});

const answerOptions: ItemAnswer[] = ["conforme", "nao_conforme", "nao_aplicavel"];

export default function InspectionRunModal({
  open,
  vehicles,
  checklists,
  initialVehicleRef,
  onClose,
  onSaved,
}: Props) {
  const [vehicleRef, setVehicleRef] = useState("");
  const [templateRef, setTemplateRef] = useState("");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [itemError, setItemError] = useState<Record<string, string>>({});
  const [cameraItem, setCameraItem] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeVehicles = useMemo(
    () => vehicles.filter((vehicle) => vehicle.status !== "inativo"),
    [vehicles]
  );
  const vehicle = activeVehicles.find((item) => item.ref === vehicleRef) ?? null;
  const availableChecklists = useMemo(
    () => (vehicle ? checklistsForVehicle(checklists, vehicle.category) : []),
    [checklists, vehicle]
  );
  const template = checklists.find((item) => item.templateRef === templateRef && item.isCurrent) ?? null;
  const items = template?.items ?? [];

  const allPaths = useMemo(
    () =>
      Object.values(answers).flatMap((answer) =>
        Array.isArray(answer.photoPaths) ? answer.photoPaths : []
      ),
    [answers]
  );
  const urls = useVehicleFileUrls(allPaths);

  useEffect(() => {
    if (!open) return;
    const preset = initialVehicleRef && activeVehicles.some((item) => item.ref === initialVehicleRef)
      ? initialVehicleRef
      : activeVehicles[0]?.ref ?? "";
    setVehicleRef(preset);
    const presetVehicle = activeVehicles.find((item) => item.ref === preset) ?? null;
    const firstTemplate = presetVehicle
      ? checklistsForVehicle(checklists, presetVehicle.category)[0]
      : undefined;
    setTemplateRef(firstTemplate?.templateRef ?? "");
    setOdometer(
      presetVehicle && presetVehicle.odometer !== null ? String(presetVehicle.odometer) : ""
    );
    setNotes("");
    setAnswers({});
    setError("");
    setItemError({});
    setCameraItem(null);
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialVehicleRef]);

  useEffect(() => {
    if (!open || !template) {
      setAnswers({});
      return;
    }
    const next: Record<string, AnswerState> = {};
    template.items.forEach((item) => {
      next[item.key] = blankAnswer();
    });
    setAnswers(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateRef]);

  const patchAnswer = (itemKey: string, values: Partial<AnswerState>) =>
    setAnswers((prev) => ({
      ...prev,
      [itemKey]: { ...(prev[itemKey] ?? blankAnswer()), ...values },
    }));

  const changeVehicle = (ref: string) => {
    setVehicleRef(ref);
    const target = activeVehicles.find((item) => item.ref === ref) ?? null;
    setOdometer(target && target.odometer !== null ? String(target.odometer) : "");
    const first = target ? checklistsForVehicle(checklists, target.category)[0] : undefined;
    setTemplateRef(first?.templateRef ?? "");
  };

  const attachFiles = async (itemKey: string, files: File[]) => {
    if (files.length === 0) return;
    setItemError((prev) => ({ ...prev, [itemKey]: "" }));
    setUploadingItem(itemKey);
    const uploaded: string[] = [];
    let failure = "";
    for (const file of files.slice(0, 4)) {
      if (!file.type.startsWith("image/")) {
        failure = "Apenas imagens são aceitas neste item.";
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
    setUploadingItem(null);
    if (uploaded.length > 0) {
      setAnswers((prev) => {
        const current = prev[itemKey] ?? blankAnswer();
        const merged = [...current.photoPaths, ...uploaded].slice(0, 6);
        return { ...prev, [itemKey]: { ...current, photoPaths: merged } };
      });
    }
    if (failure) setItemError((prev) => ({ ...prev, [itemKey]: failure }));
  };

  const removePhoto = (itemKey: string, path: string) =>
    setAnswers((prev) => {
      const current = prev[itemKey] ?? blankAnswer();
      return {
        ...prev,
        [itemKey]: { ...current, photoPaths: current.photoPaths.filter((item) => item !== path) },
      };
    });

  const submit = async () => {
    setError("");
    if (!vehicle) {
      setError("Selecione o veículo inspecionado.");
      return;
    }
    if (!template) {
      setError("Selecione o modelo de checklist.");
      return;
    }
    for (const item of items) {
      const answer = answers[item.key] ?? blankAnswer();
      if (answer.result === "nao_aplicavel" && item.justificationRequired && !answer.justification.trim()) {
        setError(`O item “${item.label}” exige justificativa para ser marcado como não aplicável.`);
        return;
      }
      if (answer.result === "nao_conforme" && item.photoRequired && answer.photoPaths.length === 0) {
        setError(`O item “${item.label}” exige foto da não conformidade.`);
        return;
      }
    }

    const odometerValue = odometer.trim() === "" ? null : Number(odometer);
    if (odometerValue !== null && (!Number.isInteger(odometerValue) || odometerValue < 0)) {
      setError("Hodômetro deve ser um número inteiro maior ou igual a zero.");
      return;
    }

    setSaving(true);
    const result = await registrarInspecao({
      vehicleRef: vehicle.ref,
      templateRef: template.templateRef,
      odometer: odometerValue,
      notes: notes.trim(),
      responses: items.map((item: ChecklistItem) => {
        const answer = answers[item.key] ?? blankAnswer();
        return {
          itemKey: item.key,
          result: answer.result,
          observation: answer.observation.trim(),
          justification: answer.justification.trim(),
          photoPaths: answer.photoPaths,
          correctiveAction: answer.correctiveAction.trim(),
        };
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível registrar a inspeção.");
      return;
    }
    onSaved(result.detail || "Inspeção registrada.", result.blocked === true);
  };

  const blockingCount = items.filter((item) => {
    const answer = answers[item.key];
    return (
      answer?.result === "nao_conforme" && (item.requiresBlock || item.criticality === "critica")
    );
  }).length;

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-shield-check-line"
      title="Nova inspeção de segurança"
      subtitle="A inspeção guarda uma cópia do checklist na versão aplicada. Editar o modelo depois não altera este registro."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-save-3-line" disabled={saving || uploadingItem !== null}>
            {saving ? "Registrando..." : "Registrar inspeção"}
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Veículo" required>
            <select className={selectClass} value={vehicleRef} onChange={(event) => changeVehicle(event.target.value)}>
              {activeVehicles.length === 0 && <option value="">Nenhum veículo ativo</option>}
              {activeVehicles.map((item) => (
                <option key={item.ref} value={item.ref}>
                  {item.plate} · {item.model || item.category || "veículo"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modelo de checklist" required>
            <select
              className={selectClass}
              value={templateRef}
              onChange={(event) => setTemplateRef(event.target.value)}
            >
              {availableChecklists.length === 0 && <option value="">Nenhum modelo para a categoria</option>}
              {availableChecklists.map((item) => (
                <option key={item.templateRef} value={item.templateRef}>
                  {item.name} (v{item.version})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hodômetro (km)" hint="Não reduz o hodômetro já registrado.">
            <input
              className={inputClass}
              value={odometer}
              onChange={(event) => setOdometer(event.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field label="Observações gerais da inspeção">
          <input
            className={inputClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
            placeholder="Condições do veículo, contexto da conferência"
          />
        </Field>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center">
            <i className="ri-clipboard-line text-xl text-foreground-400"></i>
            <p className="mt-2 text-xs font-medium text-foreground-600">
              Nenhum checklist vigente para esta categoria. Crie um modelo na aba “Checklists”.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, index) => {
              const answer = answers[item.key] ?? blankAnswer();
              const uploadError = itemError[item.key] ?? "";
              return (
                <div
                  key={item.key}
                  className={`rounded-lg border p-3 ${
                    answer.result === "nao_conforme"
                      ? "border-danger-200 bg-danger-50/40"
                      : "border-background-200 bg-background-50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground-900">
                        <span className="text-foreground-400">{index + 1}.</span>
                        <span>{item.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            criticalityMeta[item.criticality]?.className ?? criticalityMeta.media.className
                          }`}
                        >
                          {criticalityMeta[item.criticality]?.label ?? "Média"}
                        </span>
                        {item.photoRequired && (
                          <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-600">
                            foto obrigatória
                          </span>
                        )}
                        {(item.requiresBlock || item.criticality === "critica") && (
                          <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
                            bloqueia se não conforme
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 rounded-full bg-background-100 p-1">
                      {answerOptions.map((option) => {
                        const meta = itemAnswerMeta[option];
                        const active = answer.result === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => patchAnswer(item.key, { result: option })}
                            className={`cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                              active ? meta.className : "text-foreground-500 hover:text-foreground-800"
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {answer.result === "nao_aplicavel" && (
                    <input
                      className={`${inputClass} mt-2 text-xs`}
                      value={answer.justification}
                      onChange={(event) =>
                        patchAnswer(item.key, { justification: event.target.value.slice(0, 500) })
                      }
                      placeholder={
                        item.justificationRequired
                          ? "Justificativa obrigatória para não aplicável"
                          : "Justificativa (opcional)"
                      }
                    />
                  )}

                  {answer.result === "nao_conforme" && (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        value={answer.observation}
                        onChange={(event) =>
                          patchAnswer(item.key, { observation: event.target.value.slice(0, 1000) })
                        }
                        placeholder="Descreva a não conformidade encontrada"
                        className="min-h-[56px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
                      ></textarea>
                      <input
                        className={`${inputClass} text-xs`}
                        value={answer.correctiveAction}
                        onChange={(event) =>
                          patchAnswer(item.key, { correctiveAction: event.target.value.slice(0, 1000) })
                        }
                        placeholder="Ação corretiva recomendada"
                      />
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraItem(item.key)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                    >
                      <i className="ri-camera-line"></i>
                      Tirar foto
                    </button>
                    <label
                      htmlFor={`gal-${item.key}`}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                    >
                      <i className="ri-image-add-line"></i>
                      Galeria / arquivo
                    </label>
                    <input
                      id={`gal-${item.key}`}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        void attachFiles(item.key, Array.from(event.target.files ?? []));
                        event.target.value = "";
                      }}
                    />
                    {uploadingItem === item.key && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-foreground-500">
                        <i className="ri-loader-4-line animate-spin"></i>
                        Enviando...
                      </span>
                    )}
                    {answer.photoPaths.map((path) => (
                      <span
                        key={path}
                        className="group relative h-12 w-16 overflow-hidden rounded-md border border-background-200 bg-background-200"
                      >
                        {urls[path] ? (
                          <img src={urls[path]} alt="Evidência da inspeção" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-foreground-400">
                            <i className="ri-image-line"></i>
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="Remover foto"
                          onClick={() => removePhoto(item.key, path)}
                          className="absolute right-0 top-0 flex h-5 w-5 cursor-pointer items-center justify-center rounded-bl-md bg-foreground-950/70 text-[10px] text-background-50"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      </span>
                    ))}
                  </div>

                  {uploadError && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-danger-700">
                      <i className="ri-error-warning-line mt-0.5"></i>
                      {uploadError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {blockingCount > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-[11px] font-medium text-danger-800">
            <i className="ri-lock-line mt-0.5 text-sm"></i>
            <span>
              {blockingCount} item(ns) marcado(s) como não conforme com regra de bloqueio. Ao registrar, o
              veículo será bloqueado automaticamente e a liberação exigirá perfil autorizado, justificativa e
              evidência.
            </span>
          </p>
        )}
      </div>
    </Modal>

      <CameraCaptureModal
        open={cameraItem !== null}
        title="Foto da inspeção"
        subtitle="A foto fica anexada ao item conferido, com autor e data/hora."
        onClose={() => setCameraItem(null)}
        onCapture={async (file) => {
          const itemKey = cameraItem;
          if (!itemKey) return;
          await attachFiles(itemKey, [file]);
          setCameraItem(null);
        }}
      />
    </>
  );
}