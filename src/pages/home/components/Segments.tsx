const segments = [
  {
    id: "telecom",
    icon: "ri-signal-tower-line",
    eyebrow: "Telecomunicações",
    title: "Técnicos de campo em altura, com tudo documentado",
    text: "Equipes de instalação e manutenção de redes lidam com trabalho em altura, choque elétrico e espaço confinado. O SSTEK mantém ASO, NR-35, NR-10 e ordens de serviço prontos para qualquer fiscalização.",
    bullets: [
      "ASO e certificados de NR-35 válidos por técnico",
      "Ficha de EPI com aceite digital do colaborador",
      "QR-Code na credencial para conferência em campo",
    ],
    image:
      "/images/9773ca2abc.jpg",
    alt: "Técnico de telecomunicações com cinto de segurança trabalhando em torre de antenas",
    imageTitle: "Segurança do trabalho para técnicos de telecomunicações",
  },
  {
    id: "postos",
    icon: "ri-gas-station-line",
    eyebrow: "Postos de combustível",
    title: "Operação de pista com risco químico sob controle",
    text: "Frentistas e operadores convivem com inflamáveis, benzeno e jornada noturna. O sistema organiza PCMSO, PGR, treinamentos e exames com alerta automático antes de qualquer vencimento.",
    bullets: [
      "Controle de exames e treinamentos NR-20 por função",
      "Documentos da empresa centralizados e com validade",
      "Alertas de vencimento antes da auditoria chegar",
    ],
    image:
      "/images/3b3fbcdf47.jpg",
    alt: "Frentista de posto de combustível atendendo veículo na pista com colete refletivo",
    imageTitle: "Segurança do trabalho para postos de combustível",
  },
];

export default function Segments() {
  return (
    <section id="segmentos" className="bg-foreground-950 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-400">
              Segmentos atendidos
            </span>
            <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-background-50 md:text-4xl">
              Feito para quem trabalha em campo, na pista e em altura
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-background-300">
            Times de telecom e postos de combustível têm riscos específicos — e obrigações legais que não
            perdoam atraso.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-2">
          {segments.map((segment) => (
            <article
              key={segment.id}
              className="group overflow-hidden rounded-lg border border-background-50/10 bg-background-50/5 transition-colors hover:border-accent-500/40"
            >
              <div className="relative h-[240px] w-full md:h-[300px]">
                <img
                  src={segment.image}
                  alt={segment.alt}
                  title={segment.imageTitle}
                  className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground-950 via-foreground-950/25 to-transparent"></div>
                <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-background-50/90 px-3 py-1.5 text-xs font-semibold text-foreground-950 backdrop-blur">
                  <i className={`${segment.icon} text-sm text-primary-600`}></i>
                  {segment.eyebrow}
                </span>
              </div>

              <div className="p-6 md:p-7">
                <h3 className="font-heading text-base font-bold text-background-50 md:text-xl">
                  {segment.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-background-300">{segment.text}</p>

                <ul className="mt-6 flex flex-col gap-2.5">
                  {segment.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-foreground-950">
                        <i className="ri-check-line text-xs"></i>
                      </span>
                      <span className="text-sm leading-relaxed text-background-200">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}