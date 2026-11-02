import { escapeHtml, pdfFooter, pdfHeader } from "@/pages/app/utils/exportPdf";
import { epiCatalog, type EpiCatalogItem, type EpiDelivery } from "@/mocks/epi";
import { requestDocumentSeal, sealPrintHtml, type DocumentSeal } from "@/pages/app/signature/authenticitySeal";

/** Converte "DD/MM/YYYY" em timestamp (para ordenar e comparar entregas). */
export function brDateToTs(date: string): number {
  const [d, m, y] = (date || "").split(" ")[0].split("/").map(Number);
  if (!d || !m || !y) return 0;
  return new Date(y, m - 1, d).getTime();
}

export interface EpiInUseItem {
  name: string;
  ca: string;
  quantity: number;
  lastDate: string;
  validity: string;
  status: "Ativo" | "Vencendo" | "Vencido";
}

/**
 * Consolida os EPIs em uso de um colaborador a partir das entregas registradas.
 * Considera, por CA, a entrega mais recente (última posse) e cruza com o
 * catálogo para obter a validade do certificado (CA). Compartilhado entre o
 * painel do colaborador e a página "Minha ficha de EPI".
 */
export function computeEpiInUse(
  deliveries: EpiDelivery[],
  collaboratorId: string,
  collaboratorName?: string
): EpiInUseItem[] {
  const mine = deliveries.filter(
    (d) => d.collaboratorId === collaboratorId || (collaboratorName && d.collaboratorName === collaboratorName)
  );
  const map = new Map<string, EpiInUseItem & { ts: number }>();
  mine.forEach((delivery) => {
    const ts = brDateToTs(delivery.date);
    delivery.items.forEach((item) => {
      const existing = map.get(item.ca);
      if (!existing || ts > existing.ts) {
        const catalog = findEpiByCa(item.ca);
        const validity = catalog?.approvalValidity ?? "—";
        map.set(item.ca, {
          name: item.name,
          ca: item.ca,
          quantity: item.quantity,
          lastDate: delivery.date,
          validity,
          status: catalog ? caValidityStatus(validity) : "Ativo",
          ts,
        });
      }
    });
  });
  return Array.from(map.values())
    .sort((a, b) => b.ts - a.ts)
    .map((item) => ({
      name: item.name,
      ca: item.ca,
      quantity: item.quantity,
      lastDate: item.lastDate,
      validity: item.validity,
      status: item.status,
    }));
}

/** Remove qualquer caractere que não seja dígito (pontos, espaços, traços) para comparar CAs. */
export function normalizeCa(value: string): string {
  return value.replace(/\D/g, "");
}

/** Busca um EPI do catálogo pelo número do Certificado de Aprovação (CA). */
export function findEpiByCa(value: string): EpiCatalogItem | undefined {
  const target = normalizeCa(value);
  if (!target) return undefined;
  return epiCatalog.find((item) => normalizeCa(item.ca) === target);
}

/** Indica se o Certificado de Aprovação (CA) do equipamento está ativo para uso/cadastro. */
export function isCaActive(item: EpiCatalogItem): boolean {
  return item.active;
}

/** Situação de validade do CA a partir da data "DD/MM/YYYY" (Ativo, Vencendo ou Vencido). */
export function caValidityStatus(validity: string): "Ativo" | "Vencendo" | "Vencido" {
  const parts = (validity || "").split("/");
  if (parts.length !== 3) return "Ativo";
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return "Ativo";
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "Vencido";
  if (diffDays <= 60) return "Vencendo";
  return "Ativo";
}

/** Monta o corpo HTML do laudo técnico do equipamento a partir do CA consultado. */
export function buildCaReportBody(item: EpiCatalogItem): string {
  const status = item.active
    ? '<span style="color:#1f8a5b;font-weight:700;">ATIVO</span>'
    : '<span style="color:#b45309;font-weight:700;">INATIVO</span>';
  return `${pdfHeader(`Laudo de equipamento · CA ${escapeHtml(item.ca)}`)}
    <h1>Laudo técnico de equipamento de proteção individual</h1>
    <p class="muted">
      Documento emitido a partir da consulta do Certificado de Aprovação (CA) ${escapeHtml(item.ca)},
      reunindo as informações técnicas de identificação, aplicação e restrições de uso do EPI.
    </p>
    <h2>Identificação do equipamento</h2>
    <table>
      <tbody>
        <tr><th>Equipamento</th><td>${escapeHtml(item.name)}</td></tr>
        <tr><th>Categoria</th><td>${escapeHtml(item.category)}</td></tr>
        <tr><th>Número do CA</th><td>${escapeHtml(item.ca)}</td></tr>
        <tr><th>Fabricante</th><td>${escapeHtml(item.manufacturer)}</td></tr>
        <tr><th>Norma técnica</th><td>${escapeHtml(item.norm)}</td></tr>
        <tr><th>Validade do CA</th><td>${escapeHtml(item.approvalValidity)}</td></tr>
        <tr><th>Situação do CA</th><td>${status}</td></tr>
        <tr><th>Tamanhos disponíveis</th><td>${escapeHtml(item.sizes)}</td></tr>
      </tbody>
    </table>
    <h2>Descrição / proteção</h2>
    <p>${escapeHtml(item.description)}</p>
    <h2>Restrições de uso</h2>
    <p>${escapeHtml(item.restriction)}</p>
    ${
      !item.active && item.inactiveReason
        ? `<p class="muted">Motivo da inativação: ${escapeHtml(item.inactiveReason)}</p>`
        : ""
    }
    ${pdfFooter()}`;
}

