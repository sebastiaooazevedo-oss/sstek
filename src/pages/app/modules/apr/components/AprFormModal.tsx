import { useEffect, useMemo, useState } from "react";
import Modal, { Field, inputClass, selectClass, ModalButton } from "@/pages/app/components/Modal";
import SignaturePad from "@/components/base/SignaturePad";
import { getInitials } from "@/pages/app/context";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import { aprActivities, aprAreas, aprSeverityScale, type AprRisk, type AprRecord } from "@/mocks/apr";
import { riskLevel, toBrDate } from "@/pages/app/modules/apr/aprUtils";

interface AprFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (record: AprRecord) => void;
  /**
   * Pré-preenchimento usado quando o próprio colaborador registra a APR
   * (responsável, unidade e o executante já selecionado).
   */
  preset?: {
    responsible?: string;
    establishment?: string;
    participantId?: string;
  };
}

const emptyForm = {
  title: "",
  requestNumber: "",
  activity: aprActivities[0],
  area: aprAreas[0],
  establishment: "",
  location: "",
  date: "",
  responsible: "",
  notes: "",
};

const emptyRisk = { hazard: "", risk: "", severity: "3", probability: "3", control: "" };

const scoreTone: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-800",
  accent: "bg-accent-100 text-accent-800",
};

