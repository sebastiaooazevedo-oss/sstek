import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/base/BrandLogo";

interface VoteLayoutProps {
  children: ReactNode;
  badge?: string;
}

/** Moldura pública da urna eletrônica (sem login), com a identidade SSTEK. */
export default function VoteLayout({ children, badge = "Urna eletrônica · CIPA" }: VoteLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background-100">
      <header className="border-b border-background-200 bg-background-50">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <Link to="/">
            <BrandLogo size="sm" />
          </Link>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-100 px-3 py-1.5 text-xs font-semibold text-primary-700">
            <i className="ri-shield-check-line"></i>
            {badge}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6 md:py-10">{children}</main>

      <footer className="border-t border-background-200 bg-background-50 px-4 py-5 md:px-6">
        <p className="mx-auto max-w-3xl text-center text-[11px] leading-relaxed text-foreground-400">
          SSTEK · Sistema de Segurança do Trabalho — votação da CIPA conforme a NR-5. O voto é secreto e pessoal.
        </p>
      </footer>
    </div>
  );
}