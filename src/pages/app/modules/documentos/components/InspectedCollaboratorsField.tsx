import { useMemo, useState } from "react";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  inspectedSituations,
  type InspectedPerson,
  type InspectedSituation,
} from "@/pages/app/modules/documentos/components/inspectionData";

interface InspectedCollaboratorsFieldProps {
  value: InspectedPerson[];
  onChange: (next: InspectedPerson[]) => void;
}

const situationTone: Record<string, string> = {
  Conforme: "text-primary-700",
  Atenção: "text-accent-700",
  "Não conforme": "text-accent-900",
};

export default function InspectedCollaboratorsField({ value, onChange }: InspectedCollaboratorsFieldProps) {
  const collaborators = useCollaboratorsList();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(
    () => new Set(value.map((v) => v.collaboratorId).filter(Boolean)),
    [value]
  );

  const results = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (t.length < 2) return [];
    const digits = t.replace(/\D/g, "");
    return collaborators
      .filter((c) => !selectedIds.has(c.id))
      .filter((c) => {
        if (c.name.toLowerCase().includes(t)) return true;
        if (digits && c.cpf.replace(/\D/g, "").includes(digits)) return true;
        if (digits && c.matricula.includes(digits)) return true;
        if (digits && c.ctps.replace(/\D/g, "").includes(digits)) return true;
        return false;
      })
      .slice(0, 6);
  }, [collaborators, term, selectedIds]);

  const addCollaborator = (collaboratorId: string) => {
    const c = collaborators.find((x) => x.id === collaboratorId);
    if (!c) return;
    onChange([
      ...value,
      {
        id: `ip-${Date.now()}`,
        collaboratorId: c.id,
        name: c.name,
        cpf: c.cpf,
        matricula: c.matricula,
        role: c.role,
        area: c.area,
        situation: "Conforme",
      },
    ]);
    setTerm("");
    setOpen(false);
  };

  const addManual = () => {
    const name = term.trim();
    if (name.length < 2) return;
    onChange([
      ...value,
      {
        id: `ip-m-${Date.now()}`,
        collaboratorId: "",
        name,
        cpf: "",
        matricula: "",
        role: "",
        area: "",
        situation: "Conforme",
      },
    ]);
    setTerm("");
    setOpen(false);
  };

  const update = (id: string, patch: Partial<InspectedPerson>) =>
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const remove = (id: string) => onChange(value.filter((p) => p.id !== id));

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
          <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
            <i className="ri-search-line text-base"></i>
          </span>
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por nome, CPF ou matrícula..."
            className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
          />
          {term && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => {
                setTerm("");
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-line"></i>
            </button>
          )}
        </div>

        {open && term.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-background-200 bg-background-50 p-1.5 shadow-sm">
            {results.length > 0 ? (
              results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addCollaborator(c.id)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-background-100"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <i className="ri-user-line text-base"></i>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground-950">{c.name}</span>
                    <span className="block truncate text-xs text-foreground-500">
                      {c.role} · {c.area} · CPF {c.cpf} · Mat. {c.matricula}
                    </span>
                  </span>
                  <i className="ri-add-line text-lg text-primary-600"></i>
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-xs text-foreground-500">Nenhum colaborador encontrado na base.</p>
            )}
            <button
              type="button"
              onClick={addManual}
              className="mt-1 flex w-full items-center gap-2 rounded-md border border-dashed border-background-300 px-3 py-2.5 text-left text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-user-add-line text-base text-secondary-700"></i>
              Adicionar “{term.trim()}” manualmente
            </button>
          </div>
        )}
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {value.map((p, index) => {
            const manual = !p.collaboratorId;
            return (
              <li key={p.id} className="rounded-lg border border-background-200 bg-background-50 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-xs font-bold text-secondary-900">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    {manual ? (
                      <input
                        className={inputClass}
                        value={p.name}
                        onChange={(e) => update(p.id, { name: e.target.value })}
                        placeholder="Nome do vistoriado"
                      />
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground-950">{p.name}</p>
                        <p className="truncate text-xs text-foreground-500">
                          {p.role} · {p.area}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="relative shrink-0">
                    <select
                      className={`${selectClass} w-36 pl-3 pr-8 ${situationTone[p.situation] || ""}`}
                      value={p.situation}
                      onChange={(e) => update(p.id, { situation: e.target.value as InspectedSituation })}
                    >
                      {inspectedSituations.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover vistoriado"
                    onClick={() => remove(p.id)}
                    className="flex h-10 w-8 shrink-0 items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-accent-700"
                  >
                    <i className="ri-delete-bin-line text-base"></i>
                  </button>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className={`${inputClass} sm:flex-1`}
                    value={p.cpf}
                    onChange={(e) => update(p.id, { cpf: e.target.value })}
                    placeholder="CPF"
                    readOnly={!manual}
                  />
                  <input
                    className={`${inputClass} sm:flex-1`}
                    value={p.matricula}
                    onChange={(e) => update(p.id, { matricula: e.target.value })}
                    placeholder="Matrícula"
                    readOnly={!manual}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-background-300 bg-background-100 px-4 py-3">
          <i className="ri-information-line text-base text-foreground-500"></i>
          <span className="text-xs text-foreground-600">
            Busque na base de colaboradores (nome, CPF ou matrícula) para incluir quem está sendo vistoriado.
          </span>
        </div>
      )}
    </div>
  );
}