import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { useAppSession } from "@/pages/app/context";
import {
  collaboratorAreas,
  collaboratorEstablishments,
  collaboratorStatuses,
  type Collaborator,
  type CollaboratorStatus,
} from "@/mocks/collaborators";
import { canAllocateLeaders } from "@/pages/app/modules/leadership/leadershipStore";

const defaultPhoto =
  "/images/9d3b7f9b9b.jpg";

interface FormState {
  name: string;
  role: string;
  area: string;
  establishment: string;
  cpf: string;
  matricula: string;
  rg: string;
  pis: string;
  ctps: string;
  admissionDate: string;
  birthDate: string;
  phone: string;
  email: string;
  city: string;
  status: CollaboratorStatus;
  managerId: string;
  technicalResponsible: boolean;
  hasAllergy: boolean;
  allergies: string[];
  photo: string;
}

const emptyForm: FormState = {
  name: "",
  role: "",
  area: "",
  establishment: "",
  cpf: "",
  matricula: "",
  rg: "",
  pis: "",
  ctps: "",
  admissionDate: "",
  birthDate: "",
  phone: "",
  email: "",
  city: "",
  status: "Ativo",
  managerId: "",
  technicalResponsible: false,
  hasAllergy: false,
  allergies: [],
  photo: defaultPhoto,
};

interface CollaboratorFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (collaborator: Collaborator) => Promise<boolean> | boolean | void;
  initial: Collaborator | null;
  /** Equipe atual (store real), usada na lista de gestor/líder responsável. */
  team: Collaborator[];
}

