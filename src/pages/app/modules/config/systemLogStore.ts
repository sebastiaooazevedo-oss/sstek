import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Log de auditoria do sistema (Configurações da empresa, Base do CAEPI, Entregas
 * de EPI, DDS, CIPA e Assinaturas).
 *
 * Toda alteração que grava algo no banco de dados nestes módulos é registrada
 * aqui, com autor, data/hora, tipo de registro e o valor anterior/novo (quando
 * aplicável). A leitura é feita pela visão `system_audit_trail`, que junta as
 * alterações de configuração com os eventos de importação da base do CAEPI em
 * uma única linha do tempo — usada na tela de auditoria com filtros.
 */

/** Áreas (tipos de registro) exibidas no filtro da tela de auditoria. */
export type SystemLogArea =
  | "company_data"
  | "branding"
  | "epi_rules"
  | "caepi_base"
  | "epi"
  | "dds"
  | "cipa"
  | "signatures"
  | "qrcodes";

export const areaLabels: Record<string, string> = {
  company_data: "Dados da empresa",
  branding: "Identidade visual",
  epi_rules: "Regras de EPI",
  caepi_base: "Base do CAEPI",
  collaborators: "Colaboradores",
  documents: "Documentos",
  apr: "APR",
  surveys: "Pesquisas",
  epi: "Entregas de EPI",
  dds: "DDS (Diálogo Diário)",
  cipa: "CIPA",
  signatures: "Assinaturas",
  qrcodes: "QR-Codes e ficha de verificação",
  download: "Downloads e exportações",
};

/** Rótulo amigável por módulo (agrupamento amplo do registro). */
export const moduleLabels: Record<string, string> = {
  config: "Configurações",
  caepi: "Base do CAEPI",
  colaboradores: "Colaboradores",
  documentos: "Documentos",
  apr: "APR",
  pesquisas: "Pesquisas",
  epi: "Entregas de EPI",
  dds: "DDS",
  cipa: "CIPA",
  signatures: "Assinaturas",
};

/** Limite de registros ao exportar (alto o suficiente para auditoria completa). */
export const EXPORT_LIMIT = 5000;

export const actionLabels: Record<string, string> = {
  created: "Criação",
  updated: "Alteração",
  deleted: "Remoção",
  upload_started: "Envio iniciado",
  upload_failed: "Falha no envio",
  upload_cancelled: "Envio cancelado",
  activated: "Base ativada",
  backup_removed: "Backup removido",
  downloaded: "Download",
};

export interface SystemLogEntry {
  uid: string;
  module: string;
  area: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string;
  actorName: string | null;
  createdAt: string;
}

export interface SystemLogFilters {
  from: string | null;
  to: string | null;
  area: string | null;
}

export type PeriodKey = "today" | "7d" | "30d" | "custom";

/** Traduz o período escolhido (atalho ou intervalo personalizado) em datas ISO. */
export function periodRange(
  period: PeriodKey,
  startDate: string,
  endDate: string
): { from: string | null; to: string | null } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: null };
  }
  if (period === "7d") return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to: null };
  if (period === "30d") return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to: null };

  let from: string | null = null;
  let to: string | null = null;
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) from = start.toISOString();
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) to = end.toISOString();
  }
  return { from, to };
}

interface TrailRow {
  uid: string;
  module: string;
  area: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  detail: string | null;
  actor_name: string | null;
  created_at: string;
}

function mapEntry(row: TrailRow): SystemLogEntry {
  return {
    uid: row.uid,
    module: row.module,
    area: row.area,
    action: row.action,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    detail: row.detail ?? row.action,
    actorName: row.actor_name,
    createdAt: row.created_at,
  };
}

/** Carrega a linha do tempo de auditoria aplicando os filtros escolhidos. */
export async function fetchSystemLogs(filters: SystemLogFilters, limit = 300): Promise<SystemLogEntry[]> {
  let query = supabase
    .from("system_audit_trail")
    .select("uid, module, area, action, field, old_value, new_value, detail, actor_name, created_at");
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.area) query = query.eq("area", filters.area);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data as TrailRow[] | null) ?? []).map(mapEntry);
}

/** Hook reativo para a tela de auditoria (recarrega ao mudar filtros). */
export function useSystemLogs(
  filters: SystemLogFilters,
  enabled = true,
  limit = 300
): { entries: SystemLogEntry[]; loading: boolean; error: string | null; reload: () => void } {
  const { from, to, area } = filters;
  const [entries, setEntries] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchSystemLogs({ from, to, area }, limit)
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Não foi possível carregar os logs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, to, area, enabled, limit, nonce]);

  return { entries, loading, error, reload };
}

export interface AuditInput {
  module?: string;
  area?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  detail: string;
  actorId?: string | null;
  actorName?: string | null;
}

/**
 * Registra um evento de auditoria. É melhor-esforço: uma falha aqui nunca deve
 * impedir a ação principal de gravação de concluir.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await supabase.from("system_audit_logs").insert({
      module: input.module ?? "config",
      area: input.area ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entity_id: input.entityId ?? null,
      field: input.field ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      detail: input.detail,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
    });
  } catch {
    /* auditoria não pode quebrar a ação principal */
  }
}

export function formatLogDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}