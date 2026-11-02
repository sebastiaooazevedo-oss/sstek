/**
 * Preparo da foto anexada ao pedido de substituição de EPI.
 *
 * A imagem é redimensionada e recomprimida em JPEG antes de ir para o banco,
 * para caber com folga no registro e manter o pedido rápido de abrir. Também
 * garante que fotos grandes de celular não estourem o limite de envio.
 */
export function compressEpiPhoto(file: File, maxSize = 1200, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.onload = () => {
      const source = String(reader.result || "");
      const image = new Image();
      image.onerror = () => reject(new Error("Formato de imagem não suportado."));
      image.onload = () => {
        const largest = Math.max(image.width, image.height) || 1;
        const scale = Math.min(1, maxSize / largest);
        const width = Math.round(image.width * scale) || 1;
        const height = Math.round(image.height * scale) || 1;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");

        if (!context) {
          resolve(source);
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(source);
        }
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}