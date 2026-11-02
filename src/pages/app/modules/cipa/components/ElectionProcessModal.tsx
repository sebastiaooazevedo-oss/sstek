import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import type { Cipa, CipaElection } from "@/mocks/cipa";
import {
  ELECTION_PROCESS_FLOW,
  ELECTION_SCHEDULE_TEMPLATE,
  checkAdvance,
  communicationChannels,
  communicationKinds,
  complianceClass,
  complianceLabel,
  isoToBr,
  nextProcessStatus,
  processPhase,
  processPhaseIndex,
  processStatusClass,
  scheduleCompliance,
  todayIso,
  type ComplianceStatus,
  type ElectionProcessStatus,
} from "@/pages/app/modules/cipa/electionProcess";
import {
  addCommitteeMember,
  addCommunication,
  removeCommitteeMember,
  removeCommunication,
  saveElectionProcess,
  saveScheduleItem,
  setProcessStatus,
  useElectionProcess,
  ensureElectionProcess,
  updateCommunication,
  type CommunicationRecord,
} from "@/pages/app/modules/cipa/electionProcessStore";

interface ElectionProcessModalProps {
  open: boolean;
  onClose: () => void;
  election: CipaElection | null;
  cipaName: string;
  cipa?: Cipa;
  companyRef: string;
}

type ProcessTab = "fase" | "cronograma" | "comissao" | "comunicacao" | "auditoria";

