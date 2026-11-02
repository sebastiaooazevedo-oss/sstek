import type { AppModule } from "@/core/modules/types";

const colaboradores: AppModule = {
  id: "colaboradores",
  routes: [{ path: "colaboradores", load: () => import("./page") }],
  nav: [{ id: "colaboradores", label: "Colaboradores", icon: "ri-team-line", role: "admin", section: "Operação", order: 20 }],
  screens: [{ navId: "colaboradores", permission: "tenant.collaborators", roles: ["admin"] }],
};

export default colaboradores;
