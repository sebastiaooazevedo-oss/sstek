import { useAppSession } from "@/pages/app/context";
import { roleLabels } from "@/mocks/app";
import { collaboratorAreas, collaborators } from "@/mocks/collaborators";
import {
  ALL_ROLES,
  canAllocateLeaders,
  setAreaLeader,
  toggleAllocationRole,
  useLeadership,
} from "@/pages/app/modules/leadership/leadershipStore";

/**
 * Parametrização da hierarquia de liderança no perfil Administrador:
 *  - registra QUAIS perfis podem alocar líderes;
 *  - permite designar, por área/setor, quem é o líder responsável (por função),
 *    complementando o vínculo individual (por nome) feito no cadastro.
 */
export default function LeadershipForm() {
  const session = useAppSession();
  const leadership = useLeadership();
  const allowedHere = canAllocateLeaders(session.role);

  return (
    <div className="flex flex-col">
      {/* Quem pode alocar líderes */}
      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground-900">Quem pode alocar líderes</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Marque os perfis autorizados a designar líderes — tanto o vínculo individual (por nome) no cadastro
          quanto o líder responsável por uma área/setor. Impacta também quem enxerga os resultados da equipe.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => {
            const active = leadership.allocationRoles.includes(role);
            return (
              <button
                key={role}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleAllocationRole(role)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary-300 bg-primary-500 text-background-50"
                    : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className={active ? "ri-checkbox-circle-line" : "ri-checkbox-blank-circle-line"}></i>
                {roleLabels[role]}
              </button>
            );
          })}
        </div>

        {!allowedHere && (
          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-information-line mt-0.5 text-base"></i>
            <span>
              O seu perfil atual não está na lista de autorizados. Você pode ajustá-la acima, mas a alocação
              por área fica bloqueada enquanto o seu perfil não for marcado.
            </span>
          </div>
        )}
      </div>

      {/* Líder por área/setor */}
      <div className="border-t border-background-200 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground-900">Líder por área/setor</h3>
          <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
            vínculo por função
          </span>
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Ao designar um líder para uma área, ele passa a acompanhar os resultados de <strong>todos</strong> os
          colaboradores daquele setor — útil em grandes operações. Combina com o vínculo individual (por nome) do
          cadastro.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {collaboratorAreas.map((area) => {
            const areaCount = collaborators.filter((c) => c.area === area).length;
            const current = leadership.leaderByArea[area] || "";
            return (
              <div key={area} className="rounded-lg border border-background-200 bg-background-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground-900">{area}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-600">
                    <i className="ri-team-line"></i>
                    {areaCount}
                  </span>
                </div>
                <div className="relative mt-2.5">
                  <select
                    value={current}
                    disabled={!allowedHere}
                    onChange={(e) => setAreaLeader(area, e.target.value)}
                    className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none transition-colors focus:border-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Sem líder designado</option>
                    {collaborators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.role}
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-background-200 bg-background-100 px-4 py-3 text-xs text-foreground-600">
          <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
          <span>
            Nesta fase os vínculos ficam na sessão (modo demonstração). Quando a autenticação real entrar, esta
            mesma parametrização passa a valer direto do banco, sem mudar a tela.
          </span>
        </div>
      </div>
    </div>
  );
}