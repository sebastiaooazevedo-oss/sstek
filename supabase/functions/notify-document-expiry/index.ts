// Avisos de vencimento de documentos por e-mail.
//
// Modos:
//   "expiry" — quando um documento entra na janela de vencimento. Pode enviar
//              vários GRUPOS: SESMT (base inteira) e cada gestor/líder, que
//              recebe apenas os documentos dos seus liderados.
//   "weekly" — resumo semanal (vencidos + vencendo em até 7 dias) ao SESMT.
//
// Quando `attachPdf` está ativo, o e-mail leva um PDF com a lista completa dos
// documentos vencidos/a vencer, agrupada por unidade.
//
// Secrets necessários (Supabase Dashboard › Edge Functions › Secrets):
//   RESEND_API_KEY      — chave da conta Resend
//   RESEND_FROM_DOMAIN  — domínio verificado (ex.: seu-dominio.com.br)
// Sem esses secrets a função responde "resend-not-configured" e o app avisa na
// tela — os alertas continuam visíveis no sistema.

import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExpiryDocumentItem {
  name?: string;
  typeName?: string;
  expiresAt?: string;
  days?: number;
  collaboratorName?: string;
  establishment?: string;
}

interface EmailGroup {
  label?: string;
  key?: string;
  recipients?: string[];
  attachPdf?: boolean;
  documents?: ExpiryDocumentItem[];
}

