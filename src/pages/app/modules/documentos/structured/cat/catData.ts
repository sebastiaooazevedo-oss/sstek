import type { ChecklistTemplate } from "@/pages/app/modules/documentos/structured/structuredData";
import type {
  CatPayload,
  StructuredRecord,
} from "@/pages/app/modules/documentos/structured/structuredTypes";

/**
 * Catálogo de apoio da CAT (Comunicação de Acidente de Trabalho).
 *
 * Reúne as tabelas oficiais usadas no preenchimento (parte do corpo atingida,
 * agente causador, CID, CBO), os enums de sexo/estado civil/consequência e o
 * roteiro de conferência legal da Lei 8.213/91 (art. 22) e do eSocial (S-2210).
 */

/* --------------------------- Empregador ----------------------------- */

export const catEmployerDocTypes = ["CNPJ", "CEI", "CPF"] as const;

export const catUfs = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

/* -------------------------- Trabalhador ----------------------------- */

export const catSexes = ["Masculino", "Feminino", "Não informado"] as const;

export const catMaritalStatuses = [
  "Solteiro(a)",
  "Casado(a)",
  "Divorciado(a)",
  "Viúvo(a)",
  "União estável",
  "Não informado",
] as const;

/** CBOs mais comuns em ambiente industrial — o campo aceita qualquer código. */
export const catCboSuggestions = [
  { code: "7243-15", name: "Soldador" },
  { code: "7243-10", name: "Operador de máquina de solda" },
  { code: "7825-10", name: "Operador de empilhadeira" },
  { code: "9113-05", name: "Mecânico industrial" },
  { code: "9511-05", name: "Eletricista industrial" },
  { code: "8485-05", name: "Auxiliar de produção" },
  { code: "3516-05", name: "Técnico em segurança do trabalho" },
  { code: "2522-05", name: "Engenheiro de segurança do trabalho" },
];

/* ----------------------- Acidente / doença -------------------------- */

export const catAccidentTypes = [
  "Acidente típico",
  "Acidente de trajeto",
  "Doença ocupacional / profissional",
] as const;

/** Tabela de partes do corpo atingidas (referência eSocial — Tabela 24). */
export const catBodyParts = [
  { code: "01", name: "Cabeça" },
  { code: "02", name: "Crânio" },
  { code: "03", name: "Face" },
  { code: "04", name: "Olho(s)" },
  { code: "05", name: "Nariz" },
  { code: "06", name: "Boca / dentes" },
  { code: "07", name: "Ouvido(s)" },
  { code: "08", name: "Pescoço" },
  { code: "09", name: "Tronco" },
  { code: "10", name: "Tórax" },
  { code: "11", name: "Abdômen" },
  { code: "12", name: "Coluna vertebral" },
  { code: "13", name: "Pelve / quadril" },
  { code: "14", name: "Braço / antebraço" },
  { code: "15", name: "Mão" },
  { code: "16", name: "Dedo(s) da mão" },
  { code: "17", name: "Perna / coxa / joelho" },
  { code: "18", name: "Pé / tornozelo" },
  { code: "19", name: "Dedo(s) do pé" },
  { code: "20", name: "Corpo inteiro / múltiplas partes" },
  { code: "21", name: "Não informado" },
];

/** Agentes causadores agrupados (referência eSocial — Tabela 24). */
export const catCausalAgents = [
  { code: "01", name: "Máquina ou equipamento" },
  { code: "02", name: "Ferramenta manual" },
  { code: "03", name: "Veículo / meio de transporte" },
  { code: "04", name: "Produto ou agente químico" },
  { code: "05", name: "Agente biológico" },
  { code: "06", name: "Agente físico (ruído, calor, vibração)" },
  { code: "07", name: "Piso, escada, estrutura ou superfície" },
  { code: "08", name: "Queda de objeto / material" },
  { code: "09", name: "Queda de altura" },
  { code: "10", name: "Incêndio, explosão ou eletricidade" },
  { code: "11", name: "Animal" },
  { code: "12", name: "Agressão, violência ou assédio" },
  { code: "13", name: "Ergonômico (esforço, postura, repetição)" },
  { code: "14", name: "Outro agente não classificado" },
];

