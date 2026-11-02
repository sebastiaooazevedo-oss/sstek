import type { AttendanceSheet } from "@/pages/app/modules/documentos/attendanceStore";
import {
  requestDocumentSeal,
  sealPrintHtml,
  type DocumentSeal,
  type SealSigner,
} from "@/pages/app/signature/authenticitySeal";

export interface AttendanceSealParticipant {
  name: string;
  role?: string | null;
  signed: boolean;
}

/** Participantes que podem compor a chancela (facilitador + inscritos). */
export function attendanceSealParticipants(sheet: AttendanceSheet): AttendanceSealParticipant[] {
  const participants = sheet.participants
    .filter((p) => p.name.trim().length > 1)
    .map((p) => ({
      name: p.name.trim(),
      role: p.role.trim() || null,
      signed: Boolean(p.signature),
    }));

  if (sheet.facilitator.trim()) {
    participants.unshift({
      name: sheet.facilitator.trim(),
      role: "Facilitador",
      signed: Boolean(sheet.facilitatorSignature),
    });
  }

  return participants;
}

/** Sem nenhuma assinatura coletada não existe chancela a emitir. */
export function attendanceHasSignature(sheet: AttendanceSheet): boolean {
  return attendanceSealParticipants(sheet).some((p) => p.signed);
}

/**
 * Chancela de autenticidade da Ficha de Presença (treinamentos em Documentos).
 *
 * O selo só nasce quando ao menos um participante (ou o facilitador) possui
 * assinatura coletada. O conteúdo canônico é o mesmo usado na exportação, então
 * abrir a prévia e exportar em seguida reaproveita o mesmo selo no servidor.
 */
export async function attendanceSeal(sheet: AttendanceSheet): Promise<DocumentSeal | null> {
  const participants = attendanceSealParticipants(sheet);
  if (!participants.some((p) => p.signed)) return null;

  const signers: SealSigner[] = participants
    .filter((p) => p.signed)
    .map((p) => ({ name: p.name, role: p.role ?? null }));

  return requestDocumentSeal({
    scope: "presenca",
    referenceRef: sheet.id,
    referenceLabel: `Ficha de Presença — ${sheet.title.trim()} (${sheet.date})`,
    signers,
    content: {
      id: sheet.id,
      title: sheet.title.trim(),
      facilitator: sheet.facilitator.trim(),
      date: sheet.date,
      place: sheet.place.trim(),
      establishment: sheet.establishment.trim(),
      participants: participants.map((p) => p.name),
      signed: participants.map((p) => p.signed),
    },
  });
}

/** Bloco de chancela em HTML, usado no rodapé do PDF da ficha. */
export async function attendanceSealHtml(sheet: AttendanceSheet): Promise<string> {
  return sealPrintHtml(await attendanceSeal(sheet));
}