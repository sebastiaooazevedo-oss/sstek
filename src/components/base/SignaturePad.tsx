import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  onDone?: () => void;
  height?: number;
}

function inkColor(canvas: HTMLCanvasElement): string {
  const color = getComputedStyle(canvas).color;
  return color && color !== "rgba(0, 0, 0, 0)" ? color : "#1c2a33";
}

export default function SignaturePad({ value, onChange, onDone, height = 150 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = inkColor(canvas);
    ctx.fillStyle = inkColor(canvas);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    setHasInk(Boolean(value));
  }, [value]);

  const position = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d");
    const point = position(event);
    drawing.current = true;
    last.current = point;
    if (ctx) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    setHasInk(true);
  };

  const handleMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = event.currentTarget.getContext("2d");
    const point = position(event);
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    last.current = point;
  };

  const handleUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChange(event.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setHasInk(false);
    onChange("");
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-md border border-background-300 bg-background-50" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair touch-none text-foreground-900"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-foreground-400">
            <i className="ri-pen-nib-line"></i>
            Assine no espaço acima
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-eraser-line"></i>
          Limpar
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-check-line"></i>
            Concluir assinatura
          </button>
        )}
        <span className="text-[11px] text-foreground-400">Use o mouse ou o dedo para assinar</span>
      </div>
    </div>
  );
}