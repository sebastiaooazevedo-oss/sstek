import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { useAppSession } from "@/pages/app/context";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { compressEpiPhoto } from "@/pages/app/modules/epi/epiPhoto";
import {
  createEpiReplacementRequest,
  replacementReasons,
  type EpiReplacementOrigin,
} from "@/pages/app/modules/epi/replacementStore";

export interface EpiReplacementEquipment {
  name: string;
  ca: string;
  validity?: string;
}

export interface EpiReplacementInitial {
  collaboratorId?: string;
  collaboratorName?: string;
  collaboratorRole?: string;
  area?: string;
  establishment?: string;
  epiName?: string;
  ca?: string;
  validity?: string;
}

interface EpiReplacementModalProps {
  open: boolean;
  onClose: () => void;
  initial?: EpiReplacementInitial;
  /** Equipamentos em uso do colaborador (quando ele mesmo abre o pedido). */
  equipmentOptions?: EpiReplacementEquipment[];
  /** Modo colaborador: o pedido é sempre em nome do próprio usuário. */
  selfService?: boolean;
  onCreated?: (message: string) => void;
}

const OTHER_EQUIPMENT = "__other__";

export default function EpiReplacementModal({
  open,
  onClose,
  initial,
  equipmentOptions = [],
  selfService = false,
  onCreated,
}: EpiReplacementModalProps) {
  const session = useAppSession();
  const collaborators = useCollaboratorsList();

  const me = useMemo(() => {
    const byId = initial?.collaboratorId
      ? collaborators.find((c) => c.id === initial.collaboratorId)
      : undefined;
    const byEmail = collaborators.find(
      (c) => c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()
    );
    const byName = collaborators.find((c) => c.name === session.name);
    return byId || byName || byEmail || null;
  }, [collaborators, initial?.collaboratorId, session.email, session.name]);

  const [collaboratorId, setCollaboratorId] = useState("");
  const [equipmentChoice, setEquipmentChoice] = useState("");
  const [epiName, setEpiName] = useState("");
  const [ca, setCa] = useState("");
  const [validity, setValidity] = useState("");
  const [reason, setReason] = useState<string>(replacementReasons[0]);
  const [otherReason, setOtherReason] = useState("");
  const [lossDate, setLossDate] = useState("");
  const [lossPlace, setLossPlace] = useState("");
  const [lossDescription, setLossDescription] = useState("");
  const [lossReport, setLossReport] = useState("");
  const [photo, setPhoto] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const matchedIndex = initial?.ca
      ? equipmentOptions.findIndex((item) => item.ca === initial.ca)
      : -1;
    setCollaboratorId(initial?.collaboratorId || me?.id || "");
    if (!equipmentOptions.length) {
      setEquipmentChoice("");
    } else if (initial?.ca && matchedIndex < 0) {
      setEquipmentChoice(OTHER_EQUIPMENT);
    } else {
      setEquipmentChoice(String(matchedIndex >= 0 ? matchedIndex : 0));
    }
    setEpiName(initial?.epiName || equipmentOptions[0]?.name || "");
    setCa(initial?.ca || equipmentOptions[0]?.ca || "");
    setValidity(initial?.validity || equipmentOptions[0]?.validity || "");
    setReason(initial?.validity ? "CA vencido" : "Desgaste");
    setOtherReason("");
    setLossDate("");
    setLossPlace("");
    setLossDescription("");
    setLossReport("");
    setPhoto("");
    setNotes("");
    setError("");
    setSaving(false);
  }, [
    open,
    initial?.collaboratorId,
    initial?.epiName,
    initial?.ca,
    initial?.validity,
    equipmentOptions.length,
    me?.id,
  ]);

  const selectedCollaborator = useMemo(() => {
    const id = selfService ? me?.id || initial?.collaboratorId || "" : collaboratorId;
    return collaborators.find((c) => c.id === id) || null;
  }, [collaborators, collaboratorId, initial?.collaboratorId, me?.id, selfService]);

  const personName = selectedCollaborator?.name || initial?.collaboratorName || (selfService ? session.name : "");
  const personId = selectedCollaborator?.id || (selfService ? initial?.collaboratorId || "" : collaboratorId);
  const personRole = selectedCollaborator?.role || initial?.collaboratorRole || "";
  const personArea = selectedCollaborator?.area || initial?.area || "";
  const personEstablishment = selectedCollaborator?.establishment || initial?.establishment || "";

  const handleEquipmentChange = (value: string) => {
    setEquipmentChoice(value);
    if (value === OTHER_EQUIPMENT) {
      setEpiName("");
      setCa("");
      setValidity("");
      return;
    }
    const option = equipmentOptions[Number(value)];
    if (option) {
      setEpiName(option.name);
      setCa(option.ca);
      setValidity(option.validity || "");
    }
  };

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    setError("");
    try {
      const data = await compressEpiPhoto(file);
      setPhoto(data);
    } catch {
      setError("Não foi possível processar a foto. Tente outra imagem.");
    }
  };

  const lossDetail =
    reason === "Perda"
      ? `Registro de perda — Data: ${lossDate || "—"} · Local: ${lossPlace.trim() || "—"} · Boletim: ${
          lossReport.trim() || "não informado"
        }. Descrição: ${lossDescription.trim()}`
      : reason === "Outro"
        ? otherReason.trim()
        : "";

  const handleSubmit = async () => {
    if (saving) return;
    setError("");

    if (!personId || !personName) {
      setError("Selecione o colaborador responsável pelo pedido.");
      return;
    }
    if (!epiName.trim() || !ca.trim()) {
      setError("Informe o equipamento e o número do CA.");
      return;
    }
    if (!photo) {
      setError("A foto do EPI é obrigatória para abrir o pedido de substituição.");
      return;
    }
    if (reason === "Perda") {
      if (!lossDate || !lossPlace.trim() || lossDescription.trim().length < 10) {
        setError("Para o motivo Perda, registre a data, o local e a descrição do ocorrido (mínimo 10 caracteres).");
        return;
      }
    }
    if (reason === "Outro" && otherReason.trim().length < 5) {
      setError("Descreva o motivo da troca (mínimo 5 caracteres).");
      return;
    }

    setSaving(true);
    const origin: EpiReplacementOrigin = selfService ? "colaborador" : "admin";
    const result = await createEpiReplacementRequest({
      collaboratorId: personId,
      collaboratorName: personName,
      collaboratorRole: personRole,
      area: personArea,
      establishment: personEstablishment,
      epiName: epiName.trim(),
      ca: ca.trim(),
      validity: validity.trim(),
      reason,
      lossDetail,
      photo,
      notes: notes.trim(),
      origin,
      requestedBy: session.name || session.email,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error || "Não foi possível abrir o pedido.");
      return;
    }

    onCreated?.(
      selfService
        ? `Pedido de substituição de ${epiName.trim()} enviado. O SESMT foi avisado e vai providenciar a troca.`
        : `Pedido de substituição de ${epiName.trim()} aberto para ${personName}.`
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pedido de substituição de EPI"
      subtitle="Registre o motivo e a foto do equipamento. O aviso vai para o administrador/SESMT da empresa."
      icon="ri-loop-left-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={() => void handleSubmit()} icon="ri-send-plane-line" disabled={saving}>
            {saving ? "Enviando..." : "Abrir pedido"}
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {selfService ? (
          <div className="md:col-span-2 flex items-center gap-3 rounded-md border border-secondary-200 bg-secondary-100/70 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-200 text-xs font-bold text-secondary-900">
              <i className="ri-user-line text-base"></i>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-secondary-900">{personName || "Colaborador"}</p>
              <p className="truncate text-xs text-secondary-800/80">
                {personRole || "—"}
                {personArea ? ` · ${personArea}` : ""}
                {personEstablishment ? ` · ${personEstablishment}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <Field label="Colaborador" required className="md:col-span-2">
            <div className="relative">
              <select
                className={selectClass}
                value={collaboratorId}
                onChange={(e) => setCollaboratorId(e.target.value)}
              >
                <option value="">Selecione o colaborador...</option>
                {collaborators.map((collaborator) => (
                  <option key={collaborator.id} value={collaborator.id}>
                    {collaborator.name} · {collaborator.role}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        )}

        <div className="md:col-span-2">
          <span className="text-xs font-semibold text-foreground-700">
            Equipamento a substituir<span className="ml-0.5 text-accent-600">*</span>
          </span>
          <div className="mt-1.5 flex flex-col gap-2">
            {equipmentOptions.length > 0 && (
              <div className="relative">
                <select
                  className={selectClass}
                  value={equipmentChoice}
                  onChange={(e) => handleEquipmentChange(e.target.value)}
                >
                  {equipmentOptions.map((item, index) => (
                    <option key={`${item.ca}-${index}`} value={String(index)}>
                      {item.name} · CA {item.ca}
                      {item.validity ? ` · validade ${item.validity}` : ""}
                    </option>
                  ))}
                  <option value={OTHER_EQUIPMENT}>Outro equipamento (descrever abaixo)</option>
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            )}

            {(!equipmentOptions.length || equipmentChoice === OTHER_EQUIPMENT) && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  value={epiName}
                  onChange={(e) => setEpiName(e.target.value)}
                  placeholder="Nome do EPI (ex.: Botina de segurança)"
                  aria-label="Nome do EPI"
                />
                <input
                  className={`${inputClass} sm:w-40`}
                  value={ca}
                  onChange={(e) => setCa(e.target.value)}
                  placeholder="CA"
                  aria-label="Número do CA"
                />
              </div>
            )}

            {epiName && equipmentChoice !== OTHER_EQUIPMENT && equipmentOptions.length > 0 && (
              <p className="text-[11px] text-foreground-500">
                CA {ca || "não informado"}
                {validity ? ` · validade do certificado ${validity}` : ""}
              </p>
            )}
          </div>
        </div>

        <Field label="Motivo da troca" required>
          <div className="relative">
            <select className={selectClass} value={reason} onChange={(e) => setReason(e.target.value)}>
              {replacementReasons.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Observações" hint="Opcional. Máximo de 500 caracteres.">
          <input
            className={inputClass}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: equipamento já separado no almoxarifado"
          />
        </Field>

        {reason === "Outro" && (
          <Field label="Descreva o motivo" required className="md:col-span-2">
            <input
              className={inputClass}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Explique por que a substituição é necessária"
            />
          </Field>
        )}

        {reason === "Perda" && (
          <div className="md:col-span-2 rounded-lg border border-accent-300 bg-accent-50 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                <i className="ri-file-warning-line text-base"></i>
              </span>
              <div>
                <p className="text-sm font-bold text-foreground-950">Registro de perda do EPI</p>
                <p className="mt-0.5 text-xs text-foreground-600">
                  O motivo Perda exige o registro do ocorrido. Data, local e descrição são obrigatórios.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Data da perda" required>
                <input
                  type="date"
                  className={inputClass}
                  value={lossDate}
                  onChange={(e) => setLossDate(e.target.value)}
                />
              </Field>
              <Field label="Local da perda" required>
                <input
                  className={inputClass}
                  value={lossPlace}
                  onChange={(e) => setLossPlace(e.target.value)}
                  placeholder="Ex.: área de expedição"
                />
              </Field>
              <Field label="Nº do boletim de ocorrência" hint="Opcional, quando houver registro policial.">
                <input
                  className={inputClass}
                  value={lossReport}
                  onChange={(e) => setLossReport(e.target.value)}
                  placeholder="Ex.: BO 1234/2026"
                />
              </Field>
              <Field label="Descrição do ocorrido" required className="sm:col-span-2">
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y`}
                  maxLength={500}
                  value={lossDescription}
                  onChange={(e) => setLossDescription(e.target.value)}
                  placeholder="Descreva como o equipamento foi perdido"
                />
              </Field>
            </div>
          </div>
        )}

        <div className="md:col-span-2">
          <Field
            label="Foto do EPI"
            required
            hint="Obrigatória. Tire a foto do equipamento (danificado, desgastado ou perdido) para registrar o pedido."
          >
            {photo ? (
              <div className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-3 sm:flex-row sm:items-center">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-50">
                  <img src={photo} alt="Foto do EPI registrada no pedido" className="h-full w-full object-cover object-top" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-900">Foto anexada</p>
                  <p className="mt-0.5 text-xs text-foreground-500">
                    Ela fica visível no painel do administrador junto com o pedido.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhoto("")}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-delete-bin-line"></i>
                  Trocar foto
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-5 py-7 text-center transition-colors hover:border-primary-400 hover:bg-primary-50">
                <i className="ri-camera-line text-2xl text-primary-600"></i>
                <span className="text-sm font-semibold text-foreground-800">Anexar foto do EPI</span>
                <span className="text-xs text-foreground-500">Tire uma foto na hora ou escolha da galeria</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handlePhoto(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  );
}