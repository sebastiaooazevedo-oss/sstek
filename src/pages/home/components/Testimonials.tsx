import { testimonials } from "@/mocks/site";

export default function Testimonials() {
  return (
    <section className="bg-background-50 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-600">
            Quem usa, aprova
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
            Segurança do trabalho levada a sério por quem vive a rotina
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col rounded-lg border border-background-200 bg-background-100 p-6"
            >
              <div className="flex items-center gap-1 text-accent-500">
                {[0, 1, 2, 3, 4].map((star) => (
                  <i key={star} className="ri-star-fill text-sm"></i>
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground-700">
                “{item.text}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-background-200 pt-5">
                <div className="h-11 w-11 overflow-hidden rounded-full">
                  <img
                    src={item.avatar}
                    alt={`Foto de ${item.name}`}
                    title={`${item.name} · ${item.company}`}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div>
                  <p className="font-heading text-sm font-bold text-foreground-950">{item.name}</p>
                  <p className="text-xs text-foreground-500">
                    {item.role} · {item.company}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}