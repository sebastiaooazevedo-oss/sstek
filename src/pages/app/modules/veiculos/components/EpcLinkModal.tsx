import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import type { EpcKind, Vehicle } from "@/pages/app/modules/veiculos/vehicleTypes";
import { vincularEpc, type EpiSource } from "@/pages/app/modules/veiculos/vehiclesStore";

interface Props {
  open: boolean;
  vehicles: Vehicle[];
  epiSources: EpiSource[];
  initialVehicleRef: string | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function EpcLinkModal({
  open,
  vehicles,
  epiSources,
  initialVehicleRef,
  onClose,
  onSaved,
}: Props) {
  const [vehicleRef, setVehicleRef] = useState("");
  const [kind, setKind] = useState<EpcKind>("epc");
  const [sourceRef, setSourceRef] = useState("");
  const [epiName, setEpiName] = useState("");
  const [epiCa, setEpiCa] = useState("");
  const [identification, setIdentification] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeVehicles = useMemo(() => vehicles.filter((item) => item.status !== "inativo"), [vehicles]);

  useEffect(() => {
    if (!open) return;
    setVehicleRef(
      initialVehicleRef && activeVehicles.some((item) => item.ref === initialVehicleRef)
        ? initialVehicleRef
        : activeVehicles[0]?.ref ?? ""
    );
    setKind("epc");
    setSourceRef("");
    setEpiName("");
    setEpiCa("");
    setIdentification("");
    setQuantity("1");
    setNotes("");
    setError("");
    setSaving(false);
  }, [open, initialVehicleRef, activeVehicles]);

  const pickSource = (ref: string) => {
    setSourceRef(ref);
    const source = epiSources.find((item) => `${item.deliveryRef}::${item.name}` === ref);
    if (!source) return;
    setEpiName(source.name);
    setEpiCa(source.ca);
    setQuantity(String(source.quantity || 1));
  };

  const submit = async () => {
    setError("");
    if (!vehicleRef) {
      setError("Selecione o veículo.");
      return;
    }
    if (!epiName.trim()) {
      setError("Informe o equipamento ou acessório.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      setError("Quantidade deve ser um inteiro entre 1 e 999.");
      return;
    }
    setSaving(true);
    const selected = epiSources.find((item) => `${item.deliveryRef}::${item.name}` === sourceRef);
    const result = await vincularEpc({
      vehicleRef,
      kind,
      epiName: epiName.trim(),
      epiCa: epiCa.trim(),
      identification: identification.trim(),
      quantity: qty,
      source: selected ? "epi_delivery" : "manual",
      sourceRef: selected ? selected.deliveryRef : "",
      notes: notes.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.detail || result.error || "Não foi possível vincular o equipamento.");
      return;
    }
    onSaved(result.detail || "Equipamento vinculado.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-links-line"
      title="Vincular EPC ou acessório ao veículo"
      subtitle="Reaproveita as entregas de EPI já registradas. Um mesmo equipamento identificado não pode ficar ativo em dois veículos ao mesmo tempo."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={submit} icon="ri-link" disabled={saving}>
            {saving ? "Vinculando..." : "Vincular"}
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
            <select className={selectClass} value={vehicleRef} onChange={(event) => setVehicleRef(event.target.value)}>
              {activeVehicles.length === 0 && <option value="">Nenhum veículo ativo</option>}
              {activeVehicles.map((item) => (
                <option key={item.ref} value={item.ref}>
                  {item.plate} · {item.model || item.category || "veículo"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Classificação" hint="Nem todo item transportado é EPC.">
            <select
              className={selectClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as EpcKind)}
            >
              <option value="epc">EPC (equipamento de proteção coletiva)</option>
              <option value="acessorio">Acessório / item veicular</option>
            </select>
          </Field>
        </div>

        <Field
          label="Origem (entrega de EPI)"
          hint="Opcional. Selecionar aqui mantém o vínculo com o registro de entrega já existente."
        >
          <select className={selectClass} value={sourceRef} onChange={(event) => pickSource(event.target.value)}>
            <option value="">Preencher manualmente</option>
            {epiSources.slice(0, 80).map((item) => (
              <option key={`${item.deliveryRef}::${item.name}`} value={`${item.deliveryRef}::${item.name}`}>
                {item.name}
                {item.ca ? ` · CA ${item.ca}` : ""} · {item.collaboratorName || "sem colaborador"}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Equipamento / acessório" required>
            <input
              className={inputClass}
              value={epiName}
              onChange={(event) => setEpiName(event.target.value.slice(0, 160))}
              placeholder="Ex.: Cones de sinalização"
            />
          </Field>
          <Field label="CA / certificado">
            <input
              className={inputClass}
              value={epiCa}
              onChange={(event) => setEpiCa(event.target.value.slice(0, 40))}
              placeholder="Quando aplicável"
            />
          </Field>
          <Field label="Quantidade" required>
            <input
              className={inputClass}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="1"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Identificação individual"
            hint="Nº de série ou patrimônio. Impede o mesmo equipamento em dois veículos."
          >
            <input
              className={inputClass}
              value={identification}
              onChange={(event) => setIdentification(event.target.value.slice(0, 80))}
              placeholder="Ex.: PAT-00412"
            />
          </Field>
          <Field label="Observações">
            <input
              className={inputClass}
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
              placeholder="Condição, local de fixação, responsável"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}