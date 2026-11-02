import { useState, type ReactNode } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import {
  demoFleetPlates,
  demoShowcasePlate,
  missingPhotoSlots,
  photosForSlot,
  vehiclePhotoSlots,
  type Vehicle,
  type VehicleDocument,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import {
  limparFrotaDemo,
  salvarDocumentoVeiculo,
  salvarVeiculo,
  uploadVehicleFile,
} from "@/pages/app/modules/veiculos/vehiclesStore";
import {
  buildCrlvContent,
  buildDemoDocumentPdf,
  buildInsuranceContent,
} from "@/pages/app/modules/veiculos/demoDocumentFiles";
import { buildDemoVehiclePhoto } from "@/pages/app/modules/veiculos/demoVehiclePhotos";

interface Props {
  open: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  documents: VehicleDocument[];
  canClear: boolean;
  onToast: (kind: "ok" | "err", text: string) => void;
}

type Task = "docs" | "photos" | "clear" | null;

interface DemoDocSpec {
  typeKey: string;
  typeLabel: string;
  number: string;
  issuedAt: string;
  expiresAt: string;
  build: (vehicle: Vehicle) => ReturnType<typeof buildCrlvContent>;
}

const demoDocs: DemoDocSpec[] = [
  {
    typeKey: "crlv",
    typeLabel: "CRLV-e",
    number: "CRLV-e 2026/0034817",
    issuedAt: "28/08/2026",
    expiresAt: "28/08/2027",
    build: buildCrlvContent,
  },
  {
    typeKey: "seguro",
    typeLabel: "Apólice de seguro",
    number: "0531.2026.00A1A23",
    issuedAt: "20/05/2026",
    expiresAt: "20/05/2027",
    build: buildInsuranceContent,
  },
];

function StepCard({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: string;
  tone: "primary" | "accent" | "danger";
  title: string;
  description: string;
  children: ReactNode;
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    accent: "bg-accent-100 text-accent-800",
    danger: "bg-danger-100 text-danger-800",
  };
  return (
    <div className="rounded-xl border border-background-200 bg-background-50 p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass[tone]}`}>
          <i className={`${icon} text-base`}></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm font-bold text-foreground-950">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-foreground-500">{description}</p>
          <div className="mt-3 flex flex-col gap-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function DemoDataModal({ open, onClose, vehicles, documents, canClear, onToast }: Props) {
  const [task, setTask] = useState<Task>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const demoVehicles = vehicles.filter((vehicle) =>
    demoFleetPlates.includes(vehicle.plateNormalized || vehicle.plate)
  );
  const showcase = demoVehicles.find(
    (vehicle) => vehicle.plateNormalized === demoShowcasePlate || vehicle.plate === demoShowcasePlate
  );
  const showcaseDocs = showcase
    ? documents.filter((doc) => doc.vehicleRef === showcase.ref && doc.isCurrent)
    : [];
  const existingTypes = new Set(showcaseDocs.map((doc) => doc.typeKey));
  const photoStatus = demoVehicles.map((vehicle) => ({
    vehicle,
    missing: missingPhotoSlots(vehicle.photos),
  }));
  const vehiclesWithAllPhotos = photoStatus.filter((item) => item.missing.length === 0).length;
  const missingSides = photoStatus.reduce((total, item) => total + item.missing.length, 0);

  const close = () => {
    if (task) return;
    setConfirmClear(false);
    setResult(null);
    onClose();
  };

  const attachDemoFiles = async () => {
    if (!showcase) {
      setResult({
        kind: "err",
        text: "Não encontrei o veículo VGA1A23 nesta empresa. A frota de demonstração pode ter sido removida.",
      });
      return;
    }
    setTask("docs");
    setResult(null);
    const done: string[] = [];
    const failures: string[] = [];

    for (const spec of demoDocs) {
      if (existingTypes.has(spec.typeKey)) {
        done.push(`${spec.typeLabel} (já existia, mantido)`);
        continue;
      }
      try {
        const content = spec.build(showcase);
        const file = await buildDemoDocumentPdf(content);
        const uploaded = await uploadVehicleFile(file);
        if (!uploaded?.path) {
          failures.push(`${spec.typeLabel}: falha no envio do arquivo.`);
          continue;
        }
        const saved = await salvarDocumentoVeiculo({
          vehicleRef: showcase.ref,
          typeKey: spec.typeKey,
          typeLabel: spec.typeLabel,
          purpose: "",
          number: spec.number,
          issuedAt: spec.issuedAt,
          expiresAt: spec.expiresAt,
          responsible: "Ana Paula Ribeiro · SESMT",
          fileUrl: uploaded.url ?? "",
          storagePath: uploaded.path,
          fileType: "application/pdf",
          fileSize: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          notes: "Arquivo fictício gerado para demonstrar a abertura do documento por link assinado.",
        });
        if (saved.ok) {
          done.push(spec.typeLabel);
        } else {
          failures.push(`${spec.typeLabel}: ${saved.detail || saved.error || "não foi possível registrar."}`);
        }
      } catch (error) {
        failures.push(
          `${spec.typeLabel}: ${error instanceof Error ? error.message : "erro inesperado na geração do PDF."}`
        );
      }
    }

    setTask(null);
    if (failures.length > 0) {
      setResult({
        kind: "err",
        text: `${done.length > 0 ? `Anexado: ${done.join(", ")}. ` : ""}${failures.join(" ")}`,
      });
      onToast("err", "Um dos arquivos fictícios não pôde ser anexado.");
      return;
    }
    const message = `Arquivos fictícios prontos: ${done.join(", ")}. Abra a aba Documentos e clique em "Arquivo" para abrir o PDF pelo link assinado (válido por 1 hora).`;
    setResult({ kind: "ok", text: message });
    onToast("ok", "CRLV e apólice fictícios anexados ao veículo de demonstração.");
  };

  const attachDemoPhotos = async () => {
    if (demoVehicles.length === 0) {
      setResult({
        kind: "err",
        text: "Nenhum veículo de demonstração nesta empresa. A frota fictícia pode ter sido removida.",
      });
      return;
    }
    setTask("photos");
    setResult(null);
    const done: string[] = [];
    const failures: string[] = [];

    for (const vehicle of demoVehicles) {
      const missing = vehiclePhotoSlots.filter(
        (slot) => photosForSlot(vehicle.photos, slot.key).length === 0
      );
      if (missing.length === 0) {
        done.push(`${vehicle.plate} (já tinha as 4)`);
        continue;
      }
      try {
        const uploaded: string[] = [];
        for (const slot of missing) {
          const file = await buildDemoVehiclePhoto(vehicle, slot.key);
          const result = await uploadVehicleFile(file, slot.key);
          if (!result?.path) {
            throw new Error(`falhou o envio da foto da ${slot.label.toLowerCase()}`);
          }
          uploaded.push(result.path);
        }
        const saved = await salvarVeiculo({
          ...vehicle,
          // As fotos novas vão na frente para o limite de 6 não cortar nenhuma lateral.
          photos: [...uploaded, ...vehicle.photos].slice(0, 6),
        });
        if (!saved.ok) {
          failures.push(`${vehicle.plate}: ${saved.detail || saved.error || "não foi possível salvar o veículo."}`);
          continue;
        }
        done.push(`${vehicle.plate} (${uploaded.length} foto(s))`);
      } catch (error) {
        failures.push(
          `${vehicle.plate}: ${error instanceof Error ? error.message : "erro inesperado na geração da foto."}`
        );
      }
    }

    setTask(null);
    if (failures.length > 0) {
      setResult({
        kind: "err",
        text: `${done.length > 0 ? `Anexado: ${done.join(", ")}. ` : ""}${failures.join(" ")}`,
      });
      onToast("err", "Alguma foto de demonstração não pôde ser anexada.");
      return;
    }
    const message = `Laterais anexadas: ${done.join(", ")}. Abra a ficha de cada veículo para ver as fotos rotuladas por lateral.`;
    setResult({ kind: "ok", text: message });
    onToast("ok", "As 4 laterais dos veículos de demonstração estão anexadas.");
  };

  const clearFleet = async () => {
    setTask("clear");
    setResult(null);
    const response = await limparFrotaDemo();
    setTask(null);
    setConfirmClear(false);
    if (!response.ok) {
      const text = response.detail || response.error || "Não foi possível limpar a frota de demonstração.";
      setResult({ kind: "err", text });
      onToast("err", text);
      return;
    }
    const text = response.detail || "Frota de demonstração removida.";
    setResult({ kind: "ok", text });
    onToast("ok", text);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      icon="ri-flask-line"
      title="Dados de demonstração da frota"
      subtitle="Atalhos para preparar e limpar a frota fictícia usada em apresentações. Tudo passa pelo servidor: nada é gravado só na tela."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-background-100 px-4 py-3 text-[11px] text-foreground-600">
          <span>
            <strong className="font-bold text-foreground-900">{demoVehicles.length}</strong> veículo(s)
            fictício(s) nesta empresa
          </span>
          <span>
            <strong className="font-bold text-foreground-900">{showcaseDocs.length}</strong> documento(s) no
            veículo de vitrine
          </span>
          <span>
            <strong className="font-bold text-foreground-900">{vehiclesWithAllPhotos}/{demoVehicles.length}</strong> com
            as 4 laterais
          </span>
          <span className="flex items-center gap-1">
            <i className="ri-shield-check-line text-primary-600"></i>
            Escrita auditada no servidor
          </span>
        </div>

        <StepCard
          icon="ri-shield-check-line"
          tone="primary"
          title="Checklist e inspeção da vitrine"
          description="O modelo versionado “Inspeção diária — frota leve” (8 itens, 1 crítico) já está publicado e há uma inspeção registrada no VGA1A23 com um achado de iluminação em aberto. Abra a aba Inspeções ou a ficha do veículo para ver o histórico."
        >
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-background-100 px-2.5 py-1 font-semibold text-foreground-600">
              v1 · 8 itens
            </span>
            <span className="rounded-full bg-primary-100 px-2.5 py-1 font-semibold text-primary-700">
              1 inspeção registrada
            </span>
            <span className="rounded-full bg-accent-100 px-2.5 py-1 font-semibold text-accent-800">
              1 achado em aberto
            </span>
          </div>
        </StepCard>

        <StepCard
          icon="ri-image-line"
          tone="primary"
          title="Fotos das 4 laterais"
          description="Gera as fotos de frente, lateral esquerda, lateral direita e traseira de cada veículo fictício, envia para o bucket privado com o código da lateral no nome do arquivo e salva no cadastro. É o mesmo caminho do cadastro real — a ficha mostra cada foto com o seu rótulo."
        >
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {photoStatus.map((item) => (
              <span
                key={item.vehicle.ref}
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  item.missing.length === 0
                    ? "bg-primary-100 text-primary-700"
                    : "bg-background-100 text-foreground-600"
                }`}
              >
                {item.vehicle.plate} · {
                  item.missing.length === 0 ? "4/4 laterais" : `faltam ${item.missing.length}`
                }
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void attachDemoPhotos()}
            disabled={task !== null || demoVehicles.length === 0 || missingSides === 0}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <i className={task === "photos" ? "ri-loader-4-line animate-spin" : "ri-image-add-line"}></i>
            {task === "photos"
              ? "Gerando e anexando..."
              : missingSides === 0
                ? "Todas as laterais já estão anexadas"
                : `Anexar ${missingSides} lateral(is) faltante(s)`}
          </button>
        </StepCard>

        <StepCard
          icon="ri-attachment-2"
          tone="accent"
          title="CRLV e apólice fictícios"
          description="Gera dois PDFs de demonstração, envia para o bucket privado e registra os documentos em nome do veículo VGA1A23. É o caminho real de upload — serve para testar a abertura por link assinado."
        >
          <button
            type="button"
            onClick={() => void attachDemoFiles()}
            disabled={task !== null || !showcase}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-accent-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <i className={task === "docs" ? "ri-loader-4-line animate-spin" : "ri-file-add-line"}></i>
            {task === "docs" ? "Gerando e anexando..." : "Gerar e anexar arquivos"}
          </button>
          {!showcase && (
            <p className="text-[11px] text-foreground-500">
              O veículo VGA1A23 não está nesta empresa — os arquivos só podem ser anexados nele.
            </p>
          )}
        </StepCard>

        <StepCard
          icon="ri-delete-bin-6-line"
          tone="danger"
          title="Comando de limpeza da frota"
          description="Remove os três veículos fictícios (VGA1A23, VGA2B34 e VGA3C45) desta empresa junto com documentos, arquivos do bucket, inspeções, achados, bloqueios, EPCs e check-ins. O checklist publicado e as exigências documentais permanecem."
        >
          {!canClear ? (
            <p className="text-[11px] text-foreground-500">
              Só o administrador da empresa, com permissão de edição de veículos, pode executar a limpeza.
            </p>
          ) : confirmClear ? (
            <div className="flex flex-col gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold leading-relaxed text-danger-900">
                Confirma a remoção definitiva dos veículos de demonstração desta empresa? A ação não pode ser
                desfeita pelo app.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void clearFleet()}
                  disabled={task !== null}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-danger-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className={task === "clear" ? "ri-loader-4-line animate-spin" : "ri-delete-bin-6-line"}></i>
                  {task === "clear" ? "Removendo..." : "Sim, remover frota"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  disabled={task !== null}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={task !== null || demoVehicles.length === 0}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-danger-300 bg-danger-50 px-4 py-2.5 text-sm font-semibold text-danger-800 transition-colors hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <i className="ri-delete-bin-6-line"></i>
              Limpar frota de demonstração
            </button>
          )}
          {demoVehicles.length === 0 && (
            <p className="text-[11px] text-foreground-500">Nenhum veículo de demonstração encontrado nesta empresa.</p>
          )}
        </StepCard>

        {result && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3.5 py-3 text-xs leading-relaxed ${
              result.kind === "ok"
                ? "bg-primary-50 text-primary-900"
                : "bg-danger-50 text-danger-900"
            }`}
            role="status"
          >
            <i
              className={`mt-0.5 ${
                result.kind === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"
              }`}
            ></i>
            <span>{result.text}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <ModalButton variant="ghost" onClick={close} disabled={task !== null}>
          Fechar
        </ModalButton>
      </div>
    </Modal>
  );
}