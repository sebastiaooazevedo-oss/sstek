import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { currentAddress } from "@/core/tenantAddress";
import { tenantUrl } from "@/core/domain";
import { useAuth } from "@/pages/app/auth/authProvider";
import AppLoadingScreen from "@/pages/app/components/AppLoadingScreen";
import BrandLogo from "@/components/base/BrandLogo";

/**
 * Amarra o endereço à empresa.
 *
 * Em `alfa.sstek.com.br` só entra quem pertence à Alfa. Uma pessoa de outra
 * empresa que abrir esse endereço vê o aviso e o link do endereço certo; nenhum
 * dado é exibido. No domínio da plataforma (`sstek.com.br`), quem é de uma
 * empresa é levado ao endereço dela.
 *
 * O isolamento dos DADOS continua garantido no banco (RLS por empresa do
 * usuário); este portão evita confusão de marca/endereço e golpes do tipo
 * "link parecido".
 */
type State =
  | { status: "checking" }
  | { status: "ok" }
  | { status: "wrong-company"; addressCompany: string | null }
  | { status: "use-own-address" }
  | { status: "unknown-address" };

export default function AddressGate({ sessionSubdomain, children }: { sessionSubdomain: string; children: ReactNode }) {
  const { signOut } = useAuth();
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    let active = true;
    const address = currentAddress();
    const mine = (sessionSubdomain || "").toLowerCase();

    if (address.kind === "dev") {
      setState({ status: "ok" });
      return;
    }
    if (address.kind === "root") {
      // Empresa usando o endereço da plataforma: manda para o endereço próprio.
      setState(mine ? { status: "use-own-address" } : { status: "ok" });
      return;
    }
    if (address.subdomain) {
      setState(address.subdomain === mine ? { status: "ok" } : { status: "wrong-company", addressCompany: null });
      return;
    }
    // Domínio próprio: só o banco sabe a que empresa ele pertence.
    supabase
      .rpc("resolve_tenant_address", { p_domain: address.domain })
      .then(({ data, error }) => {
        if (!active) return;
        const row = (Array.isArray(data) ? data[0] : data) as { subdomain?: string; name?: string } | null;
        if (error || !row?.subdomain) {
          setState({ status: "unknown-address" });
          return;
        }
        setState(
          row.subdomain.toLowerCase() === mine ? { status: "ok" } : { status: "wrong-company", addressCompany: row.name ?? null }
        );
      });
    return () => {
      active = false;
    };
  }, [sessionSubdomain]);

  if (state.status === "checking") return <AppLoadingScreen />;
  if (state.status === "ok") return <>{children}</>;

  const ownUrl = sessionSubdomain ? `${tenantUrl(sessionSubdomain)}/login` : null;
  const content = {
    "wrong-company": {
      icon: "ri-error-warning-line",
      title: "Este endereço é de outra empresa",
      text: `Você entrou com uma conta que não pertence ${state.status === "wrong-company" && state.addressCompany ? `à ${state.addressCompany}` : "a este endereço"}. Por segurança, nenhum dado é exibido aqui.`,
    },
    "use-own-address": {
      icon: "ri-building-2-line",
      title: "Sua empresa tem um endereço próprio",
      text: "Acesse o sistema pelo endereço da sua empresa. Lá você entra com o mesmo e-mail e senha.",
    },
    "unknown-address": {
      icon: "ri-question-line",
      title: "Endereço não reconhecido",
      text: "Este endereço não está ligado a nenhuma empresa ativa. Confira o link ou acesse pelo endereço da sua empresa.",
    },
  }[state.status];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-background-200 bg-background-50 p-7">
        <BrandLogo />
        <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className={`${content.icon} text-xl`}></i>
        </span>
        <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight text-foreground-950">{content.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-600">{content.text}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {ownUrl && (
            <a
              href={ownUrl}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-primary-50 transition-colors hover:bg-primary-700"
            >
              <i className="ri-arrow-right-line"></i>
              Ir para {ownUrl.replace(/^https:\/\//, "").replace(/\/login$/, "")}
            </a>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-2 rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-logout-box-r-line"></i>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
