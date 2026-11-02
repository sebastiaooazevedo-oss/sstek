import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import type { Cipa, CipaElection } from "@/mocks/cipa";
import {
  addVoterManual,
  closeVoterRoll,
  createNewVersion,
  ensureVoterRoll,
  entriesOf,
  importVoters,
  latestRollOf,
  openRollOf,
  removeVoter,
  reopenVoterRollWithCorrection,
  rollsOf,
  updateVoterEligibility,
  useVoterRoll,
  validateVoterRoll,
  type VoterEntryRecord,
} from "@/pages/app/modules/cipa/voterRollStore";
import { useElectionProcess } from "@/pages/app/modules/cipa/electionProcessStore";
import { processPhaseIndex } from "@/pages/app/modules/cipa/electionProcess";

interface VoterRollModalProps {
  open: boolean;
  onClose: () => void;
  election: CipaElection | null;
  cipaName: string;
  cipa?: Cipa;
  companyRef: string;
}

type VoterTab = "base" | "eleitores" | "auditoria";

const tabs: { id: VoterTab; label: string; icon: string }[] = [
  { id: "base", label: "Base & versões", icon: "ri-stack-line" },
  { id: "eleitores", label: "Eleitores", icon: "ri-group-line" },
  { id: "auditoria", label: "Auditoria", icon: "ri-history-line" },
];

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

