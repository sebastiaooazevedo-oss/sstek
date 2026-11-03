/**
 * Regras de tela do check-in de segurança e do painel de check-ins realizados.
 * Arquivo puro (testado em checkinRules.test.ts). As validações que o servidor
 * também faz ficam em `@shared/checkin`.
 */
import { dentroDoPeriodo, type ConsultaPeriodo } from "@/core/listing";
import { kmRodados, normalizarPlaca } from "@shared/checkin";
import type {
  CheckinDamage,
  CheckinKind,
  DamageSeverity,
  DamageType,
  VehicleCheckin,
  VehicleRepairRequest,
} from "@/pages/app/modules/veiculos/vehicleTypes";

export const damageTypeMeta: Record<DamageType, { label: string; icon: string }> = {
  risco: { label: "Risco", icon: "ri-pencil-ruler-line" },
  amassado: { label: "Amassado", icon: "ri-contrast-drop-line" },
  quebrado: { label: "Quebrado", icon: "ri-hammer-line" },
  trincado: { label: "Trincado", icon: "ri-flashlight-line" },
  faltante: { label: "Peça faltando", icon: "ri-question-line" },
  desgaste: { label: "Desgaste", icon: "ri-hourglass-line" },
  outro: { label: "Outro", icon: "ri-more-line" },
};

export const severityMeta: Record<DamageSeverity, { label: string; className: string; dot: string }> = {
  leve: { label: "Leve", className: "bg-secondary-100 text-secondary-800", dot: "#3b82f6" },
  moderada: { label: "Moderada", className: "bg-accent-100 text-accent-800", dot: "#f59e0b" },
  grave: { label: "Grave", className: "bg-danger-100 text-danger-800", dot: "#dc2626" },
};

/** Nível de combustível em frações, como no marcador do painel. */
export const FUEL_STEPS = [0, 13, 25, 38, 50, 63, 75, 88, 100];

export function fuelLabel(value: number | null): string {
  if (value === null) return "—";
  if (value <= 5) return "Reserva";
  if (value >= 95) return "Cheio";
  const quartos: [number, string][] = [
    [13, "1/8"],
    [25, "1/4"],
    [38, "3/8"],
    [50, "1/2"],
    [63, "5/8"],
    [75, "3/4"],
    [88, "7/8"],
  ];
  const near = quartos.reduce((best, item) => (Math.abs(item[0] - value) < Math.abs(best[0] - value) ? item : best));
  return `${near[1]} (${value}%)`;
}

/** Avarias que contam como problema novo (pré-existentes só foram confirmadas). */
export function avariasNovas(checkin: Pick<VehicleCheckin, "damages">): CheckinDamage[] {
  return (checkin.damages ?? []).filter((item) => !item.preexisting);
}

/** O check-in tem alguma avaria registrada (mapa novo ou item "avaria" da conferência). */
export function temAvaria(checkin: VehicleCheckin): boolean {
  return avariasNovas(checkin).length > 0 || checkin.items.some((item) => item.result === "avaria");
}

/**
 * Avarias do último check-in do veículo, que o próximo condutor confirma como
 * pré-existentes (assim ninguém responde por dano que já estava lá).
 * Avarias com reparo concluído não voltam.
 */
export function avariasPreexistentes(
  checkins: VehicleCheckin[],
  vehicleRef: string,
  repairs: VehicleRepairRequest[] = []
): CheckinDamage[] {
  const ultimo = checkins
    .filter((item) => item.vehicleRef === vehicleRef)
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
  if (!ultimo) return [];
  // A avaria mantém o mesmo id de um check-in para o outro; reparo concluído a remove.
  const reparadas = new Set(
    repairs
      .filter((item) => item.vehicleRef === vehicleRef && item.status === "concluida" && item.damageId)
      .map((item) => item.damageId)
  );
  return (ultimo.damages ?? [])
    .filter((damage) => !reparadas.has(damage.id))
    .map((damage) => ({ ...damage, preexisting: true, repair: false }));
}

/** Retirada ligada a uma devolução (para calcular km rodados). */
export function retiradaDe(checkin: VehicleCheckin, checkins: VehicleCheckin[]): VehicleCheckin | null {
  if (checkin.kind !== "devolucao" || !checkin.linkedRef) return null;
  return checkins.find((item) => item.ref === checkin.linkedRef) ?? null;
}

export function kmDoCheckin(checkin: VehicleCheckin, checkins: VehicleCheckin[]): number | null {
  const retirada = retiradaDe(checkin, checkins);
  return retirada ? kmRodados(retirada.odometer, checkin.odometer) : null;
}

