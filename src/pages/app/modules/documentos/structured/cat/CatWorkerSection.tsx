import { useMemo, useState } from "react";
import { Field, inputClass, selectClass } from "@/pages/app/components/Modal";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  catCboSuggestions,
  catMaritalStatuses,
  catSexes,
  catUfs,
  onlyDigits,
  splitCityUf,
  toIsoFromBr,
} from "@/pages/app/modules/documentos/structured/cat/catData";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatWorkerSectionProps {
  value: CatPayload;
  onChange: (patch: Partial<CatPayload>) => void;
}

/** Procura um CBO aproximado a partir da função cadastrada. */
function suggestCbo(role: string): string {
  const target = role.trim().toLowerCase();
  if (!target) return "";
  const found = catCboSuggestions.find(
    (item) => target.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(target)
  );
  return found ? found.code : "";
}

/**
 * Bloco 2 da CAT — informações do trabalhador acidentado.
 * A busca por nome ou CPF carrega o cadastro do colaborador (CPF, RG, CTPS,
 * NIT/PIS, matrícula, nascimento, sexo, função e endereço parcial) e deixa
 * apenas os dados que o sistema não possui para completar.
 */
export default function CatWorkerSection({ value, onChange }: CatWorkerSectionProps) {
  const collaborators = useCollaboratorsList();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loadedName, setLoadedName] = useState("");

  const results = useMemo(() => {
    const term = query.trim();
    if (term.length < 2) return [];
    const digits = onlyDigits(term);
    return collaborators
      .filter((c) => {
        const byName = c.name.toLowerCase().includes(term.toLowerCase());
        const byCpf = digits.length >= 3 && onlyDigits(c.cpf).includes(digits);
        const byRegistration = c.matricula.includes(term);
        return byName || byCpf || byRegistration;
      })
      .slice(0, 6);
  }, [collaborators, query]);

  const pick = (collaboratorId: string) => {
    const person = collaborators.find((c) => c.id === collaboratorId);
    if (!person) return;
    const { city, uf } = splitCityUf(person.city);
    onChange({
      workerCollaboratorId: person.id,
      workerName: person.name,
      workerCpf: person.cpf,
      workerRg: person.rg,
      workerCtps: person.ctps,
      workerNit: person.pis,
      workerEsocial: person.matricula,
      workerBirth: toIsoFromBr(person.birthDate),
      workerAdmission: toIsoFromBr(person.admissionDate),
      workerCategory: person.area,
      workerCbo: suggestCbo(person.role),
      workerCity: city,
      workerUf: uf,
      workerPhone: person.phone,
      // A unidade da CAT acompanha a unidade do trabalhador quando ainda não definida.
      employerUnit: value.employerUnit || person.establishment || "",
    });
    setLoadedName(person.name);
    setQuery("");
    setOpen(false);
  };

  return (
    <section className="flex flex-col gap-4 border-t border-background-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
          <i className="ri-user-heart-line text-base text-primary-700"></i>
          2. Trabalhador acidentado
        </h3>
        {loadedName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-800">
            <i className="ri-checkbox-circle-fill"></i>
            Dados carregados de {loadedName}
          </span>
        )}
      </div>

      <div className="relative">
        <Field
          label="Buscar colaborador por nome, CPF ou matrícula"
          hint="Os dados pessoais do cadastro são preenchidos automaticamente."
        >
          <div className="relative">
            <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
            <input
              className={`${inputClass} pl-9`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Digite o nome ou o CPF do trabalhador"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-foreground-400 hover:bg-background-100 hover:text-foreground-800"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </div>
        </Field>

        {open && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-background-200 bg-background-50 shadow-xl">
            {results.length === 0 ? (
              <p className="px-3.5 py-3 text-xs text-foreground-500">
                Nenhum colaborador encontrado para “{query.trim()}”.
              </p>
            ) : (
              results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => pick(person.id)}
                  className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-background-100"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-background-200">
                    <img src={person.photo} alt={person.name} className="h-full w-full object-top" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground-950">
                      {person.name}
                    </span>
                    <span className="block truncate text-[11px] text-foreground-500">
                      {person.role} · {person.area} · CPF {person.cpf}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                    {person.matricula}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nome completo" required className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.workerName}
            onChange={(e) => onChange({ workerName: e.target.value })}
            placeholder="Nome do trabalhador acidentado"
          />
        </Field>
        <Field label="CPF" required>
          <input
            className={inputClass}
            value={value.workerCpf}
            onChange={(e) => onChange({ workerCpf: e.target.value })}
            placeholder="000.000.000-00"
          />
        </Field>
        <Field label="RG">
          <input
            className={inputClass}
            value={value.workerRg}
            onChange={(e) => onChange({ workerRg: e.target.value })}
            placeholder="00.000.000-0"
          />
        </Field>

        <Field label="Data de nascimento">
          <input
            type="date"
            className={inputClass}
            value={value.workerBirth}
            onChange={(e) => onChange({ workerBirth: e.target.value })}
          />
        </Field>
        <Field label="Sexo">
          <div className="relative">
            <select
              className={selectClass}
              value={value.workerSex}
              onChange={(e) => onChange({ workerSex: e.target.value })}
            >
              <option value="">Não informado</option>
              {catSexes.map((sex) => (
                <option key={sex} value={sex}>
                  {sex}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>
        <Field label="Estado civil">
          <div className="relative">
            <select
              className={selectClass}
              value={value.workerMarital}
              onChange={(e) => onChange({ workerMarital: e.target.value })}
            >
              <option value="">Não informado</option>
              {catMaritalStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>
        <Field label="Data de admissão">
          <input
            type="date"
            className={inputClass}
            value={value.workerAdmission}
            onChange={(e) => onChange({ workerAdmission: e.target.value })}
          />
        </Field>

        <Field label="Carteira de trabalho (CTPS)">
          <input
            className={inputClass}
            value={value.workerCtps}
            onChange={(e) => onChange({ workerCtps: e.target.value })}
            placeholder="Nº / série"
          />
        </Field>
        <Field label="NIT / PIS / PASEP / NIS">
          <input
            className={inputClass}
            value={value.workerNit}
            onChange={(e) => onChange({ workerNit: e.target.value })}
            placeholder="000.00000.00-0"
          />
        </Field>
        <Field label="Matrícula no eSocial">
          <input
            className={inputClass}
            value={value.workerEsocial}
            onChange={(e) => onChange({ workerEsocial: e.target.value })}
            placeholder="Matrícula do trabalhador"
          />
        </Field>
        <Field label="CBO" hint="Classificação Brasileira de Ocupações">
          <input
            className={inputClass}
            value={value.workerCbo}
            onChange={(e) => onChange({ workerCbo: e.target.value })}
            placeholder="Ex.: 7243-15"
          />
        </Field>

        <Field label="Área / categoria de atuação">
          <input
            className={inputClass}
            value={value.workerCategory}
            onChange={(e) => onChange({ workerCategory: e.target.value })}
            placeholder="Ex.: Produção"
          />
        </Field>
        <Field label="Salário / remuneração">
          <input
            className={inputClass}
            value={value.workerSalary}
            onChange={(e) => onChange({ workerSalary: e.target.value })}
            placeholder="Ex.: R$ 3.480,00"
          />
        </Field>
        <Field label="Telefone do trabalhador">
          <input
            className={inputClass}
            value={value.workerPhone}
            onChange={(e) => onChange({ workerPhone: e.target.value })}
            placeholder="(11) 90000-0000"
          />
        </Field>
        <Field label="CEP residencial">
          <input
            className={inputClass}
            value={value.workerCep}
            onChange={(e) => onChange({ workerCep: e.target.value })}
            placeholder="00000-000"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-background-200 bg-background-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Endereço residencial (rua)" className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.workerStreet}
            onChange={(e) => onChange({ workerStreet: e.target.value })}
            placeholder="Rua, avenida, travessa"
          />
        </Field>
        <Field label="Número">
          <input
            className={inputClass}
            value={value.workerNumber}
            onChange={(e) => onChange({ workerNumber: e.target.value })}
            placeholder="Ex.: 245"
          />
        </Field>
        <Field label="Complemento">
          <input
            className={inputClass}
            value={value.workerComplement}
            onChange={(e) => onChange({ workerComplement: e.target.value })}
            placeholder="Apto, bloco, casa"
          />
        </Field>
        <Field label="Bairro" className="sm:col-span-2">
          <input
            className={inputClass}
            value={value.workerDistrict}
            onChange={(e) => onChange({ workerDistrict: e.target.value })}
            placeholder="Bairro"
          />
        </Field>
        <Field label="Cidade">
          <input
            className={inputClass}
            value={value.workerCity}
            onChange={(e) => onChange({ workerCity: e.target.value })}
            placeholder="Município"
          />
        </Field>
        <Field label="UF">
          <div className="relative">
            <select className={selectClass} value={value.workerUf} onChange={(e) => onChange({ workerUf: e.target.value })}>
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