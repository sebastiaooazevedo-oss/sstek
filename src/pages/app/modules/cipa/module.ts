import type { AppModule } from "@/core/modules/types";

const cipa: AppModule = {
  id: "cipa",
  routes: [{ path: "cipa", load: () => import("./page") }],
  nav: [
    { id: "cipa", label: "CIPA", icon: "ri-government-line", role: "admin", section: "Conformidade", order: 10 },
    { id: "cipa", label: "CIPA", icon: "ri-government-line", role: "super", section: "Dados", order: 40 },
  ],
  screens: [{ navId: "cipa", permission: "tenant.cipa", roles: ["admin"] }],
  toggle: {
    key: "cipa",
    name: "CIPA",
    description:
      "Comissão Interna de Prevenção de Acidentes: eleições, atas, dossiês, inspeções de campo e ações corretivas.",
    icon: "ri-government-line",
    order: 10,
  },
};

export default cipa;
