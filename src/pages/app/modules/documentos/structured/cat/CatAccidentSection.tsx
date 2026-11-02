import { Field, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  catAccidentTypes,
  catBodyParts,
  catCausalAgents,
  catYesNo,
} from "@/pages/app/modules/documentos/structured/cat/catData";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatAccidentSectionProps {
  value: CatPayload;
  onChange: (patch: Partial<CatPayload>) => void;
}

/**
 * Bloco 3 da CAT — dados do acidente ou da doença ocupacional.
 * Tipo/espécie, data e hora, horas trabalhadas, local, descrição detalhada,
 * agente causador e parte do corpo atingida conforme tabelas oficiais,
 * além do registro policial quando houver.
 */
export default function CatAccidentSection({ value, onChange }: CatAccidentSectionProps) {
  const isDisease = value.accidentType === "Doença ocupacional / profissional";

  return (
    <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-error-warning-line text-base text-accent-700"></i>
          3. Acidente ou doença ocupacional
        </h3>
        <span className="text-[11px] text-foreground-400">Agente e parte do corpo conforme tabela oficial</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tipo / espécie" required className="sm:col-span-2">
          <div className="relative">
            <select
              className={selectClass}
              value={value.accidentType}
              onChange={(e) => onChange({ accidentType: e.target.value })}
            >
              {catAccidentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label={isDisease ? "Data do início da incapacidade" : "Data do acidente"} required>
          <input
            type="date"
            className={inputClass}
            value={value.accidentDate}
            onChange={(e) => onChange({ accidentDate: e.target.value })}
          />
        </Field>

        <Field label="Hora da ocorrência">
          <input
            type="time"
            className={inputClass}
            value={value.accidentTime}
            onChange={(e) => onChange({ accidentTime: e.target.value })}
          />
        </Field>

        <Field label="Após quantas horas de trabalho" hint="Tempo decorrido desde o início da jornada">
          <input
            className={inputClass}
            value={value.hoursWorked}
            onChange={(e) => onChange({ hoursWorked: e.target.value })}
            placeholder="Ex.: 3h20"
          />
        </Field>

        <Field label="Local exato da ocorrência" className="sm:col-span-3">
          <input
            className={inputClass}
            value={value.accidentLocation}
            onChange={(e) => onChange({ accidentLocation: e.target.value })}
            placeholder="Ex.: Galpão 2 — setor de prensas, próximo à bancada 4"
          />
        </Field>

        <Field label="Agente causador" required className="sm:col-span-2">
          <div className="relative">
            <select
              className={selectClass}
              value={value.causalAgentCode}
              onChange={(e) => {
                const selected = catCausalAgents.find((agent) => agent.code === e.target.value);
                onChange({ causalAgentCode: e.target.value, causalAgent: selected?.name ?? "" });
              }}
            >
              <option value="">Selecione o agente causador</option>
              {catCausalAgents.map((agent) => (
                <option key={agent.code} value={agent.code}>
                  {agent.code} — {agent.name}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Parte do corpo atingida" required className="sm:col-span-2">
          <div className="relative">
            <select
              className={selectClass}
              value={value.bodyPartCode}
              onChange={(e) => {
                const selected = catBodyParts.find((part) => part.code === e.target.value);
                onChange({ bodyPartCode: e.target.value, bodyPart: selected?.name ?? "" });
              }}
            >
              <option value="">Selecione a parte do corpo</option>
              {catBodyParts.map((part) => (
                <option key={part.code} value={part.code}>
                  {part.code} — {part.name}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>
      </div>

      <Field
        label={isDisease ? "Descrição da doença e do diagnóstico" : "Descrição detalhada de como ocorreu"}
        required
        hint="Sequência do evento, atividade em execução, agente envolvido e o que provocou a lesão."
      >
        <textarea
          className={`${inputClass} min-h-[96px] resize-y`}
          value={value.accidentDescription}
          onChange={(e) => onChange({ accidentDescription: e.target.value })}
          maxLength={2000}
          placeholder="Descreva objetivamente o ocorrido."
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-background-200 bg-background-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Houve registro policial (BO)">
          <div className="relative">
            <select
              className={selectClass}
              value={value.policeReport}
              onChange={(e) =>
                onChange({
                  policeReport: e.target.value,
                  ...(e.target.value === "Não"
                    ? { policeReportNumber: "", policeReportUnit: "", policeReportDate: "" }
                    : {}),
                })
              }
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

        {value.policeReport === "Sim" && (
          <>
            <Field label="Nº do boletim de ocorrência">
              <input
                className={inputClass}
                value={value.policeReportNumber}
                onChange={(e) => onChange({ policeReportNumber: e.target.value })}
                placeholder="Nº do BO"
              />
            </Field>
            <Field label="Delegacia / unidade">
              <input
                className={inputClass}
                value={value.policeReportUnit}
                onChange={(e) => onChange({ policeReportUnit: e.target.value })}
                placeholder="Ex.: 3º DP — Santo André"
              />
            </Field>
            <Field label="Data do registro">
              <input
                type="date"
                className={inputClass}
                value={value.policeReportDate}
                onChange={(e) => onChange({ policeReportDate: e.target.value })}
              />
            </Field>
          </>
        )}
      </div>
    </section>
  );
}