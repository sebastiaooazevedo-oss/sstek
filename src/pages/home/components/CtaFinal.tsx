import { Link } from "react-router-dom";

export default function CtaFinal() {
  return (
    <section className="relative w-full overflow-hidden">
      <img
        src="/images/8a0477218e.jpg"
        alt="Fundo decorativo SSTEK"
        title="SSTEK · Gestão de Segurança do Trabalho"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-foreground-950/80"></div>

      <div className="relative flex w-full flex-col items-center px-5 py-20 text-center md:px-10 md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-background-50/20 bg-background-50/10 px-4 py-1.5 text-xs font-medium text-background-100">
          <i className="ri-shield-check-line text-accent-400"></i>
          Comece hoje, sem instalar nada
        </span>
        <h2 className="mt-6 max-w-3xl font-heading text-2xl font-extrabold leading-tight tracking-tight text-background-50 md:text-4xl">
          Coloque a segurança do trabalho da sua empresa no piloto automático
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-background-200 md:text-base">
          Teste o SSTEK por 14 dias com os dados da sua operação. Sem contrato e sem compromisso.
        </p>
        <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Link
            to="/login"
            className="w-full whitespace-nowrap rounded-md bg-primary-500 px-7 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 sm:w-auto"
          >
            Criar minha conta
          </Link>
          <Link
            to="/login"
            className="w-full whitespace-nowrap rounded-md border border-background-50/30 bg-background-50/5 px-7 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-background-50/15 sm:w-auto"
          >
            Acessar o sistema
          </Link>
        </div>
      </div>
    </section>
  );
}