export default function AprFormModal({ open, onClose, onCreate, preset }: AprFormModalProps) {
  const collaborators = useCollaboratorsList();
  const [form, setForm] = useState(emptyForm);
  const [risks, setRisks] = useState<AprRisk[]>([]);
  const [draftRisk, setDraftRisk] = useState(emptyRisk);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [activeSigner, setActiveSigner] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm,
        responsible: preset?.responsible ?? "",
        establishment: preset?.establishment ?? "",
      });
      setRisks([]);
      setDraftRisk(emptyRisk);
      setParticipantIds(preset?.participantId ? [preset.participantId] : []);
      setParticipantSearch("");
      setSignatures({});
      setActiveSigner("");
      setError("");
    }
  }, [open, preset?.responsible, preset?.establishment, preset?.participantId]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Unidades sugeridas: prioriza os estabelecimentos do cadastro real e,
  // como apoio, os estabelecimentos conhecidos da empresa.
  const establishments = useMemo(() => {
    const set = new Set<string>();
    collaborators.forEach((c) => {
      if (c.establishment) set.add(c.establishment);
    });
    collaboratorEstablishments.forEach((unit) => set.add(unit));
    return Array.from(set);
  }, [collaborators]);

  // Mantém a unidade do cadastro do colaborador como opção válida mesmo quando
  // ela ainda não aparece na lista de estabelecimentos conhecidos.
  const establishmentOptions = useMemo(() => {
    const set = new Set(establishments);
    if (form.establishment) set.add(form.establishment);
    return Array.from(set);
  }, [establishments, form.establishment]);

  // Define a unidade padrão assim que o formulário abre (sem sobrescrever uma
  // escolha já feita pelo usuário).
  useEffect(() => {
    if (open && !form.establishment && establishments.length > 0) {
      setForm((prev) => ({ ...prev, establishment: establishments[0] }));
    }
  }, [open, form.establishment, establishments]);

  const selectedCollaborators = useMemo(
    () => collaborators.filter((c) => participantIds.includes(c.id)),
    [collaborators, participantIds]
  );

  const filteredCollaborators = useMemo(() => {
    const term = participantSearch.trim().toLowerCase();
    if (!term) return collaborators;
    return collaborators.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.role.toLowerCase().includes(term) ||
        c.area.toLowerCase().includes(term)
    );
  }, [collaborators, participantSearch]);

  const toggleParticipant = (id: string) => {
    const isSelected = participantIds.includes(id);
    if (isSelected) {
      setParticipantIds((prev) => prev.filter((x) => x !== id));
      setSignatures((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      if (activeSigner === id) setActiveSigner("");
    } else {
      setParticipantIds((prev) => [...prev, id]);
    }
  };

  const signedCount = selectedCollaborators.filter((c) => signatures[c.id]).length;

  const canSubmit = useMemo(
    () =>
      form.title.trim().length > 2 &&
      form.requestNumber.trim().length > 2 &&
      form.responsible.trim().length > 1 &&
      form.date !== "" &&
      risks.length > 0 &&
      signedCount > 0,
    [form.title, form.requestNumber, form.responsible, form.date, risks.length, signedCount]
  );

  const addRisk = () => {
    if (!draftRisk.hazard.trim() || !draftRisk.risk.trim()) return;
    setRisks((prev) => [
      ...prev,
      {
        id: `rk-${Date.now()}-${prev.length}`,
        hazard: draftRisk.hazard.trim(),
        risk: draftRisk.risk.trim(),
        severity: Number(draftRisk.severity) || 3,
        probability: Number(draftRisk.probability) || 3,
        control: draftRisk.control.trim(),
      },
    ]);
    setDraftRisk(emptyRisk);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setError(
        "Informe o número da solicitação, título, responsável, data, ao menos um risco e uma assinatura de aceite."
      );
      return;
    }
    const allSigned = selectedCollaborators.every((c) => signatures[c.id]);
    const record: AprRecord = {
      id: `apr-${Date.now()}`,
      title: form.title.trim(),
      requestNumber: form.requestNumber.trim(),
      activity: form.activity,
      area: form.area,
      establishment: form.establishment,
      location: form.location.trim() || "—",
      date: toBrDate(form.date),
      responsible: form.responsible.trim(),
      risks,
      signatures: selectedCollaborators.map((c) => ({
        collaboratorId: c.id,
        collaboratorName: c.name,
        collaboratorRole: c.role,
        signature: signatures[c.id] || "",
      })),
      notes: form.notes.trim(),
      status: allSigned ? "Concluída" : "Pendente",
    };
    onCreate(record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova APR"
      subtitle="Análise Preliminar de Risco com perigos, medidas de controle e aceite por assinatura dos executantes."
      icon="ri-clipboard-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-check-line">
            Registrar APR
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Título da APR" required className="md:col-span-2">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: Trabalho em altura na linha de pintura"
          />
        </Field>

        <Field
          label="Nº da solicitação"
          required
          hint="Obrigatório. É o número que a APR representa (ex.: SOL-2026-0148)."
        >
          <input
            className={inputClass}
            value={form.requestNumber}
            onChange={(e) => set("requestNumber", e.target.value)}
            placeholder="Ex.: SOL-2026-0148"
          />
        </Field>

        <Field label="Atividade avaliada">
          <div className="relative">
            <select className={selectClass} value={form.activity} onChange={(e) => set("activity", e.target.value)}>
              {aprActivities.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Setor / Área">
          <div className="relative">
            <select className={selectClass} value={form.area} onChange={(e) => set("area", e.target.value)}>
              {aprAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Unidade / Estabelecimento" hint="Sugerida a partir do cadastro real de colaboradores.">
          <div className="relative">
            <select
              className={selectClass}
              value={form.establishment}
              onChange={(e) => set("establishment", e.target.value)}
            >
              <option value="">Selecione a unidade</option>
              {establishmentOptions.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Local">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ex.: Galpão B — Linha de pintura"
          />
        </Field>

        <Field label="Data" required>
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
        </Field>

        <Field label="Responsável pela análise" required className="md:col-span-2">
          <input
            className={inputClass}
            value={form.responsible}
            onChange={(e) => set("responsible", e.target.value)}
            placeholder="Ex.: Juliana Prado — Técnica de Segurança"
          />
        </Field>

        <div className="md:col-span-2">
          <span className="text-xs font-semibold text-foreground-700">
            Riscos identificados e medidas de controle<span className="ml-0.5 text-accent-600">*</span>
          </span>
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg border border-background-200 bg-background-100 p-3 sm:grid-cols-2">
            <input
              className={inputClass}
              value={draftRisk.hazard}
              onChange={(e) => setDraftRisk((p) => ({ ...p, hazard: e.target.value }))}
              placeholder="Perigo (ex.: altura superior a 2 m)"
            />
            <input
              className={inputClass}
              value={draftRisk.risk}
              onChange={(e) => setDraftRisk((p) => ({ ...p, risk: e.target.value }))}
              placeholder="Risco (ex.: queda de nível)"
            />
            <div className="relative">
              <select
                className={selectClass}
                value={draftRisk.severity}
                onChange={(e) => setDraftRisk((p) => ({ ...p, severity: e.target.value }))}
              >
                {aprSeverityScale.map((s) => (
                  <option key={s} value={s}>
                    Severidade {s}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
            <div className="relative">
              <select
                className={selectClass}
                value={draftRisk.probability}
                onChange={(e) => setDraftRisk((p) => ({ ...p, probability: e.target.value }))}
              >
                {aprSeverityScale.map((s) => (
                  <option key={s} value={s}>
                    Probabilidade {s}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
            <input
              className={`${inputClass} sm:col-span-2`}
              value={draftRisk.control}
              onChange={(e) => setDraftRisk((p) => ({ ...p, control: e.target.value }))}
              placeholder="Medidas de controle aplicadas"
            />
            <button
              type="button"
              onClick={addRisk}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 sm:col-span-2"
            >
              <i className="ri-add-line text-base"></i>
              Adicionar risco
            </button>
          </div>

          {risks.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {risks.map((risk, index) => {
                const level = riskLevel(risk.severity, risk.probability);
                return (
                  <li
                    key={risk.id}
                    className="flex items-start gap-3 rounded-md border border-background-200 bg-background-50 px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background-100 text-xs font-bold text-foreground-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground-900">
                        {risk.risk} <span className="font-normal text-foreground-500">· {risk.hazard}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-foreground-500">{risk.control || "Sem medidas informadas"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${scoreTone[level.tone]}`}>
                      {level.label}
                    </span>
                    <button
                      type="button"
                      aria-label="Remover risco"
                      onClick={() => setRisks((prev) => prev.filter((r) => r.id !== risk.id))}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground-700">
              Executantes (colaboradores da base)<span className="ml-0.5 text-accent-600">*</span>
            </span>
            <span className="text-[11px] text-foreground-400">
              {participantIds.length} selecionado(s) · {signedCount} assinado(s)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-foreground-400">
            Selecione os colaboradores que executam a atividade e colete o aceite por assinatura de cada um.
          </p>

          <div className="mt-2 rounded-lg border border-background-300 bg-background-50">
            <div className="flex items-center gap-2 border-b border-background-200 px-3">
              <i className="ri-search-line text-sm text-foreground-400"></i>
              <input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Buscar por nome, função ou setor..."
                className="w-full bg-transparent py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-2">
              {filteredCollaborators.map((c) => {
                const checked = participantIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleParticipant(c.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                      checked ? "bg-primary-50" : "hover:bg-background-100"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300"
                      }`}
                    >
                      {checked && <i className="ri-check-line text-xs"></i>}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-200 text-[11px] font-bold text-foreground-700">
                      {getInitials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground-900">{c.name}</span>
                      <span className="block truncate text-xs text-foreground-500">
                        {c.role} · {c.area}
                      </span>
                    </span>
                  </button>
                );
              })}
              {filteredCollaborators.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-foreground-500">Nenhum colaborador encontrado.</p>
              )}
            </div>
          </div>
        </div>

        {selectedCollaborators.length > 0 && (
          <div className="md:col-span-2">
            <span className="text-xs font-semibold text-foreground-700">Aceite por assinatura</span>
            <ul className="mt-2 flex flex-col gap-2">
              {selectedCollaborators.map((c) => {
                const signed = Boolean(signatures[c.id]);
                const isActive = activeSigner === c.id;
                return (
                  <li key={c.id} className="rounded-md border border-background-200 bg-background-100 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[11px] font-bold text-secondary-900">
                        {getInitials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground-900">{c.name}</p>
                        <p className="truncate text-xs text-foreground-500">
                          {c.role} · {c.area}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          signed ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
                        }`}
                      >
                        <i className={signed ? "ri-checkbox-circle-line" : "ri-timer-line"}></i>
                        {signed ? "Assinado" : "Pendente"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveSigner(isActive ? "" : c.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className={isActive ? "ri-close-line" : "ri-pen-nib-line"}></i>
                        {isActive ? "Fechar" : signed ? "Refazer" : "Assinar"}
                      </button>
                    </div>
                    {isActive && (
                      <div className="mt-3 rounded-md border border-background-200 bg-background-50 p-3">
                        <SignaturePad
                          value={signatures[c.id] || ""}
                          onChange={(dataUrl) => setSignatures((prev) => ({ ...prev, [c.id]: dataUrl }))}
                          onDone={() => setActiveSigner("")}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Field label="Observações" className="md:col-span-2" hint="Máximo de 500 caracteres.">
          <textarea
            className={`${inputClass} min-h-[88px] resize-y`}
            maxLength={500}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Encaminhamentos, responsáveis por ações, prazos..."
          />
        </Field>
      </div>
    </Modal>
  );
}