import type { DdsRecord } from "@/mocks/dds";
import { requestDocumentSeal, sealPrintHtml, type DocumentSeal } from "@/pages/app/signature/authenticitySeal";

export interface DdsSealParticipant {
  name: string;
  role?: string;
  signed: boolean;
}

/**
 * Chancela de autenticidade da lista de presença do DDS.
 *
 * O selo só nasce quando ao menos um participante possui assinatura
 * registrada. O conteúdo canônico é o mesmo usado na exportação, então abrir a
 * prévia e exportar em seguida reaproveita o mesmo selo (sem duplicar).
 */
export async function ddsSeal(
  record: DdsRecord,
  participants: DdsSealParticipant[]
): Promise<DocumentSeal | null> {
  if (!participants.some((p) => p.signed)) return null;
  return requestDocumentSeal({
    scope: "dds",
    referenceRef: record.id,
    referenceLabel: `Lista de presença — ${record.title} (${record.date})`,
    signers: participants
      .filter((p) => p.signed)
      .map((p) => ({ name: p.name, role: p.role || null })),
    content: {
      id: record.id,
      title: record.title,
      theme: record.theme,
      date: record.date,
      time: record.time,
      area: record.area,
      location: record.location,
      facilitator: record.facilitator,
      participants: participants.map((p) => p.name),
      signed: participants.map((p) => p.signed),
    },
  });
}

/** Bloco de chancela em HTML, usado no rodapé do PDF da lista de presença. */
export async function ddsSealHtml(
  record: DdsRecord,
  participants: DdsSealParticipant[]
): Promise<string> {
  return sealPrintHtml(await ddsSeal(record, participants));
}