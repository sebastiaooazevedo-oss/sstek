import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import QrCode from "@/pages/app/modules/qrcodes/components/QrCode";
import QrPrintDialog, { stickerFormatLabel } from "@/pages/app/modules/qrcodes/components/QrPrintDialog";
import QrRenewModal from "@/pages/app/modules/qrcodes/components/QrRenewModal";
import FichaSst from "@/pages/fiscalizacao/components/FichaSst";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { fiscalizacaoLocalPath, fiscalizacaoUrl } from "@/pages/app/modules/qrcodes/publicBase";
import { resolveQrCode, useQrIdentifiers } from "@/pages/app/modules/qrcodes/qrIdentifierStore";
import { buildFiscalizacaoPreview } from "@/pages/app/modules/qrcodes/fiscalizacaoPreview";
import type { Collaborator } from "@/mocks/collaborators";
import type { QrProfile, ScanLog } from "@/mocks/qrcodes";

/**
 * Modal administrativo "QR-Code de fiscalização".
 *
 * Três camadas distintas, de propósito:
 *
 * 1. ESTE modal — administrativo. Emite/pré-visualiza o QR, imprime o adesivo e
 *    abre a página externa. Só quem administra vê os dados completos, e mesmo
 *    assim no cadastro interno (Colaboradores / EPI), não aqui.
 * 2. A PÁGINA EXTERNA (`/fiscalizacao/:codigo`) — aberta pelo celular do
 *    consultante, sem login.
 * 3. O ENDPOINT (`fiscalizacao-publica`) — entrega o resumo já reduzido.
 *
 * Aqui os dados aparecem SEM restrição: esta é uma tela interna, atrás de
 * login e permissão. CPF, PIS/PASEP, CTPS e admissão são exibidos completos,
 * como no cadastro do colaborador, e não há marca-d'água — marca-d'água e
 * mascaramento fazem sentido na página externa, não no ambiente da empresa.
 *
 * IMPORTANTE: a ficha abaixo é a leitura interna da mesma estrutura aprovada.
 * O consultante externo continua vendo apenas o resumo reduzido.
 */

