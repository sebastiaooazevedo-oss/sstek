import { useEffect, useState } from "react";
import { PermissionGate, PermissionLockNote } from "@/pages/app/components/PermissionGate";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { updateSetting, useSystemSettings } from "@/pages/app/settings/settingsStore";
import {
  currentBaseUrl,
  fiscalizacaoUrl,
  normalizeBaseUrl,
  resolveQrBase,
} from "@/pages/app/modules/qrcodes/publicBase";

interface QrPublicBaseCardProps {
  subdomain: string;
  /** `ref` de um colaborador real, só para ilustrar o link final. */
  sampleRef?: string;
  onNotice: (text: string) => void;
}

/**
 * Configuração do endereço gravado dentro dos QR-Codes de fiscalização.
 *
 * O QR é lido por um celular SEM login. Se ele carregar o endereço do editor de
 * pré-visualização, o celular recebe "invalid authorization" do gateway — foi
 * exatamente o que aconteceu ao escanear um adesivo impresso antes de publicar.
 * Aqui a empresa informa o endereço publicado uma única vez e todos os adesivos
 * (grade, ficha, colaborador, EPI e impressão em lote) passam a usá-lo.
 */
export default function QrPublicBaseCard({ subdomain, sampleRef, onNotice }: QrPublicBaseCardProps) {
  const { can } = usePermissions();
  const settings = useSystemSettings();
  const stored = settings.publicBaseUrl || "";

  const [draft, setDraft] = useState(stored);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(stored);
  }, [stored]);

  const canEdit = can("tenant.settings");
  const info = resolveQrBase();
  // Mostra o endereço real que vai dentro do QR do colaborador de exemplo —
  // com o código vigente dele (identificador opaco ou referência legada).
  const example = sampleRef
    ? fiscalizacaoUrl(subdomain, sampleRef)
    : `${info.base}/fiscalizacao/CODIGO-DO-COLABORADOR`;

  const handleSave = () => {
    const raw = draft.trim();
    if (!raw) {
      setError("");
      updateSetting("publicBaseUrl", "");
      onNotice("Endereço público removido. Os QR-Codes voltaram a usar o endereço atual do navegador.");
      return;
    }
    const normalized = normalizeBaseUrl(raw);
    if (!normalized) {
      setError("Informe um endereço válido, por exemplo https://sstek.suaempresa.com.br");
      return;
    }
    setError("");
    updateSetting("publicBaseUrl", normalized);
    setDraft(normalized);
    onNotice(`Endereço público atualizado para ${normalized}. Todos os QR-Codes já usam o novo endereço.`);
  };

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(example);
      onNotice("Link de exemplo copiado.");
    } catch {
      onNotice("Não foi possível copiar. Selecione o link manualmente.");
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className="ri-link text-lg"></i>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground-950">Endereço público dos adesivos</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
              É o endereço gravado dentro do QR-Code e aberto no celular de quem fiscaliza. Informe aqui o
              endereço onde o sistema está publicado.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            info.configured ? "bg-primary-100 text-primary-700" : "bg-background-100 text-foreground-500"
          }`}
        >
          <i className={info.configured ? "ri-checkbox-circle-line" : "ri-time-line"}></i>
          {info.configured ? "Endereço configurado" : "Usando o endereço atual"}
        </span>
      </div>

      {info.requiresSession && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3">
          <i className="ri-error-warning-line mt-0.5 text-base text-accent-800"></i>
          <div className="text-xs leading-relaxed text-accent-900">
            <p className="font-semibold">Os adesivos impressos agora não vão abrir no celular.</p>
            <p className="mt-0.5">
              O endereço em uso é <span className="font-mono break-all">{info.base}</span>, que exige login deste
              ambiente. O celular recebe <strong>“invalid authorization”</strong> ao escanear. Publique o sistema e
              informe acima o endereço publicado para gerar adesivos válidos em campo.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="qr-public-base" className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
          Endereço publicado
        </label>
        <PermissionGate
          allowed={canEdit}
          fallback={<PermissionLockNote text="Endereço configurável apenas por administradores" className="mt-1.5" />}
        >
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
              <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
                <i className="ri-global-line text-base"></i>
              </span>
              <input
                id="qr-public-base"
                type="url"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="https://sstek.suaempresa.com.br"
                className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              <i className="ri-save-3-line text-base"></i>
              Salvar endereço
            </button>
          </div>
        </PermissionGate>
        {error && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-800">
            <i className="ri-alert-line"></i>
            {error}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-md border border-background-200 bg-background-100 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-[11px] text-foreground-600">
          <span className="font-semibold text-foreground-800">Link gerado:</span>{" "}
          <span className="break-all font-mono">{example}</span>
        </p>
        <button
          type="button"
          onClick={() => void copyExample()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-file-copy-line"></i>
          Copiar
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-foreground-400">
        Endereço atual deste navegador: <span className="font-mono break-all">{currentBaseUrl()}</span>
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-foreground-400">
        O código do colaborador não é derivado de CPF ou matrícula. Quem ainda usa a referência antiga mantém o
        adesivo já impresso válido — a migração não é automática.
      </p>
    </section>
  );
}