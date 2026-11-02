export type DocumentScope = "empresa" | "colaborador";
export type DocumentStatus = "Em dia" | "Vencendo" | "Vencido";

export interface DocumentType {
  id: string;
  name: string;
  scope: DocumentScope;
  required: boolean;
  /**
   * Nota curta exibida ao escolher o tipo, para diferenciar documentos que
   * soam parecidos (ex.: LTC x LTCAT).
   */
  description?: string;
}

export const documentTypes: DocumentType[] = [
  { id: "ficha-cadastro-colaborador", name: "Ficha de Cadastro do Colaborador", scope: "colaborador", required: false },
  { id: "aso", name: "ASO", scope: "colaborador", required: true },
  { id: "ficha-epi", name: "Ficha de EPI", scope: "colaborador", required: true },
  { id: "cnh", name: "CNH — Carteira Nacional de Habilitação", scope: "colaborador", required: false },
  { id: "foto-epi", name: "Registro fotográfico de EPI", scope: "colaborador", required: false },
  { id: "ppp", name: "PPP", scope: "colaborador", required: true },
  { id: "epc", name: "EPC", scope: "colaborador", required: false },
  { id: "ordem-servico", name: "Ordem de Serviço", scope: "colaborador", required: true },
  { id: "certificado-treinamento", name: "Certificado de Treinamento", scope: "colaborador", required: true },
  { id: "atestado-medico", name: "Atestado Médico", scope: "colaborador", required: false },
  { id: "documento-pessoal", name: "Documento pessoal (imagem)", scope: "colaborador", required: false },
  { id: "outro-colaborador", name: "Outro documento do colaborador", scope: "colaborador", required: false },
  { id: "pcmso", name: "PCMSO", scope: "empresa", required: true },
  {
    id: "ltcat",
    name: "LTCAT — Laudo Técnico das Condições Ambientais do Trabalho",
    scope: "empresa",
    required: true,
    description:
      "Previdenciário (INSS) · Lei 8.213/91 e Decreto 3.048/99 · comprova exposição a agentes nocivos e alimenta o PPP e o eSocial.",
  },
  { id: "pgr", name: "PGR", scope: "empresa", required: true },
  { id: "ppra", name: "PPRA — Programa de Prevenção de Riscos Ambientais", scope: "empresa", required: false },
  {
    id: "ltc",
    name: "LTC — Laudo Técnico de Condições Ambientais",
    scope: "empresa",
    required: false,
    description:
      "Trabalhista (CLT) · NR-15 e NR-16 · avalia insalubridade e periculosidade para o adicional de salário.",
  },
  { id: "ppp-empresa", name: "PPP — Perfil Profissiográfico Previdenciário", scope: "empresa", required: false },
  { id: "aet-ae", name: "AET / AE", scope: "empresa", required: false },
  { id: "mapa-risco", name: "Mapa de Risco", scope: "empresa", required: false },
  { id: "acordos-convencoes", name: "Acordos ou Convenções Coletivas", scope: "empresa", required: false },
  { id: "apr", name: "APR", scope: "empresa", required: false },
  { id: "ficha-presenca", name: "Ficha de Presença", scope: "empresa", required: false },
  { id: "inspecao-campo", name: "Inspeção de Campo", scope: "empresa", required: false },
  { id: "investigacao-acidente", name: "Investigação de Acidente", scope: "empresa", required: false },
  { id: "cat", name: "CAT — Comunicação de Acidente de Trabalho", scope: "empresa", required: false },
  { id: "afericoes", name: "Aferições", scope: "empresa", required: false },
  { id: "permissao-trabalho", name: "Permissão de Trabalho", scope: "empresa", required: false },
  { id: "ata-cipa", name: "Ata da CIPA", scope: "empresa", required: false },
  { id: "edital-cipa", name: "Edital de Convocação da CIPA", scope: "empresa", required: false },
  { id: "edital-resultado-cipa", name: "Edital de Resultado da CIPA", scope: "empresa", required: false },
  { id: "dossie-cipa", name: "Dossiê do Processo Eleitoral da CIPA", scope: "empresa", required: false },
  { id: "termo-posse-cipa", name: "Termo de Posse da CIPA", scope: "empresa", required: false },
  { id: "boletim-urna-cipa", name: "Boletim de Urna da CIPA", scope: "empresa", required: false },
  { id: "ata-resultado-cipa", name: "Ata de Resultado Final da CIPA", scope: "empresa", required: false },
  { id: "relatorio-comparecimento-cipa", name: "Relatório de Comparecimento do Pleito", scope: "empresa", required: false },
  { id: "ficha-candidato-cipa", name: "Ficha de Cadastro de Candidato da CIPA", scope: "empresa", required: false },
  { id: "anexo-eleicao-cipa", name: "Anexo do Processo Eleitoral da CIPA", scope: "empresa", required: false },
  { id: "outro-empresa", name: "Outro documento administrativo", scope: "empresa", required: false },
];

