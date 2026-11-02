import type { AppModule } from "@/core/modules/types";

/** Página inicial do app (dashboard de cada perfil). Núcleo: sempre ativa. */
const inicio: AppModule = {
  id: "inicio",
  routes: [{ path: "", load: () => import("./page") }],
  nav: [
    { id: "dashboard", label: "Visão geral", icon: "ri-dashboard-3-line", role: "super", section: "Plataforma", order: 10 },
    { id: "dashboard", label: "Dashboard", icon: "ri-dashboard-3-line", role: "admin", section: "Operação", order: 10 },
    { id: "dashboard", label: "Meu painel", icon: "ri-dashboard-3-line", role: "colaborador", section: "Meu espaço", order: 10 },
  ],
};

export default inicio;
