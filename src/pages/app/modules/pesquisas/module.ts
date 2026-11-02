import type { AppModule } from "@/core/modules/types";

/** Pesquisas internas e (futuramente) treinamentos. */
const pesquisas: AppModule = {
  id: "pesquisas",
  routes: [
    { path: "pesquisas", load: () => import("./page") },
    // Endereço antigo de "Avaliações" — mantido como atalho para Pesquisas.
    { path: "avaliacoes", redirectTo: "/app/pesquisas" },
  ],
  nav: [
    { id: "pesquisas", label: "Pesquisas", icon: "ri-survey-line", role: "admin", section: "Conformidade", order: 50 },
    { id: "treinamentos", label: "Treinamentos", icon: "ri-award-line", role: "admin", section: "Conformidade", order: 60, soon: true },
    { id: "meustreinamentos", label: "Meus treinamentos", icon: "ri-award-line", role: "colaborador", section: "Desenvolvimento", order: 10, soon: true },
    { id: "pesquisas", label: "Pesquisas", icon: "ri-survey-line", role: "colaborador", section: "Desenvolvimento", order: 20 },
  ],
  screens: [
    { navId: "pesquisas", permission: "tenant.surveys", roles: ["admin"] },
    { navId: "treinamentos", permission: "tenant.surveys", roles: ["admin"] },
  ],
  toggle: {
    // Chave histórica: o liga/desliga deste módulo sempre se chamou "treinamentos".
    key: "treinamentos",
    name: "Treinamentos e pesquisas",
    description:
      "Treinamentos obrigatórios, certificados e pesquisas internas (formulários anônimos ou identificados).",
    icon: "ri-award-line",
    order: 90,
  },
};

export default pesquisas;
