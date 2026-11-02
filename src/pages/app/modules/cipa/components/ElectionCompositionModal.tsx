import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import type { Cipa, CipaElection, CipaMember, CipaMemberRole, CipaRepresentation } from "@/mocks/cipa";
import { cipaMemberRoles, cipaRepresentations } from "@/mocks/cipa";
import { generateId } from "@/pages/app/modules/cipa/cipaUtils";
import { useElectionVoting, candidatesOf, configOf, tallyBallots } from "@/pages/app/modules/cipa/electionVotingStore";
import { updateCipa } from "@/pages/app/modules/cipa/cipaStore";

interface ElectionCompositionModalProps {
  open: boolean;
  onClose: () => void;
  election: CipaElection | null;
  cipa?: Cipa;
  cipaName: string;
  companyRef: string;
}

interface DraftMember {
  id: string;
  name: string;
  roleFunction: string;
  area: string;
  registration: string;
  representation: CipaRepresentation;
  memberRole: CipaMemberRole;
}

const blankDraft = (): DraftMember => ({
  id: generateId("m"),
  name: "",
  roleFunction: "",
  area: "",
  registration: "",
  representation: "Empregado",
  memberRole: "Titular",
});

/**
 * Composição da CIPA após o encerramento da votação.
 *
 * Permite adicionar as pessoas indicadas da empresa para compor a nova
 * comissão (titulares/suplentes e demais cargos), sugerindo rapidamente os
 * eleitos a partir da apuração da urna. Ao salvar, atualiza a composição da
 * própria comissão (CIPA).
 */
