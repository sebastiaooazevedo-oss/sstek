// Aviso automático de prazo da renovação de documentos.
//
// Disparado quando uma tratativa entra na janela de vencimento do prazo (SLA).
// Há dois públicos, com janelas independentes configuradas no app:
//   - gestor      → aviso antecipado (ex.: 7 dias antes)
//   - responsavel → aviso mais próximo do vencimento (ex.: 3 dias antes)
//   - escalonamento → reaviso ao gestor quando a tratativa não se movimenta
//
// Também aceita `test: true` (botão "Enviar aviso de teste" na parametrização),
// que envia um e-mail de exemplo para validar o Remetente antes de depender dele.
//
// Secrets necessários (Supabase Dashboard › Edge Functions › Secrets):
//   RESEND_API_KEY      — chave da conta Resend
//   RESEND_FROM_DOMAIN  — domínio verificado (ex.: seu-dominio.com.br)
// Sem os secrets a função responde "resend-not-configured"; o app segue
// funcionando e os avisos continuam aparecendo no sino.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Audience = "gestor" | "responsavel" | "escalonamento";

interface DeadlineItem {
  requestId?: string;
  documentName?: string;
  documentTypeName?: string;
  collaboratorName?: string;
  ownerName?: string;
  managerName?: string;
  unit?: string;
  dueAt?: string;
  slaDays?: number;
  remainingDays?: number;
}

interface DeadlineGroup {
  audience?: Audience;
  recipient?: string;
  label?: string;
  requests?: DeadlineItem[];
}

