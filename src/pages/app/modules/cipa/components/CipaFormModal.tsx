import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { collaborators, collaboratorAreas } from "@/mocks/collaborators";
import {
  cipaMemberRoles,
  cipaRepresentations,
  cipaStatuses,
  type Cipa,
  type CipaMember,
  type CipaMemberRole,
  type CipaRepresentation,
  type CipaStatus,
} from "@/mocks/cipa";
import { generateId, nrsDimensioning } from "@/pages/app/modules/cipa/cipaUtils";
import { buildCipaFichaPdfBody } from "@/pages/app/modules/cipa/cipaPdf";
import { printHtml } from "@/pages/app/utils/exportPdf";
import {
  technicalSignatureBlockedMessage,
  useTechnicalSignatureGate,
} from "@/pages/app/modules/cipa/technicalSignatureGate";
import { technicalSignatureInfo } from "@/pages/app/modules/cipa/technicalSignatureStore";

interface CipaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (cipa: Cipa) => void;
  editing?: Cipa | null;
}

function blankMember(): CipaMember {
  return {
    id: generateId("m"),
    name: "",
    roleFunction: "",
    area: "",
    registration: "",
    representation: "Empregado",
    memberRole: "Titular",
    since: "",
  };
}

export default function CipaFormModal({ open, onClose, onSave, editing }: CipaFormModalProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [riskGrade, setRiskGrade] = useState("");
  const [employeesCount, setEmployeesCount] = useState("");
  const [mandateNumber, setMandateNumber] = useState("");
  const [mandateStart, setMandateStart] = useState("");
  const [mandateEnd, setMandateEnd] = useState("");
  const [status, setStatus] = useState<CipaStatus>("Ativa");
  const [members, setMembers] = useState<CipaMember[]>([blankMember()]);
  const [error, setError] = useState("");
  // Emissão da ficha condicionada à assinatura do Responsável Técnico.
  const gate = useTechnicalSignatureGate();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setUnit(editing.unit);
      setCity(editing.city);
      setCnpj(editing.cnpj);
      setRiskGrade(editing.riskGrade);
      setEmployeesCount(String(editing.employeesCount));
      setMandateNumber(editing.mandateNumber);
      setMandateStart(editing.mandateStart);
      setMandateEnd(editing.mandateEnd);
      setStatus(editing.status);
      setMembers(editing.members.length ? editing.members : [blankMember()]);
    } else {
      setName("");
      setUnit("");
      setCity("");
      setCnpj("");
      setRiskGrade("Grau 3");
      setEmployeesCount("");
      setMandateNumber("");
      setMandateStart("");
      setMandateEnd("");
      setStatus("Ativa");
      setMembers([blankMember()]);
    }
    setError("");
  }, [open, editing]);

  const updateMember = (id: string, patch: Partial<CipaMember>) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  // Dimensionamento sugerido pelo Quadro I da NR-5 a partir do porte do
  // estabelecimento e do grau de risco da atividade.
  const suggestion = useMemo(() => {
    const count = Number(employeesCount) || 0;
    if (!count) return null;
    return nrsDimensioning(count, riskGrade);
  }, [employeesCount, riskGrade]);

  // Representantes dos empregados efetivamente lançados na composição.
  const employeeTitulares = members.filter(
    (m) => m.name.trim() && m.representation === "Empregado" && m.memberRole === "Titular"
  ).length;
  const employeeSuplentes = members.filter(
    (m) => m.name.trim() && m.representation === "Empregado" && m.memberRole === "Suplente"
  ).length;
  const withinDimensioning = !suggestion?.required
    ? true
    : employeeTitulares === suggestion.titulares && employeeSuplentes === suggestion.suplentes;

  const handleName = (id: string, value: string) => {
    const found = collaborators.find((c) => c.name.toLowerCase() === value.toLowerCase());
    if (found) {
      updateMember(id, { name: value, roleFunction: found.role, area: found.area, registration: found.matricula });
    } else {
      updateMember(id, { name: value });
    }
  };

  const handleSubmit = () => {
    if (name.trim().length < 3) return setError("Informe o nome da comissão (ex.: CIPA Filial Campinas).");
    if (!unit.trim()) return setError("Informe a unidade/estabelecimento da CIPA.");
    if (!mandateNumber.trim()) return setError("Informe o mandato (ex.: 2026/2027).");
    const validMembers = members.filter((m) => m.name.trim().length > 1);
    if (validMembers.length === 0) return setError("Adicione ao menos um membro à composição.");

    setError("");
    onSave({
      id: editing?.id ?? generateId("cipa"),
      name: name.trim(),
      unit: unit.trim(),
      city: city.trim(),
      cnpj: cnpj.trim(),
      riskGrade: riskGrade.trim(),
      employeesCount: Number(employeesCount) || 0,
      mandateNumber: mandateNumber.trim(),
      mandateStart,
      mandateEnd,
      status,
      members: validMembers,
    });
    onClose();
  };

  const handlePrintFicha = async () => {
    if (name.trim().length < 3) return setError("Informe o nome da comissão antes de gerar a ficha.");
    if (!unit.trim()) return setError("Informe a unidade/estabelecimento da comissão.");
    setError("");
    // Referência estável da ficha: mantém a assinatura do RT entre edições.
    const fichaRef =
      editing?.id ??
      `ficha-cipa-${`${name}-${unit}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const ficha: Cipa = {
      id: fichaRef,
      name: name.trim(),
      unit: unit.trim(),
      city: city.trim(),
      cnpj: cnpj.trim(),
      riskGrade: riskGrade.trim(),
      employeesCount: Number(employeesCount) || 0,
      mandateNumber: mandateNumber.trim(),
      mandateStart,
      mandateEnd,
      status,
      members: members.filter((m) => m.name.trim().length > 1),
    };

    const result = await gate.guard(
      "ficha-cipa",
      ficha.id,
      `Ficha de Cadastro da CIPA — ${ficha.name}`,
      `${ficha.unit} · Mandato ${ficha.mandateNumber || "—"} · ${ficha.members.length} membro(s)`
    );
    if (result !== "signed") {
      setError(technicalSignatureBlockedMessage(result, gate.responsible?.name));
      return;
    }
    printHtml(
      `Ficha da CIPA — ${ficha.name}`,
      buildCipaFichaPdfBody(ficha, technicalSignatureInfo("ficha-cipa", ficha.id) ?? undefined)
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar CIPA" : "Nova CIPA"}
      subtitle="Cadastre uma comissão por estabelecimento (matriz ou filial) e defina a composição do mandato."
      icon="ri-team-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton variant="ghost" onClick={handlePrintFicha} icon="ri-printer-line">
            Gerar PDF
          </ModalButton>          <ModalButton onClick={handleSubmit} icon="ri-save-3-line">
            {editing ? "Salvar alterações" : "Criar CIPA"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-building-2-line text-base text-primary-700"></i>
            Identificação do estabelecimento
          </h3>
          <Field label="Nome da comissão" required hint="Sugestão: CIPA + unidade (ex.: CIPA Filial Campinas)">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="CIPA Matriz" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Unidade / Estabelecimento" required>
              <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Filial Campinas" />
            </Field>
            <Field label="Cidade / UF">
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Campinas/SP" />
            </Field>
            <Field label="CNPJ do estabelecimento">
              <input className={inputClass} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
            </Field>
            <Field label="Nº de empregados">
              <input type="number" className={inputClass} value={employeesCount} onChange={(e) => setEmployeesCount(e.target.value)} placeholder="Ex.: 96" />
            </Field>
            <Field label="Grau de risco (NR-4)" hint="Define o dimensionamento da CIPA (NR-5).">
              <div className="relative">
                <select className={selectClass} value={riskGrade} onChange={(e) => setRiskGrade(e.target.value)}>
                  {["Grau 1", "Grau 2", "Grau 3", "Grau 4"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Situação">
              <div className="relative">
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as CipaStatus)}>
                  {cipaStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Mandato" required>
              <input className={inputClass} value={mandateNumber} onChange={(e) => setMandateNumber(e.target.value)} placeholder="2026/2027" />
            </Field>
            <Field label="Início do mandato">
              <input type="date" className={inputClass} value={mandateStart} onChange={(e) => setMandateStart(e.target.value)} />
            </Field>
            <Field label="Fim do mandato">
              <input type="date" className={inputClass} value={mandateEnd} onChange={(e) => setMandateEnd(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-group-2-line text-base text-primary-700"></i>
              Composição da CIPA
            </h3>
            <span className="text-[11px] text-foreground-400">{members.length} membro(s)</span>
          </div>

          {suggestion && (
            <div
              className={`flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3 ${
                withinDimensioning ? "border-secondary-200 bg-secondary-50" : "border-accent-200 bg-accent-50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                  withinDimensioning ? "bg-secondary-100 text-secondary-800" : "bg-accent-100 text-accent-800"
                }`}
              >
                <i className={`${withinDimensioning ? "ri-scales-3-line" : "ri-alert-line"} text-base`}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${
                    withinDimensioning ? "text-secondary-800" : "text-accent-800"
                  }`}
                >
                  {suggestion.required ? "Enquadramento no Quadro I da NR-5" : "Quadro I da NR-5"}
                </p>
                {suggestion.required ? (
                  <>
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground-700">
                      {suggestion.rangeLabel} · {suggestion.group} →{" "}
                      <strong className="font-semibold text-foreground-900">{suggestion.titulares} titular(es)</strong> e{" "}
                      <strong className="font-semibold text-foreground-900">{suggestion.suplentes} suplente(s)</strong> por parte.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-600">
                      Representantes dos empregados na composição: {employeeTitulares} titular(es) e {employeeSuplentes}{" "}
                      suplente(s).{" "}
                      <strong className={withinDimensioning ? "text-secondary-800" : "text-accent-800"}>
                        {withinDimensioning
                          ? "Conforme o dimensionamento."
                          : `Fora do dimensionamento — ajuste para ${suggestion.titulares} titular(es) e ${suggestion.suplentes} suplente(s).`}
                      </strong>
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground-700">
                    {suggestion.rangeLabel} · {suggestion.group} — o porte atual{" "}
                    <strong className="font-semibold text-foreground-900">dispensa a constituição de CIPA</strong> (basta um
                    trabalhador designado).
                  </p>
                )}
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  withinDimensioning ? "bg-secondary-100 text-secondary-800" : "bg-accent-100 text-accent-800"
                }`}
              >
                {suggestion.required ? (withinDimensioning ? "Conforme" : "Fora do Quadro I") : "Dispensa"}
              </span>
            </div>
          )}

          <datalist id="cipa-collaborators">
            {collaborators.map((c) => (
              <option key={c.id} value={c.name}>
                {c.role}
              </option>
            ))}
          </datalist>

          <div className="flex flex-col gap-4">
            {members.map((m, idx) => (
              <div key={m.id} className="rounded-lg border border-background-200 bg-background-100/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-foreground-500">Membro {idx + 1}</span>
                  {members.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remover membro"
                      onClick={() => setMembers((prev) => prev.filter((x) => x.id !== m.id))}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Nome">
                    <input
                      className={inputClass}
                      list="cipa-collaborators"
                      value={m.name}
                      onChange={(e) => handleName(m.id, e.target.value)}
                      placeholder="Nome do membro"
                    />
                  </Field>
                  <Field label="Função na empresa">
                    <input className={inputClass} value={m.roleFunction} onChange={(e) => updateMember(m.id, { roleFunction: e.target.value })} placeholder="Ex.: Soldador" />
                  </Field>
                  <Field label="Área / Setor">
                    <div className="relative">
                      <select className={selectClass} value={m.area} onChange={(e) => updateMember(m.id, { area: e.target.value })}>
                        <option value="">Selecione</option>
                        {collaboratorAreas.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                    </div>
                  </Field>
                  <Field label="Matrícula">
                    <input className={inputClass} value={m.registration} onChange={(e) => updateMember(m.id, { registration: e.target.value })} placeholder="Ex.: 100234" />
                  </Field>
                  <Field label="Cargo na CIPA">
                    <div className="relative">
                      <select className={selectClass} value={m.memberRole} onChange={(e) => updateMember(m.id, { memberRole: e.target.value as CipaMemberRole })}>
                        {cipaMemberRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                    </div>
                  </Field>
                  <Field label="Representação">
                    <div className="relative">
                      <select className={selectClass} value={m.representation} onChange={(e) => updateMember(m.id, { representation: e.target.value as CipaRepresentation })}>
                        {cipaRepresentations.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                    </div>
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMembers((prev) => [...prev, blankMember()])}
            className="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-md border border-dashed border-background-300 bg-background-50 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700"
          >
            <i className="ri-add-line text-base"></i>
            Adicionar membro
          </button>
        </section>
      </div>
      {gate.modal}
    </Modal>
  );
}