import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/pages/app/auth/authProvider";

interface AccessUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  is_primary_admin: boolean;
  auth_user_id: string | null;
}

function roleLabel(role: string): string {
  if (role === "admin") return "Administrador";
  if (role === "super") return "Superadministrador";
  return "Colaborador";
}

export default function AccessUsersPanel() {
  const { session } = useAuth();
  const companyId = session?.companyId ?? "";
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, status, is_primary_admin, auth_user_id")
        .eq("company_id", companyId)
        .order("is_primary_admin", { ascending: false })
        .order("name", { ascending: true });
      if (queryError) throw new Error(queryError.message);
      setUsers((data ?? []) as AccessUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários de acesso.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-6 text-xs text-foreground-500">
        <i className="ri-loader-4-line animate-spin text-base"></i>
        Carregando usuários de acesso…
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  const primary = users.find((user) => user.is_primary_admin) ?? null;
  const others = users.filter((user) => !user.is_primary_admin);

  return (
    <div className="flex flex-col">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground-900">Administrador principal</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-900">
            <i className="ri-lock-2-line"></i>
            somente leitura
          </span>
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Este é o usuário administrativo criado junto com a empresa para realizar os primeiros acessos e registros.
          Ele só pode ser alterado ou excluído pelo superadministrador da plataforma.
        </p>

        {primary ? (
          <div className="mt-3 rounded-lg border border-accent-200 bg-accent-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground-950">{primary.name}</p>
                <p className="truncate text-xs text-foreground-700">
                  {primary.email || "sem e-mail"}
                  {primary.phone ? ` · ${primary.phone}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-background-50 px-2 py-0.5 font-semibold text-foreground-700">
                    {roleLabel(primary.role)}
                  </span>
                  <span className="rounded-full bg-background-50 px-2 py-0.5 font-semibold text-foreground-700">
                    {primary.status === "active" ? "Ativo" : primary.status}
                  </span>
                  <span className="text-foreground-600">
                    {primary.auth_user_id ? "Conta ativada" : "Primeiro acesso pendente"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  title="Somente o superadministrador da plataforma pode alterar este usuário."
                  className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-100 px-3 py-2 text-xs font-semibold text-foreground-400 opacity-70"
                >
                  <i className="ri-edit-line"></i>
                  Editar
                </button>
                <button
                  type="button"
                  disabled
                  title="Somente o superadministrador da plataforma pode excluir este usuário."
                  className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-100 px-3 py-2 text-xs font-semibold text-foreground-400 opacity-70"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-background-100 px-3.5 py-3 text-xs text-foreground-600">
            Esta empresa ainda não possui administrador principal cadastrado. Solicite ao superadministrador da
            plataforma.
          </p>
        )}
      </div>

      <div className="border-t border-background-200 p-5">
        <h3 className="text-sm font-semibold text-foreground-900">Usuários com acesso ao sistema</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Contas vinculadas a esta empresa. A criação, a alteração e a exclusão de acessos são feitas pelo
          superadministrador da plataforma — aqui a consulta é apenas para acompanhamento.
        </p>

        {others.length === 0 ? (
          <p className="mt-3 rounded-md bg-background-100 px-3.5 py-3 text-xs text-foreground-600">
            Nenhum outro usuário de acesso vinculado.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {others.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground-900">{user.name}</p>
                  <p className="truncate text-xs text-foreground-500">{user.email || "sem e-mail"}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-secondary-100 px-2 py-0.5 font-semibold text-secondary-900">
                    {roleLabel(user.role)}
                  </span>
                  <span className="rounded-full bg-background-200 px-2 py-0.5 font-semibold text-foreground-600">
                    {user.status === "active" ? "Ativo" : user.status}
                  </span>
                  <span className="text-foreground-500">
                    {user.auth_user_id ? "Conta ativada" : "Primeiro acesso pendente"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-shield-check-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          O vínculo do administrador principal é protegido também no banco de dados: tentativas de alteração ou
          exclusão por outros perfis são recusadas, não apenas escondidas na tela.
        </span>
      </div>
    </div>
  );
}