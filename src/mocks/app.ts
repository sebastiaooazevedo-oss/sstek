export type RoleId = "super" | "admin" | "colaborador";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  soon?: boolean;
  /** Subitens exibidos dentro do grupo (ex.: seções de Documentos). */
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const roleLabels: Record<RoleId, string> = {
  super: "Super Administrador",
  admin: "Administrador",
  colaborador: "Colaborador",
};

export const roleDescriptions: Record<RoleId, string> = {
  super: "Visão global da plataforma, tenants, licenças e cobrança.",
  admin: "Gestão de colaboradores, documentos, EPIs e conformidade da empresa.",
  colaborador: "Seus documentos, treinamentos, EPIs e pesquisas.",
};

export const sidebarByRole: Record<RoleId, NavSection[]> = {
  super: [
    {
      title: "Plataforma",
      items: [
        { id: "dashboard", label: "Visão geral", icon: "ri-dashboard-3-line" },
        { id: "empresas", label: "Empresas & subdomínios", icon: "ri-building-2-line" },
        { id: "plataforma", label: "Base CAEPI central", icon: "ri-database-2-line" },
        { id: "plataforma/parametrizacao", label: "Parametrização por perfil", icon: "ri-equalizer-line" },
        { id: "plataforma/perfis", label: "Perfis & permissões", icon: "ri-shield-user-line" },
      ],
    },
    {
      title: "Comercial",
      items: [
        { id: "plataforma/licencas", label: "Licenças & planos", icon: "ri-bank-card-line" },
        { id: "plataforma/pagamentos", label: "Pagamentos", icon: "ri-wallet-3-line" },
        { id: "inadimplencia", label: "Inadimplência", icon: "ri-alarm-warning-line", badge: "6" },
      ],
    },
    {
      title: "Dados",
      items: [
        { id: "plataforma/importacao", label: "Importar colaboradores", icon: "ri-file-upload-line" },
        { id: "documentos", label: "Documentos", icon: "ri-file-list-3-line" },
        { id: "regulamento", label: "Regulamento Interno", icon: "ri-book-read-line" },
        { id: "cipa", label: "CIPA", icon: "ri-government-line" },
        { id: "assinaturas", label: "Assinaturas", icon: "ri-file-shield-2-line" },
        { id: "politicas", label: "Políticas de assinatura", icon: "ri-shield-keyhole-line" },
        { id: "sentimento", label: "Sentimento da equipe", icon: "ri-emotion-line" },
        { id: "qrlogs", label: "QR-Codes & logs", icon: "ri-qr-scan-2-line" },
        { id: "plataforma/logs", label: "Logs por empresa", icon: "ri-history-line" },
      ],
    },
    {
      title: "Sistema",
      items: [{ id: "config", label: "Configurações gerais", icon: "ri-settings-3-line" }],
    },
  ],
  admin: [
    {
      title: "Operação",
      items: [
        { id: "dashboard", label: "Dashboard", icon: "ri-dashboard-3-line" },
        { id: "colaboradores", label: "Colaboradores", icon: "ri-team-line" },
        {
          id: "documentos",
          label: "Documentos",
          icon: "ri-file-list-3-line",
          badge: "17",
        },
        { id: "veiculos", label: "Veículos", icon: "ri-truck-line" },
        { id: "assinaturas", label: "Assinaturas", icon: "ri-file-shield-2-line" },
      ],
    },
    {
      title: "Conformidade",
      items: [
        { id: "cipa", label: "CIPA", icon: "ri-government-line" },
        { id: "regulamento", label: "Regulamento Interno", icon: "ri-book-read-line" },
        { id: "politicas", label: "Políticas de assinatura", icon: "ri-shield-keyhole-line" },
        { id: "sentimento", label: "Sentimento da equipe", icon: "ri-emotion-line" },
        { id: "pesquisas", label: "Pesquisas", icon: "ri-survey-line" },
        { id: "treinamentos", label: "Treinamentos", icon: "ri-award-line" },
        { id: "qrcodes", label: "QR-Codes de fiscalização", icon: "ri-qr-scan-2-line" },
      ],
    },
    {
      title: "Gestão",
      items: [
        { id: "perfis", label: "Perfis & permissões", icon: "ri-shield-user-line" },
        { id: "config", label: "Configurações da empresa", icon: "ri-settings-3-line" },
      ],
    },
  ],
  colaborador: [
    {
      title: "Meu espaço",
      items: [
        { id: "dashboard", label: "Meu painel", icon: "ri-dashboard-3-line" },
        { id: "meusdados", label: "Meus dados", icon: "ri-user-settings-line" },
        { id: "assinaturas", label: "Assinaturas", icon: "ri-file-shield-2-line" },
        { id: "meusdocumentos", label: "Meus documentos", icon: "ri-file-list-3-line" },
        { id: "regulamento", label: "Regulamento Interno", icon: "ri-book-read-line" },
        { id: "minhaepi", label: "Minha ficha de EPI", icon: "ri-shirt-line" },
        { id: "minhaequipe", label: "Minha equipe", icon: "ri-team-line" },
      ],
    },
    {
      title: "Desenvolvimento",
      items: [
        { id: "meustreinamentos", label: "Meus treinamentos", icon: "ri-award-line" },
        { id: "pesquisas", label: "Pesquisas", icon: "ri-survey-line" },
      ],
    },
    {
      title: "Conta",
      items: [{ id: "alertas", label: "Alertas", icon: "ri-notification-3-line", badge: "3" }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* SUPER ADMINISTRADOR                                                  */
/* ------------------------------------------------------------------ */

export const superKpis = [
  { id: "empresas", label: "Empresas ativas", value: "128", delta: "+4 no mês", trend: "up" as const, icon: "ri-building-2-line", tone: "primary" as const },
  { id: "mrr", label: "Receita recorrente (MRR)", value: "R$ 84.920", delta: "+6,2% no mês", trend: "up" as const, icon: "ri-line-chart-line", tone: "accent" as const },
  { id: "colaboradores", label: "Colaboradores geridos", value: "12.480", delta: "+312 no mês", trend: "up" as const, icon: "ri-team-line", tone: "secondary" as const },
  { id: "inadimplentes", label: "Empresas inadimplentes", value: "6", delta: "-2 na semana", trend: "down" as const, icon: "ri-alarm-warning-line", tone: "accent" as const },
];

export const revenueByMonth = [
  { label: "Fev", value: 58 },
  { label: "Mar", value: 62 },
  { label: "Abr", value: 66 },
  { label: "Mai", value: 69 },
  { label: "Jun", value: 74 },
  { label: "Jul", value: 78 },
  { label: "Ago", value: 82 },
  { label: "Set", value: 85 },
];

export const licenseDistribution = [
  { label: "Licença S1", value: 62, tone: "primary" as const },
  { label: "Licença S2", value: 51, tone: "accent" as const },
  { label: "Licença S3", value: 15, tone: "secondary" as const },
];

export interface Tenant {
  name: string;
  subdomain: string;
  plan: string;
  collaborators: number;
  mrr: string;
  status: "Ativo" | "Inadimplente" | "Trial";
}

export const tenants: Tenant[] = [
  { name: "Metalúrgica Vega", subdomain: "vega", plan: "S2", collaborators: 48, mrr: "R$ 449", status: "Ativo" },
  { name: "LogPrime Transportes", subdomain: "logprime", plan: "S3", collaborators: 214, mrr: "Sob consulta", status: "Ativo" },
  { name: "Construtora Horizonte", subdomain: "horizonte", plan: "S2", collaborators: 39, mrr: "R$ 449", status: "Ativo" },
  { name: "Alimentos BemViver", subdomain: "bemviver", plan: "S1", collaborators: 9, mrr: "R$ 149", status: "Inadimplente" },
  { name: "Química Andrade", subdomain: "andrade", plan: "S2", collaborators: 52, mrr: "R$ 449", status: "Ativo" },
  { name: "Usina Norte Energia", subdomain: "norteenergia", plan: "S3", collaborators: 340, mrr: "Sob consulta", status: "Inadimplente" },
];

/* ------------------------------------------------------------------ */
/* ADMINISTRADOR                                                        */
/* ------------------------------------------------------------------ */

export const adminKpis = [
  { id: "colaboradores", label: "Colaboradores ativos", value: "248", delta: "+6 no mês", trend: "up" as const, icon: "ri-team-line", tone: "primary" as const },
  { id: "emdia", label: "Documentos em dia", value: "92%", delta: "+3 pts", trend: "up" as const, icon: "ri-file-shield-2-line", tone: "secondary" as const },
  { id: "vencendo", label: "Vencendo em 30 dias", value: "17", delta: "exige atenção", trend: "up" as const, icon: "ri-timer-line", tone: "accent" as const },
  { id: "epi", label: "EPIs entregues no mês", value: "126", delta: "+18 no mês", trend: "up" as const, icon: "ri-shirt-line", tone: "primary" as const },
];

export const documentStatus = [
  { label: "Em dia", value: 412, tone: "primary" as const },
  { label: "Vencendo", value: 17, tone: "accent" as const },
  { label: "Vencidos", value: 9, tone: "secondary" as const },
];

export const collaboratorsByFunction = [
  { label: "Produção", value: 86 },
  { label: "Manutenção", value: 42 },
  { label: "Logística", value: 35 },
  { label: "Administrativo", value: 28 },
  { label: "Qualidade", value: 22 },
  { label: "SESMT", value: 12 },
];

export interface ExpiringDoc {
  id: string;
  document: string;
  collaborator: string;
  role: string;
  due: string;
  days: number;
}

export const expiringDocs: ExpiringDoc[] = [
  { id: "1", document: "ASO Periódico", collaborator: "Carlos Menezes", role: "Soldador", due: "02/10/2026", days: 3 },
  { id: "2", document: "Certificado NR-35", collaborator: "Juliana Prado", role: "Técnica de Segurança", due: "05/10/2026", days: 6 },
  { id: "3", document: "ASO Admissional", collaborator: "Diego Farias", role: "Operador de Empilhadeira", due: "09/10/2026", days: 10 },
  { id: "4", document: "Certificado NR-10", collaborator: "Roberto Lima", role: "Eletricista", due: "14/10/2026", days: 15 },
  { id: "5", document: "Atestado de Saúde Ocupacional", collaborator: "Patrícia Gomes", role: "Analista de Qualidade", due: "20/10/2026", days: 21 },
];

export interface EpiDelivery {
  id: string;
  collaborator: string;
  epi: string;
  ca: string;
  date: string;
}

export const recentEpiDeliveries: EpiDelivery[] = [
  { id: "1", collaborator: "Carlos Menezes", epi: "Capacete classe B", ca: "31.469", date: "28/09/2026 14:32" },
  { id: "2", collaborator: "Juliana Prado", epi: "Botina de segurança", ca: "42.185", date: "28/09/2026 11:05" },
  { id: "3", collaborator: "Diego Farias", epi: "Protetor auricular", ca: "9.876", date: "27/09/2026 16:48" },
  { id: "4", collaborator: "Roberto Lima", epi: "Luva isolante", ca: "38.902", date: "27/09/2026 09:20" },
];

export const climateSurvey = {
  responded: 214,
  total: 248,
  average: 8.4,
  dimensions: [
    { label: "Carga de trabalho", value: 7.2 },
    { label: "Relacionamento", value: 9.1 },
    { label: "Reconhecimento", value: 8.0 },
    { label: "Segurança", value: 9.3 },
    { label: "Liderança", value: 8.6 },
  ],
};

/* ------------------------------------------------------------------ */
/* COLABORADOR                                                          */
/* ------------------------------------------------------------------ */

export const colaboradorKpis = [
  { id: "documentos", label: "Documentos disponíveis", value: "12", delta: "todos baixáveis", trend: "up" as const, icon: "ri-file-list-3-line", tone: "primary" as const },
  { id: "vencimento", label: "Próximo vencimento", value: "21 dias", delta: "ASO Periódico", trend: "up" as const, icon: "ri-timer-line", tone: "accent" as const },
  { id: "treinamentos", label: "Treinamentos ativos", value: "3", delta: "1 vencendo", trend: "up" as const, icon: "ri-award-line", tone: "secondary" as const },
  { id: "epis", label: "EPIs em uso", value: "5", delta: "ficha assinada", trend: "up" as const, icon: "ri-shirt-line", tone: "primary" as const },
];

export interface MyDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  status: "Em dia" | "Vencendo" | "Vencido";
  size: string;
}

export const myDocuments: MyDocument[] = [
  { id: "1", name: "ASO Periódico 2026", type: "ASO", date: "18/10/2026", status: "Vencendo", size: "412 KB" },
  { id: "2", name: "Ficha de EPI nº 0291", type: "EPI", date: "—", status: "Em dia", size: "238 KB" },
  { id: "3", name: "Certificado NR-35", type: "Treinamento", date: "05/10/2026", status: "Vencendo", size: "1.1 MB" },
  { id: "4", name: "Certificado NR-18", type: "Treinamento", date: "12/03/2027", status: "Em dia", size: "980 KB" },
  { id: "5", name: "Ordem de Serviço 0044", type: "OS", date: "—", status: "Em dia", size: "156 KB" },
];

export interface MyEpi {
  id: string;
  epi: string;
  ca: string;
  delivered: string;
  validUntil: string;
  status: "Ativo" | "Vencendo" | "Vencido";
}

export const myEpis: MyEpi[] = [
  { id: "1", epi: "Capacete classe B", ca: "31.469", delivered: "12/01/2026", validUntil: "12/01/2028", status: "Ativo" },
  { id: "2", epi: "Botina de segurança", ca: "42.185", delivered: "12/01/2026", validUntil: "12/07/2026", status: "Vencido" },
  { id: "3", epi: "Óculos de proteção", ca: "28.774", delivered: "03/03/2026", validUntil: "03/03/2027", status: "Ativo" },
  { id: "4", epi: "Protetor auricular", ca: "9.876", delivered: "20/06/2026", validUntil: "20/12/2026", status: "Vencendo" },
  { id: "5", epi: "Luva de vaqueta", ca: "35.110", delivered: "15/08/2026", validUntil: "15/02/2027", status: "Ativo" },
];

export interface ColaboradorAlert {
  id: string;
  title: string;
  description: string;
  when: string;
  level: "info" | "warning" | "danger";
  icon: string;
}

export const colaboradorAlerts: ColaboradorAlert[] = [
  { id: "1", title: "Botina de segurança vencida", description: "Procure o SESMT para substituição da sua botina (CA 42.185).", when: "há 2 dias", level: "danger", icon: "ri-shirt-line" },
  { id: "2", title: "ASO Periódico a vencer", description: "Seu exame periódico vence em 21 dias. Agende com o SESMT.", when: "há 1 dia", level: "warning", icon: "ri-stethoscope-line" },
  { id: "3", title: "Pesquisa de clima pendente", description: "Você ainda não respondeu a pesquisa de clima de hoje.", when: "hoje", level: "info", icon: "ri-survey-line" },
];

export const myTrainings = [
  { id: "1", name: "NR-35 · Trabalho em Altura", load: "8h", date: "05/10/2026", status: "Vencendo" as const },
  { id: "2", name: "NR-18 · Construção Civil", load: "6h", date: "12/03/2027", status: "Ativo" as const },
  { id: "3", name: "NR-06 · Uso de EPI", load: "4h", date: "02/02/2027", status: "Ativo" as const },
];