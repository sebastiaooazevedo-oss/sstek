import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cpfErrorMessage, formatCpf, isValidCpf } from "@/pages/fiscalizacao/cpf";
import {
  abrirFichaConsulta,
  carregarTermoConsulta,
  encerrarConsultaSessao,
  registrarConsultaExterna,
  termoConsultaPadrao,
} from "@/pages/fiscalizacao/consultaTermo";
import FichaAutorizada from "@/pages/fiscalizacao/components/FichaAutorizada";
import type { FichaSstData } from "@/pages/fiscalizacao/types";

/**
 * Entrada neutra da ficha externa de fiscalização.
 *
 * Regras aplicadas aqui:
 * - Nenhum dado pessoal do colaborador aparece antes da identificação e da
 *   autorização do consultante. Nem nome, nem foto, nem empresa.
 * - O consultante se identifica com nome, órgão e CPF. O CPF é validado de
 *   verdade (dígitos verificadores) — documento inválido não gera solicitação,
 *   porque a rastreabilidade de quem consultou deixaria de valer.
 * - O aceite do termo de tratamento de dados (LGPD) é obrigatório. O texto vem
 *   do servidor (Parametrização da empresa), então vale para todos os visitantes.
 * - A consulta é registrada no banco e abre uma SESSÃO autorizada de 30 minutos.
 *   A ficha resumida só é exibida com essa sessão validada no servidor.
 */

interface EntradaNeutraProps {
  /** `false` quando o QR chegou sem código (link truncado). */
  temCodigo: boolean;
  /** Subdomínio da empresa, quando o endereço traz essa informação. */
  empresa: string;
  /** Código lido do QR (identificador vigente do adesivo). */
  codigo: string;
}

