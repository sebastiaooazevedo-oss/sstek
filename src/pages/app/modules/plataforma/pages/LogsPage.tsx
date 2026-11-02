import PlatformScreen from "@/pages/app/modules/plataforma/components/PlatformScreen";
import SystemLogsPanel from "@/pages/app/modules/plataforma/components/SystemLogsPanel";

export default function LogsPage() {
  return (
    <PlatformScreen
      screen="logs"
      title="Logs do sistema por empresa"
      subtitle="Tudo que foi adicionado, alterado ou removido em cada tenant, por perfil de usuário — com o voto sigiloso registrado sem revelar a escolha."
    >
      <SystemLogsPanel />
    </PlatformScreen>
  );
}