interface NotifyPayload {
  mode?: "expiry" | "weekly";
  companyName?: string;
  daysBefore?: number;
  attachPdf?: boolean;
  groups?: EmailGroup[];
  // Formato antigo (uma única lista de destinatários).
  recipients?: string[];
  documents?: ExpiryDocumentItem[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function daysLabel(days: number): string {
  if (days < 0) {
    const abs = Math.abs(days);
    return `Vencido há ${abs} ${abs === 1 ? "dia" : "dias"}`;
  }
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

function daysTone(days: number): string {
  if (days < 0) return "#a8323a";
  if (days <= 7) return "#b4561f";
  return "#17423a";
}

function normalizeDocuments(input?: ExpiryDocumentItem[]): ExpiryDocumentItem[] {
  return (input ?? []).filter((doc) => Boolean(doc?.name)).slice(0, 200);
}

function normalizeRecipients(input?: string[]): string[] {
  return Array.from(
    new Set(
      (input ?? [])
        .map((email) => String(email).trim().toLowerCase())
        .filter((email) => EMAIL_PATTERN.test(email))
    )
  ).slice(0, 20);
}

function buildEmailHtml(params: {
  companyName: string;
  mode: "expiry" | "weekly";
  daysBefore: number;
  groupLabel: string;
  documents: ExpiryDocumentItem[];
  attachPdf: boolean;
}): string {
  const { companyName, mode, daysBefore, groupLabel, documents, attachPdf } = params;
  const isWeekly = mode === "weekly";
  const expired = documents.filter((doc) => (Number(doc.days) || 0) < 0).length;
  const expiring = documents.length - expired;
  const audience = groupLabel && groupLabel !== "SESMT" ? groupLabel : "equipe de SESMT";

  const rows = documents
    .map((doc) => {
      const days = Number(doc.days) || 0;
      const context = [doc.typeName, doc.collaboratorName, doc.establishment]
        .filter(Boolean)
        .map((value) => escapeHtml(String(value)))
        .join(" · ");
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e4e9e7;font-size:13px;color:#1c2a33;">
          <strong>${escapeHtml(doc.name || "Documento")}</strong>
          ${context ? `<div style="margin-top:3px;font-size:11px;color:#5b6b73;">${context}</div>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4e9e7;font-size:12px;color:#3c4a51;white-space:nowrap;">
          ${escapeHtml(doc.expiresAt || "—")}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4e9e7;font-size:12px;font-weight:700;white-space:nowrap;color:${daysTone(days)};">
          ${escapeHtml(daysLabel(days))}
        </td>
      </tr>`;
    })
    .join("");

  const intro = isWeekly
    ? `Este é o resumo semanal de vencimentos de <strong>${escapeHtml(companyName)}</strong>.
       A base tem <strong>${expired}</strong> documento(s) vencido(s) e <strong>${expiring}</strong>
       vencendo nos próximos 7 dias.`
    : `A verificação automática encontrou <strong>${documents.length}</strong> documento(s) que exigem atenção:
       <strong>${expired}</strong> já vencido(s) e <strong>${expiring}</strong> dentro da janela de
       <strong>${daysBefore} dia(s)</strong> antes do vencimento.`;

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1c2a33;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #d7e0dc;border-radius:12px;overflow:hidden;">
    <div style="background:#17423a;padding:20px 24px;">
      <p style="margin:0;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#9ed3b6;">Conformidade documental</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">${
        isWeekly ? "Resumo semanal de vencimentos" : "Documentos vencidos ou próximos do vencimento"
      }</h1>
    </div>
    <div style="padding:22px 24px;">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">Olá, ${escapeHtml(audience)} de <strong>${escapeHtml(
    companyName
  )}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${intro}</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #d7e0dc;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f4f8f6;">
            <th style="padding:9px 12px;text-align:left;font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6b73;">Documento</th>
            <th style="padding:9px 12px;text-align:left;font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6b73;">Validade</th>
            <th style="padding:9px 12px;text-align:left;font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:#5b6b73;">Situação</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${
        attachPdf
          ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c4a51;">
               <strong>PDF anexo:</strong> lista completa dos documentos, agrupada por unidade.
             </p>`
          : ""
      }
      <p style="margin:18px 0 14px;font-size:13px;line-height:1.6;color:#3c4a51;">
        Acesse o sistema em <strong>Documentos › Alertas de vencimento</strong> para renovar a validade de cada
        documento. Documentos vencidos ou sem validade são apontados em fiscalização.
      </p>
      <p style="margin:0;font-size:11px;color:#6b7a80;">
        Este aviso foi gerado automaticamente pelo SSTEK — Gestão Inteligente em Segurança do Trabalho.
        A janela de antecedência e os destinatários são definidos em Configurações › Alertas de vencimento de documentos.
      </p>
    </div>
  </div>
</body></html>`;
}

/* ----------------------------- PDF por unidade ----------------------------- */

function fitText(text: string, widthOf: (value: string) => number, maxWidth: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (widthOf(clean) <= maxWidth) return clean;
  let clipped = clean;
  while (clipped.length > 1 && widthOf(`${clipped}…`) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

async function buildExpiryPdf(options: {
  companyName: string;
  mode: "expiry" | "weekly";
  documents: ExpiryDocumentItem[];
}): Promise<Uint8Array> {
  const { companyName, mode, documents } = options;
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 36;
  const ink = rgb(0.11, 0.16, 0.2);
  const soft = rgb(0.36, 0.42, 0.45);
  const brand = rgb(0.09, 0.26, 0.23);
  const line = rgb(0.85, 0.88, 0.87);

  const groups = new Map<string, ExpiryDocumentItem[]>();
  documents.forEach((doc) => {
    const unit = (doc.establishment || "").trim() || "Corporativo (todas as unidades)";
    const list = groups.get(unit);
    if (list) list.push(doc);
    else groups.set(unit, [doc]);
  });
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  const columns = [
    { key: "name", label: "Documento", x: margin, width: 300 },
    { key: "typeName", label: "Tipo", x: margin + 306, width: 118 },
    { key: "collaboratorName", label: "Colaborador", x: margin + 430, width: 158 },
    { key: "expiresAt", label: "Validade", x: margin + 594, width: 74 },
    { key: "situation", label: "Situação", x: margin + 674, width: 96 },
  ] as const;

  const drawTableHeader = (page: ReturnType<typeof pdf.addPage>, y: number): number => {
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: pageWidth - margin * 2,
      height: 18,
      color: rgb(0.95, 0.97, 0.96),
    });
    columns.forEach((column) => {
      page.drawText(column.label.toUpperCase(), {
        x: column.x,
        y: y - 11,
        size: 7.5,
        font: bold,
        color: soft,
      });
    });
    return y - 24;
  };

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const title = mode === "weekly" ? "Resumo semanal de vencimentos" : "Documentos vencidos e a vencer";
  page.drawText(title, { x: margin, y: y - 16, size: 16, font: bold, color: brand });
  y -= 24;
  page.drawText(companyName || "Sua empresa", { x: margin, y: y - 12, size: 10, font: bold, color: ink });
  y -= 18;
  const issued = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const totalExpired = documents.filter((doc) => (Number(doc.days) || 0) < 0).length;
  page.drawText(
    `Emitido em ${issued} · ${documents.length} documento(s) · ${totalExpired} vencido(s)`,
    { x: margin, y: y - 10, size: 8.5, font: regular, color: soft }
  );
  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.2,
    color: brand,
  });
  y -= 18;

  const ensureSpace = (needed: number): void => {
    if (y - needed >= 54) return;
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawText(`${title} — continuação`, {
      x: margin,
      y: y - 12,
      size: 10,
      font: bold,
      color: brand,
    });
    y -= 22;
    y = drawTableHeader(page, y);
  };

