import { useState } from "react";
import { faqs } from "@/mocks/site";

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-background-100 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
            Dúvidas frequentes
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
            Perguntas que sempre chegam antes da decisão
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground-600">
            Não encontrou o que procurava? Nossa equipe de especialistas em SST responde rapidamente.
          </p>
          <a
            href="#planos"
            className="mt-6 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-3 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-chat-1-line"></i>
            Falar com um especialista
          </a>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className={`rounded-lg border bg-background-50 transition-colors ${
                  isOpen ? "border-primary-300" : "border-background-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-heading text-sm font-semibold text-foreground-950 md:text-base">
                    {faq.question}
                  </span>
                  <i
                    className={`${
                      isOpen ? "ri-subtract-line" : "ri-add-line"
                    } text-xl text-primary-600`}
                  ></i>
                </button>
                {isOpen && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-foreground-600">{faq.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}