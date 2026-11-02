import { useEffect, useState } from "react";
import { signVehiclePath } from "@/pages/app/modules/veiculos/vehiclesStore";

/**
 * Assina (link temporário) os arquivos privados do módulo Veículos.
 *
 * O banco guarda o CAMINHO do arquivo no bucket, nunca a URL assinada — URL
 * assinada expira. Este hook resolve os caminhos em links de 1 hora apenas
 * para exibir/baixar na tela atual.
 */
export function useVehicleFileUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).join("|");

  useEffect(() => {
    let active = true;
    const list = key ? key.split("|") : [];
    if (list.length === 0) {
      setUrls({});
      return () => {
        active = false;
      };
    }
    void (async () => {
      const resolved = await Promise.all(
        list.map(async (path) => ({ path, url: await signVehiclePath(path) }))
      );
      if (!active) return;
      const next: Record<string, string> = {};
      resolved.forEach((item) => {
        if (item.url) next[item.path] = item.url;
      });
      setUrls(next);
    })();
    return () => {
      active = false;
    };
  }, [key]);

  return urls;
}