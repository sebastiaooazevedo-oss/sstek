import { useCallback, useEffect, useState } from "react";
import PlatformScreen from "@/pages/app/modules/plataforma/components/PlatformScreen";
import BulkImportPanel from "@/pages/app/modules/plataforma/components/BulkImportPanel";

export default function ImportacaoPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const notify = useCallback((success: string | null, failure: string | null = null) => {
    setMessage(success);
    setMessageError(failure);
  }, []);

  useEffect(() => {
    if (!message && !messageError) return;
    const timer = window.setTimeout(() => {
      setMessage(null);
      setMessageError(null);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [message, messageError]);

  return (
    <PlatformScreen
      screen="importacao"
      title="Importar colaboradores em lote"
      subtitle="Suba a base de uma empresa por CSV ou XLSX, escolhendo o tenant de destino. O modelo da planilha já vem pronto para baixar."
    >
      {(message || messageError) && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-md border px-4 py-3 text-xs leading-relaxed ${
            messageError
              ? "border-accent-300 bg-accent-50 text-accent-900"
              : "border-primary-200 bg-primary-50 text-primary-900"
          }`}
        >
          <i className={`${messageError ? "ri-error-warning-line" : "ri-checkbox-circle-line"} mt-0.5 text-sm`}></i>
          <span>{messageError || message}</span>
        </div>
      )}
      <BulkImportPanel notify={notify} />
    </PlatformScreen>
  );
}