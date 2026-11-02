/**
 * Termo jurídico de ciência e concordância da votação eletrônica da CIPA.
 *
 * O eleitor precisa ler e aceitar este termo antes de acessar a urna. O aceite
 * é registrado no servidor (versão, data/hora e identificação do eleitor) e não
 * guarda qualquer vínculo com a cédula — preservando o sigilo do voto.
 *
 * IMPORTANTE (adequação legal): o texto é uma minuta de apoio e deve ser
 * validado pelo jurídico/empresa antes do uso real. O sistema não substitui a
 * revisão jurídica do processo eleitoral previsto na NR-5.
 */

export interface VoteTerm {
  version: string;
  title: string;
  intro: string;
  paragraphs: string[];
  footer: string;
}

export const VOTE_TERM_VERSION = "cipa-votacao-v1-2026";

export const voteTerm: VoteTerm = {
  version: VOTE_TERM_VERSION,
  title: "Termo de Ciência e Concordância — Votação Eletrônica da CIPA",
  intro:
    "Ao se identificar e admitir este termo, você declara, para todos os fins, que leu, compreendeu e concordou com as condições abaixo, relativas à votação eletrônica da Comissão Interna de Prevenção de Acidentes e de Assédio (CIPA), conduzida nos termos da Norma Regulamentadora NR-5 e da legislação aplicável.",
  paragraphs: [
    "1. Identificação. Declaro ser empregado(a) da empresa, no pleno gozo dos meus direitos trabalhistas, e que os dados informados (CPF) são verdadeiros, correspondendo à minha pessoa. A votação é pessoal e intransferível.",
    "2. Sigilo do voto. Estou ciente de que o voto é SECRETO e CONFIDENCIAL. O sistema registra apenas a minha participação (para quórum e relatório de ausências), sem jamais vincular a minha identidade ao candidato ou à opção escolhida. Não é possível, nem pela empresa nem por terceiros, saber em quem cada eleitor votou.",
    "3. Um voto por eleitor. Poderei votar uma única vez. O sistema impede votos duplicados pelo mesmo CPF. Votar em nome de outra pessoa, ou tentar burlar o processo, sujeita o infrator às penalidades previstas na legislação e nas normas internas da empresa.",
    "4. Janela de votação. Meu voto é válido somente dentro do período de votação divulgado (data, hora de início e hora de encerramento). Após o encerramento do prazo, não serão aceitos votos.",
    "5. Tratamento de dados (LGPD). Autorizo o uso do meu CPF exclusivamente para (a) validar minha elegibilidade como votante e (b) impedir a duplicidade de votos, e autorizo o registro da minha participação para fins de quórum e relatório de comparecimento. Esses dados são tratados de forma separada e não correlacionável ao conteúdo do meu voto, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
    "6. Veracidade e responsabilidade. Assumo total responsabilidade pela veracidade das informações e pela minha identificação no ato da votação. A identificação fraudulenta pode acarretar a anulação do voto e as medidas administrativas e legais cabíveis.",
    "7. Aceite. Ao marcar a opção de concordância e prosseguir, declaro que tenho plena ciência dos trâmites do processo eleitoral e que concordo integralmente com ele, habilitando-me a registrar o meu voto.",
  ],
  footer:
    "Este aceite é registrado eletronicamente com a versão do termo, a data/hora e a identificação do eleitor, formando a trilha de auditoria do processo eleitoral, sem qualquer vínculo com a cédula de votação.",
};