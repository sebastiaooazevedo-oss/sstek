import type { AppModule } from "@/core/modules/types";

const sentimento: AppModule = {
  id: "sentimento",
  routes: [{ path: "sentimento", load: () => import("./page") }],
  nav: [
    { id: "sentimento", label: "Sentimento da equipe", icon: "ri-emotion-line", role: "admin", section: "Conformidade", order: 40 },
    { id: "sentimento", label: "Sentimento da equipe", icon: "ri-emotion-line", role: "super", section: "Dados", order: 70 },
  ],
  screens: [{ navId: "sentimento", permission: "tenant.mood", roles: ["admin"] }],
  toggle: {
    key: "sentimento",
    name: "Sentimento da equipe",
    description: "Pesquisa diária de humor da equipe, tendências e alertas de bem-estar.",
    icon: "ri-emotion-line",
    order: 60,
  },
};

export default sentimento;
