import { useMemo, useState } from "react";
import { normalizarPlaca, transicaoReparoPermitida } from "@shared/checkin";
import {
  formatDateTimeBr,
  repairPriorityMeta,
  repairStatusMeta,
  type RepairStatus,
  type VehicleRepairRequest,
} from "@/pages/app/modules/veiculos/vehicleTypes";
import { atualizarReparo } from "@/pages/app/modules/veiculos/vehiclesStore";
import { useVehicleFileUrls } from "@/pages/app/modules/veiculos/useVehicleFiles";
import { PlatePill } from "@/pages/app/modules/veiculos/checkin/checkinUi";

interface Props {
  repairs: VehicleRepairRequest[];
  canManage: boolean;
  onOpenCheckin: (ref: string) => void;
  onToast: (kind: "ok" | "err", text: string) => void;
}

const FILTERS: { key: "abertos" | RepairStatus | "todos"; label: string }[] = [
  { key: "abertos", label: "Em aberto" },
  { key: "aberta", label: "Abertas" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluídas" },
  { key: "cancelada", label: "Canceladas" },
  { key: "todos", label: "Todas" },
];

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baixa: 3 } as const;

/** Acompanhamento das solicitações de reparo abertas nos check-ins. */
export default function RepairRequestsView({ repairs, canManage, onOpenCheckin, onToast }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("abertos");
  const [plate, setPlate] = useState("");
  const [action, setAction] = useState<{ ref: string; status: RepairStatus } | null>(null);
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const list = useMemo(() => {
    const p = normalizarPlaca(plate);
    return repairs
      .filter((item) =>
        filter === "todos"
          ? true
          : filter === "abertos"
            ? item.status === "aberta" || item.status === "em_andamento"
            : item.status === filter
      )
      .filter((item) => !p || normalizarPlaca(item.plate).includes(p))
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.requestedAt.localeCompare(a.requestedAt)
      );
  }, [repairs, filter, plate]);
  const urls = useVehicleFileUrls(list.flatMap((item) => item.photos));

  const count = (key: (typeof FILTERS)[number]["key"]) =>
    repairs.filter((item) =>
      key === "todos" ? true : key === "abertos" ? item.status === "aberta" || item.status === "em_andamento" : item.status === key
    ).length;

  const confirm = async () => {
    if (!action) return;
    if ((action.status === "concluida" || action.status === "cancelada") && resolution.trim().length < 5) {
      onToast("err", action.status === "concluida" ? "Descreva o que foi feito no reparo." : "Informe o motivo do cancelamento.");
      return;
    }
    setSaving(true);
    const result = await atualizarReparo({ ref: action.ref, status: action.status, resolution: resolution.trim() });
    setSaving(false);
    if (!result.ok) {
      onToast("err", result.detail || result.error || "Não foi possível atualizar o reparo.");
      return;
    }
    onToast("ok", result.detail || "Reparo atualizado.");
    setAction(null);
    setResolution("");
  };

  const actionsFor = (status: RepairStatus): { status: RepairStatus; label: string; icon: string }[] =>
    (
      [
        { status: "em_andamento", label: "Iniciar", icon: "ri-play-line" },
        { status: "concluida", label: "Concluir", icon: "ri-check-line" },
        { status: "cancelada", label: "Cancelar", icon: "ri-close-line" },
        { status: "aberta", label: "Reabrir", icon: "ri-restart-line" },
      ] as { status: RepairStatus; label: string; icon: string }[]
    ).filter((item) => transicaoReparoPermitida(status, item.status) && !(status === "em_andamento" && item.status === "aberta"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === item.key ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-700 hover:bg-background-200"
              }`}
            >
              {item.label} <span className="opacity-70">({count(item.key)})</span>
            </button>
          ))}
        </div>
        <input
          value={plate}
          onChange={(event) => setPlate(event.target.value.toUpperCase())}
          placeholder="Filtrar por placa"
          aria-label="Filtrar reparos por placa"
          className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-400 lg:w-56"
        />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-background-300 px-4 py-10 text-center">
          <i className="ri-tools-line text-2xl text-foreground-400"></i>
          <p className="text-sm font-semibold text-foreground-700">Nenhuma solicitação de reparo</p>
          <p className="text-xs text-foreground-500">Os pedidos feitos nos check-ins aparecem aqui.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {list.map((repair) => {
            const editing = action?.ref === repair.ref;
            return (
              <li key={repair.ref} className="flex flex-col gap-2.5 rounded-xl border border-background-200 bg-background-50 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PlatePill plate={repair.plate} size="sm" />
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${repairPriorityMeta[repair.priority].className}`}>
                        {repairPriorityMeta[repair.priority].label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${repairStatusMeta[repair.status].className}`}>
                        <i className={repairStatusMeta[repair.status].icon}></i>
                        {repairStatusMeta[repair.status].label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-foreground-950">{repair.title}</p>
                    {repair.description && <p className="text-xs text-foreground-600">{repair.description}</p>}
                  </div>
                </div>
                {repair.photos.length > 0 && (
                  <div className="flex gap-1.5">
                    {repair.photos.map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => setZoom(zoom === path ? null : path)}
                        className="h-14 w-[72px] cursor-zoom-in overflow-hidden rounded-md bg-background-200"
                      >
                        {urls[path] && <img src={urls[path]} alt="Foto do reparo" className="h-full w-full object-cover" />}
                      </button>
                    ))}
                  </div>
                )}
                {zoom && repair.photos.includes(zoom) && urls[zoom] && (
                  <img src={urls[zoom]} alt="Foto ampliada do reparo" className="max-h-72 w-full rounded-md object-contain" />
                )}
                <p className="text-[10.5px] text-foreground-500">
                  Solicitado por {repair.requestedByName || "—"} em {formatDateTimeBr(repair.requestedAt)} ·{" "}
                  <button type="button" onClick={() => onOpenCheckin(repair.checkinRef)} className="cursor-pointer font-semibold text-primary-700 underline">
                    ver check-in
                  </button>
                </p>
                {repair.resolution && (
                  <p className="rounded-md bg-background-100 px-2.5 py-1.5 text-[11px] text-foreground-700">
                    <strong>{repair.status === "cancelada" ? "Motivo" : "Resolução"}:</strong> {repair.resolution}
                    {repair.resolvedByName ? ` — ${repair.resolvedByName}, ${formatDateTimeBr(repair.resolvedAt)}` : ""}
                  </p>
                )}
                {canManage && !editing && (
                  <div className="flex flex-wrap gap-1.5">
                    {actionsFor(repair.status).map((item) => (
                      <button
                        key={item.status}
                        type="button"
                        onClick={() => {
                          setResolution("");
                          setAction({ ref: repair.ref, status: item.status });
                        }}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                          item.status === "concluida"
                            ? "border-primary-300 text-primary-700 hover:bg-primary-50"
                            : item.status === "cancelada"
                              ? "border-background-300 text-foreground-600 hover:bg-background-100"
                              : "border-secondary-300 text-secondary-800 hover:bg-secondary-50"
                        }`}
                      >
                        <i className={item.icon}></i>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
                {editing && action && (
                  <div className="rounded-md border border-primary-200 bg-primary-50 p-2.5">
                    <p className="text-[11px] font-bold text-primary-900">
                      {action.status === "concluida"
                        ? "O que foi feito?"
                        : action.status === "cancelada"
                          ? "Motivo do cancelamento"
                          : action.status === "em_andamento"
                            ? "Observação (opcional): oficina, previsão..."
                            : "Motivo da reabertura (opcional)"}
                    </p>
                    <textarea
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value.slice(0, 1000))}
                      aria-label="Descrição do andamento do reparo"
                      className="mt-1.5 min-h-[52px] w-full resize-y rounded-md border border-background-300 bg-background-50 px-2.5 py-1.5 text-xs outline-none focus:border-primary-400"
                    ></textarea>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAction(null)}
                        className="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold text-foreground-600 hover:bg-background-100"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirm()}
                        disabled={saving}
                        className="cursor-pointer rounded-md bg-primary-500 px-3 py-1 text-[11px] font-semibold text-background-50 hover:bg-primary-600 disabled:opacity-60"
                      >
                        {saving ? "Salvando..." : `Confirmar: ${repairStatusMeta[action.status].label}`}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
