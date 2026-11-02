import { useEffect, useRef, useState } from "react";
import type { DocumentSeal } from "@/pages/app/signature/authenticitySeal";

interface UseDocumentSealOptions {
  /** Chave que identifica o conteúdo do documento (muda quando o conteúdo muda). */
  key: string;
  /** Só busca a chancela quando o documento já tem assinatura registrada. */
  ready: boolean;
  /** Cria (ou reaproveita) o selo no servidor. */
  load: () => Promise<DocumentSeal | null>;
}

interface UseDocumentSealResult {
  seal: DocumentSeal | null;
  loading: boolean;
}

/**
 * Carrega a chancela de autenticidade de um documento para exibir a prévia
 * antes da exportação. O selo é idempotente no servidor (mesmo conteúdo ->
 * mesmo selo), então abrir a prévia não gera registros duplicados.
 */
export function useDocumentSeal({ key, ready, load }: UseDocumentSealOptions): UseDocumentSealResult {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [seal, setSeal] = useState<DocumentSeal | null>(null);
  const [loading, setLoading] = useState<boolean>(ready && Boolean(key));

  useEffect(() => {
    let cancelled = false;

    if (!ready || !key) {
      setSeal(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    loadRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setSeal(result);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSeal(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, ready]);

  return { seal, loading };
}