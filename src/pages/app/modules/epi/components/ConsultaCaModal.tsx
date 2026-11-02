import { useEffect, useState } from "react";
import Modal, { ModalButton, inputClass } from "@/pages/app/components/Modal";
import { printHtml } from "@/pages/app/utils/exportPdf";
import { epiCatalog } from "@/mocks/epi";
import { caValidityStatus, findEpiByCa } from "@/pages/app/modules/epi/epiUtils";
import { consultarCaOficial, buildOfficialCaReport, type CaConsultaResult } from "@/pages/app/modules/epi/caService";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";

interface ConsultaCaModalProps {
  open: boolean;
  onClose: () => void;
  initialCa?: string;
  onAdd?: (item: { name: string; ca: string }) => void;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-background-200 bg-background-100 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground-900">{value || "-"}</p>
    </div>
  );
}

/** Monta um resultado a partir do catalogo interno, no mesmo formato da consulta oficial. */
function fromCatalog(ca: string): CaConsultaResult | null {
  const item = findEpiByCa(ca);
  if (!item) return null;
  return {
    found: true,
    ca: item.ca,
    active: item.active,
    name: item.name,
    validity: item.active ? item.approvalValidity : undefined,
    source: "catalogo",
    fields: [
      { label: "Categoria", value: item.category },
      { label: "Fabricante", value: item.manufacturer },
      { label: "Norma tecnica", value: item.norm },
      { label: "Validade do CA", value: item.approvalValidity },
      { label: "Tamanhos", value: item.sizes },
      { label: "Descricao", value: item.description },
      { label: "Restricao de uso", value: item.restriction },
      ...(!item.active && item.inactiveReason ? [{ label: "Motivo da inativacao", value: item.inactiveReason }] : []),
    ],
  };
}

