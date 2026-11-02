import { useCallback, useEffect, useRef, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";

interface Props {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onCapture: (file: File) => void | Promise<void>;
}

/**
 * Captura de foto com a câmera do dispositivo (getUserMedia).
 * Necessário porque o atributo `capture` do input file só funciona em navegadores
 * móveis: no desktop ele abre apenas o seletor de arquivos.
 * Quando a câmera não está disponível ou a permissão é negada, oferece o envio
 * de arquivo como alternativa, sem quebrar o fluxo.
 */
export default function CameraCaptureModal({
  open,
  title = "Tirar foto",
  subtitle = "A imagem é enviada como evidência do registro.",
  onClose,
  onCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setError("");
    setReady(false);
    setSaving(false);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "Este navegador não libera a câmera diretamente. Use “Enviar do dispositivo” abaixo."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Não foi possível abrir a câmera (permissão negada ou sem câmera disponível). Use “Enviar do dispositivo” abaixo."
          );
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setError("A câmera ainda está iniciando. Tente novamente em um instante.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Não foi possível processar a imagem da câmera.");
      return;
    }
    context.drawImage(video, 0, 0, width, height);
    setSaving(true);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9)
    );
    if (!blob) {
      setSaving(false);
      setError("Não foi possível gerar a imagem. Tente novamente.");
      return;
    }
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
    try {
      await onCapture(file);
    } finally {
      setSaving(false);
    }
  };

  const pickFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSaving(true);
    try {
      await onCapture(file);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-camera-line"
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={capture} icon="ri-camera-line" disabled={!ready || saving}>
            {saving ? "Processando..." : "Capturar foto"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <p className="flex items-start gap-2 rounded-md bg-danger-100 px-3 py-2.5 text-xs font-medium text-danger-800">
            <i className="ri-error-warning-line mt-0.5 text-sm"></i>
            <span>{error}</span>
          </p>
        )}

        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-background-300 bg-foreground-950">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover ${ready ? "opacity-100" : "opacity-0"}`}
          ></video>
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-background-100">
              <i className="ri-camera-off-line text-2xl"></i>
              <span className="text-xs font-medium">Aguardando a câmera...</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-relaxed text-foreground-500">
            A foto fica vinculada ao registro com autor, data e hora.
          </p>
          <div className="flex items-center gap-2">
            <label
              htmlFor="camera-fallback-file"
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-upload-2-line"></i>
              Enviar do dispositivo
            </label>
            <input
              id="camera-fallback-file"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void pickFile(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}