export default function ElectionCompositionModal({ open, onClose, election, cipa, cipaName, companyRef }: ElectionCompositionModalProps) {
  const store = useElectionVoting(companyRef);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [draft, setDraft] = useState<DraftMember>(blankDraft());
  const [saved, setSaved] = useState(false);

  const electionId = election?.id || "";
  const config = useMemo(() => configOf(store, electionId), [store, electionId]);
  const candidates = useMemo(() => candidatesOf(store, electionId), [store, electionId]);
  const tally = useMemo(() => tallyBallots(store, electionId), [store, electionId]);

  // Inicia a partir da composição atual da comissão.
  useEffect(() => {
    if (!open || !cipa) return;
    setMembers(
      cipa.members.map((m) => ({
        id: m.id,
        name: m.name,
        roleFunction: m.roleFunction,
        area: m.area,
        registration: m.registration,
        representation: m.representation,
        memberRole: m.memberRole,
      }))
    );
    setDraft(blankDraft());
    setSaved(false);
  }, [open, cipa]);

  if (!open || !election) return null;

  const votesClosed = config?.status === "encerrada";

  const ranking = candidates
    .map((c) => ({ ...c, votes: tally.perCandidate[c.candidateRef] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);

  const addDraft = () => {
    if (!draft.name.trim()) return;
    setMembers((prev) => [...prev, { ...draft, name: draft.name.trim() }]);
    setDraft(blankDraft());
  };

  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));

  const quickAddElected = () => {
    const titular = Number(election.titularVacancies) || 0;
    const suplente = Number(election.suplenteVacancies) || 0;
    const elected = ranking.slice(0, titular + suplente).filter((c) => c.votes > 0);
    const additions: DraftMember[] = elected.map((c, index) => ({
      id: generateId("m"),
      name: c.name,
      roleFunction: c.roleFunction,
      area: c.area,
      registration: "",
      representation: "Empregado",
      memberRole: index < titular ? "Titular" : "Suplente",
    }));
    setMembers((prev) => {
      const existing = new Set(prev.map((m) => m.name.trim().toLowerCase()));
      return [...prev, ...additions.filter((a) => !existing.has(a.name.trim().toLowerCase()))];
    });
  };

  const handleSave = () => {
    if (!cipa) return;
    const cipaMembers: CipaMember[] = members
      .filter((m) => m.name.trim())
      .map((m) => ({
        id: m.id,
        name: m.name.trim(),
        roleFunction: m.roleFunction.trim(),
        area: m.area.trim(),
        registration: m.registration.trim(),
        representation: m.representation,
        memberRole: m.memberRole,
        since: new Date().toLocaleDateString("pt-BR"),
      }));
    updateCipa({ ...cipa, members: cipaMembers });
    setSaved(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Composição da CIPA — novo mandato"
      subtitle={`${election.title} · ${cipaName}`}
      icon="ri-user-star-line"
      size="xl"
      footer={
        <>
          {saved && <span className="mr-auto flex items-center gap-1.5 text-xs font-semibold text-primary-700"><i className="ri-checkbox-circle-line"></i>Composição salva na comissão.</span>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">Fechar</ModalButton>
          <ModalButton onClick={handleSave} icon="ri-save-3-line" disabled={!cipa}>Salvar composição</ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!votesClosed && (
          <div className="flex items-center gap-2 rounded-md border border-secondary-200 bg-secondary-50 px-3.5 py-2.5 text-xs text-secondary-900 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-100">
            <i className="ri-information-line"></i>
            O campo de composição é liberado após o encerramento da votação. Você ainda pode preencher e salvar.
          </div>
        )}

        {ranking.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-background-200 bg-background-100/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground-800">Adicionar os eleitos pela apuração</p>
              <p className="mt-0.5 text-[11px] text-foreground-500">
                {ranking.slice(0, (Number(election.titularVacancies) || 0) + (Number(election.suplenteVacancies) || 0)).map((c) => c.name).join(", ") || "sem votos registrados"}
              </p>
            </div>
            <button
              type="button"
              onClick={quickAddElected}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-secondary-600"
            >
              <i className="ri-magic-line text-base"></i>
              Adicionar eleitos
            </button>
          </div>
        )}

        {/* Formulário manual */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-background-200 bg-background-50 p-4 sm:grid-cols-2">
          <Field label="Nome" required>
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome do integrante" />
          </Field>
          <Field label="Função / cargo">
            <input className={inputClass} value={draft.roleFunction} onChange={(e) => setDraft({ ...draft, roleFunction: e.target.value })} placeholder="Ex.: Soldador" />
          </Field>
          <Field label="Área / setor">
            <input className={inputClass} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} placeholder="Ex.: Produção" />
          </Field>
          <Field label="Matrícula">
            <input className={inputClass} value={draft.registration} onChange={(e) => setDraft({ ...draft, registration: e.target.value })} />
          </Field>
          <Field label="Representação">
            <select className={selectClass} value={draft.representation} onChange={(e) => setDraft({ ...draft, representation: e.target.value as CipaRepresentation })}>
              {cipaRepresentations.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Cargo na CIPA">
            <select className={selectClass} value={draft.memberRole} onChange={(e) => setDraft({ ...draft, memberRole: e.target.value as CipaMemberRole })}>
              {cipaMemberRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button type="button" onClick={addDraft} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600">
              <i className="ri-user-add-line"></i>
              Adicionar integrante
            </button>
          </div>
        </div>

        {/* Lista */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Composição ({members.length})</p>
          <div className="overflow-hidden rounded-lg border border-background-200">
            {members.length === 0 && <p className="px-4 py-5 text-center text-xs text-foreground-500">Nenhum integrante na composição.</p>}
            {members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-background-100 px-4 py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground-900">{m.name}</p>
                  <p className="truncate text-[11px] text-foreground-500">
                    {m.memberRole}{m.representation ? ` · ${m.representation}` : ""}{m.roleFunction ? ` · ${m.roleFunction}` : ""}{m.area ? ` · ${m.area}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remover integrante"
                  onClick={() => removeMember(m.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>
        </div>

        {!cipa && (
          <p className="rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-error-warning-line mr-1.5"></i>
            A comissão não foi localizada — não é possível salvar a composição.
          </p>
        )}
      </div>
    </Modal>
  );
}