export default function ConsultaCaModal({ open, onClose, initialCa = "", onAdd }: ConsultaCaModalProps) {
  const { validarCaAtivoNoEpi, permitirCaNaoEncontrado, permitirCaVencido } = useSystemSettings();
  const [query, setQuery] = useState(initialCa);
  const [result, setResult] = useState<CaConsultaResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  const runSearch = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResult(null);
      setSearched(false);
      return;
    }
    setLoading(true);
    setPortalError("");
    try {
      const oficial = await consultarCaOficial(trimmed);
      if (oficial.found) {
        setResult(oficial);
      } else {
        if (oficial.error) setPortalError(oficial.error);
        setResult(fromCatalog(trimmed));
      }
    } catch {
      setPortalError("Nao foi possivel consultar o portal oficial do CAEPI agora.");
      setResult(fromCatalog(trimmed));
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setQuery(initialCa);
    setPortalError("");
    if (initialCa.trim()) {
      void runSearch(initialCa);
    } else {
      setResult(null);
      setSearched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCa]);

  const notFound = searched && !loading && !result;
  const validityStatus = result?.validity ? caValidityStatus(result.validity) : null;
  const isExpired = validityStatus === "Vencido" || result?.active === false;
  const blockedByRule =
    Boolean(result && validarCaAtivoNoEpi && isExpired && !permitirCaVencido) ||
    Boolean(notFound && !permitirCaNaoEncontrado);
  const canAdd = Boolean(onAdd && result && !blockedByRule);

  const handleExportLaudo = (item: CaConsultaResult) => {
    printHtml(`Laudo de equipamento - CA ${item.ca}`, buildOfficialCaReport(item));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Consultar CA do EPI"
      subtitle="Digite o numero do Certificado de Aprovacao (CA) para consultar o portal oficial do CAEPI (MTE)."
      icon="ri-search-eye-line"
      size="lg"
      footer={
        <>
          {result && (
            <ModalButton variant="ghost" onClick={() => handleExportLaudo(result)} icon="ri-file-pdf-2-line">
              Exportar laudo (PDF)
            </ModalButton>
          )}
          {canAdd && result && (
            <ModalButton
              onClick={() => {
                onAdd?.({ name: result.name || `Equipamento CA ${result.ca}`, ca: result.ca });
                onClose();
              }}
              icon="ri-add-line"
            >
              Adicionar a entrega
            </ModalButton>
          )}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <i className="ri-shield-check-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
          <input
            className={`${inputClass} pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch(query);
              }
            }}
            placeholder="Ex.: 31.469 ou 31469"
            aria-label="Numero do CA"
          />
        </div>
        <button
          type="button"
          onClick={() => void runSearch(query)}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <i className={loading ? "ri-loader-4-line animate-spin text-base" : "ri-search-line text-base"}></i>
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      {portalError && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-accent-200 bg-accent-100/70 px-3 py-2.5 text-xs text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>
            <strong className="font-semibold">Portal oficial indisponivel no momento:</strong> {portalError}
            {result?.source === "catalogo" && " Exibindo os dados do catalogo interno como referencia."}
          </span>
        </div>
      )}

      {result ? (
        <div className="mt-4 rounded-lg border border-background-200 bg-background-50">
          <div className="flex items-start gap-3 border-b border-background-200 p-4">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                isExpired ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
              }`}
            >
              <i className={isExpired ? "ri-shield-cross-line text-xl" : "ri-shield-check-line text-xl"}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground-950">{result.name || `Equipamento CA ${result.ca}`}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-semibold text-secondary-900">
                  {result.source === "oficial" ? "Portal oficial CAEPI" : "Catalogo interno"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    isExpired ? "bg-accent-200 text-accent-900" : "bg-primary-100 text-primary-700"
                  }`}
                >
                  <i className={isExpired ? "ri-close-circle-line" : "ri-checkbox-circle-line"}></i>
                  CA {isExpired ? "vencido/inativo" : "ativo"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <Info label="CA" value={result.ca} />
            {result.validity && <Info label="Validade do CA" value={result.validity} />}
            {result.fields.map((field) => (
              <Info key={field.label} label={field.label} value={field.value} />
            ))}
          </div>

          {isExpired && (
            <div className="px-4 pb-4">
              <div className="flex items-start gap-2 rounded-md border border-accent-300 bg-accent-100 px-3 py-2.5 text-xs text-accent-900">
                <i className="ri-shield-cross-line mt-0.5 text-base"></i>
                <span>
                  <strong className="font-semibold">CA vencido ou inativo.</strong>{" "}
                  {validarCaAtivoNoEpi && !permitirCaVencido
                    ? "A validacao de CA ativo esta habilitada e a parametrizacao nao permite CA vencido, portanto este equipamento nao pode ser adicionado a uma nova entrega."
                    : "A parametrizacao do sistema permite incluir equipamentos com CA vencido."}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`mt-4 flex items-start gap-3 rounded-lg border px-4 py-3.5 ${
            notFound ? "border-accent-200 bg-accent-100/70" : "border-background-200 bg-background-100"
          }`}
        >
          <i
            className={`mt-0.5 text-lg ${
              notFound ? "ri-error-warning-line text-accent-800" : "ri-information-line text-foreground-400"
            }`}
          ></i>
          <div className="text-xs">
            <p className={`font-semibold ${notFound ? "text-accent-900" : "text-foreground-800"}`}>
              {notFound ? "CA nao encontrado no portal oficial nem no catalogo interno." : "Informe o numero do CA e clique em Consultar."}
            </p>
            <p className={`mt-0.5 ${notFound ? "text-accent-800" : "text-foreground-500"}`}>
              {notFound
                ? permitirCaNaoEncontrado
                  ? "A parametrizacao do sistema permite incluir equipamentos com CA nao encontrado."
                  : "Confira o numero do Certificado de Aprovacao impresso no equipamento e tente novamente."
                : "Voce pode digitar com ou sem os pontos - o resultado e o mesmo."}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
          CAs do catalogo interno (referencia offline)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {epiCatalog.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.name}
              onClick={() => {
                setQuery(item.ca);
                void runSearch(item.ca);
              }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                item.active
                  ? "border-background-300 bg-background-50 text-foreground-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                  : "border-accent-200 bg-accent-100/60 text-accent-900 hover:border-accent-300"
              }`}
            >
              <i className={item.active ? "ri-hashtag" : "ri-shield-cross-line"}></i>
              {item.ca}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}