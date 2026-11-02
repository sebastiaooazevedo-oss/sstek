import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import PhotoUploadField from "@/pages/app/modules/cipa/components/PhotoUploadField";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { ataApprovers, generateId, toBrDate } from "@/pages/app/modules/cipa/cipaUtils";
import type { Cipa, CipaAta, CipaAtaSignature, CipaMeeting, CipaPhoto } from "@/mocks/cipa";

interface AtaFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (ata: CipaAta) => void;
  cipas: Cipa[];
  meetings: CipaMeeting[];
}

export default function AtaFormModal({ open, onClose, onSave, cipas, meetings }: AtaFormModalProps) {
  const [cipaId, setCipaId] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [decisionsText, setDecisionsText] = useState("");
  const [participantsText, setParticipantsText] = useState("");
  const [photos, setPhotos] = useState<CipaPhoto[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCipaId(cipas[0]?.id || "");
    setMeetingId("");
    setNumber("");
    setDate("");
    setTitle("");
    setContent("");
    setDecisionsText("");
    setParticipantsText("");
    setPhotos([]);
    setError("");
  }, [open, cipas]);

  const relatedMeetings = meetings.filter((m) => !cipaId || m.cipaId === cipaId);

  const handleMeeting = (id: string) => {
    setMeetingId(id);
    const meeting = meetings.find((m) => m.id === id);
    if (meeting) {
      setTitle(`Ata da ${meeting.title}`);
      setDate(toBrDate(meeting.date));
      setContent(
        `Aos ${meeting.date} reuniram-se os membros da CIPA em ${meeting.location}. A reunião cumpriu a seguinte pauta: ${meeting.agenda
          .map((a) => a.toLowerCase())
          .join("; ")}. As deliberações estão registradas nesta ata.`
      );
    }
  };

  const cipaName = cipas.find((c) => c.id === cipaId)?.name || "—";

  const buildBody = () => {
    const decisions = decisionsText.split("\n").map((l) => l.trim()).filter(Boolean);
    const participants = participantsText.split("\n").map((l) => l.trim()).filter(Boolean);
    const photoBlock = photos.length
      ? `<h2>Registro fotográfico</h2><div class="photo-grid">${photos
          .map((p) => `<figure><img src="${p.url}" alt="Registro da reunião" /><figcaption>${escapeHtml(p.name)}</figcaption></figure>`)
          .join("")}</div>`
      : "";
    return `${pdfHeader("Ata de Reunião da CIPA")}
      <h1>${escapeHtml(title.trim()) || "Ata de reunião da CIPA"}</h1>
      <p class="muted">${escapeHtml(cipaName)} · Ata nº ${escapeHtml(number.trim()) || "—"}</p>
      <div class="grid">
        <div><strong>Data:</strong> ${escapeHtml(date) || "—"}</div>
        <div><strong>CIPA:</strong> ${escapeHtml(cipaName)}</div>
      </div>
      <h2>Registro</h2>
      <p>${escapeHtml(content.trim()) || "—"}</p>
      <h2>Deliberações</h2>
      <ul class="cover-list">${decisions.map((d) => `<li>${escapeHtml(d)}</li>`).join("") || "<li>—</li>"}</ul>
      <h2>Participantes</h2>
      <ul class="cover-list">${participants.map((p) => `<li>${escapeHtml(p)}</li>`).join("") || "<li>—</li>"}</ul>
      ${photoBlock}
      ${pdfFooter()}`;
  };

  const handleExport = () => {
    if (title.trim().length < 3) return setError("Informe o título da ata para exportar.");
    setError("");
    printHtml(`Ata da CIPA — ${title.trim()}`, buildBody());
  };

  const handleSubmit = () => {
    if (!cipaId) return setError("Selecione a CIPA.");
    if (title.trim().length < 3) return setError("Informe o título da ata.");
    if (content.trim().length < 10) return setError("Descreva o conteúdo da ata.");
    setError("");
    const cipa = cipas.find((c) => c.id === cipaId);
    const approvals: CipaAtaSignature[] = ataApprovers(cipa).map((a) => ({
      id: generateId("ataappr"),
      role: a.role,
      name: a.name,
      collaboratorId: a.collaboratorId,
      signedAt: null,
      signatureUid: null,
      representationSnapshot: null,
    }));
    onSave({
      id: generateId("ata"),
      cipaId,
      meetingId,
      number: number.trim(),
      date,
      title: title.trim(),
      content: content.trim(),
      decisions: decisionsText.split("\n").map((l) => l.trim()).filter(Boolean),
      participants: participantsText.split("\n").map((l) => l.trim()).filter(Boolean),
      photos,
      approvals,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova ata de reunião"
      subtitle="Registre as deliberações da reunião da CIPA, os participantes e o registro fotográfico."
      icon="ri-file-text-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton variant="ghost" onClick={handleExport} icon="ri-file-pdf-2-line">
            Exportar PDF
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-save-3-line">
            Salvar ata
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CIPA" required>
            <div className="relative">
              <select className={selectClass} value={cipaId} onChange={(e) => setCipaId(e.target.value)}>
                {cipas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
          <Field label="Reunião vinculada" hint="Opcional — preenche título e data automaticamente.">
            <div className="relative">
              <select className={selectClass} value={meetingId} onChange={(e) => handleMeeting(e.target.value)}>
                <option value="">Sem vínculo</option>
                {relatedMeetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {m.date}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Número da ata">
            <input className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex.: 013/2026" />
          </Field>
          <Field label="Data">
            <input className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} placeholder="dd/mm/aaaa" />
          </Field>
          <Field label="Título" required className="sm:col-span-1">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ata da Reunião Ordinária" />
          </Field>
        </div>

        <Field label="Conteúdo da ata" required>
          <textarea
            className={`${inputClass} min-h-[150px] resize-y`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Descreva o que foi discutido na reunião, na ordem em que ocorreu."
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Deliberações" hint="Um item por linha.">
            <textarea
              className={`${inputClass} min-h-[110px] resize-y`}
              value={decisionsText}
              onChange={(e) => setDecisionsText(e.target.value)}
              placeholder={"Ação 1 aprovada\nAção 2 aprovada"}
            />
          </Field>
          <Field label="Participantes" hint="Um nome por linha.">
            <textarea
              className={`${inputClass} min-h-[110px] resize-y`}
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
              placeholder={"Nome do membro 1\nNome do membro 2"}
            />
          </Field>
        </div>

        <div className="border-t border-background-200 pt-4">
          <PhotoUploadField value={photos} onChange={setPhotos} label="Registro fotográfico" hint="JPG ou PNG — anexe fotos da reunião" />
        </div>
      </div>
    </Modal>
  );
}