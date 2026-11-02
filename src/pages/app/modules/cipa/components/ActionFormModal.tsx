import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  actionOrigins,
  actionPriorities,
  actionStatuses,
  type ActionPriority,
  type ActionStatus,
  type Cipa,
  type CipaAction,
} from "@/mocks/cipa";
import { generateId } from "@/pages/app/modules/cipa/cipaUtils";

interface ActionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (action: CipaAction) => void;
  cipas: Cipa[];
  editing?: CipaAction | null;
}

export default function ActionFormModal({ open, onClose, onSave, cipas, editing }: ActionFormModalProps) {
  const [cipaId, setCipaId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState(actionOrigins[0]);
  const [responsible, setResponsible] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ActionPriority>("Média");
  const [status, setStatus] = useState<ActionStatus>("Pendente");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCipaId(editing.cipaId);
      setTitle(editing.title);
      setDescription(editing.description);
      setOrigin(editing.origin);
      setResponsible(editing.responsible);
      setDueDate(editing.dueDate);
      setPriority(editing.priority);
      setStatus(editing.status);
    } else {
      setCipaId(cipas[0]?.id || "");
      setTitle("");
      setDescription("");
      setOrigin(actionOrigins[0]);
      setResponsible("");
      setDueDate("");
      setPriority("Média");
      setStatus("Pendente");
    }
    setError("");
  }, [open, editing, cipas]);

  const handleSubmit = () => {
    if (!cipaId) return setError("Selecione a CIPA.");
    if (title.trim().length < 3) return setError("Informe o título da ação.");
    setError("");
    onSave({
      id: editing?.id ?? generateId("ac"),
      cipaId,
      title: title.trim(),
      description: description.trim(),
      origin,
      responsible: responsible.trim(),
      dueDate,
      priority,
      status,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar ação" : "Nova ação"}
      subtitle="Plano de ação da CIPA: registre o que será feito, por quem e até quando."
      icon="ri-task-line"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-save-3-line">
            {editing ? "Salvar" : "Criar ação"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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

        <Field label="Título da ação" required>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Repor sinalização das rotas de fuga" />
        </Field>

        <Field label="Descrição">
          <textarea className={`${inputClass} min-h-[90px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhe o que precisa ser feito." />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Origem">
            <div className="relative">
              <select className={selectClass} value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {actionOrigins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
          <Field label="Responsável">
            <input className={inputClass} value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Ex.: Manutenção / SESMT" />
          </Field>
          <Field label="Prazo">
            <input className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="dd/mm/aaaa" />
          </Field>
          <Field label="Prioridade">
            <div className="relative">
              <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as ActionPriority)}>
                {actionPriorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        </div>

        <Field label="Situação">
          <div className="relative">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as ActionStatus)}>
              {actionStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>
      </div>
    </Modal>
  );
}