import type { AppModule } from "@/core/modules/types";

/** Assinatura eletrônica: documentos para assinar, documentos assinados e políticas. */
const assinaturas: AppModule = {
  id: "assinaturas",
  routes: [
    { path: "assinaturas", load: () => import("./page") },
    { path: "documentos-assinados", load: () => import("../assinados/page") },
    { path: "politicas", load: () => import("../politicas/page") },
  ],
  nav: [
    { id: "assinaturas", label: "Assinaturas", icon: "ri-file-shield-2-line", role: "admin", section: "Operação", order: 50 },
    { id: "politicas", label: "Políticas de assinatura", icon: "ri-shield-keyhole-line", role: "admin", section: "Conformidade", order: 30 },
    { id: "assinaturas", label: "Assinaturas", icon: "ri-file-shield-2-line", role: "colaborador", section: "Meu espaço", order: 30 },
    { id: "assinaturas", label: "Assinaturas", icon: "ri-file-shield-2-line", role: "super", section: "Dados", order: 50 },
    { id: "politicas", label: "Políticas de assinatura", icon: "ri-shield-keyhole-line", role: "super", section: "Dados", order: 60 },
  ],
  screens: [
    { navId: "assinaturas", permission: "tenant.signature", roles: ["admin", "colaborador"] },
    { navId: "politicas", permission: "tenant.settings", roles: ["admin"] },
  ],
  toggle: {
    key: "assinaturas",
    name: "Assinaturas",
    description: "Assinaturas eletrônicas, documentos assinados e políticas de assinatura.",
    icon: "ri-file-shield-2-line",
    order: 50,
  },
};

export default assinaturas;
