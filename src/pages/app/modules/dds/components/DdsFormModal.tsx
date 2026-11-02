import { useEffect, useMemo, useState } from "react";
import Modal, { Field, inputClass, selectClass, ModalButton } from "@/pages/app/components/Modal";
import { ddsAreas, ddsThemes, ddsTrainings, type DdsRecord } from "@/mocks/dds";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { getInitials } from "@/pages/app/context";

interface DdsFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (record: DdsRecord) => void;
}

const emptyForm = {
  title: "",
  date: "",
  time: "07:10",
  theme: ddsThemes[0],
  trainingId: "",
  facilitator: "",
  area: ddsAreas[0],
  location: "",
  duration: "15 min",
  participantIds: [] as string[],
  status: "Realizado" as DdsRecord["status"],
  notes: "",
};

const durations = ["5 min", "10 min", "15 min", "20 min", "30 min"];

/** Valor sentinela da opção "Outros" no campo Tema / Norma. */
const OTHER_THEME = "__outros__";

function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export default function DdsFormModal({ open, onClose, onCreate }: DdsFormModalProps) {
  const collaborators = useCollaboratorsList();
  const [form, setForm] = useState(emptyForm);
  const [customTheme, setCustomTheme] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicDraft, setTopicDraft] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setCustomTheme("");
      setTopics([]);
      setTopicDraft("");
      setPhotos([]);
      setParticipantSearch("");
      setError("");
    }
  }, [open]);

  const canSubmit = useMemo(
    () =>
      form.title.trim().length > 2 &&
      form.facilitator.trim().length > 1 &&
      form.date !== "" &&
      form.participantIds.length > 0 &&
      (form.theme !== OTHER_THEME || customTheme.trim().length > 1),
    [form.title, form.facilitator, form.date, form.participantIds, form.theme, customTheme]
  );

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleParticipant = (id: string) =>
    setForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(id)
        ? prev.participantIds.filter((x) => x !== id)
        : [...prev.participantIds, id],
    }));

  const selectedCollaborators = useMemo(
    () => collaborators.filter((c) => form.participantIds.includes(c.id)),
    [collaborators, form.participantIds]
  );

  // Unidade do DDS derivada automaticamente dos participantes.
  const establishment = useMemo(() => {
    const counts = new Map<string, number>();
    selectedCollaborators.forEach((c) => {
      const unit = c.establishment || "";
      if (unit) counts.set(unit, (counts.get(unit) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [selectedCollaborators]);

  const filteredCollaborators = useMemo(() => {
    const term = participantSearch.trim().toLowerCase();
    if (!term) return collaborators;
    return collaborators.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.role.toLowerCase().includes(term) ||
        c.area.toLowerCase().includes(term)
    );
  }, [collaborators, participantSearch]);

  const addTopic = () => {
    const value = topicDraft.trim();
    if (!value) return;
    setTopics((prev) => [...prev, value]);
    setTopicDraft("");
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    Promise.all(
      list.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          })
      )
    ).then((urls) => setPhotos((prev) => [...prev, ...urls.filter(Boolean)]));
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      if (form.theme === OTHER_THEME) {
        setError("Informe o tema / norma do DDS (a opção \"Outros\" exige o preenchimento).");
      } else {
        setError("Preencha o título, o facilitador, a data e selecione ao menos um participante.");
      }
      return;
    }
    const record: DdsRecord = {
      id: `dds-${Date.now()}`,
      title: form.title.trim(),
      date: toBrDate(form.date),
      time: form.time || "—",
      theme: form.theme === OTHER_THEME ? customTheme.trim() : form.theme,
      trainingId: form.trainingId,
      trainingName: ddsTrainings.find((t) => t.id === form.trainingId)?.name || "",
      facilitator: form.facilitator.trim(),
      area: form.area,
      location: form.location.trim() || "—",
      duration: form.duration,
      participants: selectedCollaborators.length,
      participantIds: form.participantIds,
      participantNames: selectedCollaborators.map((c) => c.name),
      topics,
      notes: form.notes.trim(),
      status: form.status,
      cover: photos[0] || "",
      photos,
      establishment,
    };
    onCreate(record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo DDS"
      subtitle="Registre o Diálogo Diário de Segurança com fotos e todas as informações da atividade."
      icon="ri-presentation-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSubmit} icon="ri-check-line">
            Registrar DDS
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Título do DDS" required className="md:col-span-2">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: Uso correto do cinto de segurança em altura"
          />
        </Field>

        <Field label="Data" required>
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
        </Field>

        <Field label="Horário">
          <input type="time" className={inputClass} value={form.time} onChange={(e) => set("time", e.target.value)} />
        </Field>

        <Field label="Facilitador (quem conduziu)" required>
          <input
            className={inputClass}
            value={form.facilitator}
            onChange={(e) => set("facilitator", e.target.value)}
            placeholder="Ex.: Juliana Prado"
          />
        </Field>

        <Field label="Tema / Norma">
          <div className="relative">
            <select className={selectClass} value={form.theme} onChange={(e) => set("theme", e.target.value)}>
              {ddsThemes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={OTHER_THEME}>Outros</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        {form.theme === OTHER_THEME && (
          <Field
            label="Informe o tema / norma"
            required
            className="md:col-span-2"
            hint="Descreva qual é o tema ou a norma deste DDS."
          >
            <input
              className={inputClass}
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              placeholder="Ex.: Trabalho a quente (NR-34) / Procedimento interno de bloqueio"
            />
          </Field>
        )}

        <Field label="Setor / Equipe">
          <div className="relative">
            <select className={selectClass} value={form.area} onChange={(e) => set("area", e.target.value)}>
              {ddsAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Local">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ex.: Pátio Industrial A"
          />
        </Field>

        <Field label="Duração">
          <div className="relative">
            <select className={selectClass} value={form.duration} onChange={(e) => set("duration", e.target.value)}>
              {durations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <Field label="Situação">
          <div className="relative">
            <select
              className={selectClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as DdsRecord["status"])}
            >
              <option value="Realizado">Realizado</option>
              <option value="Agendado">Agendado</option>
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground-700">
              Participantes (colaboradores da base)<span className="ml-0.5 text-accent-600">*</span>
            </span>
            <span className="text-[11px] text-foreground-400">
              {form.participantIds.length} selecionado(s)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-foreground-400">
            Selecione os colaboradores que participaram deste DDS. A contagem é preenchida automaticamente.
          </p>

          <div className="mt-2 rounded-lg border border-background-300 bg-background-50">
            {selectedCollaborators.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-background-200 p-3">
                {selectedCollaborators.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 py-1 pl-3 pr-1.5 text-xs font-semibold text-secondary-900"
                  >
                    {c.name}
                    <button
                      type="button"
                      aria-label={`Remover ${c.name}`}
                      onClick={() => toggleParticipant(c.id)}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-secondary-800 transition-colors hover:bg-secondary-200"
                    >
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 border-b border-background-200 px-3">
              <i className="ri-search-line text-sm text-foreground-400"></i>
              <input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Buscar por nome, função ou setor..."
                className="w-full bg-transparent py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
              {filteredCollaborators.map((c) => {
                const checked = form.participantIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleParticipant(c.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                      checked ? "bg-primary-50" : "hover:bg-background-100"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        checked ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300"
                      }`}
                    >
                      {checked && <i className="ri-check-line text-xs"></i>}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-200 text-[11px] font-bold text-foreground-700">
                      {getInitials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground-900">{c.name}</span>
                      <span className="block truncate text-xs text-foreground-500">
                        {c.role} · {c.area}
                      </span>
                    </span>
                  </button>
                );
              })}
              {filteredCollaborators.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-foreground-500">Nenhum colaborador encontrado.</p>
              )}
            </div>
          </div>
        </div>

        <Field label="Treinamento vinculado" className="md:col-span-2" hint="Relacione este DDS ao treinamento/norma correspondente para o relatório de participações.">
          <div className="relative">
            <select className={selectClass} value={form.trainingId} onChange={(e) => set("trainingId", e.target.value)}>
              <option value="">Sem vínculo com treinamento</option>
              {ddsTrainings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          </div>
        </Field>

        <div className="md:col-span-2">
          <Field label="Tópicos abordados" hint="Adicione os principais pontos discutidos no diálogo.">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                placeholder="Ex.: Inspeção do cinto antes do uso"
              />
              <button
                type="button"
                onClick={addTopic}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-add-line text-base"></i>
                Adicionar
              </button>
            </div>
          </Field>
          {topics.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {topics.map((topic, index) => (
                <li
                  key={`${topic}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-background-200 bg-background-100 px-3 py-2 text-sm text-foreground-800"
                >
                  <i className="ri-checkbox-circle-line text-secondary-700"></i>
                  <span className="flex-1">{topic}</span>
                  <button
                    type="button"
                    aria-label="Remover tópico"
                    onClick={() => setTopics((prev) => prev.filter((_, i) => i !== index))}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-200"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="Observações" className="md:col-span-2" hint="Máximo de 500 caracteres.">
          <textarea
            className={`${inputClass} min-h-[96px] resize-y`}
            maxLength={500}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Pontos de atenção, encaminhamentos, dúvidas levantadas..."
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Fotos do DDS" hint="Anexe as fotos do encontro — a primeira será usada como capa.">
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-background-300 bg-background-50 px-5 py-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50">
              <i className="ri-image-add-line text-2xl text-primary-600"></i>
              <span className="text-sm font-semibold text-foreground-800">Clique para enviar fotos</span>
              <span className="text-xs text-foreground-500">PNG ou JPG · várias imagens</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </Field>

          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((url, index) => (
                <div key={`${url}-${index}`} className="relative overflow-hidden rounded-md border border-background-200">
                  <div className="h-24 w-full bg-background-100">
                    <img src={url} alt={`Foto ${index + 1} do DDS`} className="h-full w-full object-cover object-top" />
                  </div>
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold text-background-50">
                      Capa
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-foreground-950/60 text-background-50 transition-colors hover:bg-foreground-950/80"
                  >
                    <i className="ri-delete-bin-line text-sm"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}