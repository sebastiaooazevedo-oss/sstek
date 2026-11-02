import { Link } from "react-router-dom";

/**
 * Botão de retorno para a tela central de Documentos.
 * Usado pelas seções que agora vivem dentro de Documentos (DDS, Ficha de EPI,
 * APR e Documentos assinados).
 */
export default function BackToDocuments({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/app/documentos"
      className={`group mb-2.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-xs font-semibold text-foreground-500 transition-colors hover:border-background-300 hover:bg-background-50 hover:text-primary-700 ${className}`}
    >
      <i className="ri-arrow-left-line text-base transition-transform group-hover:-translate-x-0.5"></i>
      Voltar para Documentos
    </Link>
  );
}