export interface DossierParts {
  convocacao: boolean;
  ata: boolean;
  resultado: boolean;
  posse: boolean;
}

/**
 * Arquivo externo anexado ao Dossiê do Processo Eleitoral (ex.: edital assinado
 * em papel, foto da ata física). Para imagens, `previewDataUrl` carrega a
 * miniatura (data URL) que é exibida em Documentos.
 */
export interface DossierAttachment {
  name: string;
  previewDataUrl?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  scope: DocumentScope;
  collaboratorId?: string;
  collaboratorName?: string;
  collaboratorRole?: string;
  issuedAt: string;
  expiresAt: string;
  status: DocumentStatus;
  size: string;
  fileType: "pdf" | "docx" | "xlsx" | "img";
  visibleToCollaborator: boolean;
  /**
   * Unidade/estabelecimento do documento. Quando vazio, o documento é tratado
   * como corporativo (vale para todas as unidades) e aparece em qualquer filtro.
   */
  establishment?: string;
  /** Situação de aprovação (usada por documentos gerados de atas da CIPA). */
  approvalStatus?: "aprovada" | "aguardando";
  /** Vínculo com a ata da CIPA de origem, quando aplicável. */
  ataId?: string;
  /** Vínculo com o processo eleitoral de origem (edital), quando aplicável. */
  electionId?: string;
  /** Peças selecionadas que compõem o Dossiê do Processo Eleitoral. */
  dossierParts?: DossierParts;
  /** Nomes dos arquivos externos anexados ao dossiê (ex.: edital assinado em papel). */
  dossierAttachments?: string[];
  /** Miniatura (data URL) de anexos de imagem, exibida na tela de Documentos. */
  previewDataUrl?: string;
  /** Caminho do arquivo salvo no Storage privado (para uploads enviados). */
  storagePath?: string;
  /** URL (temporária) do arquivo salvo no Storage, para visualização. */
  fileUrl?: string;
  /** Corpo HTML do PDF gerado e anexado automaticamente ao registro. */
  attachedPdfHtml?: string;
  /** Momento em que o PDF foi anexado ao registro. */
  attachedAt?: string;
  /**
   * Documento que este registro substitui (usado quando o envio é uma
   * substituição). Guarda a referência e o nome do documento anterior.
   */
  replacesRef?: string;
  replacesName?: string;
  /**
   * Quando preenchido, este documento foi substituído por outro. Ele passa a
   * ser tratado como Vencido e continua consultável no histórico.
   */
  supersededByRef?: string;
  supersededAt?: string;
  /**
   * Justificativa registrada na substituição. Obrigatória quando a nova
   * validade não avança em relação à do documento substituído.
   */
  replacementReason?: string;
}

