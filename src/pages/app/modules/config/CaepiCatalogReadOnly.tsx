import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAppSession } from "@/pages/app/context";

interface BatchInfo {
  id: string;
  file_name: string;
  row_count: number;
  rejected_count: number;
  is_active: boolean;
  created_at: string;
  encoding: string | null;
  delimiter_char: string | null;
}

/**
 * Visão da base central CAEPI para as empresas.
 *
 * Somente leitura por decisão de arquitetura: o catálogo é global e a importação/ativação
 * é exclusiva do Superadministrador da plataforma. As tabelas também bloqueiam escrita
 * no banco (RLS), portanto esconder o botão não é a única proteção.
 */
export default function CaepiCatalogReadOnly() {
  const session = useAppSession();
  const [active, setActive] = useState<BatchInfo | null>(null);
  const [versions, setVersions] = useState<BatchInfo[]>([]);
  const [rows, setRows] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: batchError } = await supabase
          .from("caepi_import_batches")
          .select("id, file_name, row_count, rejected_count, is_active, created_at, encoding, delimiter_char")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(4);
        if (batchError) throw new Error(batchError.message);
        const list = (data as BatchInfo[] | null) ?? [];
        const activeBatch = list.find((item) => item.is_active) ?? null;
        if (!mounted) return;
        setActive(activeBatch);
        setVersions(list);
        if (activeBatch) {
          const { count } = await supabase
            .from("caepi_catalog_entries")
            .select("id", { count: "exact", head: true })
            .eq("batch_id", activeBatch.id);
          if (mounted) setRows(count ?? activeBatch.row_count);
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Não foi possível consultar a base ativa.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
      <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
          <i className="ri-database-2-line text-lg"></i>
        </span>
        <div>
          <h2 className="font-heading text-base font-bold text-foreground-950">Base de dados do CAEPI</h2>
          <p className="mt-0.5 text-xs text-foreground-500">
            Catálogo central compartilhado por todas as empresas. Somente consulta.
          </p>
        </div>
      </div>

      <div className="p-5">
        {loading && (
          <p className="flex items-center gap-2 text-xs text-foreground-600">
            <i className="ri-loader-4-line animate-spin"></i>
            Consultando a versão ativa…
          </p>
        )}

        {error && !loading && (
          <p className="flex items-start gap-2 rounded-md bg-background-100 px-3 py-2.5 text-xs text-foreground-700">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{error}</span>
          </p>
        )}

        {!loading && !error && (
          <>
            {active ? (
              <div>
                <p className="text-sm font-semibold text-foreground-950">{active.file_name}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-600">
                  <span>{rows.toLocaleString("pt-BR")} CAs disponíveis</span>
                  <span>{active.rejected_count.toLocaleString("pt-BR")} rejeitados na validação</span>
                  <span>ativada em {new Date(active.created_at).toLocaleString("pt-BR")}</span>
                  {active.encoding && <span>{active.encoding.toUpperCase()}</span>}
                  {active.delimiter_char && <span>separador “{active.delimiter_char}”</span>}
                </p>
              </div>
            ) : (
              <p className="text-xs text-foreground-600">
                Nenhuma base central foi ativada ainda. A consulta de CA usa o portal oficial até a primeira
                importação.
              </p>
            )}

            {versions.length > 1 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                  Versões anteriores preservadas
                </p>
                <ul className="mt-1.5 space-y-1">
                  {versions
                    .filter((item) => !item.is_active)
                    .slice(0, 3)
                    .map((item) => (
                      <li key={item.id} className="flex flex-wrap gap-x-2 text-[11px] text-foreground-600">
                        <span className="font-medium text-foreground-800">{item.file_name}</span>
                        <span>· {item.row_count.toLocaleString("pt-BR")} registros</span>
                        <span>· {new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 rounded-md bg-background-100 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-foreground-600">
                <i className="ri-lock-2-line mt-0.5 text-sm text-secondary-800"></i>
                <span>
                  Importar, alterar ou ativar versões do catálogo é exclusivo do Superadministrador da plataforma.
                  Administradores e colaboradores das empresas têm apenas consulta.
                </span>
              </p>
              {session.role === "super" && (
                <Link
                  to="/app/plataforma"
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary-500 px-3 py-2 text-[11px] font-semibold text-background-50 hover:bg-secondary-600"
                >
                  <i className="ri-shield-star-line"></i>
                  Abrir painel global
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}