import { useEffect, useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  candidatePhotoGuidelines,
  candidateRequirements,
  type CipaElection,
  type ElectionCandidate,
} from "@/mocks/cipa";
import { candidacyState, generateId, toDisplayDate } from "@/pages/app/modules/cipa/cipaUtils";

interface CandidateRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (candidate: ElectionCandidate, electionId: string) => void;
  election: CipaElection | null;
  /** Processos eleitorais disponíveis para vincular a ficha. */
  elections?: CipaElection[];
  cipaName: string;
  editing?: ElectionCandidate | null;
}

/** Ficha de inscrição de candidato a uma vaga da CIPA. */
export default function CandidateRegistrationModal({
  open,
  onClose,
  onSave,
  election,
  elections = [],
  cipaName,
  editing,
}: CandidateRegistrationModalProps) {
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  const [roleFunction, setRoleFunction] = useState("");
  const [area, setArea] = useState("");
  const [contact, setContact] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  // Processos disponíveis: apenas os que estão com inscrições abertas. O
  // processo de origem (card clicado) é sempre incluído para permitir editar
  // uma ficha já existente mesmo que o prazo tenha encerrado.
  const processOptions = useMemo(() => {
    const open = elections.filter((e) => candidacyState(e).phase === "aberta");
    const list = [...open];
    if (election && !list.some((e) => e.id === election.id)) list.unshift(election);
    return list;
  }, [elections, election]);

  const selectedElection = processOptions.find((e) => e.id === selectedId) || election || null;
  const selectedOpen = selectedElection ? candidacyState(selectedElection).phase === "aberta" : false;

  useEffect(() => {
    if (!open) return;
    setSelectedId(election?.id ?? "");
    if (editing) {
      setName(editing.name);
      setRegistration(editing.registration || "");
      setRoleFunction(editing.roleFunction);
      setArea(editing.area);
      setContact(editing.contact || "");
      setPhotoUrl(editing.photoUrl || "");
      setAccepted(Boolean(editing.photoUrl));
    } else {
      setName("");
      setRegistration("");
      setRoleFunction("");
      setArea("");
      setContact("");
      setPhotoUrl("");
      setAccepted(false);
    }
    setError("");
  }, [open, editing]);

  const handlePhoto = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("A foto deve ser um arquivo de imagem (JPG ou PNG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A foto deve ter no máximo 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoUrl(reader.result);
        setError("");
      }
    };
    reader.readAsDataURL(file);
  };

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const handleSubmit = () => {
    if (!selectedElection) return setError("Selecione o processo eleitoral.");
    if (name.trim().length < 3) return setError("Informe o nome completo do candidato.");
    if (!roleFunction.trim()) return setError("Informe a função/cargo do candidato.");
    if (!area.trim()) return setError("Informe a área/setor do candidato.");
    if (!photoUrl) return setError("Anexe a foto 3x4 com fundo branco.");
    if (!accepted) return setError("É necessário aceitar a declaração de elegibilidade.");
    setError("");
    onSave(
      {
        id: editing?.id ?? generateId("ca"),
        name: name.trim(),
        roleFunction: roleFunction.trim(),
        area: area.trim(),
        votes: editing?.votes ?? 0,
        registration: registration.trim(),
        contact: contact.trim(),
        photoUrl,
        declaredAt: editing?.declaredAt ?? todayStr,
      },
      selectedElection.id
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar ficha de inscrição" : "Ficha de inscrição de candidato"}
      subtitle={`Processo eleitoral: ${selectedElection?.title || "—"} · ${cipaName}`}
      icon="ri-user-add-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-send-plane-line">
            {editing ? "Salvar candidato" : "Inscrever candidato"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label="Processo eleitoral"
          required
          hint="A ficha de cadastro é vinculada ao processo eleitoral selecionado. São listados os processos com inscrições abertas."
        >
          <div className="relative">
            <select
              className={selectClass}
              value={selectedElection?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={Boolean(editing) || processOptions.length <= 1}
            >
              {processOptions.length === 0 && <option value="">Nenhum processo com inscrições abertas</option>}
              {processOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}{e.processNumber ? ` · ${e.processNumber}` : ""}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        {processOptions.length === 0 && (
          <p className="flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-alert-line mt-0.5"></i>
            Nenhum processo eleitoral da CIPA está com inscrições abertas no momento. Abra o prazo de inscrição na aba Eleições
            antes de cadastrar a ficha.
          </p>
        )}

        {processOptions.length > 0 && !selectedOpen && (
          <p className="flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-alert-line mt-0.5"></i>
            As inscrições deste processo não estão abertas — verifique o prazo de inscrição antes de registrar novas fichas.
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
          {/* Foto 3x4 */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-foreground-700">
              Foto 3x4 <span className="text-accent-600">*</span>
            </span>
            <div className="mx-auto w-[180px]">
              <div className="relative h-[240px] w-full overflow-hidden rounded-lg border border-dashed border-background-300 bg-white">
                {photoUrl ? (
                  <img src={photoUrl} alt="Prévia da foto do candidato" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
                    <i className="ri-user-3-line text-3xl text-foreground-300"></i>
                    <span className="px-4 text-[11px] text-foreground-400">Fundo branco</span>
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600">
                  <i className="ri-upload-2-line text-base"></i>
                  {photoUrl ? "Trocar" : "Enviar foto"}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handlePhoto(e.target.files)} />
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setPhotoUrl("")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-background-300 text-foreground-500 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-delete-bin-line text-base"></i>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Campos */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome completo" required className="sm:col-span-2">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do candidato" />
              </Field>
              <Field label="Matrícula">
                <input className={inputClass} value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="Ex.: 301002" />
              </Field>
              <Field label="Função / cargo" required>
                <input className={inputClass} value={roleFunction} onChange={(e) => setRoleFunction(e.target.value)} placeholder="Ex.: Técnico de Manutenção" />
              </Field>
              <Field label="Área / setor" required>
                <input className={inputClass} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ex.: Manutenção" />
              </Field>
              <Field label="Contato (e-mail ou telefone)">
                <input className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="nome@empresa.com.br" />
              </Field>
            </div>
            <p className="flex items-start gap-2 rounded-md bg-background-100 px-3.5 py-2.5 text-[11px] leading-relaxed text-foreground-500">
              <i className="ri-information-line mt-0.5 text-secondary-600"></i>
              A foto segue a regra de <strong className="font-semibold text-foreground-700">fundo branco</strong>. Ela é exibida na lista pública de candidatos para que todos saibam quem está concorrendo.
            </p>
          </div>
        </div>

        {/* Recomendações da foto */}
        <section className="rounded-lg border border-background-200 bg-background-100/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-camera-lens-line text-base text-primary-700"></i>
            Recomendações para a foto 3x4
          </h3>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {candidatePhotoGuidelines.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-foreground-700">
                <i className="ri-checkbox-circle-line mt-0.5 shrink-0 text-primary-600"></i>
                {rule}
              </li>
            ))}
          </ul>
        </section>

        {/* Requisitos de elegibilidade */}
        <section className="rounded-lg border border-background-200 bg-background-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground-950">
            <i className="ri-shield-check-line text-base text-accent-700"></i>
            Requisitos para concorrer às vagas (NR-5)
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {candidateRequirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-foreground-700">
                <i className="ri-list-check-2 mt-0.5 shrink-0 text-secondary-600"></i>
                {req}
              </li>
            ))}
          </ul>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-background-200 bg-background-100/70 px-3.5 py-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
            />
            <span className="text-xs leading-relaxed text-foreground-700">
              Declaro que atendo a todos os requisitos de elegibilidade do edital e que as informações e a foto enviadas são
              verdadeiras, autorizando a divulgação do meu nome na lista pública de candidatos.
            </span>
          </label>
        </section>

        {editing?.declaredAt && (
          <p className="text-[11px] text-foreground-400">Ficha cadastrada em {toDisplayDate(editing.declaredAt)}.</p>
        )}
      </div>
    </Modal>
  );
}