import PlatformScreen from "@/pages/app/modules/plataforma/components/PlatformScreen";
import PaymentsPanel from "@/pages/app/modules/plataforma/components/PaymentsPanel";

export default function PagamentosPage() {
  return (
    <PlatformScreen
      screen="pagamentos"
      title="Pagamentos"
      subtitle="Cobranças recorrentes por competência, com conciliação manual e trilha de auditoria em cada alteração."
    >
      <PaymentsPanel />
    </PlatformScreen>
  );
}