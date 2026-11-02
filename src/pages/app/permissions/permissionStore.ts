import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/pages/app/auth/authProvider";
import {
  mergeRolePermissions,
  type ProfileKey,
} from "@/pages/app/modules/plataforma/platformDefaults";

/**
 * Acesso efetivo do perfil logado.
 *
 * A matriz salva em `platform_settings` é lida por uma função do banco
 * (`tenant_effective_access`), que resolve o perfil a partir de `auth.uid()`.
 * O navegador nunca informa qual é o seu papel — apenas exibe o resultado.
 * Regras ausentes caem nos padrões da plataforma.
 */
export interface EffectiveAccessProfile {
  id: string;
  name: string;
}

export interface EffectiveAccess {
  role: ProfileKey | null;
  permissions: Record<string, boolean>;
  parameters: Record<string, unknown>;
  /** Perfil de acesso da empresa atribuído ao usuário (quando existe). */
  accessProfile: EffectiveAccessProfile | null;
  /** Permissões vindas do perfil da empresa (não da matriz global). */
  custom: boolean;
  /** Perfil protegido com acesso integral (Administrador da empresa). */
  fullAccess: boolean;
}

const EMPTY_ACCESS: EffectiveAccess = {
  role: null,
  permissions: {},
  parameters: {},
  accessProfile: null,
  custom: false,
  fullAccess: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function booleanMap(raw: unknown): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  if (!isRecord(raw)) return map;
  Object.entries(raw).forEach(([key, value]) => {
    if (typeof value === "boolean") map[key] = value;
  });
  return map;
}

function normalize(raw: unknown): EffectiveAccess {
  if (!isRecord(raw)) return EMPTY_ACCESS;
  const role: ProfileKey | null = raw.role === "admin" ? "admin" : raw.role === "colaborador" ? "colaborador" : null;
  if (!role) return EMPTY_ACCESS;

  const custom = raw.custom === true;
  const fullAccess = raw.fullAccess === true;
  const rawPermissions = booleanMap(raw.permissions);
  // Perfil da empresa: vale exatamente o que foi liberado (o resto bloqueia).
  // Sem perfil atribuído: continua valendo a matriz global da plataforma.
  const permissions = custom ? rawPermissions : mergeRolePermissions({ [role]: rawPermissions })[role];

  const rawProfile = isRecord(raw.accessProfile) ? raw.accessProfile : null;
  const accessProfile: EffectiveAccessProfile | null =
    rawProfile && typeof rawProfile.id === "string"
      ? { id: rawProfile.id, name: typeof rawProfile.name === "string" ? rawProfile.name : "Perfil" }
      : null;

  return {
    role,
    permissions,
    parameters: isRecord(raw.parameters) ? raw.parameters : {},
    accessProfile,
    custom,
    fullAccess,
  };
}

const cache = new Map<string, EffectiveAccess>();
const inflight = new Map<string, Promise<EffectiveAccess>>();

export async function loadEffectiveAccess(userId: string): Promise<EffectiveAccess> {
  const cached = cache.get(userId);
  if (cached) return cached;
  const pending = inflight.get(userId);
  if (pending) return pending;

  const promise = (async () => {
    const { data, error } = await supabase.rpc("tenant_effective_access");
    if (error) throw new Error(error.message);
    const payload = Array.isArray(data) ? data[0] : data;
    const access = normalize(payload);
    cache.set(userId, access);
    return access;
  })();

  inflight.set(userId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(userId);
  }
}

/** Limpa o cache (usado quando a matriz é alterada no painel global). */
export function invalidateEffectiveAccess(): void {
  cache.clear();
}

export interface EffectiveAccessState {
  loading: boolean;
  access: EffectiveAccess;
  error: string | null;
}

export function useEffectiveAccess(): EffectiveAccessState {
  const { userId } = useAuth();
  const [state, setState] = useState<EffectiveAccessState>({
    loading: Boolean(userId),
    access: EMPTY_ACCESS,
    error: null,
  });

  useEffect(() => {
    if (!userId) {
      setState({ loading: false, access: EMPTY_ACCESS, error: null });
      return;
    }
    const cached = cache.get(userId);
    if (cached) {
      setState({ loading: false, access: cached, error: null });
      return;
    }
    let active = true;
    setState({ loading: true, access: EMPTY_ACCESS, error: null });
    loadEffectiveAccess(userId)
      .then((access) => {
        if (active) setState({ loading: false, access, error: null });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({
            loading: false,
            access: EMPTY_ACCESS,
            error: err instanceof Error ? err.message : "Não foi possível carregar as permissões.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}

/**
 * Sem capacidade mapeada, a tela é liberada. Quando há capacidade, o acesso
 * exige explicitamente `true` na matriz do perfil — o padrão é bloquear.
 */
export function isPermissionGranted(access: EffectiveAccess, permission: string | null): boolean {
  if (!permission) return true;
  if (!access.role) return true;
  if (access.fullAccess) return true;
  // Perfil da empresa: só é liberado o que está explicitamente ativado.
  if (access.custom) return access.permissions[permission] === true;
  return access.permissions[permission] !== false;
}

/** Atalho para checar permissões dentro das telas e botões. */
export function usePermissions(): {
  loading: boolean;
  access: EffectiveAccess;
  error: string | null;
  can: (permission: string | null) => boolean;
} {
  const { loading, access, error } = useEffectiveAccess();
  const can = useCallback(
    (permission: string | null) => isPermissionGranted(access, permission),
    [access]
  );
  return { loading, access, error, can };
}