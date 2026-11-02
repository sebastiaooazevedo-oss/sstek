import type { AppModule } from "@/core/modules/types";

/** Painel global do Superadministrador (empresas, licenças, CAEPI, auditoria). */
const plataforma: AppModule = {
  id: "plataforma",
  routes: [
    { path: "empresas", load: () => import("./page") },
    { path: "plataforma", load: () => import("./page") },
    { path: "plataforma/parametrizacao", load: () => import("./pages/ParametrizacaoPage") },
    { path: "plataforma/perfis", load: () => import("./pages/PerfisPage") },
    { path: "plataforma/licencas", load: () => import("./pages/LicencasPage") },
    { path: "plataforma/pagamentos", load: () => import("./pages/PagamentosPage") },
    { path: "plataforma/importacao", load: () => import("./pages/ImportacaoPage") },
    { path: "plataforma/logs", load: () => import("./pages/LogsPage") },
  ],
  nav: [
    { id: "empresas", label: "Empresas & subdomínios", icon: "ri-building-2-line", role: "super", section: "Plataforma", order: 20 },
    { id: "plataforma", label: "Base CAEPI central", icon: "ri-database-2-line", role: "super", section: "Plataforma", order: 30 },
    { id: "plataforma/parametrizacao", label: "Parametrização por perfil", icon: "ri-equalizer-line", role: "super", section: "Plataforma", order: 40 },
    { id: "plataforma/perfis", label: "Perfis & permissões", icon: "ri-shield-user-line", role: "super", section: "Plataforma", order: 50 },
    { id: "plataforma/licencas", label: "Licenças & planos", icon: "ri-bank-card-line", role: "super", section: "Comercial", order: 10 },
    { id: "plataforma/pagamentos", label: "Pagamentos", icon: "ri-wallet-3-line", role: "super", section: "Comercial", order: 20 },
    { id: "plataforma/importacao", label: "Importar colaboradores", icon: "ri-file-upload-line", role: "super", section: "Dados", order: 10 },
    { id: "plataforma/logs", label: "Logs por empresa", icon: "ri-history-line", role: "super", section: "Dados", order: 90 },
  ],
};

export default plataforma;
