import { getInitials } from "@/pages/app/context";
import type { Collaborator } from "@/mocks/collaborators";
import type { QrProfile } from "@/mocks/qrcodes";
import type { CursoSituacao, FichaSstData } from "@/pages/fiscalizacao/types";

/**
 * Monta a PRÉVIA da ficha externa a partir do cadastro interno.
 *
 * Esta conversão é o coração da separação de camadas:
 *
 * - O cadastro interno (aba Colaboradores, EPI, Documentos) continua mostrando
 *   os dados completos para quem tem permissão.
 * - A prévia de fiscalização mostra EXATAMENTE o que o consultante externo
 *   veria, com os mesmos mascaramentos e os mesmos critérios da ficha aprovada.
 *
 * Mascaramento (igual ao que o servidor precisa fazer antes de responder):
 * - CPF: apenas três dígitos visíveis — `***.***.305-**`.
 * - PIS/PASEP, CTPS e admissão: `***`.
 * - Nada de atestado, CID, exame, assinatura ou documento pessoal completo.
 */

/** `412.887.305-11` → `***.***.305-**`. */
export function maskCpfMiddle(cpf: string): string {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return "***.***.***-**";
  return `***.***.${digits.slice(6, 9)}-**`;
}

/** Identificação impressa no adesivo: iniciais + cauda do código, nunca o CPF. */
export function buildIdentificacao(name: string, code: string): string {
  const tail = (code || "").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
  return `${getInitials(name)}-${tail || "SST"}`;
}

function cursoSituacao(status: string): CursoSituacao {
  if (status === "Vencido") return "pendente";
  if (status === "Vencendo") return "conferir";
  return "vigente";
}

export interface PreviewInput {
  collaborator: Collaborator;
  profile: QrProfile;
  companyName: string;
  subdomain: string;
  /** Código vigente do QR (opaco ou legado). */
  code: string;
  /**
   * `true` (padrão) = ficha como o consultante externo vê, com mascaramento.
   * `false` = tela interna autenticada, com CPF, PIS, CTPS e admissão completos.
   */
  masked?: boolean;
}

export function buildFiscalizacaoPreview({
  collaborator,
  profile,
  companyName,
  subdomain,
  code,
  masked = true,
}: PreviewInput): FichaSstData {
  const cursos = profile.trainings.map((training) => ({
    id: training.id,
    nome: training.name,
    criterio: training.expires ? `Prazo cadastrado: ${training.expires}` : "Critério não informado",
    situacao: cursoSituacao(training.status),
  }));

  /*
   * EPI: a entrega registrada NÃO informa o controle de troca/inspeção e a
   * validade do CA não é a validade do equipamento. Por isso o controle fica
   * "Não informado" e a situação "Conferir no local" — o mesmo critério da
   * ficha externa real. Nada é marcado como vencido a partir do CA.
   */
  const epis = profile.epis.map((epi) => ({
    id: epi.id,
    nome: epi.epi,
    ca: epi.ca,
    entrega: epi.delivered,
    controleTroca: "",
    situacao: "conferir" as const,
  }));

  return {
    empresa: {
      nome: companyName,
      enderecoWeb: subdomain ? `${subdomain}.sstek.com.br` : "",
    },
    colaborador: {
      nome: collaborator.name,
      funcao: collaborator.role || "Função não informada",
      setor: collaborator.area || "Setor não informado",
      foto: collaborator.photo,
      identificacao: buildIdentificacao(collaborator.name, code),
      cadastroAtivo: collaborator.status === "Ativo",
      // Data real da última atualização do cadastro (company_collaborators.
      // updated_at). Nada de "Não informado" quando o banco já sabe a data.
      atualizadoEm: collaborator.updatedAt || "—",
      cpf: masked ? maskCpfMiddle(collaborator.cpf) : collaborator.cpf || "Não informado",
      pis: masked ? "***" : collaborator.pis || "Não informado",
      ctps: masked ? "***" : collaborator.ctps || "Não informado",
      admissao: masked ? "***" : collaborator.admissionDate || "Não informado",
    },
    resumo: {
      capacitacaoPendente: cursos.filter((curso) => curso.situacao === "pendente").length,
      epiRevisao: 0,
      epiRegistrados: epis.length,
    },
    cursos,
    epis,
    conferenciaPresencial: true,
  };
}