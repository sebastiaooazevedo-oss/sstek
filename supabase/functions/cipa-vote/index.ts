import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge function da urna eletrônica da CIPA.
 *
 * Ações públicas (sem login): get_ballot, identify, accept_term, cast_vote.
 * Ações administrativas: send_invites.
 *
 * Segurança:
 *  - O cliente NUNCA escreve cédula nem marca participação — isso é feito aqui,
 *    com a service role, através do RPC transacional `cipa_cast_ballot`.
 *  - A cédula (`cipa_ballots`) NÃO guarda eleitor; a participação
 *    (`cipa_voter_participation`) guarda apenas "votou / não votou".
 *  - A elegibilidade usa a base eleitoral (Fase 2) quando existe; caso não
 *    exista, cai para os colaboradores ativos do estabelecimento da eleição.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

type WindowState = "rascunho" | "em-breve" | "aberta" | "encerrada";

function windowStateOf(config: Record<string, unknown> | null): WindowState {
  if (!config) return "rascunho";
  const status = String(config.status ?? "rascunho");
  if (status === "encerrada") return "encerrada";
  if (status !== "aberta") return "rascunho";
  const now = Date.now();
  const start = config.vote_start_at ? new Date(String(config.vote_start_at)).getTime() : 0;
  const end = config.vote_end_at ? new Date(String(config.vote_end_at)).getTime() : 0;
  if (start && now < start) return "em-breve";
  if (end && now > end) return "encerrada";
  return "aberta";
}

interface DirectoryEntry {
  ref: string;
  name: string;
  email: string;
  cpf: string;
  establishment: string;
  active: boolean;
  eligible: boolean;
}

interface VoterDirectory {
  mode: "roll" | "fallback";
  entries: DirectoryEntry[];
}

async function resolveCompanyId(admin: ReturnType<typeof createClient>, companyRef: string): Promise<string | null> {
  const bySub = await admin.from("companies").select("id").eq("subdomain", companyRef).maybeSingle();
  if (!bySub.error && bySub.data) return String(bySub.data.id);
  const first = await admin.from("companies").select("id").limit(1).maybeSingle();
  if (!first.error && first.data) return String(first.data.id);
  return null;
}

/** Monta o diretório de votantes do processo (com elegibilidade). */
async function buildVoterDirectory(
  admin: ReturnType<typeof createClient>,
  companyRef: string,
  electionRef: string,
  establishment: string
): Promise<VoterDirectory> {
  const companyId = await resolveCompanyId(admin, companyRef);
  const collaborators = companyId
    ? (await admin
        .from("company_collaborators")
        .select("ref, name, email, cpf, establishment, active")
        .eq("company_id", companyId)).data ?? []
    : [];

  const rolls = await admin
    .from("cipa_voter_rolls")
    .select("id, version")
    .eq("company_ref", companyRef)
    .eq("election_ref", electionRef)
    .order("version", { ascending: false });
  const rollIds = (rolls.data ?? []).map((r) => String(r.id));

  let eligibleRefs: Set<string> | null = null;
  if (rollIds.length) {
    const entries = await admin
      .from("cipa_voter_entries")
      .select("collaborator_ref, eligibility")
      .in("roll_id", rollIds);
    if ((entries.data ?? []).length) {
      eligibleRefs = new Set(
        (entries.data ?? [])
          .filter((e) => String(e.eligibility) === "apto" && e.collaborator_ref)
          .map((e) => String(e.collaborator_ref))
      );
    }
  }

  const entries: DirectoryEntry[] = collaborators.map((c) => {
    const ref = String(c.ref ?? "");
    const establishmentMatch = !establishment || !c.establishment || String(c.establishment) === establishment;
    const eligible =
      eligibleRefs !== null ? eligibleRefs.has(ref) : Boolean(c.active) && establishmentMatch;
    return {
      ref,
      name: String(c.name ?? ""),
      email: String(c.email ?? ""),
      cpf: String(c.cpf ?? ""),
      establishment: String(c.establishment ?? ""),
      active: Boolean(c.active),
      eligible,
    };
  });

  return { mode: eligibleRefs !== null ? "roll" : "fallback", entries };
}

