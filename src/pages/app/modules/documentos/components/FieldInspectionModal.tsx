import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { collaboratorAreas, collaboratorEstablishments } from "@/mocks/collaborators";
import { escapeHtml, pdfFooter, pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import type { FieldInspectionRecord } from "@/pages/app/modules/documentos/fieldInspectionStore";
import InspectionChecklist from "@/pages/app/modules/documentos/components/InspectionChecklist";
import InspectedCollaboratorsField from "@/pages/app/modules/documentos/components/InspectedCollaboratorsField";
import {
  countNonConforming,
  emptyChecklist,
  inspectionChecklist,
  inspectionKinds,
  inspectionShifts,
  riskLevels,
  type ChecklistEntry,
  type InspectionKind,
  type InspectionPhoto,
  type InspectedPerson,
  type RiskLevel,
} from "@/pages/app/modules/documentos/components/inspectionData";

interface FieldInspectionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: FieldInspectionRecord) => void;
}

function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function FieldInspectionModal({ open, onClose, onSave }: FieldInspectionModalProps) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<InspectionKind>("Rotina");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [shift, setShift] = useState("");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [establishment, setEstablishment] = useState("");
  const [scope, setScope] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [inspectorRegistration, setInspectorRegistration] = useState("");
  const [inspectorRole, setInspectorRole] = useState("");
  const [checklist, setChecklist] = useState<Record<string, ChecklistEntry>>(() => emptyChecklist());
  const [nonConformities, setNonConformities] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("Baixo");
  const [action, setAction] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [inspected, setInspected] = useState<InspectedPerson[]>([]);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setKind("Rotina");
    setDate("");
    setTime("");
    setShift("");
    setArea("");
    setLocation("");
    setEstablishment(collaboratorEstablishments[0] ?? "");
    setScope("");
    setInspectorName("");
    setInspectorRegistration("");
    setInspectorRole("");
    setChecklist(emptyChecklist());
    setNonConformities("");
    setRisk("Baixo");
    setAction("");
    setActionOwner("");
    setActionDue("");
    setInspected([]);
    setPhotos([]);
    setNotes("");
    setError("");
  }, [open]);

  const nonConforming = useMemo(() => countNonConforming(checklist), [checklist]);
  const conforming = useMemo(
    () => inspectionChecklist.filter((i) => checklist[i.id]?.status === "Conforme").length,
    [checklist]
  );

  const updateChecklist = (id: string, patch: Partial<ChecklistEntry>) =>
    setChecklist((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPhotos((prev) => [
            ...prev,
            { id: `ph-${Date.now()}-${index}`, url: reader.result as string, name: file.name },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const buildBody = () => {
    const validationRows = inspectionChecklist
      .map((item) => {
        const entry = checklist[item.id] || { status: "", note: "" };
        const status = entry.status || "Não avaliado";
        return `<tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${escapeHtml(item.ref)}</td>
          <td>${escapeHtml(status)}</td>
          <td>${escapeHtml(entry.note.trim()) || "—"}</td>
        </tr>`;
      })
      .join("");

    const inspectedRows = inspected.length
      ? inspected
          .map(
            (p) => `<tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.cpf) || "—"}</td>
          <td>${escapeHtml(p.matricula) || "—"}</td>
          <td>${escapeHtml([p.role, p.area].filter(Boolean).join(" · ")) || "—"}</td>
          <td>${escapeHtml(p.situation)}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="5">Nenhum colaborador registrado.</td></tr>`;

    const photoBlock = photos.length
      ? `<div class="photo-grid">${photos
          .map(
            (p) =>
              `<figure><img src="${p.url}" alt="Registro fotográfico da inspeção" /><figcaption>${escapeHtml(
                p.name
              )}</figcaption></figure>`
          )
          .join("")}</div>`
      : `<p class="muted">Sem registro fotográfico anexado.</p>`;

    return `${pdfHeader("Inspeção de Campo")}
      <h1>${escapeHtml(title.trim())}</h1>
      <p class="muted">Registro de inspeção de segurança de campo (NR-1 / PGR).</p>
      <div class="grid">
        <div><strong>Tipo:</strong> ${escapeHtml(kind)}</div>
        <div><strong>Data:</strong> ${toBrDate(date)}${time ? ` às ${escapeHtml(time)}` : ""}</div>
        <div><strong>Turno:</strong> ${escapeHtml(shift) || "—"}</div>
        <div><strong>Área / Setor:</strong> ${escapeHtml(area) || "—"}</div>
        <div><strong>Local:</strong> ${escapeHtml(location) || "—"}</div>
        <div><strong>Unidade:</strong> ${escapeHtml(establishment) || "—"}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(inspectorName) || "—"}</div>
        <div><strong>Registro:</strong> ${escapeHtml(inspectorRegistration) || "—"}</div>
        <div><strong>Função:</strong> ${escapeHtml(inspectorRole) || "—"}</div>
      </div>
      <h2>Objeto / Escopo da inspeção</h2>
      <p>${escapeHtml(scope.trim()) || "—"}</p>
      <h2>Itens verificados</h2>
      <div class="kpis">
        <div class="kpi"><b>${conforming}</b><span>Itens conformes</span></div>
        <div class="kpi"><b>${nonConforming}</b><span>Itens não conformes</span></div>
        <div class="kpi"><b>${inspected.length}</b><span>Colaboradores vistoriados</span></div>
        <div class="kpi"><b>${photos.length}</b><span>Registros fotográficos</span></div>
      </div>
      <table>
        <thead><tr><th>Item verificado</th><th>Referência</th><th>Situação</th><th>Observação</th></tr></thead>
        <tbody>${validationRows}</tbody>
      </table>
      <h2>Não conformidades e ações</h2>
      <div class="grid">
        <div><strong>Grau de risco:</strong> ${escapeHtml(risk)}</div>
        <div><strong>Responsável pela ação:</strong> ${escapeHtml(actionOwner) || "—"}</div>
        <div><strong>Prazo:</strong> ${toBrDate(actionDue)}</div>
      </div>
      <p><strong>Desvios identificados:</strong> ${escapeHtml(nonConformities.trim()) || "—"}</p>
      <p><strong>Ação corretiva / recomendação:</strong> ${escapeHtml(action.trim()) || "—"}</p>
      <h2>Colaboradores vistoriados (${inspected.length})</h2>
      <table>
        <thead><tr><th>Nome</th><th>CPF</th><th>Matrícula</th><th>Função / Área</th><th>Situação</th></tr></thead>
        <tbody>${inspectedRows}</tbody>
      </table>
      <h2>Registro fotográfico</h2>
      ${photoBlock}
      <h2>Observações gerais</h2>
      <p>${escapeHtml(notes.trim()) || "—"}</p>
      ${pdfFooter()}`;
  };

  const handleExport = () => {
    if (title.trim().length < 3) {
      setError("Informe o título da inspeção para exportar em PDF.");
      return;
    }
    setError("");
    printHtml(`Inspeção de Campo — ${title.trim()}`, buildBody());
  };

  const handleSubmit = () => {
    if (title.trim().length < 3) {
      setError("Informe o título da inspeção.");
      return;
    }
    if (!date) {
      setError("Informe a data da inspeção.");
      return;
    }
    if (inspected.length === 0) {
      setError("Inclua ao menos um colaborador vistoriado.");
      return;
    }
    const record: FieldInspectionRecord = {
      id: `fi-${Date.now()}`,
      title: title.trim(),
      kind,
      date,
      time,
      shift,
      area,
      location,
      establishment,
      scope: scope.trim(),
      inspectorName: inspectorName.trim(),
      inspectorRegistration: inspectorRegistration.trim(),
      inspectorRole: inspectorRole.trim(),
      checklist,
      nonConformities: nonConformities.trim(),
      risk,
      action: action.trim(),
      actionOwner: actionOwner.trim(),
      actionDue,
      inspected,
      photos,
      notes: notes.trim(),
    };
    onSave(record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inspeção de Campo"
      subtitle="Registre a inspeção de segurança com os itens verificados, os colaboradores vistoriados e as fotos."
      icon="ri-clipboard-line"
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
            Gerar documento
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Identificação */}
        <section className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-file-info-line text-base text-primary-700"></i>
            Identificação
          </h3>
          <Field label="Título da inspeção" required className="md:col-span-2">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Inspeção de rotina — Pátio Industrial A"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tipo de inspeção" required>
              <div className="relative">
                <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as InspectionKind)}>
                  {inspectionKinds.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Data" required>
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Hora">
              <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Turno">
              <div className="relative">
                <select className={selectClass} value={shift} onChange={(e) => setShift(e.target.value)}>
                  <option value="">Selecione o turno</option>
                  {inspectionShifts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Área / Setor">
              <div className="relative">
                <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="">Selecione a área</option>
                  {collaboratorAreas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Local específico">
              <input
                className={inputClass}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex.: Galpão 2 — linha de solda"
              />
            </Field>
          </div>
          <Field label="Unidade / Estabelecimento" hint="Sugerida a partir das unidades cadastradas.">
            <div className="relative">
              <select className={selectClass} value={establishment} onChange={(e) => setEstablishment(e.target.value)}>
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
        </section>

        {/* Responsável */}
        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-user-star-line text-base text-primary-700"></i>
            Responsável pela inspeção
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Nome">
              <input
                className={inputClass}
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Ex.: Larissa Martins"
              />
            </Field>
            <Field label="Registro / CREA / CRM">
              <input
                className={inputClass}
                value={inspectorRegistration}
                onChange={(e) => setInspectorRegistration(e.target.value)}
                placeholder="Ex.: CREA-SP 5070123456"
              />
            </Field>
            <Field label="Função">
              <input
                className={inputClass}
                value={inspectorRole}
                onChange={(e) => setInspectorRole(e.target.value)}
                placeholder="Ex.: Engenheira de Segurança"
              />
            </Field>
          </div>
          <Field label="Objeto / Escopo da inspeção">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Descreva o objetivo e o escopo da inspeção (atividade, processo ou equipamento avaliado)."
            />
          </Field>
        </section>

        {/* Checklist */}
        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
              Itens verificados
            </h3>
            <span className="text-[11px] text-foreground-400">
              {conforming} conforme(s) · {nonConforming} não conforme(s)
            </span>
          </div>
          <InspectionChecklist value={checklist} onChange={updateChecklist} />
        </section>

        {/* Não conformidades e ações */}
        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-error-warning-line text-base text-accent-700"></i>
            Não conformidades e ações
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Grau de risco">
              <div className="relative">
                <select className={selectClass} value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
                  {riskLevels.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Responsável pela ação">
              <input
                className={inputClass}
                value={actionOwner}
                onChange={(e) => setActionOwner(e.target.value)}
                placeholder="Ex.: Manutenção"
              />
            </Field>
            <Field label="Prazo">
              <input type="date" className={inputClass} value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
            </Field>
          </div>
          <Field label="Desvios identificados">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={nonConformities}
              onChange={(e) => setNonConformities(e.target.value)}
              placeholder="Descreva as não conformidades e os desvios observados durante a inspeção."
            />
          </Field>
          <Field label="Ação corretiva / recomendação">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="Descreva as ações corretivas e o prazo para adequação."
            />
          </Field>
        </section>

        {/* Colaboradores vistoriados */}
        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-group-line text-base text-primary-700"></i>
              Colaboradores vistoriados
            </h3>
            <span className="text-[11px] text-foreground-400">{inspected.length} registrado(s)</span>
          </div>
          <InspectedCollaboratorsField value={inspected} onChange={setInspected} />
        </section>

        {/* Fotos */}
        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-camera-line text-base text-primary-700"></i>
              Registro fotográfico
            </h3>
            <span className="text-[11px] text-foreground-400">{photos.length} foto(s)</span>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-6 text-center transition-colors hover:border-primary-400">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-image-add-line text-2xl"></i>
            </span>
            <span className="text-sm font-semibold text-foreground-900">Adicionar fotos da inspeção</span>
            <span className="text-xs text-foreground-500">JPG ou PNG — anexe evidências das condições observadas</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p) => (
                <div key={p.id} className="group relative overflow-hidden rounded-lg border border-background-200 bg-background-100">
                  <div className="h-28 w-full">
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-foreground-950/60 text-background-50 transition-colors hover:bg-accent-600"
                  >
                    <i className="ri-close-line text-base"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Observações + assinatura */}
        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <Field label="Observações gerais">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações complementares da inspeção."
            />
          </Field>
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-pen-nib-line text-base text-primary-700"></i>
              <h3 className="text-sm font-bold text-foreground-950">Assinatura do responsável técnico</h3>
            </div>
            <SignatureFooter />
          </div>
        </section>
      </div>
    </Modal>
  );
}