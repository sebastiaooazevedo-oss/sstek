// Comunicação do agendamento de renovação de documento.
//
// Enviado quando o responsável pela tratativa preenche clínica, data, horário,
// local, exames e orientações. O e-mail vai para o colaborador e para o gestor
// responsável, com todos os detalhes do agendamento.
//
// Secrets necessários (Supabase Dashboard › Edge Functions › Secrets):
//   RESEND_API_KEY      — chave da conta Resend
//   RESEND_FROM_DOMAIN  — domínio verificado (ex.: seu-dominio.com.br)
// Sem os secrets a função responde "resend-not-configured"; o app permite
// registrar a comunicação manualmente e seguir com a tratativa.

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExamItem {
  name?: string;
  instructions?: string;
}

interface RenewalPayload {
  companyName?: string;
  sender?: string;
  documentName?: string;
  documentTypeName?: string;
  collaboratorName?: string;
  collaboratorEmail?: string;
  managerName?: string;
  managerEmail?: string;
  clinicName?: string;
  clinicContact?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  location?: string;
  examsRequired?: boolean;
  exams?: ExamItem[];
  notes?: string;
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

function normalizeRecipients(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(
      values
        .map((email) => String(email ?? "").trim().toLowerCase())
        .filter((email) => EMAIL_PATTERN.test(email))
    )
  ).slice(0, 10);
}

function buildHtml(payload: Required<Pick<RenewalPayload, "companyName" | "documentName">> & RenewalPayload): string {
  const exams = (payload.exams ?? []).filter((exam) => Boolean(exam?.name));
  const examRows = exams
    .map(
      (exam) => `<tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e9e7;font-size:13px;color:#1c2a33;font-weight:600;">
          ${escapeHtml(exam.name || "Exame")}
        </td>
        <td style="padding:9px 12px;border-bottom:1px solid #e4e9e7;font-size:12px;color:#3c4a51;">
          ${escapeHtml(exam.instructions || "Sem orientações adicionais.")}
        </td>
      </tr>`
    )
    .join("");

  const appointment = [payload.appointmentDate, payload.appointmentTime].filter(Boolean).join(" às ");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;color:#1c2a33;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d7e0dc;border-radius:12px;overflow:hidden;">
    <div style="background:#17423a;padding:20px 24px;">
      <p style="margin:0;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#9ed3b6;">Renovação de documento</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Agendamento de ${escapeHtml(
        payload.documentTypeName || "documento"
      )}</h1>
    </div>
    <div style="padding:22px 24px;">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;">
        Olá, <strong>${escapeHtml(payload.collaboratorName || "colaborador")}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        A renovação do seu documento <strong>${escapeHtml(payload.documentName || "documento")}</strong>
        foi agendada por <strong>${escapeHtml(payload.companyName)}</strong>. Confira abaixo os detalhes.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tbody>
          <tr><td style="padding:7px 0;font-size:12px;color:#5b6b73;width:150px;">Data e horário</td>
              <td style="padding:7px 0;font-size:13px;font-weight:700;">${escapeHtml(appointment || "A confirmar")}</td></tr>
          <tr><td style="padding:7px 0;font-size:12px;color:#5b6b73;">Local</td>
              <td style="padding:7px 0;font-size:13px;">${escapeHtml(payload.location || "A confirmar")}</td></tr>
          <tr><td style="padding:7px 0;font-size:12px;color:#5b6b73;">Clínica / fornecedor</td>
              <td style="padding:7px 0;font-size:13px;">${escapeHtml(payload.clinicName || "—")}</td></tr>
          <tr><td style="padding:7px 0;font-size:12px;color:#5b6b73;">Contato</td>
              <td style="padding:7px 0;font-size:13px;">${escapeHtml(payload.clinicContact || "—")}</td></tr>
          <tr><td style="padding:7px 0;font-size:12px;color:#5b6b73;">Responsável</td>
              <td style="padding:7px 0;font-size:13px;">${escapeHtml(payload.sender || "SESMT")}</td></tr>
        </tbody>
      </table>
      ${
        exams.length > 0
          ? `<h2 style="margin:20px 0 8px;font-size:14px;">Exames e orientações</h2>
             <table style="width:100%;border-collapse:collapse;border:1px solid #d7e0dc;border-radius:8px;overflow:hidden;">
               <thead><tr style="background:#f4f8f6;">
                 <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#5b6b73;">Exame</th>
                 <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:#5b6b73;">Orientações</th>
               </tr></thead>
               <tbody>${examRows}</tbody>
             </table>`
          : `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c4a51;">
               Não há exames complementares previstos para este atendimento.
             </p>`
      }
      ${
        payload.notes
          ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;"><strong>Orientações gerais:</strong> ${escapeHtml(
              payload.notes
            )}</p>`
          : ""
      }
      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#5b6b73;">
        Após a realização dos exames, o documento novo será anexado ao seu prontuário no sistema.
        Em caso de dúvida, procure o SESMT de ${escapeHtml(payload.companyName)}.
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

  let payload: RenewalPayload;
  try {
    payload = (await req.json()) as RenewalPayload;
  } catch {
    return jsonResponse({ sent: false, reason: "invalid-json" }, 400);
  }

  const recipients = normalizeRecipients([payload.collaboratorEmail, payload.managerEmail]);
  if (recipients.length === 0) {
    return jsonResponse({ sent: false, reason: "no-recipients" }, 200);
  }
  if (!payload.documentName || !payload.appointmentDate || !payload.location) {
    return jsonResponse({ sent: false, reason: "missing-schedule" }, 400);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") || "").trim();
  if (!apiKey || !fromDomain) {
    return jsonResponse({ sent: false, reason: "resend-not-configured" }, 200);
  }

  const companyName = (payload.companyName || "Sua empresa").toString();
  const from = `SSTEK <noreply@${fromDomain}>`;
  const subject = `Agendamento de ${payload.documentTypeName || "documento"} — ${companyName}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html: buildHtml({ ...payload, companyName, documentName: payload.documentName }),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return jsonResponse({ sent: false, reason: "resend-error", detail }, 200);
    }

    return jsonResponse({ sent: true, recipients: recipients.length });
  } catch (error) {
    return jsonResponse({ sent: false, reason: "request-failed", detail: String(error) }, 200);
  }
});
