import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import SignaturePad from "@/components/base/SignaturePad";
import SignatureStamp from "@/components/base/SignatureStamp";
import {
  defaultSignatureFontId,
  signatureFonts,
  type SignatureFontId,
} from "@/pages/app/signature/signatureFonts";
import {
  acceptSignatureTerm,
  removeSignature,
  saveSignature,
  useActiveTerm,
  useTermAcceptance,
  type RepresentationKind,
  type SignatureConfig,
} from "@/pages/app/signature/signatureStore";
import {
  renderSignaturePng,
  resolveSignatureName,
  type SignatureNameStyle,
} from "@/pages/app/signature/signatureUtils";

interface CreateSignatureModalProps {
  open: boolean;
  onClose: () => void;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorEmail?: string | null;
  initial: SignatureConfig | null;
}

const fallbackTerm =
  "Reconheço a representação visual cadastrada e aceito utilizar o método de assinatura eletrônica apresentado pelo sistema. Autorizo sua aplicação exclusivamente aos documentos que eu visualizar e confirmar pessoalmente. Cada confirmação será vinculada à versão do documento e registrada com evidências. Este cadastro não autoriza assinaturas automáticas nem assinaturas realizadas por terceiros em meu nome. Comprometo-me a proteger minhas credenciais e comunicar suspeitas de uso indevido.";

const styleOptions: { id: SignatureNameStyle; label: string; hint: string }[] = [
  { id: "full", label: "Nome completo", hint: "Assina com todos os nomes" },
  { id: "partial", label: "Nome parcial", hint: "Primeiro + último nome" },
];

const kindOptions: { id: RepresentationKind; label: string; hint: string; icon: string }[] = [
  { id: "typographic", label: "Modelo de escrita", icon: "ri-quill-pen-line", hint: "Escolha um estilo cursivo do seu nome" },
  { id: "draw", label: "Desenhar assinatura", icon: "ri-pen-nib-line", hint: "Assine com o mouse ou o dedo" },
];