const tabs: { id: ProcessTab; label: string; icon: string }[] = [
  { id: "fase", label: "Fase & mandato", icon: "ri-route-line" },
  { id: "cronograma", label: "Cronograma NR-5", icon: "ri-calendar-schedule-line" },
  { id: "comissao", label: "Comissão eleitoral", icon: "ri-team-line" },
  { id: "comunicacao", label: "Comunicações", icon: "ri-send-plane-line" },
  { id: "auditoria", label: "Auditoria", icon: "ri-history-line" },
];

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${complianceClass(status)}`}>
      {complianceLabel[status]}
    </span>
  );
}

const blankCommittee = { name: "", cpf: "", matricula: "", roleFunction: "", constitutedAt: "", documentRef: "" };
const blankComm = {
  kind: "sindicato",
  channel: "E-mail",
  sentAt: todayIso(),
  recipient: "",
  proofRef: "",
  protocolNumber: "",
  confirmed: false,
  notes: "",
};

export default function ElectionProcessModal({ open, onClose, election, cipaName, cipa, companyRef }: ElectionProcessModalProps) {
  const store = useElectionProcess(companyRef);
  const [tab, setTab] = useState<ProcessTab>("fase");
  const [committeeForm, setCommitteeForm] = useState({ ...blankCommittee });
  const [commForm, setCommForm] = useState({ ...blankComm });
  const [showCommitteeForm, setShowCommitteeForm] = useState(false);
  const [showCommForm, setShowCommForm] = useState(false);
  const [editingComm, setEditingComm] = useState<CommunicationRecord | null>(null);

  const ref = election?.id || "";

  const process = useMemo(() => store.processes.find((p) => p.electionRef === ref), [store.processes, ref]);
  const schedule = useMemo(
    () => store.schedule.filter((s) => s.electionRef === ref).sort((a, b) => a.sortOrder - b.sortOrder),
    [store.schedule, ref]
  );
  const committee = useMemo(() => store.committee.filter((c) => c.electionRef === ref), [store.committee, ref]);
  const communications = useMemo(
    () => store.communications.filter((c) => c.electionRef === ref),
    [store.communications, ref]
  );
  const events = useMemo(
    () => store.events.filter((e) => e.electionRef === ref).slice(0, 40),
    [store.events, ref]
  );

  // Garante o registro do processo + cronograma ao abrir.
  useEffect(() => {
    if (!open || !election) return;
    void ensureElectionProcess(election.id, {
      cipaRef: election.cipaId,
      establishment: cipa?.unit,
      exercise: election.year,
      mandateStart: cipa?.mandateStart,
      mandateEnd: cipa?.mandateEnd,
      employeesCount: cipa?.employeesCount ?? null,
      riskGrade: cipa?.riskGrade,
      titulares: election.titularVacancies ?? null,
      suplentes: election.suplenteVacancies ?? null,
    });
  }, [open, election, cipa]);

  const status: ElectionProcessStatus = process?.status || "planejamento";
  const phase = processPhase(status);
  const currentIdx = processPhaseIndex(status);
  const target = nextProcessStatus(status);
  const advance = target
    ? checkAdvance({
        currentStatus: status,
        target,
        schedule: schedule.map((s) => ({
          itemKey: s.itemKey,
          dueDate: s.dueDate,
          notApplicable: s.notApplicable,
          done: s.done,
        })),
      })
    : { allowed: false, blockers: [] };

  const overdueCount = schedule.filter((s) => scheduleCompliance(s) === "vencido").length;

  if (!open || !election) return null;

  const handleAdvance = async () => {
    if (!target || !advance.allowed) return;
    await setProcessStatus(ref, status, target);
  };

  const submitCommittee = async () => {
    if (!committeeForm.name.trim()) return;
    await addCommitteeMember(ref, { ...committeeForm, signatureRef: "" });
    setCommitteeForm({ ...blankCommittee });
    setShowCommitteeForm(false);
  };

  const submitComm = async () => {
    if (!commForm.recipient.trim() && !commForm.proofRef.trim()) return;
    if (editingComm) {
      await updateCommunication(editingComm.id, ref, {
        ...commForm,
        sentAt: commForm.sentAt || null,
      });
    } else {
      await addCommunication(ref, { ...commForm, sentAt: commForm.sentAt || null });
    }
    setCommForm({ ...blankComm });
    setEditingComm(null);
    setShowCommForm(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Processo eleitoral da CIPA"
      subtitle={`${election.title} · ${cipaName}`}
      icon="ri-route-line"
      size="xl"
      footer={
        <>
          <span className="mr-auto flex items-center gap-2 text-xs text-foreground-500">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${processStatusClass(status)}`}>{phase.label}</span>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1.5 text-accent-700">
                <i className="ri-error-warning-line"></i>
                {overdueCount} prazo(s) vencido(s)
              </span>
            )}
          </span>
          {target && (
            <ModalButton onClick={handleAdvance} icon="ri-arrow-right-circle-line">
              Avançar para “{processPhase(target).label}”
            </ModalButton>
          )}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {store.error && (
          <div className="flex items-center gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-xs text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-error-warning-line"></i>
            {store.error}
          </div>
        )}

        {/* Linha do fluxo */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ELECTION_PROCESS_FLOW.map((p, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <span
                key={p.id}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  active
                    ? "bg-primary-500 text-background-50"
                    : done
                      ? "bg-primary-100 text-primary-700"
                      : "bg-background-100 text-foreground-400"
                }`}
                title={p.label}
              >
                <i className={`${done ? "ri-check-line" : p.icon}`}></i>
                {p.label}
              </span>
            );
          })}
        </div>

        {!advance.allowed && advance.blockers.length > 0 && target && (
          <div className="rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 dark:border-accent-800 dark:bg-accent-950">
            <p className="text-xs font-semibold text-accent-800">
              <i className="ri-lock-line mr-1.5"></i>
              Avanço bloqueado — pendências obrigatórias:
            </p>
            <ul className="mt-1 list-disc pl-5 text-[11px] text-accent-700">
              {advance.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {!target && (
          <div className="rounded-md border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-100">
            <i className="ri-checkbox-circle-line mr-1.5"></i>
            Processo concluído.
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

        {/* FASE & MANDATO */}
        {tab === "fase" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Estabelecimento / unidade">
                <input
                  className={inputClass}
                  defaultValue={process?.establishment || cipa?.unit || ""}
                  onBlur={(e) => void saveElectionProcess(ref, { establishment: e.target.value })}
                />
              </Field>
              <Field label="Exercício / mandato">
                <input
                  className={inputClass}
                  defaultValue={process?.exercise || election.year}
                  onBlur={(e) => void saveElectionProcess(ref, { exercise: e.target.value })}
                />
              </Field>
              <Field label="Responsável pelo processo">
                <input
                  className={inputClass}
                  defaultValue={process?.responsible || ""}
                  placeholder="Nome do responsável"
                  onBlur={(e) => void saveElectionProcess(ref, { responsible: e.target.value })}
                />
              </Field>
              <Field label="Matrícula / registro do responsável">
                <input
                  className={inputClass}
                  defaultValue={process?.responsibleRegistration || ""}
                  onBlur={(e) => void saveElectionProcess(ref, { responsibleRegistration: e.target.value })}
                />
              </Field>
              <Field label="Início do mandato">
                <input
                  type="date"
                  className={inputClass}
                  defaultValue={toIso(process?.mandateStart)}
                  onBlur={(e) => void saveElectionProcess(ref, { mandateStart: e.target.value })}
                />
              </Field>
              <Field label="Término do mandato">
                <input
                  type="date"
                  className={inputClass}
                  defaultValue={toIso(process?.mandateEnd)}
                  onBlur={(e) => void saveElectionProcess(ref, { mandateEnd: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Nº de empregados">
                <input
                  type="number"
                  className={inputClass}
                  defaultValue={process?.employeesCount ?? cipa?.employeesCount ?? ""}
                  onBlur={(e) => void saveElectionProcess(ref, { employeesCount: Number(e.target.value) || null })}
                />
              </Field>
              <Field label="Grau de risco (NR-4)">
                <input
                  className={inputClass}
                  defaultValue={process?.riskGrade || cipa?.riskGrade || ""}
                  onBlur={(e) => void saveElectionProcess(ref, { riskGrade: e.target.value })}
                />
              </Field>
              <Field label="Titulares (vagas)">
                <input
                  type="number"
                  className={inputClass}
                  defaultValue={process?.titulares ?? election.titularVacancies ?? ""}
                  onBlur={(e) => void saveElectionProcess(ref, { titulares: Number(e.target.value) || null })}
                />
              </Field>
              <Field label="Suplentes (vagas)">
                <input
                  type="number"
                  className={inputClass}
                  defaultValue={process?.suplentes ?? election.suplenteVacancies ?? ""}
                  onBlur={(e) => void saveElectionProcess(ref, { suplentes: Number(e.target.value) || null })}
                />
              </Field>
            </div>

            <Field label="Observações do processo">
              <textarea
                className={`${inputClass} min-h-[80px] resize-y`}
                defaultValue={process?.notes || ""}
                onBlur={(e) => void saveElectionProcess(ref, { notes: e.target.value })}
              />
            </Field>

            <p className="flex items-start gap-2 rounded-md bg-background-100 px-3.5 py-2.5 text-[11px] leading-relaxed text-foreground-500">
              <i className="ri-information-line mt-0.5"></i>
              O avanço das fases é sequencial e bloqueado enquanto houver prazos vencidos ou marcos obrigatórios pendentes.
              Os prazos da NR-5 devem ser conferidos pela empresa/comissão — o sistema não afirma conformidade sem evidência.
            </p>
          </div>
        )}

        {/* CRONOGRAMA */}
        {tab === "cronograma" && (
          <div className="flex flex-col gap-3">
            {ELECTION_SCHEDULE_TEMPLATE.map((tpl) => {
              const item = schedule.find((s) => s.itemKey === tpl.itemKey);
              const dueDate = item?.dueDate || "";
              const compliance = scheduleCompliance({
                itemKey: tpl.itemKey,
                dueDate,
                notApplicable: item?.notApplicable,
                done: item?.done,
              });
              return (
                <div key={tpl.itemKey} className="rounded-lg border border-background-200 bg-background-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-950">{tpl.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">{tpl.hint}</p>
                    </div>
                    <ComplianceBadge status={compliance} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      <Field label="Data (prazo)">
                        <input
                          type="date"
                          className={inputClass}
                          defaultValue={dueDate}
                          onChange={(e) => void saveScheduleItem(ref, tpl.itemKey, { dueDate: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-4">
                      <Field label="Comprovante / referência">
                        <input
                          className={inputClass}
                          defaultValue={item?.proofRef || ""}
                          placeholder="Protocolo, nº do documento…"
                          onBlur={(e) => void saveScheduleItem(ref, tpl.itemKey, { proofRef: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-5">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-background-300 text-primary-500"
                          checked={Boolean(item?.done)}
                          onChange={(e) => void saveScheduleItem(ref, tpl.itemKey, { done: e.target.checked })}
                        />
                        Etapa cumprida
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-background-300 text-primary-500"
                          checked={Boolean(item?.notApplicable)}
                          onChange={(e) => void saveScheduleItem(ref, tpl.itemKey, { notApplicable: e.target.checked })}
                        />
                        Não aplicável
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* COMISSÃO */}
        {tab === "comissao" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground-900">{committee.length} integrante(s)</p>
              <button
                type="button"
                onClick={() => setShowCommitteeForm((v) => !v)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-user-add-line text-base"></i>
                Adicionar integrante
              </button>
            </div>

            {showCommitteeForm && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-background-200 bg-background-100/60 p-4 sm:grid-cols-2">
                <Field label="Nome" required>
                  <input className={inputClass} value={committeeForm.name} onChange={(e) => setCommitteeForm({ ...committeeForm, name: e.target.value })} />
                </Field>
                <Field label="CPF">
                  <input className={inputClass} value={committeeForm.cpf} onChange={(e) => setCommitteeForm({ ...committeeForm, cpf: e.target.value })} />
                </Field>
                <Field label="Matrícula">
                  <input className={inputClass} value={committeeForm.matricula} onChange={(e) => setCommitteeForm({ ...committeeForm, matricula: e.target.value })} />
                </Field>
                <Field label="Função na comissão">
                  <input className={inputClass} value={committeeForm.roleFunction} onChange={(e) => setCommitteeForm({ ...committeeForm, roleFunction: e.target.value })} placeholder="Presidente, secretário…" />
                </Field>
                <Field label="Data da constituição">
                  <input type="date" className={inputClass} value={committeeForm.constitutedAt} onChange={(e) => setCommitteeForm({ ...committeeForm, constitutedAt: e.target.value })} />
                </Field>
                <Field label="Documento de constituição">
                  <input className={inputClass} value={committeeForm.documentRef} onChange={(e) => setCommitteeForm({ ...committeeForm, documentRef: e.target.value })} placeholder="Ato/portaria, referência…" />
                </Field>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <button type="button" onClick={submitCommittee} className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600">
                    <i className="ri-save-3-line"></i> Salvar integrante
                  </button>
                  <button type="button" onClick={() => setShowCommitteeForm(false)} className="rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {committee.length === 0 && !showCommitteeForm && (
              <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-500">
                Nenhum integrante da comissão eleitoral cadastrado.
              </p>
            )}
            {committee.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground-950">{m.name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-foreground-500">
                    {m.roleFunction && <span><i className="ri-briefcase-line mr-1"></i>{m.roleFunction}</span>}
                    {m.cpf && <span><i className="ri-id-card-line mr-1"></i>{m.cpf}</span>}
                    {m.matricula && <span><i className="ri-numbers-line mr-1"></i>{m.matricula}</span>}
                    {m.constitutedAt && <span><i className="ri-calendar-line mr-1"></i>{isoToBr(m.constitutedAt)}</span>}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Remover integrante"
                  onClick={() => void removeCommitteeMember(m.id, ref, m.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* COMUNICAÇÕES */}
        {tab === "comunicacao" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground-900">{communications.length} comunicação(ões)</p>
              <button
                type="button"
                onClick={() => {
                  setEditingComm(null);
                  setCommForm({ ...blankComm });
                  setShowCommForm((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-send-plane-line text-base"></i>
                Registrar comunicação
              </button>
            </div>

            {showCommForm && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-background-200 bg-background-100/60 p-4 sm:grid-cols-2">
                <Field label="Tipo">
                  <select className={selectClass} value={commForm.kind} onChange={(e) => setCommForm({ ...commForm, kind: e.target.value })}>
                    {communicationKinds.map((k) => (
                      <option key={k.id} value={k.id}>{k.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Canal">
                  <select className={selectClass} value={commForm.channel} onChange={(e) => setCommForm({ ...commForm, channel: e.target.value })}>
                    {communicationChannels.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Destinatário">
                  <input className={inputClass} value={commForm.recipient} onChange={(e) => setCommForm({ ...commForm, recipient: e.target.value })} placeholder="Sindicato / entidade" />
                </Field>
                <Field label="Data do envio">
                  <input type="date" className={inputClass} value={commForm.sentAt} onChange={(e) => setCommForm({ ...commForm, sentAt: e.target.value })} />
                </Field>
                <Field label="Comprovante / referência">
                  <input className={inputClass} value={commForm.proofRef} onChange={(e) => setCommForm({ ...commForm, proofRef: e.target.value })} placeholder="Protocolo, AR, e-mail…" />
                </Field>
                <Field label="Nº do protocolo">
                  <input className={inputClass} value={commForm.protocolNumber} onChange={(e) => setCommForm({ ...commForm, protocolNumber: e.target.value })} />
                </Field>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground-700 sm:col-span-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-background-300 text-primary-500" checked={commForm.confirmed} onChange={(e) => setCommForm({ ...commForm, confirmed: e.target.checked })} />
                  Entrega confirmada / comprovada
                </label>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <button type="button" onClick={submitComm} className="inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600">
                    <i className="ri-save-3-line"></i> {editingComm ? "Salvar alterações" : "Registrar"}
                  </button>
                  <button type="button" onClick={() => { setShowCommForm(false); setEditingComm(null); }} className="rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {communications.length === 0 && !showCommForm && (
              <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-500">
                Nenhuma comunicação registrada. Registre a comunicação ao sindicato com o comprovante de entrega.
              </p>
            )}
            {communications.map((c) => (
              <div key={c.id} className="rounded-lg border border-background-200 bg-background-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-800">
                      {communicationKinds.find((k) => k.id === c.kind)?.label || c.kind}
                    </span>
                    {c.confirmed ? (
                      <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700"><i className="ri-check-line mr-1"></i>Comprovada</span>
                    ) : (
                      <span className="rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-semibold text-accent-800"><i className="ri-timer-line mr-1"></i>Sem confirmação</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Editar comunicação"
                      onClick={() => {
                        setEditingComm(c);
                        setCommForm({
                          kind: c.kind,
                          channel: c.channel || "E-mail",
                          sentAt: c.sentAt ? c.sentAt.slice(0, 10) : "",
                          recipient: c.recipient,
                          proofRef: c.proofRef,
                          protocolNumber: c.protocolNumber,
                          confirmed: c.confirmed,
                          notes: c.notes,
                        });
                        setShowCommForm(true);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
                    >
                      <i className="ri-edit-line"></i>
                    </button>
                    <button
                      type="button"
                      aria-label="Remover comunicação"
                      onClick={() => void removeCommunication(c.id, ref)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-600">
                  {c.recipient && <span><i className="ri-user-line mr-1"></i>{c.recipient}</span>}
                  {c.channel && <span><i className="ri-send-plane-line mr-1"></i>{c.channel}</span>}
                  {c.sentAt && <span><i className="ri-calendar-line mr-1"></i>{isoToBr(c.sentAt.slice(0, 10))}</span>}
                  {c.protocolNumber && <span><i className="ri-numbers-line mr-1"></i>{c.protocolNumber}</span>}
                </p>
                {c.proofRef && <p className="mt-1 text-[11px] text-foreground-500">Comprovante: {c.proofRef}</p>}
              </div>
            ))}
          </div>
        )}

        {/* AUDITORIA */}
        {tab === "auditoria" && (
          <div className="flex flex-col gap-2">
            {events.length === 0 && (
              <p className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-500">
                Nenhum evento registrado ainda.
              </p>
            )}
            {events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background-100 text-foreground-500">
                  <i className="ri-history-line text-sm"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground-900">{ev.action}</p>
                  {ev.detail && <p className="mt-0.5 text-[11px] text-foreground-600">{ev.detail}</p>}
                  <p className="mt-0.5 text-[10px] text-foreground-400">
                    {new Date(ev.createdAt).toLocaleString("pt-BR")} · {ev.actor || "—"}
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

/** Converte "dd/mm/aaaa" ou ISO em valor aceito por <input type="date">. */
function toIso(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}