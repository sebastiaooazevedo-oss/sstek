import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/pages/app/components/ui";
import SignatureStamp from "@/components/base/SignatureStamp";
import ExportMenu from "@/pages/app/components/ExportMenu";
import { useSignatures } from "@/pages/app/signature/signatureStore";
import { getSignatureFont } from "@/pages/app/signature/signatureFonts";
import { resolveSignatureName } from "@/pages/app/signature/signatureUtils";
import { pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import { collaborators } from "@/mocks/collaborators";

type Filter = "all" | "created" | "pending";

/**
 * Painel do Administrador que lista os colaboradores e mostra quem já criou
 * a assinatura pessoal (com prévia) e quem ainda está pendente.
 */
export default function SignaturePanel() {
  const signatures = useSignatures();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(
    () =>
      collaborators
        .map((collaborator) => ({ collaborator, signature: signatures[collaborator.id] ?? null }))
        .filter((row) => (filter === "all" ? true : filter === "created" ? !!row.signature : !row.signature)),
    [signatures, filter]
  );

  const total = collaborators.length;
  const created = collaborators.filter((c) => signatures[c.id]).length;
  const pending = total - created;
  const pct = total > 0 ? Math.round((created / total) * 100) : 0;

  /* Linhas da exportação — respeitam o filtro selecionado (todos / criadas / pendentes). */
  const buildExportRows = () =>
    list.map(({ collaborator, signature }) => ({
      name: collaborator.name,
      role: collaborator.role,
      area: collaborator.area,
      signatureText: signature ? resolveSignatureName(collaborator.name, signature.nameStyle) : "",
      model: signature
        ? signature.kind === "draw"
          ? "Desenhada à mão"
          : `${getSignatureFont(signature.fontModel).label} · ${
              signature.nameStyle === "full" ? "Nome completo" : "Nome parcial"
            }`
        : "—",
      status: signature ? "Criada" : "Pendente",
    }));

  const exportHeaders = ["Colaborador", "Função", "Área", "Assinatura", "Modelo", "Situação"];

  const handleExportPdf = () => {
    const rows = buildExportRows();
    const body = `${pdfHeader("Relatório de assinaturas pessoais")}
      <h1>Assinaturas pessoais dos colaboradores</h1>
      <p class="muted">Cobertura: ${created} de ${total} colaboradores (${pct}%). Pendentes: ${pending}.</p>
      ${tableHtml(
        exportHeaders,
        rows.map((r) => [r.name, r.role, r.area, r.signatureText || "—", r.model, r.status])
      )}
      ${pdfFooter()}`;
    printHtml("Assinaturas pessoais dos colaboradores — SSTEK", body);
  };

  const handleExportCsv = () => {
    const rows = buildExportRows();
    downloadCsv(
      "assinaturas-colaboradores.csv",
      exportHeaders,
      rows.map((r) => [r.name, r.role, r.area, r.signatureText, r.model, r.status])
    );
  };

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: total },
    { id: "created", label: "Com assinatura", count: created },
    { id: "pending", label: "Pendentes", count: pending },
  ];

  return (
    <SectionCard
      title="Assinaturas pessoais dos colaboradores"
      subtitle="Acompanhe quem já criou a assinatura que será usada em todos os documentos assinados."
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/app/colaboradores"
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
          >
            <i className="ri-team-line"></i>
            Ver colaboradores
          </Link>
          <ExportMenu onExportPdf={handleExportPdf} onExportCsv={handleExportCsv} />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-background-200 bg-background-100 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground-700">Cobertura de assinaturas</span>
            <span className="text-sm font-bold text-foreground-950">{pct}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background-200">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }}></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
              <i className="ri-verified-badge-line"></i>
              {created} criada(s)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-800">
              <i className="ri-error-warning-line"></i>
              {pending} pendente(s)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-background-200 bg-background-100 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className="ri-quill-pen-line text-lg"></i>
          </span>
          <p className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{total}</p>
          <p className="text-xs font-medium text-foreground-500">Colaboradores cadastrados</p>
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-1 rounded-full bg-background-100 px-1 py-1">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              filter === chip.id ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
            }`}
          >
            {chip.label}
            <span
              className={`rounded-full px-1.5 text-[10px] font-bold ${
                filter === chip.id ? "bg-foreground-950/20 text-background-50" : "bg-background-200 text-foreground-600"
              }`}
            >
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-background-200 text-left">
              <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                Colaborador
              </th>
              <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                Função / Área
              </th>
              <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                Assinatura
              </th>
              <th className="px-2 py-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Modelo</th>
              <th className="px-2 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ collaborator, signature }) => (
              <tr key={collaborator.id} className="border-b border-background-100 transition-colors last:border-0 hover:bg-background-50">
                <td className="px-2 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-background-200 bg-background-100">
                      <img src={collaborator.photo} alt={collaborator.name} className="h-full w-full object-top" />
                    </div>
                    <span className="truncate text-sm font-semibold text-foreground-950">{collaborator.name}</span>
                  </div>
                </td>
                <td className="px-2 py-3.5">
                  <p className="text-sm text-foreground-800">{collaborator.role}</p>
                  <p className="text-xs text-foreground-400">{collaborator.area}</p>
                </td>
                <td className="px-2 py-3.5">
                  {signature ? (
                    <SignatureStamp
                      name={collaborator.name}
                      font={signature.fontModel}
                      nameStyle={signature.nameStyle}
                      imageData={signature.imageData}
                      size={24}
                      className="text-primary-800"
                    />
                  ) : (
                    <span className="text-xs italic text-foreground-400">Não criada</span>
                  )}
                </td>
                <td className="px-2 py-3.5">
                  {signature ? (
                    <span className="text-xs text-foreground-600">
                      {signature.kind === "draw"
                        ? "Desenhada à mão"
                        : `${getSignatureFont(signature.fontModel).label} · ${
                            signature.nameStyle === "full" ? "Nome completo" : "Nome parcial"
                          }`}
                    </span>
                  ) : (
                    <span className="text-xs text-foreground-400">—</span>
                  )}
                </td>
                <td className="px-2 py-3.5 text-right">
                  {signature ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                      <i className="ri-checkbox-circle-line"></i>
                      Criada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-background-200 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">
                      <i className="ri-time-line"></i>
                      Pendente
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-quill-pen-line text-xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhum colaborador nesta condição</p>
            <p className="text-xs text-foreground-500">Ajuste o filtro para ver os demais colaboradores.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}