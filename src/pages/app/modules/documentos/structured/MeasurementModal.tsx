import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import SignatureFooter from "@/pages/app/components/SignatureFooter";
import { collaboratorAreas, collaboratorEstablishments } from "@/mocks/collaborators";
import RowsEditor from "@/pages/app/modules/documentos/structured/components/RowsEditor";
import SmartChecklist from "@/pages/app/modules/documentos/structured/components/SmartChecklist";
import PhotoField from "@/pages/app/modules/documentos/structured/components/PhotoField";
import {
  checklistFromTemplates,
  equipmentCatalog,
  measurementNorms,
  measurementResults,
  uid,
  type ChecklistEntry,
  type MeasurementRow,
  type PhotoItem,
} from "@/pages/app/modules/documentos/structured/structuredData";
import type { MeasurementPayload, StructuredRecord } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface MeasurementModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (record: StructuredRecord) => void;
}

const CUSTOM_ID = "novo-equipamento";

function emptyRow(unit: string): MeasurementRow {
  return { id: uid("med"), point: "", duration: "", value: "", unit, limit: "", result: measurementResults[0] };
}

function emptyPayload(): MeasurementPayload {
  const first = equipmentCatalog[0];
  return {
    protocol: "",
    notes: "",
    checklist: checklistFromTemplates(first.items),
    photos: [],
    measurementDate: "",
    measurementTime: "",
    shift: "",
    establishment: collaboratorEstablishments[0] ?? "",
    area: "",
    location: "",
    activity: "",
    workerName: "",
    equipmentId: first.id,
    equipmentName: first.name,
    equipmentUnit: first.unit,
    equipmentRefs: first.refs,
    brand: "",
    model: "",
    serial: "",
    calibrationCertificate: "",
    calibrationLab: "",
    calibrationDate: "",
    calibrationExpiry: "",
    measurementRange: "",
    resolution: "",
    uncertainty: "",
    temperature: "",
    humidity: "",
    pressure: "",
    airVelocity: "",
    metabolicRate: "",
    norms: ["NR-9 — Avaliação de exposição ocupacional"],
    rows: [emptyRow(first.unit)],
    conclusion: "",
    technicianName: "",
    technicianRole: "",
    technicianRegistration: "",
    technicianCompany: "",
    witnessName: "",
  };
}

/**
 * Criação do documento "Aferições": registro da medição de agente ocupacional
 * com equipamento calibrado. O checklist inteligente acompanha o equipamento
 * escolhido (decibelímetro, dosímetro, luxímetro, IBUTG, bombas, detector de
 * gases, vibrômetro) e aceita um novo equipamento cadastrado na hora.
 */