function findByCpf(directory: VoterDirectory, cpf: string): DirectoryEntry | null {
  const target = digitsOnly(cpf);
  if (!target) return null;
  return directory.entries.find((e) => digitsOnly(e.cpf) === target) ?? null;
}

async function hasVoted(
  admin: ReturnType<typeof createClient>,
  companyRef: string,
  electionRef: string,
  collaboratorRef: string
): Promise<boolean> {
  const { data } = await admin
    .from("cipa_voter_participation")
    .select("has_voted")
    .eq("company_ref", companyRef)
    .eq("election_ref", electionRef)
    .eq("collaborator_ref", collaboratorRef)
    .maybeSingle();
  return Boolean(data?.has_voted);
}

async function termAccepted(
  admin: ReturnType<typeof createClient>,
  companyRef: string,
  electionRef: string,
  collaboratorRef: string,
  version: string
): Promise<boolean> {
  const { data } = await admin
    .from("cipa_ballot_term_acceptances")
    .select("term_version")
    .eq("company_ref", companyRef)
    .eq("election_ref", electionRef)
    .eq("collaborator_ref", collaboratorRef)
    .maybeSingle();
  if (!data) return false;
  return !version || String(data.term_version) === version;
}

/* ------------------------------- E-mail ------------------------------ */

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendEmails(messages: EmailPayload[]): Promise<{ enabled: boolean; sent: number }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
  if (!apiKey || !fromDomain) return { enabled: false, sent: 0 };
  const from = `SSTEK CIPA <noreply@${fromDomain}>`;
  let sent = 0;
  for (const message of messages) {
    if (!message.to) continue;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
      });
      if (res.ok) sent += 1;
    } catch {
      /* e-mail é best-effort; não interrompe a votação */
    }
  }
  return { enabled: true, sent };
}

function inviteHtml(ballot: Record<string, unknown>, link: string): string {
  const title = String(ballot.election_title ?? "Eleição da CIPA");
  const cipa = String(ballot.cipa_name ?? "");
  const start = ballot.vote_start_at ? new Date(String(ballot.vote_start_at)).toLocaleString("pt-BR") : "—";
  const end = ballot.vote_end_at ? new Date(String(ballot.vote_end_at)).toLocaleString("pt-BR") : "—";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;line-height:1.6">
      <h2 style="margin:0 0 8px">Votação aberta: ${title}</h2>
      <p>${cipa ? `${cipa} · ` : ""}Sua participação é importante para o pleito da CIPA.</p>
      <p><strong>Período:</strong> ${start} até ${end}</p>
      <p>Para votar, clique no link abaixo e identifique-se com o seu CPF:</p>
      <p><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Acessar a urna eletrônica</a></p>
      <p style="font-size:13px;color:#555">Lembrete: o voto é <strong>secreto</strong> e o sistema não registra em quem você votou.</p>
      <p style="font-size:12px;color:#888">${link}</p>
    </div>`;
}

function confirmationHtml(payload: {
  voterName: string;
  email: string;
  electionTitle: string;
  cipaName: string;
  establishment: string;
  endAt: string;
  protocol: string;
}): string {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1c;line-height:1.6">
      <h2 style="margin:0 0 8px">Voto registrado com sucesso</h2>
      <p>Prezado(a) ${payload.voterName},</p>
      <p>Confirmamos que <strong>o e-mail ${payload.email}, correspondente ao CPF cadastrado, realizou o voto</strong> no pleito abaixo:</p>
      <ul>
        <li><strong>Eleição:</strong> ${payload.electionTitle}</li>
        <li><strong>Comissão:</strong> ${payload.cipaName}${payload.establishment ? ` · ${payload.establishment}` : ""}</li>
        <li><strong>Encerramento da votação:</strong> ${payload.endAt}</li>
        <li><strong>Protocolo:</strong> ${payload.protocol}</li>
      </ul>
      <p style="font-size:13px;color:#555">Por sigilo, este e-mail <strong>não</strong> informa o candidato ou a opção escolhida. O voto é secreto.</p>
    </div>`;
}

