const evaluationBlocks = [
  {
    icon: "ri-mental-health-line",
    tag: "Anônimo",
    title: "Avaliação psicossocial",
    text: "40 perguntas dentro dos conformes da legislação, com resultados agregados por dimensão e por função.",
  },
  {
    icon: "ri-emotion-happy-line",
    tag: "Diário",
    title: "Pesquisa de clima",
    text: "Um termômetro respondido no primeiro acesso do dia, que só volta a ser cobrado no dia seguinte.",
  },
  {
    icon: "ri-file-edit-line",
    tag: "Customizável",
    title: "Avaliações personalizadas",
    text: "Crie novas avaliações e defina se são anônimas ou identificadas, e para todos, por função ou por perfil.",
  },
];

const bars = [
  { label: "Carga de trabalho", value: 72, tone: "bg-accent-500" },
  { label: "Suporte da liderança", value: 84, tone: "bg-primary-500" },
  { label: "Relações no time", value: 91, tone: "bg-primary-500" },
  { label: "Reconhecimento", value: 63, tone: "bg-accent-500" },
];

export default function Evaluations() {
  return (
    <section id="avaliacoes" className="bg-background-50 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
            Pessoas e clima
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
            Escute as pessoas e transforme isso em indicador
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground-600 md:text-base">
            Avaliações dentro dos conformes da legislação, com anonimato garantido para a gestão e dashboards
            dinâmicos que mostram onde agir primeiro.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {evaluationBlocks.map((block) => (
            <article key={block.title} className="rounded-lg border border-background-200 bg-background-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                  <i className={`${block.icon} text-xl`}></i>
                </div>
                <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-semibold text-secondary-900">
                  {block.tag}
                </span>
              </div>
              <h3 className="mt-5 font-heading text-base font-bold text-foreground-950 md:text-lg">
                {block.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground-600">{block.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 items-center gap-8 rounded-lg border border-background-200 bg-background-100 p-6 md:p-10 lg:grid-cols-2">
          <div>
            <h3 className="font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">
              Dashboards dinâmicos e estratégicos
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground-600">
              Resultados apresentados por dimensão, função e evolução no tempo. Escolha o público de cada
              avaliação — todos, por função ou por perfil — e compare os indicadores com clareza para tomar
              decisões com base em dados.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {["Anonimato garantido para a gestão", "Comparativo por função e por setor", "Evolução histórica e tendências"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-foreground-700">
                    <i className="ri-checkbox-circle-fill text-lg text-primary-500"></i>
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-background-200 bg-background-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
                  Índice psicossocial
                </p>
                <p className="mt-1 font-heading text-2xl font-extrabold text-foreground-950">78 / 100</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
                <i className="ri-arrow-up-line"></i>
                +6 pts
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {bars.map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-center justify-between text-xs text-foreground-600">
                    <span>{bar.label}</span>
                    <span className="font-semibold text-foreground-800">{bar.value}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-background-200">
                    <div className={`h-full rounded-full ${bar.tone}`} style={{ width: `${bar.value}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}