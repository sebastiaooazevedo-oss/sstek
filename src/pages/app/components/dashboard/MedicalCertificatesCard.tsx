import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getInitials } from "@/pages/app/context";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import {
  useMedicalCertificates,
  type MedicalCertificate,
} from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import { printMedicalCertificatePdf } from "@/pages/app/modules/meusdocumentos/certificatePdf";
import CertificateViewerModal from "@/pages/app/modules/meusdocumentos/components/CertificateViewerModal";
import CollaboratorDetailModal from "@/pages/app/modules/colaboradores/components/CollaboratorDetailModal";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import type { Collaborator } from "@/mocks/collaborators";

interface MedicalCertificatesCardProps {
  /** Rótulo legível do período selecionado no dashboard. */
  periodText: string;
  /** Unidade aplicada no filtro do dashboard (vazio = todas). */
  unitLabel?: string;
  /** Mesma regra de período usada pelos demais indicadores do dashboard. */
  matchesPeriod: (date: string) => boolean;
}

/** Converte "YYYY-MM-DD" (ou timestamp ISO) em "DD/MM/YYYY". */
function isoToBr(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function brDate(iso: string): string {
  return isoToBr(iso) || "—";
}

/**
 * Card "Atestados médicos recebidos" no painel do administrador.
 *
 * Mostra os atestados enviados pelos colaboradores dentro do período e da
 * unidade selecionados, com o resumo do afastamento. Cada item abre a ficha
 * do colaborador (onde o atestado pode ser visto e exportado em PDF).
 */
export default function MedicalCertificatesCard({
  periodText,
  unitLabel = "",
  matchesPeriod,
}: MedicalCertificatesCardProps) {
  const navigate = useNavigate();
  const certificates = useMedicalCertificates();
  const collaborators = useCollaboratorsList();
  const settings = useSystemSettings();
  const alertDays = settings.certificateLeaveAlertDays;
  const [selected, setSelected] = useState<Collaborator | null>(null);
  const [viewing, setViewing] = useState<MedicalCertificate | null>(null);

  const collabById = useMemo(() => {
    const map = new Map<string, Collaborator>();
    collaborators.forEach((c) => map.set(c.id, c));
    return map;
  }, [collaborators]);

  const unitOf = (cert: MedicalCertificate) =>
    cert.establishment || collabById.get(cert.collaboratorId)?.establishment || "";

  const received = useMemo(
    () =>
      certificates.filter((cert) => {
        const receivedOn = cert.createdAt ? isoToBr(cert.createdAt) : isoToBr(cert.issuedOn);
        if (!matchesPeriod(receivedOn)) return false;
        if (!unitLabel) return true;
        return unitOf(cert) === unitLabel;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [certificates, matchesPeriod, unitLabel, collabById]
  );

  const totalDays = received.reduce((sum, cert) => sum + (cert.leaveDays || 0), 0);
  const withLeave = received.filter((cert) => cert.leaveDays > 0).length;
  const peopleCount = new Set(received.map((cert) => cert.collaboratorId)).size;
  const shown = received.slice(0, 5);

  const openFicha = (cert: MedicalCertificate) => {
    const found = collabById.get(cert.collaboratorId);
    if (!found) {
      navigate(`/app/colaboradores?colaborador=${encodeURIComponent(cert.collaboratorId)}`);
      return;
    }
    setSelected(found);
  };

  const exportPdf = (cert: MedicalCertificate) => {
    const collab = collabById.get(cert.collaboratorId);
    void printMedicalCertificatePdf(cert, { role: collab?.role, unit: collab?.establishment });
  };

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 p-4 md:flex-row md:items-start md:justify-between md:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
              <i className="ri-stethoscope-line text-lg"></i>
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-base font-bold tracking-tight text-foreground-950">
                  Atestados médicos recebidos
                </h2>
                {withLeave > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-bold text-accent-900">
                    <i className="ri-calendar-event-line"></i>
                    {withLeave} com afastamento
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-foreground-500">
                Recebidos em {periodText} · {unitLabel || "Todas as unidades"} · clique na pessoa para abrir a ficha e
                exportar o PDF.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[10px] font-bold text-secondary-900">
              <i className="ri-user-line"></i>
              {peopleCount} colaborador(es)
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-100 px-2.5 py-1 text-[10px] font-bold text-accent-900">
              <i className="ri-time-line"></i>
              {totalDays} dia(s) de afastamento
            </span>
            <Link
              to="/app/colaboradores"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-external-link-line"></i>
              Ver colaboradores
            </Link>
          </div>
        </div>

        <div className="p-4 md:p-5">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-shield-check-line text-2xl"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-800">Nenhum atestado recebido no período</p>
              <p className="text-xs text-foreground-500">
                Quando um colaborador cadastrar um atestado médico, ele aparece aqui com o resumo do afastamento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((cert) => {
                const collab = collabById.get(cert.collaboratorId);
                const unit = unitOf(cert);
                return (
                  <div
                    key={cert.id}
                    className="group flex items-start gap-3 rounded-xl border border-background-200 bg-background-100 p-3.5 transition-all hover:border-primary-200 hover:shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => openFicha(cert)}
                      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[11px] font-bold text-secondary-900">
                        {getInitials(cert.collaboratorName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground-950">
                            {cert.collaboratorName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              cert.leaveDays > 0
                                ? "bg-accent-100 text-accent-900"
                                : "bg-secondary-100 text-secondary-900"
                            }`}
                          >
                            <i className="ri-time-line"></i>
                            {cert.leaveDays > 0 ? `${cert.leaveDays} dia(s)` : "Sem afastamento"}
                          </span>
                          {unit && (
                            <span className="inline-flex items-center gap-1 truncate rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                              <i className="ri-building-4-line"></i>
                              {unit}
                            </span>
                          )}
                          {cert.leaveDays >= alertDays && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-background-50">
                              <i className="ri-alarm-warning-line"></i>
                              afastamento prolongado
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-medium text-foreground-600">
                          {cert.certificateType} · emitido em {brDate(cert.issuedOn)} · CID {cert.cid || "—"}
                          {collab?.role ? ` · ${collab.role}` : ""}
                        </span>
                        {cert.notes && (
                          <span className="mt-1 line-clamp-1 block text-[11px] italic text-foreground-500">
                            “{cert.notes}”
                          </span>
                        )}
                      </span>
                      <i className="ri-arrow-right-s-line mt-1 shrink-0 text-foreground-300 transition-colors group-hover:text-primary-600"></i>
                    </button>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewing(cert)}
                        aria-label="Ver atestado"
                        title="Ver atestado"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-600 transition-colors hover:bg-background-50 hover:text-primary-700"
                      >
                        <i className="ri-eye-line text-base"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPdf(cert)}
                        aria-label="Baixar PDF do atestado"
                        title="Baixar PDF com foto e resumo do afastamento"
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-background-300 bg-background-50 text-foreground-600 transition-colors hover:bg-background-50 hover:text-accent-700"
                      >
                        <i className="ri-file-pdf-2-line text-base"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {received.length > shown.length && (
          <div className="border-t border-background-200 px-5 py-3 text-center">
            <button
              type="button"
              onClick={() => navigate("/app/colaboradores")}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              Ver os {received.length} atestados do período
              <i className="ri-arrow-right-line"></i>
            </button>
          </div>
        )}
      </section>

      <CertificateViewerModal certificate={viewing} onClose={() => setViewing(null)} />

      <CollaboratorDetailModal
        open={selected !== null}
        collaborator={selected}
        onClose={() => setSelected(null)}
        onEdit={(collab) => {
          setSelected(null);
          navigate(`/app/colaboradores?colaborador=${encodeURIComponent(collab.id)}`);
        }}
      />
    </>
  );
}