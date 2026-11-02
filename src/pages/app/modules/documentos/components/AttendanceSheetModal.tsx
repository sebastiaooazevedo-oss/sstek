import { useEffect, useMemo, useRef, useState } from "react";
import Modal, { Field, inputClass, ModalButton } from "@/pages/app/components/Modal";
import SignaturePad from "@/components/base/SignaturePad";
import SignatureCapture from "@/pages/app/components/SignatureCapture";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { printHtml } from "@/pages/app/utils/exportPdf";
import {
  buildAttendancePdfBody,
  type AttendanceParticipant,
  type AttendanceSheet,
} from "@/pages/app/modules/documentos/attendanceStore";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import {
  attendanceHasSignature,
  attendanceSeal,
} from "@/pages/app/modules/documentos/attendanceSeal";
import type { DocumentSeal } from "@/pages/app/signature/authenticitySeal";
import AttendanceSealSection from "@/pages/app/modules/documentos/components/AttendanceSealSection";

interface AttendanceSheetModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (sheet: AttendanceSheet) => Promise<unknown> | void;
}

function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function emptyParticipant(id: string): AttendanceParticipant {
  return { id, name: "", role: "", document: "", signature: "", collaboratorId: "" };
}

export default function AttendanceSheetModal({ open, onClose, onSave }: AttendanceSheetModalProps) {
  const collaborators = useCollaboratorsList();
  const [title, setTitle] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [facilitatorDoc, setFacilitatorDoc] = useState("");
  const [facilitatorSignature, setFacilitatorSignature] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [establishment, setEstablishment] = useState("");
  const [unitTouched, setUnitTouched] = useState(false);
  const [participants, setParticipants] = useState<AttendanceParticipant[]>([
    emptyParticipant("p-1"),
    emptyParticipant("p-2"),
    emptyParticipant("p-3"),
  ]);
  const [activeSign, setActiveSign] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sheetIdRef = useRef(`ficha-${Date.now()}`);
  const [seal, setSeal] = useState<DocumentSeal | null>(null);
  const [sealLoading, setSealLoading] = useState(false);
  const [sealError, setSealError] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setFacilitator("");
      setFacilitatorDoc("");
      setFacilitatorSignature("");
      setDate("");
      setPlace("");
      setEstablishment("");
      setUnitTouched(false);
      setParticipants([emptyParticipant("p-1"), emptyParticipant("p-2"), emptyParticipant("p-3")]);
      setActiveSign(null);
      setError("");
      sheetIdRef.current = `ficha-${Date.now()}`;
      setSeal(null);
      setSealLoading(false);
      setSealError(false);
    }
  }, [open]);

  const filledParticipants = useMemo(
    () => participants.filter((p) => p.name.trim().length > 1),
    [participants]
  );

  const signedCount = useMemo(
    () => participants.filter((p) => p.signature).length + (facilitatorSignature ? 1 : 0),
    [participants, facilitatorSignature]
  );

  /** Ficha montada a partir do formulário (mesma referência usada na prévia e no PDF). */
  const draftSheet: AttendanceSheet = useMemo(
    () => ({
      id: sheetIdRef.current,
      title: title.trim(),
      facilitator: facilitator.trim(),
      facilitatorDoc: facilitatorDoc.trim(),
      facilitatorSignature,
      date,
      place: place.trim(),
      establishment: establishment.trim(),
      participants,
    }),
    [title, facilitator, facilitatorDoc, facilitatorSignature, date, place, establishment, participants]
  );

  /** Impressão digital do conteúdo: muda quando a ficha muda de fato. */
  const draftKey = useMemo(
    () =>
      JSON.stringify({
        title: draftSheet.title,
        facilitator: draftSheet.facilitator,
        facilitatorSignature: Boolean(draftSheet.facilitatorSignature),
        date: draftSheet.date,
        place: draftSheet.place,
        establishment: draftSheet.establishment,
        participants: draftSheet.participants.map((p) => [p.name, p.document, Boolean(p.signature)]),
      }),
    [draftSheet]
  );

  // Conteúdo alterado depois da prévia: o selo exibido não corresponde mais ao
  // que seria impresso, então ele é descartado (e nunca reaproveitado).
  useEffect(() => {
    setSeal(null);
    setSealError(false);
  }, [draftKey]);

  // Unidade predominante dos participantes vinculados ao cadastro, usada como
  // sugestão automática do estabelecimento da ficha.
  const suggestedUnit = useMemo(() => {
    const counts = new Map<string, number>();
    participants.forEach((p) => {
      if (!p.collaboratorId) return;
      const unit = collaborators.find((c) => c.id === p.collaboratorId)?.establishment;
      if (unit) counts.set(unit, (counts.get(unit) || 0) + 1);
    });
    let best = "";
    let bestCount = 0;
    counts.forEach((count, unit) => {
      if (count > bestCount) {
        best = unit;
        bestCount = count;
      }
    });
    return best;
  }, [participants, collaborators]);

  useEffect(() => {
    if (unitTouched) return;
    setEstablishment(suggestedUnit);
  }, [suggestedUnit, unitTouched]);

  const canSubmit =
    title.trim().length > 2 && facilitator.trim().length > 1 && date !== "" && filledParticipants.length > 0;

  const updateParticipant = (id: string, key: "name" | "role" | "document" | "signature", value: string) =>
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));

  /** Ao digitar/escolher o nome, vincula automaticamente ao cadastro da base. */
  const handleNameChange = (id: string, name: string) => {
    const match = collaborators.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase()
    );
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              name,
              collaboratorId: match?.id || "",
              role: match && !p.role ? match.role : p.role,
              document: match && !p.document ? match.cpf : p.document,
            }
          : p
      )
    );
  };

  const addParticipant = () =>
    setParticipants((prev) => [...prev, emptyParticipant(`p-${Date.now()}`)]);

  const removeParticipant = (id: string) =>
    setParticipants((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));

  const clearSignature = (id: string) => updateParticipant(id, "signature", "");

  const buildSheet = (): AttendanceSheet => draftSheet;

  const handleExport = async () => {
    if (title.trim().length < 3) {
      setError("Informe o título da atividade para exportar a ficha em PDF.");
      return;
    }
    setError("");
    const hasSignature = attendanceHasSignature(draftSheet);
    setSealLoading(true);
    const freshSeal = hasSignature ? await attendanceSeal(draftSheet) : null;
    setSealLoading(false);
    setSeal(freshSeal);
    setSealError(hasSignature && !freshSeal);
    printHtml(`Ficha de Presença — ${title.trim()}`, buildAttendancePdfBody(draftSheet, freshSeal));
  };

  const handleGenerateSeal = async () => {
    if (!attendanceHasSignature(draftSheet)) return;
    setSealLoading(true);
    setSealError(false);
    const result = await attendanceSeal(draftSheet);
    setSeal(result);
    setSealError(!result);
    setSealLoading(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Preencha o título, o facilitador, a data e ao menos um participante.");
      return;
    }
    setError("");
    await onSave(buildSheet());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ficha de Presença"
      subtitle="Preencha os dados da atividade, colete as assinaturas e exporte a ficha em PDF."
      icon="ri-list-check-2"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton variant="ghost" onClick={handleExport} icon="ri-file-pdf-2-line">
            Exportar PDF
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-file-add-line">
            Gerar ficha
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Título da atividade" required className="md:col-span-2">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Treinamento NR-35 — Trabalho em Altura"
          />
        </Field>

        <Field label="Facilitador" required>
          <input
            className={inputClass}
            value={facilitator}
            onChange={(e) => setFacilitator(e.target.value)}
            placeholder="Ex.: Juliana Prado"
          />
        </Field>

        <Field label="Documento do facilitador" hint="CPF ou matrícula (opcional).">
          <input
            className={inputClass}
            value={facilitatorDoc}
            onChange={(e) => setFacilitatorDoc(e.target.value)}
            placeholder="Ex.: 123.456.789-00"
          />
        </Field>

        <Field label="Data" required>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Local">
          <input
            className={inputClass}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Ex.: Sala de treinamento / Pátio Industrial A"
          />
        </Field>

        <Field label="Unidade / Estabelecimento" hint="Sugerida pela unidade dos participantes quando disponível.">
          <div className="relative">
            <select
              className={inputClass}
              value={establishment}
              onChange={(e) => {
                setUnitTouched(true);
                setEstablishment(e.target.value);
              }}
            >
              <option value="">Selecione a unidade</option>
              {collaboratorEstablishments.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground-700">Assinatura do facilitador</span>
            <span className="text-[11px] text-foreground-400">
              {facilitatorSignature ? "Assinatura coletada" : "Ainda não assinada"}
            </span>
          </div>

          {activeSign === "facilitator" ? (
            <div className="mt-3 rounded-lg border border-background-200 bg-background-100 p-3">
              <SignaturePad
                value={facilitatorSignature}
                onChange={(v) => setFacilitatorSignature(v)}
                onDone={() => setActiveSign(null)}
              />
            </div>
          ) : facilitatorSignature ? (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-primary-200 bg-primary-50 px-3 py-2.5">
              <img src={facilitatorSignature} alt="Assinatura do facilitador" className="h-8" />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700">
                <i className="ri-checkbox-circle-line"></i>
                Assinatura coletada
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveSign("facilitator")}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-edit-line"></i>
                  Refazer
                </button>
                <button
                  type="button"
                  aria-label="Remover assinatura do facilitador"
                  onClick={() => setFacilitatorSignature("")}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSign("facilitator")}
              className="mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-pen-nib-line text-base"></i>
              Coletar assinatura
            </button>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground-700">
              Participantes e coleta de assinaturas<span className="ml-0.5 text-accent-600">*</span>
            </span>
            <span className="text-[11px] text-foreground-400">
              {filledParticipants.length} preenchido(s) · {signedCount} assinatura(s)
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {participants.map((p, index) => (
              <div key={p.id} className="rounded-lg border border-background-200 bg-background-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-xs font-bold text-secondary-900">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      className={inputClass}
                      value={p.name}
                      onChange={(e) => handleNameChange(p.id, e.target.value)}
                      list="attendance-collaborators"
                      placeholder="Nome do participante"
                    />
                    <input
                      className={inputClass}
                      value={p.role}
                      onChange={(e) => updateParticipant(p.id, "role", e.target.value)}
                      placeholder="Função (opcional)"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Remover participante"
                    onClick={() => removeParticipant(p.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-background-300 text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700"
                  >
                    <i className="ri-delete-bin-line text-base"></i>
                  </button>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className={`${inputClass} sm:flex-1`}
                    value={p.document}
                    onChange={(e) => updateParticipant(p.id, "document", e.target.value)}
                    placeholder="CPF / Matrícula (opcional)"
                  />

                  {p.signature ? (
                    <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2">
                      <img src={p.signature} alt={`Assinatura de ${p.name || "participante"}`} className="h-7" />
                      <span className="whitespace-nowrap text-xs font-semibold text-primary-700">Assinada</span>
                      <button
                        type="button"
                        aria-label="Remover assinatura"
                        onClick={() => clearSignature(p.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveSign(p.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className={p.collaboratorId ? "ri-user-follow-line text-base" : "ri-pen-nib-line text-base"}></i>
                      {p.collaboratorId ? "Assinatura do perfil" : "Coletar assinatura"}
                    </button>
                  )}
                </div>

                {activeSign === p.id && (
                  <div className="mt-3 rounded-lg border border-background-200 bg-background-100 p-3">
                    {p.collaboratorId ? (
                      <>
                        <SignatureCapture
                          collaboratorId={p.collaboratorId}
                          collaboratorName={p.name}
                          onChange={(v) => updateParticipant(p.id, "signature", v)}
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveSign(null)}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                          >
                            <i className="ri-check-line"></i>
                            Concluir
                          </button>
                        </div>
                      </>
                    ) : (
                      <SignaturePad
                        value={p.signature}
                        onChange={(v) => updateParticipant(p.id, "signature", v)}
                        onDone={() => setActiveSign(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <datalist id="attendance-collaborators">
            {collaborators.map((c) => (
              <option key={c.id} value={c.name}>
                {c.role} · {c.area}
              </option>
            ))}
          </datalist>

          <button
            type="button"
            onClick={addParticipant}
            className="mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-user-add-line text-base"></i>
            Adicionar participante
          </button>
        </div>

        {title.trim() && (
          <div className="md:col-span-2 rounded-lg border border-background-200 bg-background-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Pré-visualização</p>
            <p className="mt-2 font-heading text-base font-bold text-foreground-950">{title.trim()}</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground-600">
              <span>
                <strong className="font-semibold text-foreground-800">Facilitador:</strong> {facilitator.trim() || "—"}
              </span>
              <span>
                <strong className="font-semibold text-foreground-800">Data:</strong> {toBrDate(date)}
              </span>
              {establishment.trim() && (
                <span>
                  <strong className="font-semibold text-foreground-800">Unidade:</strong> {establishment.trim()}
                </span>
              )}
              {place.trim() && (
                <span>
                  <strong className="font-semibold text-foreground-800">Local:</strong> {place.trim()}
                </span>
              )}
              <span>
                <strong className="font-semibold text-foreground-800">Assinaturas:</strong> {signedCount}
              </span>
            </div>
          </div>
        )}

        <div className="md:col-span-2">
          <AttendanceSealSection
            sheet={draftSheet}
            seal={seal}
            loading={sealLoading}
            error={sealError}
            onGenerate={handleGenerateSeal}
          />
        </div>

        <div className="md:col-span-2 rounded-lg border border-background-200 bg-background-100 p-4">
          <div className="mb-4 flex items-center gap-2">
            <i className="ri-pen-nib-line text-base text-primary-700"></i>
            <h3 className="text-sm font-bold text-foreground-950">Assinatura do responsável técnico</h3>
          </div>
          <SignatureFooter />
        </div>
      </div>
    </Modal>
  );
}