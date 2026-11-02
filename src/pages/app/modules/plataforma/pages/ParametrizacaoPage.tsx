import PlatformScreen from "@/pages/app/modules/plataforma/components/PlatformScreen";
import ParametersPanel from "@/pages/app/modules/plataforma/components/ParametersPanel";
import ModulesPanel from "@/pages/app/modules/plataforma/components/ModulesPanel";

export default function ParametrizacaoPage() {
  return (
    <PlatformScreen
      screen="parametrizacao"
      title="Parametrização por perfil"
      subtitle="Defina o que cada perfil recebe por padrão: módulos habilitados e comportamentos obrigatórios da plataforma."
    >
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">
            Módulos contratados
          </h2>
          <p className="mt-1 text-xs text-foreground-600">
            Definem quais módulos ficam disponíveis para as empresas. Somente a plataforma pode liberar ou bloquear.
          </p>
          <div className="mt-3">
            <ModulesPanel />
          </div>
        </section>

        <section>
          <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">
            Padrões por perfil
          </h2>
          <p className="mt-1 text-xs text-foreground-600">
            Aplicados quando um novo usuário da empresa é vinculado a um perfil.
          </p>
          <div className="mt-3">
            <ParametersPanel />
          </div>
        </section>
      </div>
    </PlatformScreen>
  );
}