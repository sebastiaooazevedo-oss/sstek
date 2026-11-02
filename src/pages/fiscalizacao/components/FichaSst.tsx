import type { ReactNode } from "react";
import FichaWatermark from "@/pages/fiscalizacao/components/FichaWatermark";
import type {
  CursoSituacao,
  EpiSituacao,
  FichaSstData,
} from "@/pages/fiscalizacao/types";

interface FichaSstProps {
  dados: FichaSstData;
  /** Código curto e rastreável da sessão de consulta (não é token). */
  sessaoCodigo: string;
  /** Horário de expiração da sessão, exibido no topo. */
  sessaoValidaAte: string;
  /** Data/hora da consulta, exibida no rodapé auditado. */
  consultadoEm: string;
  /** `true` quando a ficha é apenas demonstração de layout. */
  ilustrativo: boolean;
  /**
   * `consulta` = sessão externa autorizada (tem botão de encerrar).
   * `previa` = prévia administrativa dentro do sistema: mesma estrutura e
   * mesmo mascaramento, porém sem sessão externa e sem ações do consultante.
   */
  modo?: "consulta" | "previa";
  /**
   * `true` (padrão) desenha a marca-d'água da consulta restrita. Telas internas
   * autenticadas desligam a marca porque nelas os dados completos são legítimos.
   */
  watermark?: boolean;
  onEncerrar?: () => void;
}

const cursoPill: Record<CursoSituacao, { label: string; className: string }> = {
  vigente: { label: "Registro vigente", className: "bg-primary-100 text-primary-800" },
  pendente: { label: "Atualização pendente", className: "bg-danger-100 text-danger-800" },
  conferir: { label: "Conferir", className: "bg-accent-100 text-accent-900" },
};

const epiPill: Record<EpiSituacao, { label: string; className: string }> = {
  ok: { label: "Sem pendência registrada", className: "bg-primary-100 text-primary-800" },
  revisar: { label: "Revisar substituição", className: "bg-danger-100 text-danger-800" },
  conferir: { label: "Conferir no local", className: "bg-accent-100 text-accent-900" },
};

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function DadoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-background-200 bg-background-100 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-foreground-400">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-bold text-foreground-900">{value || "***"}</p>
    </div>
  );
}

function ResumoCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: string;
  value: number;
  label: string;
  tone: "danger" | "accent" | "primary";
}) {
  const tones: Record<string, string> = {
    danger: "bg-danger-100 text-danger-700",
    accent: "bg-accent-100 text-accent-800",
    primary: "bg-primary-100 text-primary-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-md border border-background-200 bg-background-50 px-4 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}>
        <i className={`${icon} text-lg`}></i>
      </span>
      <div className="min-w-0">
        <p className="font-heading text-xl font-extrabold leading-none text-foreground-950">{value}</p>
        <p className="mt-1 text-[11.5px] font-medium leading-tight text-foreground-500">{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center text-primary-700">
        <i className={`${icon} text-base`}></i>
      </span>
      <h2 className="text-[13.5px] font-bold text-foreground-950">{children}</h2>
    </div>
  );
}

/**
 * Ficha externa de verificação de SST.
 *
 * Layout único para fiscalização em campo: verde e branco, cartões, tabelas e
 * etiquetas de situação. A ficha não oferece download, impressão de documentos
 * nem controles administrativos — reimpressão do adesivo e geração de QR-Code
 * continuam apenas no ambiente administrativo autorizado.
 */
export default function FichaSst({
  dados,
  sessaoCodigo,
  sessaoValidaAte,
  consultadoEm,
  ilustrativo,
  modo = "consulta",
  watermark = true,
  onEncerrar,
}: FichaSstProps) {
  const { empresa, colaborador, resumo, cursos, epis } = dados;
  const previa = modo === "previa";

  return (
    <article className="overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-sm">
      <div className="relative">
        {watermark && <FichaWatermark label={`CONSULTA RESTRITA · ${sessaoCodigo}`} />}

        <div className="relative">
          {/* Empresa */}
          <div className="flex flex-col gap-3 border-b border-background-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-building-4-line text-lg"></i>
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold text-foreground-950">{empresa.nome}</p>
                <p className="truncate text-[11.5px] text-foreground-500">{empresa.enderecoWeb}</p>
              </div>
            </div>
            {dados.conferenciaPresencial && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent-300 bg-accent-50 px-3 py-1.5 text-[11px] font-semibold text-accent-900">
                <i className="ri-time-line text-sm"></i>
                Conferência presencial necessária
              </span>
            )}
          </div>

          <div className="px-5 py-5">
            {/* Identidade + documentos reduzidos */}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="flex items-center gap-4 lg:w-[38%]">
                <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-md border border-background-200 bg-background-100">
                  <img
                    src={colaborador.foto || undefined}
                    alt={`Foto de ${colaborador.nome}`}
                    title={`${colaborador.nome} — ficha de verificação de SST`}
                    className={`h-full w-full object-top ${colaborador.foto ? "" : "hidden"}`}
                  />
                  {!colaborador.foto && (
                    <span className="flex h-full w-full items-center justify-center bg-background-100 text-foreground-400">
                      <i className="ri-user-3-line text-3xl"></i>
                    </span>
                  )}
                  {watermark && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <span className="-rotate-[30deg] whitespace-nowrap text-[7px] font-bold uppercase tracking-widest text-foreground-900/25">
                        {sessaoCodigo}
                      </span>
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading text-[20px] font-extrabold leading-tight tracking-tight text-foreground-950">
                    {colaborador.nome}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-foreground-600">
                    {colaborador.funcao} <span className="text-foreground-400">•</span> {colaborador.setor}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {colaborador.cadastroAtivo && (
                      <Pill label="Cadastro ativo" className="bg-primary-100 text-primary-800" />
                    )}
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
                      <i className="ri-qr-code-line text-xs"></i>
                      {colaborador.identificacao}
                    </span>
                  </div>
                  <p className="mt-2 text-[10.5px] text-foreground-500">
                    Situação informada pela empresa <span className="text-foreground-400">•</span> Atualizado em{" "}
                    {colaborador.atualizadoEm}
                  </p>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                <DadoBox label="CPF" value={colaborador.cpf} />
                <DadoBox label="PIS / PASEP" value={colaborador.pis} />
                <DadoBox label="CTPS" value={colaborador.ctps} />
                <DadoBox label="Admissão" value={colaborador.admissao} />
              </div>
            </div>

            {/* Resumo */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ResumoCard
                icon="ri-award-line"
                tone="danger"
                value={resumo.capacitacaoPendente}
                label="Capacitação com pendência"
              />
              <ResumoCard
                icon="ri-shield-check-line"
                tone="accent"
                value={resumo.epiRevisao}
                label="EPI com revisão pendente"
              />
              <ResumoCard
                icon="ri-file-list-3-line"
                tone="primary"
                value={resumo.epiRegistrados}
                label="EPIs registrados"
              />
            </div>

            {/* Cursos e treinamentos */}
            <div className="mt-6">
              <SectionTitle icon="ri-award-line">Cursos e treinamentos</SectionTitle>
              <div className="mt-2.5 overflow-hidden rounded-md border border-background-200">
                {cursos.length === 0 ? (
                  <p className="bg-background-100 px-4 py-3 text-[12px] text-foreground-500">
                    Nenhum treinamento comprovado para este colaborador.
                  </p>
                ) : (
                  cursos.map((curso) => {
                    const pill = cursoPill[curso.situacao];
                    const conferir = curso.situacao === "conferir";
                    return (
                      <div
                        key={curso.id}
                        className="flex flex-col gap-2 border-b border-background-200 bg-background-50 px-4 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <span className="flex items-center gap-2.5 sm:min-w-0 sm:flex-1">
                          <i
                            className={`shrink-0 text-base ${
                              conferir ? "ri-error-warning-line text-accent-600" : "ri-checkbox-circle-line text-primary-600"
                            }`}
                          ></i>
                          <span className="truncate text-[12.5px] font-semibold text-foreground-900">
                            {curso.nome}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <span className="text-[11.5px] text-foreground-500">{curso.criterio}</span>
                          <Pill label={pill.label} className={pill.className} />
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Ficha de EPI */}
            <div className="mt-6">
              <SectionTitle icon="ri-shirt-line">Ficha de EPI — registros e acompanhamento</SectionTitle>
              <div className="mt-2.5 overflow-x-auto rounded-md border border-background-200">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-background-200 bg-background-100 text-left">
                      {["EPI", "CA", "Entrega", "Controle de troca", "Situação"].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-2.5 text-[9.5px] font-bold uppercase tracking-wide text-foreground-400"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {epis.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-[12px] text-foreground-500">
                          Nenhum EPI registrado para este colaborador.
                        </td>
                      </tr>
                    ) : (
                      epis.map((epi) => {
                        const pill = epiPill[epi.situacao];
                        return (
                          <tr key={epi.id} className="border-b border-background-200 last:border-b-0">
                            <td className="px-4 py-2.5 text-[12.5px] font-semibold text-foreground-900">{epi.nome}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-foreground-700">
                              {epi.ca || "Não informado"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-foreground-700">
                              {epi.entrega || "Não informado"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[12.5px] text-foreground-700">
                              {epi.controleTroca || "Não informado"}
                            </td>
                            <td className="px-4 py-2.5">
                              <Pill label={pill.label} className={pill.className} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-foreground-500">
                <i className="ri-information-line mt-0.5 shrink-0"></i>
                Prazo de troca não é validade do CA. Uso e conservação exigem verificação no local.
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-foreground-500">
                <i className="ri-information-line mt-0.5 shrink-0"></i>
                Entrega registrada não comprova uso ou conservação. Verificar no local.
              </p>
            </div>

            {/* Avisos */}
            <div className="mt-4 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-accent-900">
              <i className="ri-alert-line mt-0.5 shrink-0"></i>
              <span>
                Este resumo não comprova, isoladamente, vínculo empregatício ou conformidade integral.
              </span>
            </div>

            <div className="mt-2.5 flex items-start gap-2 rounded-md bg-primary-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-primary-800">
              <i className="ri-lock-2-line mt-0.5 shrink-0"></i>
              <span>
                Dados pessoais reduzidos <span className="text-primary-600">•</span> Documentos completos
                apresentados pela empresa quando solicitados.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé auditável */}
      <div className="flex flex-col gap-2 border-t border-background-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10.5px] text-foreground-500">
          {previa ? "Prévia administrativa" : "Consulta auditada"}{" "}
          <span className="text-foreground-400">•</span> Sessão {sessaoCodigo}{" "}
          <span className="text-foreground-400">•</span> {consultadoEm}
          {ilustrativo && <span className="ml-2 font-semibold text-foreground-400">Layout de homologação</span>}
          {previa && <span className="ml-2 font-semibold text-foreground-400">Sem sessão externa</span>}
        </p>
        {previa ? (
          <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold text-foreground-400">
            <i className="ri-eye-line text-sm"></i>
            Ação do consultante indisponível na prévia
          </span>
        ) : (
          <button
            type="button"
            onClick={onEncerrar}
            className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold text-foreground-700 underline decoration-foreground-300 underline-offset-2 transition-colors hover:text-primary-700"
          >
            <i className="ri-logout-box-r-line text-sm"></i>
            Encerrar acesso
          </button>
        )}
        <span className="sr-only">Sessão válida até {sessaoValidaAte}</span>
      </div>
    </article>
  );
}