import type { AppModule } from "@/core/modules/types";

/** Perfis & permissões da empresa. Núcleo. */
const perfis: AppModule = {
  id: "perfis",
  routes: [{ path: "perfis", load: () => import("./page") }],
  nav: [{ id: "perfis", label: "Perfis & permissões", icon: "ri-shield-user-line", role: "admin", section: "Gestão", order: 10 }],
  screens: [{ navId: "perfis", permission: "tenant.permissions", roles: ["admin"] }],
};

export default perfis;
