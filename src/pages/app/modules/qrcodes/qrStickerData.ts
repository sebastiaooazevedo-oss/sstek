import type { Cipa } from "@/mocks/cipa";
import { collaborators, type Collaborator } from "@/mocks/collaborators";
import { epiCatalog, initialEpiDeliveries, type EpiDelivery } from "@/mocks/epi";

/**
 * Dados extras impressos no selo do capacete.
 *
 * O QR-Code do colaborador continua sendo a peça principal do adesivo, mas o
 * selo que vai no capacete também carrega a validade do CA do capacete em uso
 * e o telefone do SESMT — as duas informações que o trabalhador precisa ter
 * à mão em campo.
 */
export interface HelmetCaInfo {
  /** Número do CA do capacete entregue (ex.: "31.469"). */
  ca: string;
  /** Nome do equipamento como registrado na ficha de EPI. */
  name: string;
  /** Validade do certificado de aprovação (DD/MM/AAAA). Vazio quando a base não informa. */
  validity: string;
  /** Data da entrega do capacete ao colaborador (DD/MM/AAAA). */
  deliveredAt: string;
  /**
   * `true` quando a validade do CA já passou. É o gatilho do destaque em
   * vermelho no selo, para o fiscal enxergar o problema de imediato.
   */
  expired: boolean;
}

function dateToTime(value: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value || "").trim());
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}

function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/**
 * Diz se uma data DD/MM/AAAA já passou.
 * A comparação é feita no início do dia de hoje, então o CA vale até o último
 * dia do mês/ano informado — igual à conferência feita em campo.
 */
export function isExpiredDate(value: string, reference: Date = new Date()): boolean {
  const time = dateToTime(value);
  if (!time) return false;
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  return time < today;
}

/**
 * Localiza o capacete entregue ao colaborador e devolve o CA com a validade.
 *
 * A fonte é a ficha de EPI (entregas). Quando ainda não há entrega carregada,
 * usa a base inicial como referência, para o adesivo nunca sair sem a
 * informação por causa de uma consulta ainda em andamento.
 */
export function resolveHelmetCa(
  collaboratorId: string,
  deliveries: EpiDelivery[],
): HelmetCaInfo | null {
  const pool = deliveries.length > 0 ? deliveries : initialEpiDeliveries;
  const helmets = pool
    .filter((delivery) => delivery.collaboratorId === collaboratorId)
    .flatMap((delivery) =>
      (delivery.items || [])
        .filter((item) => /capacete/i.test(item.name))
        .map((item) => ({ item, date: delivery.date })),
    )
    .sort((a, b) => dateToTime(b.date) - dateToTime(a.date));

  const latest = helmets[0];
  if (!latest) return null;

  const catalogItem = epiCatalog.find((entry) => onlyDigits(entry.ca) === onlyDigits(latest.item.ca));

  const validity = catalogItem?.approvalValidity ?? "";

  return {
    ca: latest.item.ca,
    name: latest.item.name,
    validity,
    deliveredAt: latest.date,
    expired: isExpiredDate(validity),
  };
}

function normalize(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Telefone do SESMT a partir da composição da CIPA.
 *
 * A CIPA guarda quem é do SESMT (área do membro). O telefone vem do cadastro
 * do colaborador correspondente. Quando não existe membro de SESMT na
 * comissão, usa o telefone cadastrado nas Configurações; se também não houver,
 * o selo simplesmente não imprime essa linha.
 */
export function resolveSesmtPhone(
  cipas: Cipa[],
  people: Collaborator[] = collaborators,
  fallbackPhone = "",
): string | null {
  for (const cipa of cipas) {
    const member = (cipa.members ?? []).find((item) => normalize(item.area).includes("SESMT"));
    if (!member) continue;
    const person = people.find((item) => normalize(item.name) === normalize(member.name));
    if (person?.phone) return person.phone;
  }
  const fallback = (fallbackPhone || "").trim();
  return fallback ? fallback : null;
}

/** Mapa colaborador → dados do capacete, para reaproveitar na folha de impressão. */
export function buildHelmetCaMap(
  collaboratorIds: string[],
  deliveries: EpiDelivery[],
): Record<string, HelmetCaInfo | null> {
  const map: Record<string, HelmetCaInfo | null> = {};
  collaboratorIds.forEach((id) => {
    map[id] = resolveHelmetCa(id, deliveries);
  });
  return map;
}