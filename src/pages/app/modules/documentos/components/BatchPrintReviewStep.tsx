import { useMemo } from "react";
import type { Collaborator } from "@/mocks/collaborators";
import type { DocumentRecord } from "@/mocks/documents";
import {
  buildBatchPlan,
  candidateDocuments,
  pickVigente,
  versionLabelFor,
  type BatchTypeSelection,
} from "@/pages/app/modules/documentos/batchPrintTypes";

interface BatchPrintReviewStepProps {
  collaborators: Collaborator[];
  documents: DocumentRecord[];
  types: BatchTypeSelection[];
  versionChoice: Record<string, string>;
  onVersionChange: (key: string, documentId: string) => void;
  /** Incluir documentos sem arquivo digital (página de registro cadastral). */
  includeMissing: boolean;
  onIncludeMissingChange: (value: boolean) => void;
}

/**
 * Passo 3 — conferência da seleção antes de gerar.
 * Mostra, por colaborador, o que foi encontrado, qual versão será usada e o
 * que está ausente. Nada é omitido em silêncio — inclusive quando o usuário
 * opta por excluir do PDF os documentos sem arquivo digital.
 */
export default function BatchPrintReviewStep({
  collaborators,
  documents,
  types,
  versionChoice,
  onVersionChange,
  includeMissing,
  onIncludeMissingChange,
}: BatchPrintReviewStepProps) {
  // Plano completo (com registros sem arquivo) para a lista continuar
  // mostrando o documento e o motivo da exclusão.
  const fullPlans = useMemo(
    () =>
      collaborators.map((collaborator) =>
        buildBatchPlan(collaborator, types, documents, versionChoice, { includeMissing: true })
      ),
    [collaborators, types, documents, versionChoice]
  );

  // Plano efetivo — é exatamente o que o gerador vai produzir.
  const effectivePlans = useMemo(
    () =>
      collaborators.map((collaborator) =>
        buildBatchPlan(collaborator, types, documents, versionChoice, { includeMissing })
      ),
    [collaborators, types, documents, versionChoice, includeMissing]
  );

  const missingCount = effectivePlans.reduce(
    (sum, plan) => sum + plan.pendencies.filter((p) => p.includes("não existe documento")).length,
    0
  );
  const noFileCount = fullPlans.reduce(
    (sum, plan) => sum + plan.items.filter((item) => item.source === "sem-arquivo").length,
    0
  );
  const totalDocs = effectivePlans.reduce((sum, plan) => sum + plan.items.length, 0);
  const excludedCount = includeMissing ? 0 : noFileCount;
  const emptyPlans = effectivePlans.filter((plan) => plan.items.length === 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-background-200 bg-background-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Colaboradores</p>
          <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{effectivePlans.length}</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
            Documentos que entram no PDF
          </p>
          <p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{totalDocs}</p>
        </div>
        <div className="rounded-lg border border-background-200 bg-background-100 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Ausentes</p>
          <p className="mt-1 font-heading text-xl font-extrabold text-accent-700">{missingCount}</p>
        </div>
      </div>

      {noFileCount > 0 && (
        <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-3.5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={!includeMissing}
              onChange={(e) => onIncludeMissingChange(!e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground-950">
                Excluir do PDF os documentos sem arquivo digital
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-foreground-500">
                Hoje esses documentos entram como <strong className="font-semibold">página de registro cadastral</strong>,
                sem o arquivo original. Marcando esta opção, {noFileCount} documento(s) saem do lote e ficam
                registrados como exclusão na conferência.
                {excludedCount > 0 && (
                  <span className="mt-1 flex items-center gap-1 font-semibold text-accent-800">
                    <i className="ri-indeterminate-circle-line"></i>
                    {excludedCount} documento(s) serão excluídos agora.
                  </span>
                )}
              </span>
            </span>
          </label>
        </div>
      )}

      {missingCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>
            {missingCount} documento(s) não existem no cadastro dos colaboradores selecionados. Eles
            <strong className="font-semibold"> não entram</strong> no PDF e estão listados abaixo.
          </span>
        </div>
      )}

      {emptyPlans.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>
            {emptyPlans.length} colaborador(es) ficaram sem nenhum documento incluível com a seleção atual
            (<strong className="font-semibold">{emptyPlans.map((plan) => plan.collaboratorName).join(", ")}</strong>).
            Esses dossiês falham na geração e podem ser tentados de novo individualmente.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {fullPlans.map((plan, planIndex) => {
          const collaborator = collaborators.find((c) => c.id === plan.collaboratorId);
          const effective = effectivePlans[planIndex];
          return (
            <div key={plan.collaboratorId} className="rounded-lg border border-background-200 bg-background-50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground-950">{plan.collaboratorName}</p>
                  <p className="truncate text-xs text-foreground-500">
                    {plan.collaboratorRole || "—"}
                    {plan.establishment ? ` · ${plan.establishment}` : ""}
                    {plan.matricula ? ` · Matrícula ${plan.matricula}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                  {effective.items.length} documento(s) no PDF
                </span>
              </div>

              <div className="px-4 py-3">
                <ol className="flex flex-col gap-2">
                  {types.map((type, index) => {
                    const item = plan.items.find((entry) => entry.typeId === type.typeId);
                    const candidates = collaborator
                      ? candidateDocuments(collaborator.id, type.typeId, documents)
                      : [];
                    const chosen = item ? candidates.find((d) => d.id === item.documentId) : undefined;
                    const vigente = pickVigente(candidates);
                    const excluded = Boolean(item && item.source === "sem-arquivo" && !includeMissing);

                    if (!item) {
                      return (
                        <li
                          key={type.typeId}
                          className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50/60 px-3 py-2.5"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-200 text-[10px] font-bold text-accent-900">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-accent-900">{type.label}</p>
                            <p className="text-[11px] text-accent-800">
                              Ausente no cadastro — não será incluído no PDF.
                            </p>
                          </div>
                          <i className="ri-close-circle-line shrink-0 text-base text-accent-700"></i>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={type.typeId}
                        className={`flex flex-wrap items-start gap-2.5 rounded-md border px-3 py-2.5 ${
                          excluded
                            ? "border-accent-300 bg-accent-50/60"
                            : "border-background-200 bg-background-50"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            excluded ? "bg-accent-200 text-accent-900" : "bg-primary-100 text-primary-700"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-semibold ${
                              excluded ? "text-accent-900" : "text-foreground-900"
                            }`}
                          >
                            {type.label}
                          </p>
                          <p className="truncate text-[11px] text-foreground-500">
                            {item.name} · Emitido em {item.issuedAt} · {item.versionLabel}
                            {item.source === "sem-arquivo" && " · sem arquivo digital"}
                          </p>
                          {excluded && (
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-accent-800">
                              <i className="ri-indeterminate-circle-line"></i>
                              Excluído do PDF (sem arquivo digital)
                            </p>
                          )}
                        </div>
                        {candidates.length > 1 && collaborator && (
                          <div className="relative shrink-0">
                            <select
                              value={chosen?.id ?? vigente?.id ?? ""}
                              onChange={(e) =>
                                onVersionChange(`${collaborator.id}:${type.typeId}`, e.target.value)
                              }
                              className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-1.5 pl-2.5 pr-8 text-[11px] text-foreground-800 outline-none focus:border-primary-400"
                              aria-label={`Versão de ${type.label} para ${plan.collaboratorName}`}
                            >
                              {candidates.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {versionLabelFor(candidate, candidates)} · {candidate.issuedAt}
                                </option>
                              ))}
                            </select>
                            <i className="ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                          </div>
                        )}
                        <i
                          className={`mt-0.5 shrink-0 text-base ${
                            excluded ? "ri-close-circle-fill text-accent-600" : "ri-checkbox-circle-fill text-primary-600"
                          }`}
                        ></i>
                      </li>
                    );
                  })}
                </ol>

                {effective.pendencies.length > 0 && (
                  <ul className="mt-2.5 flex flex-col gap-1 rounded-md border border-background-200 bg-background-100 px-3 py-2">
                    {effective.pendencies.map((pendency) => (
                      <li
                        key={pendency}
                        className="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-600"
                      >
                        <i className="ri-information-line mt-0.5 text-foreground-400"></i>
                        <span>{pendency}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}