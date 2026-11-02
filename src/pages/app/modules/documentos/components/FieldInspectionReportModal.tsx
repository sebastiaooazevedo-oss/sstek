import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import {
  buildFieldInspectionPdfBody,
  removeFieldInspection,
  useFieldInspections,
  type FieldInspectionRecord,
} from "@/pages/app/modules/documentos/fieldInspectionStore";
import { countNonConforming, inspectionChecklist } from "@/pages/app/modules/documentos/components/inspectionData";
import { escapeHtml, pdfFooter, pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { useAppSession } from "@/pages/app/context";
import { reportSealHtml } from "@/pages/app/signature/reportSeal";

interface FieldInspectionReportModalProps {
  open: boolean;
  onClose: () => void;
  /** Abre o formulário para registrar uma nova inspeção de campo. */
  onCreate: () => void;
}

function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

const riskTone: Record<string, string> = {
  Baixo: "bg-background-200 text-foreground-700",
  Médio: "bg-secondary-100 text-secondary-800",
  Alto: "bg-accent-100 text-accent-800",
  Crítico: "bg-accent-200 text-accent-900",
};

const toneIcon: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-800",
  accent: "bg-accent-100 text-accent-800",
};

/** Lista/relatório das Inspeções de Campo, com filtro por unidade. */
export default function FieldInspectionReportModal({ open, onClose, onCreate }: FieldInspectionReportModalProps) {
  const records = useFieldInspections();
  const session = useAppSession();
  const [sealing, setSealing] = useState(false);
  const [unitFilter, setUnitFilter] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    records.forEach((r) => {
      if (r.establishment) units.add(r.establishment);
    });
    collaboratorEstablishments.forEach((u) => units.add(u));
    return Array.from(units);
  }, [records]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records
      .filter((r) => {
        const matchUnit = !unitFilter || r.establishment === unitFilter;
        const matchTerm =
          !term ||
          r.title.toLowerCase().includes(term) ||
          r.area.toLowerCase().includes(term) ||
          r.inspectorName.toLowerCase().includes(term) ||
          r.establishment.toLowerCase().includes(term);
        return matchUnit && matchTerm;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [records, unitFilter, search]);

  const nonConfTotal = useMemo(() => filtered.reduce((s, r) => s + countNonConforming(r.checklist), 0), [filtered]);
  const inspectedTotal = useMemo(() => filtered.reduce((s, r) => s + r.inspected.length, 0), [filtered]);
  const photoTotal = useMemo(() => filtered.reduce((s, r) => s + r.photos.length, 0), [filtered]);

  const stats = useMemo(
    () => [
      { label: "Inspeções", value: filtered.length, icon: "ri-clipboard-line", tone: "primary" },
      { label: "Não conformidades", value: nonConfTotal, icon: "ri-error-warning-line", tone: "accent" },
      { label: "Colaboradores vistoriados", value: inspectedTotal, icon: "ri-group-line", tone: "secondary" },
      { label: "Registros fotográficos", value: photoTotal, icon: "ri-camera-line", tone: "secondary" },
    ],
    [filtered.length, nonConfTotal, inspectedTotal, photoTotal]
  );

  const buildExportRows = () =>
    filtered.map((r) => [
      r.title,
      r.kind,
      r.establishment || "—",
      r.area || "—",
      toBrDate(r.date),
      r.inspectorName || "—",
      String(countNonConforming(r.checklist)),
      String(r.inspected.length),
    ]);

  const exportHeaders = [
    "Título",
    "Tipo",
    "Unidade",
    "Área",
    "Data",
    "Responsável",
    "Não conformidades",
    "Vistoriados",
  ];

  const handleViewPdf = (record: FieldInspectionRecord) => {
    printHtml(`Inspeção de Campo — ${record.title}`, buildFieldInspectionPdfBody(record));
  };

  // Conteúdo canonico impresso — base do hash SHA-256 da chancela. Precisa
  // refletir exatamente o que sai no papel: filtro, indicadores e cada inspeção.
  const buildSealContent = () => ({
    documento: "relatorio-inspecoes-campo",
    unidade: unitFilter || "Todas as unidades",
    buscaAplicada: search.trim() || null,
    indicadores: {
      inspecoes: filtered.length,
      naoConformidades: nonConfTotal,
      vistoriados: inspectedTotal,
      fotos: photoTotal,
    },
    inspecoes: filtered.map((r) => ({
      id: r.id,
      titulo: r.title,
      tipo: r.kind,
      unidade: r.establishment || null,
      area: r.area || null,
      local: r.location || null,
      data: r.date,
      hora: r.time || null,
      turno: r.shift || null,
      responsavel: r.inspectorName || null,
      risco: r.risk,
      naoConformidades: countNonConforming(r.checklist),
      itens: inspectionChecklist.map((item) => ({
        item: item.label,
        referencia: item.ref,
        situacao: r.checklist[item.id]?.status || "Não avaliado",
        observacao: r.checklist[item.id]?.note?.trim() || null,
      })),
      vistoriados: r.inspected.length,
      fotos: r.photos.length,
      acao: r.action || null,
      responsavelAcao: r.actionOwner || null,
      prazo: r.actionDue || null,
    })),
  });

  const handleExportPdf = async () => {
    if (sealing || filtered.length === 0) return;
    setSealing(true);
    try {
    const title = unitFilter ? `Relatório de Inspeções de Campo · ${unitFilter}` : "Relatório de Inspeções de Campo";
    const seal = await reportSealHtml({
      scope: "documento",
      referenceRef: `relatorio-inspecoes-campo|${unitFilter || "todas"}|${filtered.length}`,
      referenceLabel: `${title} · ${filtered.length} inspeção(ões)`,
      caption: "Relatório consolidado de inspeções de campo",
      issuerName: session.name,
      content: buildSealContent(),
    });
    const body = `${pdfHeader(title)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>Inspeções</span></div>
        <div class="kpi"><b>${nonConfTotal}</b><span>Não conformidades</span></div>
        <div class="kpi"><b>${inspectedTotal}</b><span>Colaboradores vistoriados</span></div>
        <div class="kpi"><b>${photoTotal}</b><span>Registros fotográficos</span></div>
      </div>
      <h2>Inspeções (${filtered.length})</h2>
      ${tableHtml(exportHeaders, buildExportRows())}
      ${pdfFooter(seal.html, seal.url)}`;
    printHtml(title, body);
    } finally {
      setSealing(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsv("inspecoes-de-campo.csv", exportHeaders, buildExportRows());
  };

  // Exportação em lote: um único PDF (arquivo) com uma CAPA de resumo por
  // unidade (totais por estabelecimento) e, em seguida, todas as inspeções
  // filtradas — cada uma em sua própria página.
  const handleBatchPdf = async () => {
    if (!filtered.length || sealing) return;
    setSealing(true);
    try {

    const groups = new Map<string, FieldInspectionRecord[]>();
    filtered.forEach((r) => {
      const key = r.establishment || "Não informada";
      const list = groups.get(key) || [];
      list.push(r);
      groups.set(key, list);
    });

    const groupRows = Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([unit, list]) => {
        const nc = list.reduce((s, r) => s + countNonConforming(r.checklist), 0);
        const inspected = list.reduce((s, r) => s + r.inspected.length, 0);
        const photos = list.reduce((s, r) => s + r.photos.length, 0);
        return `<tr><td>${escapeHtml(unit)}</td><td>${list.length}</td><td>${nc}</td><td>${inspected}</td><td>${photos}</td></tr>`;
      })
      .join("");

    const title = unitFilter ? `Inspeções de Campo — lote · ${unitFilter}` : "Inspeções de Campo — documento único";
    const seal = await reportSealHtml({
      scope: "documento",
      referenceRef: `inspecoes-campo-lote|${unitFilter || "todas"}|${filtered.length}`,
      referenceLabel: `${title} · ${filtered.length} inspeção(ões)`,
      caption: "Relatório consolidado de inspeções de campo",
      issuerName: session.name,
      content: { documento: "inspecoes-campo-lote", ...buildSealContent(), unidades: Array.from(groups.keys()).sort() },
    });

    const cover = `<div class="cover">
      ${pdfHeader(unitFilter ? `Inspeções de Campo · ${unitFilter}` : "Inspeções de Campo")}
      <div class="cover-hero">
        <p class="cover-eyebrow">Relatório consolidado</p>
        <h1 class="cover-title">Resumo por unidade</h1>
        <p class="cover-sub">Totais de inspeções de campo por estabelecimento, consolidados antes das páginas individuais de cada registro.</p>
        <p class="cover-date">Unidade: ${escapeHtml(unitFilter || "Todas as unidades")} · Emitido em ${todayBr()}</p>
      </div>
      <div class="cover-kpis">
        <div class="cover-kpi"><b>${filtered.length}</b><span>Inspeções</span></div>
        <div class="cover-kpi is-alert"><b>${nonConfTotal}</b><span>Não conformidades</span></div>
        <div class="cover-kpi"><b>${inspectedTotal}</b><span>Colaboradores vistoriados</span></div>
        <div class="cover-kpi"><b>${photoTotal}</b><span>Registros fotográficos</span></div>
      </div>
      <h2>Totais por unidade (${groups.size})</h2>
      <table>
        <thead><tr><th>Unidade</th><th>Inspeções</th><th>Não conformidades</th><th>Vistoriados</th><th>Fotos</th></tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
      <div class="cover-note">Este documento reúne <strong>${filtered.length}</strong> inspeção(ões) distribuídas em <strong>${groups.size}</strong> unidade(s). As páginas a seguir trazem cada inspeção na íntegra (checklist, ação corretiva e registro fotográfico).</div>
      <div class="cover-meta"><span>SSTEK · Gestão Inteligente em Segurança do Trabalho</span><span>Emitido em ${todayBr()}</span></div>
      ${pdfFooter(seal.html, seal.url)}
    </div>`;

    const pages = filtered
      .map((r) => `<div class="batch-page">${buildFieldInspectionPdfBody(r)}</div>`)
      .join("");
    printHtml(title, cover + pages);
    } finally {
      setSealing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-clipboard-line"
      title="Inspeções de Campo"
      subtitle="Relatório das inspeções registradas. Filtre por unidade e gere o documento quando quiser."
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
          <ModalButton
            variant="ghost"
            onClick={handleBatchPdf}
            icon="ri-file-pdf-2-line"
            disabled={filtered.length === 0 || sealing}
          >
            {sealing ? "Chancelando…" : "Exportar lote (PDF único)"}
          </ModalButton>
          <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} disabled={sealing} />
          <ModalButton onClick={onCreate} icon="ri-add-line">
            Nova inspeção
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Filtros */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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

          <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, área ou responsável..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
          </div>

          {(unitFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setUnitFilter("");
                setSearch("");
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-close-circle-line text-base"></i>
              Limpar
            </button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-background-200 bg-background-50 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneIcon[stat.tone]}`}>
                <i className={`${stat.icon} text-base`}></i>
              </span>
              <p className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{stat.value}</p>
              <p className="mt-0.5 text-xs font-medium text-foreground-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-3">
          {filtered.map((record) => {
            const nonConforming = countNonConforming(record.checklist);
            const conforming = inspectionChecklist.filter((i) => record.checklist[i.id]?.status === "Conforme").length;
            const isOpen = openId === record.id;
            const isPendingDelete = pendingDelete === record.id;
            return (
              <div key={record.id} className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                      <i className="ri-clipboard-line text-xl"></i>
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading text-base font-bold text-foreground-950">{record.title}</h3>
                      <p className="mt-0.5 text-xs text-foreground-500">
                        {record.kind} · {toBrDate(record.date)} · {record.area || "—"}
                        {record.location && ` · ${record.location}`}
                      </p>
                      {record.establishment && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-foreground-400">
                          <i className="ri-building-2-line"></i>
                          <span className="truncate">{record.establishment}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${riskTone[record.risk] || "bg-background-200 text-foreground-700"}`}>
                      Risco {record.risk}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleViewPdf(record)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-file-pdf-2-line text-base"></i>
                      PDF
                    </button>
                    {isPendingDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            removeFieldInspection(record.id);
                            setPendingDelete(null);
                          }}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3 py-2 text-xs font-semibold text-foreground-950 transition-colors hover:bg-accent-600"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(null)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label="Remover inspeção"
                        onClick={() => setPendingDelete(record.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-500 transition-colors hover:bg-background-100 hover:text-accent-700"
                      >
                        <i className="ri-delete-bin-line text-base"></i>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 rounded-md bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700">
                    <i className="ri-checkbox-circle-line"></i>
                    {conforming} conforme(s)
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md bg-accent-50 px-2.5 py-1.5 text-xs font-semibold text-accent-800">
                    <i className="ri-error-warning-line"></i>
                    {nonConforming} não conforme(s)
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md bg-background-100 px-2.5 py-1.5 text-xs font-semibold text-foreground-600">
                    <i className="ri-group-line"></i>
                    {record.inspected.length} vistoriado(s)
                  </span>
                  <span className="flex items-center gap-1.5 rounded-md bg-background-100 px-2.5 py-1.5 text-xs font-semibold text-foreground-600">
                    <i className="ri-camera-line"></i>
                    {record.photos.length} foto(s)
                  </span>
                </div>

                {isOpen && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-background-100 pt-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Itens verificados</p>
                        <div className="flex flex-col gap-1.5">
                          {inspectionChecklist.map((item) => {
                            const entry = record.checklist[item.id];
                            const status = entry?.status || "Não avaliado";
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate text-foreground-700">{item.label}</span>
                                <span
                                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    status === "Conforme"
                                      ? "bg-primary-100 text-primary-700"
                                      : status === "Não conforme"
                                        ? "bg-accent-100 text-accent-800"
                                        : "bg-background-200 text-foreground-600"
                                  }`}
                                >
                                  {status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ação corretiva</p>
                          <p className="text-sm leading-relaxed text-foreground-700">{record.action || "—"}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500">
                            <span className="flex items-center gap-1.5">
                              <i className="ri-user-line"></i>
                              {record.actionOwner || "—"}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <i className="ri-calendar-line"></i>
                              {record.actionDue ? toBrDate(record.actionDue) : "sem prazo"}
                            </span>
                          </div>
                        </div>
                        {record.nonConformities && (
                          <div>
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Desvios identificados</p>
                            <p className="text-xs leading-relaxed text-foreground-500">{record.nonConformities}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {record.photos.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Registro fotográfico</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {record.photos.map((p) => (
                            <figure key={p.id} className="overflow-hidden rounded-lg border border-background-200">
                              <div className="h-24 w-full">
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
                  onClick={() => setOpenId(isOpen ? null : record.id)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100"
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
            <p className="text-sm font-semibold text-foreground-800">
              {unitFilter || search ? "Nenhuma inspeção encontrada" : "Nenhuma inspeção de campo registrada"}
            </p>
            <p className="text-xs text-foreground-500">
              {unitFilter || search
                ? "Ajuste o filtro de unidade ou a busca."
                : "Registre a primeira inspeção de campo para gerar o documento."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}