interface QrFichaModalProps {
  open: boolean;
  onClose: () => void;
  collaborator: Collaborator | null;
  profile: QrProfile;
  companyName: string;
  subdomain: string;
  /** Nome do usuário administrativo autenticado, gravado no log de renovação. */
  actorName: string;
  logs: ScanLog[];
  onNotice: (message: string) => void;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

const PREVIEW_SESSION_CODE = "PRÉVIA";

export default function QrFichaModal({
  open,
  onClose,
  collaborator,
  profile,
  companyName,
  subdomain,
  actorName,
  logs,
  onNotice,
}: QrFichaModalProps) {
  const { can } = usePermissions();
  const [printing, setPrinting] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mantém a tela sincronizada quando um código é renovado.
  useQrIdentifiers(subdomain);

  const preview = useMemo(() => {
    if (!collaborator) return null;
    const identifier = resolveQrCode(subdomain, collaborator.id);
    return buildFiscalizacaoPreview({
      collaborator,
      profile,
      companyName,
      subdomain,
      code: identifier.code,
      masked: false,
    });
  }, [collaborator, profile, companyName, subdomain]);

  if (!collaborator || !preview) return null;

  const identifier = resolveQrCode(subdomain, collaborator.id);
  const url = fiscalizacaoUrl(subdomain, collaborator.id);
  const localPath = fiscalizacaoLocalPath(subdomain, collaborator.id);
  const canRenew = can("qrcodes.renew");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotice("Não foi possível copiar o link automaticamente. Selecione o endereço exibido.");
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="2xl"
        icon="ri-qr-scan-2-line"
        title="QR-Code de fiscalização"
        subtitle="Controles administrativos e ficha completa do colaborador"
        footer={
          <>
            <ModalButton variant="ghost" icon="ri-printer-line" onClick={() => setPrinting(true)}>
              Imprimir QR vigente
            </ModalButton>
            <Link
              to={localPath}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-external-link-line text-base"></i>
              Abrir página de fiscalização
            </Link>
          </>
        }
      >
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[286px_minmax(0,1fr)] lg:gap-6">
          {/* ------------------------------------------------ Coluna administrativa */}
          <aside className="flex flex-col gap-3">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-100 p-4">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-background-300 bg-background-50 px-5 py-4">
                <QrCode value={url} size={104} />
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-500">
                    Leitura do fiscal
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-400">3 × 3 cm · crachá e capacete</p>
                </div>
              </div>

              <div className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">
                    Identificador do QR
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      identifier.opaque
                        ? "bg-primary-100 text-primary-800"
                        : "bg-accent-100 text-accent-900"
                    }`}
                  >
                    <i className={identifier.opaque ? "ri-shield-check-line" : "ri-history-line"}></i>
                    {identifier.opaque ? `Opaco v${identifier.version}` : "Legado"}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] font-semibold text-foreground-800">
                  {identifier.code}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-foreground-400">
                  {identifier.opaque
                    ? "Aleatório e persistente. Não muda por leitura, sessão ou atualização cadastral."
                    : "Código antigo, previsível. Continua valendo — a migração não é automática."}
                </p>
              </div>

              <div className="w-full rounded-md border border-background-200 bg-background-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">
                    Endereço do QR
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-secondary-800 transition-colors hover:bg-secondary-100"
                  >
                    <i className={copied ? "ri-check-line" : "ri-file-copy-line"}></i>
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="mt-1 break-all text-[10.5px] font-medium leading-relaxed text-foreground-700">{url}</p>
              </div>

              <div className="flex w-full items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground-600">
                  <i className="ri-qr-scan-2-line text-sm text-secondary-700"></i>
                  Escaneamentos
                </span>
                <span className="font-heading text-sm font-extrabold text-foreground-950">{logs.length}</span>
              </div>
            </div>

            <p className="flex items-start gap-1.5 rounded-md bg-primary-50 px-3 py-2.5 text-[11px] leading-relaxed text-primary-800">
              <i className="ri-information-line mt-0.5 shrink-0 text-sm"></i>
              <span>O QR identifica esta ficha. A consulta externa exige identificação e autorização.</span>
            </p>

            {/* Ações administrativas */}
            <div className="rounded-lg border border-background-200 bg-background-50 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">
                Ações administrativas
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setPrinting(true)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-[11.5px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-printer-line text-sm text-secondary-700"></i>
                  Imprimir o QR vigente
                </button>
                <Link
                  to={localPath}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[11.5px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-external-link-line text-sm text-primary-700"></i>
                  Abrir a página de fiscalização
                </Link>
                <button
                  type="button"
                  onClick={() => setRenewing(true)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-[11.5px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-refresh-line text-sm text-accent-700"></i>
                  Renovar QR-code
                  {!canRenew && <i className="ri-lock-2-line ml-auto text-xs text-foreground-400"></i>}
                </button>
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 border-t border-background-200 pt-2 text-[10px] leading-relaxed text-foreground-400">
                <i className="ri-scissors-cut-line mt-0.5 shrink-0"></i>
                Reimprimir não renova o código. A renovação exige permissão, motivo e registro em log.
              </p>
            </div>
          </aside>

          {/* --------------------------------------------- Ficha completa (interna) */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg border border-b-0 border-background-200 bg-background-100 px-3.5 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground-800">
                <i className="ri-eye-line text-sm text-primary-700"></i>
                Ficha do colaborador · dados completos
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-primary-800">
                <i className="ri-lock-unlock-line"></i>
                Uso interno · dados completos
              </span>
            </div>

            <div className="rounded-b-lg border border-background-200 bg-background-100 p-2.5 md:p-3">
              <FichaSst
                dados={preview}
                sessaoCodigo={PREVIEW_SESSION_CODE}
                sessaoValidaAte="—"
                consultadoEm={formatDateTime(new Date())}
                ilustrativo={false}
                modo="previa"
                watermark={false}
              />
            </div>

            <p className="mt-2 flex items-start gap-1.5 rounded-md border border-secondary-200 bg-secondary-100/60 px-3 py-2 text-[10.5px] leading-relaxed text-secondary-900">
              <i className="ri-shield-keyhole-line mt-0.5 shrink-0 text-sm"></i>
              <span>
                Esta é a leitura interna da ficha: CPF, PIS/PASEP, CTPS e admissão aparecem completos porque o
                acesso exige login e permissão de perfil. Na página externa aberta pelo QR, o consultante vê apenas
                o resumo reduzido — CPF com três dígitos, PIS/CTPS/admissão como <strong>***</strong>, marca-d'água
                e nenhum documento pessoal completo.
              </span>
            </p>
          </div>
        </div>
      </Modal>

      {printing && (
        <QrPrintDialog
          open
          collaborators={[collaborator]}
          companyName={companyName}
          subdomain={subdomain}
          onClose={() => setPrinting(false)}
          onPrinted={(count, format) => {
            setPrinting(false);
            onNotice(
              `Adesivo (${stickerFormatLabel[format]}) de 3 × 3 cm de ${collaborator.name} enviado para a impressora. O QR-Code não foi renovado.`,
            );
          }}
        />
      )}

      {renewing && (
        <QrRenewModal
          open
          collaborator={collaborator}
          tenant={subdomain}
          actor={actorName}
          onClose={() => setRenewing(false)}
          onRenewed={(code, reason) => {
            onNotice(
              `QR-Code de ${collaborator.name} renovado (novo identificador ${code}). Motivo registrado: ${reason}. A renovação já aparece em Auditoria de renovações. Imprima e aplique o novo adesivo.`,
            );
          }}
        />
      )}
    </>
  );
}