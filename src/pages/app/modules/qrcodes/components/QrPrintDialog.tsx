import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import QrSticker, { type QrStickerFormat } from "@/pages/app/modules/qrcodes/components/QrSticker";
import QrPrintSheet, { SHEET_PER_PAGE } from "@/pages/app/modules/qrcodes/components/QrPrintSheet";
import { buildHelmetCaMap, resolveSesmtPhone } from "@/pages/app/modules/qrcodes/qrStickerData";
import { useCipas } from "@/pages/app/modules/cipa/cipaCoreStore";
import { useEpis } from "@/pages/app/modules/epi/epiStore";
import { useSystemSettings } from "@/pages/app/settings/settingsStore";
import type { Collaborator } from "@/mocks/collaborators";

const stickerFormats: { id: QrStickerFormat; label: string; hint: string; icon: string }[] = [
  { id: "label", label: "Etiqueta", hint: "Crachá, ficha e prontuário", icon: "ri-square-line" },
  { id: "seal", label: "Selo capacete", hint: "Selo circular para capacete e superfícies curvas", icon: "ri-circle-line" },
  {
    id: "sheet",
    label: "Folha A4 3 × 8",
    hint: "Folha A4 adesiva com 24 adesivos em posições fixas (3 colunas × 8 linhas)",
    icon: "ri-file-list-3-line",
  },
];

export const stickerFormatLabel: Record<QrStickerFormat, string> = {
  label: "etiqueta quadrada",
  seal: "selo circular",
  sheet: "folha A4 adesiva (3 × 8)",
};

interface QrPrintDialogProps {
  open: boolean;
  collaborators: Collaborator[];
  companyName: string;
  subdomain: string;
  onClose: () => void;
  onPrinted: (count: number, format: QrStickerFormat) => void;
}

/** Régua de 3 cm exibida só na pré-visualização, para conferir a medida sem régua. */
function CutMark() {
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <div className="relative h-3 w-[3cm]">
        <span className="absolute bottom-0 left-0 h-px w-full bg-foreground-400"></span>
        <span className="absolute bottom-0 left-0 h-3 w-px bg-foreground-400"></span>
        <span className="absolute bottom-0 left-[1cm] h-1.5 w-px bg-foreground-400"></span>
        <span className="absolute bottom-0 left-[2cm] h-1.5 w-px bg-foreground-400"></span>
        <span className="absolute bottom-0 right-0 h-3 w-px bg-foreground-400"></span>
        <span className="absolute bottom-3 left-0 rounded-sm bg-foreground-100 px-1 text-[9px] font-bold leading-4 text-foreground-800">
          3 cm
        </span>
      </div>
      <p className="text-[11px] font-medium text-foreground-500">
        Marca de corte de 3 cm — confira a largura do QR-Code com uma régua
      </p>
    </div>
  );
}

/**
 * Diálogo de impressão dos adesivos de fiscalização: escolha entre etiqueta
 * quadrada, selo circular do capacete e folha A4 adesiva (grade 3 × 8), com
 * pré-visualização em tamanho real, marca de corte de 3 cm e disparo da
 * impressão.
 */
