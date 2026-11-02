import { useMemo, useState } from "react";
import {
  epcKindLabels,
  epcStatusMeta,
  formatDateTimeBr,
  type Vehicle,
  type VehicleEpcLink,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { desvincularEpc, transferirEpc } from "@/pages/app/modules/veiculos/vehiclesStore";

interface Props {
  vehicles: Vehicle[];
  epcLinks: VehicleEpcLink[];
  canManage: boolean;
  onNew: (vehicleRef: string | null) => void;
  onToast: (kind: "ok" | "err", text: string) => void;
}

function EpcRow({
  link,
  vehicles,
  canManage,
  onToast,
}: {
  link: VehicleEpcLink;
  vehicles: Vehicle[];
  canManage: boolean;
  onToast: (kind: "ok" | "err", text: string) => void;
}) {
  const [mode, setMode] = useState<"none" | "retirar" | "transferir">("none");
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const targets = vehicles.filter(
    (vehicle) => vehicle.ref !== link.vehicleRef && vehicle.status !== "inativo"
  );
  const statusMeta = epcStatusMeta[link.status];

  const runRemove = async () => {
    if (reason.trim().length < 10) {
      onToast("err", "Informe o motivo com pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    const result = await desvincularEpc(link.ref, reason.trim());
    setSaving(false);
    if (!result.ok) {
      onToast("err", result.detail || result.error || "Não foi possível desvincular.");
      return;
    }
    setMode("none");
    setReason("");
    onToast("ok", result.detail || "Equipamento desvinculado.");
  };

  const runTransfer = async () => {
    if (!target) {
      onToast("err", "Selecione o veículo de destino.");
      return;
    }
    if (reason.trim().length < 10) {
      onToast("err", "Informe o motivo com pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    const result = await transferirEpc(link.ref, target, reason.trim());
    setSaving(false);
    if (!result.ok) {
      onToast("err", result.detail || result.error || "Não foi possível transferir.");
      return;
    }
    setMode("none");
    setReason("");
    setTarget("");
    onToast("ok", result.detail || "Equipamento transferido.");
  };

  return (
    <div className="rounded-lg border border-background-200 bg-background-50">
      <div className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground-950">
            <span className="truncate">{link.epiName}</span>
            <span className="rounded-full bg-background-200 px-1.5 py-0.5 text-[10px] font-bold text-foreground-600">
              {epcKindLabels[link.kind]}
            </span>
            {link.identification && (
              <span className="rounded-full bg-secondary-100 px-1.5 py-0.5 text-[10px] font-bold text-secondary-800">
                {link.identification}
              </span>
            )}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-foreground-500">
            Qtd. {link.quantity}
            {link.epiCa ? ` · CA ${link.epiCa}` : ""} · vinculado em {formatDateTimeBr(link.linkedAt)}
            {link.linkedByName ? ` por ${link.linkedByName}` : ""}
            {link.source === "epi_delivery" && link.sourceRef ? ` · origem entrega ${link.sourceRef}` : ""}
          </p>
          {link.status !== "ativo" && (
            <p className="mt-0.5 text-[10px] text-foreground-500">
              {link.unlinkReason || "—"}
              {link.unlinkedAt ? ` · ${formatDateTimeBr(link.unlinkedAt)}` : ""}
            </p>
          )}
        </div>
        {canManage && link.status === "ativo" && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode(mode === "transferir" ? "none" : "transferir")}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2 py-1.5 text-[10px] font-semibold text-foreground-700 hover:bg-background-100"
            >
              <i className="ri-arrow-left-right-line"></i>
              Transferir
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "retirar" ? "none" : "retirar")}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-background-300 px-2 py-1.5 text-[10px] font-semibold text-foreground-700 hover:bg-danger-50 hover:text-danger-700"
            >
              <i className="ri-logout-box-line"></i>
              Retirar
            </button>
          </div>
        )}
      </div>

      {mode !== "none" && (
        <div className="border-t border-background-200 px-3 py-2.5">
          {mode === "transferir" && (
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="mb-2 w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
            >
              <option value="">Veículo de destino</option>
              {targets.map((vehicle) => (
                <option key={vehicle.ref} value={vehicle.ref}>
                  {vehicle.plate} · {vehicle.model || vehicle.category || "veículo"}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 500))}
            placeholder={
              mode === "transferir"
                ? "Motivo da transferência (mínimo 10 caracteres)"
                : "Motivo da retirada (mínimo 10 caracteres)"
            }
            className="min-h-[52px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
          ></textarea>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode("none")}
              className="cursor-pointer whitespace-nowrap rounded-md border border-background-300 px-3 py-1.5 text-[11px] font-semibold text-foreground-700 hover:bg-background-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={mode === "transferir" ? runTransfer : runRemove}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-background-50 hover:bg-primary-700 disabled:opacity-60"
            >
              <i className="ri-check-line"></i>
              {saving ? "Salvando..." : mode === "transferir" ? "Confirmar transferência" : "Confirmar retirada"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EpcTab({ vehicles, epcLinks, canManage, onNew, onToast }: Props) {
  const [vehicleFilter, setVehicleFilter] = useState("todos");
  const [showHistory, setShowHistory] = useState(false);

  const active = epcLinks.filter((link) => link.status === "ativo");
  const filtered = useMemo(() => {
    const base = showHistory ? epcLinks : active;
    if (vehicleFilter === "todos") return base;
    return base.filter((link) => link.vehicleRef === vehicleFilter);
  }, [epcLinks, active, showHistory, vehicleFilter]);

  const totals = {
    ativos: active.length,
    epc: active.filter((link) => link.kind === "epc").length,
    acessorios: active.filter((link) => link.kind === "acessorio").length,
    identificados: active.filter((link) => link.identification).length,
  };

  const grouped = useMemo(() => {
    const map = new Map<string, VehicleEpcLink[]>();
    filtered.forEach((link) => {
      const list = map.get(link.vehicleRef) ?? [];
      list.push(link);
      map.set(link.vehicleRef, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Vínculos ativos", value: totals.ativos, icon: "ri-links-line" },
          { label: "EPCs no veículo", value: totals.epc, icon: "ri-shield-cross-line" },
          { label: "Acessórios", value: totals.acessorios, icon: "ri-briefcase-4-line" },
          { label: "Com identificação individual", value: totals.identificados, icon: "ri-qr-code-line" },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-background-200 bg-background-50 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className={`${tile.icon} text-base`}></i>
            </span>
            <p className="mt-3 font-heading text-xl font-extrabold tracking-tight text-foreground-950">
              {tile.value}
            </p>
            <p className="mt-0.5 text-[11px] font-medium leading-tight text-foreground-500">{tile.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-background-200 bg-background-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-shield-cross-line text-base"></i>
            </span>
            <div>
              <h2 className="font-heading text-sm font-bold text-foreground-950">
                Equipamentos vinculados ao veículo
              </h2>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-foreground-500">
                EPCs e acessórios ficam separados por classificação. A identificação individual impede que o
                mesmo equipamento apareça ativo em dois veículos — use transferência em vez de duplicar.
              </p>
            </div>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => onNew(vehicleFilter === "todos" ? null : vehicleFilter)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-background-50 hover:bg-primary-700"
            >
              <i className="ri-add-line"></i>
              Vincular equipamento
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={vehicleFilter}
            onChange={(event) => setVehicleFilter(event.target.value)}
            className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs text-foreground-900 outline-none focus:border-primary-400"
          >
            <option value="todos">Todos os veículos</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.ref} value={vehicle.ref}>
                {vehicle.plate}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-background-300 px-2.5 py-2 text-[11px] font-medium text-foreground-700">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(event) => setShowHistory(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary-600"
            />
            Mostrar retirados e transferidos
          </label>
        </div>

        {grouped.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-6 text-center text-xs text-foreground-600">
            Nenhum equipamento vinculado com este filtro. Vínculos são feitos a partir do veículo, não em um
            cadastro paralelo.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {grouped.map(([vehicleRef, links]) => {
              const vehicle = vehicles.find((item) => item.ref === vehicleRef) ?? null;
              return (
                <div key={vehicleRef}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-400">
                    <i className="ri-truck-line"></i>
                    {vehicle ? `${vehicle.plate} · ${vehicle.model || vehicle.category || "veículo"}` : vehicleRef}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {links.map((link) => (
                      <EpcRow
                        key={link.ref}
                        link={link}
                        vehicles={vehicles}
                        canManage={canManage}
                        onToast={onToast}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}