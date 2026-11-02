/**
 * Modelo de dados da ficha externa de verificação de SST.
 *
 * A ficha é montada a partir de um resumo já reduzido no servidor: nada de
 * CPF completo, PIS, CTPS, exames, atestados ou documentos pessoais. O tipo
 * abaixo só admite o que é permitido exibir ao consultante autorizado.
 */

/** Situação de um curso/treinamento na ficha externa. */
export type CursoSituacao = "vigente" | "pendente" | "conferir";

/** Situação de um registro de EPI na ficha externa. */
export type EpiSituacao = "ok" | "revisar" | "conferir";

export interface FichaEmpresa {
  nome: string;
  enderecoWeb: string;
}

export interface FichaColaborador {
  nome: string;
  funcao: string;
  setor: string;
  foto: string;
  /** Identificação impressa no adesivo (iniciais + código), nunca derivada de CPF. */
  identificacao: string;
  cadastroAtivo: boolean;
  /** Data da última atualização cadastral informada pela empresa. */
  atualizadoEm: string;
  /** CPF reduzido a três dígitos visíveis: ***.***.305-**. */
  cpf: string;
  pis: string;
  ctps: string;
  admissao: string;
}

export interface FichaCurso {
  id: string;
  nome: string;
  /** Prazo ou critério aplicável à capacitação (ex.: "Prazo cadastrado: 05/10/2026"). */
  criterio: string;
  situacao: CursoSituacao;
}

export interface FichaEpi {
  id: string;
  nome: string;
  ca: string;
  entrega: string;
  /** Controle de troca/inspeção — não é a validade do CA. */
  controleTroca: string;
  situacao: EpiSituacao;
}

export interface FichaResumo {
  capacitacaoPendente: number;
  epiRevisao: number;
  epiRegistrados: number;
}

export interface FichaSstData {
  empresa: FichaEmpresa;
  colaborador: FichaColaborador;
  resumo: FichaResumo;
  cursos: FichaCurso[];
  epis: FichaEpi[];
  /** Exibe o alerta de conferência presencial no topo da ficha. */
  conferenciaPresencial: boolean;
}