/** CID-10 — sugestões frequentes; o campo aceita qualquer código. */
export const catCidSuggestions = [
  { code: "S62.6", name: "Fratura de outros dedos da mão" },
  { code: "S61.0", name: "Ferimento de dedo(s) sem dano à unha" },
  { code: "S52.5", name: "Fratura da extremidade distal do rádio" },
  { code: "S93.4", name: "Entorse e distensão do tornozelo" },
  { code: "S82.6", name: "Fratura do maléolo lateral" },
  { code: "M54.5", name: "Dor lombar baixa" },
  { code: "M75.1", name: "Síndrome do manguito rotador" },
  { code: "H83.3", name: "Efeitos do ruído sobre o ouvido interno (PAIR)" },
  { code: "J45", name: "Asma" },
  { code: "L23.9", name: "Dermatite alérgica de causa não especificada" },
  { code: "T14.9", name: "Traumatismo não especificado" },
];

/* ------------------- Atendimento e consequências -------------------- */

export const catYesNo = ["Sim", "Não"] as const;

export const catConsequences = [
  "Afastamento temporário (incapacidade temporária)",
  "Incapacidade permanente (parcial ou total)",
  "Óbito",
  "Sem afastamento",
] as const;

/* ----------------------- Roteiro legal ------------------------------ */

/** Conferência obrigatória da CAT — Lei 8.213/91, art. 22 e eSocial S-2210. */
export const catChecklistTemplates: ChecklistTemplate[] = [
  { label: "CAT emitida até o 1º dia útil seguinte ao acidente", ref: "Lei 8.213/91, art. 22" },
  { label: "Em caso de morte, CAT emitida imediatamente à autoridade", ref: "Lei 8.213/91, art. 22" },
  { label: "Recibo de entrega da CAT gerado e entregue ao trabalhador", ref: "Lei 8.213/91, art. 22, §2º" },
  { label: "Recibo também entregue ao sindicato da categoria", ref: "Lei 8.213/91, art. 22, §2º" },
  { label: "Evento S-2210 transmitido ao eSocial com o mesmo conteúdo", ref: "eSocial — S-2210" },
  { label: "Dados do empregador conferidos (CNPJ, CNAE e endereço)", ref: "CAT — EMPREGADOR" },
  { label: "Dados do trabalhador conferidos (CPF, NIT/PIS e matrícula)", ref: "CAT — TRABALHADOR" },
  { label: "CID informado conforme atestado médico", ref: "CAT — ATENDIMENTO" },
  { label: "Último dia trabalhado registrado quando houver afastamento", ref: "CAT — AFASTAMENTO" },
  { label: "Boletim de ocorrência anexado quando houve registro policial", ref: "CAT — ACIDENTE" },
  { label: "Cópia arquivada no prontuário e na pasta do colaborador", ref: "NR-7" },
  { label: "CIPA e SESMT notificados para investigação do evento", ref: "NR-5 / NR-1" },
];

/* ---------------------- Numeração automática ------------------------ */

/**
 * Converte data no padrão do cadastro do colaborador (dd/mm/aaaa) para o
 * formato do input date (aaaa-mm-dd). Devolve vazio quando não reconhece.
 */
export function toIsoFromBr(value: string): string {
  const match = (value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Separa "São Bernardo do Campo/SP" em cidade e UF. */
export function splitCityUf(value: string): { city: string; uf: string } {
  const [city, uf] = (value || "").split("/");
  return { city: (city || "").trim(), uf: (uf || "").trim().toUpperCase() };
}

/** Remove tudo que não for dígito (para validação de CPF/CEP). */
export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}


/**
 * Gera o próximo número de controle interno da CAT no formato
 * `CAT-2026-0001`, sequencial por ano e estável depois de salvo.
 */
export function buildCatProtocol(records: StructuredRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `CAT-${year}-`;
  let max = 0;
  records.forEach((record) => {
    if (record.kind !== "cat") return;
    const protocol = (record.payload as Partial<CatPayload>).protocol ?? "";
    if (!protocol.startsWith(prefix)) return;
    const seq = Number(protocol.slice(prefix.length));
    if (Number.isFinite(seq) && seq > max) max = seq;
  });
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}