export default function VoterRollModal({ open, onClose, election, cipaName, cipa, companyRef }: VoterRollModalProps) {
  const store = useVoterRoll(companyRef);
  const processStore = useElectionProcess(companyRef);
  const [tab, setTab] = useState<VoterTab>("base");
  const [search, setSearch] = useState("");
  const [importSearch, setImportSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualMatricula, setManualMatricula] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [justification, setJustification] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const ref = election?.id || "";
  const process = processStore.processes.find((p) => p.electionRef === ref);
  const votingStarted = process ? processPhaseIndex(process.status) >= processPhaseIndex("votacao-aberta") : false;

  const rolls = useMemo(() => rollsOf(store, ref), [store, ref]);
  const openRoll = useMemo(() => openRollOf(store, ref), [store, ref]);
  const latest = useMemo(() => latestRollOf(store, ref), [store, ref]);
  const currentRoll = openRoll || latest;
  const entries = useMemo(() => (currentRoll ? entriesOf(store, currentRoll.id) : []), [store, currentRoll]);
  const readOnly = !openRoll;
  const validation = useMemo(() => validateVoterRoll(store, ref), [store, ref]);
  const establishmentTarget = currentRoll?.establishment || cipa?.unit || "";

  const baseEvents = useMemo(
    () => processStore.events.filter((e) => e.electionRef === ref && e.action.startsWith("base_")).slice(0, 40),
    [processStore.events, ref]
  );

  useEffect(() => {
    if (!open || !election) return;
    void ensureVoterRoll(election.id, { cipaRef: election.cipaId, establishment: cipa?.unit });
  }, [open, election, cipa]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (!open || !election) return null;

  const belongsToTarget = (est: string) => !establishmentTarget || !est || est === establishmentTarget;
  const notInRoll = store.collaborators.filter(
    (c) => c.active && c.ref && belongsToTarget(c.establishment) && !entries.some((e) => e.collaboratorRef === c.ref)
  );
  const otherEstablishments = establishmentTarget
    ? store.collaborators.filter(
        (c) =>
          c.active &&
          c.ref &&
          c.establishment &&
          c.establishment !== establishmentTarget &&
          !entries.some((e) => e.collaboratorRef === c.ref)
      ).length
    : 0;
  const filteredImport = notInRoll.filter((c) => {
    const q = importSearch.trim().toLowerCase();
    if (!q) return true;
    return `${c.name} ${c.matricula} ${c.area} ${c.roleFunction}`.toLowerCase().includes(q);
  });
  const filteredEntries = entries.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${e.nameSnapshot} ${e.matriculaSnapshot} ${e.area}`.toLowerCase().includes(q);
  });
  const eligibleCount = entries.filter((e) => e.eligibility === "apto").length;
  const ineligibleCount = entries.filter((e) => e.eligibility === "inapto").length;

  const toggleSelected = (ref2: string) => {
    setSelected((prev) => (prev.includes(ref2) ? prev.filter((r) => r !== ref2) : [...prev, ref2]));
  };

  const handleImport = async () => {
    if (!openRoll || !selected.length) return;
    const chosen = store.collaborators.filter((c) => selected.includes(c.ref));
    const count = await importVoters(ref, openRoll.id, chosen);
    setSelected([]);
    setShowImport(false);
    setFeedback(`${count} eleitor(es) importado(s).`);
  };

  const handleAddManual = async () => {
    if (!openRoll || !manualName.trim()) return;
    await addVoterManual(ref, openRoll.id, { name: manualName, matricula: manualMatricula });
    setManualName("");
    setManualMatricula("");
    setShowManual(false);
  };

  const handleClose = async () => {
    if (!openRoll) return;
    const ok = await closeVoterRoll(ref, openRoll.id, process?.responsible || "Administrador");
    setFeedback(ok ? "Base eleitoral fechada com sucesso." : "Não foi possível fechar a base.");
  };

  const handleNewVersion = async () => {
    await createNewVersion(ref, "Nova versão em preparação.");
    setFeedback("Nova versão da base gerada.");
  };

  const handleCorrection = async () => {
    if (!justification.trim()) return;
    await reopenVoterRollWithCorrection(ref, justification, process?.responsible || "Administrador");
    setJustification("");
    setShowCorrection(false);
    setFeedback("Correção excepcional registrada — nova versão aberta.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Base eleitoral da CIPA"
      subtitle={`${election.title} · ${cipaName}`}
      icon="ri-group-line"
      size="xl"
      footer={
        <>
          <span className="mr-auto flex flex-wrap items-center gap-2 text-xs text-foreground-500">
            {currentRoll && (
              <span className="rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
                Versão {currentRoll.version} · {readOnly ? "Fechada" : "Em preparação"}
              </span>
            )}
            {votingStarted && <span className="text-accent-700">Votação já iniciada — base somente leitura.</span>}
          </span>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {store.error && (
          <div className="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-800">
            <i className="ri-error-warning-line"></i>
            {store.error}
          </div>
        )}
        {feedback && (
          <div className="flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-700">
            <i className="ri-checkbox-circle-line"></i>
            {feedback}
          </div>
        )}

        {/* Cabeçalho da base */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <InfoCell label="Processo" value={election.title} wide />
          <InfoCell label="Estabelecimento" value={currentRoll?.establishment || cipa?.unit || cipaName} wide />
          <InfoCell label="Versão" value={currentRoll ? `v${currentRoll.version}` : "—"} />
          <InfoCell label="Status" value={readOnly ? "Fechada" : "Em preparação"} tone={readOnly ? "primary" : "secondary"} />
          <InfoCell label="Eleitores aptos" value={String(currentRoll?.status === "fechada" ? currentRoll.eligibleCount : eligibleCount)} />
          <InfoCell label="Inaptos" value={String(currentRoll?.status === "fechada" ? currentRoll.ineligibleCount : ineligibleCount)} />
        </div>
        <p className="-mt-2 text-[11px] text-foreground-400">
          <i className="ri-time-line mr-1"></i>Última atualização: {formatDateTime(currentRoll?.updatedAt)}
          {currentRoll?.status === "fechada" && (
            <>
              {" "}· Fechada em {formatDateTime(currentRoll.closedAt)} por {currentRoll.closedBy || "—"}
            </>
          )}
        </p>

        {/* Aviso de imutabilidade quando fechada */}
        {readOnly && (
          <div className="flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-primary-700">
            <i className="ri-lock-line mt-0.5"></i>
            <span>
              Base <strong>fechada</strong>: não é possível incluir, alterar ou excluir eleitores — o banco bloqueia edições
              silenciosas. Se houver necessidade de correção, use a <strong>correção excepcional</strong>, que gera uma nova
              versão com justificativa e registro em auditoria.
            </span>
          </div>
        )}

        {/* Abas */}
        <div className="flex flex-wrap gap-1.5 rounded-full border border-background-200 bg-background-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-50"
              }`}
            >
              <i className={`${t.icon} text-base`}></i>
              {t.label}
            </button>
          ))}
        </div>

        {/* ABA BASE & VERSÕES */}
        {tab === "base" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowImport((v) => !v);
                      setImportSearch("");
                    }}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-user-add-line text-base"></i>
                    Importar eleitores
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManual((v) => !v)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-file-add-line text-base"></i>
                    Adicionar avulso
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("eleitores")}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-shield-check-line text-base"></i>
                    Validar base
                  </button>
                  <button
                    type="button"
                    onClick={handleNewVersion}
                    disabled={entries.length === 0}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-git-branch-line text-base"></i>
                    Gerar nova versão
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={!validation.ok || votingStarted}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-lock-2-line text-base"></i>
                    Fechar base eleitoral
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCorrection((v) => !v)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 px-3.5 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100"
                >
                  <i className="ri-lock-unlock-line text-base"></i>
                  Correção excepcional (nova versão)
                </button>
              )}
            </div>

            {/* Validação */}
            <div
              className={`rounded-md border px-3.5 py-2.5 text-xs ${
                validation.ok
                  ? "border-primary-200 bg-primary-50 text-primary-700"
                  : "border-accent-200 bg-accent-50 text-accent-800"
              }`}
            >
              <p className="font-semibold">
                <i className={`${validation.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"} mr-1.5`}></i>
                {validation.ok ? "Base validada — sem pendências para o fechamento." : "Pendências encontradas:"}
              </p>
              {!validation.ok && (
                <ul className="mt-1 list-disc pl-5">
                  {validation.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Importação */}
            {showImport && !readOnly && (
              <div className="rounded-lg border border-background-200 bg-background-100/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-900">Colaboradores do estabelecimento</p>
                    <p className="mt-0.5 text-[11px] text-foreground-500">
                      <i className="ri-building-line mr-1"></i>
                      {establishmentTarget || "Todos os estabelecimentos"}
                    </p>
                  </div>
                  <input
                    className={`${inputClass} max-w-xs text-sm`}
                    placeholder="Buscar por nome, matrícula, área…"
                    value={importSearch}
                    onChange={(e) => setImportSearch(e.target.value)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(filteredImport.map((c) => c.ref))}
                    className="text-xs font-semibold text-primary-700 hover:underline"
                  >
                    Selecionar todos ({filteredImport.length})
                  </button>
                  <button type="button" onClick={() => setSelected([])} className="text-xs font-semibold text-foreground-500 hover:underline">
                    Limpar seleção
                  </button>
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-background-200 bg-background-50">
                  {otherEstablishments > 0 && (
                    <p className="border-b border-background-200 bg-secondary-50 px-4 py-2 text-[11px] text-secondary-900">
                      <i className="ri-information-line mr-1"></i>
                      {otherEstablishments} colaborador(es) de outro(s) estabelecimento(s) não aparecem aqui (segregação por
                      estabelecimento).
                    </p>
                  )}
                  {filteredImport.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-foreground-500">
                      Nenhum colaborador disponível para importar (todos já estão na base ou não há colaboradores).
                    </p>
                  )}
                  {filteredImport.map((c) => (
                    <label
                      key={c.ref}
                      className="flex cursor-pointer items-center gap-3 border-b border-background-100 px-4 py-2.5 last:border-b-0 hover:bg-background-100"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-background-300 text-primary-500"
                        checked={selected.includes(c.ref)}
                        onChange={() => toggleSelected(c.ref)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground-900">{c.name}</span>
                        <span className="block truncate text-[11px] text-foreground-500">
                          {c.matricula || "sem matrícula"}{c.area ? ` · ${c.area}` : ""}{c.roleFunction ? ` · ${c.roleFunction}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={!selected.length}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-download-2-line text-base"></i>
                    Importar selecionados ({selected.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImport(false)}
                    className="rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Adicionar avulso */}
            {showManual && !readOnly && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-background-200 bg-background-100/60 p-4 sm:grid-cols-3">
                <Field label="Nome" required>
                  <input className={inputClass} value={manualName} onChange={(e) => setManualName(e.target.value)} />
                </Field>
                <Field label="Matrícula / identificação">
                  <input className={inputClass} value={manualMatricula} onChange={(e) => setManualMatricula(e.target.value)} />
                </Field>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleAddManual}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600"
                  >
                    <i className="ri-add-line"></i> Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManual(false)}
                    className="rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Correção excepcional */}
            {showCorrection && readOnly && (
              <div className="rounded-lg border border-accent-200 bg-accent-50 p-4">
                <p className="text-sm font-semibold text-accent-800">Correção excepcional da base fechada</p>
                <p className="mt-1 text-[11px] leading-relaxed text-accent-700">
                  A versão fechada é preservada. Ao confirmar, uma nova versão é aberta a partir dela e a justificativa é
                  registrada na auditoria.
                </p>
                <textarea
                  className={`${inputClass} mt-3 min-h-[70px] resize-y`}
                  placeholder="Descreva o motivo da correção (obrigatório)…"
                  maxLength={500}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCorrection}
                    disabled={!justification.trim()}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ri-check-line"></i> Abrir nova versão
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCorrection(false)}
                    className="rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Histórico de versões */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Histórico de versões</p>
              <div className="flex flex-col gap-2">
                {rolls.length === 0 && (
                  <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-5 text-center text-xs text-foreground-500">
                    Nenhuma versão criada.
                  </p>
                )}
                {rolls.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-bold text-foreground-700">v{r.version}</span>
                      {r.status === "fechada" ? (
                        <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                          <i className="ri-lock-2-line mr-1"></i>Fechada
                        </span>
                      ) : (
                        <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-800">
                          <i className="ri-edit-2-line mr-1"></i>Em preparação
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-600">
                      <span><i className="ri-group-line mr-1"></i>{r.eligibleCount} apto(s) · {r.ineligibleCount} inapto(s)</span>
                      {r.status === "fechada" && r.closedAt && <span><i className="ri-calendar-check-line mr-1"></i>{formatDateTime(r.closedAt)}</span>}
                    </div>
                    {r.integrityHash && (
                      <span className="w-full break-all rounded-md bg-background-100 px-2 py-1 text-[10px] text-foreground-500" title="Hash de integridade (SHA-256)">
                        <i className="ri-fingerprint-line mr-1"></i>{r.integrityHash}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA ELEITORES */}
        {tab === "eleitores" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground-900">
                {entries.length} eleitor(es) · {eligibleCount} apto(s) · {ineligibleCount} inapto(s)
              </p>
              <input
                className={`${inputClass} max-w-xs text-sm`}
                placeholder="Buscar por nome, matrícula, área…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-background-200">
              <div className="grid grid-cols-12 gap-2 border-b border-background-200 bg-background-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
                <span className="col-span-5">Eleitor</span>
                <span className="col-span-3">Elegibilidade</span>
                <span className="col-span-4 text-right">Ações</span>
              </div>
              {filteredEntries.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-foreground-500">Nenhum eleitor na base desta versão.</p>
              )}
              {filteredEntries.map((e) => (
                <VoterRow key={e.id} entry={e} readOnly={readOnly} onEligibility={updateVoterEligibility} electionRef={ref} onRemove={removeVoter} />
              ))}
            </div>
            {readOnly && (
              <p className="text-[11px] text-foreground-400">
                <i className="ri-information-line mr-1"></i>
                Versão fechada: edições bloqueadas. Use a correção excepcional na aba “Base & versões”.
              </p>
            )}
          </div>
        )}

        {/* ABA AUDITORIA */}
        {tab === "auditoria" && (
          <div className="flex flex-col gap-2">
            {baseEvents.length === 0 && (
              <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-500">
                Nenhum evento da base registrado ainda.
              </p>
            )}
            {baseEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-100 text-foreground-500">
                  <i className="ri-history-line text-sm"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground-900">{ev.action}</p>
                  {ev.detail && <p className="mt-0.5 break-words text-[11px] text-foreground-600">{ev.detail}</p>}
                  <p className="mt-0.5 text-[10px] text-foreground-400">
                    {formatDateTime(ev.createdAt)} · {ev.actor || "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function InfoCell({ label, value, wide, tone }: { label: string; value: string; wide?: boolean; tone?: "secondary" | "primary" }) {
  const toneClass =
    tone === "primary"
      ? "bg-primary-100 text-primary-700"
      : tone === "secondary"
        ? "bg-secondary-100 text-secondary-800"
        : "bg-background-100 text-foreground-900";
  return (
    <div className={`rounded-md px-3 py-2 ${toneClass} ${wide ? "col-span-2" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold" title={value}>{value || "—"}</p>
    </div>
  );
}

function VoterRow({
  entry,
  readOnly,
  electionRef,
  onEligibility,
  onRemove,
}: {
  entry: VoterEntryRecord;
  readOnly: boolean;
  electionRef: string;
  onEligibility: (electionRef: string, entryId: string, eligibility: "apto" | "inapto", reason?: string) => Promise<void>;
  onRemove: (electionRef: string, entryId: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(entry.ineligibleReason);
  return (
    <div className="grid grid-cols-12 items-center gap-2 border-b border-background-100 px-4 py-2.5 last:border-b-0">
      <div className="col-span-5 min-w-0">
        <p className="truncate text-sm font-medium text-foreground-900">{entry.nameSnapshot}</p>
        <p className="truncate text-[11px] text-foreground-500">
          {entry.matriculaSnapshot || "sem matrícula"}{entry.area ? ` · ${entry.area}` : ""}
        </p>
      </div>
      <div className="col-span-3">
        {readOnly ? (
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.eligibility === "apto" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"}`}>
            {entry.eligibility === "apto" ? "Apto" : "Inapto"}
          </span>
        ) : (
          <select
            className={`${selectClass} py-1.5 text-xs`}
            value={entry.eligibility}
            onChange={(ev) => void onEligibility(electionRef, entry.id, ev.target.value as "apto" | "inapto", reason)}
          >
            <option value="apto">Apto</option>
            <option value="inapto">Inapto</option>
          </select>
        )}
      </div>
      <div className="col-span-4 flex items-center justify-end gap-2">
        {entry.eligibility === "inapto" && (
          <input
            className={`${inputClass} py-1.5 text-xs`}
            placeholder="Justificativa"
            value={reason}
            disabled={readOnly}
            onChange={(ev) => setReason(ev.target.value)}
            onBlur={() => !readOnly && void onEligibility(electionRef, entry.id, "inapto", reason)}
          />
        )}
        {!readOnly && (
          <button
            type="button"
            aria-label="Remover eleitor"
            onClick={() => void onRemove(electionRef, entry.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
          >
            <i className="ri-delete-bin-line"></i>
          </button>
        )}
      </div>
    </div>
  );
}