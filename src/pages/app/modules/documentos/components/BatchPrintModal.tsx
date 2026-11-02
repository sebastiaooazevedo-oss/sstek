import { useEffect, useMemo, useState } from "react";
import Modal, { ModalButton, selectClass } from "@/pages/app/components/Modal";
import { useAppSession } from "@/pages/app/context";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import { documentTypes, type DocumentRecord } from "@/mocks/documents";
import BatchPrintReviewStep from "@/pages/app/modules/documentos/components/BatchPrintReviewStep";
import {
  suggestedBatchTypes,
  type BatchTypeSelection,
} from "@/pages/app/modules/documentos/batchPrintTypes";
import {
  generateBatch,
  getBatchPrintState,
  setBatchConfig,
  useBatchPrintState,
} from "@/pages/app/modules/documentos/batchPrintStore";

interface BatchPrintModalProps {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
  documents: DocumentRecord[];
}

const collaboratorDocTypes = documentTypes.filter((type) => type.scope === "colaborador");

const steps = [
  { id: 1, label: "Colaboradores", icon: "ri-user-line" },
  { id: 2, label: "Tipos e ordem", icon: "ri-list-ordered" },
  { id: 3, label: "Conferir seleção", icon: "ri-eye-line" },
] as const;

/**
 * Impressão em Lote — seleção.
 *
 * Nenhum arquivo é enviado aqui: os documentos são buscados no cadastro de
 * cada colaborador, com a versão vigente sugerida e as ausências informadas
 * antes de gerar.
 */
