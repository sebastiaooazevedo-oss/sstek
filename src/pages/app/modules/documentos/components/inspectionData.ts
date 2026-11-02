/**
 * Catálogo e tipos da Inspeção de Campo (inspeção de segurança de campo).
 * Os itens verificados seguem as principais NRs aplicáveis a uma
 * inspeção de rotina prevista no PGR (NR-1), servindo de roteiro
 * para o responsável registrar a situação observada em cada ponto.
 */

export interface ChecklistItemDef {
  id: string;
  label: string;
  ref: string;
}

export const inspectionChecklist: ChecklistItemDef[] = [
  { id: "epi", label: "Uso correto de EPIs", ref: "NR-6" },
  { id: "ordem", label: "Ordem, limpeza e organização (5S)", ref: "NR-1" },
  { id: "maquinas", label: "Proteções de máquinas e equipamentos", ref: "NR-12" },
  { id: "eletrica", label: "Instalações e quadros elétricos", ref: "NR-10" },
  { id: "iluminacao", label: "Iluminação dos postos de trabalho", ref: "NR-17" },
  { id: "ruido", label: "Ruído e agentes físicos", ref: "NR-9 / NR-15" },
  { id: "sinalizacao", label: "Sinalização de segurança e rotas de fuga", ref: "NR-26" },
  { id: "incendio", label: "Extintores e combate a incêndio", ref: "NR-23" },
  { id: "ergonomia", label: "Ergonomia e postos de trabalho", ref: "NR-17" },
  { id: "cargas", label: "Movimentação de cargas e transporte", ref: "NR-11" },
  { id: "quimicos", label: "Produtos químicos e FISPQ", ref: "NR-26" },
  { id: "circulacao", label: "Vias de circulação e acessos", ref: "NR-12" },
  { id: "altura", label: "Trabalho em altura", ref: "NR-35" },
  { id: "espaco", label: "Espaços confinados", ref: "NR-33" },
];

export const inspectionItemStatuses = ["Conforme", "Não conforme", "Não aplicável"] as const;
export type InspectionItemStatus = (typeof inspectionItemStatuses)[number];

export interface ChecklistEntry {
  status: string;
  note: string;
}

export const inspectionKinds = ["Rotina", "Programada", "Extraordinária", "Auditoria"] as const;
export type InspectionKind = (typeof inspectionKinds)[number];

export const inspectionShifts = ["1º Turno", "2º Turno", "3º Turno", "Administrativo"] as const;

export const riskLevels = ["Baixo", "Médio", "Alto", "Crítico"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const inspectedSituations = ["Conforme", "Atenção", "Não conforme"] as const;
export type InspectedSituation = (typeof inspectedSituations)[number];

export interface InspectedPerson {
  id: string;
  /** Id do colaborador da base quando vinculado; vazio em registro manual. */
  collaboratorId: string;
  name: string;
  cpf: string;
  matricula: string;
  role: string;
  area: string;
  situation: InspectedSituation;
}

export interface InspectionPhoto {
  id: string;
  url: string;
  name: string;
}

export function emptyChecklist(): Record<string, ChecklistEntry> {
  return inspectionChecklist.reduce<Record<string, ChecklistEntry>>((acc, item) => {
    acc[item.id] = { status: "", note: "" };
    return acc;
  }, {});
}

/** Conta quantos itens foram marcados como "Não conforme". */
export function countNonConforming(checklist: Record<string, ChecklistEntry>): number {
  return inspectionChecklist.reduce(
    (acc, item) => (checklist[item.id]?.status === "Não conforme" ? acc + 1 : acc),
    0
  );
}