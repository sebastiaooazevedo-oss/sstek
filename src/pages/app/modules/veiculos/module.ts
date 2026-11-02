import type { AppModule } from "@/core/modules/types";

const veiculos: AppModule = {
  id: "veiculos",
  routes: [{ path: "veiculos", load: () => import("./page") }],
  nav: [{ id: "veiculos", label: "Veículos", icon: "ri-truck-line", role: "admin", section: "Operação", order: 40 }],
  screens: [{ navId: "veiculos", permission: "tenant.vehicles", roles: ["admin"] }],
  toggle: {
    key: "veiculos",
    name: "Veículos e frota",
    description:
      "Frota da empresa: cadastro, documentação veicular com versões, vencimentos e exigências por categoria.",
    icon: "ri-truck-line",
    order: 70,
  },
};

export default veiculos;
