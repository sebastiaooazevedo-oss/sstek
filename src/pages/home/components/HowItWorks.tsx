import { useState } from "react";

const steps = [
  {
    number: "01",
    icon: "ri-add-circle-line",
    title: "Cadastre a empresa",
    text: "O Super Administrador cria a empresa, sobe a logomarca e define o subdomínio exclusivo do cliente.",
  },
  {
    number: "02",
    icon: "ri-upload-cloud-2-line",
    title: "Importe os colaboradores",
    text: "Suba a planilha .xlsx com as colunas do banco de dados e a base de colaboradores é criada de uma vez.",
  },
  {
    number: "03",
    icon: "ri-file-list-3-line",
    title: "Anexe documentos",
    text: "Documentos da empresa e do colaborador ficam vinculados, com validade e alertas automáticos de vencimento.",
  },
  {
    number: "04",
    icon: "ri-qr-scan-2-line",
    title: "Fiscalize e acompanhe",
    text: "Cada colaborador ganha QR-Code e a gestão acompanha tudo em dashboards estratégicos e dinâmicos.",
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <section className="bg-background-100 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-600">
              Como funciona
            </span>
            <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
              Do cadastro à fiscalização em 4 passos
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-foreground-600">
            Configuração rápida e autônoma. Em poucos minutos a sua operação está rodando no SSTEK.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <button
              key={step.number}
              type="button"
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              className={`flex flex-col items-start rounded-lg border p-6 text-left transition-all ${
                active === index
                  ? "border-primary-300 bg-background-50"
                  : "border-background-200 bg-background-50/60"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
                    active === index
                      ? "bg-secondary-500 text-background-50"
                      : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  <i className={`${step.icon} text-xl`}></i>
                </div>
                <span className="font-heading text-2xl font-extrabold text-background-300">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-5 font-heading text-base font-bold text-foreground-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-600">{step.text}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}