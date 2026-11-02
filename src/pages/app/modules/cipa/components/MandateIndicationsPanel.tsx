import { useMemo, useState } from "react";
import { Field, inputClass, selectClass } from "@/pages/app/components/Modal";
import { cipaMemberRoles, cipaRepresentations, type Cipa, type CipaElection, type CipaMember, type CipaMemberRole, type CipaRepresentation } from "@/mocks/cipa";
import {
  addIndication,
  confirmIndications,
  indicationsOf,
  removeIndication,
  updateIndication,
  type StoreState,
} from "@/pages/app/modules/cipa/electionVotingStore";
import { updateCipa } from "@/pages/app/modules/cipa/cipaStore";

interface MandateIndicationsPanelProps {
  election: CipaElection;
  cipa?: Cipa;
  cipaName: string;
  companyRef: string;
  store: StoreState;
  finalized: boolean;
}

interface Draft {
  name: string;
  cpf: string;
  roleFunction: string;
  area: string;
  registration: string;
  memberRole: CipaMemberRole;
  representation: CipaRepresentation;
}

const blankDraft = (): Draft => ({
  name: "",
  cpf: "",
  roleFunction: "",
  area: "",
  registration: "",
  memberRole: "Titular",
  representation: "Empregador",
});

/**
 * Indicações da empresa para compor a CIPA do novo mandato. Podem ser
 * registradas em qualquer momento do processo (antes, durante ou após a
 * votação). Ao confirmar, entram na composição da comissão junto com os eleitos.
 */
export default function MandateIndicationsPanel({ election, cipa, cipaName, store, finalized }: MandateIndicationsPanelProps) {
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const indications = useMemo(() => indicationsOf(store, election.id), [store, election.id]);
  const confirmed = indications.filter((i) => i.confirmed);

  const handleAdd = async () => {
    if (draft.name.trim().length < 3) return;
    if (editingId) {
      await updateIndication(editingId, { ...draft, name: draft.name.trim() });
      setEditingId(null);
    } else {
      await addIndication(election.id, cipa?.id ?? null, { ...draft, name: draft.name.trim() });
    }
    setDraft(blankDraft());
    setApplied(false);
  };

  const startEdit = (id: string) => {
    const item = indications.find((i) => i.id === id);
    if (!item) return;
    setEditingId(id);
    setDraft({
      name: item.name,
      cpf: item.cpf,
      roleFunction: item.roleFunction,
      area: item.area,
      registration: item.registration,
      memberRole: item.memberRole as CipaMemberRole,
      representation: item.representation as CipaRepresentation,
    });
  };

  const applyToComposition = () => {
    if (!cipa) return;
    const source = confirmed.length ? confirmed : indications;
    const existing = new Set(cipa.members.map((m) => m.name.trim().toLowerCase()));
    const additions: CipaMember[] = source
      .filter((i) => !existing.has(i.name.trim().toLowerCase()))
      .map((i) => ({
        id: `ind-${i.id}`,
        name: i.name.trim(),
        roleFunction: i.roleFunction,
        area: i.area,
        registration: i.registration,
        representation: i.representation as CipaRepresentation,
        memberRole: i.memberRole as CipaMemberRole,
        since: new Date().toLocaleDateString("pt-BR"),
      }));
    if (!additions.length) {
      setApplied(true);
      return;
    }
    updateCipa({ ...cipa, members: [...cipa.members, ...additions] });
    setApplied(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-2.5 text-xs leading-relaxed text-secondary-900 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-100">
        <i className="ri-information-line mt-0.5"></i>
        As pessoas indicadas pela empresa (representantes do empregador) podem ser registradas a qualquer momento do
        processo. Ao confirmar, elas entram na composição da comissão ({cipaName}) junto com os eleitos.
      </p>

      {/* Formulário */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-background-200 bg-background-50 p-4 sm:grid-cols-2">
        <Field label="Nome" required>
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome do indicado" />
        </Field>
        <Field label="Função / cargo">
          <input className={inputClass} value={draft.roleFunction} onChange={(e) => setDraft({ ...draft, roleFunction: e.target.value })} placeholder="Ex.: Engenheiro de Segurança" />
        </Field>
        <Field label="Área / setor">
          <input className={inputClass} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} placeholder="Ex.: SESMT" />
        </Field>
        <Field label="CPF">
          <input className={inputClass} value={draft.cpf} onChange={(e) => setDraft({ ...draft, cpf: e.target.value })} />
        </Field>
        <Field label="Matrícula">
          <input className={inputClass} value={draft.registration} onChange={(e) => setDraft({ ...draft, registration: e.target.value })} />
        </Field>
        <Field label="Cargo na CIPA">
          <select className={selectClass} value={draft.memberRole} onChange={(e) => setDraft({ ...draft, memberRole: e.target.value as CipaMemberRole })}>
            {cipaMemberRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Representação">
          <select className={selectClass} value={draft.representation} onChange={(e) => setDraft({ ...draft, representation: e.target.value as CipaRepresentation })}>
            {cipaRepresentations.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={finalized}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-50"
          >
            <i className={editingId ? "ri-save-3-line" : "ri-user-add-line"}></i>
            {editingId ? "Salvar indicação" : "Adicionar indicação"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(blankDraft());
              }}
              className="rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">
            Indicações registradas ({indications.length}) · {confirmed.length} confirmada(s)
          </p>
          {indications.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {confirmed.length < indications.length && (
                <button
                  type="button"
                  onClick={() => void confirmIndications(indications.filter((i) => !i.confirmed).map((i) => i.id))}
                  disabled={finalized}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-50"
                >
                  <i className="ri-check-double-line"></i> Confirmar todas
                </button>
              )}
              <button
                type="button"
                onClick={applyToComposition}
                disabled={!cipa}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-background-50 hover:bg-secondary-600 disabled:opacity-50"
              >
                <i className="ri-user-star-line"></i> Aplicar à composição da CIPA
              </button>
            </div>
          )}
        </div>

        {applied && (
          <p className="mb-2 flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-[11px] font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
            <i className="ri-checkbox-circle-line"></i> Indicações aplicadas à composição da comissão.
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-background-200">
          {indications.length === 0 && <p className="px-4 py-5 text-center text-xs text-foreground-500">Nenhuma indicação registrada.</p>}
          {indications.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-background-100 px-4 py-2.5 last:border-b-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium text-foreground-900">
                  {i.name}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${i.confirmed ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"}`}>
                    {i.confirmed ? "Confirmado" : "Aguardando confirmação"}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[11px] text-foreground-500">
                  {i.memberRole}{i.representation ? ` · ${i.representation}` : ""}{i.roleFunction ? ` · ${i.roleFunction}` : ""}{i.area ? ` · ${i.area}` : ""}{i.registration ? ` · mat. ${i.registration}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!i.confirmed && (
                  <button
                    type="button"
                    aria-label="Confirmar indicação"
                    onClick={() => void confirmIndications([i.id])}
                    disabled={finalized}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-primary-100 hover:text-primary-700 disabled:opacity-40"
                  >
                    <i className="ri-check-line"></i>
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Editar indicação"
                  onClick={() => startEdit(i.id)}
                  disabled={finalized}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900 disabled:opacity-40"
                >
                  <i className="ri-edit-line"></i>
                </button>
                <button
                  type="button"
                  aria-label="Remover indicação"
                  onClick={() => void removeIndication(i.id)}
                  disabled={finalized}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800 disabled:opacity-40"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}