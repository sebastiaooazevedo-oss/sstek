import { Link } from "react-router-dom";

const heroStats = [
  { value: "+12.400", label: "Colaboradores monitorados" },
  { value: "+430", label: "Empresas ativas" },
  { value: "98%", label: "Documentos em dia" },
];

export default function Hero() {
  return (
    <section className="relative min-h-[680px] w-full overflow-hidden md:h-[760px]">
      <img
        src="/images/3706136deb.jpg"
        alt="Técnico de telecom em trabalho em altura com cinto de segurança e capacete"
        title="SSTEK · Gestão de Segurança do Trabalho para telecom e postos de combustível"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground-950/80 via-foreground-950/65 to-foreground-950/85"></div>

      <div className="relative flex h-full w-full flex-col items-center justify-center px-5 pb-16 pt-28 text-center md:px-10">
        <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-background-50/20 bg-background-50/10 px-4 py-1.5 text-xs font-medium text-background-100 backdrop-blur md:text-sm">
          <i className="ri-shield-check-line text-accent-400"></i>
          Plataforma SaaS multiempresa com subdomínio exclusivo
        </span>

        <h1
          className="animate-fade-up mt-6 max-w-4xl font-heading text-3xl font-extrabold leading-tight tracking-tight text-background-50 md:text-6xl"
          style={{ animationDelay: "0.1s" }}
        >
          Toda a segurança do trabalho da sua empresa,{" "}
          <span className="text-accent-400">sob controle</span>
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-2xl text-sm leading-relaxed text-background-200 md:text-lg"
          style={{ animationDelay: "0.2s" }}
        >
          O SSTEK centraliza documentos legais, Ficha de EPI, treinamentos, avaliações psicossociais e
          fiscalização por QR-Code — do técnico de telecom em altura ao time de pista do posto. Menos
          planilhas, menos multas, mais conformidade.
        </p>

        <div
          className="animate-fade-up mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
          style={{ animationDelay: "0.3s" }}
        >
          <Link
            to="/login"
            className="w-full whitespace-nowrap rounded-md bg-primary-500 px-7 py-3.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 sm:w-auto"
          >
            Começar agora
          </Link>
          <a
            href="#recursos"
            className="w-full whitespace-nowrap rounded-md border border-background-50/30 bg-background-50/5 px-7 py-3.5 text-sm font-semibold text-background-50 backdrop-blur transition-colors hover:bg-background-50/15 sm:w-auto"
          >
            Conhecer os recursos
          </a>
        </div>

        <div
          className="animate-fade-up mt-14 grid w-full max-w-3xl grid-cols-1 gap-6 border-t border-background-50/15 pt-8 sm:grid-cols-3"
          style={{ animationDelay: "0.4s" }}
        >
          {heroStats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center">
              <span className="font-heading text-2xl font-extrabold text-background-50 md:text-3xl">
                {stat.value}
              </span>
              <span className="mt-1 text-xs text-background-300 md:text-sm">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}