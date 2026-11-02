import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import PhotoUploadField from "@/pages/app/modules/cipa/components/PhotoUploadField";
import { collaboratorAreas, collaboratorEstablishments } from "@/mocks/collaborators";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { generateId } from "@/pages/app/modules/cipa/cipaUtils";
import {
  inspectionItemStatuses,
  inspectionItems,
  inspectionRiskLevels,
  type Cipa,
  type CipaInspection,
  type CipaPhoto,
  type InspectionItem,
} from "@/mocks/cipa";

interface CipaInspectionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (inspection: CipaInspection) => void;
  cipas: Cipa[];
}

function emptyChecklist(): InspectionItem[] {
  return inspectionItems.map((item) => ({ ...item, status: "", note: "" }));
}

export default function CipaInspectionModal({ open, onClose, onSave, cipas }: CipaInspectionModalProps) {
  const [cipaId, setCipaId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [establishment, setEstablishment] = useState("");
  const [responsible, setResponsible] = useState("");
  const [checklist, setChecklist] = useState<InspectionItem[]>(emptyChecklist);
  const [nonConformities, setNonConformities] = useState("");
  const [risk, setRisk] = useState("Baixo");
  const [action, setAction] = useState("");
  const [actionOwner, setActionOwner] = useState("");
  const [actionDue, setActionDue] = useState("");
  const [photos, setPhotos] = useState<CipaPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCipaId(cipas[0]?.id || "");
    setTitle("");
    setDate("");
    setArea("");
    setLocation("");
    setEstablishment(collaboratorEstablishments[0] ?? "");
    setResponsible("");
    setChecklist(emptyChecklist());
    setNonConformities("");
    setRisk("Baixo");
    setAction("");
    setActionOwner("");
    setActionDue("");
    setPhotos([]);
    setNotes("");
    setError("");
  }, [open, cipas]);

  const updateItem = (id: string, patch: Partial<InspectionItem>) =>
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const nonConforming = checklist.filter((i) => i.status === "Não conforme").length;
  const conforming = checklist.filter((i) => i.status === "Conforme").length;

  const buildBody = () => {
    const rows = checklist
      .map(
        (i) => `<tr><td>${escapeHtml(i.label)}</td><td>${escapeHtml(i.status) || "Não avaliado"}</td><td>${escapeHtml(i.note) || "—"}</td></tr>`
      )
      .join("");
    const photoBlock = photos.length
      ? `<h2>Registro fotográfico</h2><div class="photo-grid">${photos
          .map((p) => `<figure><img src="${p.url}" alt="Registro da inspeção" /><figcaption>${escapeHtml(p.name)}</figcaption></figure>`)
          .join("")}</div>`
      : "";
    const cipaName = cipas.find((c) => c.id === cipaId)?.name || "—";
    return `${pdfHeader("Inspeção da CIPA (prévia)")}
      <h1>${escapeHtml(title.trim())}</h1>
      <p class="muted">${escapeHtml(cipaName)} · Inspeção de segurança vinculada à CIPA</p>
      <div class="grid">
        <div><strong>Data:</strong> ${escapeHtml(date) || "—"}</div>
        <div><strong>Unidade:</strong> ${escapeHtml(establishment) || "—"}</div>
        <div><strong>Área:</strong> ${escapeHtml(area) || "—"}</div>
        <div><strong>Local:</strong> ${escapeHtml(location) || "—"}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(responsible) || "—"}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${conforming}</b><span>Itens conformes</span></div>
        <div class="kpi"><b>${nonConforming}</b><span>Itens não conformes</span></div>
        <div class="kpi"><b>${photos.length}</b><span>Registros fotográficos</span></div>
      </div>
      <h2>Itens verificados</h2>
      <table><thead><tr><th>Item</th><th>Situação</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Não conformidades e ação</h2>
      <div class="grid"><div><strong>Grau de risco:</strong> ${escapeHtml(risk)}</div><div><strong>Responsável:</strong> ${escapeHtml(actionOwner) || "—"}</div><div><strong>Prazo:</strong> ${escapeHtml(actionDue) || "—"}</div></div>
      <p><strong>Desvios:</strong> ${escapeHtml(nonConformities.trim()) || "—"}</p>
      <p><strong>Ação corretiva:</strong> ${escapeHtml(action.trim()) || "—"}</p>
      ${photoBlock}
      <div class="cover-note">Prévia sem validade documental. A emissão definitiva do relatório de inspeção só é liberada após a assinatura eletrônica do Responsável Técnico, na lista de inspeções da CIPA.</div>
      ${pdfFooter()}`;
  };

  const handleExport = () => {
    if (title.trim().length < 3) return setError("Informe o título da inspeção para exportar.");
    setError("");
    printHtml(`Inspeção da CIPA — ${title.trim()}`, buildBody());
  };

  const handleSubmit = () => {
    if (!cipaId) return setError("Selecione a CIPA.");
    if (title.trim().length < 3) return setError("Informe o título da inspeção.");
    if (!date) return setError("Informe a data da inspeção.");
    setError("");
    onSave({
      id: generateId("ins"),
      cipaId,
      title: title.trim(),
      date,
      area: area.trim(),
      location: location.trim(),
      establishment,
      responsible: responsible.trim(),
      checklist,
      nonConformities: nonConformities.trim(),
      risk,
      action: action.trim(),
      actionOwner: actionOwner.trim(),
      actionDue,
      photos,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova inspeção da CIPA"
      subtitle="Registre a inspeção de segurança vinculada à comissão, com itens verificados e fotos."
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
          <ModalButton onClick={handleSubmit} icon="ri-save-3-line">
            Salvar inspeção
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-file-info-line text-base text-primary-700"></i>
            Identificação
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CIPA" required>
              <div className="relative">
                <select className={selectClass} value={cipaId} onChange={(e) => setCipaId(e.target.value)}>
                  <option value="">Selecione a CIPA</option>
                  {cipas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Data" required>
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Título da inspeção" required>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Inspeção de rotina — Setor de Solda" />
          </Field>
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
              <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Galpão 2 — linha de solda" />
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
          <Field label="Responsável pela inspeção">
            <input className={inputClass} value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Ex.: Aline Ferraz" />
          </Field>
        </section>

        <section className="flex flex-col gap-3 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
              Itens verificados
            </h3>
            <span className="text-[11px] text-foreground-400">
              {conforming} conforme(s) · {nonConforming} não conforme(s)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {checklist.map((item) => (
              <div key={item.id} className="rounded-lg border border-background-200 bg-background-100/50 p-3">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                  <p className="flex-1 text-sm font-medium text-foreground-900">{item.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {inspectionItemStatuses.map((s) => {
                      const active = item.status === s;
                      const tone = s === "Conforme" ? "primary" : s === "Não conforme" ? "accent" : "secondary";
                      const activeClass =
                        tone === "primary"
                          ? "bg-primary-500 text-background-50"
                          : tone === "accent"
                            ? "bg-accent-500 text-foreground-950"
                            : "bg-secondary-500 text-background-50";
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateItem(item.id, { status: s })}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                            active ? activeClass : "bg-background-200 text-foreground-600 hover:bg-background-300"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {item.status === "Não conforme" && (
                  <input
                    className={`${inputClass} mt-2.5`}
                    value={item.note}
                    onChange={(e) => updateItem(item.id, { note: e.target.value })}
                    placeholder="Descreva a não conformidade observada"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-error-warning-line text-base text-accent-700"></i>
            Não conformidades e ação
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Grau de risco">
              <div className="relative">
                <select className={selectClass} value={risk} onChange={(e) => setRisk(e.target.value)}>
                  {inspectionRiskLevels.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Responsável pela ação">
              <input className={inputClass} value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} placeholder="Ex.: Manutenção" />
            </Field>
            <Field label="Prazo">
              <input className={inputClass} value={actionDue} onChange={(e) => setActionDue(e.target.value)} placeholder="dd/mm/aaaa" />
            </Field>
          </div>
          <Field label="Desvios identificados">
            <textarea className={`${inputClass} min-h-[80px] resize-y`} value={nonConformities} onChange={(e) => setNonConformities(e.target.value)} placeholder="Descreva as não conformidades observadas." />
          </Field>
          <Field label="Ação corretiva">
            <textarea className={`${inputClass} min-h-[80px] resize-y`} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Descreva as ações corretivas e o prazo." />
          </Field>
        </section>

        <div className="border-t border-background-200 pt-5">
          <PhotoUploadField value={photos} onChange={setPhotos} label="Registro fotográfico" hint="JPG ou PNG — anexe evidências das condições observadas" />
        </div>

        <Field label="Observações gerais">
          <textarea className={`${inputClass} min-h-[70px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações complementares." />
        </Field>
      </div>
    </Modal>
  );
}