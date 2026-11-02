import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/base/Logo";

const navLinks = [
  { label: "Recursos", href: "#recursos" },
  { label: "Segmentos", href: "#segmentos" },
  { label: "Perfis", href: "#perfis" },
  { label: "QR-Code", href: "#qrcode" },
  { label: "Avaliações", href: "#avaliacoes" },
  { label: "Planos", href: "#planos" },
  { label: "Dúvidas", href: "#faq" },
];

export default function SiteNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-background-50/10 bg-foreground-950/92 shadow-[0_1px_0_0_rgba(0,0,0,0.15)] backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-5 md:h-20 md:px-10">
        <Link to="/" aria-label="Página inicial SSTEK" className="shrink-0">
          <Logo variant="light" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-background-200 transition-colors hover:text-accent-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold text-background-100 transition-colors hover:bg-background-50/10 hover:text-background-50"
          >
            Entrar
          </Link>
          <Link
            to="/login"
            className="whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            Testar grátis
          </Link>
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-background-50 transition-colors hover:bg-background-50/10 md:hidden"
        >
          <i className={`${open ? "ri-close-line" : "ri-menu-line"} text-2xl`}></i>
        </button>
      </div>

      {open && (
        <div className="border-t border-background-50/10 bg-foreground-950 px-5 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-background-200 hover:bg-background-50/10 hover:text-background-50"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              to="/login"
              className="rounded-md border border-background-50/25 px-4 py-2.5 text-center text-sm font-semibold text-background-100"
            >
              Entrar
            </Link>
            <Link
              to="/login"
              className="rounded-md bg-primary-500 px-4 py-2.5 text-center text-sm font-semibold text-background-50"
            >
              Testar grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}