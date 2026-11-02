import PlatformScreen from "@/pages/app/modules/plataforma/components/PlatformScreen";
import RolePermissionsPanel from "@/pages/app/modules/plataforma/components/RolePermissionsPanel";

export default function PerfisPage() {
  return (
    <PlatformScreen
      screen="perfis"
      title="Perfis & permissões"
      subtitle="Matriz de capacidades por perfil da plataforma. O servidor valida cada operação, não apenas a interface."
    >
      <RolePermissionsPanel />
    </PlatformScreen>
  );
}