export default function MeasurementModal({ open, onClose, onSave }: MeasurementModalProps) {
  const [form, setForm] = useState<MeasurementPayload>(emptyPayload);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(emptyPayload());
    setError("");
  }, [open]);

  const set = (patch: Partial<MeasurementPayload>) => setForm((prev) => ({ ...prev, ...patch }));

  const isCustom = form.equipmentId === CUSTOM_ID;

  const suggestions = useMemo(() => {
    const def = equipmentCatalog.find((item) => item.id === form.equipmentId);
    return def ? def.items : [];
  }, [form.equipmentId]);

  const handleEquipment = (id: string) => {
    if (id === CUSTOM_ID) {
      set({
        equipmentId: CUSTOM_ID,
        equipmentName: "",
        equipmentUnit: "",
        equipmentRefs: "",
        checklist: [],
        rows: [emptyRow("")],
      });
      return;
    }
    const def = equipmentCatalog.find((item) => item.id === id);
    if (!def) return;
    set({
      equipmentId: def.id,
      equipmentName: def.name,
      equipmentUnit: def.unit,
      equipmentRefs: def.refs,
      checklist: checklistFromTemplates(def.items),
      rows: [emptyRow(def.unit)],
    });
  };

  const toggleNorm = (norm: string) => {
    set({
      norms: form.norms.includes(norm) ? form.norms.filter((item) => item !== norm) : [...form.norms, norm],
    });
  };

  const handleSubmit = () => {
    if (!form.measurementDate) {
      setError("Informe a data da aferição.");
      return;
    }
    if (!form.equipmentName.trim()) {
      setError("Informe o equipamento utilizado na aferição.");
      return;
    }
    if (!form.rows.some((row) => row.value.trim())) {
      setError("Registre ao menos uma medição com o valor encontrado.");
      return;
    }
    if (!form.technicianName.trim()) {
      setError("Informe quem realizou a aferição (responsável técnico).");
      return;
    }
    setError("");
    const title = [form.equipmentName, form.location || form.area].filter(Boolean).join(" · ");
    onSave({
      id: uid("afericao"),
      kind: "afericoes",
      title,
      date: form.measurementDate,
      establishment: form.establishment,
      payload: form,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-equalizer-2-line"
      title="Aferições"
      subtitle="Registro da medição com equipamento calibrado: dados do instrumento, condições ambientais, pontos medidos e assinatura de quem realizou."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-file-add-line">
            Gerar documento
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-map-pin-line text-base text-primary-700"></i>
            Local e identificação
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Data da aferição" required>
              <input
                type="date"
                className={inputClass}
                value={form.measurementDate}
                onChange={(e) => set({ measurementDate: e.target.value })}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                className={inputClass}
                value={form.measurementTime}
                onChange={(e) => set({ measurementTime: e.target.value })}
              />
            </Field>
            <Field label="Nº de controle / protocolo">
              <input
                className={inputClass}
                value={form.protocol}
                onChange={(e) => set({ protocol: e.target.value })}
                placeholder="Ex.: AF-2026-032"
              />
            </Field>
            <Field label="Unidade / estabelecimento">
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.establishment}
                  onChange={(e) => set({ establishment: e.target.value })}
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
            <Field label="Área / setor">
              <div className="relative">
                <select className={selectClass} value={form.area} onChange={(e) => set({ area: e.target.value })}>
                  <option value="">Selecione a área</option>
                  {collaboratorAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            <Field label="Local exato da medição">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Ex.: Posto de solda — bancada 3"
              />
            </Field>
            <Field label="Atividade / função avaliada">
              <input
                className={inputClass}
                value={form.activity}
                onChange={(e) => set({ activity: e.target.value })}
                placeholder="Ex.: Soldador — jornada de 8h"
              />
            </Field>
            <Field label="Trabalhador avaliado">
              <input
                className={inputClass}
                value={form.workerName}
                onChange={(e) => set({ workerName: e.target.value })}
                placeholder="Nome (quando individual)"
              />
            </Field>
            <Field label="Turno">
              <input
                className={inputClass}
                value={form.shift}
                onChange={(e) => set({ shift: e.target.value })}
                placeholder="Ex.: 1º Turno"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-tools-line text-base text-primary-700"></i>
            Equipamento de medição
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo de equipamento" required>
              <div className="relative">
                <select
                  className={selectClass}
                  value={form.equipmentId}
                  onChange={(e) => handleEquipment(e.target.value)}
                >
                  {equipmentCatalog.map((equipment) => (
                    <option key={equipment.id} value={equipment.id}>
                      {equipment.name}
                    </option>
                  ))}
                  <option value={CUSTOM_ID}>+ Novo equipamento</option>
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </Field>
            {isCustom ? (
              <>
                <Field label="Nome do novo equipamento" required>
                  <input
                    className={inputClass}
                    value={form.equipmentName}
                    onChange={(e) => set({ equipmentName: e.target.value })}
                    placeholder="Ex.: Medidor de estresse térmico"
                  />
                </Field>
                <Field label="Unidade de medida">
                  <input
                    className={inputClass}
                    value={form.equipmentUnit}
                    onChange={(e) => set({ equipmentUnit: e.target.value })}
                    placeholder="Ex.: °C / IBUTG"
                  />
                </Field>
                <Field label="Norma / referência" className="sm:col-span-2 lg:col-span-3">
                  <input
                    className={inputClass}
                    value={form.equipmentRefs}
                    onChange={(e) => set({ equipmentRefs: e.target.value })}
                    placeholder="Ex.: NR-15 Anexo 3 · NR-9"
                  />
                </Field>
              </>
            ) : (
              <Field label="Normas de referência" className="sm:col-span-2">
                <div className="flex items-center gap-2 rounded-md border border-background-200 bg-background-100 px-3 py-2.5 text-sm text-foreground-700">
                  <i className="ri-book-open-line text-base text-secondary-700"></i>
                  {form.equipmentRefs || "—"}
                </div>
              </Field>
            )}
            <Field label="Marca">
              <input className={inputClass} value={form.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Ex.: RION" />
            </Field>
            <Field label="Modelo">
              <input className={inputClass} value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="Ex.: NL-52" />
            </Field>
            <Field label="Nº de série">
              <input className={inputClass} value={form.serial} onChange={(e) => set({ serial: e.target.value })} placeholder="Ex.: 80421357" />
            </Field>
            <Field label="Faixa de medição">
              <input
                className={inputClass}
                value={form.measurementRange}
                onChange={(e) => set({ measurementRange: e.target.value })}
                placeholder="Ex.: 30 a 130 dB"
              />
            </Field>
            <Field label="Resolução">
              <input
                className={inputClass}
                value={form.resolution}
                onChange={(e) => set({ resolution: e.target.value })}
                placeholder="Ex.: 0,1 dB"
              />
            </Field>
            <Field label="Incerteza de medição">
              <input
                className={inputClass}
                value={form.uncertainty}
                onChange={(e) => set({ uncertainty: e.target.value })}
                placeholder="Ex.: ± 1,5 dB"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-background-200 bg-background-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Certificado de calibração nº">
              <input
                className={inputClass}
                value={form.calibrationCertificate}
                onChange={(e) => set({ calibrationCertificate: e.target.value })}
                placeholder="Ex.: RBC 0001234/2026"
              />
            </Field>
            <Field label="Laboratório / RBC">
              <input
                className={inputClass}
                value={form.calibrationLab}
                onChange={(e) => set({ calibrationLab: e.target.value })}
                placeholder="Ex.: Lab. acreditado RBC"
              />
            </Field>
            <Field label="Data da calibração">
              <input
                type="date"
                className={inputClass}
                value={form.calibrationDate}
                onChange={(e) => set({ calibrationDate: e.target.value })}
              />
            </Field>
            <Field label="Validade da calibração">
              <input
                type="date"
                className={inputClass}
                value={form.calibrationExpiry}
                onChange={(e) => set({ calibrationExpiry: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-temp-hot-line text-base text-primary-700"></i>
            Condições ambientais
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Temperatura (°C)">
              <input className={inputClass} value={form.temperature} onChange={(e) => set({ temperature: e.target.value })} placeholder="Ex.: 27,4" />
            </Field>
            <Field label="Umidade (%)">
              <input className={inputClass} value={form.humidity} onChange={(e) => set({ humidity: e.target.value })} placeholder="Ex.: 62" />
            </Field>
            <Field label="Pressão (hPa)">
              <input className={inputClass} value={form.pressure} onChange={(e) => set({ pressure: e.target.value })} placeholder="Ex.: 913" />
            </Field>
            <Field label="Velocidade do ar (m/s)">
              <input className={inputClass} value={form.airVelocity} onChange={(e) => set({ airVelocity: e.target.value })} placeholder="Ex.: 0,6" />
            </Field>
            <Field label="Taxa metabólica / atividade">
              <input
                className={inputClass}
                value={form.metabolicRate}
                onChange={(e) => set({ metabolicRate: e.target.value })}
                placeholder="Ex.: 300 kcal/h"
              />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-foreground-700">Normas aplicáveis à avaliação</p>
            <div className="flex flex-wrap gap-1.5">
              {measurementNorms.map((norm) => {
                const active = form.norms.includes(norm);
                return (
                  <button
                    key={norm}
                    type="button"
                    onClick={() => toggleNorm(norm)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-primary-300 bg-primary-100 text-primary-800"
                        : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300"
                    }`}
                  >
                    <i className={active ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}></i>
                    {norm}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-ruler-2-line text-base text-primary-700"></i>
              Medições realizadas
            </h3>
            <span className="text-[11px] text-foreground-400">Valor medido × limite da NR-15</span>
          </div>
          <RowsEditor
            value={form.rows}
            onChange={(rows) => set({ rows })}
            addLabel="Adicionar ponto de medição"
            emptyText="Nenhuma medição registrada."
            columns={[
              { key: "point", label: "Ponto / local", placeholder: "Ex.: Bancada 3 — altura do ouvido" },
              { key: "duration", label: "Tempo de amostragem", placeholder: "Ex.: 15 min / jornada 8h" },
              { key: "value", label: "Valor medido", placeholder: "Ex.: 89,6" },
              { key: "unit", label: "Unidade", placeholder: "dB(A)" },
              { key: "limit", label: "Limite / nível de ação", placeholder: "Ex.: 85 dB(A) / 80 dB(A)" },
              { key: "result", label: "Resultado", type: "select", options: measurementResults },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <Field label="Conclusão técnica">
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={form.conclusion}
              onChange={(e) => set({ conclusion: e.target.value })}
              placeholder="Parecer sobre a exposição, comparação com os limites e medidas de controle recomendadas."
            />
          </Field>
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-checkbox-multiple-line text-base text-primary-700"></i>
              Checklist inteligente da aferição
            </h3>
            <span className="text-[11px] text-foreground-400">Itens conforme o equipamento selecionado</span>
          </div>
          <SmartChecklist
            value={form.checklist}
            onChange={(checklist: ChecklistEntry[]) => set({ checklist })}
            suggestions={suggestions}
            emptyHint="Selecione o equipamento para receber as sugestões de verificação."
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <PhotoField
            value={form.photos}
            onChange={(photos: PhotoItem[]) => set({ photos })}
            title="Fotos da medição e do equipamento"
            hint="Anexe fotos do equipamento (número de série), do ponto medido e do certificado de calibração."
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
          <Field label="Local e observações">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Observações sobre o local, interferências, condições de trabalho e desvios observados."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Quem realizou a aferição" required>
              <input
                className={inputClass}
                value={form.technicianName}
                onChange={(e) => set({ technicianName: e.target.value })}
                placeholder="Nome completo"
              />
            </Field>
            <Field label="Função">
              <input
                className={inputClass}
                value={form.technicianRole}
                onChange={(e) => set({ technicianRole: e.target.value })}
                placeholder="Ex.: Técnico em Segurança do Trabalho"
              />
            </Field>
            <Field label="Registro (CREA / MTE)">
              <input
                className={inputClass}
                value={form.technicianRegistration}
                onChange={(e) => set({ technicianRegistration: e.target.value })}
                placeholder="Ex.: MTE 0032145"
              />
            </Field>
            <Field label="Empresa / laboratório">
              <input
                className={inputClass}
                value={form.technicianCompany}
                onChange={(e) => set({ technicianCompany: e.target.value })}
                placeholder="Ex.: SSTEK Serviços"
              />
            </Field>
            <Field label="Testemunha / acompanhante" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.witnessName}
                onChange={(e) => set({ witnessName: e.target.value })}
                placeholder="Nome de quem acompanhou a medição"
              />
            </Field>
          </div>
          <div className="rounded-lg border border-background-200 bg-background-100 p-4">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-pen-nib-line text-base text-primary-700"></i>
              <h3 className="text-sm font-bold text-foreground-950">Assinatura de quem realizou a aferição</h3>
            </div>
            <SignatureFooter />
          </div>
        </section>
      </div>
    </Modal>
  );
}