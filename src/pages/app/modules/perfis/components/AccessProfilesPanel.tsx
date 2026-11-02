import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/pages/app/auth/authProvider";
import { invalidateEffectiveAccess } from "@/pages/app/permissions/permissionStore";
import {
  countGranted,
  permissionResources,
} from "@/pages/app/permissions/permissionCatalog";
import {
  listAccessCandidates,
  listCompanyAccessMembers,
  listCompanyAccessProfiles,
  type AccessCandidate,
  type CompanyAccessMember,
  type CompanyAccessProfile,
} from "@/pages/app/permissions/accessProfileStore";
import ProfileEditor from "@/pages/app/modules/perfis/components/ProfileEditor";
import NewProfileModal from "@/pages/app/modules/perfis/components/NewProfileModal";
import ExampleProfilesPanel from "@/pages/app/modules/perfis/components/ExampleProfilesPanel";
import ProfileMembersPanel from "@/pages/app/modules/perfis/components/ProfileMembersPanel";

const totalActions = permissionResources.reduce((total, resource) => total + resource.actions.length, 0);

export default function AccessProfilesPanel() {
  const { session } = useAuth();
  const companyId = session?.companyId ?? "";

  const [profiles, setProfiles] = useState<CompanyAccessProfile[]>([]);
  const [members, setMembers] = useState<CompanyAccessMember[]>([]);
  const [candidates, setCandidates] = useState<AccessCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setProfiles([]);
      setMembers([]);
      setCandidates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profileRows, memberRows, candidateRows] = await Promise.all([
        listCompanyAccessProfiles(companyId),
        listCompanyAccessMembers(companyId),
        listAccessCandidates(companyId),
      ]);
      setProfiles(profileRows);
      setMembers(memberRows);
      setCandidates(candidateRows);
      setSelectedId((current) => {
        if (current && profileRows.some((profile) => profile.id === current)) return current;
        const locked = profileRows.find((profile) => profile.is_locked);
        return locked?.id ?? profileRows[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os perfis da empresa.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const userCountByProfile = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((member) => {
      map.set(member.access_profile_id, (map.get(member.access_profile_id) ?? 0) + 1);
    });
    return map;
  }, [members]);

  const selected = profiles.find((profile) => profile.id === selectedId) ?? null;

  const handleSaved = (text: string) => {
    setMessage(text);
    setError(null);
    invalidateEffectiveAccess();
    void load();
  };

  const handleDeleted = (text: string) => {
    setSelectedId(null);
    setMessage(text);
    setError(null);
    invalidateEffectiveAccess();
    void load();
  };

  const handleMemberChanged = (text: string) => {
    setMessage(text);
    setError(null);
    void load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="flex items-center gap-2 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg"></i>
          Carregando perfis da empresa…
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs leading-relaxed text-foreground-600">
            {profiles.length} {profiles.length === 1 ? "perfil criado" : "perfis criados"} nesta empresa ·{" "}
            {candidates.length} {candidates.length === 1 ? "usuário de acesso" : "usuários de acesso"} ·{" "}
            {totalActions} permissões por perfil
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-secondary-800">
            <i className="ri-lock-2-line"></i>
            Exclusivo desta empresa — não influencia outras empresas ou subdomínios
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-background-50 shadow-sm shadow-primary-600/25 transition-colors hover:bg-primary-700"
        >
          <i className="ri-add-line"></i>
          Novo perfil
        </button>
      </div>

      {error && (
        <div className="m-5 flex flex-col gap-3 rounded-md border border-accent-300 bg-accent-50 px-4 py-3 text-xs text-accent-900">
          <span className="flex items-start gap-2">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-400 bg-background-50 px-3 py-1.5 text-xs font-semibold text-accent-900 hover:bg-background-100"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        </div>
      )}

      {message && (
        <div className="mx-5 mt-5 flex items-start gap-2 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-xs leading-relaxed text-primary-900">
          <i className="ri-checkbox-circle-line mt-0.5"></i>
          <span>{message}</span>
        </div>
      )}

      <ExampleProfilesPanel
        companyId={companyId}
        profiles={profiles}
        onCreated={(profile) => {
          setSelectedId(profile.id);
          setMessage(
            `Perfil de exemplo "${profile.name}" criado com as permissões da função. Revise, ajuste se quiser e aloque os usuários.`
          );
          setError(null);
          invalidateEffectiveAccess();
          void load();
        }}
        onError={(text) => {
          setError(text);
          setMessage(null);
        }}
      />

      {profiles.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-500">
            <i className="ri-shield-user-line text-xl"></i>
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground-900">Nenhum perfil nesta empresa ainda</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-foreground-500">
            Crie o primeiro perfil para liberar permissões por recurso e alocar os colaboradores.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[300px_1fr]">
          <div className="border-b border-background-200 lg:border-b-0 lg:border-r">
            <p className="px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-400">
              Perfis da empresa
            </p>
            <ul className="flex flex-col gap-1 px-2 pb-3">
              {profiles.map((profile) => {
                const active = profile.id === selectedId;
                const granted = countGranted(profile.permissions);
                const users = userCountByProfile.get(profile.id) ?? 0;
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(profile.id)}
                      aria-current={active}
                      className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-primary-600 text-background-50"
                          : "text-foreground-800 hover:bg-background-100"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                          active ? "bg-background-50/20 text-background-50" : "bg-background-100 text-foreground-600"
                        }`}
                      >
                        <i className={`${profile.icon} text-base`}></i>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{profile.name}</span>
                          {profile.is_locked && (
                            <i
                              className={`ri-lock-2-line text-xs ${active ? "text-background-50/80" : "text-accent-700"}`}
                            ></i>
                          )}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-[11px] ${
                            active ? "text-background-50/80" : "text-foreground-500"
                          }`}
                        >
                          {profile.is_locked ? "acesso integral" : `${granted} permissões`} · {users}{" "}
                          {users === 1 ? "usuário" : "usuários"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-w-0">
            {selected ? (
              <ProfileEditor
                key={selected.id}
                profile={selected}
                userCount={userCountByProfile.get(selected.id) ?? 0}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onError={(text) => {
                  setError(text);
                  setMessage(null);
                }}
              />
            ) : (
              <p className="px-5 py-10 text-center text-xs text-foreground-500">
                Selecione um perfil para ver e ajustar as permissões.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-background-200">
        <ProfileMembersPanel
          companyId={companyId}
          profiles={profiles}
          members={members}
          candidates={candidates}
          onChanged={handleMemberChanged}
          onError={(text) => {
            setError(text);
            setMessage(null);
          }}
        />
      </div>

      <NewProfileModal
        open={modalOpen}
        companyId={companyId}
        profiles={profiles}
        onClose={() => setModalOpen(false)}
        onCreated={(profile) => {
          setSelectedId(profile.id);
          setMessage(`Perfil "${profile.name}" criado. Libere as permissões e aloque os usuários.`);
          setError(null);
          void load();
        }}
      />
    </div>
  );
}