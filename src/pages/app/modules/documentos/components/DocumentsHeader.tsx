import { useEffect, useRef, useState } from "react";

export type StructuredKind = "accident" | "measurement" | "permit" | "cat";

/** Documentos que vivem em módulos próprios (DDS, Ficha de EPI e APR). */
export type ModuleCreateKind = "dds" | "epi" | "apr";

interface DocumentsHeaderProps {
  /** Verifica as permissões do perfil logado (`can` do hook de permissões). */
  can: (permission: string | null) => boolean;
  onCreateStructured: (kind: StructuredKind) => void;
  onCreateModule: (kind: ModuleCreateKind) => void;
  onAttendance: () => void;
  onInspection: () => void;
  onUpload: () => void;
  onBatch: () => void;
  onHistory: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
}

interface MenuOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Permissão necessária para a ação aparecer. */
  permission?: string;
  run: () => void;
}

/**
 * Barra de ações do topo de Documentos.
 * Antes eram sete botões soltos; agora ficam agrupados em um único painel:
 * ação principal (enviar), criação de documentos e um menu "mais ações".
 */
export default function DocumentsHeader({
  can,
  onCreateStructured,
  onCreateModule,
  onAttendance,
  onInspection,
  onUpload,
  onBatch,
  onHistory,
  onExportPdf,
  onExportCsv,
}: DocumentsHeaderProps) {
  const [menu, setMenu] = useState<"create" | "more" | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const canUpload = can("documents.upload");
  const canBatch = can("documents.batchPrint");
  const canExport = can("tenant.reports");

  const structured: MenuOption[] = [
    {
      id: "cat",
      label: "CAT — Comunicação de Acidente",
      description: "Formulário legal completo com recibo de entrega",
      icon: "ri-first-aid-kit-line",
      permission: "documents.upload",
      run: () => onCreateStructured("cat"),
    },
    {
      id: "accident",
      label: "Investigação de Acidente",
      description: "CAT, causa raiz, plano de ação e fotos",
      icon: "ri-alert-line",
      permission: "documents.upload",
      run: () => onCreateStructured("accident"),
    },
    {
      id: "measurement",
      label: "Aferições",
      description: "Equipamento calibrado, medições e assinatura",
      icon: "ri-equalizer-2-line",
      permission: "documents.upload",
      run: () => onCreateStructured("measurement"),
    },
    {
      id: "permit",
      label: "Permissão de Trabalho",
      description: "Liberação por NR, riscos e checklist",
      icon: "ri-file-shield-2-line",
      permission: "documents.upload",
      run: () => onCreateStructured("permit"),
    },
  ];

  const modules: MenuOption[] = [
    {
      id: "dds",
      label: "DDS — Diálogo Diário de Segurança",
      description: "Tema, facilitador, participantes e fotos",
      icon: "ri-presentation-line",
      permission: "dds.create",
      run: () => onCreateModule("dds"),
    },
    {
      id: "epi",
      label: "Ficha de EPI",
      description: "Entrega de EPI com CA e aceite assinado",
      icon: "ri-shirt-line",
      permission: "epi.deliver",
      run: () => onCreateModule("epi"),
    },
    {
      id: "apr",
      label: "APR — Análise Preliminar de Risco",
      description: "Riscos da atividade e aceite dos executantes",
      icon: "ri-clipboard-line",
      permission: "documents.upload",
      run: () => onCreateModule("apr"),
    },
  ];

  const operational: MenuOption[] = [
    {
      id: "attendance",
      label: "Ficha de Presença",
      description: "Lista de participantes com assinatura",
      icon: "ri-list-check-2",
      permission: "documents.attendance",
      run: onAttendance,
    },
    {
      id: "inspection",
      label: "Inspeção de Campo",
      description: "Checklist no local e relatório com fotos",
      icon: "ri-clipboard-line",
      permission: "documents.inspection",
      run: onInspection,
    },
  ];

  const allowedOption = (option: MenuOption) => !option.permission || can(option.permission);
  const structuredAllowed = structured.filter(allowedOption);
  const modulesAllowed = modules.filter(allowedOption);
  const operationalAllowed = operational.filter(allowedOption);
  const hasCreate = structuredAllowed.length + modulesAllowed.length + operationalAllowed.length > 0;
  const hasMore = canBatch || canExport;

  const choose = (option: MenuOption) => {
    setMenu(null);
    option.run();
  };

  return (
    <div
      ref={wrapperRef}
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-background-200 bg-background-50 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.25)]"
    >
      {canUpload ? (
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-background-50 shadow-sm shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-md hover:shadow-primary-600/30 active:translate-y-px"
        >
          <i className="ri-upload-cloud-2-line text-base"></i>
          Enviar arquivo
        </button>
      ) : (
        <span
          title="Envio de arquivos não liberado para o seu perfil"
          className="inline-flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-lg bg-background-200 px-4 py-2.5 text-sm font-semibold text-foreground-500"
        >
          <i className="ri-lock-2-line text-base"></i>
          Enviar arquivo
        </span>
      )}

      {hasCreate && (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === "create" ? null : "create")}
          aria-expanded={menu === "create"}
          className={`inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors ${
            menu === "create"
              ? "bg-background-200 text-foreground-950"
              : "text-foreground-700 hover:bg-background-100 hover:text-foreground-950"
          }`}
        >
          <i className="ri-add-circle-line text-base"></i>
          Criar documento
          <i className={`ri-arrow-down-s-line text-base transition-transform ${menu === "create" ? "rotate-180" : ""}`}></i>
        </button>

        {menu === "create" && (
          <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[320px] overflow-y-auto rounded-xl border border-background-200 bg-background-50 shadow-xl">
            <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Documentos e módulos
            </p>
            {structuredAllowed.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option)}
                className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-background-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <i className={`${option.icon} text-sm`}></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground-950">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-foreground-500">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}

            <p className="mt-1 border-t border-background-100 px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Módulos
            </p>
            {modulesAllowed.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option)}
                className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-background-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
                  <i className={`${option.icon} text-sm`}></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground-950">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-foreground-500">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}

            <p className="mt-1 border-t border-background-100 px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
              Operacional
            </p>
            {operationalAllowed.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option)}
                className="flex w-full cursor-pointer items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-background-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
                  <i className={`${option.icon} text-sm`}></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground-950">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-foreground-500">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}

            <p className="mt-1 flex items-center gap-1.5 border-t border-background-100 bg-background-100 px-4 py-2.5 text-[10px] text-foreground-500">
              <i className="ri-magic-line"></i>
              Todos incluem checklist inteligente
            </p>
          </div>
        )}
      </div>
      )}

      <span className="mx-0.5 hidden h-6 w-px bg-background-200 sm:block" aria-hidden="true" />

      {canBatch ? (
        <button
          type="button"
          onClick={onBatch}
          className="inline-flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100 hover:text-foreground-950"
        >
          <i className="ri-printer-cloud-line text-base"></i>
          Impressão em lote
        </button>
      ) : (
        <span
          title="Impressão em lote não liberada para o seu perfil"
          className="inline-flex h-10 cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold text-foreground-400"
        >
          <i className="ri-lock-2-line text-base"></i>
          Impressão em lote
        </span>
      )}

      {hasMore && (
        <>
          <span className="mx-0.5 hidden h-6 w-px bg-background-200 sm:block" aria-hidden="true" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === "more" ? null : "more")}
              aria-expanded={menu === "more"}
              aria-label="Mais ações"
              title="Mais ações"
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                menu === "more"
                  ? "bg-background-200 text-foreground-950"
                  : "text-foreground-500 hover:bg-background-100 hover:text-foreground-900"
              }`}
            >
              <i className="ri-more-2-line text-lg"></i>
            </button>

            {menu === "more" && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-background-200 bg-background-50 py-1.5 shadow-xl">
                {canBatch && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        onHistory();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-history-line text-base text-foreground-500"></i>
                      Lotes gerados
                    </button>
                    {canExport && <div className="my-1 h-px bg-background-100" />}
                  </>
                )}
                {canExport && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        onExportPdf();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-file-pdf-2-line text-base text-accent-700"></i>
                      Exportar em PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        onExportCsv();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-file-excel-2-line text-base text-primary-700"></i>
                      Exportar planilha (CSV)
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}