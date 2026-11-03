import { useState } from "react";
import { validarAvaria } from "@shared/checkin";
import type { CheckinDamage, DamageSeverity, DamageType } from "@/pages/app/modules/veiculos/vehicleTypes";
import VehicleIllustration from "@/pages/app/modules/veiculos/checkin/VehicleIllustration";
import { damageTypeMeta, severityMeta } from "@/pages/app/modules/veiculos/checkin/checkinRules";
import { PhotoButtons, PhotoThumb } from "@/pages/app/modules/veiculos/checkin/checkinUi";
import type { DiagramKind } from "@/pages/app/modules/veiculos/checkin/vehicleDiagrams";

interface Props {
  kind: DiagramKind;
  damages: CheckinDamage[];
  onChange: (damages: CheckinDamage[]) => void;
  /** Avarias do check-in anterior que o condutor marcou como não encontradas. */
  dismissed: CheckinDamage[];
  onDismissedChange: (list: CheckinDamage[]) => void;
  urls: Record<string, string>;
  uploading: boolean;
  upload: (file: File) => Promise<string | null>;
  requestCamera: (title: string, onFile: (file: File) => Promise<void>) => void;
}

const newId = () => `av-${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;

export default function DamageStep({
  kind,
  damages,
  onChange,
  dismissed,
  onDismissedChange,
  urls,
  uploading,
  upload,
  requestCamera,
}: Props) {
  const [draft, setDraft] = useState<CheckinDamage | null>(null);
  const [draftIndex, setDraftIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  const startDraft = (zone: string, zoneLabel: string) => {
    setError("");
    setDraftIndex(null);
    setDraft({
      id: newId(),
      zone,
      zoneLabel,
      type: "risco",
      severity: "leve",
      description: "",
      photo: "",
      preexisting: false,
      repair: false,
    });
  };

  const editAt = (index: number) => {
    const damage = damages[index];
    if (!damage) return;
    if (damage.preexisting) {
      // Marcador antigo: tocar nele registra uma avaria nova na mesma área.
      startDraft(damage.zone, damage.zoneLabel);
      return;
    }
    setError("");
    setDraftIndex(index);
    setDraft({ ...damage });
  };

  const saveDraft = () => {
    if (!draft) return;
    const message = validarAvaria(draft, (draftIndex ?? damages.length) + 1);
    if (message) {
      setError(message);
      return;
    }
    const cleaned = { ...draft, description: draft.description.trim() };
    onChange(draftIndex === null ? [...damages, cleaned] : damages.map((item, i) => (i === draftIndex ? cleaned : item)));
    setDraft(null);
    setDraftIndex(null);
  };

  const removeAt = (index: number) => {
    const damage = damages[index];
    onChange(damages.filter((_, i) => i !== index));
    if (damage?.preexisting) onDismissedChange([...dismissed, damage]);
    if (draftIndex === index) {
      setDraft(null);
      setDraftIndex(null);
    }
  };

  const restore = (damage: CheckinDamage) => {
    onDismissedChange(dismissed.filter((item) => item.id !== damage.id));
    onChange([...damages, damage]);
  };

  const attach = async (file: File) => {
    const path = await upload(file);
    if (path) setDraft((prev) => (prev ? { ...prev, photo: path } : prev));
  };

  const novas = damages.filter((item) => !item.preexisting).length;
  const antigas = damages.length - novas;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="rounded-xl border border-background-200 bg-background-100 p-3">
        <div className="mx-auto aspect-[240/440] w-full max-w-[260px]">
          <VehicleIllustration
            kind={kind}
            damages={damages}
            selectedZone={draft?.zone ?? null}
            onZoneClick={startDraft}
            onPinClick={editAt}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-foreground-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary-600"></span>Leve
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-500"></span>Moderada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-danger-600"></span>Grave
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground-500"></span>Pré-existente
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {!draft && (
          <div className="flex items-start gap-2.5 rounded-lg border border-primary-200 bg-primary-50 px-3.5 py-3">
            <i className="ri-cursor-line mt-0.5 text-base text-primary-700"></i>
            <p className="text-xs leading-relaxed text-primary-900">
              <strong>Toque na área do desenho</strong> onde encontrou risco, amassado, peça quebrada ou faltando. Cada
              avaria nova precisa de foto. Se não houver avaria nova, é só continuar.
            </p>
          </div>
        )}

        {draft && (
          <div className="rounded-xl border-2 border-primary-300 bg-background-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary-700">
                  {draftIndex === null ? "Nova avaria" : `Editar avaria ${draftIndex + 1}`}
                </p>
                <p className="font-heading text-base font-bold text-foreground-950">{draft.zoneLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setDraftIndex(null);
                  setError("");
                }}
                className="cursor-pointer rounded-md px-2 py-1 text-xs font-semibold text-foreground-500 hover:bg-background-100"
              >
                Cancelar
              </button>
            </div>

            {error && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md bg-danger-100 px-2.5 py-2 text-[11px] font-medium text-danger-800">
                <i className="ri-error-warning-line mt-px"></i>
                {error}
              </p>
            )}

            <p className="mt-3 text-[11px] font-semibold text-foreground-700">Tipo</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.keys(damageTypeMeta) as DamageType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDraft({ ...draft, type })}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    draft.type === type
                      ? "border-primary-500 bg-primary-500 text-background-50"
                      : "border-background-300 bg-background-50 text-foreground-700 hover:border-primary-300"
                  }`}
                >
                  <i className={damageTypeMeta[type].icon}></i>
                  {damageTypeMeta[type].label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] font-semibold text-foreground-700">Gravidade</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(Object.keys(severityMeta) as DamageSeverity[]).map((severity) => (
                <button
                  key={severity}
                  type="button"
                  onClick={() => setDraft({ ...draft, severity })}
                  className={`cursor-pointer rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                    draft.severity === severity
                      ? `${severityMeta[severity].className} border-current`
                      : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300"
                  }`}
                >
                  {severityMeta[severity].label}
                </button>
              ))}
            </div>

            <label className="mt-3 block">
              <span className="text-[11px] font-semibold text-foreground-700">
                Descrição {draft.severity === "grave" && <span className="text-accent-600">*</span>}
              </span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value.slice(0, 500) })}
                placeholder="Ex.: risco de 10 cm na porta, sem atingir a pintura de fundo"
                className="mt-1 min-h-[56px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
              ></textarea>
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {draft.photo ? (
                <PhotoThumb
                  url={urls[draft.photo]}
                  alt="Foto da avaria"
                  onRemove={() => setDraft({ ...draft, photo: "" })}
                />
              ) : (
                <span className="flex h-16 w-20 items-center justify-center rounded-md border-2 border-dashed border-danger-300 text-danger-500">
                  <i className="ri-camera-off-line text-lg"></i>
                </span>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-foreground-700">
                  Foto da avaria <span className="text-accent-600">*</span>
                </span>
                <PhotoButtons
                  compact
                  disabled={uploading}
                  onCamera={() => requestCamera(`Avaria: ${draft.zoneLabel}`, attach)}
                  onFiles={(files) => void attach(files[0])}
                />
                {uploading && (
                  <span className="text-[10.5px] text-foreground-500">
                    <i className="ri-loader-4-line animate-spin"></i> Enviando...
                  </span>
                )}
              </div>
            </div>

            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md bg-accent-50 px-3 py-2">
              <input
                type="checkbox"
                checked={draft.repair}
                onChange={(event) => setDraft({ ...draft, repair: event.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[oklch(var(--primary-500))]"
              />
              <span className="text-[11px] leading-relaxed text-accent-900">
                <strong>Solicitar reparo desta avaria.</strong> O pedido vai para a gestão da frota com a foto e fica
                acompanhado até a conclusão.
              </span>
            </label>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={saveDraft}
                disabled={uploading}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
              >
                <i className="ri-map-pin-add-line"></i>
                {draftIndex === null ? "Marcar avaria" : "Salvar avaria"}
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-foreground-800">
            Avarias marcadas{" "}
            <span className="font-medium text-foreground-500">
              ({novas} nova{novas === 1 ? "" : "s"}
              {antigas > 0 ? ` · ${antigas} pré-existente${antigas === 1 ? "" : "s"}` : ""})
            </span>
          </p>
          {damages.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-background-300 px-3 py-4 text-center text-[11px] text-foreground-500">
              Nenhuma avaria marcada.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {damages.map((damage, index) => (
                <li
                  key={damage.id}
                  className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 ${
                    damage.preexisting ? "border-background-200 bg-background-100" : "border-danger-200 bg-danger-50/40"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-background-50 ${
                      damage.preexisting
                        ? "bg-foreground-500"
                        : damage.severity === "grave"
                          ? "bg-danger-600"
                          : damage.severity === "moderada"
                            ? "bg-accent-500"
                            : "bg-secondary-600"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {damage.photo && <PhotoThumb url={urls[damage.photo]} alt="Foto da avaria" className="h-9 w-12" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground-900">{damage.zoneLabel}</p>
                    <p className="truncate text-[10.5px] text-foreground-500">
                      {damageTypeMeta[damage.type]?.label} · {severityMeta[damage.severity]?.label}
                      {damage.preexisting ? " · já registrada no check-in anterior" : ""}
                      {damage.repair ? " · reparo solicitado" : ""}
                      {damage.description ? ` · ${damage.description}` : ""}
                    </p>
                  </div>
                  {!damage.preexisting && (
                    <button
                      type="button"
                      onClick={() => editAt(index)}
                      aria-label={`Editar avaria ${index + 1}`}
                      className="cursor-pointer rounded-md p-1 text-foreground-500 hover:bg-background-200 hover:text-foreground-900"
                    >
                      <i className="ri-edit-line"></i>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    title={damage.preexisting ? "Não encontrei esta avaria (já foi reparada)" : "Remover avaria"}
                    aria-label={damage.preexisting ? `Avaria ${index + 1} não encontrada` : `Remover avaria ${index + 1}`}
                    className="cursor-pointer whitespace-nowrap rounded-md p-1 text-[10.5px] font-semibold text-foreground-500 hover:bg-background-200 hover:text-danger-700"
                  >
                    {damage.preexisting ? "Não encontrei" : <i className="ri-delete-bin-line"></i>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dismissed.length > 0 && (
            <div className="mt-2 rounded-md bg-background-100 px-3 py-2 text-[10.5px] text-foreground-600">
              Marcadas como não encontradas:{" "}
              {dismissed.map((damage) => (
                <button
                  key={damage.id}
                  type="button"
                  onClick={() => restore(damage)}
                  className="mr-1.5 cursor-pointer font-semibold text-primary-700 underline"
                >
                  {damage.zoneLabel} (desfazer)
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