export default function QrPrintDialog({
  open,
  collaborators,
  companyName,
  subdomain,
  onClose,
  onPrinted,
}: QrPrintDialogProps) {
  const [format, setFormat] = useState<QrStickerFormat>("label");
  const [printing, setPrinting] = useState(false);

  // Ficha de EPI (validade do CA do capacete) e composição da CIPA (SESMT).
  const deliveries = useEpis();
  const cipas = useCipas();
  const settings = useSystemSettings();

  const preview = collaborators[0];
  const helmetCaMap = useMemo(
    () => buildHelmetCaMap(collaborators.map((c) => c.id), deliveries),
    [collaborators, deliveries],
  );
  // CIPA com área SESMT tem prioridade; depois vale o telefone das Configurações.
  const sesmtPhone = useMemo(
    () => resolveSesmtPhone(cipas, undefined, settings.sesmtPhone),
    [cipas, settings.sesmtPhone],
  );
  const sesmtFromSettings = useMemo(
    () => !cipas.some((cipa) => (cipa.members ?? []).some((m) => /sesmt/i.test(m.area))) && Boolean(settings.sesmtPhone.trim()),
    [cipas, settings.sesmtPhone],
  );
  const previewHelmet = preview ? helmetCaMap[preview.id] ?? null : null;
  const sheetCount = Math.max(1, Math.ceil(collaborators.length / SHEET_PER_PAGE));
  const activeFormat = stickerFormats.find((item) => item.id === format);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        icon="ri-printer-line"
        title="Imprimir adesivos de fiscalização"
        subtitle={`${collaborators.length} adesivo(s) · QR-Code de 3 × 3 cm`}
        footer={
          <>
            <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
              Cancelar
            </ModalButton>
            <ModalButton onClick={() => setPrinting(true)} icon="ri-printer-line" disabled={!preview || printing}>
              {printing ? "Abrindo impressão..." : `Imprimir ${collaborators.length} adesivo(s)`}
            </ModalButton>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-foreground-700">Modelo do adesivo</p>
            <div className="mt-2 flex w-full gap-1 rounded-full border border-background-200 bg-background-100 p-1">
              {stickerFormats.map((item) => {
                const active = format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormat(item.id)}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-semibold transition-colors ${
                      active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">
                      <i className={`${item.icon} text-sm`}></i>
                    </span>
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-foreground-500">
              <i className="ri-information-line mt-0.5 text-sm"></i>
              <span>{activeFormat?.hint}</span>
            </p>
          </div>

          <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-6">
            <div className="flex justify-center overflow-x-auto">
              {preview ? (
                <QrSticker
                  collaborator={preview}
                  companyName={companyName}
                  subdomain={subdomain}
                  format={format}
                  helmetCa={previewHelmet}
                  sesmtPhone={sesmtPhone}
                />
              ) : (
                <p className="text-sm text-foreground-500">Selecione ao menos um colaborador.</p>
              )}
            </div>
            <CutMark />
            <p className="mt-3 text-center text-[11px] font-medium text-foreground-500">
              Pré-visualização em tamanho real
              {collaborators.length > 1 ? ` · mostra o 1º de ${collaborators.length}` : ""}
              {format === "sheet" ? ` · ${sheetCount} folha(s) A4` : ""}
            </p>
          </div>

          {format === "seal" && (
            <div className="rounded-lg border border-background-200 bg-background-50 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-foreground-800">
                <i className="ri-information-line text-sm"></i>
                Informações do capacete
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed text-foreground-600">
                <li className="flex items-center gap-2">
                  <i
                    className={`text-sm ${
                      previewHelmet?.expired ? "ri-alert-line text-accent-600" : "ri-shield-check-line text-primary-600"
                    }`}
                  ></i>
                  {previewHelmet
                    ? previewHelmet.expired
                      ? `CA ${previewHelmet.ca}${previewHelmet.validity ? ` · validade ${previewHelmet.validity}` : ""} — CA vencido, o selo sai em vermelho`
                      : `CA ${previewHelmet.ca}${previewHelmet.validity ? ` · validade ${previewHelmet.validity}` : " · validade não informada na ficha"}`
                    : "Sem capacete registrado na ficha de EPI deste colaborador"}
                </li>
                <li className="flex items-center gap-2">
                  <i className="ri-phone-line text-sm text-secondary-700"></i>
                  {sesmtPhone
                    ? `SESMT ${sesmtPhone} ${
                        sesmtFromSettings ? "(telefone das Configurações)" : "(membro da CIPA da área SESMT)"
                      }`
                    : "Sem membro de SESMT na CIPA e sem telefone nas Configurações — a linha não será impressa"}
                </li>
              </ul>
            </div>
          )}

          {format === "sheet" && (
            <div className="rounded-lg border border-background-200 bg-background-50 p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-foreground-800">
                <i className="ri-grid-line text-sm"></i>
                Folha A4 adesiva
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed text-foreground-600">
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                  3 colunas × 8 linhas = 24 adesivos por folha, em posições fixas (63 × 34,5 mm).
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                  Os vãos tracejados são as linhas de corte da etiqueta.
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                  Na caixa de impressão, deixe em <strong className="font-semibold">100% / Tamanho real</strong>.
                </li>
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-secondary-200 bg-secondary-100/60 p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-secondary-900">
              <i className="ri-scissors-cut-line text-sm"></i>
              Como aplicar
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed text-secondary-900/90">
              <li className="flex items-start gap-1.5">
                <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                Recorte na linha tracejada e cole em superfície limpa e seca.
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                O selo circular acompanha a curvatura do capacete sem dobrar as bordas.
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                Mantenha a marca no centro do código para facilitar a leitura em campo.
              </li>
            </ul>
          </div>
        </div>
      </Modal>

      {printing && preview && (
        <QrPrintSheet
          collaborators={collaborators}
          companyName={companyName}
          subdomain={subdomain}
          format={format}
          helmetCaMap={helmetCaMap}
          sesmtPhone={sesmtPhone}
          onDone={() => {
            setPrinting(false);
            onPrinted(collaborators.length, format);
          }}
        />
      )}
    </>
  );
}