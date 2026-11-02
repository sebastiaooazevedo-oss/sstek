/**
 * Base comum dos documentos estruturados criados dentro de Documentos:
 * Investigação de Acidente, Aferições e Permissão de Trabalho.
 *
 * Aqui ficam os tipos, o catálogo de equipamentos de medição e os roteiros de
 * "checklist inteligente" — listas de verificação que mudam conforme o tipo de
 * ocorrência, o equipamento selecionado ou as atividades da permissão.
 */

export type StructuredKind = "investigacao-acidente" | "afericoes" | "permissao-trabalho" | "cat";

export const structuredKindLabel: Record<StructuredKind, string> = {
  "investigacao-acidente": "Investigação de Acidente",
  afericoes: "Aferições",
  "permissao-trabalho": "Permissão de Trabalho",
  cat: "CAT — Comunicação de Acidente de Trabalho",
};

export const structuredKindTypeId: Record<StructuredKind, string> = {
  "investigacao-acidente": "investigacao-acidente",
  afericoes: "afericoes",
  "permissao-trabalho": "permissao-trabalho",
  cat: "cat",
};

/* ------------------------------ Checklist ------------------------------ */

export type ChecklistStatus = "Não avaliado" | "Conforme" | "Não conforme" | "Não aplicável";

export const checklistStatuses: ChecklistStatus[] = [
  "Não avaliado",
  "Conforme",
  "Não conforme",
  "Não aplicável",
];

export interface ChecklistEntry {
  id: string;
  label: string;
  ref: string;
  status: ChecklistStatus;
  note: string;
}

