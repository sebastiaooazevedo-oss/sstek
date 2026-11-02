import { uid, type ActionItem } from "@/pages/app/modules/documentos/structured/structuredData";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";

/**
 * Plano de ação sugerido para a investigação gerada a partir da CAT.
 *
 * As medidas são típicas por **agente causador** (Tabela 24 do eSocial), com
 * responsável padrão e prazo contado a partir da data do evento. O SESMT revisa,
 * ajusta responsáveis/prazos e transforma a sugestão no plano oficial da
 * investigação — nada é tratado como ação concluída.
 */

interface MeasureTemplate {
  description: string;
  /** Área responsável padrão — o SESMT pode redefinir na investigação. */
  responsible: string;
  /** Prazo em dias corridos a partir da data do evento. */
  days: number;
}

const planByAgentCode: Record<string, MeasureTemplate[]> = {
  "01": [
    {
      description:
        "Revisar e reinstalar as proteções fixas e móveis do equipamento nos pontos de prensagem, corte e transmissão.",
      responsible: "Manutenção",
      days: 7,
    },
    {
      description:
        "Revalidar o procedimento de bloqueio e etiquetagem (LOTO) e treinar os operadores da máquina envolvida.",
      responsible: "SESMT",
      days: 15,
    },
    {
      description:
        "Avaliar a instalação de dispositivo adicional de segurança (cortina de luz, sensor de presença ou dupla comando).",
      responsible: "Engenharia de Segurança",
      days: 30,
    },
  ],
  "02": [
    {
      description: "Substituir a ferramenta manual danificada e implantar inspeção antes do uso.",
      responsible: "Ferramentaria",
      days: 5,
    },
    {
      description: "Treinar a equipe no uso correto da ferramenta e no EPI específico para a tarefa.",
      responsible: "SESMT",
      days: 10,
    },
  ],
  "03": [
    {
      description:
        "Revisar o fluxo de circulação da área: sinalização de solo, faixas de pedestre, espelhos e limite de velocidade.",
      responsible: "Logística",
      days: 10,
    },
    {
      description: "Reforçar o checklist diário do veículo e a verificação de habilitação do operador.",
      responsible: "Frota / SESMT",
      days: 7,
    },
  ],
  "04": [
    {
      description:
        "Reavaliar a exposição ao produto químico: substituição, confinamento, ventilação e exaustão do setor.",
      responsible: "Manutenção",
      days: 15,
    },
    {
      description: "Atualizar FISPQ, revisar a Ficha de EPI e treinar o manuseio seguro do produto.",
      responsible: "SESMT",
      days: 10,
    },
  ],
  "05": [
    {
      description: "Revisar o protocolo de biossegurança, a vacinação aplicável e o descarte de resíduos biológicos.",
      responsible: "SESMT",
      days: 15,
    },
    {
      description: "Reforçar a disponibilização e a higienização dos EPIs de proteção biológica do setor.",
      responsible: "SESMT",
      days: 10,
    },
  ],
  "06": [
    {
      description:
        "Refazer a avaliação quantitativa do agente físico no posto de trabalho e comparar com os limites da NR-15.",
      responsible: "SESMT",
      days: 10,
    },
    {
      description:
        "Implantar ou revisar as medidas de controle (proteção auditiva, isolamento térmico, enclausuramento, pausas).",
      responsible: "Engenharia de Segurança",
      days: 20,
    },
  ],
  "07": [
    {
      description:
        "Corrigir piso, escada ou superfície de circulação (nivelamento, material antiderrapante, corrimão) e sinalizar o local.",
      responsible: "Manutenção",
      days: 7,
    },
    {
      description: "Incluir a inspeção periódica de acessos, escadas e passarelas no plano de manutenção predial.",
      responsible: "SESMT",
      days: 15,
    },
  ],
  "08": [
    {
      description: "Revisar amarração, empilhamento e fixação de materiais e cargas suspensas na área.",
      responsible: "Logística",
      days: 5,
    },
    {
      description: "Delimitar zona de exclusão sob cargas e verificar o EPI de proteção contra queda de materiais.",
      responsible: "SESMT",
      days: 10,
    },
  ],
  "09": [
    {
      description: "Revisar ancoragem, linha de vida, guarda-corpo e plataformas de trabalho em altura do local.",
      responsible: "Manutenção",
      days: 5,
    },
    {
      description:
        "Suspender a atividade em altura até revalidar a análise de risco (NR-35), a APT e o treinamento da equipe.",
      responsible: "SESMT",
      days: 3,
    },
  ],
  "10": [
    {
      description:
        "Revisar bloqueio, aterramento e desenergização, com teste de ausência de tensão antes de qualquer intervenção.",
      responsible: "Manutenção Elétrica",
      days: 5,
    },
    {
      description: "Auditar áreas classificadas, extintores, rotas de fuga e o plano de emergência do setor.",
      responsible: "SESMT",
      days: 15,
    },
  ],
  "11": [
    {
      description: "Avaliar o controle de pragas e animais na área e reforçar as barreiras físicas de acesso.",
      responsible: "Facilities",
      days: 15,
    },
    {
      description: "Orientar os trabalhadores sobre conduta segura em caso de contato com animais.",
      responsible: "SESMT",
      days: 10,
    },
  ],
  "12": [
    {
      description: "Abrir análise dos fatores psicossociais do setor e reforçar o canal de denúncias e acolhimento.",
      responsible: "RH / SESMT",
      days: 10,
    },
    {
      description: "Aplicar medidas de mediação, apoio ao trabalhador e acompanhamento pelo SESMT.",
      responsible: "RH",
      days: 5,
    },
  ],
  "13": [
    {
      description: "Realizar análise ergonômica do trabalho (AET) no posto e ajustar mobiliário, alcances e ritmo.",
      responsible: "SESMT",
      days: 20,
    },
    {
      description: "Implantar pausas, rodízio de atividades e treinamento de postura e movimentação de cargas.",
      responsible: "RH / SESMT",
      days: 15,
    },
  ],
  "14": [
    {
      description: "Reavaliar o evento com o SESMT e definir a medida de controle específica para o agente identificado.",
      responsible: "SESMT",
      days: 10,
    },
    {
      description: "Revisar a análise de risco da atividade e atualizar o procedimento operacional envolvido.",
      responsible: "SESMT",
      days: 15,
    },
  ],
};

