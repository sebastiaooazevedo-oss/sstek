import { supabase } from "@/lib/supabase";
import type { FichaSstData } from "@/pages/fiscalizacao/types";

/**
 * Termo de tratamento de dados da consulta externa (LGPD) + sessão autorizada.
 *
 * O texto vigente mora em `company_settings.fiscalizacao_termo_lgpd` e é lido
 * pela Edge Function `fiscalizacao-consulta`. Assim, o texto editado em
 * Parametrização vale para QUALQUER visitante que escaneie o QR-Code.
 *
 * O fluxo completo tem três passos, todos validados no servidor:
 * 1. `contexto`  → termo vigente da empresa.
 * 2. `solicitar` → registra a consulta e abre uma sessão de 5 minutos.
 * 3. `ficha`     → a ficha resumida só é devolvida com um token de sessão
 *                  válido, não expirado e não encerrado.
 *
 * O texto abaixo é apenas o padrão do sistema, usado quando a empresa ainda
 * não personalizou nada ou quando o servidor não responde.
 */

export const termoConsultaPadrao = `TERMO DE CIÊNCIA E CONSENTIMENTO — TRATAMENTO DE DADOS PESSOAIS (LGPD)

Esta consulta é feita em sistema de gestão de Segurança e Saúde no Trabalho e trata dados pessoais de um trabalhador. Ao prosseguir, você declara estar ciente de que:

1. FINALIDADE. Os dados exibidos nesta ficha são utilizados exclusivamente para verificação dos registros de segurança do trabalho do colaborador (capacitações, treinamentos e registros de entrega de EPI) em atendimento à legislação de segurança e saúde no trabalho.

2. PROTEÇÃO DO COLABORADOR. Os dados pessoais do trabalhador são apresentados de forma reduzida, limitados ao mínimo necessário para a conferência. Documentos pessoais completos, atestados, exames e prontuários não são exibidos nesta consulta.

3. RASTREABILIDADE. Seus dados de identificação (nome, órgão ou empresa, CPF e finalidade informada) são registrados com data e hora, com o objetivo de registrar quem solicitou a informação e para qual finalidade, permitindo auditoria e responsabilização em caso de uso indevido.

4. BASE LEGAL. O tratamento ocorre para cumprimento de obrigação legal e regulatória e para o exercício regular de direitos, nos termos da Lei nº 13.709/2018 (LGPD).

5. PROIBIÇÃO DE USO INDEVIDO. Os dados acessados não podem ser utilizados para finalidade diversa da declarada, nem copiados, divulgados ou compartilhados sem autorização da empresa responsável.

6. DIREITOS DO TITULAR. O trabalhador pode solicitar informações sobre o tratamento dos seus dados ao setor responsável por Segurança do Trabalho da empresa.

Ao marcar a opção de aceite, você confirma que leu este termo e que as informações de identificação informadas são verdadeiras.`;

export interface TermoConsultaVigente {
  /** Texto que deve ser exibido ao consultante. */
  texto: string;
  /** `true` quando o texto vem da empresa (e não do padrão do sistema). */
  personalizado: boolean;
  /** Nome da empresa identificada pelo QR (vazio quando não foi possível). */
  empresaNome: string;
  /** Mensagem quando não foi possível consultar o servidor. */
  erro: string | null;
}

interface ContextoResponse {
  ok?: boolean;
  empresa?: { nome?: string; subdominio?: string } | null;
  termo?: string;
  termoPersonalizado?: boolean;
}

/**
 * Lê o termo vigente para o código/empresa do QR.
 * Em qualquer falha devolve o texto padrão e sinaliza o erro na tela.
 */
export async function carregarTermoConsulta(empresa: string, codigo: string): Promise<TermoConsultaVigente> {
  try {
    const { data, error } = await supabase.functions.invoke<ContextoResponse>("fiscalizacao-consulta", {
      body: { acao: "contexto", empresa, codigo },
    });
    if (error) throw error;

    const texto = typeof data?.termo === "string" ? data.termo.trim() : "";
    return {
      texto: texto || termoConsultaPadrao,
      personalizado: Boolean(texto),
      empresaNome: String(data?.empresa?.nome ?? ""),
      erro: null,
    };
  } catch {
    return {
      texto: termoConsultaPadrao,
      personalizado: false,
      empresaNome: "",
      erro: "Não foi possível carregar o termo da empresa agora. O texto padrão do sistema está sendo exibido.",
    };
  }
}

/** Sessão autorizada devolvida pelo servidor após registrar a consulta. */
export interface SessaoConsulta {
  /** Token de uso único por sessão — fica só em memória, nunca em URL ou storage. */
  token: string;
  expiraEm: string;
}

export interface RegistroConsultaInput {
  empresa: string;
  codigo: string;
  nome: string;
  orgao: string;
  cpf: string;
  finalidade: string;
  termoAceito: boolean;
}

