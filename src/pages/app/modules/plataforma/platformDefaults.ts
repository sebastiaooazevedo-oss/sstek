import { systemModules } from "@/pages/app/settings/modules";

/** Chaves de perfil usadas na parametrização da plataforma. */
export type ProfileKey = "admin" | "colaborador";
export type PlatformRoleKey = "super" | ProfileKey;

export interface ProfileOptions {
  moodGate: boolean;
  allowExport: boolean;
  requireSignatureTerm: boolean;
  manageTeam: boolean;
}

export interface ProfileParameters {
  modules: Record<string, boolean>;
  options: ProfileOptions;
}

export interface PlatformParameters {
  profiles: Record<ProfileKey, ProfileParameters>;
}

export const profileMeta: Record<ProfileKey, { label: string; description: string; icon: string }> = {
  admin: {
    label: "Administrador",
    description: "Gestor da empresa contratante: operação, conformidade e configurações do tenant.",
    icon: "ri-user-star-line",
  },
  colaborador: {
    label: "Colaborador",
    description: "Trabalhador vinculado à empresa: documentos pessoais, EPI, assinaturas e pesquisas.",
    icon: "ri-user-line",
  },
};

export const profileOptionCatalog: { key: keyof ProfileOptions; label: string; description: string }[] = [
  {
    key: "moodGate",
    label: "Exigir sentimento do dia no primeiro acesso",
    description: "O registro diário bloqueia o acesso até ser respondido.",
  },
  {
    key: "allowExport",
    label: "Permitir exportação de relatórios",
    description: "Libera PDF e planilha das listas e relatórios deste perfil.",
  },
  {
    key: "requireSignatureTerm",
    label: "Exigir aceite do termo de assinatura",
    description: "A assinatura eletrônica só é liberada após o aceite do termo vigente.",
  },
  {
    key: "manageTeam",
    label: "Permitir gestão de equipe",
    description: "Exibe liderados, humor da equipe e alocação de líderes.",
  },
];

const colaboradorDisabledModules = new Set(["cipa", "dds", "qrcodes"]);

export function defaultProfileParameters(role: ProfileKey): ProfileParameters {
  const modules: Record<string, boolean> = {};
  systemModules.forEach((module) => {
    modules[module.id] = role === "admin" ? true : !colaboradorDisabledModules.has(module.id);
  });
  return {
    modules,
    options:
      role === "admin"
        ? { moodGate: true, allowExport: true, requireSignatureTerm: true, manageTeam: true }
        : { moodGate: true, allowExport: false, requireSignatureTerm: true, manageTeam: false },
  };
}

