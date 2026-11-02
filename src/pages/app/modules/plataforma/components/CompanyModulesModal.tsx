import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { toggleableModules } from "@/core/modules/registry";
import { PLAN_PRESETS, type PlanId } from "@/core/plans";
import { platformApi, type PlatformCompany } from "@/pages/app/modules/plataforma/platformApi";

/**
 * Módulos contratados por UMA empresa.
 *
 * O módulo fica ativo quando está ligado aqui E não está desligado na chave
 * geral da plataforma (aba Módulos da plataforma).
 */
interface CompanyModulesModalProps {
  company: PlatformCompany;
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}

export default function CompanyModulesModal({ company, onClose, onSaved }: CompanyModulesModalProps) {
  const [modules, setModules] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    platformApi
      .companyModulesGet(company.id)
      .then((r) => active && setModules(r.modules ?? {}))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Não foi possível carregar os módulos."));
    return () => {
      active = false;
    };
  }, [company.id]);

  const preset = PLAN_PRESETS[(company.plan as PlanId) ?? "S2"];

  const save = async () => {
    if (!modules) return;
    setBusy(true);
    setError(null);
    try {
      // Grava o estado de todos os módulos para o registro ficar explícito.
      const full = Object.fromEntries(toggleableModules.map((m) => [m.key, modules[m.key] !== false]));
      await platformApi.companyModulesSave(company.id, full);
      await onSaved(`Módulos de ${company.name} atualizados.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Módulos contratados"
      subtitle={`${company.name} · Plano ${company.plan}`}
      icon="ri-apps-2-line"
      size="xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          {preset && modules && (
            <ModalButton variant="ghost" icon="ri-refresh-line" onClick={() => setModules(preset.modules)} disabled={busy}>
              Aplicar padrão do plano {preset.id}
            </ModalButton>
          )}
          <ModalButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={() => void save()} icon="ri-save-line" disabled={busy || !modules}>
            {busy ? "Salvando…" : "Salvar"}
          </ModalButton>
        </>
      }
    >
      {!modules && !error && <p className="text-sm text-foreground-500">Carregando…</p>}
      {modules && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {toggleableModules.map((m) => {
            const on = modules[m.key] !== false;
            return (
              <label
                key={m.key}
                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${on ? "border-primary-300 bg-primary-50/60" : "border-background-300"}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary-600"
                  checked={on}
                  onChange={(e) => setModules((prev) => ({ ...(prev ?? {}), [m.key]: e.target.checked }))}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
                    <i className={`${m.icon} text-primary-600`}></i>
                    {m.name}
                  </span>
                  <span className="block text-[11px] leading-snug text-foreground-500">{m.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      <p className="mt-4 rounded-md bg-background-100 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-600">
        Desligar um módulo esconde o menu e bloqueia as telas dele para a empresa. Os dados já registrados são preservados e
        voltam a aparecer se o módulo for religado.
      </p>
    </Modal>
  );
}
