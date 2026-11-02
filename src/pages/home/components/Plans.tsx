import { Link } from "react-router-dom";
import { licensePlans } from "@/mocks/site";

export default function Plans() {
  return (
    <section id="planos" className="bg-background-100 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
            Planos e licenças
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
            Escolha a licença conforme a sua operação
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground-600 md:text-base">
            Cobrança recorrente mensal. Precisa de mais gente? Adicione usuários extras a qualquer licença.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {licensePlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-lg border p-7 ${
                plan.highlight
                  ? "border-primary-400 bg-background-50"
                  : "border-background-200 bg-background-50"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-accent-500 px-3 py-1 text-xs font-bold text-foreground-950">
                  Mais escolhido
                </span>
              )}

              <h3 className="font-heading text-lg font-extrabold text-foreground-950">{plan.name}</h3>
              <p className="mt-1 text-sm text-foreground-500">{plan.tagline}</p>

              <div className="mt-6 flex items-end gap-1">
                <span className="font-heading text-3xl font-extrabold text-foreground-950">{plan.price}</span>
                <span className="pb-1 text-sm text-foreground-500">{plan.period}</span>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-secondary-100 px-3 py-1.5 text-xs font-semibold text-secondary-900">
                <i className="ri-group-line"></i>
                {plan.limit}
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground-700">
                    <i className="ri-check-line mt-0.5 text-base text-primary-600"></i>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className={`mt-8 whitespace-nowrap rounded-md px-5 py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                    : "border border-background-300 text-foreground-800 hover:bg-background-100"
                }`}
              >
                {plan.id === "s3" ? "Falar com especialista" : "Começar agora"}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-lg border border-accent-300 bg-accent-50 px-6 py-5 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500 text-foreground-950">
              <i className="ri-user-add-line text-xl"></i>
            </div>
            <p className="text-sm text-foreground-800">
              <strong className="font-semibold">Usuário extra:</strong> R$ XX,00 por colaborador adicional em
              qualquer licença.
            </p>
          </div>
          <Link
            to="/login"
            className="whitespace-nowrap rounded-md bg-foreground-950 px-5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-foreground-800"
          >
            Simular meu plano
          </Link>
        </div>
      </div>
    </section>
  );
}