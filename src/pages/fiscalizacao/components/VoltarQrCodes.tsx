import { useLocation, useNavigate } from "react-router-dom";

/**
 * Volta para a tela de QR-Codes.
 *
 * Se a pessoa chegou aqui navegando pelo sistema (ex.: abriu a ficha pela tela
 * de QR-Codes), volta exatamente para onde estava. Se a página foi aberta
 * direto (nova aba, leitura do QR no celular), leva para a tela de QR-Codes do
 * sistema — que pede login para quem não tem acesso.
 */
export default function VoltarQrCodes({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const veioDoSistema = location.key !== "default";

  return (
    <button
      type="button"
      onClick={() => (veioDoSistema ? navigate(-1) : navigate("/app/qrcodes"))}
      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${className}`}
    >
      <i className="ri-arrow-left-line"></i>
      Voltar para QR-Codes
    </button>
  );
}
