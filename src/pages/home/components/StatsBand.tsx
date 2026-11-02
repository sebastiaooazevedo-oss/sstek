const modules = [
  "ASO",
  "PGR",
  "PCMSO",
  "LTCAT",
  "Ficha de EPI",
  "Ordem de Serviço",
  "Certificados",
  "PPP",
  "AET / AE",
  "Mapa de Risco",
  "APR",
  "Atestados",
];

export default function StatsBand() {
  return (
    <section className="border-y border-background-200 bg-background-100">
      <div className="px-5 py-10 md:px-10 md:py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-foreground-500">
          Tudo o que a legislação exige, em um único sistema
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 md:gap-3">
          {modules.map((mod) => (
            <span
              key={mod}
              className="rounded-full border border-background-300/60 bg-background-50 px-3.5 py-1.5 text-xs font-medium text-foreground-700 md:text-sm"
            >
              {mod}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}