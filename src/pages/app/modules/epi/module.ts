import type { AppModule } from "@/core/modules/types";

/** Ficha de EPI (gestão) + Minha ficha de EPI (portal do colaborador). */
const epi: AppModule = {
  id: "epi",
  routes: [
    { path: "epi", load: () => import("./page") },
    { path: "minhaepi", load: () => import("../minhaepi/page") },
  ],
  nav: [{ id: "minhaepi", label: "Minha ficha de EPI", icon: "ri-shirt-line", role: "colaborador", section: "Meu espaço", order: 60 }],
  screens: [{ navId: "epi", permission: "tenant.epi", roles: ["admin"] }],
  toggle: {
    key: "epi",
    name: "Ficha de EPI",
    description: "Entregas de equipamentos de proteção, consulta de CA e termo de recebimento assinado.",
    icon: "ri-shirt-line",
    order: 30,
  },
};

export default epi;
