import type { AppModule } from "@/core/modules/types";

const documentos: AppModule = {
  id: "documentos",
  routes: [
    { path: "documentos", load: () => import("./page") },
    { path: "documentos/impressao-em-lote", load: () => import("./BatchPrintConferencePage") },
    { path: "documentos/lotes", load: () => import("./BatchPrintHistoryPage") },
  ],
  nav: [
    { id: "documentos", label: "Documentos", icon: "ri-file-list-3-line", role: "admin", section: "Operação", order: 30 },
    { id: "documentos", label: "Documentos", icon: "ri-file-list-3-line", role: "super", section: "Dados", order: 20 },
  ],
  screens: [{ navId: "documentos", permission: "tenant.documents", roles: ["admin"] }],
};

export default documentos;
