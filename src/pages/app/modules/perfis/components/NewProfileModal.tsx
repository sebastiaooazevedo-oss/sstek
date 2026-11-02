import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  blankPermissions,
  permissionResources,
} from "@/pages/app/permissions/permissionCatalog";
import {
  createCompanyAccessProfile,
  type CompanyAccessProfile,
} from "@/pages/app/permissions/accessProfileStore";
import { defaultProfileIcon } from "@/pages/app/permissions/profileIconCatalog";
import ProfileIconPicker from "@/pages/app/modules/perfis/components/ProfileIconPicker";

interface NewProfileModalProps {
  open: boolean;
  companyId: string;
  profiles: CompanyAccessProfile[];
  onClose: () => void;
  onCreated: (profile: CompanyAccessProfile) => void;
}

export default function NewProfileModal({
  open,
  companyId,
  profiles,
  onClose,
  onCreated,
}: NewProfileModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(defaultProfileIcon);
  const [baseId, setBaseId] = useState("blank");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setIcon(defaultProfileIcon);
    setBaseId("blank");
    setError(null);
    setSaving(false);
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Dê um nome com pelo menos 2 caracteres ao perfil.");
      return;
    }
    const duplicated = profiles.some(
      (profile) => profile.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicated) {
      setError("Já existe um perfil com esse nome nesta empresa.");
      return;
    }

    const base = profiles.find((profile) => profile.id === baseId);
    const permissions = base
      ? { ...blankPermissions(), ...base.permissions }
      : blankPermissions();

    setSaving(true);
    setError(null);
    try {
      const created = await createCompanyAccessProfile(companyId, {
        name: trimmed,
        description,
        icon,
        permissions,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const totalActions = permissionResources.reduce((total, resource) => total + resource.actions.length, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo perfil de acesso"
      subtitle="O perfil vale apenas para esta empresa. Depois de criar, libere as permissões e aloque os usuários."
      icon="ri-shield-user-line"
      size="md"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={() => void submit()} disabled={saving} icon="ri-add-line">
            {saving ? "Criando…" : "Criar perfil"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-xs leading-relaxed text-accent-900">
            <i className="ri-error-warning-line mt-0.5"></i>
            {error}
          </p>
        )}

        <Field label="Nome do perfil" required>
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Técnico de Segurança, Encarregado, SESMT"
            className={inputClass}
          />
        </Field>

        <Field label="Descrição" hint="Aparece para o administrador na hora de alocar os usuários.">
          <input
            type="text"
            value={description}
            maxLength={160}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que este perfil pode fazer dentro da empresa"
            className={inputClass}
          />
        </Field>

        <Field label="Ícone" hint="Clique no desenho que representa a função. Capacete para obra, estetoscópio para SESMT, ferramentas para manutenção…">
          <ProfileIconPicker value={icon} onChange={setIcon} />
        </Field>

        <Field
          label="Começar com as permissões de"
          hint={`${totalActions} permissões disponíveis. Depois você ajusta uma a uma.`}
        >
          <select value={baseId} onChange={(event) => setBaseId(event.target.value)} className={selectClass}>
            <option value="blank">Perfil em branco (nenhuma permissão)</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </Field>

        <p className="flex items-start gap-2 rounded-md bg-background-100 px-3.5 py-2.5 text-[11px] leading-relaxed text-foreground-600">
          <i className="ri-information-line mt-0.5 text-sm text-secondary-700"></i>
          Perfis criados aqui nunca aparecem em outra empresa. O vínculo é exclusivo do seu subdomínio.
        </p>
      </div>
    </Modal>
  );
}