export default function BatchPrintModal({ open, onClose, onGenerated, documents }: BatchPrintModalProps) {
  const session = useAppSession();
  const collaborators = useCollaboratorsList();
  const { generating, progress, error, results } = useBatchPrintState();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [types, setTypes] = useState<BatchTypeSelection[]>([]);
  const [versionChoice, setVersionChoice] = useState<Record<string, string>>({});
  const [includeMissing, setIncludeMissing] = useState(true);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("");
  const [typeSearch, setTypeSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    const config = getBatchPrintState().config;
    setCollaboratorIds(config?.collaboratorIds ?? []);
    setTypes(config?.types ?? []);
    setVersionChoice(config?.versionChoice ?? {});
    setIncludeMissing(config?.includeMissing !== false);
    setSearch("");
    setUnit("");
    setTypeSearch("");
    setStep(1);
  }, [open]);

  const filteredCollaborators = useMemo(() => {
    const term = search.trim().toLowerCase();
    return collaborators.filter((collaborator) => {
      const matchTerm =
        !term ||
        collaborator.name.toLowerCase().includes(term) ||
        collaborator.role.toLowerCase().includes(term) ||
        collaborator.matricula.toLowerCase().includes(term);
      const matchUnit = !unit || collaborator.establishment === unit;
      return matchTerm && matchUnit;
    });
  }, [collaborators, search, unit]);

  const selectedCollaborators = collaborators.filter((c) => collaboratorIds.includes(c.id));

  const toggleCollaborator = (id: string) => {
    setCollaboratorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllFiltered = () => {
    const ids = filteredCollaborators.map((c) => c.id);
    const allSelected = ids.length > 0 && ids.every((id) => collaboratorIds.includes(id));
    setCollaboratorIds((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const toggleType = (type: BatchTypeSelection) => {
    setTypes((prev) =>
      prev.some((t) => t.typeId === type.typeId) ? prev.filter((t) => t.typeId !== type.typeId) : [...prev, type]
    );
  };

  const moveType = (index: number, direction: -1 | 1) => {
    setTypes((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleGenerate = async () => {
    setBatchConfig({ collaboratorIds, types, versionChoice, includeMissing });
    const ok = await generateBatch({
      collaborators,
      documents,
      actor: session.name,
      actorEmail: session.email,
      subdomain: session.subdomain,
    });
    if (ok) onGenerated();
  };

  const filteredTypes = collaboratorDocTypes.filter((type) => {
    const term = typeSearch.trim().toLowerCase();
    return !term || type.name.toLowerCase().includes(term);
  });

  const footer =
    step === 1 ? (
      <>
        <ModalButton variant="ghost" onClick={onClose}>
          Cancelar
        </ModalButton>
        <ModalButton icon="ri-arrow-right-line" onClick={() => setStep(2)} disabled={collaboratorIds.length === 0}>
          Continuar ({collaboratorIds.length})
        </ModalButton>
      </>
    ) : step === 2 ? (
      <>
        <ModalButton variant="ghost" icon="ri-arrow-left-line" onClick={() => setStep(1)}>
          Voltar
        </ModalButton>
        <ModalButton icon="ri-arrow-right-line" onClick={() => setStep(3)} disabled={types.length === 0}>
          Conferir seleção
        </ModalButton>
      </>
    ) : (
      <>
        <ModalButton variant="ghost" icon="ri-arrow-left-line" onClick={() => setStep(2)} disabled={generating}>
          Voltar
        </ModalButton>
        <ModalButton
          icon={generating ? "ri-loader-4-line" : "ri-printer-cloud-line"}
          onClick={handleGenerate}
          disabled={generating || selectedCollaborators.length === 0 || types.length === 0}
        >
          {generating && progress
            ? `Gerando ${progress.current}/${progress.total}...`
            : `Gerar ${selectedCollaborators.length} dossiê(s)`}
        </ModalButton>
      </>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-printer-cloud-line"
      title="Impressão em lote de documentos"
      subtitle="Selecione os colaboradores e os tipos de documento. Os arquivos são buscados no cadastro de cada um — nada é enviado ou recadastrado aqui."
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {steps.map((item, index) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                    active
                      ? "bg-primary-500 text-background-50"
                      : done
                        ? "bg-primary-100 text-primary-700"
                        : "bg-background-100 text-foreground-500"
                  }`}
                >
                  <i className={done ? "ri-checkbox-circle-fill" : item.icon}></i>
                  {item.label}
                </span>
                {index < steps.length - 1 && <i className="ri-arrow-right-s-line text-foreground-300"></i>}
              </div>
            );
          })}
        </div>

        {error && step === 3 && (
          <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
            <i className="ri-error-warning-line mt-0.5 text-base"></i>
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
                <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
                  <i className="ri-search-line text-base"></i>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, função ou matrícula..."
                  className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                />
              </div>
              <div className="relative sm:w-64">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={selectClass}
                  aria-label="Filtrar por unidade"
                >
                  <option value="">Todas as unidades</option>
                  {collaboratorEstablishments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-foreground-500">
                {filteredCollaborators.length} colaborador(es) no filtro ·{" "}
                <strong className="font-semibold text-foreground-800">{collaboratorIds.length} selecionado(s)</strong>
              </p>
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-primary-700 transition-colors hover:bg-primary-50"
              >
                <i className="ri-checkbox-multiple-line text-sm"></i>
                Selecionar todos do filtro
              </button>
            </div>

            <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-background-200">
              {filteredCollaborators.map((collaborator) => {
                const checked = collaboratorIds.includes(collaborator.id);
                return (
                  <label
                    key={collaborator.id}
                    className={`flex cursor-pointer items-center gap-3 border-b border-background-100 px-3.5 py-3 last:border-0 transition-colors ${
                      checked ? "bg-primary-50/60" : "hover:bg-background-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCollaborator(collaborator.id)}
                      className="h-4 w-4 shrink-0 accent-primary-500"
                    />
                    <img
                      src={collaborator.photo}
                      alt={collaborator.name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground-900">{collaborator.name}</span>
                      <span className="block truncate text-[11px] text-foreground-500">
                        {collaborator.role || "—"}
                        {collaborator.establishment ? ` · ${collaborator.establishment}` : ""}
                        {collaborator.matricula ? ` · Matrícula ${collaborator.matricula}` : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        collaborator.status === "Ativo"
                          ? "bg-primary-100 text-primary-700"
                          : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {collaborator.status}
                    </span>
                  </label>
                );
              })}
              {filteredCollaborators.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-foreground-500">
                  Nenhum colaborador encontrado com esses filtros.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Tipos disponíveis</p>
                <button
                  type="button"
                  onClick={() => setTypes(suggestedBatchTypes)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-magic-line text-sm"></i>
                  Pacote sugerido
                </button>
              </div>
              <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
                <span className="flex h-9 w-9 items-center justify-center text-foreground-400">
                  <i className="ri-search-line text-sm"></i>
                </span>
                <input
                  type="search"
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  placeholder="Buscar tipo de documento..."
                  className="w-full bg-transparent py-1.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                />
              </div>
              <div className="max-h-[36vh] overflow-y-auto rounded-lg border border-background-200">
                {filteredTypes.map((type) => {
                  const checked = types.some((t) => t.typeId === type.id);
                  return (
                    <label
                      key={type.id}
                      className={`flex cursor-pointer items-start gap-2.5 border-b border-background-100 px-3.5 py-2.5 last:border-0 transition-colors ${
                        checked ? "bg-primary-50/60" : "hover:bg-background-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleType({ typeId: type.id, label: type.name })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground-900">{type.name}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
                Ordem no PDF ({types.length})
              </p>
              <div className="min-h-[120px] rounded-lg border border-background-200 bg-background-100 p-2">
                {types.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-foreground-500">
                    Nenhum tipo selecionado. Marque ao lado para montar a ordem.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-1.5">
                    {types.map((type, index) => (
                      <li
                        key={type.typeId}
                        className="flex items-center gap-2 rounded-md border border-background-200 bg-background-50 px-2.5 py-2"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-800">
                          {type.label}
                        </span>
                        <button
                          type="button"
                          aria-label="Mover para cima"
                          onClick={() => moveType(index, -1)}
                          disabled={index === 0}
                          className="flex h-6 w-6 items-center justify-center rounded text-foreground-500 transition-colors hover:bg-background-100 disabled:opacity-30"
                        >
                          <i className="ri-arrow-up-line text-sm"></i>
                        </button>
                        <button
                          type="button"
                          aria-label="Mover para baixo"
                          onClick={() => moveType(index, 1)}
                          disabled={index === types.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded text-foreground-500 transition-colors hover:bg-background-100 disabled:opacity-30"
                        >
                          <i className="ri-arrow-down-line text-sm"></i>
                        </button>
                        <button
                          type="button"
                          aria-label="Remover tipo"
                          onClick={() => toggleType(type)}
                          className="flex h-6 w-6 items-center justify-center rounded text-foreground-500 transition-colors hover:bg-accent-50 hover:text-accent-700"
                        >
                          <i className="ri-close-line text-sm"></i>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-foreground-500">
                A ficha de cadastro é montada com os dados já existentes do colaborador. Os demais tipos usam os
                arquivos anexados no cadastro, com a versão vigente sugerida.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <BatchPrintReviewStep
            collaborators={selectedCollaborators}
            documents={documents}
            types={types}
            versionChoice={versionChoice}
            onVersionChange={(key, documentId) => setVersionChoice((prev) => ({ ...prev, [key]: documentId }))}
            includeMissing={includeMissing}
            onIncludeMissingChange={setIncludeMissing}
          />
        )}

        {generating && progress && (
          <div className="rounded-md border border-primary-200 bg-primary-50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary-800">
              <i className="ri-loader-4-line animate-spin"></i>
              Gerando dossiê {progress.current} de {progress.total}
              {progress.collaborator ? ` — ${progress.collaborator}` : ""}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {results.length > 0 && step === 3 && !generating && (
          <p className="text-[11px] text-foreground-500">
            Já existe um lote gerado nesta sessão. Gerar novamente substitui os dossiês dos colaboradores
            selecionados e mantém os originais intactos.
          </p>
        )}
      </div>
    </Modal>
  );
}