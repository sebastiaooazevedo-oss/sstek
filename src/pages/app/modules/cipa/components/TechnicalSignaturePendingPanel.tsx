import { useMemo, useState } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { useCipas, useElections, useInspections } from "@/pages/app/modules/cipa/cipaStore";
import {
  useTechnicalSignatures,
  type TechnicalSignatureScope,
} from "@/pages/app/modules/cipa/technicalSignatureStore";
import { useTechnicalResponsible, useTechnicalSigner } from "@/pages/app/modules/cipa/technicalResponsible";
import TechnicalSignatureModal, {
  type TechnicalSignatureRequest,
} from "@/pages/app/modules/cipa/components/TechnicalSignatureModal";
import { brDateToTime } from "@/pages/app/modules/cipa/cipaUtils";

interface PendingTechnicalDocument {
  key: string;
  scope: TechnicalSignatureScope;
  referenceRef: string;
  label: string;
  description: string;
  icon: string;
  context: string;
  date: string;
}

/**
 * Pendências de assinatura do Responsável Técnico nos documentos técnicos da
 * CIPA (ficha de cadastro, inspeções e dossiê do processo eleitoral). Aparece
 * apenas para o RT no painel dele — é o mesmo ato que libera a emissão
 * definitiva desses documentos.
 */
export default function TechnicalSignaturePendingPanel() {
  const cipas = useCipas();
  const inspections = useInspections();
  const elections = useElections();
  const signatures = useTechnicalSignatures();
  const signer = useTechnicalSigner();
  const responsible = useTechnicalResponsible();
  const [target, setTarget] = useState<TechnicalSignatureRequest | null>(null);
  const [notice, setNotice] = useState("");

  const documents = useMemo<PendingTechnicalDocument[]>(() => {
    const list: PendingTechnicalDocument[] = [];

    cipas.forEach((cipa) => {
      list.push({
        key: `ficha-${cipa.id}`,
        scope: "ficha-cipa",
        referenceRef: cipa.id,
        label: `Ficha de Cadastro da CIPA — ${cipa.name}`,
        description: "Documento de constituição da comissão e enquadramento no Quadro I da NR-5.",
        icon: "ri-government-line",
        context: cipa.unit || cipa.name,
        date: cipa.mandateStart || "",
      });
    });

    inspections.forEach((inspection) => {
      const cipaName = cipas.find((c) => c.id === inspection.cipaId)?.name || "CIPA";
      list.push({
        key: `inspecao-${inspection.id}`,
        scope: "inspecao-cipa",
        referenceRef: inspection.id,
        label: `Inspeção da CIPA — ${inspection.title}`,
        description: "Relatório de inspeção com itens verificados, não conformidades e fotos.",
        icon: "ri-clipboard-line",
        context: `${cipaName}${inspection.area ? ` · ${inspection.area}` : ""}`,
        date: inspection.date,
      });
    });

    elections
      .filter((election) => election.status === "Apurada" || election.status === "Publicada")
      .forEach((election) => {
        const cipaName = cipas.find((c) => c.id === election.cipaId)?.name || "CIPA";
        list.push({
          key: `dossie-${election.id}`,
          scope: "dossie-eleicao",
          referenceRef: election.id,
          label: `Dossiê do Processo Eleitoral — ${election.title}`,
          description: "Convocação, ata da comissão, resultado publicado e termo de posse.",
          icon: "ri-folder-shield-2-line",
          context: `${cipaName} · ${election.processNumber || "sem nº"}`,
          date: election.voteDate || "",
        });
      });

    return list
      .filter(
        (doc) =>
          !signatures.some(
            (signature) => signature.scope === doc.scope && signature.referenceRef === doc.referenceRef
          )
      )
      .sort((a, b) => brDateToTime(b.date) - brDateToTime(a.date));
  }, [cipas, inspections, elections, signatures]);

  if (!signer.isTechnicalResponsible || documents.length === 0) return null;

  return (
    <SectionCard
      title="Documentos técnicos aguardando sua assinatura"
      subtitle="Como Responsável Técnico, a sua assinatura libera a emissão definitiva destes documentos"
      action={
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-900">
          <i className="ri-quill-pen-line"></i>
          {documents.length} pendente(s)
        </span>
      }
    >
      {notice && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <ul className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
        {documents.map((doc) => (
          <li
            key={doc.key}
            className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
              <i className={`${doc.icon} text-lg`}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground-950">{doc.label}</p>
              <p className="truncate text-xs text-foreground-500">
                {doc.context}
                {doc.date ? ` · ${doc.date}` : ""}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground-400">{doc.description}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setTarget({
                  scope: doc.scope,
                  referenceRef: doc.referenceRef,
                  label: doc.label,
                  description: doc.description,
                })
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-pen-nib-line"></i>
              Assinar
            </button>
          </li>
        ))}
      </ul>

      <TechnicalSignatureModal
        request={target}
        responsible={signer.isTechnicalResponsible ? responsible : null}
        onClose={(signed) => {
          if (signed && target) setNotice(`Assinatura registrada em "${target.label}". Emissão liberada.`);
          setTarget(null);
        }}
      />
    </SectionCard>
  );
}