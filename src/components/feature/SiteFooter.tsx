import { Link } from "react-router-dom";
import Logo from "@/components/base/Logo";

const columns = [
  {
    title: "Produto",
    links: [
      { label: "Recursos", href: "#recursos" },
      { label: "Perfis de acesso", href: "#perfis" },
      { label: "Planos e licenças", href: "#planos" },
      { label: "Avaliações", href: "#avaliacoes" },
    ],
  },
  {
    title: "Soluções",
    links: [
      { label: "Gestão documental", href: "#recursos" },
      { label: "Ficha de EPI", href: "#recursos" },
      { label: "QR-Code fiscalização", href: "#qrcode" },
      { label: "Pesquisa de clima", href: "#avaliacoes" },
    ],
  },
  {
    title: "Suporte",
    links: [
      { label: "Central de ajuda", href: "#faq" },
      { label: "Perguntas frequentes", href: "#faq" },
      { label: "Falar com vendas", href: "#planos" },
      { label: "Status da plataforma", href: "#" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-primary-950 text-background-100">
      <div className="px-5 py-14 md:px-10 md:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo variant="light" size="lg" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-background-300">
              A plataforma completa para gestão de Segurança do Trabalho. Documentos, EPIs, treinamentos,
              avaliações e fiscalização por QR-Code em um só lugar, com subdomínio exclusivo para a sua empresa.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {["ri-linkedin-fill", "ri-instagram-line", "ri-youtube-fill", "ri-whatsapp-line"].map((icon) => (
                <a
                  key={icon}
                  href="#"
                  aria-label="Rede social SSTEK"
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-background-50/10 text-background-100 transition-colors hover:bg-accent-500 hover:text-foreground-950"
                >
                  <i className={`${icon} text-lg`}></i>
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-heading text-sm font-semibold text-background-50">{col.title}</h4>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-background-300 transition-colors hover:text-accent-400"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-background-50/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-background-400">
            © 2026 SSTEK Tecnologia LTDA · CNPJ 00.000.000/0001-00 · Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-xs text-background-400 transition-colors hover:text-background-100">
              Termos de uso
            </a>
            <a href="#" className="text-xs text-background-400 transition-colors hover:text-background-100">
              Privacidade
            </a>
            <Link to="/login" className="text-xs text-background-400 transition-colors hover:text-background-100">
              Acessar sistema
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}