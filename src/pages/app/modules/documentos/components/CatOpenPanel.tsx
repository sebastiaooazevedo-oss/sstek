import { useMemo, useState } from "react";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { buildStructuredPdfBody, toBrDate } from "@/pages/app/modules/documentos/structured/structuredPdf";
import { saveStructuredDocument } from "@/pages/app/modules/documentos/structured/structuredStore";
import { catPendingItems } from "@/pages/app/modules/documentos/structured/cat/catInvestigation";
import { onlyDigits } from "@/pages/app/modules/documentos/structured/cat/catData";
import type {
  CatPayload,
  StructuredRecord,
} from "@/pages/app/modules/documentos/structured/structuredTypes";

interface CatOpenPanelProps {
  records: StructuredRecord[];
  /** Quando informado, mostra só as CATs desses colaboradores (por id). */
  collaboratorIds?: string[];
  /** Alternativa de vínculo: CPFs dos colaboradores do escopo. */
  collaboratorCpfs?: string[];
  /** Personaliza o cabeçalho para o contexto (ex.: visão do líder). */
  title?: string;
  description?: string;
  className?: string;
}

const NO_UNIT = "Sem unidade";
const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

function unitOf(record: StructuredRecord): string {
  const cat = record.payload as CatPayload;
  return (record.establishment || cat.employerUnit || "").trim() || NO_UNIT;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Painel "CATs em aberto" da área de Documentos.
 *
 * Lista as CATs que ainda têm pendência legal — nº oficial do eSocial /
 * Empregador Web não informado e/ou recibo de entrega não anexado
 * (Lei 8.213/91, art. 22, §2º) — agrupadas por unidade, com ação direta para
 * regularizar cada pendência sem abrir o formulário inteiro.
 */
export default function CatOpenPanel({
  records,
  collaboratorIds,
  collaboratorCpfs,
  title = "CATs em aberto",
  description = "Pendências legais da Comunicação de Acidente de Trabalho: nº oficial do eSocial / Empregador Web e recibo de entrega ao trabalhador (Lei 8.213/91, art. 22, §2º).",
  className = "",
}: CatOpenPanelProps) {
  const idScope = useMemo(
    () => (collaboratorIds ? new Set(collaboratorIds.filter(Boolean)) : null),
    [collaboratorIds]
  );
  const cpfScope = useMemo(
    () =>
      collaboratorCpfs
        ? new Set(collaboratorCpfs.map((cpf) => onlyDigits(cpf)).filter((cpf) => cpf.length === 11))
        : null,
    [collaboratorCpfs]
  );
  const scoped = Boolean(idScope || cpfScope);

  const cats = useMemo(
    () =>
      records.filter((record) => {
        if (record.kind !== "cat") return false;
        if (!scoped) return true;
        const cat = record.payload as CatPayload;
        const byId = Boolean(idScope && cat.workerCollaboratorId && idScope.has(cat.workerCollaboratorId));
        const byCpf = Boolean(cpfScope && cpfScope.has(onlyDigits(cat.workerCpf)));
        return byId || byCpf;
      }),
    [records, scoped, idScope, cpfScope]
  );
  const [unitFilter, setUnitFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [numberDraft, setNumberDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const units = useMemo(() => {
    const set = new Set<string>();
    cats.forEach((record) => set.add(unitOf(record)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cats]);

  const openCats = useMemo(
    () =>
      cats.filter((record) => {
        const pending = catPendingItems(record.payload as CatPayload);
        if (!pending.missingNumber && !pending.missingReceipt) return false;
        if (unitFilter && unitOf(record) !== unitFilter) return false;
        return true;
      }),
    [cats, unitFilter]
  );

  const pendingNumber = openCats.filter(
    (record) => catPendingItems(record.payload as CatPayload).missingNumber
  ).length;
  const pendingReceipt = openCats.filter(
    (record) => catPendingItems(record.payload as CatPayload).missingReceipt
  ).length;

  if (cats.length === 0) return null;


  const persistPatch = async (record: StructuredRecord, patch: Partial<CatPayload>) => {
    setSavingId(record.id);
    setError("");
    setFeedback("");
    const payload = { ...(record.payload as CatPayload), ...patch };
    const updated: StructuredRecord = {
      ...record,
      establishment: (payload.employerUnit || record.establishment || "").trim(),
      payload,
    };
    const ok = await saveStructuredDocument(updated);
    setSavingId(null);
    if (!ok) {
      setError("Não foi possível atualizar a CAT. Tente novamente.");
      return false;
    }
    setFeedback("CAT atualizada. A pendência saiu do painel e o alerta do sino foi revisado.");
    return true;
  };

  const handleSaveNumber = async (record: StructuredRecord) => {
    const value = numberDraft.trim();
    if (!value) {
      setError("Informe o nº oficial da CAT emitida no eSocial / Empregador Web.");
      return;
    }
    const ok = await persistPatch(record, { catNumber: value });
    if (ok) {
      setEditingId(null);
      setNumberDraft("");
    }
  };

  const handleReceipt = async (record: StructuredRecord, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      setError("O recibo deve ter no máximo 3 MB.");
      return;
    }
    setError("");
    try {
      const dataUrl = await readAsDataUrl(file);
      if (!dataUrl) {
        setError("Não foi possível ler o arquivo selecionado.");
        return;
      }
      const cat = record.payload as CatPayload;
      await persistPatch(record, {
        receiptName: file.name,
        receiptType: file.type || "application/pdf",
        receiptDataUrl: dataUrl,
        receiptDeliveredDate: cat.receiptDeliveredDate || todayIso(),
        receiptDeliveredTo: cat.receiptDeliveredTo || cat.workerName,
      });
    } catch {
      setError("Não foi possível ler o arquivo selecionado.");
    }
  };

  const handleOpenCat = (record: StructuredRecord) => {
    const cat = record.payload as CatPayload;
    printHtml(`CAT — ${cat.workerName || record.title}`, buildStructuredPdfBody(record));
  };

  return (
    <section className={`rounded-xl border border-background-200 bg-background-50 p-4 shadow-sm md:p-5 ${className}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-first-aid-kit-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">{title}</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-foreground-600">{description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-semibold text-accent-800">
                <i className="ri-hashtag"></i>
                {pendingNumber} sem nº oficial
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-semibold text-secondary-900">
                <i className="ri-receipt-line"></i>
                {pendingReceipt} sem recibo
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-100 px-2.5 py-1 text-[10px] font-semibold text-foreground-600">
                <i className="ri-file-list-3-line"></i>
                {cats.length} CAT(s) registradas
              </span>
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-foreground-400">
          Unidade
          <div className="relative">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full min-w-[220px] cursor-pointer appearance-none rounded-md border border-background-300 bg-background-50 py-2 pl-3 pr-8 text-xs font-medium text-foreground-800 focus:border-primary-400 focus:outline-none"
            >
              <option value="">Todas as unidades</option>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-foreground-400"></i>
          </div>
        </label>
      </div>

      {(feedback || error) && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-md px-3.5 py-2.5 text-xs ${
            error
              ? "border border-accent-200 bg-accent-50 text-accent-900"
              : "border border-primary-200 bg-primary-50 text-primary-800"
          }`}
        >
          <i className={`${error ? "ri-error-warning-line" : "ri-checkbox-circle-line"} mt-0.5 text-base`}></i>
          <span className="flex-1">{error || feedback}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => {
              setError("");
              setFeedback("");
            }}
            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded opacity-70 hover:bg-background-50/60 hover:opacity-100"
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        </div>
      )}

      {openCats.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-primary-300 bg-primary-50/60 px-6 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-check-line text-xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-900">Nenhuma CAT em aberto</p>
          <p className="max-w-md text-xs leading-relaxed text-foreground-600">
            {unitFilter
              ? `Todas as CATs de ${unitFilter} estão com nº oficial e recibo de entrega registrados.`
              : scoped
                ? "As CATs da sua equipe estão com nº oficial e recibo de entrega em dia."
                : "Todas as CATs registradas estão com nº oficial e recibo de entrega anexados."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {openCats.map((record) => {
            const cat = record.payload as CatPayload;
            const pending = catPendingItems(cat);
            const saving = savingId === record.id;
            const editing = editingId === record.id;
            return (
              <li
                key={record.id}
                className="rounded-lg border border-background-200 bg-background-100 p-3.5 transition-colors hover:border-primary-200"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-950">
                      <span className="truncate">{cat.workerName || record.title}</span>
                      <span className="rounded-full bg-background-50 px-2 py-0.5 font-mono text-[10px] font-bold text-foreground-600">
                        {cat.protocol || record.id}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground-500">
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-calendar-event-line"></i>
                        {toBrDate(cat.accidentDate)}
                      </span>
                      <span className="text-foreground-300">·</span>
                      <span>{cat.accidentType}</span>
                      {cat.cid && (
                        <>
                          <span className="text-foreground-300">·</span>
                          <span>CID {cat.cid}</span>
                        </>
                      )}
                      <span className="text-foreground-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-building-line"></i>
                        {unitOf(record)}
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {pending.missingNumber ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-semibold text-accent-800">
                          <i className="ri-hashtag"></i>
                          Nº oficial pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-800">
                          <i className="ri-checkbox-circle-line"></i>
                          Nº oficial {cat.catNumber}
                        </span>
                      )}
                      {pending.missingReceipt ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-semibold text-secondary-900">
                          <i className="ri-receipt-line"></i>
                          Recibo pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-800">
                          <i className="ri-attachment-2"></i>
                          Recibo anexado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                    {pending.missingNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(editing ? null : record.id);
                          setNumberDraft(editing ? "" : cat.catNumber || "");
                          setError("");
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-edit-line"></i>
                        Informar nº oficial
                      </button>
                    )}

                    {pending.missingReceipt && (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-1.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600">
                        <i className={saving ? "ri-loader-4-line" : "ri-upload-cloud-2-line"}></i>
                        Anexar recibo
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={saving}
                          onChange={(e) => {
                            void handleReceipt(record, e.target.files?.[0] ?? null);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenCat(record)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      <i className="ri-file-pdf-2-line"></i>
                      Abrir CAT
                    </button>
                  </div>
                </div>

                {editing && (
                  <div className="mt-3 flex flex-col gap-2 rounded-md border border-primary-200 bg-primary-50/70 p-3 sm:flex-row sm:items-end">
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-bold uppercase tracking-wide text-foreground-500">
                      Nº da CAT emitida no eSocial / Empregador Web
                      <input
                        value={numberDraft}
                        onChange={(e) => setNumberDraft(e.target.value)}
                        placeholder="Ex.: 2026/000123456"
                        className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm font-medium text-foreground-900 focus:border-primary-400 focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSaveNumber(record)}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-[11px] font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:opacity-60"
                    >
                      <i className={saving ? "ri-loader-4-line" : "ri-save-3-line"}></i>
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setNumberDraft("");
                      }}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}