interface RegistroOk {
  protocolo: string;
  registradoEm: string;
  detalhe: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export default function EntradaNeutra({ temCodigo, empresa, codigo }: EntradaNeutraProps) {
  const [nome, setNome] = useState("");
  const [orgao, setOrgao] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfTouched, setCpfTouched] = useState(false);
  const [finalidade, setFinalidade] = useState("");
  const [termoAceito, setTermoAceito] = useState(false);
  const [termo, setTermo] = useState(termoConsultaPadrao);
  const [termoPersonalizado, setTermoPersonalizado] = useState(false);
  const [termoErro, setTermoErro] = useState<string | null>(null);
  const [carregandoTermo, setCarregandoTermo] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [registro, setRegistro] = useState<RegistroOk | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dadosFicha, setDadosFicha] = useState<FichaSstData | null>(null);
  const [expiraEm, setExpiraEm] = useState("");
  const [abrindoFicha, setAbrindoFicha] = useState(false);
  const [erroFicha, setErroFicha] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregandoTermo(true);
    carregarTermoConsulta(empresa, codigo).then((resultado) => {
      if (!ativo) return;
      setTermo(resultado.texto || termoConsultaPadrao);
      setTermoPersonalizado(resultado.personalizado);
      setTermoErro(resultado.erro);
      setCarregandoTermo(false);
    });
    return () => {
      ativo = false;
    };
  }, [empresa, codigo]);

  const cpfValido = isValidCpf(cpf);
  const cpfErro = cpfTouched ? cpfErrorMessage(cpf) : null;
  const podeEnviar =
    !enviando && nome.trim().length > 2 && orgao.trim().length > 1 && cpfValido && termoAceito;

  const abrirFicha = async (sessaoToken: string) => {
    setAbrindoFicha(true);
    setErroFicha(null);
    const resultado = await abrirFichaConsulta(sessaoToken);
    setAbrindoFicha(false);
    if (!resultado.ok || !resultado.dados) {
      setErroFicha(resultado.detalhe);
      return;
    }
    setDadosFicha(resultado.dados);
    setExpiraEm(resultado.expiraEm || "");
  };

  const enviar = async () => {
    setCpfTouched(true);
    if (!podeEnviar) return;
    setEnviando(true);
    setErroEnvio(null);
    const resultado = await registrarConsultaExterna({
      empresa,
      codigo,
      nome: nome.trim(),
      orgao: orgao.trim(),
      cpf,
      finalidade: finalidade.trim(),
      termoAceito,
    });
    setEnviando(false);
    if (!resultado.ok) {
      setErroEnvio(resultado.detalhe);
      return;
    }
    // Sem protocolo o servidor não confirmou o registro: não dá para afirmar
    // nada sobre o adesivo. Mostra falha e permite tentar de novo.
    if (!resultado.protocolo) {
      setErroEnvio(
        resultado.detalhe ||
          "O serviço não confirmou o registro da consulta. Nenhuma ficha foi aberta. Tente novamente em instantes."
      );
      return;
    }
    setRegistro({
      protocolo: resultado.protocolo,
      registradoEm: resultado.registradoEm,
      detalhe: resultado.detalhe,
    });
    if (resultado.sessao?.token) {
      setToken(resultado.sessao.token);
      await abrirFicha(resultado.sessao.token);
    }
  };

  const encerrar = async () => {
    if (token) await encerrarConsultaSessao(token);
    setToken(null);
    setDadosFicha(null);
    setExpiraEm("");
    setRegistro(null);
    setErroFicha(null);
    setErroEnvio(null);
    setTermoAceito(false);
  };

  // Sessão validada no servidor: a ficha reduzida é exibida.
  if (dadosFicha && token) {
    return (
      <FichaAutorizada
        dados={dadosFicha}
        protocolo={registro?.protocolo ?? ""}
        consultadoEm={registro?.registradoEm ?? ""}
        expiraEm={expiraEm}
        empresaNome={dadosFicha.empresa.nome}
        onEncerrar={() => void encerrar()}
        onNovaConsulta={() => void encerrar()}
      />
    );
  }

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
              <p className="text-[10.5px] text-foreground-500">Verificação de SST</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground-500">
            <i className="ri-lock-2-line"></i>
            Área restrita
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="rounded-xl border border-background-200 bg-background-50 p-5 shadow-sm md:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary-900">
            <i className="ri-qr-scan-2-line"></i>
            Código lido
          </span>

          <h1 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Consulta de ficha de verificação
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground-600">
            {temCodigo
              ? "Este código identifica uma ficha de verificação de segurança do trabalho. Nenhum dado pessoal é exibido antes da identificação e da autorização do consultante."
              : "O código não foi lido por completo. Escaneie novamente o adesivo do crachá ou do capacete, sem cortar a borda do QR."}
          </p>

          {registro ? (
            <div className="mt-6 rounded-lg border border-primary-300 bg-primary-50 px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-bold text-primary-900">
                <i className={erroFicha || (!token && !abrindoFicha) ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
                {erroFicha || (!token && !abrindoFicha) ? "Consulta registrada — ficha não liberada" : "Abrindo a ficha autorizada"}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-primary-900/90">
                Sua consulta foi gravada com nome, órgão, CPF, finalidade e data/hora, junto com o aceite do termo de
                tratamento de dados. Esse registro é o que permite auditar quem consultou a ficha.
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-primary-200 bg-background-50 px-3 py-2">
                  <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">Protocolo</dt>
                  <dd className="mt-0.5 font-mono text-sm font-bold text-foreground-900">
                    {registro.protocolo || "—"}
                  </dd>
                </div>
                <div className="rounded-md border border-primary-200 bg-background-50 px-3 py-2">
                  <dt className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">Registrado em</dt>
                  <dd className="mt-0.5 text-sm font-bold text-foreground-900">
                    {formatDateTime(registro.registradoEm) || "—"}
                  </dd>
                </div>
              </dl>

              {abrindoFicha && (
                <p className="mt-3 flex items-center gap-2 rounded-md border border-primary-200 bg-background-50 px-3 py-2.5 text-[11.5px] text-foreground-600">
                  <i className="ri-loader-4-line animate-spin text-base text-primary-600"></i>
                  Validando a sessão e montando o resumo reduzido da ficha...
                </p>
              )}

              {erroFicha && (
                <div className="mt-3 rounded-md border border-accent-300 bg-accent-50 px-3 py-2.5">
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-accent-900">
                    <i className="ri-information-line mt-0.5 shrink-0"></i>
                    <span>
                      <strong className="font-semibold">A ficha não foi liberada.</strong> {erroFicha}
                    </span>
                  </p>
                </div>
              )}

              {!abrindoFicha && !erroFicha && !token && (
                <div className="mt-3 rounded-md border border-accent-300 bg-accent-50 px-3 py-2.5">
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-accent-900">
                    <i className="ri-information-line mt-0.5 shrink-0"></i>
                    <span>
                      {/* O motivo vem do servidor (adesivo sem colaborador, sessão indisponível etc.). */}
                      {registro.detalhe ||
                        "A ficha não foi liberada para esta consulta. A solicitação ficou registrada com o protocolo acima."}
                    </span>
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {token && erroFicha && (
                  <button
                    type="button"
                    onClick={() => void abrirFicha(token)}
                    className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-refresh-line"></i>
                    Tentar abrir a ficha
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void encerrar()}
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-arrow-left-line"></i>
                  Nova solicitação
                </button>
                <Link
                  to="/fiscalizacao/modelo"
                  className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-layout-masonry-line"></i>
                  Ver modelo da ficha
                </Link>
              </div>
            </div>
          ) : (
            <form
              className="mt-6"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void enviar();
              }}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-foreground-400">
                Identificação do consultante
              </p>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground-700">
                    Nome completo <span className="text-accent-600">*</span>
                  </span>
                  <input
                    type="text"
                    name="consultante_nome"
                    value={nome}
                    maxLength={120}
                    onChange={(event) => setNome(event.target.value)}
                    className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                    placeholder="Como consta no crachá funcional"
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground-700">
                    Órgão ou empresa <span className="text-accent-600">*</span>
                  </span>
                  <input
                    type="text"
                    name="consultante_orgao"
                    value={orgao}
                    maxLength={120}
                    onChange={(event) => setOrgao(event.target.value)}
                    className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                    placeholder="Ex.: Ministério do Trabalho e Emprego"
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground-700">
                    Identificação funcional (CPF) <span className="text-accent-600">*</span>
                  </span>
                  <input
                    type="text"
                    name="consultante_cpf"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cpf}
                    maxLength={14}
                    onBlur={() => setCpfTouched(true)}
                    onChange={(event) => setCpf(event.target.value)}
                    onPaste={(event) => {
                      event.preventDefault();
                      setCpf(formatCpf(event.clipboardData.getData("text")));
                      setCpfTouched(true);
                    }}
                    aria-invalid={cpfErro !== null}
                    aria-describedby="consultante-cpf-erro"
                    className={`w-full rounded-md border bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 ${
                      cpfErro
                        ? "border-danger-400 focus:border-danger-500"
                        : cpfValido
                          ? "border-primary-400 focus:border-primary-500"
                          : "border-background-300 focus:border-primary-400"
                    }`}
                    placeholder="000.000.000-00"
                  />
                  {cpfErro && (
                    <p
                      id="consultante-cpf-erro"
                      className="flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-danger-700"
                    >
                      <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
                      {cpfErro}
                    </p>
                  )}
                  {!cpfErro && cpfValido && (
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-700">
                      <i className="ri-checkbox-circle-line"></i>
                      CPF válido
                    </p>
                  )}
                  {!cpfErro && !cpfValido && (
                    <p className="text-[11px] leading-relaxed text-foreground-400">
                      Usado apenas para registrar quem consultou a ficha.
                    </p>
                  )}
                </label>

                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground-700">Finalidade da consulta</span>
                  <input
                    type="text"
                    name="consultante_finalidade"
                    value={finalidade}
                    maxLength={120}
                    onChange={(event) => setFinalidade(event.target.value)}
                    className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
                    placeholder="Ex.: fiscalização em campo"
                  />
                </label>
              </div>

              {/* Termo LGPD */}
              <div className="mt-5 rounded-lg border border-background-200 bg-background-100">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <i className="ri-shield-keyhole-line text-sm text-primary-700"></i>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-600">
                      Termo de tratamento de dados · LGPD
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${
                      termoPersonalizado
                        ? "bg-primary-100 text-primary-800"
                        : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    <i className={termoPersonalizado ? "ri-building-4-line" : "ri-file-text-line"}></i>
                    {termoPersonalizado ? "Termo da empresa" : "Termo padrão"}
                  </span>
                </div>
                <div className="max-h-[210px] overflow-y-auto px-4 py-3">
                  {carregandoTermo ? (
                    <div className="flex items-center gap-2 py-6 text-[11.5px] text-foreground-500">
                      <i className="ri-loader-4-line animate-spin text-base"></i>
                      Carregando o termo vigente da empresa...
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-foreground-600">{termo}</p>
                  )}
                </div>
                {termoErro && (
                  <div className="flex items-start gap-2 border-t border-accent-300 bg-accent-50 px-4 py-2.5">
                    <i className="ri-error-warning-line mt-0.5 text-sm text-accent-800"></i>
                    <p className="text-[10.5px] leading-relaxed text-accent-900">{termoErro}</p>
                  </div>
                )}
                <label className="flex cursor-pointer items-start gap-2.5 border-t border-background-200 bg-background-50 px-4 py-3">
                  <input
                    type="checkbox"
                    name="consultante_termo_aceite"
                    checked={termoAceito}
                    onChange={(event) => setTermoAceito(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary-500"
                  />
                  <span className="text-[11.5px] font-medium leading-relaxed text-foreground-700">
                    Li e concordo com o termo de tratamento de dados pessoais acima. Declaro que as informações de
                    identificação são verdadeiras e que usarei os dados apenas para a finalidade informada.
                  </span>
                </label>
              </div>

              {erroEnvio && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-danger-300 bg-danger-100 px-3.5 py-2.5">
                  <i className="ri-error-warning-line mt-0.5 shrink-0 text-sm text-danger-700"></i>
                  <p className="text-[11.5px] leading-relaxed text-danger-800">{erroEnvio}</p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-sm text-[10.5px] leading-relaxed text-foreground-400">
                  A consulta é registrada com data e hora e libera a ficha resumida por 30 minutos. Tokens de acesso e
                  endereços completos não são gravados.
                </p>
                <button
                  type="submit"
                  disabled={!podeEnviar}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enviando ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-base"></i>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <i className="ri-shield-keyhole-line text-base"></i>
                      Consultar ficha de verificação
                    </>
                  )}
                </button>
              </div>
              {!termoAceito && (
                <p className="mt-2 text-right text-[10.5px] font-medium text-foreground-400 sm:text-[11px]">
                  É necessário aceitar o termo para solicitar o acesso.
                </p>
              )}
            </form>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-background-200 bg-background-50 px-4 py-3">
          <i className="ri-information-line mt-0.5 text-base text-foreground-400"></i>
          <p className="text-[11px] leading-relaxed text-foreground-500">
            O adesivo do crachá e do capacete é um identificador persistente: ele não muda por leitura, por
            expiração de sessão nem por atualização cadastral. Documentos completos são apresentados pela empresa
            quando solicitados.
          </p>
        </div>
      </main>

      <footer className="border-t border-background-200 bg-background-50 px-4 py-4 md:px-6">
        <p className="mx-auto max-w-[880px] text-[10.5px] leading-relaxed text-foreground-400">
          Este QR Code permite consultar um resumo dos registros de segurança do trabalho do colaborador. Para
          informações detalhadas ou comprovação documental, entre em contato com a empresa e seu setor responsável
          por Segurança do Trabalho.
        </p>
      </footer>
    </div>
  );
}