export function defaultParameters(): PlatformParameters {
  return {
    profiles: {
      admin: defaultProfileParameters("admin"),
      colaborador: defaultProfileParameters("colaborador"),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Mescla o que veio do banco com os padrões, sem quebrar quando o payload está incompleto. */
export function mergeParameters(raw: unknown): PlatformParameters {
  const base = defaultParameters();
  if (!isRecord(raw) || !isRecord(raw.profiles)) return base;
  (["admin", "colaborador"] as ProfileKey[]).forEach((role) => {
    const stored = raw.profiles?.[role];
    if (!isRecord(stored)) return;
    if (isRecord(stored.modules)) {
      Object.keys(base.profiles[role].modules).forEach((moduleId) => {
        const value = stored.modules?.[moduleId];
        if (typeof value === "boolean") base.profiles[role].modules[moduleId] = value;
      });
    }
    if (isRecord(stored.options)) {
      (Object.keys(base.profiles[role].options) as (keyof ProfileOptions)[]).forEach((key) => {
        const value = stored.options?.[key];
        if (typeof value === "boolean") base.profiles[role].options[key] = value;
      });
    }
  });
  return base;
}

/* ------------------------------------------------------------------ */
/* PERFIS & PERMISSÕES                                                 */
/* ------------------------------------------------------------------ */

export interface PermissionField {
  key: string;
  label: string;
  description: string;
  group: string;
}

export const permissionCatalog: PermissionField[] = [
  {
    key: "platform.companies",
    label: "Gerenciar empresas e subdomínios",
    description: "Cadastrar tenants, suspender e reativar empresas.",
    group: "Plataforma",
  },
  {
    key: "platform.licenses",
    label: "Gerenciar licenças e cobranças",
    description: "Editar planos, assentos e marcar faturas como pagas.",
    group: "Plataforma",
  },
  {
    key: "platform.audit",
    label: "Consultar auditoria global",
    description: "Ver acessos ao painel, IP e trilha de operações.",
    group: "Plataforma",
  },
  {
    key: "platform.settings",
    label: "Parametrizar a plataforma",
    description: "Alterar padrões por perfil e a matriz de permissões.",
    group: "Plataforma",
  },
  {
    key: "tenant.collaborators",
    label: "Gerenciar colaboradores",
    description: "Cadastrar, importar e desligar colaboradores da empresa.",
    group: "Operação",
  },
  {
    key: "tenant.documents",
    label: "Gerenciar documentos",
    description: "Enviar, organizar e excluir documentos da empresa.",
    group: "Operação",
  },
  {
    key: "tenant.epi",
    label: "Gerenciar fichas de EPI",
    description: "Registrar entregas, consultar CA e emitir termos.",
    group: "Operação",
  },
  {
    key: "tenant.vehicles",
    label: "Gerenciar veículos e frota",
    description: "Cadastro da frota, documentação veicular e exigências documentais.",
    group: "Operação",
  },
  {
    key: "vehicles.create",
    label: "Cadastrar veículos",
    description: "Incluir veículo na frota da empresa.",
    group: "Operação",
  },
  {
    key: "vehicles.edit",
    label: "Editar e inativar veículos",
    description: "Alterar cadastro, situação e hodômetro sem romper o histórico.",
    group: "Operação",
  },
  {
    key: "vehicles.documents",
    label: "Gerir documentos do veículo",
    description: "Anexar, substituir documentos (com versões) e configurar exigências.",
    group: "Operação",
  },
  {
    key: "vehicles.checklists",
    label: "Gerir checklists de inspeção",
    description: "Criar e versionar checklists por categoria, com criticidade e regra de bloqueio.",
    group: "Operação",
  },
  {
    key: "vehicles.inspections",
    label: "Realizar e tratar inspeções",
    description: "Executar inspeções de segurança e registrar a tratativa dos achados.",
    group: "Operação",
  },
  {
    key: "vehicles.unblock",
    label: "Desbloquear veículos",
    description: "Liberar veículo bloqueado por achado crítico, com justificativa e evidência.",
    group: "Operação",
  },
  {
    key: "vehicles.epc",
    label: "Vincular e movimentar EPCs",
    description: "Vincular equipamentos ao veículo, retirar e transferir sem duplicar.",
    group: "Operação",
  },
  {
    key: "vehicles.checkin",
    label: "Registrar entrega e devolução",
    description: "Check-in de entrega e devolução com dupla conferência, hodômetro e fotos.",
    group: "Operação",
  },
  {
    key: "tenant.cipa",
    label: "Gerenciar CIPA",
    description: "Comissões, eleições, atas, ações e inspeções.",
    group: "Operação",
  },
  {
    key: "tenant.surveys",
    label: "Gerenciar pesquisas",
    description: "Criar, publicar e analisar pesquisas internas.",
    group: "Operação",
  },
  {
    key: "tenant.mood",
    label: "Ver sentimento da equipe",
    description: "Acessar o humor registrado pelos colaboradores.",
    group: "Operação",
  },
  {
    key: "tenant.signature",
    label: "Assinar documentos",
    description: "Assinar termos, fichas, APRs e atas em nome próprio.",
    group: "Dados & evidências",
  },
  {
    key: "tenant.reports",
    label: "Exportar relatórios",
    description: "Gerar PDF e planilhas de todas as listas.",
    group: "Dados & evidências",
  },
  {
    key: "tenant.audit",
    label: "Consultar auditoria da empresa",
    description: "Ver a trilha de auditoria do tenant.",
    group: "Dados & evidências",
  },
  {
    key: "tenant.settings",
    label: "Configurar a empresa",
    description: "Identidade visual, políticas e módulos contratados.",
    group: "Dados & evidências",
  },
];

export type RolePermissions = Record<PlatformRoleKey, Record<string, boolean>>;

export const roleMeta: Record<PlatformRoleKey, { label: string; description: string; icon: string }> = {
  super: {
    label: "Superadministrador",
    description: "Papel de plataforma. Permissões fixas — não podem ser reduzidas pela interface.",
    icon: "ri-shield-star-line",
  },
  admin: {
    label: "Administrador",
    description: "Gestor da empresa contratante.",
    icon: "ri-user-star-line",
  },
  colaborador: {
    label: "Colaborador",
    description: "Trabalhador vinculado à empresa.",
    icon: "ri-user-line",
  },
};

export function defaultRolePermissions(): RolePermissions {
  const superPermissions: Record<string, boolean> = {};
  permissionCatalog.forEach((field) => {
    superPermissions[field.key] = true;
  });

  const adminTrue = new Set([
    "tenant.collaborators",
    "tenant.documents",
    "tenant.epi",
    "tenant.vehicles",
    "vehicles.create",
    "vehicles.edit",
    "vehicles.documents",
    "vehicles.checklists",
    "vehicles.inspections",
    "vehicles.unblock",
    "vehicles.epc",
    "vehicles.checkin",
    "tenant.cipa",
    "tenant.surveys",
    "tenant.mood",
    "tenant.reports",
    "tenant.audit",
    "tenant.settings",
  ]);
  const adminPermissions: Record<string, boolean> = {};
  permissionCatalog.forEach((field) => {
    adminPermissions[field.key] = adminTrue.has(field.key);
  });

  const colaboradorTrue = new Set(["tenant.signature"]);
  const colaboradorPermissions: Record<string, boolean> = {};
  permissionCatalog.forEach((field) => {
    colaboradorPermissions[field.key] = colaboradorTrue.has(field.key);
  });

  return { super: superPermissions, admin: adminPermissions, colaborador: colaboradorPermissions };
}

export function mergeRolePermissions(raw: unknown): RolePermissions {
  const base = defaultRolePermissions();
  if (!isRecord(raw)) return base;
  (["super", "admin", "colaborador"] as PlatformRoleKey[]).forEach((role) => {
    const stored = raw[role];
    if (!isRecord(stored)) return;
    permissionCatalog.forEach((field) => {
      const value = stored[field.key];
      if (typeof value === "boolean") base[role][field.key] = value;
    });
  });
  // O papel de plataforma é sempre integral.
  permissionCatalog.forEach((field) => {
    base.super[field.key] = true;
  });
  return base;
}