export interface RegistroConsultaResult {
  ok: boolean;
  /** Protocolo curto gerado no servidor (não é token de acesso). */
  protocolo: string;
  registradoEm: string;
  detalhe: string;
  sessao: SessaoConsulta | null;
}

interface SolicitarResponse {
  ok?: boolean;
  protocolo?: string;
  registradoEm?: string;
  detail?: string;
  error?: string;
  sessao?: { token?: string; expiraEm?: string } | null;
}

const ERRO_GENERICO = "Não foi possível registrar a solicitação agora. Tente novamente em instantes.";

function mensagemDoErro(error: unknown): string {
  if (error instanceof Error && error.message && !/non-2xx/i.test(error.message)) return error.message;
  return ERRO_GENERICO;
}

/** Extrai `detail` do corpo da resposta de erro da função. */
async function detalheDoErro(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== "function") return null;
  try {
    const body = (await context.json()) as { detail?: string };
    return body?.detail ? String(body.detail) : null;
  } catch {
    return null;
  }
}

/**
 * Registra a solicitação de consulta e abre a sessão autorizada.
 *
 * A gravação acontece na Edge Function (chave de serviço): o navegador não tem
 * permissão de INSERT nesta tabela, então ninguém forja um registro de consulta
 * diretamente pelo cliente.
 */
export async function registrarConsultaExterna(input: RegistroConsultaInput): Promise<RegistroConsultaResult> {
  try {
    const { data, error } = await supabase.functions.invoke<SolicitarResponse>("fiscalizacao-consulta", {
      body: {
        acao: "solicitar",
        empresa: input.empresa,
        codigo: input.codigo,
        consulenteNome: input.nome,
        orgao: input.orgao,
        cpf: input.cpf,
        finalidade: input.finalidade,
        termoAceito: input.termoAceito,
      },
    });

    if (error) {
      const detalhe = await detalheDoErro(error);
      return {
        ok: false,
        protocolo: "",
        registradoEm: "",
        detalhe: detalhe || mensagemDoErro(error),
        sessao: null,
      };
    }

    const token = typeof data?.sessao?.token === "string" ? data.sessao.token : "";
    return {
      ok: true,
      protocolo: String(data?.protocolo ?? ""),
      registradoEm: String(data?.registradoEm ?? ""),
      detalhe: String(data?.detail ?? ""),
      sessao: token ? { token, expiraEm: String(data?.sessao?.expiraEm ?? "") } : null,
    };
  } catch {
    return {
      ok: false,
      protocolo: "",
      registradoEm: "",
      detalhe: "Sem conexão com o serviço de registro de consultas. Verifique a internet e tente novamente.",
      sessao: null,
    };
  }
}

export interface FichaConsultaResult {
  ok: boolean;
  dados: FichaSstData | null;
  protocolo: string;
  consultadoEm: string;
  expiraEm: string;
  detalhe: string;
}

interface FichaResponse {
  ok?: boolean;
  protocolo?: string;
  consultadoEm?: string;
  expiraEm?: string;
  detail?: string;
  error?: string;
  ficha?: FichaSstData | null;
}

/**
 * Busca o resumo reduzido usando o token da sessão.
 * O servidor valida expiração, revogação e limite de acessos — o cliente não
 * decide se pode ou não ver a ficha.
 */
export async function abrirFichaConsulta(token: string): Promise<FichaConsultaResult> {
  const vazio = { protocolo: "", consultadoEm: "", expiraEm: "", dados: null };
  try {
    const { data, error } = await supabase.functions.invoke<FichaResponse>("fiscalizacao-consulta", {
      body: { acao: "ficha", token },
    });

    if (error) {
      const detalhe = await detalheDoErro(error);
      return {
        ok: false,
        ...vazio,
        detalhe: detalhe || "Não foi possível abrir a ficha. Faça a consulta novamente em instantes.",
      };
    }

    if (!data?.ok || !data.ficha) {
      return {
        ok: false,
        ...vazio,
        detalhe: String(data?.detail ?? "A ficha não pôde ser aberta para esta sessão."),
      };
    }

    return {
      ok: true,
      dados: data.ficha,
      protocolo: String(data.protocolo ?? ""),
      consultadoEm: String(data.consultadoEm ?? ""),
      expiraEm: String(data.expiraEm ?? ""),
      detalhe: "",
    };
  } catch {
    return {
      ok: false,
      ...vazio,
      detalhe: "Sem conexão com o serviço da ficha. Verifique a internet e tente novamente.",
    };
  }
}

/** Revoga a sessão no servidor. Falha aqui não trava a tela do visitante. */
export async function encerrarConsultaSessao(token: string): Promise<void> {
  try {
    await supabase.functions.invoke("fiscalizacao-consulta", {
      body: { acao: "encerrar", token },
    });
  } catch {
    /* o servidor também expira a sessão em 5 minutos */
  }
}