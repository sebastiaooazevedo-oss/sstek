import { Field, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  catCidSuggestions,
  catConsequences,
  catYesNo,
} from "@/pages/app/modules/documentos/structured/cat/catData";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatMedicalSectionProps {
  value: CatPayload;
  onChange: (patch: Partial<CatPayload>) => void;
}

/**
 * Bloco 4 da CAT — atendimento médico e consequências.
 * Atendimento emergencial, unidade de saúde, profissional responsável,
 * diagnóstico com CID, afastamento com último dia trabalhado e o desfecho
 * (incapacidade temporária, permanente ou óbito).
 */
export default function CatMedicalSection({ value, onChange }: CatMedicalSectionProps) {
  const isDeath = value.consequence === "Óbito";

  return (
    <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-hospital-line text-base text-primary-700"></i>
          4. Atendimento médico e consequências
        </h3>
        <span className="text-[11px] text-foreground-400">CID conforme atestado médico</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Houve atendimento médico" required>
          <div className="relative">
            <select
              className={selectClass}
              value={value.medicalCare}
              onChange={(e) => onChange({ medicalCare: e.target.value })}
            >
              {catYesNo.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Data do atendimento">
          <input
            type="date"
            className={inputClass}
            value={value.medicalDate}
            onChange={(e) => onChange({ medicalDate: e.target.value })}
          />
        </Field>

        <Field label="Unidade de saúde" className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.medicalUnit}
            onChange={(e) => onChange({ medicalUnit: e.target.value })}
            placeholder="Ex.: Hospital Mário Covas — Santo André/SP"
          />
        </Field>

        <Field label="Profissional responsável" className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.medicalDoctor}
            onChange={(e) => onChange({ medicalDoctor: e.target.value })}
            placeholder="Nome do médico que prestou o atendimento"
          />
        </Field>

        <Field label="CRM do profissional">
          <input
            className={inputClass}
            value={value.medicalCrm}
            onChange={(e) => onChange({ medicalCrm: e.target.value })}
            placeholder="Ex.: CRM-SP 123456"
          />
        </Field>

        <Field label="CID" required hint="Código Internacional de Doenças (CID-10)">
          <input
            className={inputClass}
            value={value.cid}
            onChange={(e) => onChange({ cid: e.target.value.toUpperCase() })}
            placeholder="Ex.: S62.6"
          />
        </Field>

        <Field label="Diagnóstico médico" className="sm:col-span-2 lg:col-span-4">
          <input
            className={inputClass}
            value={value.diagnosis}
            onChange={(e) => onChange({ diagnosis: e.target.value })}
            placeholder="Descrição do diagnóstico conforme atestado"
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-foreground-700">Sugestões de CID mais usadas</p>
        <div className="flex flex-wrap gap-1.5">
          {catCidSuggestions.map((item) => {
            const active = value.cid === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => onChange({ cid: item.code, diagnosis: value.diagnosis || item.name })}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "border-primary-300 bg-primary-100 text-primary-800"
                    : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300"
                }`}
              >
                <i className={active ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}></i>
                {item.code} · {item.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-background-200 bg-background-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Houve afastamento do trabalho">
          <div className="relative">
            <select
              className={selectClass}
              value={value.leaveWork}
              onChange={(e) => onChange({ leaveWork: e.target.value })}
            >
              {catYesNo.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Último dia efetivamente trabalhado">
          <input
            type="date"
            className={inputClass}
            value={value.lastWorkedDay}
            onChange={(e) => onChange({ lastWorkedDay: e.target.value })}
          />
        </Field>

        <Field label="Consequência do acidente" required className="sm:col-span-2">
          <div className="relative">
            <select
              className={selectClass}
              value={value.consequence}
              onChange={(e) => onChange({ consequence: e.target.value })}
            >
              {catConsequences.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        {isDeath && (
          <Field label="Data do óbito" required className="sm:col-span-2">
            <input
              type="date"
              className={inputClass}
              value={value.deathDate}
              onChange={(e) => onChange({ deathDate: e.target.value })}
            />
          </Field>
        )}
      </div>

      {isDeath && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900">
          <i className="ri-alarm-warning-line mt-0.5 text-base"></i>
          <span>
            Em caso de óbito, a CAT deve ser emitida <strong>imediatamente</strong> à autoridade competente,
            independentemente do prazo de 1 dia útil, e comunicada também ao sindicato da categoria.
          </span>
        </div>
      )}
    </section>
  );
}