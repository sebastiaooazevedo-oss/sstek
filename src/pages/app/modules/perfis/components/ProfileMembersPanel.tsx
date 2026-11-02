import { useMemo, useState } from "react";
import {
  setMemberAccessProfile,
  type AccessCandidate,
  type CompanyAccessMember,
  type CompanyAccessProfile,
} from "@/pages/app/permissions/accessProfileStore";

interface ProfileMembersPanelProps {
  companyId: string;
  profiles: CompanyAccessProfile[];
  members: CompanyAccessMember[];
  candidates: AccessCandidate[];
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}

export default function ProfileMembersPanel({
  companyId,
  profiles,
  members,
  candidates,
  onChanged,
  onError,
}: ProfileMembersPanelProps) {
  const [savingId, setSavingId] = useState<string | null>(null);

  const memberByProfileId = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => map.set(member.profile_id, member.access_profile_id));
    return map;
  }, [members]);

  const assign = async (profileRowId: string, accessProfileId: string) => {
    setSavingId(profileRowId);
    try {
      await setMemberAccessProfile(companyId, profileRowId, accessProfileId || null);
      const target = profiles.find((profile) => profile.id === accessProfileId);
      onChanged(
        accessProfileId
          ? `Usuário alocado no perfil "${target?.name ?? "selecionado"}".`
          : "Perfil removido. O usuário volta a seguir o padrão do sistema."
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Não foi possível alocar o usuário neste perfil.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="border-b border-background-200 px-5 py-4">
        <h3 className="font-heading text-base font-bold text-foreground-950">Colaboradores nos perfis</h3>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Escolha o perfil de cada usuário com acesso ao sistema. Sem perfil atribuído, o usuário continua seguindo a
          matriz padrão do sistema.
        </p>
      </div>

      {candidates.length === 0 ? (
        <p className="px-5 py-6 text-xs text-foreground-500">
          Nenhum usuário de acesso cadastrado nesta empresa ainda.
        </p>
      ) : (
        <ul className="divide-y divide-background-100">
          {candidates.map((candidate) => {
            const assignedId = memberByProfileId.get(candidate.id) ?? "";
            const saving = savingId === candidate.id;
            return (
              <li
                key={candidate.id}
                className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground-900">{candidate.name}</p>
                    {candidate.is_primary_admin && (
                      <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-900">
                        administrador principal
                      </span>
                    )}
                    <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                      {candidate.role === "admin" ? "Administrador" : "Colaborador"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-foreground-500">{candidate.email || "sem e-mail"}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {candidate.is_primary_admin ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-background-100 px-3 py-2 text-[11px] font-semibold text-foreground-500">
                      <i className="ri-lock-2-line"></i>
                      perfil protegido
                    </span>
                  ) : (
                    <>
                      <select
                        value={assignedId}
                        disabled={saving}
                        onChange={(event) => void assign(candidate.id, event.target.value)}
                        className="w-full min-w-[190px] max-w-[240px] appearance-none rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-800 outline-none transition-colors focus:border-primary-400 disabled:opacity-60"
                        aria-label={`Perfil de ${candidate.name}`}
                      >
                        <option value="">Padrão do sistema</option>
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                      <span className="flex h-6 w-6 items-center justify-center text-foreground-400">
                        {saving ? <i className="ri-loader-4-line animate-spin text-base"></i> : null}
                      </span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-shield-check-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          As permissões valem na próxima entrada do usuário e são aplicadas também no banco: o menu, a rota e o botão
          obedecem ao perfil. Nada aqui altera outras empresas.
        </span>
      </div>
    </div>
  );
}