const fallbackPlan: MeasureTemplate[] = [
  {
    description: "Revisar a análise de risco da atividade e atualizar o procedimento operacional envolvido.",
    responsible: "SESMT",
    days: 10,
  },
  {
    description: "Verificar a adequação dos EPIs utilizados e reforçar o treinamento da equipe.",
    responsible: "SESMT",
    days: 15,
  },
];

/** Soma dias corridos a uma data ISO (yyyy-mm-dd). */
function addDays(value: string, days: number): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const iso = date.toISOString().slice(0, 10);
  return iso;
}

/**
 * Monta as ações sugeridas para o plano de ação da investigação.
 * Devolve lista vazia quando a CAT não tem agente causador identificado.
 */
export function buildCatActionPlan(cat: CatPayload): ActionItem[] {
  if (!cat.causalAgentCode) return [];
  const templates = planByAgentCode[cat.causalAgentCode] ?? fallbackPlan;
  return templates.map((template) => ({
    id: uid("acao"),
    description: template.description,
    responsible: template.responsible,
    due: addDays(cat.accidentDate, template.days),
    status: "Pendente",
  }));
}

/** Frase de apoio exibida no aviso gerado após salvar a CAT. */
export function catActionPlanSummary(cat: CatPayload): string {
  const actions = buildCatActionPlan(cat);
  if (!actions.length) return "O plano de ação será sugerido após informar o agente causador.";
  return `${actions.length} medida(s) típicas para o agente causador "${cat.causalAgent}" foram incluídas no plano de ação da investigação — revise responsáveis e prazos.`;
}