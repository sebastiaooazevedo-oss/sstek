import type { Collaborator } from "@/mocks/collaborators";
import type { MedicalCertificate } from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";

/**
 * Regras compartilhadas de leitura dos atestados médicos.
 *
 * Centraliza a data de recebimento, a unidade responsável e o recorte por
 * período/unidade, para que o card de atestados e o resumo de absenteísmo do
 * dashboard falem exatamente a mesma língua.
 */

export interface CertificateScope {
  /** Mesma regra de período usada pelos demais indicadores do dashboard. */
  matchesPeriod: (date: string) => boolean;
  /** Unidade aplicada no filtro do dashboard (vazio = todas). */
  unitLabel?: string;
}

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Converte "YYYY-MM-DD" (ou timestamp ISO) em "DD/MM/YYYY". */
export function isoToBr(value: string): string {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Data em que o atestado entrou no sistema (usada pelo card de recebidos). */
export function certificateReceivedDate(cert: MedicalCertificate): string {
  return cert.createdAt ? isoToBr(cert.createdAt) : isoToBr(cert.issuedOn);
}

/**
 * Mês de referência do afastamento: o mês da emissão do atestado (início do
 * afastamento). Atestados antigos sem emissão caem para a data de criação.
 */
export function certificateLeaveMonth(cert: MedicalCertificate): string {
  const source = cert.issuedOn || cert.createdAt;
  if (!source) return "";
  const iso = /^\d{4}-\d{2}/.test(source) ? source : isoToBr(source).split("/").reverse().join("-");
  return iso.slice(0, 7);
}

/** Unidade do atestado: a gravada no registro ou, se faltar, a do cadastro. */
export function certificateUnit(
  cert: MedicalCertificate,
  collaboratorsById: Map<string, Collaborator>
): string {
  return cert.establishment || collaboratorsById.get(cert.collaboratorId)?.establishment || "";
}

/** Aplica o recorte de período + unidade do dashboard na lista de atestados. */
export function filterCertificatesByScope(
  certificates: MedicalCertificate[],
  collaboratorsById: Map<string, Collaborator>,
  scope: CertificateScope
): MedicalCertificate[] {
  return certificates.filter((cert) => {
    if (!scope.matchesPeriod(certificateReceivedDate(cert))) return false;
    if (!scope.unitLabel) return true;
    return certificateUnit(cert, collaboratorsById) === scope.unitLabel;
  });
}

export interface AbsenteeismMonth {
  key: string;
  /** Rótulo curto do mês, ex.: "Out/26". */
  label: string;
  days: number;
  certificates: number;
  people: number;
}

export interface AbsenteeismUnit {
  unit: string;
  days: number;
  certificates: number;
  people: number;
}

export interface AbsenteeismSummary {
  /** Dias de afastamento somados no recorte. */
  totalDays: number;
  /** Atestados no recorte (com ou sem afastamento). */
  certificates: number;
  /** Atestados que geraram afastamento. */
  withLeave: number;
  /** Colaboradores distintos com atestado no recorte. */
  people: number;
  /** Média de dias de afastamento por colaborador afastado. */
  daysPerPerson: number;
  months: AbsenteeismMonth[];
  units: AbsenteeismUnit[];
  /** Maior afastamento individual do recorte (em dias). */
  longestLeave: number;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const label = MONTHS_SHORT[Number(month) - 1];
  if (!label) return key;
  return `${label}/${year.slice(2)}`;
}

/**
 * Monta o resumo de absenteísmo (dias de afastamento por mês e por unidade)
 * a partir dos atestados já recortados por período/unidade.
 */
export function buildAbsenteeism(
  certificates: MedicalCertificate[],
  collaboratorsById: Map<string, Collaborator>
): AbsenteeismSummary {
  const monthMap = new Map<string, { days: number; certificates: number; people: Set<string> }>();
  const unitMap = new Map<string, { days: number; certificates: number; people: Set<string> }>();
  const allPeople = new Set<string>();
  let totalDays = 0;
  let withLeave = 0;
  let longestLeave = 0;

  certificates.forEach((cert) => {
    const days = Math.max(0, cert.leaveDays || 0);
    const month = certificateLeaveMonth(cert);
    const unit = certificateUnit(cert, collaboratorsById) || "Sem unidade cadastrada";

    allPeople.add(cert.collaboratorId);
    totalDays += days;
    if (days > 0) withLeave += 1;
    if (days > longestLeave) longestLeave = days;

    if (month) {
      const current = monthMap.get(month) ?? { days: 0, certificates: 0, people: new Set<string>() };
      current.days += days;
      current.certificates += 1;
      current.people.add(cert.collaboratorId);
      monthMap.set(month, current);
    }

    const currentUnit = unitMap.get(unit) ?? { days: 0, certificates: 0, people: new Set<string>() };
    currentUnit.days += days;
    currentUnit.certificates += 1;
    currentUnit.people.add(cert.collaboratorId);
    unitMap.set(unit, currentUnit);
  });

  const months: AbsenteeismMonth[] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, value]) => ({
      key,
      label: monthLabel(key),
      days: value.days,
      certificates: value.certificates,
      people: value.people.size,
    }));

  const units: AbsenteeismUnit[] = Array.from(unitMap.entries())
    .map(([unit, value]) => ({
      unit,
      days: value.days,
      certificates: value.certificates,
      people: value.people.size,
    }))
    .sort((a, b) => b.days - a.days || a.unit.localeCompare(b.unit));

  const peopleWithLeave = new Set(
    certificates.filter((cert) => (cert.leaveDays || 0) > 0).map((cert) => cert.collaboratorId)
  ).size;

  return {
    totalDays,
    certificates: certificates.length,
    withLeave,
    people: allPeople.size,
    daysPerPerson: peopleWithLeave > 0 ? Math.round((totalDays / peopleWithLeave) * 10) / 10 : 0,
    months,
    units,
    longestLeave,
  };
}