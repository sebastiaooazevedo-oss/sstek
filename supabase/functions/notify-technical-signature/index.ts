// Avisa o Responsável Técnico por e-mail quando um documento técnico da CIPA
// é solicitado e ainda está pendente de assinatura.
//
// Secrets necessários (Supabase Dashboard › Edge Functions › Secrets):
//   RESEND_API_KEY      — chave da conta Resend
//   RESEND_FROM_DOMAIN  — domínio verificado (ex.: seu-dominio.com.br)
// O remetente é montado como noreply@<RESEND_FROM_DOMAIN>.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NotifyPayload {
  to?: string;
  responsibleName?: string;
  documentLabel?: string;
  documentDescription?: string;
  requestedBy?: string;
  companyName?: string;
}

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

function buildEmailHtml(payload: NotifyPayload): string {
  const responsible = escapeHtml(payload.responsibleName || "Responsável Técnico");
  const documentLabel = escapeHtml(payload.documentLabel || "Documento técnico da CIPA");
  const description = payload.documentDescription ? escapeHtml(payload.documentDescription) : "";
  const requestedBy = escapeHtml(payload.requestedBy || "Administrador da empresa");
  const company = escapeHtml(payload.companyName || "sua empresa");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1c2a33;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d7e0dc;border-radius:12px;overflow:hidden;">
    <div style="background:#17423a;padding:20px 24px;">
      <p style="margin:0;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#9ed3b6;">Responsabilidade Técnica</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Documento técnico aguardando sua assinatura</h1>
    </div>
    <div style="padding:22px 24px;">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">Olá, <strong>${responsible}</strong>.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        <strong>${requestedBy}</strong> solicitou a emissão de um documento técnico da CIPA em <strong>${company}</strong>.
        A emissão definitiva está bloqueada até a sua assinatura eletrônica como Responsável Técnico.
      </p>
      <div style="border:1px solid #d7e0dc;border-left:4px solid #2f9e6b;border-radius:0 8px 8px 0;background:#f4f8f6;padding:14px 16px;margin:0 0 18px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#17423a;">${documentLabel}</p>
        ${description ? `<p style="margin:6px 0 0;font-size:12px;color:#5b6b73;">${description}</p>` : ""}
      </div>
      <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#3c4a51;">
        Acesse o sistema e abra o painel do Responsável Técnico para conferir o documento e assinar
        eletronicamente. Após a assinatura, a emissão é liberada automaticamente.
      </p>
      <p style="margin:0;font-size:11px;color:#6b7a80;">
        Este aviso foi gerado automaticamente pelo SSTEK — Gestão Inteligente em Segurança do Trabalho.
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

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return jsonResponse({ sent: false, reason: "invalid-json" }, 400);
  }

  const to = (payload.to || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return jsonResponse({ sent: false, reason: "invalid-recipient" }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") || "").trim();
  if (!apiKey || !fromDomain) {
    return jsonResponse({ sent: false, reason: "resend-not-configured" }, 200);
  }

  const from = `SSTEK <noreply@${fromDomain}>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Assinatura pendente — ${payload.documentLabel || "documento técnico da CIPA"}`,
        html: buildEmailHtml(payload),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return jsonResponse({ sent: false, reason: "resend-error", detail }, 200);
    }

    return jsonResponse({ sent: true });
  } catch (error) {
    return jsonResponse(
      { sent: false, reason: "request-failed", detail: String(error) },
      200
    );
  }
});
