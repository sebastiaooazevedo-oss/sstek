import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { meetingStatuses, meetingTypes, type Cipa, type CipaMeeting, type MeetingStatus, type MeetingType } from "@/mocks/cipa";
import { generateId } from "@/pages/app/modules/cipa/cipaUtils";

interface MeetingFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (meeting: CipaMeeting) => void;
  cipas: Cipa[];
  editing?: CipaMeeting | null;
}

export default function MeetingFormModal({ open, onClose, onSave, cipas, editing }: MeetingFormModalProps) {
  const [cipaId, setCipaId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MeetingType>("Ordinária");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [agendaText, setAgendaText] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<MeetingStatus>("Agendada");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCipaId(editing.cipaId);
      setTitle(editing.title);
      setType(editing.type);
      setDate(editing.date);
      setTime(editing.time);
      setLocation(editing.location);
      setAgendaText(editing.agenda.join("\n"));
      setNotes(editing.notes);
      setStatus(editing.status);
    } else {
      setCipaId(cipas[0]?.id || "");
      setTitle("");
      setType("Ordinária");
      setDate("");
      setTime("");
      setLocation("");
      setAgendaText("");
      setNotes("");
      setStatus("Agendada");
    }
    setError("");
  }, [open, editing, cipas]);

  const handleSubmit = () => {
    if (!cipaId) return setError("Selecione a CIPA responsável pelo compromisso.");
    if (title.trim().length < 3) return setError("Informe o título da reunião/evento.");
    if (!date) return setError("Informe a data do compromisso.");
    setError("");
    onSave({
      id: editing?.id ?? generateId("mt"),
      cipaId,
      title: title.trim(),
      type,
      date,
      time,
      location: location.trim(),
      agenda: agendaText.split("\n").map((l) => l.trim()).filter(Boolean),
      notes: notes.trim(),
      status,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar compromisso" : "Agendar reunião / evento"}
      subtitle="Organize a agenda da CIPA: reuniões ordinárias, extraordinárias e eventos como a SIPAT."
      icon="ri-calendar-schedule-line"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-calendar-check-line">
            {editing ? "Salvar" : "Agendar"}
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
          <Field label="Tipo" required>
            <div className="relative">
              <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
                {meetingTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        </div>

        <Field label="Título" required>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Reunião Ordinária — Outubro/2026" />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Data" required>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Hora">
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Situação">
            <div className="relative">
              <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as MeetingStatus)}>
                {meetingStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        </div>

        <Field label="Local / Link">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Sala de Treinamento 1 ou link da videoconferência" />
        </Field>

        <Field label="Pauta da reunião" hint="Um item por linha.">
          <textarea
            className={`${inputClass} min-h-[110px] resize-y`}
            value={agendaText}
            onChange={(e) => setAgendaText(e.target.value)}
            placeholder={"Leitura da ata anterior\nAnálise das inspeções do período\nAções em aberto"}
          />
        </Field>

        <Field label="Observações">
          <textarea className={`${inputClass} min-h-[70px] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações complementares do compromisso." />
        </Field>
      </div>
    </Modal>
  );
}