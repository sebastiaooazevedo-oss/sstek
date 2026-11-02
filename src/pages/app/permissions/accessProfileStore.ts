import { supabase } from "@/lib/supabase";
import { normalizePermissions } from "@/pages/app/permissions/permissionCatalog";

/**
 * Perfis de acesso da empresa (tenant).
 *
 * Diferente da matriz global da plataforma, cada linha aqui pertence a UMA
 * empresa. As políticas de RLS garantem que só o administrador daquela empresa
 * cria, edita ou exclui perfis — e nada vaza para outro subdomínio.
 */
export interface CompanyAccessProfile {
  id: string;
  company_id: string;
  name: string;
  description: string;
  icon: string;
  permissions: Record<string, boolean>;
  is_system: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyAccessMember {
  profile_id: string;
  access_profile_id: string;
}

/** Usuário de acesso (registro em `profiles`) que pode receber um perfil. */
export interface AccessCandidate {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  is_primary_admin: boolean;
  auth_user_id: string | null;
}

interface ProfileRow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  permissions: unknown;
  is_system: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): CompanyAccessProfile {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    description: row.description ?? "",
    icon: row.icon || "ri-user-line",
    permissions: normalizePermissions(row.permissions),
    is_system: row.is_system,
    is_locked: row.is_locked,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface AccessProfileInput {
  name: string;
  description: string;
  icon: string;
  permissions: Record<string, boolean>;
}

export async function listCompanyAccessProfiles(companyId: string): Promise<CompanyAccessProfile[]> {
  const { data, error } = await supabase
    .from("company_access_profiles")
    .select("id, company_id, name, description, icon, permissions, is_system, is_locked, created_at, updated_at")
    .eq("company_id", companyId)
    .order("is_locked", { ascending: false })
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProfileRow[]).map(toProfile);
}

export async function createCompanyAccessProfile(
  companyId: string,
  input: AccessProfileInput
): Promise<CompanyAccessProfile> {
  const { data, error } = await supabase
    .from("company_access_profiles")
    .insert({
      company_id: companyId,
      name: input.name.trim(),
      description: input.description.trim(),
      icon: input.icon,
      permissions: input.permissions,
    })
    .select("id, company_id, name, description, icon, permissions, is_system, is_locked, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return toProfile(data as ProfileRow);
}

export async function updateCompanyAccessProfile(
  profileId: string,
  input: AccessProfileInput
): Promise<CompanyAccessProfile> {
  const { data, error } = await supabase
    .from("company_access_profiles")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      icon: input.icon,
      permissions: input.permissions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("id, company_id, name, description, icon, permissions, is_system, is_locked, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return toProfile(data as ProfileRow);
}

export async function updateCompanyAccessProfilePermissions(
  profileId: string,
  permissions: Record<string, boolean>
): Promise<void> {
  const { error } = await supabase
    .from("company_access_profiles")
    .update({ permissions, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function deleteCompanyAccessProfile(profileId: string): Promise<void> {
  const { error } = await supabase.from("company_access_profiles").delete().eq("id", profileId);
  if (error) throw new Error(error.message);
}

export async function listCompanyAccessMembers(companyId: string): Promise<CompanyAccessMember[]> {
  const { data, error } = await supabase
    .from("company_access_members")
    .select("profile_id, access_profile_id")
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyAccessMember[];
}

export async function listAccessCandidates(companyId: string): Promise<AccessCandidate[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, status, is_primary_admin, auth_user_id")
    .eq("company_id", companyId)
    .order("is_primary_admin", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AccessCandidate[];
}

/** Cria, troca ou remove (quando `accessProfileId` é nulo) o perfil de um usuário. */
export async function setMemberAccessProfile(
  companyId: string,
  profileId: string,
  accessProfileId: string | null
): Promise<void> {
  if (!accessProfileId) {
    const { error } = await supabase.from("company_access_members").delete().eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("company_access_members").upsert(
    {
      company_id: companyId,
      profile_id: profileId,
      access_profile_id: accessProfileId,
    },
    { onConflict: "profile_id" }
  );
  if (error) throw new Error(error.message);
}