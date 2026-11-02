import { useEffect, useMemo, useState } from "react";
import {
  countGranted,
  permissionResources,
} from "@/pages/app/permissions/permissionCatalog";
import {
  updateCompanyAccessProfile,
  updateCompanyAccessProfilePermissions,
  deleteCompanyAccessProfile,
  type CompanyAccessProfile,
} from "@/pages/app/permissions/accessProfileStore";
import ProfileIconPicker from "@/pages/app/modules/perfis/components/ProfileIconPicker";

interface ProfileEditorProps {
  profile: CompanyAccessProfile;
  userCount: number;
  onSaved: (message: string) => void;
  onDeleted: (message: string) => void;
  onError: (message: string) => void;
}

export default function ProfileEditor({ profile, userCount, onSaved, onDeleted, onError }: ProfileEditorProps) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(profile.permissions);
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description);
  const [icon, setIcon] = useState(profile.icon);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    permissionResources.forEach((resource, index) => {
      initial[resource.id] = index === 0;
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setPermissions(profile.permissions);
    setName(profile.name);
    setDescription(profile.description);
    setIcon(profile.icon);
    setConfirmDelete(false);
  }, [profile]);

  const locked = profile.is_locked;
  const editable = !locked;
  const granted = countGranted(permissions);

  const dirty = useMemo(() => {
    if (name.trim() !== profile.name) return true;
    if (description.trim() !== profile.description) return true;
    if (icon !== profile.icon) return true;
    return Object.keys(permissions).some((key) => Boolean(permissions[key]) !== Boolean(profile.permissions[key]));
  }, [permissions, name, description, icon, profile]);

  const toggle = (key: string) => {
    if (!editable) return;
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setGroup = (resourceId: string, value: boolean) => {
    if (!editable) return;
    const resource = permissionResources.find((item) => item.id === resourceId);
    if (!resource) return;
    setPermissions((prev) => {
      const next = { ...prev };
      resource.actions.forEach((action) => {
        next[action.key] = value;
      });
      return next;
    });
  };

  const reset = () => {
    setPermissions(profile.permissions);
    setName(profile.name);
    setDescription(profile.description);
    setIcon(profile.icon);
  };

  const save = async () => {
    if (!editable) return;
    if (name.trim().length < 2) {
      onError("Dê um nome com pelo menos 2 caracteres ao perfil.");
      return;
    }
    setSaving(true);
    try {
      if (name.trim() === profile.name && description.trim() === profile.description && icon === profile.icon) {
        await updateCompanyAccessProfilePermissions(profile.id, permissions);
      } else {
        await updateCompanyAccessProfile(profile.id, {
          name,
          description,
          icon,
          permissions,
        });
      }
      onSaved(`Perfil "${name.trim()}" atualizado. As permissões valem para os usuários alocados nele.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteCompanyAccessProfile(profile.id);
      onDeleted(`Perfil "${profile.name}" excluído. Os usuários que estavam nele voltam ao padrão do sistema.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível excluir o perfil.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="border-b border-background-200 bg-background-50 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={`${icon} text-xl`}></i>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading text-base font-bold text-foreground-950">{profile.name}</h3>
                {profile.is_locked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-900">
                    <i className="ri-lock-2-line"></i>
                    protegido
                  </span>
                )}
                {!profile.is_locked && profile.is_system && (
                  <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
                    padrão do sistema
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-foreground-600">
                {granted} de {permissionResources.reduce((total, resource) => total + resource.actions.length, 0)} permissões
                liberadas · {userCount} {userCount === 1 ? "usuário alocado" : "usuários alocados"}
              </p>
            </div>
          </div>
          {editable && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={!dirty || saving}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className="ri-arrow-go-back-line"></i>
                Desfazer
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3.5 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className={saving ? "ri-loader-4-line animate-spin" : "ri-save-3-line"}></i>
                {saving ? "Salvando…" : "Salvar perfil"}
              </button>
            </div>
          )}
        </div>

        {editable ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground-700">Nome do perfil</span>
                <input
                  type="text"
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground-700">Descrição</span>
                <input
                  type="text"
                  value={description}
                  maxLength={160}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Para que serve este perfil dentro da empresa"
                  className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400"
                />
              </label>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground-700">
                Ícone do perfil
                <span className="ml-1.5 font-normal text-foreground-500">clique no desenho que representa a função</span>
              </span>
              <ProfileIconPicker value={icon} onChange={setIcon} />
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-accent-900">
            <i className="ri-shield-star-line mr-1.5"></i>
            Perfil protegido com acesso integral. Não é possível reduzir permissões nem excluir — assim a empresa nunca
            fica sem um administrador com acesso total.
          </p>
        )}
      </div>

      <div className="divide-y divide-background-100">
        {permissionResources.map((resource) => {
          const open = openGroups[resource.id] ?? false;
          const activeCount = resource.actions.filter((action) => permissions[action.key]).length;
          return (
            <div key={resource.id}>
              <div className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [resource.id]: !open }))}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background-100 text-foreground-700">
                    <i className={`${resource.icon} text-base`}></i>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground-900">{resource.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          activeCount === resource.actions.length
                            ? "bg-primary-100 text-primary-700"
                            : activeCount === 0
                              ? "bg-background-200 text-foreground-500"
                              : "bg-accent-100 text-accent-900"
                        }`}
                      >
                        {activeCount}/{resource.actions.length}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-foreground-500">
                      {resource.description}
                    </span>
                  </span>
                  <i
                    className={`${open ? "ri-subtract-line" : "ri-add-line"} shrink-0 text-base text-foreground-400`}
                  ></i>
                </button>
                {editable && (
                  <div className="hidden shrink-0 items-center gap-1 sm:flex">
                    <button
                      type="button"
                      onClick={() => setGroup(resource.id, true)}
                      className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold text-primary-700 transition-colors hover:bg-primary-50"
                    >
                      Liberar tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroup(resource.id, false)}
                      className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold text-foreground-500 transition-colors hover:bg-background-100"
                    >
                      Bloquear tudo
                    </button>
                  </div>
                )}
              </div>

              {open && (
                <div className="bg-background-100/60 px-5 pb-3">
                  {editable && (
                    <div className="flex items-center justify-end gap-1 pb-1 sm:hidden">
                      <button
                        type="button"
                        onClick={() => setGroup(resource.id, true)}
                        className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold text-primary-700"
                      >
                        Liberar tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroup(resource.id, false)}
                        className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold text-foreground-500"
                      >
                        Bloquear tudo
                      </button>
                    </div>
                  )}
                  <ul className="flex flex-col gap-1.5">
                    {resource.actions.map((action) => {
                      const active = Boolean(permissions[action.key]);
                      return (
                        <li
                          key={action.key}
                          className="flex items-start justify-between gap-4 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground-900">{action.label}</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-500">
                              {action.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            aria-label={action.label}
                            disabled={!editable}
                            onClick={() => toggle(action.key)}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                              editable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                            } ${active ? "bg-primary-600" : "bg-background-300"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-background-50 transition-transform ${
                                active ? "translate-x-6" : "translate-x-1"
                              }`}
                            ></span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editable && !profile.is_system && (
        <div className="flex flex-col gap-3 border-t border-background-200 bg-background-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-foreground-500">
            Excluir o perfil não apaga os usuários: eles voltam ao padrão do sistema até receberem um novo perfil.
          </p>
          {confirmDelete ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="inline-flex h-8 cursor-pointer items-center whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 text-xs font-semibold text-foreground-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-600 px-3 text-xs font-semibold text-background-50 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className={deleting ? "ri-loader-4-line animate-spin" : "ri-delete-bin-6-line"}></i>
                Confirmar exclusão
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 px-3 text-xs font-semibold text-accent-900 transition-colors hover:bg-accent-50"
            >
              <i className="ri-delete-bin-6-line"></i>
              Excluir perfil
            </button>
          )}
        </div>
      )}
    </div>
  );
}