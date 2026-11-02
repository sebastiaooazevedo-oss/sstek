export const platformStats = [
  { value: "+12.400", label: "Colaboradores monitorados", icon: "ri-team-line" },
  { value: "98%", label: "Documentos em dia", icon: "ri-file-shield-2-line" },
  { value: "+430", label: "Empresas ativas", icon: "ri-building-2-line" },
  { value: "24/7", label: "Fiscalização por QR-Code", icon: "ri-qr-scan-2-line" },
];

export const licensePlans = [
  {
    id: "s1",
    name: "Licença S1",
    tagline: "Para pequenas operações",
    price: "R$ 149",
    period: "/mês",
    limit: "Até 10 colaboradores",
    highlight: false,
    features: [
      "Cadastro completo de colaboradores",
      "Documentos de empresa e colaborador",
      "Ficha de EPI com aceite digital",
      "QR-Code de fiscalização",
      "Pesquisa de clima diário",
      "Dashboards essenciais",
    ],
  },
  {
    id: "s2",
    name: "Licença S2",
    tagline: "Para operações em crescimento",
    price: "R$ 449",
    period: "/mês",
    limit: "Até 50 colaboradores",
    highlight: true,
    features: [
      "Tudo da Licença S1",
      "Avaliação psicossocial (40 perguntas)",
      "Avaliações customizadas e anônimas",
      "Importação por planilha .xlsx",
      "Impressão de documentos em lote",
      "Alertas de vencimento por e-mail",
    ],
  },
  {
    id: "s3",
    name: "Licença S3",
    tagline: "Grandes operações e multiunidades",
    price: "Sob consulta",
    period: "",
    limit: "Colaboradores ilimitados",
    highlight: false,
    features: [
      "Tudo da Licença S2",
      "Subdomínios e branding por empresa",
      "Parametrização avançada por perfil",
      "Dashboards estratégicos personalizados",
      "Gerente de conta dedicado",
      "SLA e integrações sob medida",
    ],
  },
];

export const testimonials = [
  {
    name: "Marina Alves",
    role: "Coordenadora de SESMT",
    company: "Metalúrgica Vega",
    text: "O SSTEK acabou com as planilhas. Hoje eu imprimo as Ordens de Serviço por função em minutos e a fiscalização resolve tudo pelo QR-Code.",
    avatar:
      "/images/934d67bf42.jpg",
  },
  {
    name: "Rafael Souza",
    role: "Diretor de Operações",
    company: "LogPrime Transportes",
    text: "O controle de vencimento de ASO e certificados nos salvou de multas. Recebemos alerta antes de qualquer auditoria nos pegar desprevenidos.",
    avatar:
      "/images/727f732975.jpg",
  },
  {
    name: "Camila Ribeiro",
    role: "Analista de RH",
    company: "Construtora Horizonte",
    text: "A avaliação psicossocial anônima mudou nossa gestão. Conseguimos enxergar risco por função sem expor ninguém, tudo em dashboards claros.",
    avatar:
      "/images/37550eddc5.jpg",
  },
];

export const faqs = [
  {
    question: "O sistema funciona em subdomínio próprio da minha empresa?",
    answer:
      "Sim. Cada empresa contratante recebe um subdomínio exclusivo (ex.: suaempresa.sstek.com) com a sua logomarca aplicada em todo o sistema, mantendo seus dados totalmente isolados das demais empresas.",
  },
  {
    question: "Como funciona o QR-Code do colaborador?",
    answer:
      "Cada colaborador cadastrado gera um QR-Code que resume o cadastro: cursos ativos e vencidos, exames e a ficha de EPI com a validade de cada item. A cada escaneamento fica registrado um log com data, hora e dados do aparelho que realizou a leitura.",
  },
  {
    question: "A avaliação psicossocial é realmente anônima?",
    answer:
      "Sim. As respostas da avaliação psicossocial são totalmente anônimas para a gestão, apresentadas apenas de forma agregada por dimensão e por função. Outros tipos de avaliação podem ser configurados como identificados, conforme a sua necessidade.",
  },
  {
    question: "Consigo importar meus colaboradores em massa?",
    answer:
      "Pode. O Super Administrador pode subir uma planilha .xlsx com as colunas específicas que atendem ao banco de dados, criando a base de colaboradores de uma só vez.",
  },
  {
    question: "O que acontece se eu ficar inadimplente?",
    answer:
      "O SSTEK controla as mensalidades por empresa e, após o período de dias de atraso pré-configurado, o acesso é bloqueado automaticamente até a regularização do pagamento.",
  },
  {
    question: "A ficha de EPI exige foto e assinatura?",
    answer:
      "A ficha de EPI registra o CA de cada equipamento e amarra automaticamente a data e hora da finalização. A obrigatoriedade do registro por foto é parametrizada pelo Super Administrador, e o aceite é formalizado por assinatura digital do colaborador.",
  },
];