export function toBrDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/**
 * Chancela de autenticidade da ficha de EPI. Só é gerada quando existe a
 * assinatura de aceite do colaborador — sem assinatura não há o que chancelar.
 */
export async function epiSeal(delivery: EpiDelivery): Promise<DocumentSeal | null> {
  if (!delivery.signature) return null;
  return requestDocumentSeal({
    scope: "epi",
    referenceRef: delivery.id,
    referenceLabel: `Ficha de EPI — ${delivery.collaboratorName} (${delivery.date})`,
    signers: [
      {
        name: delivery.collaboratorName,
        role: delivery.collaboratorRole || "Colaborador",
        signedAt: null,
      },
    ],
    content: {
      id: delivery.id,
      collaboratorId: delivery.collaboratorId,
      collaboratorName: delivery.collaboratorName,
      date: delivery.date,
      reason: delivery.reason,
      items: delivery.items,
      notes: delivery.notes,
      photo: delivery.photo || "",
      signature: delivery.signature,
    },
  });
}

/** Bloco de chancela em HTML, usado no rodapé do PDF da ficha de EPI. */
export async function epiSealHtml(delivery: EpiDelivery): Promise<string> {
  return sealPrintHtml(await epiSeal(delivery));
}

/** Monta o corpo HTML do Termo de entrega e aceite de EPI (usado no PDF e na visualização). */
export function buildEpiAcceptanceBody(delivery: EpiDelivery, sealHtml = "", historyHtml = ""): string {
  const rows = delivery.items
    .map(
      (item, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.ca)}</td>
        <td>${item.quantity}</td>
      </tr>`
    )
    .join("");

  return `${pdfHeader("Ficha de EPI · Aceite do colaborador")}
    <h1>Termo de entrega e aceite de Equipamento de Proteção Individual</h1>
    <p class="muted">
      Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual relacionados abaixo,
      bem como as orientações quanto ao uso correto, guarda e conservação, comprometendo-me a utilizá-los
      apenas para a finalidade a que se destinam e a comunicar o SESMT em caso de dano ou extravio.
    </p>
    <div class="grid">
      <div><strong>Colaborador:</strong> ${escapeHtml(delivery.collaboratorName)}</div>
      <div><strong>Função:</strong> ${escapeHtml(delivery.collaboratorRole) || "—"}</div>
      <div><strong>Setor:</strong> ${escapeHtml(delivery.area) || "—"}</div>
      <div><strong>Data da entrega:</strong> ${escapeHtml(delivery.date)}</div>
      <div><strong>Motivo:</strong> ${escapeHtml(delivery.reason)}</div>
    </div>
    <h2>Equipamentos entregues</h2>
    <table>
      <thead><tr><th>#</th><th>Equipamento (EPI)</th><th>CA</th><th>Qtde</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Nenhum item informado.</td></tr>'}</tbody>
    </table>
    ${
      delivery.photo
        ? `<h2>Registro fotográfico</h2><div style="text-align:center;"><img src="${delivery.photo}" alt="Foto da entrega de EPI" style="max-width:360px;max-height:300px;border:1px solid #c9d3d7;border-radius:6px;" /></div>`
        : ""
    }
    ${delivery.notes ? `<h2>Observações</h2><p>${escapeHtml(delivery.notes)}</p>` : ""}
    <h2>Aceite do colaborador</h2>
    <table>
      <thead><tr><th>Assinatura do colaborador</th><th>Data</th></tr></thead>
      <tbody>
        <tr>
          <td class="sign">${
            delivery.signature
              ? `<img src="${delivery.signature}" alt="Assinatura de ${escapeHtml(delivery.collaboratorName)}" />`
              : '<span class="empty">(aceite eletrônico pendente)</span>'
          }</td>
          <td>${escapeHtml(delivery.date)}</td>
        </tr>
      </tbody>
    </table>
    ${historyHtml}
    ${pdfFooter(sealHtml)}`;
}