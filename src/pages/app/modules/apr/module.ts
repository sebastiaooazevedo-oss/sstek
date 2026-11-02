import type { AppModule } from "@/core/modules/types";

/** APR — aberta pelo menu "Criar documento" da tela de Documentos. */
const apr: AppModule = {
  id: "apr",
  routes: [{ path: "apr", load: () => import("./page") }],
  toggle: {
    key: "apr",
    name: "APR",
    description: "Análise Preliminar de Risco por atividade, com assinatura dos colaboradores envolvidos.",
    icon: "ri-clipboard-line",
    order: 40,
  },
};

export default apr;