/* ------------------------------- Server ------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: "SERVER_NOT_CONFIGURED" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  }

  const action = String(body.action ?? "");
  const token = String(body.token ?? "");

  async function loadConfig(ref: string): Promise<Record<string, unknown> | null> {
    const { data } = await admin.from("cipa_ballot_config").select("*").eq("public_token", ref).maybeSingle();
    return (data as Record<string, unknown>) ?? null;
  }

  try {
    if (action === "get_ballot") {
      const config = await loadConfig(token);
      if (!config) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
      const candidates = await admin
        .from("cipa_ballot_candidates")
        .select("candidate_ref, name, role_function, area, photo_url, sort_order")
        .eq("company_ref", config.company_ref)
        .eq("election_ref", config.election_ref)
        .order("sort_order");
      return jsonResponse({
        ok: true,
        windowState: windowStateOf(config),
        ballot: {
          title: config.election_title,
          cipaName: config.cipa_name,
          establishment: config.establishment,
          startAt: config.vote_start_at,
          endAt: config.vote_end_at,
          termVersion: config.term_version,
          termContent: config.term_content,
          candidates: (candidates.data ?? []).map((c) => ({
            ref: String(c.candidate_ref),
            name: String(c.name ?? ""),
            roleFunction: String(c.role_function ?? ""),
            area: String(c.area ?? ""),
            photoUrl: (c.photo_url as string) ?? "",
          })),
        },
      });
    }

    if (action === "identify") {
      const config = await loadConfig(token);
      if (!config) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
      const state = windowStateOf(config);
      if (state !== "aberta") return jsonResponse({ ok: true, windowState: state, closed: true });
      const directory = await buildVoterDirectory(
        admin,
        String(config.company_ref),
        String(config.election_ref),
        String(config.establishment ?? "")
      );
      const person = findByCpf(directory, String(body.cpf ?? ""));
      if (!person) return jsonResponse({ ok: true, windowState: state, eligible: false, reason: "NOT_FOUND_CPF" });
      if (!person.eligible) return jsonResponse({ ok: true, windowState: state, eligible: false, reason: "NOT_ELIGIBLE" });
      const voted = await hasVoted(admin, String(config.company_ref), String(config.election_ref), person.ref);
      if (voted)
        return jsonResponse({ ok: true, windowState: state, eligible: true, alreadyVoted: true, voterName: person.name });
      const accepted = await termAccepted(
        admin,
        String(config.company_ref),
        String(config.election_ref),
        person.ref,
        String(config.term_version ?? "")
      );
      return jsonResponse({
        ok: true,
        windowState: state,
        eligible: true,
        alreadyVoted: false,
        termAccepted: accepted,
        voterName: person.name,
      });
    }

    if (action === "accept_term") {
      const config = await loadConfig(token);
      if (!config) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
      const state = windowStateOf(config);
      if (state !== "aberta") return jsonResponse({ ok: false, error: "CLOSED" });
      const directory = await buildVoterDirectory(
        admin,
        String(config.company_ref),
        String(config.election_ref),
        String(config.establishment ?? "")
      );
      const person = findByCpf(directory, String(body.cpf ?? ""));
      if (!person || !person.eligible) return jsonResponse({ ok: false, error: "NOT_ELIGIBLE" });
      const { error } = await admin.from("cipa_ballot_term_acceptances").upsert(
        {
          company_ref: config.company_ref,
          election_ref: config.election_ref,
          collaborator_ref: person.ref,
          term_version: String(body.termVersion ?? config.term_version ?? "v1"),
          accepted_at: new Date().toISOString(),
          ip: req.headers.get("x-forwarded-for") ?? null,
          user_agent: req.headers.get("user-agent") ?? null,
        },
        { onConflict: "company_ref,election_ref,collaborator_ref" }
      );
      if (error) return jsonResponse({ ok: false, error: "ACCEPT_FAILED" }, 500);
      return jsonResponse({ ok: true });
    }

    if (action === "cast_vote") {
      const config = await loadConfig(token);
      if (!config) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
      const state = windowStateOf(config);
      if (state !== "aberta") return jsonResponse({ ok: false, error: "CLOSED" });
      const directory = await buildVoterDirectory(
        admin,
        String(config.company_ref),
        String(config.election_ref),
        String(config.establishment ?? "")
      );
      const person = findByCpf(directory, String(body.cpf ?? ""));
      if (!person || !person.eligible) return jsonResponse({ ok: false, error: "NOT_ELIGIBLE" });
      const accepted = await termAccepted(
        admin,
        String(config.company_ref),
        String(config.election_ref),
        person.ref,
        String(config.term_version ?? "")
      );
      if (!accepted) return jsonResponse({ ok: false, error: "TERM_NOT_ACCEPTED" });

      const choiceRef = body.choiceRef ? String(body.choiceRef) : "";
      const { data, error } = await admin.rpc("cipa_cast_ballot", {
        p_company_ref: String(config.company_ref),
        p_election_ref: String(config.election_ref),
        p_collaborator_ref: person.ref,
        p_choice_ref: choiceRef,
      });
      if (error) {
        if (String(error.message ?? "").includes("ALREADY_VOTED")) {
          return jsonResponse({ ok: false, error: "ALREADY_VOTED" });
        }
        return jsonResponse({ ok: false, error: "VOTE_FAILED" }, 500);
      }

      const result = (data ?? {}) as Record<string, unknown>;
      const endAt = config.vote_end_at ? new Date(String(config.vote_end_at)).toLocaleString("pt-BR") : "—";
      const protocol = String(result.protocol ?? "");

      const email = await sendEmails([
        {
          to: person.email,
          subject: `Voto registrado — ${String(config.election_title ?? "Eleição da CIPA")}`,
          html: confirmationHtml({
            voterName: person.name,
            email: person.email,
            electionTitle: String(config.election_title ?? ""),
            cipaName: String(config.cipa_name ?? ""),
            establishment: String(config.establishment ?? ""),
            endAt,
            protocol,
          }),
        },
      ]);

      return jsonResponse({
        ok: true,
        confirmation: {
          electionTitle: config.election_title,
          cipaName: config.cipa_name,
          establishment: config.establishment,
          endAt: config.vote_end_at,
          endAtLabel: endAt,
          protocol,
          voterName: person.name,
        },
        emailEnabled: email.enabled,
        emailSent: email.sent > 0,
      });
    }

    if (action === "send_invites") {
      const config = await loadConfig(token);
      if (!config) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
      const directory = await buildVoterDirectory(
        admin,
        String(config.company_ref),
        String(config.election_ref),
        String(config.establishment ?? "")
      );
      const origin = String(body.origin ?? "").replace(/\/$/, "");
      const link = `${origin}/votacao/${String(config.public_token)}`;
      const targets = directory.entries.filter((e) => e.eligible && e.email);
      const messages = targets.map((e) => ({
        to: e.email,
        subject: `Votação da CIPA — ${String(config.election_title ?? "")}`,
        html: inviteHtml(config, link),
      }));
      const result = await sendEmails(messages);
      return jsonResponse({
        ok: true,
        total: targets.length,
        sent: result.sent,
        emailEnabled: result.enabled,
        link,
      });
    }

    return jsonResponse({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch {
    return jsonResponse({ ok: false, error: "UNEXPECTED" }, 500);
  }
});