  sortedGroups.forEach(([unit, list]) => {
    ensureSpace(46);
    page.drawText(fitText(unit, (t) => bold.widthOfTextAtSize(t, 9.5), pageWidth - margin * 2 - 60), {
      x: margin,
      y: y - 10,
      size: 9.5,
      font: bold,
      color: brand,
    });
    page.drawText(`${list.length}`, {
      x: pageWidth - margin - bold.widthOfTextAtSize(`${list.length}`, 9.5),
      y: y - 10,
      size: 9.5,
      font: bold,
      color: brand,
    });
    y -= 16;
    y = drawTableHeader(page, y);

    list.forEach((doc) => {
      ensureSpace(26);
      const values: Record<string, string> = {
        name: doc.name || "Documento",
        typeName: doc.typeName || "—",
        collaboratorName: doc.collaboratorName || "—",
        expiresAt: doc.expiresAt || "—",
        situation: daysLabel(Number(doc.days) || 0),
      };
      columns.forEach((column) => {
        const isSituation = column.key === "situation";
        const font = isSituation ? bold : regular;
        const size = isSituation ? 8 : 8.5;
        const color = isSituation
          ? Number(doc.days) < 0
            ? rgb(0.66, 0.2, 0.23)
            : rgb(0.24, 0.34, 0.28)
          : ink;
        page.drawText(
          fitText(values[column.key], (t) => font.widthOfTextAtSize(t, size), column.width),
          { x: column.x, y: y - 9, size, font, color }
        );
      });
      y -= 18;
      page.drawLine({
        start: { x: margin, y: y + 5 },
        end: { x: pageWidth - margin, y: y + 5 },
        thickness: 0.4,
        color: line,
      });
    });

    y -= 10;
  });

  if (documents.length === 0) {
    page.drawText("Nenhum documento vencido ou a vencer no momento.", {
      x: margin,
      y: y - 12,
      size: 10,
      font: regular,
      color: soft,
    });
  }

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    current.drawText("SSTEK · Gestão Inteligente em Segurança do Trabalho", {
      x: margin,
      y: 24,
      size: 7,
      font: regular,
      color: soft,
    });
    const label = `Página ${index + 1} de ${pages.length}`;
    current.drawText(label, {
      x: pageWidth - margin - regular.widthOfTextAtSize(label, 7),
      y: 24,
      size: 7,
      font: regular,
      color: soft,
    });
  });

  return pdf.save();
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ sent: false, reason: "method-not-allowed" }, 405);
  }

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return jsonResponse({ sent: false, reason: "invalid-json" }, 400);
  }

  const mode: "expiry" | "weekly" = payload.mode === "weekly" ? "weekly" : "expiry";
  const daysBefore = Number(payload.daysBefore) || 0;
  const companyName = (payload.companyName || "Sua empresa").toString();

  // Compatibilidade: formato antigo (recipients + documents) vira um grupo.
  const rawGroups: EmailGroup[] =
    Array.isArray(payload.groups) && payload.groups.length > 0
      ? payload.groups
      : payload.recipients || payload.documents
        ? [{ label: "SESMT", recipients: payload.recipients, documents: payload.documents }]
        : [];

  const groups = rawGroups
    .map((group) => ({
      label: (group.label || "SESMT").toString(),
      recipients: normalizeRecipients(group.recipients),
      attachPdf: Boolean(group.attachPdf ?? payload.attachPdf),
      documents: normalizeDocuments(group.documents),
    }))
    .filter((group) => group.recipients.length > 0 && group.documents.length > 0);

  if (groups.length === 0) {
    return jsonResponse({ sent: false, reason: "invalid-recipient" }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") || "").trim();
  if (!apiKey || !fromDomain) {
    return jsonResponse({ sent: false, reason: "resend-not-configured" }, 200);
  }

  const from = `SSTEK <noreply@${fromDomain}>`;
  const dateStamp = new Date().toISOString().slice(0, 10);
  let sentGroups = 0;
  let sentDocuments = 0;
  let lastError = "";

  for (const group of groups) {
    let attachment: { filename: string; content: string } | null = null;
    if (group.attachPdf) {
      try {
        const bytes = await buildExpiryPdf({ companyName, mode, documents: group.documents });
        attachment = {
          filename:
            mode === "weekly"
              ? `resumo-semanal-vencimentos-${dateStamp}.pdf`
              : `documentos-vencidos-e-a-vencer-${dateStamp}.pdf`,
          content: toBase64(bytes),
        };
      } catch (error) {
        lastError = `pdf-failed: ${String(error)}`;
        attachment = null;
      }
    }

    const expiredCount = group.documents.filter((doc) => (Number(doc.days) || 0) < 0).length;
    const subject =
      mode === "weekly"
        ? `Resumo semanal de vencimentos — ${companyName}`
        : expiredCount > 0
          ? `Documentos vencidos e a vencer — ${companyName}`
          : `Documentos a vencer nos próximos ${daysBefore} dias`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: group.recipients,
          subject,
          html: buildEmailHtml({
            companyName,
            mode,
            daysBefore,
            groupLabel: group.label,
            documents: group.documents,
            attachPdf: group.attachPdf,
          }),
          ...(attachment ? { attachments: [attachment] } : {}),
        }),
      });

      if (!response.ok) {
        lastError = `resend-error: ${await response.text()}`;
        continue;
      }

      sentGroups += 1;
      sentDocuments += group.documents.length;
    } catch (error) {
      lastError = `request-failed: ${String(error)}`;
    }
  }

  if (sentGroups === 0) {
    return jsonResponse({ sent: false, reason: "resend-error", detail: lastError }, 200);
  }

  return jsonResponse({
    sent: true,
    groups: sentGroups,
    documents: sentDocuments,
    detail: lastError || undefined,
  });
});