export default function CreateSignatureModal({
  open,
  onClose,
  collaboratorId,
  collaboratorName,
  collaboratorEmail,
  initial,
}: CreateSignatureModalProps) {
  const term = useActiveTerm();
  const termAcceptedAt = useTermAcceptance(collaboratorId);

  const [step, setStep] = useState<"term" | "form">("form");
  const [kind, setKind] = useState<RepresentationKind>("typographic");
  const [font, setFont] = useState<SignatureFontId>(defaultSignatureFontId);
  const [style, setStyle] = useState<SignatureNameStyle>("full");
  const [drawImage, setDrawImage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthConfirmed, setReauthConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? "typographic");
    setFont(initial?.fontModel ?? defaultSignatureFontId);
    setStyle(initial?.nameStyle ?? "full");
    setDrawImage(initial?.kind === "draw" && initial.imageData ? initial.imageData : "");
    setAccepted(false);
    setSaving(false);
    setError("");
    setReauthOpen(false);
    setReauthConfirmed(false);
    setStep(initial || termAcceptedAt ? "form" : "term");
  }, [open, initial, termAcceptedAt]);

  const previewName = resolveSignatureName(collaboratorName, style);

  const handleAcceptTerm = async () => {
    if (!accepted) {
      setError("Marque a caixa confirmando que leu e concorda com o termo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await acceptSignatureTerm({ collaboratorId, collaboratorName, collaboratorEmail });
      setStep("form");
    } catch (err) {
      setError((err as Error).message || "Não foi possível registrar o aceite do termo.");
    } finally {
      setSaving(false);
    }
  };

  const performSave = async (reauth?: { confirmed?: boolean; password?: string }) => {
    if (kind === "draw" && !drawImage) {
      setError("Desenhe sua assinatura no quadro antes de salvar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const imageData =
        kind === "draw"
          ? drawImage
          : await renderSignaturePng(previewName || collaboratorName, font);
      await saveSignature({
        collaboratorId,
        collaboratorName,
        collaboratorEmail,
        kind,
        fontModel: font,
        nameStyle: style,
        imageData,
        reauth,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível salvar a assinatura.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Alteração da representação exige nova autenticação.
    if (initial && !reauthConfirmed) {
      setError("");
      setReauthOpen(true);
      return;
    }
    await performSave(initial ? { confirmed: true } : undefined);
  };

  const handleRemove = async () => {
    setSaving(true);
    setError("");
    try {
      await removeSignature({ collaboratorId, collaboratorName, collaboratorEmail });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível remover a assinatura.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon="ri-pen-nib-line"
      title="Minha assinatura"
      subtitle="Representação visual usada nos documentos que você assina."
      footer={
        step === "term" ? (
          <>
            {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
            <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
              Cancelar
            </ModalButton>
            <ModalButton onClick={handleAcceptTerm} icon="ri-shield-check-line">
              {saving ? "Registrando..." : "Aceitar e continuar"}
            </ModalButton>
          </>
        ) : (
          <>
            {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
            {initial && (
              <ModalButton variant="ghost" onClick={handleRemove} icon="ri-delete-bin-line">
                Remover
              </ModalButton>
            )}
            <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
              Cancelar
            </ModalButton>
            <ModalButton onClick={handleSave} icon="ri-save-3-line">
              {saving ? "Salvando..." : initial ? "Salvar alteração" : "Ativar assinatura"}
            </ModalButton>
          </>
        )
      }
    >
      {step === "term" ? (
        <div>
          <div className="flex items-start gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3">
            <i className="ri-shield-keyhole-line mt-0.5 text-lg text-accent-700"></i>
            <div className="text-xs leading-relaxed text-accent-900">
              <p className="font-semibold">Termo de adesão à assinatura eletrônica (v{term?.version ?? 1})</p>
              <p className="mt-1">
                Leia com atenção. A representação visual é apenas um recurso visual — ela não substitui a autenticação
                nem a manifestação de vontade, que serão registradas a cada confirmação.
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-background-200 bg-background-100 p-4">
            <p className="text-sm leading-relaxed text-foreground-700">{term?.body || fallbackTerm}</p>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-background-200 bg-background-50 p-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-background-300 accent-primary-500"
            />
            <span className="text-sm leading-relaxed text-foreground-800">
              Li e concordo com o termo. Entendo que a assinatura poderá ser alterada somente com nova autenticação, e
              que cada assinatura ficará registrada com versão, data/hora e evidências.
            </span>
          </label>
        </div>
      ) : (
        <div>
          {reauthOpen && (
            <div className="mb-5 rounded-lg border border-accent-300 bg-accent-50 p-4">
              <div className="flex items-start gap-3">
                <i className="ri-lock-password-line mt-0.5 text-lg text-accent-700"></i>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-accent-900">Confirme sua identidade para alterar</p>
                  <p className="mt-1 text-xs leading-relaxed text-accent-900/90">
                    Alterar a assinatura exige uma nova autenticação. A versão anterior é preservada e a imagem usada em
                    cada documento já assinado permanece registrada.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReauthConfirmed(true);
                        setReauthOpen(false);
                        void performSave({ confirmed: true });
                      }}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
                    >
                      <i className="ri-shield-check-line"></i>
                      Confirmar e salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setReauthOpen(false)}
                      className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kindOptions.map((option) => {
              const active = kind === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setKind(option.id);
                    setError("");
                  }}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    active ? "border-primary-400 bg-primary-50" : "border-background-200 bg-background-50 hover:bg-background-100"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      active ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-600"
                    }`}
                  >
                    <i className={`${option.icon} text-lg`}></i>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground-950">{option.label}</p>
                    <p className="mt-0.5 text-xs text-foreground-500">{option.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {kind === "typographic" ? (
            <>
              <div className="mt-6 rounded-lg border border-background-200 bg-background-100 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Prévia</p>
                <div className="mt-2 flex min-h-[92px] items-center justify-center rounded-md border border-dashed border-background-300 bg-background-50 px-6 py-4">
                  <SignatureStamp name={collaboratorName} font={font} nameStyle={style} size={44} />
                </div>
                <p className="mt-2 text-center text-xs text-foreground-500">{collaboratorName}</p>
              </div>

              <div className="mt-6">
                <h4 className="font-heading text-sm font-bold text-foreground-950">Como assinar o nome</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {styleOptions.map((option) => {
                    const active = style === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setStyle(option.id)}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                          active ? "border-primary-400 bg-primary-50" : "border-background-200 bg-background-50 hover:bg-background-100"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground-950">{option.label}</p>
                          <p className="mt-0.5 text-xs text-foreground-500">{option.hint}</p>
                        </div>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                            active ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300 text-transparent"
                          }`}
                        >
                          <i className="ri-check-line text-xs"></i>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-heading text-sm font-bold text-foreground-950">Modelo de escrita</h4>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {signatureFonts.map((model) => {
                    const active = font === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setFont(model.id)}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          active ? "border-primary-400 bg-primary-50" : "border-background-200 bg-background-50 hover:bg-background-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground-700">{model.label}</span>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              active ? "border-primary-500 bg-primary-500 text-background-50" : "border-background-300 text-transparent"
                            }`}
                          >
                            <i className="ri-check-line text-xs"></i>
                          </span>
                        </div>
                        <div className="mt-2 flex h-14 items-center overflow-hidden rounded-md bg-background-100 px-3">
                          <SignatureStamp name={collaboratorName} font={model.id} nameStyle={style} size={30} />
                        </div>
                        <p className="mt-2 text-[11px] text-foreground-400">{model.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <h4 className="font-heading text-sm font-bold text-foreground-950">Desenhe sua assinatura</h4>
              <p className="mt-1 text-xs text-foreground-500">
                Use o mouse ou o dedo. A imagem desenhada será guardada como sua representação visual.
              </p>
              <div className="mt-3">
                <SignaturePad value={drawImage} onChange={setDrawImage} height={180} />
              </div>
            </div>
          )}

          <p className="mt-5 flex items-start gap-2 rounded-md border border-background-200 bg-background-100 px-4 py-3 text-[11px] leading-relaxed text-foreground-500">
            <i className="ri-information-line mt-0.5 text-sm"></i>
            Esta representação é visual e não substitui a autenticação. Cada assinatura de documento será vinculada à
            versão do documento e registrada com evidências no servidor.
          </p>
        </div>
      )}
    </Modal>
  );
}