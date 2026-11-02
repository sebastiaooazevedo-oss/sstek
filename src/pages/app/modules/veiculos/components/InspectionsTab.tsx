import { useMemo, useState, type ReactNode } from "react";
import {
  criticalityMeta,
  formatDateTimeBr,
  inspectionResultMeta,
  type ChecklistTemplate,
  type InspectionFinding,
  type Vehicle,
  type VehicleBlock,
  type VehicleInspection,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import {
  liberarBloqueio,
  resolverAchado,
  uploadVehicleFile,
} from "@/pages/app/modules/veiculos/vehiclesStore";

interface Props {
  vehicles: Vehicle[];
  checklists: ChecklistTemplate[];
  inspections: VehicleInspection[];
  findings: InspectionFinding[];
  blocks: VehicleBlock[];
  canInspect: boolean;
  canManageChecklists: boolean;
  canUnblock: boolean;
  onNewChecklist: () => void;
  onEditChecklist: (template: ChecklistTemplate) => void;
  onDeactivateChecklist: (template: ChecklistTemplate) => void;
  onNewInspection: (vehicleRef: string | null) => void;
  onToast: (kind: "ok" | "err", text: string) => void;
}

function SectionTitle({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className={`${icon} text-base`}></i>
        </span>
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground-950">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-foreground-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function FindingRow({
  finding,
  canInspect,
  onToast,
}: {
  finding: InspectionFinding;
  canInspect: boolean;
  onToast: (kind: "ok" | "err", text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const resolved = finding.status === "resolvido";

  const submit = async () => {
    if (text.trim().length < 10) {
      onToast("err", "Descreva a tratativa com pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    const result = await resolverAchado(finding.ref, text.trim());
    setSaving(false);
    if (!result.ok) {
      onToast("err", result.detail || result.error || "Não foi possível registrar a tratativa.");
      return;
    }
    setOpen(false);
    onToast("ok", result.detail || "Achado tratado.");
  };

  return (
    <div className="rounded-md border border-background-200 bg-background-50 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground-900">
            <span className="truncate">{finding.itemLabel}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                criticalityMeta[finding.criticality]?.className ?? criticalityMeta.media.className
              }`}
            >
              {criticalityMeta[finding.criticality]?.label ?? "Média"}
            </span>
            {finding.requiresBlock && (
              <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold text-danger-800">
                bloqueio
              </span>
            )}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                resolved ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
              }`}
            >
              {resolved ? "resolvido" : "aberto"}
            </span>
          </p>
          {finding.description && (
            <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">{finding.description}</p>
          )}
          {finding.correctiveAction && (
            <p className="mt-0.5 text-[11px] text-foreground-500">
              <strong className="font-semibold text-foreground-700">Ação corretiva:</strong>{" "}
              {finding.correctiveAction}
            </p>
          )}
          {resolved && (
            <p className="mt-1 text-[11px] text-foreground-500">
              <strong className="font-semibold text-foreground-700">Tratativa:</strong>{" "}
              {finding.resolutionNotes} · {finding.resolvedByName} · {formatDateTimeBr(finding.resolvedAt)}
            </p>
          )}
        </div>
        {!resolved && canInspect && (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-tools-line"></i>
            Registrar tratativa
          </button>
        )}
      </div>

      {open && !resolved && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 1000))}
            placeholder="Descreva a correção realizada e as evidências anexadas nos documentos do veículo"
            className="min-h-[56px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
          ></textarea>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-primary-700 disabled:opacity-60"
            >
              <i className="ri-check-line"></i>
              {saving ? "Salvando..." : "Confirmar tratativa"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockReleasePanel({
  block,
  vehicle,
  canUnblock,
  onToast,
}: {
  block: VehicleBlock;
  vehicle: Vehicle | null;
  canUnblock: boolean;
  onToast: (kind: "ok" | "err", text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const attach = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    let failure = "";
    for (const file of Array.from(files).slice(0, 4)) {
      const result = await uploadVehicleFile(file);
      if (!result) {
        failure = "Falha no envio da evidência.";
        continue;
      }
      uploaded.push(result.path);
    }
    setUploading(false);
    if (uploaded.length > 0) setEvidence((prev) => [...prev, ...uploaded].slice(0, 6));
    if (failure) onToast("err", failure);
  };

  const submit = async () => {
    if (justification.trim().length < 15) {
      onToast("err", "Descreva a justificativa com pelo menos 15 caracteres.");
      return;
    }
    if (evidence.length === 0) {
      onToast("err", "Anexe pelo menos uma evidência da correção.");
      return;
    }
    setSaving(true);
    const result = await liberarBloqueio({
      blockRef: block.ref,
      justificativa: justification.trim(),
      evidencias: evidence,
    });
    setSaving(false);
    if (!result.ok) {
      onToast("err", result.detail || result.error || "Não foi possível liberar o veículo.");
      return;
    }
    setOpen(false);
    setJustification("");
    setEvidence([]);
    onToast("ok", result.detail || "Veículo liberado.");
  };

  if (block.status !== "ativo") {
    return (
      <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2 text-[11px] text-foreground-600">
        <strong className="font-semibold text-foreground-800">
          Bloqueio liberado em {formatDateTimeBr(block.releasedAt)}
        </strong>{" "}
        por {block.releasedByName || "—"}. Justificativa: {block.releaseJustification || "—"}
        {block.releaseEvidence.length > 0 && ` · ${block.releaseEvidence.length} evidência(s)`}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold text-danger-900">
            <i className="ri-lock-line"></i>
            Veículo bloqueado
            {vehicle && <span className="font-semibold text-danger-800">· {vehicle.plate}</span>}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-danger-800">{block.reason}</p>
          <p className="mt-0.5 text-[10px] text-danger-700">
            Bloqueado em {formatDateTimeBr(block.blockedAt)} por {block.blockedByName || "—"}
          </p>
        </div>
        {canUnblock && (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-danger-700 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-danger-800"
          >
            <i className="ri-lock-unlock-line"></i>
            Liberar
          </button>
        )}
      </div>

      {open && canUnblock && (
        <div className="mt-2 flex flex-col gap-2 border-t border-danger-200 pt-2">
          <textarea
            value={justification}
            onChange={(event) => setJustification(event.target.value.slice(0, 1000))}
            placeholder="Justificativa da liberação (obrigatória, mínimo 15 caracteres)"
            className="min-h-[56px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
          ></textarea>
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={`evidence-${block.ref}`}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-attachment-2"></i>
              Anexar evidência
            </label>
            <input
              id={`evidence-${block.ref}`}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(event) => {
                void attach(event.target.files);
                event.target.value = "";
              }}
            />
            {uploading && (
              <span className="flex items-center gap-1 text-[11px] text-foreground-600">
                <i className="ri-loader-4-line animate-spin"></i> Enviando...
              </span>
            )}
            <span className="text-[11px] font-medium text-foreground-600">
              {evidence.length} evidência(s)
            </span>
            <span className="text-[10px] text-foreground-500">
              Achados críticos precisam estar resolvidos antes da liberação.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-danger-700 px-3 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-danger-800 disabled:opacity-60"
            >
              <i className="ri-check-double-line"></i>
              {saving ? "Liberando..." : "Confirmar liberação"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InspectionsTab({
  vehicles,
  checklists,
  inspections,
  findings,
  blocks,
  canInspect,
  canManageChecklists,
  canUnblock,
  onNewChecklist,
  onEditChecklist,
  onDeactivateChecklist,
  onNewInspection,
  onToast,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"todas" | "bloqueadas" | "com_achado">("todas");

  const currentTemplates = useMemo(() => checklists.filter((item) => item.isCurrent), [checklists]);

  const filteredInspections = useMemo(() => {
    if (statusFilter === "bloqueadas") return inspections.filter((item) => item.blocked);
    if (statusFilter === "com_achado") return inspections.filter((item) => item.totalFindings > 0);
    return inspections;
  }, [inspections, statusFilter]);

  const activeBlocks = blocks.filter((block) => block.status === "ativo");
  const vehicleByRef = (ref: string) => vehicles.find((item) => item.ref === ref) ?? null;

  return (
    <div className="flex flex-col gap-5">
      {activeBlocks.length > 0 && (
        <section className="rounded-xl border border-danger-200 bg-background-50 p-4">
          <SectionTitle
            icon="ri-lock-line"
            title={`${activeBlocks.length} veículo(s) bloqueado(s) por não conformidade crítica`}
            description="A liberação exige permissão específica, justificativa e evidência. Nada é apagado: o bloqueio e a liberação ficam na auditoria."
          />
          <div className="mt-3 flex flex-col gap-2">
            {activeBlocks.map((block) => (
              <BlockReleasePanel
                key={block.ref}
                block={block}
                vehicle={vehicleByRef(block.vehicleRef)}
                canUnblock={canUnblock}
                onToast={onToast}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-background-200 bg-background-50 p-4">
        <SectionTitle
          icon="ri-clipboard-line"
          title="Modelos de checklist (versionados)"
          description="Cada modelo pertence a uma categoria. Editar cria uma versão nova; as inspeções antigas mantêm o checklist que foi realmente respondido."
          action={
            canManageChecklists ? (
              <button
                type="button"
                onClick={onNewChecklist}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-primary-700"
              >
                <i className="ri-add-line"></i>
                Novo checklist
              </button>
            ) : undefined
          }
        />

        {currentTemplates.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-600">
            Nenhum checklist criado. Sem modelo não é possível registrar inspeção.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-background-200 text-[10px] uppercase tracking-[0.12em] text-foreground-400">
                  <th className="pb-2 pr-3 font-bold">Modelo</th>
                  <th className="pb-2 pr-3 font-bold">Categoria</th>
                  <th className="pb-2 pr-3 font-bold">Versão</th>
                  <th className="pb-2 pr-3 font-bold">Itens</th>
                  <th className="pb-2 pr-3 font-bold">Bloqueiam</th>
                  <th className="pb-2 pr-3 font-bold">Situação</th>
                  <th className="pb-2 text-right font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {currentTemplates.map((template) => {
                  const blocking = template.items.filter(
                    (item) => item.requiresBlock || item.criticality === "critica"
                  ).length;
                  return (
                    <tr key={template.ref} className="border-b border-background-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="text-xs font-semibold text-foreground-900">{template.name}</p>
                        {template.notes && (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-foreground-500">{template.notes}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-foreground-600">
                        {template.category === "*" ? "Todas" : template.category}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-semibold text-foreground-700">v{template.version}</td>
                      <td className="py-2.5 pr-3 text-xs text-foreground-600">{template.items.length}</td>
                      <td className="py-2.5 pr-3 text-xs text-foreground-600">{blocking}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            template.active
                              ? "bg-primary-100 text-primary-700"
                              : "bg-background-200 text-foreground-600"
                          }`}
                        >
                          {template.active ? "Vigente" : "Desativado"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {canManageChecklists && (
                            <button
                              type="button"
                              onClick={() => onEditChecklist(template)}
                              aria-label={`Editar checklist ${template.name}`}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:bg-background-100"
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                          )}
                          {canManageChecklists && template.active && (
                            <button
                              type="button"
                              onClick={() => onDeactivateChecklist(template)}
                              aria-label={`Desativar checklist ${template.name}`}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 hover:bg-danger-50 hover:text-danger-700"
                            >
                              <i className="ri-archive-line"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-background-200 bg-background-50 p-4">
        <SectionTitle
          icon="ri-shield-check-line"
          title="Inspeções registradas"
          description="Registro com veículo, placa, hodômetro, autor, data/hora e versão do checklist. Não conformidades não podem ser excluídas."
          action={
            canInspect ? (
              <button
                type="button"
                onClick={() => onNewInspection(null)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-primary-700"
              >
                <i className="ri-add-line"></i>
                Nova inspeção
              </button>
            ) : undefined
          }
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              { id: "todas", label: "Todas" },
              { id: "com_achado", label: "Com não conformidade" },
              { id: "bloqueadas", label: "Com bloqueio" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                statusFilter === option.id
                  ? "bg-primary-600 text-background-50"
                  : "border border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredInspections.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-600">
            Nenhuma inspeção registrada com este filtro.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {filteredInspections.map((inspection) => {
              const ownFindings = findings.filter((item) => item.inspectionRef === inspection.ref);
              const meta = inspectionResultMeta[inspection.result];
              const isOpen = expanded === inspection.ref;
              return (
                <div key={inspection.ref} className="rounded-lg border border-background-200 bg-background-50">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : inspection.ref)}
                    className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground-950">
                        {inspection.plateSnapshot || "—"}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                        {inspection.blocked && (
                          <span className="rounded-full bg-danger-100 px-1.5 py-0.5 text-[10px] font-bold text-danger-800">
                            bloqueou o veículo
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-foreground-500">
                        {inspection.templateName || "Checklist"} v{inspection.templateVersion} ·{" "}
                        {formatDateTimeBr(inspection.performedAt)} · por{" "}
                        {inspection.performedByName || "—"}
                        {inspection.odometer !== null &&
                          ` · ${inspection.odometer.toLocaleString("pt-BR")} km`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-foreground-600">
                      <span>{inspection.totalFindings} achado(s)</span>
                      <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-background-200 px-3 py-3">
                      {inspection.notes && (
                        <p className="mb-2 rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-600">
                          {inspection.notes}
                        </p>
                      )}
                      <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                        {inspection.responses.map((response) => (
                          <div
                            key={response.itemKey}
                            className={`rounded-md border px-2 py-1.5 text-[10px] font-medium ${
                              response.result === "nao_conforme"
                                ? "border-danger-200 bg-danger-50 text-danger-800"
                                : response.result === "nao_aplicavel"
                                  ? "border-background-300 bg-background-100 text-foreground-600"
                                  : "border-primary-200 bg-primary-50 text-primary-800"
                            }`}
                          >
                            <p className="truncate font-semibold">{response.label}</p>
                            <p className="mt-0.5">
                              {response.result === "conforme"
                                ? "conforme"
                                : response.result === "nao_conforme"
                                  ? "não conforme"
                                  : "não aplicável"}
                              {response.photoPaths.length > 0 && ` · ${response.photoPaths.length} foto(s)`}
                            </p>
                            {response.justification && (
                              <p className="mt-0.5 italic">“{response.justification}”</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {ownFindings.length === 0 ? (
                        <p className="text-[11px] text-foreground-500">Nenhum achado registrado nesta inspeção.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {ownFindings.map((finding) => (
                            <FindingRow
                              key={finding.ref}
                              finding={finding}
                              canInspect={canInspect}
                              onToast={onToast}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}