export const initialDocuments: DocumentRecord[] = [
  { id: "d-001", name: "PCMSO 2026 — Programa de Controle Médico", typeId: "pcmso", typeName: "PCMSO", scope: "empresa", issuedAt: "15/01/2026", expiresAt: "15/01/2027", status: "Em dia", size: "3.4 MB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-002", name: "LTCAT — Laudo Técnico das Condições Ambientais do Trabalho", typeId: "ltcat", typeName: "LTCAT", scope: "empresa", issuedAt: "20/11/2025", expiresAt: "20/11/2026", status: "Vencendo", size: "5.1 MB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-003", name: "PGR — Programa de Gerenciamento de Riscos", typeId: "pgr", typeName: "PGR", scope: "empresa", issuedAt: "02/02/2026", expiresAt: "02/02/2027", status: "Em dia", size: "6.8 MB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-004", name: "AET — Análise Ergonômica do Trabalho", typeId: "aet-ae", typeName: "AET / AE", scope: "empresa", issuedAt: "18/03/2026", expiresAt: "18/03/2028", status: "Em dia", size: "2.2 MB", fileType: "pdf", visibleToCollaborator: false },
  { id: "d-005", name: "Mapa de Risco — Planta Fabril", typeId: "mapa-risco", typeName: "Mapa de Risco", scope: "empresa", issuedAt: "05/05/2026", expiresAt: "05/05/2027", status: "Em dia", size: "1.7 MB", fileType: "img", visibleToCollaborator: true },
  { id: "d-006", name: "Convenção Coletiva de Trabalho 2026", typeId: "acordos-convencoes", typeName: "Acordos ou Convenções Coletivas", scope: "empresa", issuedAt: "10/01/2026", expiresAt: "31/12/2026", status: "Em dia", size: "890 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-007", name: "APR — Análise Preliminar de Risco (Solda)", typeId: "apr", typeName: "APR", scope: "empresa", issuedAt: "12/08/2026", expiresAt: "12/08/2027", status: "Em dia", size: "640 KB", fileType: "pdf", visibleToCollaborator: false },
  { id: "d-008", name: "ASO Periódico 2026", typeId: "aso", typeName: "ASO", scope: "colaborador", collaboratorId: "c-001", collaboratorName: "Carlos Menezes", collaboratorRole: "Soldador", issuedAt: "02/10/2025", expiresAt: "02/10/2026", status: "Vencendo", size: "412 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-009", name: "Ficha de EPI nº 0291", typeId: "ficha-epi", typeName: "Ficha de EPI", scope: "colaborador", collaboratorId: "c-001", collaboratorName: "Carlos Menezes", collaboratorRole: "Soldador", issuedAt: "12/01/2026", expiresAt: "12/01/2027", status: "Em dia", size: "238 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-010", name: "Certificado NR-35 · Trabalho em Altura", typeId: "certificado-treinamento", typeName: "Certificado de Treinamento", scope: "colaborador", collaboratorId: "c-002", collaboratorName: "Juliana Prado", collaboratorRole: "Técnica de Segurança", issuedAt: "05/10/2024", expiresAt: "05/10/2026", status: "Vencendo", size: "1.1 MB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-011", name: "ASO Admissional", typeId: "aso", typeName: "ASO", scope: "colaborador", collaboratorId: "c-003", collaboratorName: "Diego Farias", collaboratorRole: "Operador de Empilhadeira", issuedAt: "18/07/2022", expiresAt: "18/07/2027", status: "Em dia", size: "398 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-012", name: "Certificado NR-10 · Segurança em Eletricidade", typeId: "certificado-treinamento", typeName: "Certificado de Treinamento", scope: "colaborador", collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", issuedAt: "14/10/2024", expiresAt: "14/10/2026", status: "Vencendo", size: "1.3 MB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-013", name: "PPP — Perfil Profissiográfico Previdenciário", typeId: "ppp", typeName: "PPP", scope: "colaborador", collaboratorId: "c-004", collaboratorName: "Roberto Lima", collaboratorRole: "Eletricista", issuedAt: "20/06/2026", expiresAt: "20/06/2028", status: "Em dia", size: "780 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-014", name: "Ordem de Serviço 0044 — Manutenção", typeId: "ordem-servico", typeName: "Ordem de Serviço", scope: "colaborador", collaboratorId: "c-005", collaboratorName: "Patrícia Gomes", collaboratorRole: "Analista de Qualidade", issuedAt: "02/03/2026", expiresAt: "—", status: "Em dia", size: "156 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-015", name: "Atestado Médico — Retorno ao Trabalho", typeId: "atestado-medico", typeName: "Atestado Médico", scope: "colaborador", collaboratorId: "c-006", collaboratorName: "André Souza", collaboratorRole: "Mecânico Industrial", issuedAt: "22/08/2026", expiresAt: "—", status: "Em dia", size: "301 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-016", name: "RG e CPF digitalizados", typeId: "documento-pessoal", typeName: "Documento pessoal (imagem)", scope: "colaborador", collaboratorId: "c-007", collaboratorName: "Fernanda Ribeiro", collaboratorRole: "Auxiliar Administrativo", issuedAt: "14/02/2023", expiresAt: "—", status: "Em dia", size: "2.6 MB", fileType: "img", visibleToCollaborator: false },
  { id: "d-017", name: "Certificado NR-12 · Segurança em Máquinas", typeId: "certificado-treinamento", typeName: "Certificado de Treinamento", scope: "colaborador", collaboratorId: "c-009", collaboratorName: "Tatiane Costa", collaboratorRole: "Operadora de Máquinas", issuedAt: "12/01/2024", expiresAt: "12/01/2026", status: "Vencido", size: "1.0 MB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-018", name: "ASO Periódico 2026", typeId: "aso", typeName: "ASO", scope: "colaborador", collaboratorId: "c-010", collaboratorName: "Rafael Nunes", collaboratorRole: "Almoxarife", issuedAt: "20/10/2025", expiresAt: "20/10/2026", status: "Vencendo", size: "405 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-019", name: "Ficha de EPI nº 0312", typeId: "ficha-epi", typeName: "Ficha de EPI", scope: "colaborador", collaboratorId: "c-008", collaboratorName: "Marcos Oliveira", collaboratorRole: "Supervisor de Produção", issuedAt: "09/02/2026", expiresAt: "09/02/2027", status: "Em dia", size: "244 KB", fileType: "pdf", visibleToCollaborator: true },
  { id: "d-020", name: "EPC — Equipamento de Proteção Coletiva (Extintores)", typeId: "epc", typeName: "EPC", scope: "colaborador", collaboratorId: "c-011", collaboratorName: "Larissa Martins", collaboratorRole: "Engenheira de Segurança", issuedAt: "03/03/2026", expiresAt: "03/03/2027", status: "Em dia", size: "520 KB", fileType: "pdf", visibleToCollaborator: true },
];