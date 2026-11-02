const qrBenefits = [
  {
    icon: "ri-file-user-line",
    title: "Resumo do cadastro",
    text: "Dados essenciais do colaborador disponíveis para a fiscalização na hora da leitura.",
  },
  {
    icon: "ri-award-line",
    title: "Cursos ativos e vencidos",
    text: "Situação de cada treinamento, destacando o que está válido e o que precisa de reciclagem.",
  },
  {
    icon: "ri-shirt-line",
    title: "Ficha de EPI com validade",
    text: "Todos os EPIs utilizados e a validade de cada item entregue ao colaborador.",
  },
  {
    icon: "ri-history-line",
    title: "Log de escaneamento",
    text: "Cada leitura fica registrada com data, hora e os dados do aparelho que escaneou.",
  },
];

export default function QrSection() {
  return (
    <section id="qrcode" className="bg-secondary-950 px-5 py-16 text-background-100 md:px-10 md:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-400">
            Fiscalização
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-background-50 md:text-4xl">
            Um QR-Code que fala por todo o histórico do colaborador
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-background-300 md:text-base">
            Cada colaborador cadastrado gera um QR-Code que resume o cadastro e o capacita a comprovar, na
            hora, cursos, exames e a entrega de EPIs — com rastreabilidade completa de cada consulta.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {qrBenefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-lg border border-background-50/10 bg-background-50/5 p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500 text-foreground-950">
                  <i className={`${benefit.icon} text-xl`}></i>
                </div>
                <h3 className="mt-4 font-heading text-sm font-bold text-background-50">{benefit.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-background-300">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative overflow-hidden rounded-lg border border-background-50/10">
            <img
              src="/images/2ae072ccee.jpg"
              alt="Escaneamento de QR-Code de fiscalização do colaborador"
              title="QR-Code de fiscalização SSTEK"
              className="h-[320px] w-full object-cover object-top md:h-[460px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary-950/70 to-transparent"></div>
            <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-background-50/15 bg-secondary-950/80 p-4 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-500 text-foreground-950">
                  <i className="ri-qr-scan-2-line text-lg"></i>
                </div>
                <div>
                  <p className="font-heading text-sm font-bold text-background-50">Escaneamentos hoje</p>
                  <p className="text-xs text-background-300">Registro de aparelho, data e hora</p>
                </div>
                <span className="ml-auto font-heading text-xl font-extrabold text-accent-400">128</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}