interface DeadlinePayload {
  companyName?: string;
  groups?: DeadlineGroup[];
  /** Envio de validação: identifica o e-mail como teste. */
  test?: boolean;
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

function formatDay(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function remainingLabel(days?: number): string {
  if (typeof days !== "number" || Number.isNaN(days)) return "—";
  if (days < 0) return `atrasada há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "o prazo vence hoje";
  return `${days} dia(s) restante(s)`;
}

function normalizeAudience(value?: string): Audience {
  if (value === "gestor") return "gestor";
  if (value === "escalonamento") return "escalonamento";
  return "responsavel";
}

function audienceCopy(audience: Audience): { eyebrow: string; title: string; intro: string; subject: string } {
  if (audience === "escalonamento") {
    return {
      eyebrow: "Escalonamento de prazo",
      title: "Tratativa de renovação sem movimentação",
      intro:
        "Estas tratativas foram avisadas sobre o prazo e continuam sem nenhuma movimentação. Como gestor, é hora de intervir: verifique a condução, remaneje a responsabilidade ou destrave o que estiver travando a conclusão.",
      subject: "Tratativa de renovação de documento sem movimentação",
    };
  }
  if (audience === "gestor") {
    return {
      eyebrow: "Prazo de renovação",
      title: "Renovação de documento perto do prazo",
      intro:
        "Você acompanha estas tratativas como gestor. O prazo de conclusão está se aproximando e ainda dá tempo de agir antes do SLA estourar.",
      subject: "Prazo de renovação de documentos se aproximando",
    };
  }
  return {
    eyebrow: "Sua tratativa",
    title: "Sua tratativa de renovação está perto do prazo",
    intro:
      "Estas tratativas estão sob sua responsabilidade e o prazo de conclusão está se aproximando. Conclua as etapas e anexe o documento novo antes da data-limite.",
    subject: "Sua tratativa de renovação de documento está perto do prazo",
  };
}

function buildHtml(group: DeadlineGroup, companyName: string, isTest = false): string {
  const audience: Audience = normalizeAudience(group.audience);
  const copy = audienceCopy(audience);
  const items = (group.requests ?? []).filter((item) => Boolean(item?.documentName));

  const rows = items
    .map((item) => {
      const due = formatDay(item.dueAt);
      const remaining = remainingLabel(item.remainingDays);
      const urgent = typeof item.remainingDays === "number" && item.remainingDays <= 1;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e4e9e7;font-size:13px;color:#1c2a33;font-weight:600;">
          ${escapeHtml(item.documentName || "Documento")}
          <span style="display:block;font-weight:400;font-size:11px;color:#5b6b73;">
            ${escapeHtml(item.documentTypeName || "Documento")}${
              item.collaboratorName ? ` · ${escapeHtml(item.collaboratorName)}` : ""
            }
          </span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4e9e7;font-size:12px;color:#3c4a51;">
          ${escapeHtml(item.unit || "Corporativo")}
          ${
            item.ownerName
              ? `<span style="display:block;font-size:11px;color:#6b7a80;">Resp.: ${escapeHtml(item.ownerName)}</span>`
              : ""
          }
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4e9e7;font-size:12px;color:#3c4a51;white-space:nowrap;">
          ${escapeHtml(due)}
          <span style="display:block;font-size:11px;font-weight:700;color:${urgent ? "#b42318" : "#a05a00"};">
            ${escapeHtml(remaining)}
          </span>
        </td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1c2a33;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #d7e0dc;border-radius:12px;overflow:hidden;">
    <div style="background:#17423a;padding:20px 24px;">
      <p style="margin:0;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#9ed3b6;">${escapeHtml(
        copy.eyebrow
      )}</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">${escapeHtml(copy.title)}</h1>
    </div>
    <div style="padding:22px 24px;">
      ${
        isTest
          ? `<p style="margin:0 0 16px;padding:10px 12px;background:#fff4e5;border:1px solid #f0c48a;border-radius:8px;font-size:12px;line-height:1.5;color:#7a4b00;"><strong>E-mail de teste.</strong> Este envio valida apenas o remetente configurado (Resend) e o modelo de mensagem. Nenhuma tratativa real foi avisada.</p>`
          : ""
      }
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">
        Olá, <strong>${escapeHtml(group.label || "tudo bem")}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        ${escapeHtml(copy.intro)}
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #d7e0dc;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f4f8f6;">
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#5b6b73;">Documento</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#5b6b73;">Unidade</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#5b6b73;">Data-limite</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;">
        Empresa: <strong>${escapeHtml(companyName)}</strong>
      </p>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#5b6b73;">
        Abra o sistema em Documentos › Solicitações de renovação para assumir, delegar ou concluir a
        tratativa. Este aviso é enviado uma única vez por data-limite.
      </p>
      <p style="margin:14px 0 0;font-size:11px;color:#6b7a80;">
        Este e-mail foi gerado pelo SSTEK — Gestão Inteligente em Segurança do Trabalho.
      </p>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ sent: false, reason: "method-not-allowed" }, 405);
  }

  let payload: DeadlinePayload;
  try {
    payload = (await req.json()) as DeadlinePayload;
  } catch {
    return jsonResponse({ sent: false, reason: "invalid-json" }, 400);
  }

  const groups = (payload.groups ?? []).filter(
    (group) =>
      group &&
      (group.audience === "gestor" ||
        group.audience === "responsavel" ||
        group.audience === "escalonamento") &&
      EMAIL_PATTERN.test(String(group.recipient ?? "").trim().toLowerCase()) &&
      Array.isArray(group.requests) &&
      group.requests.length > 0
  );

  if (groups.length === 0) {
    return jsonResponse({ sent: false, reason: "no-groups" }, 200);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") || "").trim();
  if (!apiKey || !fromDomain) {
    return jsonResponse({ sent: false, reason: "resend-not-configured" }, 200);
  }

  const companyName = String(payload.companyName || "Sua empresa").trim() || "Sua empresa";
  const isTest = payload.test === true;
  const from = `SSTEK <noreply@${fromDomain}>`;
  const sentEmails: string[] = [];
  const failures: string[] = [];

  for (const group of groups) {
    const audience: Audience = normalizeAudience(group.audience);
    const recipient = String(group.recipient ?? "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(recipient) || sentEmails.includes(recipient)) continue;
    const copy = audienceCopy(audience);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: `${isTest ? "[TESTE] " : ""}${copy.subject} — ${companyName}`,
          html: buildHtml({ ...group, audience }, companyName, isTest),
        }),
      });
      if (response.ok) sentEmails.push(recipient);
      else failures.push(await response.text());
    } catch (error) {
      failures.push(String(error));
    }
  }

  if (sentEmails.length === 0) {
    return jsonResponse(
      { sent: false, reason: "resend-error", detail: failures.slice(0, 3).join(" | ") },
      200
    );
  }

  const sentCount = groups
    .filter((group) => sentEmails.includes(String(group.recipient ?? "").trim().toLowerCase()))
    .reduce((total, group) => total + (group.requests?.length ?? 0), 0);

  return jsonResponse({ sent: true, sentEmails, sentCount, failures: failures.length });
});
