import { useMemo, useState } from "react";
import { SectionCard } from "@/pages/app/components/ui";
import { useAtas, useCipas, updateAta } from "@/pages/app/modules/cipa/cipaStore";
import { ataApprovalSignatureImages } from "@/pages/app/modules/cipa/ataSignatureImages";
import { collaboratorIdByName, ensureRequiredApprovers, type AtaApprover } from "@/pages/app/modules/cipa/cipaUtils";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import { addDocument, buildAtaDocument } from "@/pages/app/modules/documentos/documentsStore";
import AtaSelfSignModal from "@/pages/app/modules/cipa/components/AtaSelfSignModal";
import type { CipaAta } from "@/mocks/cipa";

interface AtaPendingSignaturesPanelProps {
  collaboratorId: string;
  collaboratorName: string;
}

/**
 * Atas da CIPA aguardando a assinatura eletrônica do colaborador logado.
 * Aparece apenas quando existe pendência (presidente, secretário ou
 * responsável técnico). A assinatura atualiza a ata e o documento vinculado.
 */
export default function AtaPendingSignaturesPanel({
  collaboratorId,
  collaboratorName,
}: AtaPendingSignaturesPanelProps) {
  const atas = useAtas();
  const cipas = useCipas();
  const registered = useCollaboratorsList();
  const settings = useSystemSettings();
  const [target, setTarget] = useState<CipaAta | null>(null);
  const [notice, setNotice] = useState("");

  const technicalResponsible = useMemo<AtaApprover | null>(() => {
    const flagged = registered.find((c) => c.technicalResponsible);
    if (flagged) {
      return { role: "Responsável Técnico", name: flagged.name, collaboratorId: flagged.id };
    }
    const name = settings.technicalResponsible.trim();
    if (!name) return null;
    return { role: "Responsável Técnico", name, collaboratorId: collaboratorIdByName(name) };
  }, [registered, settings.technicalResponsible]);

  /** Inclui os signatários obrigatórios mesmo antes da coleta pela gestão. */
  const prepared = useMemo(
    () =>
      atas.map((ata) =>
        ensureRequiredApprovers(ata, cipas.find((c) => c.id === ata.cipaId), technicalResponsible)
      ),
    [atas, cipas, technicalResponsible]
  );

  const pending = useMemo(() => {
    if (!collaboratorId && !collaboratorName) return [];
    return prepared.filter((ata) =>
      ata.approvals.some(
        (a) =>
          !a.signedAt &&
          !a.representationSnapshot &&
          ((collaboratorId && a.collaboratorId === collaboratorId) || a.name === collaboratorName)
      )
    );
  }, [prepared, collaboratorId, collaboratorName]);

  const handleSign = async (updated: CipaAta) => {
    updateAta(updated);
    const cipa = cipas.find((c) => c.id === updated.cipaId);
    const images = await ataApprovalSignatureImages(updated);
    addDocument(buildAtaDocument(updated, cipa?.name, cipa?.unit, images));
    setNotice(`Assinatura registrada na ata "${updated.title}".`);
  };

  if (pending.length === 0) return null;

  return (
    <SectionCard
      title="Atas da CIPA aguardando sua assinatura"
      subtitle="Você foi indicado como signatário da ata e precisa confirmar eletronicamente"
      action={
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-900">
          <i className="ri-quill-pen-line"></i>
          {pending.length} pendente(s)
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

      <ul className="flex flex-col gap-3">
        {pending.map((ata) => {
          const cipa = cipas.find((c) => c.id === ata.cipaId);
          const role = ata.approvals.find(
            (a) => (collaboratorId && a.collaboratorId === collaboratorId) || a.name === collaboratorName
          )?.role;
          return (
            <li
              key={ata.id}
              className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-800">
                <i className="ri-file-text-line text-lg"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-950">{ata.title}</p>
                <p className="truncate text-xs text-foreground-500">
                  {cipa?.name || "CIPA"} · Ata nº {ata.number || "—"} · {ata.date}
                  {role ? ` · ${role}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTarget(ata)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-pen-nib-line"></i>
                Assinar ata
              </button>
            </li>
          );
        })}
      </ul>

      <AtaSelfSignModal
        ata={target}
        cipaName={cipas.find((c) => c.id === target?.cipaId)?.name}
        collaboratorId={collaboratorId}
        collaboratorName={collaboratorName}
        onClose={() => setTarget(null)}
        onSign={handleSign}
      />
    </SectionCard>
  );
}