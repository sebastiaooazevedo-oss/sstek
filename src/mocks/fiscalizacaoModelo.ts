/**
 * Modelo ilustrativo da ficha externa de verificação de SST.
 *
 * Serve só para validar o layout em homologação. Não é dado de colaborador
 * real e a tela sempre marca a ficha como "Dados ilustrativos".
 */

export const fiscalizacaoModelo = {
  empresa: {
    nome: "Metalúrgica Vega",
    enderecoWeb: "vega.sstek.com.br",
  },
  colaborador: {
    nome: "Carlos Menezes",
    funcao: "Soldador",
    setor: "Produção",
    foto:
      "/images/2bcb339db9.jpg",
    identificacao: "CM-C-001",
    cadastroAtivo: true,
    atualizadoEm: "01/11/2026",
    cpf: "***.***.305-**",
    pis: "***",
    ctps: "***",
    admissao: "***",
  },
  resumo: {
    capacitacaoPendente: 1,
    epiRevisao: 1,
    epiRegistrados: 4,
  },
  cursos: [
    {
      id: "curso-altura",
      nome: "Trabalho em altura",
      criterio: "Prazo cadastrado: 05/10/2026",
      situacao: "pendente",
    },
    {
      id: "curso-empilhadeira",
      nome: "Operação de empilhadeira",
      criterio: "Prazo cadastrado: 12/01/2027",
      situacao: "vigente",
    },
    {
      id: "curso-maquinas",
      nome: "Segurança em máquinas",
      criterio: "Comprovante não atualizado",
      situacao: "conferir",
    },
  ],
  epis: [
    {
      id: "epi-capacete",
      nome: "Capacete classe B",
      ca: "31.469",
      entrega: "12/01/2026",
      controleTroca: "12/01/2028",
      situacao: "ok",
    },
    {
      id: "epi-botina",
      nome: "Botina de segurança",
      ca: "42.185",
      entrega: "12/01/2026",
      controleTroca: "12/07/2026",
      situacao: "revisar",
    },
    {
      id: "epi-oculos",
      nome: "Óculos de proteção",
      ca: "28.774",
      entrega: "03/03/2026",
      controleTroca: "03/03/2027",
      situacao: "ok",
    },
    {
      id: "epi-luva",
      nome: "Luva de vaqueta",
      ca: "35.110",
      entrega: "15/08/2026",
      controleTroca: "15/02/2027",
      situacao: "ok",
    },
  ],
  conferenciaPresencial: true,
};