export interface FiltroCheckins {
  periodo: ConsultaPeriodo;
  de: string;
  ate: string;
  condutor: string;
  placa: string;
  tipo: CheckinKind | "";
  somenteAvaria: boolean;
  veiculo: string;
}

export const filtroVazio: FiltroCheckins = {
  periodo: "all",
  de: "",
  ate: "",
  condutor: "",
  placa: "",
  tipo: "",
  somenteAvaria: false,
  veiculo: "",
};

const semAcento = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Aplica os filtros do painel e devolve do mais recente para o mais antigo. */
export function filtrarCheckins(checkins: VehicleCheckin[], filtro: FiltroCheckins): VehicleCheckin[] {
  const condutor = semAcento(filtro.condutor);
  const placa = normalizarPlaca(filtro.placa);
  return checkins
    .filter((item) => dentroDoPeriodo(item.performedAt, filtro.periodo, filtro.de, filtro.ate))
    .filter((item) => !filtro.tipo || item.kind === filtro.tipo)
    .filter((item) => !filtro.veiculo || item.vehicleRef === filtro.veiculo)
    .filter((item) => !condutor || semAcento(item.responsibleName).includes(condutor))
    .filter((item) => !placa || normalizarPlaca(item.plateSnapshot).includes(placa))
    .filter((item) => !filtro.somenteAvaria || temAvaria(item))
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
}