export interface ChecklistTemplate {
  label: string;
  ref: string;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function entryFromTemplate(template: ChecklistTemplate): ChecklistEntry {
  return {
    id: uid("ck"),
    label: template.label,
    ref: template.ref,
    status: "Não avaliado",
    note: "",
  };
}

/** Cria a lista de verificação a partir de um conjunto de sugestões. */
export function checklistFromTemplates(templates: ChecklistTemplate[]): ChecklistEntry[] {
  const seen = new Set<string>();
  return templates
    .filter((t) => {
      const key = t.label.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(entryFromTemplate);
}

export function countChecklist(checklist: ChecklistEntry[]) {
  return {
    total: checklist.length,
    conforme: checklist.filter((c) => c.status === "Conforme").length,
    naoConforme: checklist.filter((c) => c.status === "Não conforme").length,
    aplicavel: checklist.filter((c) => c.status !== "Não aplicável").length,
  };
}

/* ----------------------------- Coleções ------------------------------ */

export interface PhotoItem {
  id: string;
  url: string;
  name: string;
}

export interface ActionItem {
  id: string;
  description: string;
  responsible: string;
  due: string;
  status: string;
}

export const actionStatuses = ["Pendente", "Em andamento", "Concluída"];

export interface WitnessItem {
  id: string;
  name: string;
  role: string;
}

export interface MeasurementRow {
  id: string;
  point: string;
  duration: string;
  value: string;
  unit: string;
  limit: string;
  result: string;
}

export const measurementResults = ["Aceitável", "Atenção", "Acima do limite"];

export interface RiskRow {
  id: string;
  hazard: string;
  risk: string;
  control: string;
  epi: string;
}

/* --------------------------- Imagens -------------------------------- */

/** Redimensiona/comprime a foto no navegador antes de anexar ao documento. */
export function compressImage(file: File, maxSize = 1280, quality = 0.72): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) {
        resolve(undefined);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale) || 1;
        canvas.height = Math.round(img.height * scale) || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/* --------------------------------------------------------------------- */
/* Investigação de Acidente                                              */
/* --------------------------------------------------------------------- */

export const accidentTypes = [
  "Acidente típico",
  "Acidente de trajeto",
  "Doença ocupacional",
  "Quase acidente (incidente)",
  "Dano material / avaria",
] as const;

export const accidentSeverities = [
  "Sem lesão",
  "Lesão leve (sem afastamento)",
  "Lesão com afastamento",
  "Lesão grave / incapacitante",
  "Óbito",
] as const;

export const rootCauseMethods = [
  "5 Porquês",
  "Diagrama de Ishikawa",
  "Árvore de Causas",
  "Análise de Barreiras (Bow Tie)",
  "Entrevista estruturada",
] as const;

export const accidentShifts = ["1º Turno", "2º Turno", "3º Turno", "Administrativo"];

/** Roteiro base de verificação pós-acidente (NR-1, NR-5, NR-7, NR-6). */
export const accidentChecklistTemplates: ChecklistTemplate[] = [
  { label: "Cena preservada e área isolada até a conclusão da análise", ref: "NR-1" },
  { label: "Atendimento ao acidentado registrado (ASO / pronto atendimento)", ref: "NR-7" },
  { label: "CAT emitida e evento S-2210 enviado ao eSocial", ref: "Lei 8.213/91" },
  { label: "CIPA notificada e participante da investigação", ref: "NR-5" },
  { label: "EPIs e EPCs em uso no momento do evento verificados", ref: "NR-6" },
  { label: "APR / Permissão de Trabalho existente para a atividade", ref: "NR-1" },
  { label: "Treinamentos obrigatórios válidos para a tarefa", ref: "NR-1" },
  { label: "Máquina ou equipamento bloqueado e periciado", ref: "NR-12" },
  { label: "Testemunhas identificadas e ouvidas", ref: "NR-1" },
  { label: "Jornada e horas trabalhadas no dia levantadas", ref: "NR-17" },
  { label: "Plano de ação definido com responsáveis e prazos", ref: "NR-1" },
  { label: "Afastamento, retorno previsto e acompanhamento definidos", ref: "NR-7" },
];

/* --------------------------------------------------------------------- */
/* Aferições                                                            */
/* --------------------------------------------------------------------- */

export interface EquipmentDef {
  id: string;
  name: string;
  unit: string;
  refs: string;
  /** Roteiro de verificação específico do equipamento. */
  items: ChecklistTemplate[];
}

export const equipmentCatalog: EquipmentDef[] = [
  {
    id: "decibelimetro",
    name: "Decibelímetro",
    unit: "dB(A)",
    refs: "NR-15 Anexo 1 · NR-9 · NHO-01",
    items: [
      { label: "Calibração do medidor com calibrador acústico antes e após a medição", ref: "NHO-01" },
      { label: "Ponderação A e resposta lenta selecionadas", ref: "NR-15 Anexo 1" },
      { label: "Microfone com protetor de vento e distância padronizada da fonte", ref: "NHO-01" },
      { label: "Certificado de calibração do equipamento dentro da validade", ref: "NR-9" },
      { label: "Medições em nível equivalente (Leq) no posto de trabalho", ref: "NR-15 Anexo 1" },
      { label: "Verificação da existência de ruído de impacto", ref: "NR-15 Anexo 2" },
    ],
  },
  {
    id: "dosimetro",
    name: "Dosímetro",
    unit: "dB(A) / dose (%)",
    refs: "NR-15 Anexo 1 · NHO-01",
    items: [
      { label: "Dosímetro fixado na altura do ouvido do trabalhador", ref: "NHO-01" },
      { label: "Calibração antes e após a jornada registrada", ref: "NHO-01" },
      { label: "Tempo de amostragem representativo da jornada completa", ref: "NR-15 Anexo 1" },
      { label: "Ponderação A e taxa de troca configuradas (5 dB / 3 dB)", ref: "NHO-01" },
      { label: "Registro de níveis de pico acima de 115 dB(A)", ref: "NR-15 Anexo 1" },
      { label: "Certificado de calibração válido", ref: "NR-9" },
    ],
  },
  {
    id: "luximetro",
    name: "Luxímetro",
    unit: "lx",
    refs: "NR-17 Anexo · NBR 5413",
    items: [
      { label: "Medição na altura do plano de trabalho", ref: "NR-17" },
      { label: "Célula fotossensível sem sombreamento pelo avaliador", ref: "NBR 5413" },
      { label: "Verificação de ofuscamento e reflexos na superfície", ref: "NR-17" },
      { label: "Comparação com o nível mínimo exigido para a atividade", ref: "NR-17 Anexo" },
      { label: "Registro de iluminação natural e artificial separadamente", ref: "NBR 5413" },
      { label: "Certificado de calibração válido", ref: "NR-9" },
    ],
  },
  {
    id: "anemometro",
    name: "Anemômetro",
    unit: "m/s",
    refs: "NR-15 Anexo 3 · NR-9",
    items: [
      { label: "Medição da velocidade do ar no posto de trabalho", ref: "NR-15 Anexo 3" },
      { label: "Sensor posicionado sem obstruções próximas", ref: "NR-9" },
      { label: "Registro de direção e variação da velocidade", ref: "NR-9" },
      { label: "Calibração do instrumento dentro da validade", ref: "NR-9" },
    ],
  },
  {
    id: "termometro-globo",
    name: "Termômetro de Globo (IBUTG)",
    unit: "°C / IBUTG",
    refs: "NR-15 Anexo 3 · NR-9",
    items: [
      { label: "Termômetro de bulbo úmido natural (TBN) posicionado em abrigo", ref: "NR-15 Anexo 3" },
      { label: "Termômetro de globo (TG) aguardado o tempo de estabilização (25 min)", ref: "NR-15 Anexo 3" },
      { label: "Termômetro de bulbo seco (TBS) registrado", ref: "NR-15 Anexo 3" },
      { label: "Taxa metabólica compatível com a atividade real", ref: "NR-15 Anexo 3" },
      { label: "Cálculo do IBUTG conforme ambiente com ou sem carga solar", ref: "NR-15 Anexo 3" },
      { label: "Regime de trabalho/descanso e pausas avaliados", ref: "NR-15 Anexo 3" },
    ],
  },
  {
    id: "bombas-amostragem",
    name: "Bombas de Amostragem",
    unit: "L/min",
    refs: "NR-15 Anexo 11 e 12 · FUNDACENTRO",
    items: [
      { label: "Vazão calibrada antes e após a amostragem", ref: "NR-15 Anexo 12" },
      { label: "Filtro e cassete compatíveis com o agente amostrado", ref: "FUNDACENTRO" },
      { label: "Tempo de amostragem representativo da jornada", ref: "NR-15 Anexo 12" },
      { label: "Registro de volume amostrado e condições ambientais", ref: "NR-15" },
      { label: "Cadeia de custódia e laboratório acreditado definidos", ref: "NR-9" },
    ],
  },
  {
    id: "detector-gases",
    name: "Detector de Gases",
    unit: "ppm / %LEL",
    refs: "NR-33 · NR-20",
    items: [
      { label: "Calibração com gás padrão antes do uso", ref: "NR-33" },
      { label: "Teste de resposta e alarme sonoro/visual", ref: "NR-33" },
      { label: "Monitoramento de O2, %LEL, H2S e CO", ref: "NR-33" },
      { label: "Bateria e sensor dentro da validade", ref: "NR-33" },
      { label: "Registro de maior e menor leitura do período", ref: "NR-20" },
    ],
  },
  {
    id: "vibrometro",
    name: "Vibrômetro",
    unit: "m/s²",
    refs: "NR-15 Anexo 8 · NR-9",
    items: [
      { label: "Aceleração resultante normalizada (aren) calculada", ref: "NR-15 Anexo 8" },
      { label: "Eixos X, Y e Z medidos separadamente", ref: "NR-15 Anexo 8" },
      { label: "Tempo real de exposição à vibração registrado", ref: "NR-15 Anexo 8" },
      { label: "Sistema mão-braço ou corpo inteiro corretamente selecionado", ref: "NR-15 Anexo 8" },
      { label: "Certificado de calibração válido", ref: "NR-9" },
    ],
  },
];

export const measurementNorms = [
  "NR-15 Anexo 1 — Ruído contínuo",
  "NR-15 Anexo 2 — Ruído de impacto",
  "NR-15 Anexo 3 — Calor (IBUTG)",
  "NR-15 Anexo 8 — Vibração",
  "NR-15 Anexo 11 — Agentes químicos",
  "NR-15 Anexo 12 — Poeiras minerais",
  "NR-17 Anexo — Iluminamento",
  "NR-9 — Avaliação de exposição ocupacional",
  "NR-33 — Atmosfera em espaço confinado",
];

/* --------------------------------------------------------------------- */
/* Permissão de Trabalho                                                */
/* --------------------------------------------------------------------- */

export interface WorkActivityDef {
  id: string;
  name: string;
  refs: string;
  items: ChecklistTemplate[];
}

export const workActivities: WorkActivityDef[] = [
  {
    id: "quente",
    name: "Trabalho a quente",
    refs: "NR-23 · NR-34",
    items: [
      { label: "Permissão de trabalho a quente emitida antes do início", ref: "NR-23" },
      { label: "Área livre de materiais combustíveis num raio de 11 m", ref: "NR-23" },
      { label: "Extintores e mangueiras posicionados junto ao local", ref: "NR-23" },
      { label: "Vigia de fogo designado e presente durante toda a atividade", ref: "NR-23" },
      { label: "Ventilação/exaustão de fumos instalada", ref: "NR-34" },
      { label: "EPI: avental, luvas de raspa, protetor facial e respirador", ref: "NR-6" },
    ],
  },
  {
    id: "altura",
    name: "Trabalho em altura",
    refs: "NR-35",
    items: [
      { label: "Análise de risco e permissão de trabalho emitidas", ref: "NR-35" },
      { label: "Cinto paraquedista com talabarte duplo e trava-quedas", ref: "NR-35" },
      { label: "Ponto de ancoragem com resistência mínima de 1.500 kgf", ref: "NR-35" },
      { label: "Trabalhador com treinamento NR-35 válido", ref: "NR-35" },
      { label: "Aptidão médica específica para trabalho em altura", ref: "NR-35 / NR-7" },
      { label: "Área inferior isolada e sinalizada", ref: "NR-35" },
      { label: "Plano e equipe de resgate disponíveis", ref: "NR-35" },
    ],
  },
  {
    id: "espaco-confinado",
    name: "Espaço confinado",
    refs: "NR-33",
    items: [
      { label: "Permissão de entrada e trabalho (PET) emitida", ref: "NR-33" },
      { label: "Monitoramento contínuo de atmosfera (O2, %LEL, H2S, CO)", ref: "NR-33" },
      { label: "Vigia posicionado do lado externo durante toda a atividade", ref: "NR-33" },
      { label: "Equipe treinada em NR-33 (trabalhador autorizado e vigia)", ref: "NR-33" },
      { label: "Ventilação e iluminação adequadas instaladas", ref: "NR-33" },
      { label: "Equipamentos de resgate e comunicação testados", ref: "NR-33" },
      { label: "Bloqueio de energias e substâncias executado", ref: "NR-33 / NR-10" },
    ],
  },
  {
    id: "eletricidade",
    name: "Trabalho em eletricidade",
    refs: "NR-10",
    items: [
      { label: "Desenergização e bloqueio (LOTO) executados", ref: "NR-10" },
      { label: "Teste de ausência de tensão realizado", ref: "NR-10" },
      { label: "Aterramento temporário instalado", ref: "NR-10" },
      { label: "Trabalhador com treinamento NR-10 válido", ref: "NR-10" },
      { label: "EPI dielétrico e ferramentas isoladas verificados", ref: "NR-10" },
      { label: "Área sinalizada e delimitada", ref: "NR-10" },
    ],
  },
  {
    id: "icamento",
    name: "Içamento de cargas",
    refs: "NR-11 · NR-18",
    items: [
      { label: "Plano de rigging e cálculo de carga verificados", ref: "NR-11" },
      { label: "Cabos, cintas e acessórios inspecionados", ref: "NR-11" },
      { label: "Área de exclusão delimitada sob a carga", ref: "NR-18" },
      { label: "Operador e sinalizador habilitados", ref: "NR-11" },
      { label: "Condições de vento e estabilidade do solo avaliadas", ref: "NR-18" },
    ],
  },
  {
    id: "escavacao",
    name: "Escavação",
    refs: "NR-18",
    items: [
      { label: "Escoramento ou talude com inclinação segura definido", ref: "NR-18" },
      { label: "Instalações subterrâneas identificadas e sinalizadas", ref: "NR-18" },
      { label: "Barreiras e sinalização no entorno da vala", ref: "NR-18" },
      { label: "Medição de gases antes da entrada na vala", ref: "NR-33" },
      { label: "Acesso por escada a cada 9 m de profundidade", ref: "NR-18" },
    ],
  },
  {
    id: "loto",
    name: "Bloqueio de energias (LOTO)",
    refs: "NR-10 · NR-12",
    items: [
      { label: "Todas as fontes de energia identificadas", ref: "NR-12" },
      { label: "Cadeados e etiquetas aplicados por cada interveniente", ref: "NR-12" },
      { label: "Teste de zero energia realizado", ref: "NR-10" },
      { label: "Trabalhadores informados sobre o bloqueio", ref: "NR-12" },
    ],
  },
  {
    id: "quimicos",
    name: "Substâncias químicas",
    refs: "NR-26 · NR-20",
    items: [
      { label: "FISPQ disponível e acessível no local", ref: "NR-26" },
      { label: "Ventilação/exaustão do ambiente adequada", ref: "NR-20" },
      { label: "EPI compatível com o produto químico", ref: "NR-6" },
      { label: "Kit de emergência e lava-olhos disponíveis", ref: "NR-26" },
    ],
  },
];

/** Roteiro base de liberação de qualquer permissão de trabalho. */
export const workPermitBaseTemplates: ChecklistTemplate[] = [
  { label: "Permissão de trabalho emitida e assinada antes do início", ref: "NR-1" },
  { label: "Executantes orientados sobre riscos e medidas de controle", ref: "NR-1" },
  { label: "Área isolada, sinalizada e com acesso controlado", ref: "NR-26" },
  { label: "EPIs e EPCs verificados e em uso", ref: "NR-6" },
  { label: "Ferramentas e equipamentos inspecionados", ref: "NR-12" },
  { label: "Comunicação com a operação / sala de controle estabelecida", ref: "NR-1" },
  { label: "Encerramento da permissão registrado ao final da atividade", ref: "NR-1" },
];

export const permitActivityIds = workActivities.map((a) => a.id);