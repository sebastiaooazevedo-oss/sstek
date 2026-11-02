import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import type { DdsRecord } from "@/mocks/dds";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { getInitials } from "@/pages/app/context";
import SignatureStamp from "@/components/base/SignatureStamp";
import { useSignatures } from "@/pages/app/signature/signatureStore";
import { renderSignaturePng, resolveSignatureName } from "@/pages/app/signature/signatureUtils";
import { sealPrintHtml } from "@/pages/app/signature/authenticitySeal";
import { ddsSeal } from "@/pages/app/modules/dds/ddsUtils";
import { useDocumentSeal } from "@/pages/app/signature/useDocumentSeal";
import SealPreview from "@/components/feature/SealPreview";

interface DdsDetailModalProps {
  record: DdsRecord | null;
  onClose: () => void;
}

export default function DdsDetailModal({ record, onClose }: DdsDetailModalProps) {
  const collaborators = useCollaboratorsList();
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const signatures = useSignatures();

  useEffect(() => {
    setActive(0);
    setLightbox(null);
  }, [record]);

  const participantList = record
    ? record.participantNames.map((name, index) => {
        const collaboratorId = record.participantIds[index] || "";
        return {
          name,
          role: collaborators.find((c) => c.id === collaboratorId)?.role || "",
          collaboratorId,
          signed: Boolean(collaboratorId && signatures[collaboratorId]),
        };
      })
    : [];

  const signedCount = participantList.filter((p) => p.signed).length;

  const { seal, loading: sealLoading } = useDocumentSeal({
    key: record ? `${record.id}:${signedCount}:${record.date}` : "",
    ready: signedCount > 0,
    load: () => (record ? ddsSeal(record, participantList) : Promise.resolve(null)),
  });

  if (!record) return null;

  const gallery = record.cover ? [record.cover, ...record.photos.filter((p) => p !== record.cover)] : record.photos;

  const meta = [
    { icon: "ri-user-star-line", label: "Facilitador", value: record.facilitator },
    { icon: "ri-price-tag-3-line", label: "Tema", value: record.theme },
    { icon: "ri-award-line", label: "Treinamento vinculado", value: record.trainingName || "Não vinculado" },
    { icon: "ri-group-line", label: "Setor", value: record.area },
    { icon: "ri-map-pin-2-line", label: "Local", value: record.location },
    { icon: "ri-timer-line", label: "Duração", value: record.duration },
    { icon: "ri-team-line", label: "Participantes", value: `${record.participants}` },
  ];

  const handleExport = () => {
    const topicRows = record.topics
      .map((topic, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(topic)}</td></tr>`)
      .join("");

    const participantRows = participantList
      .map(
        (p, index) => `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.role) || "—"}</td>
        </tr>`
      )
      .join("");

    const body = `${pdfHeader(`DDS · ${record.date}`)}
      <h1>${escapeHtml(record.title)}</h1>
      <p class="muted">Diálogo Diário de Segurança · ${record.date} às ${record.time} · ${escapeHtml(record.status)}</p>
      <div class="grid">
        <div><strong>Facilitador:</strong> ${escapeHtml(record.facilitator)}</div>
        <div><strong>Tema / Norma:</strong> ${escapeHtml(record.theme)}</div>
        <div><strong>Treinamento vinculado:</strong> ${escapeHtml(record.trainingName || "Não vinculado")}</div>
        <div><strong>Setor:</strong> ${escapeHtml(record.area)}</div>
        <div><strong>Local:</strong> ${escapeHtml(record.location)}</div>
        <div><strong>Duração:</strong> ${escapeHtml(record.duration)}</div>
        <div><strong>Participantes:</strong> ${record.participants}</div>
      </div>
      <h2>Tópicos abordados</h2>
      <table>
        <thead><tr><th>#</th><th>Tópico</th></tr></thead>
        <tbody>${topicRows || '<tr><td colspan="2">Nenhum tópico registrado.</td></tr>'}</tbody>
      </table>
      <h2>Participantes (${participantList.length})</h2>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Função</th></tr></thead>
        <tbody>${participantRows || '<tr><td colspan="3">Nenhum participante vinculado.</td></tr>'}</tbody>
      </table>
      ${record.notes ? `<h2>Observações</h2><p>${escapeHtml(record.notes)}</p>` : ""}
      ${pdfFooter()}`;

    printHtml(`DDS — ${record.title}`, body);
  };

  const handleExportAttendance = async () => {
    const signImages = await Promise.all(
      participantList.map(async (p) => {
        const config = p.collaboratorId ? signatures[p.collaboratorId] : null;
        if (!config) return "";
        if (config.kind === "draw" && config.imageData) return config.imageData;
        try {
          return await renderSignaturePng(
            resolveSignatureName(p.name, config.nameStyle),
            config.fontModel,
            { fontSize: 44 }
          );
        } catch {
          return "";
        }
      })
    );

    const signedTotal = signImages.filter(Boolean).length;
    const attendanceSeal =
      seal ||
      (await ddsSeal(
        record,
        participantList.map((p, index) => ({ name: p.name, role: p.role, signed: Boolean(signImages[index]) }))
      ));

    const rows = participantList
      .map(
        (p, index) => `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.role) || "—"}</td>
          <td class="sign">${
            signImages[index]
              ? `<img src="${signImages[index]}" alt="Assinatura de ${escapeHtml(p.name)}" />`
              : '<span class="empty">(sem assinatura)</span>'
          }</td>
        </tr>`
      )
      .join("");

    const body = `${pdfHeader(`Lista de Presença · DDS ${record.date}`)}
      <h1>${escapeHtml(record.title)}</h1>
      <p class="muted">Lista de presença do Diálogo Diário de Segurança · ${record.date} às ${record.time}</p>
      <div class="grid">
        <div><strong>Facilitador:</strong> ${escapeHtml(record.facilitator)}</div>
        <div><strong>Tema / Norma:</strong> ${escapeHtml(record.theme)}</div>
        <div><strong>Setor:</strong> ${escapeHtml(record.area)}</div>
        <div><strong>Local:</strong> ${escapeHtml(record.location)}</div>
        <div><strong>Duração:</strong> ${escapeHtml(record.duration)}</div>
        <div><strong>Participantes:</strong> ${participantList.length}</div>
        <div><strong>Assinaturas:</strong> ${signedTotal} de ${participantList.length}</div>
      </div>
      <h2>Participantes e assinaturas</h2>
      <table>
        <thead><tr><th>#</th><th>Nome</th><th>Função</th><th>Assinatura</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Nenhum participante vinculado.</td></tr>'}</tbody>
      </table>
      ${record.notes ? `<h2>Observações</h2><p>${escapeHtml(record.notes)}</p>` : ""}
      ${pdfFooter(sealPrintHtml(attendanceSeal))}`;

    printHtml(`Lista de Presença — DDS ${record.date}`, body);
  };

  return (
    <>
      <Modal
        open={!!record}
        onClose={onClose}
        title={record.title}
        subtitle={`${record.date} às ${record.time} · ${record.theme}`}
        icon="ri-presentation-line"
        size="xl"
        footer={
          <>
            <span
              className={`mr-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                record.status === "Realizado" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-800"
              }`}
            >
              <i className={record.status === "Realizado" ? "ri-checkbox-circle-line" : "ri-calendar-schedule-line"}></i>
              {record.status}
            </span>
            <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
              Fechar
            </ModalButton>
            <ModalButton variant="ghost" onClick={handleExportAttendance} icon="ri-list-check-2">
              Lista de presença
            </ModalButton>
            <ModalButton onClick={handleExport} icon="ri-file-pdf-2-line">
              Exportar PDF
            </ModalButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {gallery.length > 0 ? (
              <div>
                <div className="h-56 w-full overflow-hidden rounded-lg border border-background-200 bg-background-100 md:h-72">
                  <img
                    src={gallery[active]}
                    alt={`Foto ${active + 1} do DDS`}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                {gallery.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {gallery.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        onClick={() => setActive(index)}
                        className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                          index === active ? "border-primary-500" : "border-background-200 hover:border-primary-300"
                        }`}
                      >
                        <img src={url} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover object-top" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 text-foreground-400 md:h-72">
                <i className="ri-image-line text-3xl"></i>
                <span className="text-sm">Nenhuma foto anexada a este DDS</span>
              </div>
            )}

            {record.topics.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-bold text-foreground-950">Tópicos abordados</h4>
                <ul className="mt-3 flex flex-col gap-2">
                  {record.topics.map((topic, index) => (
                    <li key={`${topic}-${index}`} className="flex items-start gap-2 text-sm text-foreground-700">
                      <i className="ri-checkbox-circle-line mt-0.5 text-secondary-700"></i>
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {record.notes && (
              <div className="mt-6 rounded-lg border border-background-200 bg-background-100 p-4">
                <h4 className="text-sm font-bold text-foreground-950">Observações</h4>
                <p className="mt-2 text-sm leading-relaxed text-foreground-600">{record.notes}</p>
              </div>
            )}

            {participantList.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-bold text-foreground-950">
                  Participantes <span className="text-foreground-400">({participantList.length})</span>
                </h4>
                <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {participantList.map((p, index) => (
                    <li
                      key={`${p.name}-${index}`}
                      className="flex items-center gap-2.5 rounded-md border border-background-200 bg-background-100 px-3 py-2"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[10px] font-bold text-secondary-900">
                        {getInitials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground-900">{p.name}</span>
                        {p.role && <span className="block truncate text-xs text-foreground-500">{p.role}</span>}
                      </span>
                      {p.collaboratorId && signatures[p.collaboratorId] ? (
                        <SignatureStamp
                          name={p.name}
                          font={signatures[p.collaboratorId].fontModel}
                          nameStyle={signatures[p.collaboratorId].nameStyle}
                          imageData={signatures[p.collaboratorId].imageData}
                          size={22}
                          className="shrink-0 text-primary-700"
                        />
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium text-foreground-400">sem assinatura</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <SealPreview
              className="mt-6"
              seal={seal}
              loading={sealLoading}
              blockedReason={
                signedCount > 0
                  ? undefined
                  : "A chancela da lista de presença é emitida quando ao menos um participante tem assinatura registrada. Sem assinatura não há o que chancelar."
              }
            />
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-lg border border-background-200 bg-background-50 p-4">
              <h4 className="text-sm font-bold text-foreground-950">Informações</h4>
              <ul className="mt-3 flex flex-col gap-3.5">
                {meta.map((item) => (
                  <li key={item.label} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                      <i className={`${item.icon} text-base`}></i>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                        {item.label}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground-900">{item.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-background-200 pt-3 text-xs text-foreground-500">
                Registrado em <strong className="font-semibold text-foreground-700">{record.date}</strong> às {record.time}
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground-950/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-full max-w-4xl">
            <img src={lightbox} alt="Foto ampliada do DDS" className="max-h-[85vh] w-full rounded-lg object-contain" />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Fechar imagem"
              className="mx-auto mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-background-50 text-foreground-800 transition-colors hover:bg-background-200"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
}