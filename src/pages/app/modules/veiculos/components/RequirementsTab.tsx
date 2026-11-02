import { useState } from "react";
import { vehiclePurposes, type VehicleRequirement } from "@/pages/app/modules/veiculos/vehicleTypes";

interface Props {
  requirements: VehicleRequirement[];
  canManage: boolean;
  onNew: () => void;
  onEdit: (requirement: VehicleRequirement) => void;
  onDeactivate: (requirement: VehicleRequirement) => Promise<boolean>;
}

const purposeLabel = (key: string) =>
  vehiclePurposes.find((item) => item.key === key)?.label ?? "Qualquer finalidade";

export default function RequirementsTab({
  requirements,
  canManage,
  onNew,
  onEdit,
  onDeactivate,
}: Props) {
  const [showInactive, setShowInactive] = useState(false);
  const [confirmRef, setConfirmRef] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const visible = requirements.filter((item) => (showInactive ? true : item.active));
  const activeCount = requirements.filter((item) => item.active).length;

  const handleDeactivate = async (requirement: VehicleRequirement) => {
    setBusyRef(requirement.ref);
    const ok = await onDeactivate(requirement);
    setBusyRef(null);
    setConfirmRef(null);
    if (ok) setShowInactive(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3.5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-2.5">
          <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
          <div>
            <p className="text-xs font-semibold text-secondary-900">
              As exigências começam vazias — nada é presumido obrigatório.
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-secondary-800">
              Cada empresa define o que exige por categoria e finalidade de uso. A lista é uma
              parametrização interna e não representa garantia automática de conformidade legal.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInactive((prev) => !prev)}
            className="cursor-pointer whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
          >
            <i className={`mr-1 ${showInactive ? "ri-eye-off-line" : "ri-eye-line"}`}></i>
            {showInactive ? "Ocultar desativadas" : `Mostrar desativadas (${requirements.length - activeCount})`}
          </button>
          {canManage && (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-700"
            >
              <i className="ri-add-line"></i>
              Nova exigência
            </button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-background-200 bg-background-50">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background-100 text-foreground-400">
              <i className="ri-list-check-2 text-xl"></i>
            </span>
            <p className="font-heading text-sm font-bold text-foreground-900">Nenhuma exigência configurada</p>
            <p className="max-w-md text-xs text-foreground-500">
              Enquanto não houver exigência, a ficha do veículo não aponta documentos ausentes. Configure
              o que a empresa realmente exige por categoria.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={onNew}
                className="mt-1 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-4 py-2 text-xs font-semibold text-background-50 hover:bg-primary-700"
              >
                <i className="ri-add-line"></i>
                Criar primeira exigência
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-background-200 bg-background-100 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Documento</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Categoria</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Finalidade</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Regra</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Aviso</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Responsável</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.ref} className={`border-b border-background-100 ${item.active ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-foreground-900">{item.typeLabel}</span>
                      {item.notes && (
                        <span className="mt-0.5 block max-w-xs truncate text-[11px] text-foreground-400">{item.notes}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">
                      {item.category === "*" ? "Todas" : item.category}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">{purposeLabel(item.purpose)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.required ? "bg-primary-100 text-primary-700" : "bg-background-200 text-foreground-600"
                          }`}
                        >
                          {item.required ? "obrigatório" : "recomendado"}
                        </span>
                        <span className="rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                          {item.hasExpiry ? "com vencimento" : "sem vencimento"}
                        </span>
                        {!item.active && (
                          <span className="rounded-full bg-background-300 px-2 py-0.5 text-[10px] font-bold text-foreground-600">
                            desativada
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">
                      {item.hasExpiry ? `${item.alertDays} dias antes` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-700">{item.responsible || "—"}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        confirmRef === item.ref ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmRef(null)}
                              className="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={busyRef === item.ref}
                              onClick={() => void handleDeactivate(item)}
                              className="cursor-pointer whitespace-nowrap rounded-md bg-danger-600 px-2.5 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-danger-700 disabled:opacity-60"
                            >
                              {busyRef === item.ref ? "Desativando..." : "Confirmar"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              aria-label="Editar exigência"
                              onClick={() => onEdit(item)}
                              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-900"
                            >
                              <i className="ri-edit-line text-sm"></i>
                            </button>
                            {item.active && (
                              <button
                                type="button"
                                aria-label="Desativar exigência"
                                onClick={() => setConfirmRef(item.ref)}
                                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-danger-100 hover:text-danger-700"
                              >
                                <i className="ri-close-circle-line text-sm"></i>
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="block text-right text-[11px] text-foreground-400">somente leitura</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}