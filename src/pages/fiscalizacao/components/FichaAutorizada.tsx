import { useEffect, useState } from "react";
import { CONSULTA_SESSAO_MINUTOS, tempoRestante } from "@shared/consulta";
import FichaSst from "@/pages/fiscalizacao/components/FichaSst";
import type { FichaSstData } from "@/pages/fiscalizacao/types";

/**
 * Ficha externa liberada por sessão autorizada.
 *
 * Só é renderizada depois que o servidor validou o token da sessão e devolveu
 * o resumo reduzido. O token fica em memória: sair da página, encerrar o
 * acesso ou esperar o tempo da sessão (5 minutos) invalida a consulta.
 */

interface FichaAutorizadaProps {
  dados: FichaSstData;
  protocolo: string;
  consultadoEm: string;
  expiraEm: string;
  empresaNome: string;
  onNovaConsulta: () => void;
  onEncerrar: () => void;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function FichaAutorizada({
  dados,
  protocolo,
  consultadoEm,
  expiraEm,
  empresaNome,
  onNovaConsulta,
  onEncerrar,
}: FichaAutorizadaProps) {
  // Relógio da contagem regressiva (o encerramento automático fica com quem abriu a ficha).
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const restante = tempoRestante(expiraEm, agora);
  const ultimoMinuto = new Date(expiraEm).getTime() - agora <= 60000;

  return (
    <div className="flex min-h-screen flex-col bg-background-100">
      <header className="border-b border-background-200 bg-background-50">
        <div className="mx-auto flex max-w-[1152px] flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-500 text-background-50">
              <i className="ri-shield-check-line text-base"></i>
            </span>
            <div className="leading-tight">
              <p className="font-heading text-sm font-extrabold tracking-tight text-foreground-950">SSTEK</p>
              <p className="text-[10.5px] text-foreground-500">
                {empresaNome ? `Verificação de SST · ${empresaNome}` : "Verificação de SST"}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-800">
            <i className="ri-shield-keyhole-line"></i>
            Sessão autorizada
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1152px] flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* Faixa da sessão auditada */}
        <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <i className="ri-checkbox-circle-line mt-0.5 text-base text-primary-700"></i>
              <div>
                <p className="text-[12.5px] font-bold text-primary-900">Consulta registrada e ficha liberada</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-primary-900/85">
                  Resumo reduzido, com dados pessoais mascarados. Esta liberação vale por {CONSULTA_SESSAO_MINUTOS}{" "}
                  minutos e se encerra sozinha ao fim do tempo. Você pode encerrar antes a qualquer momento.
                </p>
              </div>
            </div>
            <dl className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-primary-200 bg-background-50 px-3 py-1.5">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-foreground-400">Protocolo</dt>
                <dd className="font-mono text-[12px] font-bold text-foreground-900">{protocolo || "—"}</dd>
              </div>
              <div className="rounded-md border border-primary-200 bg-background-50 px-3 py-1.5">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-foreground-400">Registrada em</dt>
                <dd className="text-[12px] font-bold text-foreground-900">{formatDateTime(consultadoEm)}</dd>
              </div>
              <div
                className={`rounded-md border px-3 py-1.5 ${ultimoMinuto ? "border-accent-300 bg-accent-50" : "border-primary-200 bg-background-50"}`}
                role="timer"
                aria-live={ultimoMinuto ? "polite" : "off"}
                aria-label={`Tempo restante da consulta: ${restante}`}
              >
                <dt className="text-[9px] font-bold uppercase tracking-wide text-foreground-400">Encerra em</dt>
                <dd className={`font-mono text-[12px] font-bold tabular-nums ${ultimoMinuto ? "text-accent-900" : "text-foreground-900"}`}>
                  {restante} <span className="font-sans text-[10px] font-semibold text-foreground-500">({formatTime(expiraEm)})</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <FichaSst
          dados={dados}
          sessaoCodigo={protocolo || "SESSAO"}
          sessaoValidaAte={formatTime(expiraEm)}
          consultadoEm={formatDateTime(consultadoEm)}
          ilustrativo={false}
          modo="consulta"
          watermark
          onEncerrar={onEncerrar}
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[70ch] text-[10.5px] leading-relaxed text-foreground-400">
            Cada abertura desta ficha fica registrada no servidor, vinculada à consulta {protocolo || "—"}. O
            encerramento revoga a sessão imediatamente — o mesmo endereço não serve para reabrir a ficha.
          </p>
          <button
            type="button"
            onClick={onNovaConsulta}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className="ri-arrow-left-line"></i>
            Registrar nova consulta
          </button>
        </div>
      </main>

      <footer className="border-t border-background-200 bg-background-50 px-4 py-4 md:px-6">
        <p className="mx-auto max-w-[1152px] text-[10.5px] leading-relaxed text-foreground-400">
          Este QR Code permite consultar um resumo dos registros de segurança do trabalho do colaborador. Para
          informações detalhadas ou comprovação documental, entre em contato com a empresa e seu setor responsável
          por Segurança do Trabalho.
        </p>
      </footer>
    </div>
  );
}