export function condutoresDe(checkins: VehicleCheckin[]): string[] {
  return Array.from(new Set(checkins.map((item) => item.responsibleName.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export interface ResumoCheckins {
  total: number;
  retiradas: number;
  devolucoes: number;
  emUso: number;
  comAvaria: number;
  kmRodados: number;
  reparosAbertos: number;
}

export function resumoCheckins(
  lista: VehicleCheckin[],
  todos: VehicleCheckin[],
  repairs: VehicleRepairRequest[]
): ResumoCheckins {
  return {
    total: lista.length,
    retiradas: lista.filter((item) => item.kind === "entrega").length,
    devolucoes: lista.filter((item) => item.kind === "devolucao").length,
    emUso: todos.filter((item) => item.kind === "entrega" && item.status === "aberta").length,
    comAvaria: lista.filter(temAvaria).length,
    kmRodados: lista.reduce((soma, item) => soma + (kmDoCheckin(item, todos) ?? 0), 0),
    reparosAbertos: repairs.filter((item) => item.status === "aberta" || item.status === "em_andamento").length,
  };
}

function dataHora(value: string): { data: string; hora: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { data: "", hora: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    data: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
    hora: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV (separado por ponto e vírgula, abre direto no Excel em português). */
export function checkinsParaCsv(lista: VehicleCheckin[], todos: VehicleCheckin[]): string {
  const header = [
    "Data",
    "Hora",
    "Tipo",
    "Placa",
    "Categoria",
    "Condutor",
    "Conferente",
    "Hodômetro (km)",
    "Km rodados",
    "Combustível (%)",
    "Avarias novas",
    "Itens com avaria",
    "Reparos solicitados",
    "Registrado por",
    "Protocolo",
  ];
  const rows = lista.map((item) => {
    const { data, hora } = dataHora(item.performedAt);
    return [
      data,
      hora,
      item.kind === "entrega" ? "Retirada" : "Devolução",
      item.plateSnapshot,
      item.vehicleCategory,
      item.responsibleName,
      item.conferenteName,
      item.odometer ?? "",
      kmDoCheckin(item, todos) ?? "",
      item.fuelLevel ?? "",
      avariasNovas(item).length,
      item.items.filter((it) => it.result === "avaria").length,
      item.repairRequests.length,
      item.performedByName,
      item.ref,
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}

/* ------------------ Conferência de segurança por tipo ------------------ */

export interface ItemConferencia {
  key: string;
  label: string;
  hint: string;
  icon: string;
}

const ITENS_BASE: ItemConferencia[] = [
  { key: "pneus", label: "Pneus, rodas e estepe", hint: "Calibragem, sulcos, cortes e bolhas", icon: "ri-donut-chart-line" },
  { key: "freios", label: "Freios e freio de mão", hint: "Pedal firme, sem ruído, freio de estacionamento", icon: "ri-stop-circle-line" },
  { key: "iluminacao", label: "Iluminação e sinalização", hint: "Faróis, lanternas, setas, freio e ré", icon: "ri-lightbulb-flash-line" },
  { key: "fluidos", label: "Óleo, água e fluidos", hint: "Níveis e vazamentos visíveis", icon: "ri-drop-line" },
  { key: "lataria", label: "Lataria, para-choques e carroceria", hint: "Detalhe no mapa de avarias", icon: "ri-car-washing-line" },
  { key: "vidros", label: "Vidros, retrovisores e limpadores", hint: "Trincas, regulagem e palhetas", icon: "ri-window-line" },
  { key: "cintos", label: "Cintos, bancos e cabine", hint: "Travamento dos cintos e fixação dos bancos", icon: "ri-shield-user-line" },
  { key: "equipamentos", label: "Extintor, triângulo, macaco e chave de roda", hint: "Presentes e dentro da validade", icon: "ri-fire-line" },
  { key: "painel", label: "Painel sem luz de alerta", hint: "Motor, freio, óleo, bateria, airbag", icon: "ri-dashboard-3-line" },
  { key: "limpeza", label: "Limpeza e conservação", hint: "Interior e exterior", icon: "ri-sparkling-line" },
  { key: "documentos", label: "Documentos do veículo", hint: "CRLV e documentos obrigatórios a bordo", icon: "ri-file-shield-2-line" },
];

const ITENS_MOTO: ItemConferencia[] = [
  { key: "pneus", label: "Pneus e rodas", hint: "Calibragem, sulcos, cortes e bolhas", icon: "ri-donut-chart-line" },
  { key: "freios", label: "Freios dianteiro e traseiro", hint: "Manete e pedal firmes", icon: "ri-stop-circle-line" },
  { key: "iluminacao", label: "Iluminação e sinalização", hint: "Farol, lanterna, setas e freio", icon: "ri-lightbulb-flash-line" },
  { key: "transmissao", label: "Corrente, coroa e pinhão", hint: "Folga, lubrificação e desgaste", icon: "ri-links-line" },
  { key: "fluidos", label: "Óleo e fluidos", hint: "Níveis e vazamentos visíveis", icon: "ri-drop-line" },
  { key: "retrovisores", label: "Retrovisores e manetes", hint: "Fixação e regulagem", icon: "ri-eye-line" },
  { key: "capacete", label: "Capacete, viseira e antena corta-pipa", hint: "Capacete certificado e sem trincas", icon: "ri-shield-user-line" },
  { key: "painel", label: "Painel e buzina", hint: "Sem luz de alerta, buzina funcionando", icon: "ri-dashboard-3-line" },
  { key: "documentos", label: "Documentos do veículo", hint: "CRLV a bordo", icon: "ri-file-shield-2-line" },
];

const ITENS_MAQUINA: ItemConferencia[] = [
  { key: "rodado", label: "Pneus / esteiras", hint: "Desgaste, cortes e tensão", icon: "ri-donut-chart-line" },
  { key: "freios", label: "Freios e travas", hint: "Freio de serviço e de estacionamento", icon: "ri-stop-circle-line" },
  { key: "hidraulico", label: "Sistema hidráulico", hint: "Mangueiras, cilindros e vazamentos", icon: "ri-drop-line" },
  { key: "implemento", label: "Implemento e engates", hint: "Garfo, lâmina, caçamba, pinos e travas", icon: "ri-tools-line" },
  { key: "sinalizacao", label: "Sinal sonoro de ré e giroflex", hint: "Funcionando e audível", icon: "ri-alarm-warning-line" },
  { key: "cintos", label: "Cinto, cabine e proteção do operador", hint: "Cinto, estrutura de proteção (ROPS/FOPS)", icon: "ri-shield-user-line" },
  { key: "equipamentos", label: "Extintor", hint: "Presente e dentro da validade", icon: "ri-fire-line" },
  { key: "painel", label: "Painel sem luz de alerta", hint: "Temperatura, óleo, bateria", icon: "ri-dashboard-3-line" },
  { key: "limpeza", label: "Limpeza e conservação", hint: "Acessos e degraus limpos", icon: "ri-sparkling-line" },
];

/** Itens da conferência de segurança conforme o tipo de veículo. */
export function itensConferencia(kind: string): ItemConferencia[] {
  if (kind === "moto") return ITENS_MOTO;
  if (kind === "maquina") return ITENS_MAQUINA;
  return ITENS_BASE;
}

/** Prioridade sugerida para o reparo de uma avaria. */
export function prioridadeSugerida(severity: DamageSeverity): "baixa" | "media" | "alta" {
  return severity === "grave" ? "alta" : severity === "moderada" ? "media" : "baixa";
}
