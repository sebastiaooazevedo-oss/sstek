import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Collaborator } from "@/mocks/collaborators";
import type { EpiDelivery } from "@/mocks/epi";
import { brDateToTs, findEpiByCa, normalizeCa } from "@/pages/app/modules/epi/epiUtils";

/**
 * Alerta de CA vencido em ficha de EPI ATIVA.
 *
 * Regra aplicada:
 *  - Só entram colaboradores com vínculo ativo (desligado não tem EPI em uso).
 *  - "Ficha ativa" = o equipamento que o colaborador tem em posse hoje, ou seja,
 *    a entrega mais recente de cada CA. Histórico de entregas antigas do mesmo
 *    CA não conta duas vezes.
 *  - Entregas com motivo de devolução (ex.: "Devolução de desligamento") são
 *    descartadas: o equipamento voltou e não está mais com o colaborador.
 *  - A validade do CA vem da base CAEPI importada (quando existe) e, na falta
 *    dela, do catálogo interno do sistema.
 */

export interface ExpiredCaItem {
  /** Nome do equipamento como registrado na entrega. */
  name: string;
  /** Número do CA. */
  ca: string;
  /** Validade do certificado (DD/MM/AAAA quando disponível). */
  validity: string;
  /** Dias corridos desde o vencimento (sempre positivo). */
  daysOverdue: number;
  /** Data da entrega que colocou o equipamento em uso. */
  deliveryDate: string;
}

export interface ExpiredCaRow {
  collaboratorId: string;
  name: string;
  role: string;
  area: string;
  establishment: string;
  items: ExpiredCaItem[];
  /** Maior atraso entre os itens (para ordenar do mais crítico ao menos). */
  worstDays: number;
}

function stripAccents(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isReturnReason(reason: string): boolean {
  return /devolu/i.test(stripAccents(reason));
}

/** Converte a validade do CA (aceita DD/MM/AAAA e AAAA-MM-DD) em timestamp. */
export function caValidityTime(value: string): number {
  const trimmed = (value || "").trim();
  if (!trimmed) return 0;

  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(trimmed);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])).getTime();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();

  return 0;
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Monta a lista de colaboradores com pelo menos um EPI em uso cujo CA venceu.
 * Função pura para poder ser testada e reaproveitada fora do dashboard.
 */
export function buildExpiredCaRows(
  deliveries: EpiDelivery[],
  collaborators: Collaborator[],
  validityByCa: Record<string, string> = {},
): ExpiredCaRow[] {
  const today = startOfToday();
  const rows: ExpiredCaRow[] = [];

  collaborators
    .filter((person) => String(person.status || "Ativo") !== "Desligado")
    .forEach((person) => {
      const mine = deliveries.filter(
        (delivery) =>
          delivery.collaboratorId === person.id ||
          (person.name && delivery.collaboratorName === person.name),
      );

      /** Última entrega por CA (o que está de fato em posse do colaborador). */
      const inUse = new Map<string, { name: string; ca: string; date: string; ts: number }>();

      mine.forEach((delivery) => {
        if (isReturnReason(delivery.reason)) return;
        const ts = brDateToTs(delivery.date);
        (delivery.items || []).forEach((item) => {
          const key = normalizeCa(item.ca) || stripAccents(item.name).trim().toUpperCase();
          if (!key) return;
          const current = inUse.get(key);
          if (!current || ts > current.ts) {
            inUse.set(key, { name: item.name, ca: item.ca, date: delivery.date, ts });
          }
        });
      });

      const items: ExpiredCaItem[] = [];

      inUse.forEach((entry) => {
        const catalogValidity = findEpiByCa(entry.ca)?.approvalValidity ?? "";
        const validity = (
          validityByCa[normalizeCa(entry.ca)] ||
          catalogValidity ||
          ""
        ).trim();

        const expiresAt = caValidityTime(validity);
        if (!expiresAt || expiresAt >= today) return;

        items.push({
          name: entry.name,
          ca: entry.ca,
          validity,
          daysOverdue: Math.floor((today - expiresAt) / 86400000),
          deliveryDate: entry.date,
        });
      });

      if (!items.length) return;

      items.sort((a, b) => b.daysOverdue - a.daysOverdue);

      rows.push({
        collaboratorId: person.id,
        name: person.name,
        role: person.role || "",
        area: person.area || "",
        establishment: person.establishment || "",
        items,
        worstDays: items[0].daysOverdue,
      });
    });

  return rows.sort((a, b) => b.worstDays - a.worstDays);
}

/**
 * Hook do alerta: resolve a validade dos CAs em uso na base CAEPI (uma única
 * consulta por lote) e recai no catálogo interno quando o CA não estiver lá.
 */
export function useExpiredCaAlerts(
  deliveries: EpiDelivery[],
  collaborators: Collaborator[],
): { rows: ExpiredCaRow[]; loading: boolean } {
  const [validityByCa, setValidityByCa] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const caKey = useMemo(() => {
    const set = new Set<string>();
    deliveries.forEach((delivery) => {
      (delivery.items || []).forEach((item) => {
        const normalized = normalizeCa(item.ca);
        if (normalized) set.add(normalized);
      });
    });
    return Array.from(set).sort().join(",");
  }, [deliveries]);

  useEffect(() => {
    const list = caKey ? caKey.split(",") : [];
    if (!list.length) return;

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const map: Record<string, string> = {};
      try {
        for (let index = 0; index < list.length; index += 100) {
          const chunk = list.slice(index, index + 100);
          const { data, error } = await supabase
            .from("caepi_active_catalog")
            .select("ca_normalized, validade")
            .in("ca_normalized", chunk);
          if (error) continue;
          (data ?? []).forEach((row) => {
            const record = row as { ca_normalized?: string; validade?: string };
            const key = String(record.ca_normalized || "");
            const validity = (record.validade || "").trim();
            if (key && validity) map[key] = validity;
          });
        }
      } catch {
        // Sem a base CAEPI o catálogo interno continua servindo de referência.
      }
      if (!cancelled) {
        setValidityByCa(map);
        setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [caKey]);

  const rows = useMemo(
    () => buildExpiredCaRows(deliveries, collaborators, validityByCa),
    [deliveries, collaborators, validityByCa],
  );

  return { rows, loading };
}