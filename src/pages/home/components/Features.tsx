const features = [
  {
    icon: "ri-file-shield-2-line",
    title: "Documentos sem burocracia",
    text: "Documentos da empresa e do colaborador organizados por tipo, com validade, vencimento e download em um clique.",
  },
  {
    icon: "ri-shirt-line",
    title: "Ficha de EPI com aceite",
    text: "Registro por CA, data e hora automáticas na finalização e assinatura digital do colaborador para validade legal.",
  },
  {
    icon: "ri-qr-code-line",
    title: "QR-Code de fiscalização",
    text: "Cada colaborador tem um QR-Code com resumo, cursos e ficha de EPI — com log de cada escaneamento realizado.",
  },
  {
    icon: "ri-alarm-warning-line",
    title: "Alertas de vencimento",
    text: "Nunca mais perca um exame ou treinamento vencido. O sistema avisa antes de qualquer auditoria chegar.",
  },
  {
    icon: "ri-survey-line",
    title: "Pesquisa de clima diário",
    text: "Termômetro de clima respondido no primeiro acesso do dia, com histórico e evolução por equipe.",
  },
  {
    icon: "ri-mental-health-line",
    title: "Avaliação psicossocial",
    text: "40 perguntas dentro dos conformes da legislação, totalmente anônima e com dashboards por função e dimensão.",
  },
];

export default function Features() {
  return (
    <section id="recursos" className="bg-background-50 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
            Recursos
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
            Um sistema para cada obrigação da sua segurança do trabalho
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground-600 md:text-base">
            Do cadastro do colaborador à leitura do QR-Code na fiscalização, o SSTEK cobre o ciclo completo
            da conformidade em SST.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="group rounded-lg border border-background-200 bg-background-50 p-6 transition-colors hover:border-primary-300 hover:bg-primary-50/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700 transition-colors group-hover:bg-primary-500 group-hover:text-background-50">
                <i className={`${feature.icon} text-2xl`}></i>
              </div>
              <h3 className="mt-5 font-heading text-base font-bold text-foreground-950 md:text-lg">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground-600">{feature.text}</p>
              {index === 0 && (
                <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-900">
                  <i className="ri-flashlight-line"></i>
                  Mais usado
                </span>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}