import ModuleHeader from "@/pages/app/components/ModuleHeader";
import AccessProfilesPanel from "@/pages/app/modules/perfis/components/AccessProfilesPanel";

export default function PerfisAcessoPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ModuleHeader
        badgeIcon="ri-shield-user-line"
        badgeLabel="Gestão de acessos"
        title="Perfis & permissões"
        subtitle="Crie os perfis da sua empresa, defina o que cada um pode fazer (subir arquivo, visualizar, excluir, incluir colaboradores, criar CIPA, DDS, lista de presença e mais) e aloque os colaboradores em cada perfil."
      />

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-[11px] leading-relaxed text-secondary-900">
        <i className="ri-building-2-line mt-0.5 text-base"></i>
        <span>
          Estas permissões pertencem apenas à sua empresa. Alterar um perfil aqui não muda nada em outras empresas nem
          em outros subdomínios da plataforma. Todo recurso novo do sistema entra nesta mesma lista.
        </span>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-background-200 bg-background-50 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-32px_rgba(15,23,42,0.35)]">
        <AccessProfilesPanel />
      </section>
    </div>
  );
}