import { Field, inputClass, selectClass } from "@/pages/app/components/Modal";
import { catEmployerDocTypes, catUfs } from "@/pages/app/modules/documentos/structured/cat/catData";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatEmployerSectionProps {
  value: CatPayload;
  onChange: (patch: Partial<CatPayload>) => void;
}

/**
 * Bloco 1 da CAT — informações do empregador.
 * Razão social, CNPJ/CEI/CPF, CNAE, endereço completo, CEP e telefone.
 * Os dados já cadastrados no sistema chegam preenchidos.
 */
export default function CatEmployerSection({ value, onChange }: CatEmployerSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-building-2-line text-base text-primary-700"></i>
          1. Informações do empregador
        </h3>
        <span className="text-[11px] text-foreground-400">Preenchido com os dados da empresa</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Razão social / nome" required className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.employerName}
            onChange={(e) => onChange({ employerName: e.target.value })}
            placeholder="Razão social da empresa"
          />
        </Field>

        <Field label="Tipo de documento" required>
          <div className="relative">
            <select
              className={selectClass}
              value={value.employerDocType}
              onChange={(e) => onChange({ employerDocType: e.target.value })}
            >
              {catEmployerDocTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Número do documento" required>
          <input
            className={inputClass}
            value={value.employerDoc}
            onChange={(e) => onChange({ employerDoc: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </Field>

        <Field label="CNAE" hint="Classificação Nacional de Atividades Econômicas">
          <input
            className={inputClass}
            value={value.employerCnae}
            onChange={(e) => onChange({ employerCnae: e.target.value })}
            placeholder="Ex.: 25.39-0-01"
          />
        </Field>

        <Field
          label="Unidade / estabelecimento"
          hint="Obrigatória — vincula o evento ao estabelecimento responsável"
          required
          className="sm:col-span-2"
        >
          <input
            className={`${inputClass} ${
              value.employerUnit.trim() ? "" : "border-accent-300 bg-accent-50/50"
            }`}
            list="cat-employer-units"
            value={value.employerUnit}
            onChange={(e) => onChange({ employerUnit: e.target.value })}
            placeholder="Ex.: Unidade Matriz — São Bernardo do Campo"
          />
          {!value.employerUnit.trim() && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-accent-700">
              <i className="ri-error-warning-line mt-px text-sm"></i>
              Selecione a unidade do evento. Sem ela a CAT não pode ser gerada.
            </p>
          )}
          <datalist id="cat-employer-units">
            {collaboratorEstablishments.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </Field>

        <Field label="Telefone">
          <input
            className={inputClass}
            value={value.employerPhone}
            onChange={(e) => onChange({ employerPhone: e.target.value })}
            placeholder="(11) 0000-0000"
          />
        </Field>

        <Field label="CEP">
          <input
            className={inputClass}
            value={value.employerCep}
            onChange={(e) => onChange({ employerCep: e.target.value })}
            placeholder="00000-000"
          />
        </Field>

        <Field label="Logradouro / rua" className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.employerStreet}
            onChange={(e) => onChange({ employerStreet: e.target.value })}
            placeholder="Rua, avenida, rodovia"
          />
        </Field>

        <Field label="Número">
          <input
            className={inputClass}
            value={value.employerNumber}
            onChange={(e) => onChange({ employerNumber: e.target.value })}
            placeholder="Ex.: 1200"
          />
        </Field>

        <Field label="Complemento">
          <input
            className={inputClass}
            value={value.employerComplement}
            onChange={(e) => onChange({ employerComplement: e.target.value })}
            placeholder="Galpão, bloco, sala"
          />
        </Field>

        <Field label="Bairro / distrito" className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.employerDistrict}
            onChange={(e) => onChange({ employerDistrict: e.target.value })}
            placeholder="Bairro"
          />
        </Field>

        <Field label="Cidade / município">
          <input
            className={inputClass}
            value={value.employerCity}
            onChange={(e) => onChange({ employerCity: e.target.value })}
            placeholder="Município"
          />
        </Field>

        <Field label="UF">
          <div className="relative">
            <select className={selectClass} value={value.employerUf} onChange={(e) => onChange({ employerUf: e.target.value })}>
              <option value="">—</option>
              {catUfs.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>
      </div>
    </section>
  );
}