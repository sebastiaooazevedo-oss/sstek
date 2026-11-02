import { useMemo, useState } from "react";
import { addInspection, useCipas, useInspections } from "@/pages/app/modules/cipa/cipaStore";
import CipaInspectionModal from "@/pages/app/modules/cipa/components/CipaInspectionModal";
import { brDateToTime } from "@/pages/app/modules/cipa/cipaUtils";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { buildInspectionPdfBody } from "@/pages/app/modules/cipa/inspectionPdf";
import {
  technicalSignatureBlockedMessage,
  useTechnicalSignatureGate,
} from "@/pages/app/modules/cipa/technicalSignatureGate";
import { technicalSignatureInfo } from "@/pages/app/modules/cipa/technicalSignatureStore";
import type { CipaInspection } from "@/mocks/cipa";

interface InspectionsTabProps {
  cipaId: string;
}

const riskTone: Record<string, string> = {
  Baixo: "bg-background-200 text-foreground-700",
  Médio: "bg-secondary-100 text-secondary-800",
  Alto: "bg-accent-100 text-accent-800",
  Crítico: "bg-accent-200 text-accent-900",
};

export default function InspectionsTab({ cipaId }: InspectionsTabProps) {
  const inspections = useInspections();
  const cipas = useCipas();
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState("");
  // Emissão definitiva da inspeção condicionada à assinatura do RT.
  const gate = useTechnicalSignatureGate();
  const [exportNotice, setExportNotice] = useState("");

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    inspections.forEach((i) => {
      if (i.establishment) units.add(i.establishment);
    });
    collaboratorEstablishments.forEach((u) => units.add(u));
    return Array.from(units);
  }, [inspections]);

  const filtered = useMemo(
    () =>
      inspections
        .filter((i) => (!cipaId || i.cipaId === cipaId) && (!unitFilter || i.establishment === unitFilter))
        .sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date)),
    [inspections, cipaId, unitFilter]
  );

  const exportInspection = async (ins: CipaInspection) => {
    const cipaName = cipas.find((c) => c.id === ins.cipaId)?.name || "—";
    // A assinatura do RT vem antes de montar o documento: o rodapé já sai
    // com a assinatura do ato (nome, data/hora e ID).
    const result = await gate.guard(
      "inspecao-cipa",
      ins.id,
      `Inspeção da CIPA — ${ins.title}`,
      `${cipaName}${ins.area ? ` · ${ins.area}` : ""} · ${ins.date}`
    );
    if (result !== "signed") {
      setExportNotice(technicalSignatureBlockedMessage(result, gate.responsible?.name));
      return;
    }
    setExportNotice("");

    const body = buildInspectionPdfBody(
      ins,
      cipaName,
      technicalSignatureInfo("inspecao-cipa", ins.id) ?? undefined
    );
    printHtml(`Inspeção da CIPA — ${ins.title}`, body);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Inspeções da CIPA</h2>
          <p className="mt-0.5 text-sm text-foreground-600">Registre as inspeções de segurança vinculadas à comissão, com itens verificados e fotos.</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground-400">
            <i className="ri-shield-check-line"></i>
            A emissão definitiva em PDF exige a assinatura do Responsável Técnico.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
        >
          <i className="ri-add-line text-base"></i>
          Nova inspeção
        </button>
      </div>

      {exportNotice && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
          <i className="ri-lock-2-line mt-0.5 text-base"></i>
          <span className="flex-1">{exportNotice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setExportNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-accent-100 dark:hover:bg-accent-900"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-64"
          >
            <option value="">Todas as unidades</option>
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
        </div>
        {unitFilter && (
          <button
            type="button"
            onClick={() => setUnitFilter("")}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
          >
            <i className="ri-close-circle-line text-base"></i>
            Limpar
          </button>
        )}
        <span className="text-xs text-foreground-500">{filtered.length} inspeção(ões)</span>
      </div>

      <div className="flex flex-col gap-4">
        {filtered.map((ins) => {
          const cipa = cipas.find((c) => c.id === ins.cipaId);
          const nonConforming = ins.checklist.filter((i) => i.status === "Não conforme").length;
          const conforming = ins.checklist.filter((i) => i.status === "Conforme").length;
          const isOpen = openId === ins.id;
          return (
            <div key={ins.id} className="rounded-lg border border-background-200 bg-background-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <i className="ri-clipboard-line text-xl"></i>
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground-950">{ins.title}</h3>
                    <p className="mt-0.5 text-xs text-foreground-500">
                      {cipa?.name || "—"} · {ins.date} · {ins.area || "—"}
                      {ins.location && ` · ${ins.location}`}
                    </p>
                    {ins.establishment && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-foreground-400">
                        <i className="ri-building-2-line"></i>
                        <span className="truncate">{ins.establishment}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskTone[ins.risk] || "bg-background-200 text-foreground-700"}`}>Risco {ins.risk}</span>
                  <button
                    type="button"
                    onClick={() => void exportInspection(ins)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-file-pdf-2-line text-base"></i>
                    PDF
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="flex items-center gap-1.5 rounded-md bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-100">
                  <i className="ri-checkbox-circle-line"></i>
                  {conforming} conforme(s)
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-accent-50 px-3 py-2 text-xs font-semibold text-accent-800 dark:bg-accent-950 dark:text-accent-100">
                  <i className="ri-error-warning-line"></i>
                  {nonConforming} não conforme(s)
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-background-100 px-3 py-2 text-xs font-semibold text-foreground-600">
                  <i className="ri-camera-line"></i>
                  {ins.photos.length} foto(s)
                </span>
              </div>

              {ins.nonConformities && <p className="mt-3 text-sm leading-relaxed text-foreground-700">{ins.nonConformities}</p>}

              {isOpen && (
                <div className="mt-4 flex flex-col gap-4 border-t border-background-100 pt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Itens verificados</p>
                      <div className="flex flex-col gap-1.5">
                        {ins.checklist.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-foreground-700">{item.label}</span>
                            <span
                              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                item.status === "Conforme"
                                  ? "bg-primary-100 text-primary-700"
                                  : item.status === "Não conforme"
                                    ? "bg-accent-100 text-accent-800"
                                    : "bg-background-200 text-foreground-600"
                              }`}
                            >
                              {item.status || "Não avaliado"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ação corretiva</p>
                        <p className="text-sm leading-relaxed text-foreground-700">{ins.action || "—"}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500">
                          <span className="flex items-center gap-1.5">
                            <i className="ri-user-line"></i>
                            {ins.actionOwner || "—"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <i className="ri-calendar-line"></i>
                            {ins.actionDue || "sem prazo"}
                          </span>
                        </div>
                      </div>
                      {ins.notes && <p className="text-xs leading-relaxed text-foreground-500">{ins.notes}</p>}
                    </div>
                  </div>
                  {ins.photos.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Registro fotográfico</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {ins.photos.map((p) => (
                          <figure key={p.id} className="overflow-hidden rounded-lg border border-background-200">
                            <div className="h-28 w-full">
                              <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                            </div>
                            <figcaption className="truncate bg-background-100 px-2 py-1 text-[10px] text-foreground-500">{p.name}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : ins.id)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100"
              >
                <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                {isOpen ? "Ocultar detalhes" : "Ver detalhes"}
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-clipboard-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">{unitFilter ? "Nenhuma inspeção nesta unidade" : "Nenhuma inspeção registrada"}</p>
          <p className="text-xs text-foreground-500">{unitFilter ? "Ajuste o filtro de unidade ou registre uma nova inspeção." : "Registre a primeira inspeção da CIPA com fotos."}</p>
        </div>
      )}

      <CipaInspectionModal open={formOpen} onClose={() => setFormOpen(false)} onSave={addInspection} cipas={cipas} />
      {gate.modal}
    </div>
  );
}