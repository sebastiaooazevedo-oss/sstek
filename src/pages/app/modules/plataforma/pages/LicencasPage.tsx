import PlatformScreen from "@/pages/app/modules/plataforma/components/PlatformScreen";
import LicensesPanel from "@/pages/app/modules/plataforma/components/LicensesPanel";

export default function LicencasPage() {
  return (
    <PlatformScreen
      screen="licencas"
      title="Licenças & planos"
      subtitle="Contrato de cada empresa: plano, assentos, mensalidade e próximo vencimento da cobrança recorrente."
    >
      <LicensesPanel />
    </PlatformScreen>
  );
}