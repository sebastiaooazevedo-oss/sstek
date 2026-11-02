import type { AppModule } from "@/core/modules/types";

/** Portal do colaborador: dados pessoais, documentos próprios, equipe e alertas. Núcleo. */
const portal: AppModule = {
  id: "portal",
  routes: [
    { path: "meusdados", load: () => import("./page") },
    { path: "meusdocumentos", load: () => import("../meusdocumentos/page") },
    { path: "minhaequipe", load: () => import("../minhaequipe/page") },
    { path: "alertas", load: () => import("../alertas/page") },
  ],
  nav: [
    { id: "meusdados", label: "Meus dados", icon: "ri-user-settings-line", role: "colaborador", section: "Meu espaço", order: 20 },
    { id: "meusdocumentos", label: "Meus documentos", icon: "ri-file-list-3-line", role: "colaborador", section: "Meu espaço", order: 40 },
    { id: "minhaequipe", label: "Minha equipe", icon: "ri-team-line", role: "colaborador", section: "Meu espaço", order: 70 },
    { id: "alertas", label: "Alertas", icon: "ri-notification-3-line", role: "colaborador", section: "Conta", order: 10 },
  ],
};

export default portal;
