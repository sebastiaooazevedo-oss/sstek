import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import FichaSst from "@/pages/fiscalizacao/components/FichaSst";
import EntradaNeutra from "@/pages/fiscalizacao/components/EntradaNeutra";
import type { FichaSstData } from "@/pages/fiscalizacao/types";
import { fiscalizacaoModelo } from "@/mocks/fiscalizacaoModelo";

/**
 * Página externa aberta ao escanear o QR-Code (camada 2 do fluxo).
 *
 * Fluxo em duas etapas, obrigatoriamente:
 * 1. ENTRADA NEUTRA (`EntradaNeutra`) — nada de dado pessoal. O consultante se
 *    identifica e solicita acesso.
 * 2. FICHA RESUMIDA — só depois de uma sessão confirmada NO SERVIDOR. A
 *    consulta é registrada na Edge Function `fiscalizacao-consulta`, que abre
 *    uma sessão de 30 minutos e devolve o resumo reduzido validado.
 *
 * O layout aprovado também é exibido em `/fiscalizacao/modelo` com dados
 * ilustrativos, sempre marcado como demonstração.
 */

/** Código curto e rastreável da sessão ilustrativa (não é token de acesso). */
const SESSAO_MODELO = "FBK2";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function FiscalizacaoPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isModelo = id === "modelo";
  const empresa = (searchParams.get("empresa") ?? "").trim().toLowerCase();

  const [acessoEncerrado, setAcessoEncerrado] = useState(false);
  const [consultaEm] = useState(() => new Date());

  const sessaoValidaAte = useMemo(() => formatTime(new Date(consultaEm.getTime() + 30 * 60 * 1000)), [consultaEm]);
  const consultadoEm = useMemo(() => formatDateTime(consultaEm), [consultaEm]);

  if (!isModelo) {
    // Código real: nenhuma leitura de dados acontece antes da autorização.
    return (
      <EntradaNeutra
        temCodigo={Boolean(id && id.trim())}
        empresa={empresa}
        codigo={(id ?? "").trim()}
      />
    );
  }

  if (acessoEncerrado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-100 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-lock-2-line text-3xl"></i>
        </span>
        <h1 className="font-heading text-2xl font-extrabold text-foreground-950">Acesso encerrado</h1>
        <p className="max-w-md text-sm text-foreground-600">
          A sessão de consulta foi encerrada. Para ver a ficha novamente, é preciso uma nova autorização de acesso.
        </p>
        <Link
          to="/"
          className="mt-2 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-home-4-line"></i>
          Ir para o site do SSTEK
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-100">
      <div className="mx-auto max-w-[1152px] px-4 py-6 md:px-6 md:py-8">
        <header className="rounded-xl border border-background-200 bg-background-50 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-layout-masonry-line text-xl"></i>
              </span>
              <div className="min-w-0">
                <h1 className="font-heading text-lg font-extrabold tracking-tight text-foreground-950 md:text-xl">
                  Modelo da ficha de verificação de SST
                </h1>
                <p className="text-[12px] text-foreground-500">
                  Demonstração visual do layout · nenhum dado de colaborador real
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-300 bg-accent-50 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-900">
                <i className="ri-flask-line text-sm"></i>
                Dados ilustrativos
              </span>
              <span className="text-[11px] text-foreground-500">Sessão simulada até {sessaoValidaAte}</span>
            </div>
          </div>
        </header>

        <div className="mt-4">
          <FichaSst
            dados={fiscalizacaoModelo as FichaSstData}
            sessaoCodigo={SESSAO_MODELO}
            sessaoValidaAte={sessaoValidaAte}
            consultadoEm={consultadoEm}
            ilustrativo
            onEncerrar={() => setAcessoEncerrado(true)}
          />
        </div>

        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-foreground-400">
          Este é apenas o layout aprovado, com dados ilustrativos. A ficha real é liberada na consulta
          pelo QR-Code, depois do registro da solicitação e da sessão autorizada de 30 minutos.
        </p>
      </div>
    </div>
  );
}