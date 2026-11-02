import type { AppModule } from "@/core/modules/types";

const qrcodes: AppModule = {
  id: "qrcodes",
  routes: [
    { path: "qrcodes", load: () => import("./page") },
    { path: "qrcodes/renovacoes", load: () => import("./RenewalAuditPage") },
    { path: "qrcodes/consultas", load: () => import("./ConsultasExternasPage") },
    { path: "qrlogs", load: () => import("../qrlogs/page") },
  ],
  nav: [
    { id: "qrcodes", label: "QR-Codes de fiscalização", icon: "ri-qr-scan-2-line", role: "admin", section: "Conformidade", order: 70 },
    { id: "qrlogs", label: "QR-Codes & logs", icon: "ri-qr-scan-2-line", role: "super", section: "Dados", order: 80 },
  ],
  screens: [
    { navId: "qrcodes", permission: "tenant.qrcodes", roles: ["admin"] },
    { navId: "qrlogs", permission: "tenant.qrcodes", roles: ["admin"] },
  ],
  toggle: {
    key: "qrcodes",
    name: "QR-Codes de fiscalização",
    description: "QR-Codes por colaborador, fichas públicas de fiscalização e histórico de leituras.",
    icon: "ri-qr-scan-2-line",
    order: 80,
  },
};

export default qrcodes;
