import { useMemo } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { useAtas, useCipas, useElections, useInspections } from "@/pages/app/modules/cipa/cipaStore";
import {
  useTechnicalSignatures,
  type TechnicalSignature,
  type TechnicalSignatureScope,
} from "@/pages/app/modules/cipa/technicalSignatureStore";
import { formatSignatureTimestamp } from "@/pages/app/signature/signatureDisplay";

interface TechnicalSignatureHistoryTabProps {
  cipaId: string;
}

const scopeMeta: Record<TechnicalSignatureScope, { label: string; icon: string }> = {
  "ficha-cipa": { label: "Ficha de Cadastro da CIPA", icon: "ri-government-line" },
  "inspecao-cipa": { label: "Inspeção da CIPA", icon: "ri-clipboard-line" },
  "dossie-eleicao": { label: "Dossiê do Processo Eleitoral", icon: "ri-folder-shield-2-line" },
  "ata-cipa": { label: "Ata da CIPA", icon: "ri-file-text-line" },
};

interface HistoryRow {
  id: string;
  scope: TechnicalSignatureScope;
  documentLabel: string;
  context: string;
  signerName: string;
  signedAt: string;
  signatureUid: string;
  scopeLabel: string;
  icon: string;
}

interface CommitteeGroup {
  cipaId: string;
  cipaName: string;
  unit: string;
  rows: HistoryRow[];
  lastSignedAt: string;
}

/**
 * Histórico de assinaturas técnicas por comissão.
 *
 * Mostra quem assinou como Responsável Técnico, quando e em qual documento
 * (ficha, inspeção, dossiê ou ata). É a trilha de responsabilidade técnica da
 * comissão — leitura para toda a empresa.
 */
export default function TechnicalSignatureHistoryTab({ cipaId }: TechnicalSignatureHistoryTabProps) {
  const signatures = useTechnicalSignatures();
  const cipas = useCipas();
  const inspections = useInspections();
  const elections = useElections();
  const atas = useAtas();

  const groups = useMemo<CommitteeGroup[]>(() => {
    const resolveCipaId = (signature: TechnicalSignature): string => {
      if (signature.scope === "ficha-cipa") return signature.referenceRef;
      if (signature.scope === "inspecao-cipa") {
        return inspections.find((i) => i.id === signature.referenceRef)?.cipaId || "";
      }
      if (signature.scope === "dossie-eleicao") {
        return elections.find((e) => e.id === signature.referenceRef)?.cipaId || "";
      }
      return atas.find((a) => a.id === signature.referenceRef)?.cipaId || "";
    };

    const byCommittee = new Map<string, HistoryRow[]>();

    signatures.forEach((signature) => {
      const committeeId = resolveCipaId(signature) || "sem-comissao";
      if (cipaId && committeeId !== cipaId) return;
      const meta = scopeMeta[signature.scope];
      const row: HistoryRow = {
        id: signature.id,
        scope: signature.scope,
        documentLabel: signature.referenceLabel || meta.label,
        context: meta.label,
        signerName: signature.signerName || "—",
        signedAt: signature.signedAt,
        signatureUid: signature.signatureUid,
        scopeLabel: meta.label,
        icon: meta.icon,
      };
      byCommittee.set(committeeId, [...(byCommittee.get(committeeId) ?? []), row]);
    });

    return Array.from(byCommittee.entries())
      .map(([committeeId, rows]) => {
        const cipa = cipas.find((c) => c.id === committeeId);
        const sorted = [...rows].sort(
          (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime()
        );
        return {
          cipaId: committeeId,
          cipaName: cipa?.name || "Comissão não identificada",
          unit: cipa?.unit || "",
          rows: sorted,
          lastSignedAt: sorted[0]?.signedAt || "",
        };
      })
      .sort((a, b) => new Date(b.lastSignedAt).getTime() - new Date(a.lastSignedAt).getTime());
  }, [signatures, cipas, inspections, elections, atas, cipaId]);

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const latest = groups[0]?.lastSignedAt || "";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-background-200 bg-background-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">Assinaturas registradas</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-foreground-950">{total}</p>
          <p className="mt-0.5 text-[11px] text-foreground-500">Atos do Responsável Técnico</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">Comissões com atos</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-foreground-950">{groups.length}</p>
          <p className="mt-0.5 text-[11px] text-foreground-500">Com responsabilidade técnica registrada</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-400">Última assinatura</p>
          <p className="mt-1 text-sm font-bold text-foreground-950">
            {latest ? formatSignatureTimestamp(latest) : "Nenhuma ainda"}
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-500">Data, hora e fuso do ato</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-shield-keyhole-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma assinatura técnica registrada</p>
          <p className="max-w-md text-xs text-foreground-500">
            Quando o Responsável Técnico assinar a ficha, uma inspeção ou um dossiê, o ato aparece aqui com o nome,
            a data/hora e o ID da assinatura.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <SectionCard
            key={group.cipaId}
            title={group.cipaName}
            subtitle={group.unit || "Comissão"}
            action={
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
                <i className="ri-shield-check-line"></i>
                {group.rows.length} assinatura(s)
              </span>
            }
          >
            <ul className="flex flex-col gap-3">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                    <i className={`${row.icon} text-lg`}></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground-950">{row.documentLabel}</p>
                    <p className="truncate text-xs text-foreground-500">{row.scopeLabel}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-400">
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-user-star-line"></i>
                        {row.signerName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-fingerprint-line"></i>
                        {row.signatureUid}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 rounded-md border border-background-200 bg-background-50 px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-foreground-400">Assinado em</p>
                    <p className="text-[11px] font-semibold text-foreground-800">
                      {formatSignatureTimestamp(row.signedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        ))
      )}
    </div>
  );
}