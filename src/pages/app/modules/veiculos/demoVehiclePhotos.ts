import type { Vehicle } from "@/pages/app/modules/veiculos/vehicleTypes";

/**
 * Gera as 4 fotos (frente, lateral esquerda, lateral direita e traseira) dos
 * veículos de demonstração direto no navegador, via canvas.
 *
 * O arquivo é enviado pelo MESMO caminho de upload do cadastro real
 * (`uploadVehicleFile` com o código da lateral), então a foto volta ligada à
 * lateral correta na ficha do veículo — nada de caminho "fake".
 */

const WIDTH = 1200;
const HEIGHT = 800;

type Ctx = CanvasRenderingContext2D;

const VIEW_META: Record<string, { title: string; hint: string }> = {
  frente: { title: "FRENTE", hint: "Diagonal da frente" },
  lateral_esquerda: { title: "LATERAL ESQUERDA", hint: "Lado do motorista" },
  lateral_direita: { title: "LATERAL DIREITA", hint: "Lado do passageiro" },
  traseira: { title: "TRASEIRA", hint: "Diagonal da traseira" },
};

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function bodyColor(plate: string): string {
  const palette = ["#dfe3e6", "#aeb6bd", "#2f4356"];
  const seed = plate.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function drawBackground(ctx: Ctx, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#eef1f3");
  sky.addColorStop(0.58, "#e2e6e9");
  sky.addColorStop(1, "#b9c0c6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h * 0.62);
    ctx.stroke();
  }

  const floor = ctx.createLinearGradient(0, h * 0.62, 0, h);
  floor.addColorStop(0, "#c8ced3");
  floor.addColorStop(1, "#9ba4ab");
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

function drawShadow(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const cy = h * 0.76;
  const shadow = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.34);
  shadow.addColorStop(0, "rgba(24,29,33,0.42)");
  shadow.addColorStop(1, "rgba(24,29,33,0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.34, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWheel(ctx: Ctx, cx: number, cy: number, radius: number): void {
  ctx.fillStyle = "#1c2024";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c3c9ce";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7f878e";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlate(ctx: Ctx, x: number, y: number, w: number, h: number, plate: string): void {
  ctx.fillStyle = "#f7f9fa";
  ctx.strokeStyle = "#3d464d";
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1f262b";
  ctx.font = `bold ${Math.round(h * 0.56)}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(plate, x + w / 2, y + h * 0.54);
}

function drawSide(ctx: Ctx, w: number, h: number, plate: string, color: string): void {
  const groundY = h * 0.745;
  const wheelR = h * 0.1;
  const wheelY = groundY + wheelR * 0.18;

  ctx.fillStyle = color;
  roundRect(ctx, w * 0.13, h * 0.46, w * 0.74, h * 0.22, h * 0.05);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.465);
  ctx.lineTo(w * 0.38, h * 0.3);
  ctx.lineTo(w * 0.655, h * 0.3);
  ctx.lineTo(w * 0.73, h * 0.465);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#31414d";
  roundRect(ctx, w * 0.405, h * 0.315, w * 0.12, h * 0.135, 8);
  ctx.fill();
  roundRect(ctx, w * 0.545, h * 0.315, w * 0.12, h * 0.135, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, w * 0.15, h * 0.475, w * 0.7, h * 0.02, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(20,26,31,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.525, h * 0.475);
  ctx.lineTo(w * 0.525, h * 0.655);
  ctx.stroke();

  ctx.fillStyle = "#2b353d";
  roundRect(ctx, w * 0.6, h * 0.545, w * 0.045, h * 0.014, 6);
  ctx.fill();
  roundRect(ctx, w * 0.45, h * 0.545, w * 0.045, h * 0.014, 6);
  ctx.fill();

  ctx.fillStyle = "#f3f6f7";
  roundRect(ctx, w * 0.185, h * 0.53, w * 0.045, h * 0.032, 6);
  ctx.fill();
  ctx.fillStyle = "#c0392b";
  roundRect(ctx, w * 0.785, h * 0.505, w * 0.04, h * 0.036, 6);
  ctx.fill();

  drawWheel(ctx, w * 0.28, wheelY, wheelR);
  drawWheel(ctx, w * 0.72, wheelY, wheelR);

  drawPlate(ctx, w * 0.66, h * 0.6, w * 0.14, h * 0.055, plate);
}

function drawFront(ctx: Ctx, w: number, h: number, plate: string, color: string): void {
  ctx.fillStyle = color;
  roundRect(ctx, w * 0.2, h * 0.4, w * 0.6, h * 0.33, h * 0.05);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.29, h * 0.405);
  ctx.lineTo(w * 0.35, h * 0.285);
  ctx.lineTo(w * 0.65, h * 0.285);
  ctx.lineTo(w * 0.71, h * 0.405);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#31414d";
  roundRect(ctx, w * 0.385, h * 0.3, w * 0.23, h * 0.1, 10);
  ctx.fill();

  ctx.fillStyle = "#eef3f5";
  roundRect(ctx, w * 0.235, h * 0.475, w * 0.11, h * 0.055, 10);
  ctx.fill();
  roundRect(ctx, w * 0.655, h * 0.475, w * 0.11, h * 0.055, 10);
  ctx.fill();

  ctx.fillStyle = "#222a30";
  roundRect(ctx, w * 0.35, h * 0.555, w * 0.3, h * 0.075, 10);
  ctx.fill();
  ctx.strokeStyle = "#5a646c";
  ctx.lineWidth = 3;
  for (let index = 0; index < 4; index += 1) {
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.568 + index * h * 0.017);
    ctx.lineTo(w * 0.64, h * 0.568 + index * h * 0.017);
    ctx.stroke();
  }

  drawPlate(ctx, w * 0.42, h * 0.645, w * 0.16, h * 0.055, plate);

  ctx.fillStyle = "#1c2024";
  roundRect(ctx, w * 0.225, h * 0.69, w * 0.11, h * 0.045, 8);
  ctx.fill();
  roundRect(ctx, w * 0.665, h * 0.69, w * 0.11, h * 0.045, 8);
  ctx.fill();
}

function drawRear(ctx: Ctx, w: number, h: number, plate: string, color: string): void {
  ctx.fillStyle = color;
  roundRect(ctx, w * 0.2, h * 0.4, w * 0.6, h * 0.33, h * 0.05);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.29, h * 0.405);
  ctx.lineTo(w * 0.355, h * 0.29);
  ctx.lineTo(w * 0.645, h * 0.29);
  ctx.lineTo(w * 0.71, h * 0.405);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2a3742";
  roundRect(ctx, w * 0.375, h * 0.305, w * 0.25, h * 0.095, 10);
  ctx.fill();

  ctx.fillStyle = "#b0342a";
  roundRect(ctx, w * 0.235, h * 0.465, w * 0.105, h * 0.06, 8);
  ctx.fill();
  roundRect(ctx, w * 0.66, h * 0.465, w * 0.105, h * 0.06, 8);
  ctx.fill();

  drawPlate(ctx, w * 0.42, h * 0.55, w * 0.16, h * 0.055, plate);

  ctx.fillStyle = "rgba(20,26,31,0.35)";
  roundRect(ctx, w * 0.3, h * 0.625, w * 0.4, h * 0.02, 6);
  ctx.fill();

  ctx.fillStyle = "#1c2024";
  roundRect(ctx, w * 0.225, h * 0.69, w * 0.11, h * 0.045, 8);
  ctx.fill();
  roundRect(ctx, w * 0.665, h * 0.69, w * 0.11, h * 0.045, 8);
  ctx.fill();
}

function drawOverlay(ctx: Ctx, w: number, h: number, plate: string, slotKey: string, model: string): void {
  const meta = VIEW_META[slotKey] ?? { title: "VEÍCULO", hint: "" };

  ctx.fillStyle = "rgba(17,34,32,0.86)";
  roundRect(ctx, 36, 32, w * 0.44, 108, 14);
  ctx.fill();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#eef5f3";
  ctx.font = "bold 34px Inter, Arial, sans-serif";
  ctx.fillText(meta.title, 62, 88);
  ctx.fillStyle = "rgba(238,245,243,0.72)";
  ctx.font = "20px Inter, Arial, sans-serif";
  ctx.fillText(`${model} · ${plate}`, 62, 120);

  ctx.fillStyle = "rgba(17,34,32,0.82)";
  roundRect(ctx, w - 236, 32, 200, 46, 12);
  ctx.fill();
  ctx.fillStyle = "#f2c9a8";
  ctx.font = "bold 18px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FOTO FICTÍCIA", w - 136, 62);

  const stamp = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  ctx.fillStyle = "rgba(23,29,34,0.62)";
  ctx.fillRect(0, h - 56, w, 56);
  ctx.fillStyle = "#f6f8f9";
  ctx.font = "19px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `Gerada para demonstração do módulo Veículos — ${pad(stamp.getDate())}/${pad(
      stamp.getMonth() + 1
    )}/${stamp.getFullYear()} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`,
    36,
    h - 21
  );
  ctx.textAlign = "right";
  ctx.fillText(meta.hint, w - 36, h - 21);
}

export function buildDemoVehiclePhoto(vehicle: Vehicle, slotKey: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Não foi possível preparar a imagem."));

  const plate = vehicle.plate || "VGA1A23";
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veículo da frota";
  const color = bodyColor(plate);

  drawBackground(ctx, WIDTH, HEIGHT);
  drawShadow(ctx, WIDTH, HEIGHT);

  if (slotKey === "lateral_direita") {
    ctx.save();
    ctx.translate(WIDTH, 0);
    ctx.scale(-1, 1);
    drawSide(ctx, WIDTH, HEIGHT, plate, color);
    ctx.restore();
  } else if (slotKey === "lateral_esquerda") {
    drawSide(ctx, WIDTH, HEIGHT, plate, color);
  } else if (slotKey === "frente") {
    drawFront(ctx, WIDTH, HEIGHT, plate, color);
  } else {
    drawRear(ctx, WIDTH, HEIGHT, plate, color);
  }

  drawOverlay(ctx, WIDTH, HEIGHT, plate, slotKey, model);

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível gerar a imagem."));
          return;
        }
        const code = slotKey.replace(/_/g, "-");
        resolve(
          new File([blob], `${code}-${plate.toLowerCase()}.jpg`, { type: "image/jpeg" })
        );
      },
      "image/jpeg",
      0.9
    );
  });
}