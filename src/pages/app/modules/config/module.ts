import type { AppModule } from "@/core/modules/types";

/** Configurações da empresa (e gerais, no perfil da plataforma). Núcleo. */
const config: AppModule = {
  id: "config",
  routes: [{ path: "config", load: () => import("./page") }],
  nav: [
    { id: "config", label: "Configurações da empresa", icon: "ri-settings-3-line", role: "admin", section: "Gestão", order: 20 },
    { id: "config", label: "Configurações gerais", icon: "ri-settings-3-line", role: "super", section: "Sistema", order: 10 },
  ],
  screens: [{ navId: "config", permission: "tenant.settings", roles: ["admin"] }],
};

export default config;
