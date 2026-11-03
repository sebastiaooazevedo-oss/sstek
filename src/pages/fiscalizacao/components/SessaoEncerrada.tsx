import { useNavigate } from "react-router-dom";
import { CONSULTA_SESSAO_MINUTOS } from "@shared/consulta";
import { useAuth } from "@/pages/app/auth/authProvider";
import VoltarQrCodes from "@/pages/fiscalizacao/components/VoltarQrCodes";

/**
 * Página exibida depois que o consultante clica em "Encerrar acesso".
 *
 * Confirma que a sessão foi revogada (pelo consultante ou por tempo esgotado)
 * e mostra o protocolo que fica registrado para auditoria.
 *
 * - Visitante sem login (QR lido em qualquer aparelho): "Sair" leva ao site.
 * - Usuário logado no sistema: volta para a tela de QR-Codes.
 * Nos dois casos dá para fazer uma nova consulta (nova identificação e aceite).
 */
interface SessaoEncerradaProps {
  protocolo: string;
  encerradaEm: Date;
  empresaNome?: string;
  /** Ficha de demonstração (`/fiscalizacao/modelo`): sem registro real. */
  ilustrativo?: boolean;
  /** `expirada` quando o tempo da sessão acabou sem o consultante encerrar. */
  motivo?: "manual" | "expirada";
  onNovaConsulta: () => void;
}

function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SessaoEncerrada({
  protocolo,
  encerradaEm,
  empresaNome,
  ilustrativo = false,
  motivo = "manual",
  onNovaConsulta,
}: SessaoEncerradaProps) {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const logado = Boolean(userId);
  const expirada = motivo === "expirada";
  const sair = () => navigate("/", { replace: true });

  return (
    <div className="flex min-h-screen flex-col bg-background-100">
      <header className="border-b border-background-200 bg-background-50">
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-4 px-4 py-3.5 md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-500 text-background-50">
              <i className="ri-shield-check-line text-base"></i>
            </span>
            <div className="leading-tight">
              <p className="font-heading text-sm font-extrabold tracking-tight text-foreground-950">SSTEK</p>
              <p className="text-[10.5px] text-foreground-500">Verificação de SST{empresaNome ? ` · ${empresaNome}` : ""}</p>
            </div>
          </div>
          {logado ? (
            <VoltarQrCodes />
          ) : (
            <button
              type="button"
              onClick={sair}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-logout-box-r-line"></i>
              Sair
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-1 items-start justify-center px-4 py-10 md:px-6 md:py-16">
        <section
          aria-labelledby="sessao-encerrada-titulo"
          className="w-full max-w-xl rounded-xl border border-background-200 bg-background-50 p-6 text-center shadow-sm md:p-8"
        >
          <span
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${expirada ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"}`}
          >
            <i className={`${expirada ? "ri-timer-line" : "ri-lock-2-line"} text-2xl`}></i>
          </span>
          <h1 id="sessao-encerrada-titulo" className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">
            {expirada ? "Tempo de consulta encerrado" : "Sessão encerrada"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-foreground-600">
            {expirada
              ? `A ficha fica disponível por ${CONSULTA_SESSAO_MINUTOS} minutos e o acesso foi encerrado automaticamente.`
              : "O acesso a esta ficha foi encerrado e os dados não estão mais visíveis nesta tela."}
            {ilustrativo
              ? " Esta era uma ficha de demonstração, sem registro real."
              : " O registro da consulta foi mantido para auditoria."}{" "}
            Para ver a ficha novamente, é preciso fazer uma nova solicitação.
          </p>

          <dl className="mx-auto mt-5 grid max-w-md grid-cols-1 gap-2 text-left sm:grid-cols-2">
            <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
              <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">Protocolo</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold text-foreground-900">{protocolo || "—"}</dd>
            </div>
            <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
              <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">Encerrada em</dt>
              <dd className="mt-0.5 text-sm font-bold text-foreground-900">{formatDateTime(encerradaEm)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {logado ? (
              <>
                <button
                  type="button"
                  onClick={onNovaConsulta}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                >
                  <i className="ri-search-line"></i>
                  Nova consulta
                </button>
                <VoltarQrCodes className="px-4 py-2.5 text-sm" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={sair}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                >
                  <i className="ri-logout-box-r-line"></i>
                  Sair
                </button>
                <button
                  type="button"
                  onClick={onNovaConsulta}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-search-line"></i>
                  Nova consulta
                </button>
              </>
            )}
          </div>

          <p className="mt-6 flex items-start justify-center gap-1.5 text-[11px] leading-relaxed text-foreground-500">
            <i className="ri-information-line mt-0.5"></i>
            Em dispositivo compartilhado, feche esta aba ao terminar.
          </p>
        </section>
      </main>
    </div>
  );
}
