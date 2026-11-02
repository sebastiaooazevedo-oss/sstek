import { useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { QrRenewalError, renewQrCode } from "@/pages/app/modules/qrcodes/qrIdentifierStore";
import type { Collaborator } from "@/mocks/collaborators";

const MOTIVOS = [
  "Adesivo perdido em campo",
  "Adesivo danificado ou ilegível",
  "Suspeita de uso indevido do código",
  "Substituição do crachá do colaborador",
];

interface QrRenewModalProps {
  open: boolean;
  onClose: () => void;
  collaborator: Collaborator;
  tenant: string;
  /** Usuário administrativo autenticado (responsável pela renovação). */
  actor: string;
  onRenewed: (newCode: string, reason: string) => void;
}

/**
 * Renovação do identificador do QR-Code.
 *
 * Regras aplicadas aqui:
 * - exige a permissão específica "Renovar QR-code do colaborador";
 * - exige motivo obrigatório;
 * - exige confirmação explícita de que o código anterior deixa de funcionar;
 * - substitui o identificador (um único código vigente por colaborador);
 * - registra empresa, colaborador, responsável, data/hora, motivo, resultado e
 *   os identificadores internos anterior/novo — sem URL e sem token.
 *
 * O QUE ESTE FLUXO AINDA NÃO FAZ (e está escrito na tela): a invalidação do
 * código anterior e das sessões externas é validada no servidor, que ainda não
 * existe. Esconder o botão não é controle de segurança — por isso o cadastro
 * interno continua sendo a fonte de verdade até o backend de sessão entrar.
 */
export default function QrRenewModal({
  open,
  onClose,
  collaborator,
  tenant,
  actor,
  onRenewed,
}: QrRenewModalProps) {
  const { can } = usePermissions();
  const permitted = can("qrcodes.renew");

  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState("");

  const motivoFinal = `${motivo}${detalhe.trim() ? ` — ${detalhe.trim()}` : ""}`;
  const podeRenovar = permitted && confirmado && motivo.trim().length > 0;

  const close = () => {
    setMotivo("");
    setDetalhe("");
    setConfirmado(false);
    setErro("");
    onClose();
  };

  const handleRenew = () => {
    if (!permitted) return;
    if (!motivo.trim()) {
      setErro("Selecione o motivo da renovação.");
      return;
    }
    if (!confirmado) {
      setErro("Confirme que o QR anterior deixará de funcionar.");
      return;
    }
    try {
      const record = renewQrCode({
        tenant,
        collaboratorId: collaborator.id,
        collaboratorName: collaborator.name,
        actor,
        reason: motivoFinal,
      });
      onRenewed(record.code, motivoFinal);
      close();
    } catch (cause) {
      setErro(cause instanceof QrRenewalError ? cause.message : "Não foi possível renovar o QR-Code.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      icon="ri-refresh-line"
      title="Renovar QR-code do colaborador"
      subtitle={`${collaborator.name} · o código atual deixa de ser o vigente`}
      footer={
        <>
          <ModalButton variant="ghost" icon="ri-close-line" onClick={close}>
            Cancelar
          </ModalButton>
          <ModalButton icon="ri-refresh-line" onClick={handleRenew} disabled={!podeRenovar}>
            Renovar QR-code
          </ModalButton>
        </>
      }
    >
      {!permitted ? (
        <div className="flex items-start gap-3 rounded-md border border-accent-300 bg-accent-50 px-4 py-3.5">
          <i className="ri-lock-2-line mt-0.5 text-lg text-accent-800"></i>
          <div className="text-xs leading-relaxed text-accent-900">
            <p className="font-semibold">Você não tem a permissão “Renovar QR-code do colaborador”.</p>
            <p className="mt-1">
              Essa permissão é liberada separadamente nos perfis de acesso da empresa. Solicite ao administrador
              responsável. A permissão para renovar não concede, por si só, o direito de administrar perfis ou
              conceder essa mesma autorização a terceiros.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-background-200 bg-background-100 px-4 py-3">
            <p className="text-xs font-semibold text-foreground-800">O que a renovação faz</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[11.5px] leading-relaxed text-foreground-600">
              <li className="flex items-start gap-1.5">
                <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                Substitui o identificador por um código aleatório novo, sem gerar dois códigos vigentes.
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                Preserva cadastro, documentos, EPIs e histórico do colaborador.
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-checkbox-blank-circle-fill mt-1 text-[5px]"></i>
                O novo código precisa ser reimpresso e recolocado no crachá e no capacete.
              </li>
              <li className="flex items-start gap-1.5">
                <i className="ri-close-circle-line mt-1 text-[9px] text-accent-600"></i>
                Não permite renovação entre empresas: vale apenas para esta empresa.
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="qr-renew-reason" className="text-xs font-semibold text-foreground-700">
                Motivo da renovação <span className="text-accent-600">*</span>
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MOTIVOS.map((item) => {
                  const active = motivo === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setMotivo(active ? "" : item);
                        setErro("");
                      }}
                      className={`cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        active
                          ? "border-primary-400 bg-primary-100 text-primary-800"
                          : "border-background-300 bg-background-50 text-foreground-600 hover:bg-background-100"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
              <input
                id="qr-renew-reason"
                type="text"
                value={detalhe}
                maxLength={160}
                onChange={(e) => {
                  setDetalhe(e.target.value);
                  setErro("");
                }}
                placeholder="Detalhe complementar (opcional), ex.: adesivo do capacete descolou"
                className="mt-2 w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 focus:border-primary-400"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-4 py-3">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => {
                  setConfirmado(e.target.checked);
                  setErro("");
                }}
                className="mt-0.5 h-4 w-4 accent-accent-600"
              />
              <span className="text-[11.5px] leading-relaxed text-accent-900">
                Entendo que o QR anterior deixará de funcionar e que será necessário imprimir e aplicar o novo
                adesivo. Esta ação será registrada no log com o meu usuário, data/hora e motivo.
              </span>
            </label>

            {erro && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-800">
                <i className="ri-error-warning-line"></i>
                {erro}
              </p>
            )}
          </div>

          <div className="rounded-md border border-secondary-200 bg-secondary-100/60 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-secondary-900">
              <i className="ri-information-line"></i>
              Pendência declarada
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-secondary-900/90">
              A rotação é gravada neste ambiente administrativo. A invalidação do código anterior e das sessões
              externas vinculadas precisa ser confirmada no servidor, e esse serviço de sessão ainda não está
              implementado. Enquanto ele não existir, a ficha externa continua bloqueada e esta renovação não deve
              ser tratada como controle de segurança concluído.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}