export default function CollaboratorFormModal({ open, onClose, onSave, initial, team }: CollaboratorFormModalProps) {
  const session = useAppSession();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const canAllocate = canAllocateLeaders(session.role);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (initial) {
      setForm({
        name: initial.name,
        role: initial.role,
        area: initial.area,
        establishment: initial.establishment ?? "",
        cpf: initial.cpf,
        matricula: initial.matricula,
        rg: initial.rg,
        pis: initial.pis,
        ctps: initial.ctps,
        admissionDate: initial.admissionDate,
        birthDate: initial.birthDate,
        phone: initial.phone,
        email: initial.email,
        city: initial.city,
        status: initial.status,
        managerId: initial.managerId || "",
        technicalResponsible: Boolean(initial.technicalResponsible),
        hasAllergy: Boolean(initial.allergies && initial.allergies.length > 0),
        allergies: initial.allergies && initial.allergies.length > 0 ? [...initial.allergies] : [],
        photo: initial.photo,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAllergy = () =>
    setForm((prev) => {
      const next = !prev.hasAllergy;
      return {
        ...prev,
        hasAllergy: next,
        allergies: next && prev.allergies.length === 0 ? [""] : prev.allergies,
      };
    });

  const addAllergy = () => setForm((prev) => ({ ...prev, allergies: [...prev.allergies, ""] }));

  const removeAllergy = (index: number) =>
    setForm((prev) => ({ ...prev, allergies: prev.allergies.filter((_, i) => i !== index) }));

  const updateAllergy = (index: number, value: string) =>
    setForm((prev) => ({
      ...prev,
      allergies: prev.allergies.map((item, i) => (i === index ? value : item)),
    }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.role.trim() || !form.admissionDate.trim()) {
      setError("Preencha ao menos nome, função e data de admissão para salvar o cadastro.");
      return;
    }
    const allergyList = form.hasAllergy
      ? form.allergies.map((item) => item.trim()).filter(Boolean)
      : [];
    if (form.hasAllergy && allergyList.length === 0) {
      setError("Informe pelo menos uma alergia ou desative a opção de alergias.");
      return;
    }
    const collaborator: Collaborator = {
      id: initial?.id || `c-${Date.now()}`,
      name: form.name.trim(),
      role: form.role.trim(),
      area: form.area || "Produção",
      establishment: form.establishment || undefined,
      cpf: form.cpf,
      matricula: form.matricula.trim(),
      rg: form.rg,
      pis: form.pis,
      ctps: form.ctps,
      admissionDate: form.admissionDate,
      birthDate: form.birthDate,
      phone: form.phone,
      email: form.email,
      city: form.city,
      status: form.status,
      managerId: form.managerId || undefined,
      technicalResponsible: form.technicalResponsible,
      allergies: allergyList,
      photo: form.photo || defaultPhoto,
      documentsOk: initial?.documentsOk ?? 0,
      documentsTotal: initial?.documentsTotal ?? 9,
      trainingsActive: initial?.trainingsActive ?? 0,
      trainingsExpired: initial?.trainingsExpired ?? 0,
      episInUse: initial?.episInUse ?? 0,
    };
    setError("");
    const saved = await onSave(collaborator);
    if (saved === false) {
      setError("Não foi possível salvar o cadastro. Confira se o CPF já existe nesta empresa e tente novamente.");
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={initial ? "ri-user-settings-line" : "ri-user-add-line"}
      title={initial ? "Editar colaborador" : "Novo colaborador"}
      subtitle="Preencha os dados cadastrais. Campos com * são obrigatórios."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>
            Cancelar
          </ModalButton>
          <ModalButton icon="ri-save-3-line" onClick={handleSubmit}>
            {initial ? "Salvar alterações" : "Cadastrar colaborador"}
          </ModalButton>
        </>
      }
    >
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div className="h-28 w-28 overflow-hidden rounded-lg border border-background-200 bg-background-100">
            <img src={form.photo || defaultPhoto} alt="Foto do colaborador" className="h-full w-full object-top" />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-camera-line"></i>
            Alterar foto
          </button>
          <p className="max-w-[120px] text-center text-[11px] leading-relaxed text-foreground-400">
            JPG ou PNG, até 2 MB
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome completo" required className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: João da Silva Santos"
            />
          </Field>

          <Field label="Função" required>
            <input
              className={inputClass}
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Ex.: Soldador"
            />
          </Field>

          <Field label="Área / Setor">
            <div className="relative">
              <select className={selectClass} value={form.area} onChange={(e) => set("area", e.target.value)}>
                <option value="">Selecione a área</option>
                {collaboratorAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>

          <Field label="Estabelecimento / Unidade">
            <div className="relative">
              <select
                className={selectClass}
                value={form.establishment}
                onChange={(e) => set("establishment", e.target.value)}
              >
                <option value="">Selecione o estabelecimento</option>
                {collaboratorEstablishments.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>

          <Field label="CPF">
            <input className={inputClass} value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" />
          </Field>

          <Field label="Matrícula">
            <input
              className={inputClass}
              value={form.matricula}
              onChange={(e) => set("matricula", e.target.value)}
              placeholder="Ex.: 100234"
            />
          </Field>

          <Field label="RG">
            <input className={inputClass} value={form.rg} onChange={(e) => set("rg", e.target.value)} placeholder="00.000.000-0" />
          </Field>

          <Field label="PIS / PASEP">
            <input className={inputClass} value={form.pis} onChange={(e) => set("pis", e.target.value)} placeholder="000.0000.000-0" />
          </Field>

          <Field label="CTPS">
            <input className={inputClass} value={form.ctps} onChange={(e) => set("ctps", e.target.value)} placeholder="00000/0000" />
          </Field>

          <Field label="Data de admissão" required>
            <input
              type="date"
              className={inputClass}
              value={form.admissionDate}
              onChange={(e) => set("admissionDate", e.target.value)}
            />
          </Field>

          <Field label="Data de nascimento">
            <input type="date" className={inputClass} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </Field>

          <Field label="Celular">
            <input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
          </Field>

          <Field label="E-mail">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="colaborador@empresa.com.br"
            />
          </Field>

          <Field label="Cidade / UF">
            <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo/SP" />
          </Field>

          <Field label="Situação">
            <div className="relative">
              <select
                className={selectClass}
                value={form.status}
                onChange={(e) => set("status", e.target.value as CollaboratorStatus)}
              >
                {collaboratorStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>

          <Field
            label="Responsável Técnico de Segurança do Trabalho"
            className="sm:col-span-2"
            hint="Ao marcar, este colaborador assina eletronicamente as atas da CIPA e demais documentos que exigem responsabilidade técnica. Apenas um responsável técnico por empresa."
          >
            <button
              type="button"
              role="switch"
              aria-checked={form.technicalResponsible}
              onClick={() => set("technicalResponsible", !form.technicalResponsible)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${
                form.technicalResponsible
                  ? "border-primary-300 bg-primary-50"
                  : "border-background-300 bg-background-50 hover:bg-background-100"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  form.technicalResponsible
                    ? "border-primary-500 bg-primary-500 text-background-50"
                    : "border-background-400 bg-background-50 text-transparent"
                }`}
              >
                <i className="ri-check-line text-xs"></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground-950">
                  Este colaborador é o Responsável Técnico (RT)
                </span>
                <span className="mt-0.5 block text-xs text-foreground-500">
                  A assinatura eletrônica do RT será exigida nos documentos técnicos da empresa.
                </span>
              </span>
            </button>
          </Field>

          <Field
            label="Alergias"
            className="sm:col-span-2"
            hint="Registro de saúde ocupacional: informe alergias a medicamentos, alimentos, látex ou agentes químicos."
          >
            <button
              type="button"
              role="switch"
              aria-checked={form.hasAllergy}
              onClick={toggleAllergy}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${
                form.hasAllergy
                  ? "border-accent-300 bg-accent-50"
                  : "border-background-300 bg-background-50 hover:bg-background-100"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  form.hasAllergy
                    ? "border-accent-500 bg-accent-500 text-background-50"
                    : "border-background-400 bg-background-50 text-transparent"
                }`}
              >
                <i className="ri-check-line text-xs"></i>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground-950">
                  Este colaborador possui algum tipo de alergia
                </span>
                <span className="mt-0.5 block text-xs text-foreground-500">
                  Ao ativar, você pode cadastrar uma ou várias alergias na lista abaixo.
                </span>
              </span>
            </button>

            {form.hasAllergy && (
              <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent-800">
                    Alergias declaradas
                  </p>
                  <span className="text-[11px] font-semibold text-accent-800">
                    {form.allergies.length} registro(s)
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {form.allergies.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-2 focus-within:border-primary-400">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-accent-700">
                          <i className="ri-health-book-line text-sm"></i>
                        </span>
                        <input
                          value={item}
                          onChange={(e) => updateAllergy(index, e.target.value)}
                          placeholder="Ex.: Dipirona, poeira, látex..."
                          className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAllergy(index)}
                        disabled={form.allergies.length === 1}
                        aria-label="Remover alergia"
                        title="Remover alergia"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-600 transition-colors hover:bg-background-100 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <i className="ri-delete-bin-line text-base"></i>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addAllergy}
                  className="mt-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 bg-background-50 px-3 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100"
                >
                  <i className="ri-add-line"></i>
                  Adicionar alergia
                </button>
              </div>
            )}
          </Field>

          <Field
            label="Gestor / Líder responsável"
            className="sm:col-span-2"
            hint={
              canAllocate
                ? "Responsável por acompanhar o sentimento diário deste colaborador (vínculo individual)."
                : "A alocação de líderes está restrita pela parametrização de perfis nas Configurações."
            }
          >
            <div className="relative">
              <select
                className={selectClass}
                value={form.managerId}
                disabled={!canAllocate}
                onChange={(e) => set("managerId", e.target.value)}
              >
                <option value="">Sem gestor designado</option>
                {team
                  .filter((c) => c.id !== initial?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.role}
                    </option>
                  ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}