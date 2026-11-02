import type { AppModule } from "@/core/modules/types";

/** Regulamento Interno com leitura obrigatória e ciência assinada. Núcleo. */
const regulamento: AppModule = {
  id: "regulamento",
  routes: [{ path: "regulamento", load: () => import("./page") }],
  nav: [
    { id: "regulamento", label: "Regulamento Interno", icon: "ri-book-read-line", role: "admin", section: "Conformidade", order: 20 },
    { id: "regulamento", label: "Regulamento Interno", icon: "ri-book-read-line", role: "colaborador", section: "Meu espaço", order: 50 },
    { id: "regulamento", label: "Regulamento Interno", icon: "ri-book-read-line", role: "super", section: "Dados", order: 30 },
  ],
};

export default regulamento;
