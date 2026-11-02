import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { electionStatuses, type Cipa, type CipaElection, type ElectionCandidate, type ElectionStatus } from "@/mocks/cipa";
import { generateId, nrsDimensioning } from "@/pages/app/modules/cipa/cipaUtils";

interface ElectionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (election: CipaElection) => void;
  cipas: Cipa[];
  editing?: CipaElection | null;
}

function blankCandidate(): ElectionCandidate {
  return { id: generateId("ca"), name: "", roleFunction: "", area: "", votes: 0 };
}

/** Texto-padrão sugerido para o aviso/edital de convocação (editável pelo admin). */
const DEFAULT_EDITAL_NOTICE =
  "Estão abertas as inscrições de chapas para a eleição da CIPA. Podem se candidatar todos os empregados que atendam aos requisitos do edital. As inscrições devem ser realizadas presencialmente junto à Comissão Eleitoral ou por meio da ficha eletrônica de inscrição, acompanhadas de foto 3x4 com fundo branco. A relação de candidatos inscritos é pública e fica disponível a todos os empregados.";

export default function ElectionFormModal({ open, onClose, onSave, cipas, editing }: ElectionFormModalProps) {
  const [cipaId, setCipaId] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [registrationStart, setRegistrationStart] = useState("");
  const [registrationEnd, setRegistrationEnd] = useState("");
  const [voteDate, setVoteDate] = useState("");
  const [voteStartTime, setVoteStartTime] = useState("");
  const [voteEndTime, setVoteEndTime] = useState("");
  const [status, setStatus] = useState<ElectionStatus>("Inscrições");
  const [eligibleVoters, setEligibleVoters] = useState("");
  const [titularVacancies, setTitularVacancies] = useState("");
  const [suplenteVacancies, setSuplenteVacancies] = useState("");
  const [notice, setNotice] = useState("");
  const [candidates, setCandidates] = useState<ElectionCandidate[]>([blankCandidate()]);
  const [error, setError] = useState("");

  const selectedCipa = useMemo(() => cipas.find((c) => c.id === cipaId) || null, [cipas, cipaId]);
  const suggestion = useMemo(
    () => (selectedCipa ? nrsDimensioning(selectedCipa.employeesCount, selectedCipa.riskGrade) : null),
    [selectedCipa]
  );

  // Pré-preenche as vagas pela NR-5 ao iniciar um processo novo, enquanto o
  // admin ainda não informou manualmente os números.
  useEffect(() => {
    if (!open || editing) return;
    if (!suggestion || !suggestion.required) return;
    if (titularVacancies || suplenteVacancies) return;
    setTitularVacancies(String(suggestion.titulares));
    setSuplenteVacancies(String(suggestion.suplentes));
  }, [open, editing, suggestion, titularVacancies, suplenteVacancies]);

  const applySuggestion = () => {
    if (!suggestion || !suggestion.required) return;
    setTitularVacancies(String(suggestion.titulares));
    setSuplenteVacancies(String(suggestion.suplentes));
  };

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCipaId(editing.cipaId);
      setTitle(editing.title);
      setYear(editing.year);
      setProcessNumber(editing.processNumber);
      setRegistrationStart(editing.registrationStart);
      setRegistrationEnd(editing.registrationEnd);
      setVoteDate(editing.voteDate);
      setVoteStartTime(editing.voteStartTime || "");
      setVoteEndTime(editing.voteEndTime || "");
      setStatus(editing.status);
      setEligibleVoters(String(editing.eligibleVoters));
      setTitularVacancies(editing.titularVacancies != null ? String(editing.titularVacancies) : "");
      setSuplenteVacancies(editing.suplenteVacancies != null ? String(editing.suplenteVacancies) : "");
      setNotice(editing.notice || "");
      setCandidates(editing.candidates.length ? editing.candidates : [blankCandidate()]);
    } else {
      setCipaId(cipas[0]?.id || "");
      setTitle("Eleição da CIPA");
      setYear(String(new Date().getFullYear()));
      setProcessNumber("");
      setRegistrationStart("");
      setRegistrationEnd("");
      setVoteDate("");
      setVoteStartTime("");
      setVoteEndTime("");
      setStatus("Inscrições");
      setEligibleVoters("");
      setTitularVacancies("");
      setSuplenteVacancies("");
      setNotice(DEFAULT_EDITAL_NOTICE);
      setCandidates([blankCandidate()]);
    }
    setError("");
  }, [open, editing, cipas]);

  const updateCandidate = (id: string, patch: Partial<ElectionCandidate>) =>
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const totalVotes = candidates.reduce((sum, c) => sum + (Number(c.votes) || 0), 0);

  const handleSubmit = () => {
    if (!cipaId) return setError("Selecione a CIPA.");
    if (title.trim().length < 3) return setError("Informe o título do processo eleitoral.");
    const valid = candidates.filter((c) => c.name.trim().length > 1);
    if (valid.length === 0) return setError("Adicione ao menos um candidato/chapa.");
    setError("");
    onSave({
      id: editing?.id ?? generateId("el"),
      cipaId,
      title: title.trim(),
      year: year.trim(),
      processNumber: processNumber.trim(),
      registrationStart,
      registrationEnd,
      voteDate,
      voteStartTime,
      voteEndTime,
      establishment: selectedCipa?.unit || undefined,
      status,
      eligibleVoters: Number(eligibleVoters) || 0,
      titularVacancies: Number(titularVacancies) || 0,
      suplenteVacancies: Number(suplenteVacancies) || 0,
      notice: notice.trim() || undefined,
      candidates: valid.map((c) => ({ ...c, votes: Number(c.votes) || 0 })),
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar processo eleitoral" : "Nova eleição da CIPA"}
      subtitle="Conduza o processo eleitoral: inscrições, votação, candidatos e apuração, conforme a NR-5."
      icon="ri-checkbox-multiple-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-save-3-line">
            {editing ? "Salvar" : "Criar eleição"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CIPA" required>
            <div className="relative">
              <select className={selectClass} value={cipaId} onChange={(e) => setCipaId(e.target.value)}>
                <option value="">Selecione a CIPA</option>
                {cipas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
          <Field label="Situação do processo">
            <div className="relative">
              <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ElectionStatus)}>
                {electionStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        </div>

        <Field label="Título do processo" required>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eleição da CIPA — Gestão 2026/2027" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Ano">
            <input className={inputClass} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
          </Field>
          <Field label="Nº do processo / edital">
            <input className={inputClass} value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} placeholder="PROC-CIPA-2026" />
          </Field>
          <Field label="Eleitores aptos">
            <input type="number" className={inputClass} value={eligibleVoters} onChange={(e) => setEligibleVoters(e.target.value)} placeholder="Ex.: 96" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Vagas de titulares">
            <input type="number" min="0" className={inputClass} value={titularVacancies} onChange={(e) => setTitularVacancies(e.target.value)} placeholder="Ex.: 2" />
          </Field>
          <Field label="Vagas de suplentes">
            <input type="number" min="0" className={inputClass} value={suplenteVacancies} onChange={(e) => setSuplenteVacancies(e.target.value)} placeholder="Ex.: 2" />
          </Field>
          <div className="flex items-end">
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-400">
              <i className="ri-information-line mt-0.5"></i>
              O Edital de Resultado classifica automaticamente os eleitos entre titulares e suplentes conforme as vagas.
            </p>
          </div>
        </div>

        {suggestion && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 dark:border-secondary-800 dark:bg-secondary-950">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
              <i className="ri-scales-3-line text-base"></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-secondary-800">Sugestão pelo Quadro I da NR-5</p>
              {suggestion.required ? (
                <p className="mt-0.5 text-xs leading-relaxed text-foreground-700">
                  {selectedCipa?.name} · {suggestion.rangeLabel} · {suggestion.group} →{" "}
                  <strong className="font-semibold text-foreground-900">
                    {suggestion.titulares} titular(es)
                  </strong>{" "}
                  e <strong className="font-semibold text-foreground-900">{suggestion.suplentes} suplente(s)</strong> por parte.
                </p>
              ) : (
                <p className="mt-0.5 text-xs leading-relaxed text-foreground-700">
                  {selectedCipa?.name} · {suggestion.rangeLabel} · {suggestion.group} — o porte atual
                  <strong className="font-semibold text-foreground-900"> dispensa a constituição de CIPA</strong> (basta um
                  trabalhador designado). As vagas ficam a seu critério.
                </p>
              )}
            </div>
            {suggestion.required && (
              <button
                type="button"
                onClick={applySuggestion}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-secondary-600"
              >
                <i className="ri-magic-line text-base"></i>
                Aplicar sugestão
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Início das inscrições">
            <input type="date" className={inputClass} value={registrationStart} onChange={(e) => setRegistrationStart(e.target.value)} />
          </Field>
          <Field label="Fim das inscrições">
            <input type="date" className={inputClass} value={registrationEnd} onChange={(e) => setRegistrationEnd(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Data da votação">
            <input type="date" className={inputClass} value={voteDate} onChange={(e) => setVoteDate(e.target.value)} />
          </Field>
          <Field label="Hora de início da votação">
            <input type="time" className={inputClass} value={voteStartTime} onChange={(e) => setVoteStartTime(e.target.value)} />
          </Field>
          <Field label="Hora de encerramento da votação">
            <input type="time" className={inputClass} value={voteEndTime} onChange={(e) => setVoteEndTime(e.target.value)} />
          </Field>
        </div>
        <p className="-mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-400">
          <i className="ri-information-line mt-0.5"></i>
          A votação pela urna eletrônica só aceita votos dentro dessa janela (data + horário). Os colaboradores recebem o link de votação por e-mail.
        </p>

        <Field label="Aviso / texto do edital de convocação">
          <div className="flex flex-col gap-1.5">
            <textarea
              className={`${inputClass} min-h-[110px] resize-y leading-relaxed`}
              value={notice}
              maxLength={1200}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="Escreva aqui as palavras que abrirão o Edital de Convocação."
            />
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 text-[11px] text-foreground-400">
                <i className="ri-information-line"></i>
                Este texto aparece no mural de aviso e no PDF do edital.
              </span>
              <span className="text-[11px] text-foreground-400">{notice.length}/1200</span>
            </div>
          </div>
        </Field>

        <section className="flex flex-col gap-3 border-t border-background-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
              <i className="ri-group-line text-base text-primary-700"></i>
              Candidatos / chapas
            </h3>
            <span className="text-[11px] text-foreground-400">{totalVotes} voto(s) registrado(s)</span>
          </div>

          <div className="flex flex-col gap-3">
            {candidates.map((c, idx) => (
              <div key={c.id} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-background-200 bg-background-100/60 p-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <Field label={`Candidato ${idx + 1} · Nome`}>
                    <input className={inputClass} value={c.name} onChange={(e) => updateCandidate(c.id, { name: e.target.value })} placeholder="Nome do candidato" />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Função">
                    <input className={inputClass} value={c.roleFunction} onChange={(e) => updateCandidate(c.id, { roleFunction: e.target.value })} placeholder="Função" />
                  </Field>
                </div>
                <div className="sm:col-span-3">
                  <Field label="Votos">
                    <input type="number" className={inputClass} value={c.votes} onChange={(e) => updateCandidate(c.id, { votes: Number(e.target.value) })} />
                  </Field>
                </div>
                <div className="sm:col-span-1">
                  {candidates.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remover candidato"
                      onClick={() => setCandidates((prev) => prev.filter((x) => x.id !== c.id))}
                      className="flex h-[42px] w-full items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-accent-100 hover:text-accent-800"
                    >
                      <i className="ri-delete-bin-line text-base"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCandidates((prev) => [...prev, blankCandidate()])}
            className="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-md border border-dashed border-background-300 bg-background-50 px-3.5 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:border-primary-400 hover:text-primary-700"
          >
            <i className="ri-add-line text-base"></i>
            Adicionar candidato
          </button>
        </section>
      </div>
    </Modal>
  );
}