import type { AppModule } from "@/core/modules/types";

/** DDS — aberto pelo menu "Criar documento" da tela de Documentos. */
const dds: AppModule = {
  id: "dds",
  routes: [{ path: "dds", load: () => import("./page") }],
  screens: [{ navId: "dds", permission: "tenant.dds", roles: ["admin"] }],
  toggle: {
    key: "dds",
    name: "DDS",
    description: "Diálogos Diários de Segurança, registros de participação e relatórios mensais.",
    icon: "ri-presentation-line",
    order: 20,
  },
};

export default dds;
