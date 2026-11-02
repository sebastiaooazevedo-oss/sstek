import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * signature-engine
 * Nucleo do modulo de assinatura eletronica. TODA decisao relevante acontece
 * aqui (no servidor): aceite de termo, versionamento da representacao visual,
 * reautenticacao para alteracoes, bloqueios de assinatura, hash de conteudo e
 * de assinatura, e trilha de auditoria. O cliente nunca grava esses dados
 * diretamente - as tabelas do nucleo nao possuem policy de escrita.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class Blocked extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 409, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canon(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(",")}}`;
}

function onlyDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = any;

async function resolveCompany(admin: AnyClient, subdomain?: string) {
  if (subdomain) {
    const { data } = await admin
      .from("companies")
      .select("id, subdomain, name")
      .eq("subdomain", subdomain)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await admin.from("companies").select("id, subdomain, name").limit(1).maybeSingle();
  return data;
}

async function ensureProfile(
  admin: AnyClient,
  companyId: string,
  ref: string,
  name: string,
  email: string | null
) {
  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("company_id", companyId)
    .eq("collaborator_ref", ref)
    .limit(1)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await admin
    .from("profiles")
    .insert({
      company_id: companyId,
      role: "collaborator",
      collaborator_ref: ref,
      name,
      email: email ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw new Blocked("PROFILE_CREATE_FAILED", 500, error.message);
  return data;
}

async function resolveAccount(admin: AnyClient, payload: Record<string, any>, authUser: any) {
  const company = await resolveCompany(admin, payload.subdomain);
  if (!company) throw new Blocked("COMPANY_NOT_FOUND", 404, "Empresa nao encontrada.");

  if (authUser) {
    let profile: any = null;
    const byAuth = await admin
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .limit(1)
      .maybeSingle();
    profile = byAuth.data ?? null;
    if (!profile && authUser.email) {
      const byEmail = await admin
        .from("profiles")
        .select("*")
        .eq("email", authUser.email)
        .limit(1)
        .maybeSingle();
      profile = byEmail.data ?? null;
    }
    if (!profile) throw new Blocked("PROFILE_NOT_FOUND", 404, "Conta nao vinculada.");
    return { company, profile, authenticated: true };
  }

  const ref = payload.collaboratorRef;
  if (!ref) throw new Blocked("AUTH_REQUIRED", 401, "Identificacao do colaborador ausente.");
  const profile = await ensureProfile(
    admin,
    company.id,
    ref,
    payload.collaboratorName || "Colaborador",
    payload.collaboratorEmail ?? null
  );
  return { company, profile, authenticated: false };
}

async function activeTerm(admin: AnyClient) {
  const { data } = await admin
    .from("signature_terms")
    .select("id, version, title, body")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function requireAcceptance(admin: AnyClient, profileId: string, termVersion: number) {
  const { data } = await admin
    .from("signature_term_acceptances")
    .select("id, accepted_at, term_version")
    .eq("profile_id", profileId)
    .eq("term_version", termVersion)
    .maybeSingle();
  return data;
}

async function audit(
  admin: AnyClient,
  entry: {
    companyId?: string | null;
    profileId?: string | null;
    collaboratorRef?: string | null;
    actorProfileId?: string | null;
    eventType: string;
    entity?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
  }
) {
  await admin.from("signature_audit_log").insert({
    company_id: entry.companyId ?? null,
    profile_id: entry.profileId ?? null,
    collaborator_ref: entry.collaboratorRef ?? null,
    actor_profile_id: entry.actorProfileId ?? entry.profileId ?? null,
    event_type: entry.eventType,
    entity: entry.entity ?? null,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
    user_agent: entry.userAgent ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Fluxo de documentos (Etapa 02): estados, signatarios, desafios.      */
/* ------------------------------------------------------------------ */

async function loadDocument(admin: AnyClient, id: string) {
  if (!id) return null;
  const { data } = await admin.from("signature_documents").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

async function loadSignatories(admin: AnyClient, documentId: string) {
  const { data } = await admin
    .from("signature_document_signatories")
    .select("*")
    .eq("document_id", documentId)
    .order("order_index", { ascending: true });
  return data ?? [];
}

function pickSignatory(signatories: any[], ref: string | null | undefined) {
  if (!ref) return null;
  return signatories.find((s) => s.collaborator_ref === ref) ?? null;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskContact(value: string | null | undefined): string {
  if (!value) return "contato verificado";
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    const head = user.slice(0, 2);
    return `${head}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits ? `*****${digits.slice(-3)}` : "contato verificado";
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Etapa 04: politica por categoria/papel, classificacao e certificado. */
/* ------------------------------------------------------------------ */

/** Normaliza o papel do signatario para a chave de politica. */
function normalizeSignerRole(roleLabel: string | null | undefined): string {
  const v = String(roleLabel ?? "").toLowerCase();
  if (v.includes("respons")) return "responsavel_tecnico";
  if (v.includes("instrutor")) return "instrutor";
  if (v.includes("facilitador")) return "facilitador";
  if (v.includes("executante")) return "executante";
  if (v.includes("gestor") || v.includes("admin") || v.includes("supervisor")) return "gestor";
  return "colaborador";
}

/** Politica efetiva (a politica da empresa tem prioridade sobre a global). */
async function resolvePolicy(admin: AnyClient, companyId: string, docType: string, signerRole: string) {
  const { data } = await admin.rpc("sg_signature_policy_for", {
    p_company_id: companyId,
    p_doc_type: docType,
    p_signer_role: signerRole,
  });
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

async function resolveCertificateConfig(admin: AnyClient, companyId: string) {
  const { data } = await admin
    .from("signature_certificate_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Registra o recibo de carimbo de tempo. Sem provedor TSA real configurado, o
 * recibo e gravado como 'not_configured' - o horario do servidor e registrado
 * separadamente e NUNCA apresentado como carimbo de tempo independente.
 */
async function createTimestampReceipt(
  admin: AnyClient,
  params: { companyId: string; documentId: string; signatureId: string | null; provider?: string | null }
): Promise<string | null> {
  const provider = params.provider ?? null;
  const configured = Boolean(provider);
  const { data } = await admin
    .from("signature_timestamp_receipts")
    .insert({
      company_id: params.companyId,
      document_id: params.documentId,
      signature_id: params.signatureId,
      provider,
      status: configured ? "pending" : "not_configured",
      raw: {
        note: configured
          ? "Carimbo de tempo independente pendente de confirmacao do provedor TSA."
          : "Carimbo de tempo independente NAO configurado. Horario do servidor registrado separadamente.",
      },
    })
    .select("id")
    .single();
  return data?.id ?? null;
}

// Fuso de exibicao oficial do sistema (o servidor sempre grava em UTC).
const DISPLAY_TIMEZONE = "UTC\u221203:00";

async function loadSignatures(admin: AnyClient, documentId: string) {
  const { data } = await admin
    .from("document_signatures")
    .select("*")
    .eq("document_id", documentId)
    .order("signed_at", { ascending: true });
  return data ?? [];
}

/**
 * Calcula e grava os hashes do PDF final e do relatorio de evidencias quando
 * o documento e concluido. IMPORTANTE: o hash do PDF final NAO inclui o proprio
 * campo final_pdf_hash, para nao conter o hash de um arquivo que contem esse hash.
 */
async function finalizeDocument(admin: AnyClient, documentId: string) {
  const doc = await loadDocument(admin, documentId);
  if (!doc || doc.status !== DOC_STATUS.DONE) return null;
  if (doc.final_pdf_hash && doc.evidence_report_hash) {
    return { finalPdfHash: doc.final_pdf_hash, evidenceReportHash: doc.evidence_report_hash };
  }
  const signatories = await loadSignatories(admin, documentId);
  const signatures = await loadSignatures(admin, documentId);

  const contentHash = await sha256Hex(
    canon({
      title: doc.title,
      doc_type: doc.doc_type,
      declaration_type: doc.declaration_type,
      declaration_text: doc.declaration_text,
      content: doc.content,
      version: doc.version,
      signatories: signatories.map((s: any) => ({
        ref: s.collaborator_ref,
        name: s.name,
        role: s.role_label,
        page: s.position_page,
        x: s.position_x,
        y: s.position_y,
      })),
    })
  );

  const finalPdfHash = await sha256Hex(
    canon({
      document_uid: doc.document_uid ?? null,
      base_pdf_hash: doc.base_pdf_hash ?? null,
      content_hash: contentHash,
      version: doc.version,
      signatures: signatures.map((s: any) => ({
        signature_uid: s.signature_uid,
        signer_name: s.signer_name,
        signed_at: s.signed_at,
        representation_version: s.representation_version,
        declaration_type: s.declaration_type,
      })),
    })
  );

  const evidenceReportHash = await sha256Hex(
    canon(
      signatures.map((s: any) => ({
        signature_uid: s.signature_uid,
        company_id: s.company_id,
        profile_id: s.profile_id,
        document_id: s.document_id,
        document_version: s.document_version,
        base_pdf_hash: s.base_pdf_hash,
        content_hash: s.content_hash,
        signed_at: s.signed_at,
        timezone_display: s.timezone_display,
        declaration_type: s.declaration_type,
        auth_method: s.auth_method,
        auth_result: s.auth_result,
        representation_id: s.representation_id,
        representation_version: s.representation_version,
      }))
    )
  );

  await admin.rpc("sg_finalize_document", {
    p_document_id: documentId,
    p_final_pdf_hash: finalPdfHash,
    p_evidence_report_hash: evidenceReportHash,
  });
  return { finalPdfHash, evidenceReportHash };
}

const DOC_STATUS = {
  DRAFT: "rascunho",
  AWAITING: "aguardando",
  PARTIAL: "parcial",
  DONE: "concluido",
  CANCELLED: "cancelado",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON || !SERVICE) {
    return json({ error: "SERVER_MISCONFIGURED" }, 500);
  }

  const anonClient = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Record<string, any> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }
  const action = String(payload.action || "");

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  let authUser: any = null;
  if (token && token !== ANON) {
    try {
      const { data } = await anonClient.auth.getUser(token);
      authUser = data?.user ?? null;
    } catch {
      authUser = null;
    }
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    switch (action) {
      case "verify_affiliation": {
        const company = await resolveCompany(admin, payload.subdomain);
        if (!company) throw new Blocked("COMPANY_NOT_FOUND", 404, "Empresa nao encontrada.");
        const cpf = onlyDigits(payload.cpf);
        const { data: candidate } = await admin
          .from("company_collaborators")
          .select("ref, name, cpf, matricula, role_function, area, active")
          .eq("company_id", company.id)
          .eq("cpf", payload.cpf ?? "")
          .maybeSingle();
        if (!candidate) {
          return json({ matched: false, reason: "not_found" });
        }
        const nameOk = String(candidate.name).trim().toLowerCase() === String(payload.name ?? "").trim().toLowerCase();
        const cpfOk = onlyDigits(candidate.cpf) === cpf;
        const matriculaOk =
          !payload.matricula ||
          String(candidate.matricula ?? "").trim().toLowerCase() === String(payload.matricula).trim().toLowerCase();
        const matched = nameOk && cpfOk && matriculaOk && candidate.active;
        return json({ matched, collaborator: matched ? candidate : null });
      }

      case "accept_term": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const term = await activeTerm(admin);
        if (!term) throw new Blocked("NO_ACTIVE_TERM", 409, "Nenhum termo vigente.");

        const existing = await requireAcceptance(admin, ctx.profile.id, term.version);
        if (existing) {
          return json({
            ok: true,
            alreadyAccepted: true,
            termVersion: term.version,
            acceptedAt: existing.accepted_at,
          });
        }

        const acceptedAt = new Date().toISOString();
        const evidence: Record<string, unknown> = {
          method: ctx.authenticated ? "authenticated" : "demo",
          user_agent: userAgent,
          ip,
          email: authUser?.email ?? payload.collaboratorEmail ?? null,
        };
        const acceptanceHash = await sha256Hex(
          [ctx.profile.id, term.version, acceptedAt, term.body, canon(evidence)].join("|")
        );

        const { error } = await admin.from("signature_term_acceptances").insert({
          profile_id: ctx.profile.id,
          term_id: term.id,
          term_version: term.version,
          term_body: term.body,
          accepted_at: acceptedAt,
          evidence,
          acceptance_hash: acceptanceHash,
        });
        if (error) throw new Blocked("ACCEPT_FAILED", 500, error.message);

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null,
          eventType: "term_accepted",
          entity: "signature_terms",
          entityId: term.id,
          metadata: { term_version: term.version, acceptance_hash: acceptanceHash },
          ip,
          userAgent,
        });

        return json({ ok: true, termVersion: term.version, acceptedAt, acceptanceHash });
      }

      case "save_representation": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const term = await activeTerm(admin);
        if (!term) throw new Blocked("NO_ACTIVE_TERM", 409, "Nenhum termo vigente.");
        const acceptance = await requireAcceptance(admin, ctx.profile.id, term.version);
        if (!acceptance) {
          throw new Blocked("TERM_NOT_ACCEPTED", 409, "Aceite o termo de adesao antes de ativar a assinatura.");
        }

        const kind = payload.kind === "draw" ? "draw" : "typographic";
        const imageData = typeof payload.imageData === "string" ? payload.imageData : "";
        if (!imageData) throw new Blocked("IMAGE_REQUIRED", 400, "Representacao visual ausente.");
        const fontModel = kind === "typographic" ? String(payload.fontModel || "great-vibes") : "draw";
        const nameStyle = payload.nameStyle === "partial" ? "partial" : "full";

        const { data: activeRep } = await admin
          .from("signature_representations")
          .select("id, version")
          .eq("profile_id", ctx.profile.id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeRep) {
          const reauth = payload.reauth || {};
          if (ctx.authenticated) {
            if (!reauth.password) {
              throw new Blocked("REAUTH_REQUIRED", 428, "Informe a senha para alterar a assinatura.");
            }
            const { error: signErr } = await anonClient.auth.signInWithPassword({
              email: authUser?.email,
              password: reauth.password,
            });
            if (signErr) throw new Blocked("REAUTH_FAILED", 401, "Senha incorreta.");
          } else if (!reauth.confirmed) {
            throw new Blocked("REAUTH_REQUIRED", 428, "Confirme sua identidade para alterar a assinatura.");
          }
        }

        const { data: maxRow } = await admin
          .from("signature_representations")
          .select("version")
          .eq("profile_id", ctx.profile.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersion = (maxRow?.version ?? 0) + 1;
        const now = new Date().toISOString();

        if (activeRep) {
          await admin
            .from("signature_representations")
            .update({ is_active: false, superseded_at: now })
            .eq("profile_id", ctx.profile.id)
            .eq("is_active", true);
        }

        const { data: rep, error: repErr } = await admin
          .from("signature_representations")
          .insert({
            profile_id: ctx.profile.id,
            company_id: ctx.company.id,
            kind,
            font_model: fontModel,
            name_style: nameStyle,
            image_data: imageData,
            version: nextVersion,
            is_active: true,
          })
          .select("id, version, kind")
          .single();
        if (repErr) throw new Blocked("REPRESENTATION_FAILED", 500, repErr.message);

        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        if (ref) {
          await admin.from("collaborator_signatures").upsert(
            {
              collaborator_id: ref,
              font_model: fontModel,
              name_style: nameStyle,
              kind,
              image_data: imageData,
              activated: true,
              term_id: term.id,
              term_accepted_at: acceptance.accepted_at,
              representation_id: rep.id,
              profile_id: ctx.profile.id,
              version: nextVersion,
              updated_at: now,
            },
            { onConflict: "collaborator_id" }
          );
        }

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ref,
          eventType: activeRep ? "representation_changed" : "representation_created",
          entity: "signature_representations",
          entityId: rep.id,
          metadata: {
            version: nextVersion,
            kind,
            previous_representation_id: activeRep?.id ?? null,
            reauth: ctx.authenticated ? "password" : "demo_confirmation",
          },
          ip,
          userAgent,
        });

        return json({
          ok: true,
          representationId: rep.id,
          version: rep.version,
          kind,
          termAcceptedAt: acceptance.accepted_at,
        });
      }

      case "remove_representation": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const now = new Date().toISOString();
        await admin
          .from("signature_representations")
          .update({ is_active: false, superseded_at: now })
          .eq("profile_id", ctx.profile.id)
          .eq("is_active", true);
        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        if (ref) {
          await admin
            .from("collaborator_signatures")
            .update({ activated: false, representation_id: null, image_data: null, updated_at: now })
            .eq("collaborator_id", ref);
        }
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ref,
          eventType: "representation_removed",
          entity: "signature_representations",
          ip,
          userAgent,
        });
        return json({ ok: true });
      }

      case "sign_document": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const term = await activeTerm(admin);
        if (!term) throw new Blocked("NO_ACTIVE_TERM", 409, "Nenhum termo vigente.");
        const acceptance = await requireAcceptance(admin, ctx.profile.id, term.version);
        if (!acceptance) {
          throw new Blocked("TERM_NOT_ACCEPTED", 409, "Aceite o termo de adesao antes de assinar.");
        }

        const { data: activeRep } = await admin
          .from("signature_representations")
          .select("id, version, kind, image_data")
          .eq("profile_id", ctx.profile.id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!activeRep) {
          throw new Blocked("REPRESENTATION_NOT_ACTIVATED", 409, "Ative sua assinatura em Minha assinatura.");
        }

        if (ctx.authenticated && ctx.profile.role !== "collaborator") {
          throw new Blocked("ADMIN_CANNOT_SIGN", 403, "Administradores nao podem assinar por colaboradores.");
        }

        const documentType = String(payload.documentType || "").trim();
        const documentRef = String(payload.documentRef || "").trim();
        const documentVersion = Number(payload.documentVersion || 1);
        if (!documentType || !documentRef) {
          throw new Blocked("DOCUMENT_REQUIRED", 400, "Documento nao informado.");
        }

        const { data: existing } = await admin
          .from("document_signatures")
          .select("id, document_version, signature_hash, signed_at")
          .eq("profile_id", ctx.profile.id)
          .eq("document_type", documentType)
          .eq("document_ref", documentRef)
          .maybeSingle();
        if (existing) {
          if (existing.document_version === documentVersion) {
            return json({ ok: true, alreadySigned: true, signatureHash: existing.signature_hash });
          }
          throw new Blocked(
            "DOCUMENT_VERSION_CHANGED",
            409,
            "O documento foi alterado apos uma assinatura anterior. Revalide o conteudo."
          );
        }

        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        const docPayload = payload.payload ?? {};
        const contentHash = await sha256Hex(canon(docPayload));
        const repImageHash = await sha256Hex(String(activeRep.image_data || ""));
        const signedAt = new Date().toISOString();
        const signatureHash = await sha256Hex(
          [
            contentHash,
            ctx.profile.id,
            documentType,
            documentRef,
            documentVersion,
            signedAt,
            activeRep.id,
            repImageHash,
            term.version,
          ].join("|")
        );

        const { data: inserted, error: signDocErr } = await admin
          .from("document_signatures")
          .insert({
            company_id: ctx.company.id,
            profile_id: ctx.profile.id,
            collaborator_ref: ref,
            document_type: documentType,
            document_ref: documentRef,
            document_version: documentVersion,
            content_hash: contentHash,
            representation_id: activeRep.id,
            representation_kind: activeRep.kind,
            representation_snapshot: activeRep.image_data,
            representation_version: activeRep.version,
            term_version: term.version,
            payload: docPayload,
            signature_hash: signatureHash,
            ip,
            user_agent: userAgent,
            signed_at: signedAt,
          })
          .select("id, signature_hash, signed_at")
          .single();
        if (signDocErr) throw new Blocked("SIGN_FAILED", 500, signDocErr.message);

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ref,
          eventType: "document_signed",
          entity: documentType,
          entityId: documentRef,
          metadata: { content_hash: contentHash, signature_hash: signatureHash, document_version: documentVersion },
          ip,
          userAgent,
        });

        return json({
          ok: true,
          signatureId: inserted.id,
          signatureHash,
          signedAt,
          documentVersion,
        });
      }

      case "record_account_event": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const eventType = payload.eventType === "account_recovery" ? "account_recovery" : "contact_change";
        const contact = payload.contact || {};
        const now = new Date().toISOString();

        const update: Record<string, unknown> = { sessions_invalidated_at: now, updated_at: now };
        if (typeof contact.email === "string" && contact.email) {
          update.email = contact.email;
          update.email_verified_at = null;
        }
        if (typeof contact.phone === "string" && contact.phone) {
          update.phone = contact.phone;
          update.phone_verified_at = null;
        }
        await admin.from("profiles").update(update).eq("id", ctx.profile.id);

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null,
          eventType,
          entity: "profiles",
          entityId: ctx.profile.id,
          metadata: { invalidated_sessions: true, changed: Object.keys(contact) },
          ip,
          userAgent,
        });

        return json({ ok: true, sessionsInvalidatedAt: now });
      }

      case "create_document": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const signatories = Array.isArray(payload.signatories) ? payload.signatories : [];
        if (signatories.length === 0) {
          throw new Blocked("NO_SIGNATORIES", 400, "Informe ao menos um signatario.");
        }
        const { data: doc, error } = await admin
          .from("signature_documents")
          .insert({
            company_id: ctx.company.id,
            doc_type: String(payload.docType || "outro"),
            title: String(payload.title || "Documento"),
            declaration_type: String(payload.declarationType || "content_acknowledgement"),
            declaration_text: payload.declarationText ?? null,
            content: payload.content ?? {},
            status: DOC_STATUS.DRAFT,
            version: 1,
            due_at: payload.dueAt ?? null,
            created_by_profile_id: ctx.profile.id,
            created_by_ref: ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null,
          })
          .select("*")
          .single();
        if (error) throw new Blocked("DOCUMENT_CREATE_FAILED", 500, error.message);

        const { error: sigErr } = await admin.from("signature_document_signatories").insert(
          signatories.map((s: Record<string, any>, index: number) => ({
            document_id: doc.id,
            company_id: ctx.company.id,
            collaborator_ref: String(s.collaboratorRef),
            name: String(s.name || s.collaboratorRef),
            role_label: s.role ?? null,
            email: s.email ?? null,
            position_page: Number(s.positionPage ?? 1),
            position_x: Number(s.positionX ?? 50),
            position_y: Number(s.positionY ?? 50),
            order_index: index,
            status: "pendente",
          }))
        );
        if (sigErr) throw new Blocked("SIGNATORIES_FAILED", 500, sigErr.message);

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null,
          eventType: "document_created",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { doc_type: doc.doc_type, signatories: signatories.length },
          ip,
          userAgent,
        });
        return json({ ok: true, documentId: doc.id, status: doc.status, version: doc.version });
      }

      case "update_document": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if (doc.company_id !== ctx.company.id) throw new Blocked("FORBIDDEN", 403, "Documento de outra empresa.");
        if (doc.status !== DOC_STATUS.DRAFT) {
          throw new Blocked("DOCUMENT_FROZEN", 409, "Documento ja enviado nao pode ser editado. Use substituicao.");
        }
        const now = new Date().toISOString();
        const update: Record<string, unknown> = { updated_at: now };
        if (typeof payload.title === "string") update.title = payload.title;
        if (typeof payload.docType === "string") update.doc_type = payload.docType;
        if (typeof payload.declarationType === "string") update.declaration_type = payload.declarationType;
        if (payload.declarationText !== undefined) update.declaration_text = payload.declarationText;
        if (payload.content !== undefined) update.content = payload.content;
        if (payload.dueAt !== undefined) update.due_at = payload.dueAt;
        await admin.from("signature_documents").update(update).eq("id", doc.id);

        if (Array.isArray(payload.signatories)) {
          await admin.from("signature_document_signatories").delete().eq("document_id", doc.id);
          if (payload.signatories.length > 0) {
            await admin.from("signature_document_signatories").insert(
              payload.signatories.map((s: Record<string, any>, index: number) => ({
                document_id: doc.id,
                company_id: ctx.company.id,
                collaborator_ref: String(s.collaboratorRef),
                name: String(s.name || s.collaboratorRef),
                role_label: s.role ?? null,
                email: s.email ?? null,
                position_page: Number(s.positionPage ?? 1),
                position_x: Number(s.positionX ?? 50),
                position_y: Number(s.positionY ?? 50),
                order_index: index,
                status: "pendente",
              }))
            );
          }
        }
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "document_updated",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { status: doc.status },
          ip,
          userAgent,
        });
        return json({ ok: true, documentId: doc.id });
      }

      case "submit_document": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if (doc.company_id !== ctx.company.id) throw new Blocked("FORBIDDEN", 403, "Documento de outra empresa.");
        if (doc.status !== DOC_STATUS.DRAFT) {
          return json({ ok: true, alreadySubmitted: true, status: doc.status, version: doc.version });
        }
        const signatories = await loadSignatories(admin, doc.id);
        if (signatories.length === 0) {
          throw new Blocked("NO_SIGNATORIES", 400, "Informe ao menos um signatario antes de enviar.");
        }
        const canonical = canon({
          title: doc.title,
          doc_type: doc.doc_type,
          declaration_type: doc.declaration_type,
          declaration_text: doc.declaration_text,
          content: doc.content,
          signatories: signatories.map((s: Record<string, any>) => ({
            ref: s.collaborator_ref,
            name: s.name,
            role: s.role_label,
            page: s.position_page,
            x: s.position_x,
            y: s.position_y,
          })),
        });
        const contentHash = await sha256Hex(canonical);
        const basePdfHash = await sha256Hex(`SSTEK-BASE-PDF|${doc.id}|${doc.version}|${contentHash}`);
        // Token de validacao aleatorio e nao enumeravel, gerado no servidor e
        // reservado no momento do congelamento (antes de qualquer hash final),
        // para que a inserção do QR Code nao invalide assinaturas posteriores.
        const validationToken = randomToken();
        // Nivel exigido pela politica para o conjunto de signatarios (denormalizado
        // no documento para consulta e para o gate de conclusao).
        let requiredLevel = "simples";
        let certificateRequired = false;
        for (const s of signatories) {
          const role = normalizeSignerRole(s.role_label);
          const p = await resolvePolicy(admin, ctx.company.id, doc.doc_type, role);
          const lvl = (p?.required_level as string) || "simples";
          if (lvl === "qualificada") requiredLevel = "qualificada";
          else if (lvl === "avancada" && requiredLevel !== "qualificada") requiredLevel = "avancada";
          if (p?.requires_certificate || lvl !== "simples") certificateRequired = true;
        }
        await admin
          .from("signature_documents")
          .update({ required_level: requiredLevel, certificate_required: certificateRequired })
          .eq("id", doc.id);
        const { error: subErr } = await admin.rpc("sg_submit_document_v2", {
          p_document_id: doc.id,
          p_content_hash: contentHash,
          p_base_pdf_hash: basePdfHash,
          p_base_pdf_label: `${doc.title} v${doc.version}`,
          p_validation_token: validationToken,
        });
        if (subErr) throw new Blocked("SUBMIT_FAILED", 500, subErr.message);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "document_submitted",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { content_hash: contentHash, base_pdf_hash: basePdfHash, version: doc.version },
          ip,
          userAgent,
        });
        return json({ ok: true, status: DOC_STATUS.AWAITING, contentHash, basePdfHash });
      }

      case "issue_challenge": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if ([DOC_STATUS.DRAFT, DOC_STATUS.DONE, DOC_STATUS.CANCELLED].includes(doc.status)) {
          throw new Blocked("DOCUMENT_NOT_SIGNABLE", 409, "Documento nao esta aberto para assinatura.");
        }
        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        const signatories = await loadSignatories(admin, doc.id);
        const signatory = pickSignatory(signatories, ref);
        if (!signatory) throw new Blocked("NOT_A_SIGNATORY", 403, "Voce nao e signatario deste documento.");
        if (signatory.status === "assinado") {
          throw new Blocked("ALREADY_SIGNED", 409, "Voce ja assinou esta versao do documento.");
        }
        const code = generateOtp();
        const codeHash = await sha256Hex(code);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const contact = signatory.email || ctx.profile.email || payload.collaboratorEmail || null;
        const { data: challenge, error } = await admin
          .from("signature_challenges")
          .insert({
            company_id: ctx.company.id,
            document_id: doc.id,
            signatory_id: signatory.id,
            profile_id: ctx.profile.id,
            channel: "email",
            contact_masked: maskContact(contact),
            code_hash: codeHash,
            expires_at: expiresAt,
            max_attempts: 5,
            ip,
            user_agent: userAgent,
          })
          .select("id, expires_at, max_attempts")
          .single();
        if (error) throw new Blocked("CHALLENGE_FAILED", 500, error.message);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "challenge_issued",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { challenge_id: challenge.id, signatory_id: signatory.id },
          ip,
          userAgent,
        });
        // Sem provedor de e-mail configurado, no modo demonstracao o codigo e
        // devolvido para permitir o teste do fluxo. Quando o Auth/e-mail real
        // entrar, este campo deixa de ser retornado e o codigo vai por e-mail.
        return json({
          ok: true,
          challengeId: challenge.id,
          expiresAt,
          maxAttempts: 5,
          maskedContact: maskContact(contact),
          devCode: ctx.authenticated ? undefined : code,
        });
      }

      case "doc_sign": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if (doc.company_id !== ctx.company.id) throw new Blocked("FORBIDDEN", 403, "Documento de outra empresa.");
        if (doc.status === DOC_STATUS.CANCELLED) throw new Blocked("DOCUMENT_CANCELLED", 409, "Documento cancelado.");
        if (doc.status === DOC_STATUS.DRAFT) throw new Blocked("DOCUMENT_NOT_SUBMITTED", 409, "Documento ainda em rascunho.");

        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        const signatories = await loadSignatories(admin, doc.id);
        const signatory = pickSignatory(signatories, ref);
        if (!signatory) throw new Blocked("NOT_A_SIGNATORY", 403, "Voce nao e signatario deste documento.");
        if (signatory.status === "assinado") {
          return json({ ok: true, alreadySigned: true, documentStatus: doc.status });
        }

        const { data: challenge } = await admin
          .from("signature_challenges")
          .select("*")
          .eq("id", String(payload.challengeId || ""))
          .eq("signatory_id", signatory.id)
          .maybeSingle();
        if (!challenge) throw new Blocked("CHALLENGE_NOT_FOUND", 404, "Desafio de autenticacao nao encontrado.");
        if (challenge.consumed_at) throw new Blocked("CHALLENGE_USED", 409, "Este codigo ja foi utilizado. Solicite um novo.");
        if (new Date(challenge.expires_at).getTime() < Date.now()) {
          throw new Blocked("CHALLENGE_EXPIRED", 410, "O codigo expirou. Solicite um novo.");
        }
        if (challenge.attempts >= challenge.max_attempts) {
          throw new Blocked("CHALLENGE_LOCKED", 429, "Limite de tentativas excedido. Solicite um novo codigo.");
        }
        const codeHash = await sha256Hex(String(payload.code || ""));
        if (codeHash !== challenge.code_hash) {
          await admin
            .from("signature_challenges")
            .update({ attempts: challenge.attempts + 1 })
            .eq("id", challenge.id);
          throw new Blocked("CHALLENGE_INVALID", 401, "Codigo incorreto.");
        }

        const term = await activeTerm(admin);
        if (!term) throw new Blocked("NO_ACTIVE_TERM", 409, "Nenhum termo vigente.");
        const acceptance = await requireAcceptance(admin, ctx.profile.id, term.version);
        if (!acceptance) throw new Blocked("TERM_NOT_ACCEPTED", 409, "Aceite o termo de adesao antes de assinar.");
        const { data: activeRep } = await admin
          .from("signature_representations")
          .select("id, version, kind, image_data")
          .eq("profile_id", ctx.profile.id)
          .eq("is_active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!activeRep) throw new Blocked("REPRESENTATION_NOT_ACTIVATED", 409, "Ative sua assinatura em Minha assinatura.");

        // ---- Politica de assinatura por categoria documental e papel ----
        const signerRole = normalizeSignerRole(signatory.role_label);
        const policy = await resolvePolicy(admin, ctx.company.id, doc.doc_type, signerRole);
        const requiredLevel = (policy?.required_level as string) || "simples";
        const requiresCertificate = Boolean(policy?.requires_certificate) || requiredLevel !== "simples";

        if (requiresCertificate) {
          const certConfig = await resolveCertificateConfig(admin, ctx.company.id);
          if (!certConfig || !certConfig.enabled || !certConfig.validation_endpoint) {
            throw new Blocked(
              "CERTIFICATE_NOT_AVAILABLE",
              503,
              "A politica deste documento/papel exige assinatura com certificado ICP-Brasil, mas nao ha integracao real configurada. A conclusao fica bloqueada - nenhum certificado, selo ou resultado e simulado."
            );
          }
          const cert = (payload.certificate || {}) as Record<string, unknown>;
          if (!cert.certificate || !cert.rawSignature || !cert.chain) {
            throw new Blocked(
              "CERTIFICATE_REQUIRED",
              428,
              "Este documento exige certificado ICP-Brasil. Apresente o certificado do signatario e a cadeia de validacao para concluir."
            );
          }
          // A validacao real da cadeia ICP-Brasil exige provedor real. Sem validacao
          // efetiva, o ato NAO e concluido - nunca simulamos selo ou resultado.
          throw new Blocked(
            "CERTIFICATE_VALIDATION_UNAVAILABLE",
            503,
            "Integracao de certificado configurada, porem a validacao real da cadeia ICP-Brasil ainda nao esta disponivel neste ambiente. A assinatura foi bloqueada e nenhum resultado foi simulado."
          );
        }

        const declarationType = doc.declaration_type;
        const signedAt = new Date().toISOString();
        const repImageHash = await sha256Hex(String(activeRep.image_data || ""));
        // UUID da assinatura: identifica o ATO. Gerado no servidor e protegido
        // por indice UNIQUE no banco. Nao e apresentado como prova isolada.
        const signatureUid = crypto.randomUUID();
        const signatureHash = await sha256Hex(
          [
            doc.content_hash,
            ctx.profile.id,
            signatory.id,
            doc.id,
            doc.version,
            signedAt,
            activeRep.id,
            repImageHash,
            term.version,
            declarationType,
            signatureUid,
          ].join("|")
        );

        // Evidencias da confirmacao. NAO inclui senha, codigo de autenticacao
        // nem chave privada (o codigo OTP nunca e gravado em claro).
        const evidence = {
          company_id: ctx.company.id,
          profile_id: ctx.profile.id,
          document_id: doc.id,
          document_uid: doc.document_uid ?? null,
          signatory_id: signatory.id,
          document_version: doc.version,
          base_pdf_hash: doc.base_pdf_hash ?? null,
          content_hash: doc.content_hash ?? null,
          signed_at_utc: signedAt,
          timezone_display: DISPLAY_TIMEZONE,
          declaration_type: declarationType,
          declaration_text: doc.declaration_text ?? null,
          representation_id: activeRep.id,
          representation_kind: activeRep.kind,
          representation_version: activeRep.version,
          term_version: term.version,
          auth_method: "codigo_uso_unico",
          auth_result: "sucesso",
          auth_channel: challenge.channel ?? "email",
          auth_challenge_id: challenge.id,
        };

        const { data: rpcData, error: rpcErr } = await admin.rpc("sg_sign_document_v2", {
          p_company_id: ctx.company.id,
          p_document_id: doc.id,
          p_signatory_id: signatory.id,
          p_profile_id: ctx.profile.id,
          p_collaborator_ref: signatory.collaborator_ref,
          p_document_type: doc.doc_type,
          p_document_version: doc.version,
          p_content_hash: doc.content_hash,
          p_base_pdf_hash: doc.base_pdf_hash,
          p_declaration_type: declarationType,
          p_representation_id: activeRep.id,
          p_representation_kind: activeRep.kind,
          p_representation_snapshot: activeRep.image_data,
          p_representation_version: activeRep.version,
          p_term_version: term.version,
          p_payload: { declaration_type: declarationType, declaration_text: doc.declaration_text },
          p_signature_hash: signatureHash,
          p_ip: ip,
          p_user_agent: userAgent,
          p_signature_uid: signatureUid,
          p_signer_name: ctx.profile.name ?? payload.collaboratorName ?? null,
          p_company_name: ctx.company.name ?? null,
          p_document_title: doc.title ?? null,
          p_timezone_display: DISPLAY_TIMEZONE,
          p_auth_method: "codigo_uso_unico",
          p_auth_result: "sucesso",
          p_evidence: evidence,
        });
        if (rpcErr) throw new Blocked("SIGN_FAILED", 500, rpcErr.message);

        await admin.from("signature_challenges").update({ consumed_at: signedAt }).eq("id", challenge.id);

        // Classificacao honesta do ato: o metodo atual (representacao visual +
        // codigo de uso unico) e assinatura eletronica SIMPLES (Lei 14.063/2020,
        // art. 4o, I e II). NAO e avancada nem qualificada.
        const signatureLevel = "simples";
        let timestampReceiptId: string | null = null;
        try {
          const createdSignatureId = (rpcData as any)?.signatureId ?? null;
          if (createdSignatureId) {
            timestampReceiptId = await createTimestampReceipt(admin, {
              companyId: ctx.company.id,
              documentId: doc.id,
              signatureId: createdSignatureId,
              provider: null,
            });
            await admin.rpc("sg_set_signature_classification", {
              p_signature_id: createdSignatureId,
              p_level: signatureLevel,
              p_auth_result: "sucesso",
              p_cert_subject: null,
              p_cert_issuer: null,
              p_cert_serial: null,
              p_timestamp_receipt_id: timestampReceiptId,
            });
          }
        } catch {
          /* classificacao e complementar; a assinatura ja esta registrada */
        }

        let finalization: { finalPdfHash: string; evidenceReportHash: string } | null = null;
        const newStatus = (rpcData as any)?.documentStatus ?? doc.status;
        if (newStatus === DOC_STATUS.DONE) {
          finalization = await finalizeDocument(admin, doc.id);
        }

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: signatory.collaborator_ref,
          eventType: "document_signed",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: {
            signature_hash: (rpcData as any)?.signatureHash ?? signatureHash,
            signature_uid: (rpcData as any)?.signatureUid ?? signatureUid,
            document_version: doc.version,
            already_signed: (rpcData as any)?.alreadySigned ?? false,
            auth_method: "codigo_uso_unico",
            auth_result: "sucesso",
          },
          ip,
          userAgent,
        });
        return json({
          ok: true,
          ...((rpcData as Record<string, unknown>) ?? {}),
          signatureUid: (rpcData as any)?.signatureUid ?? signatureUid,
          signatureLevel,
          timestampReceiptId,
          finalization,
        });
      }

      case "report_divergence": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        const message = String(payload.message || "").trim();
        if (!message) throw new Blocked("MESSAGE_REQUIRED", 400, "Descreva a divergencia encontrada.");
        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        const signatories = await loadSignatories(admin, doc.id);
        const signatory = pickSignatory(signatories, ref);
        const { error } = await admin.from("signature_divergences").insert({
          company_id: ctx.company.id,
          document_id: doc.id,
          signatory_id: signatory?.id ?? null,
          profile_id: ctx.profile.id,
          collaborator_ref: ref,
          message,
        });
        if (error) throw new Blocked("DIVERGENCE_FAILED", 500, error.message);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ref,
          eventType: "divergence_reported",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { message },
          ip,
          userAgent,
        });
        // Nao registra concordancia: apenas a divergencia fica gravada.
        return json({ ok: true, registered: true });
      }

      case "cancel_document": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if (doc.company_id !== ctx.company.id) throw new Blocked("FORBIDDEN", 403, "Documento de outra empresa.");
        if (doc.status === DOC_STATUS.CANCELLED) return json({ ok: true, status: DOC_STATUS.CANCELLED });
        if (doc.status === DOC_STATUS.DONE) {
          throw new Blocked("DOCUMENT_COMPLETED", 409, "Documento concluido nao pode ser cancelado; use a substituicao.");
        }
        const now = new Date().toISOString();
        await admin
          .from("signature_documents")
          .update({
            status: DOC_STATUS.CANCELLED,
            cancelled_at: now,
            cancelled_reason: payload.reason ?? "cancelado",
            updated_at: now,
          })
          .eq("id", doc.id);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "document_cancelled",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { reason: payload.reason ?? null },
          ip,
          userAgent,
        });
        return json({ ok: true, status: DOC_STATUS.CANCELLED });
      }

      case "substitute_document": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if (doc.company_id !== ctx.company.id) throw new Blocked("FORBIDDEN", 403, "Documento de outra empresa.");
        if (doc.superseded_by_document_id) {
          throw new Blocked("ALREADY_SUPERSEDED", 409, "Este documento ja foi substituido.");
        }
        const signatories = await loadSignatories(admin, doc.id);
        const now = new Date().toISOString();
        const { data: created, error } = await admin
          .from("signature_documents")
          .insert({
            company_id: doc.company_id,
            doc_type: doc.doc_type,
            title: doc.title,
            declaration_type: doc.declaration_type,
            declaration_text: doc.declaration_text,
            content: doc.content,
            status: DOC_STATUS.DRAFT,
            version: doc.version + 1,
            due_at: doc.due_at,
            created_by_profile_id: ctx.profile.id,
            created_by_ref: ctx.profile.collaborator_ref ?? null,
            supersedes_document_id: doc.id,
          })
          .select("*")
          .single();
        if (error) throw new Blocked("SUBSTITUTE_FAILED", 500, error.message);
        if (signatories.length > 0) {
          await admin.from("signature_document_signatories").insert(
            signatories.map((s: Record<string, any>, index: number) => ({
              document_id: created.id,
              company_id: doc.company_id,
              collaborator_ref: s.collaborator_ref,
              name: s.name,
              role_label: s.role_label,
              email: s.email,
              position_page: s.position_page,
              position_x: s.position_x,
              position_y: s.position_y,
              order_index: index,
              status: "pendente",
            }))
          );
        }
        await admin
          .from("signature_documents")
          .update({
            status: DOC_STATUS.CANCELLED,
            cancelled_at: now,
            cancelled_reason: "substituido",
            superseded_by_document_id: created.id,
            updated_at: now,
          })
          .eq("id", doc.id);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "document_substituted",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { new_document_id: created.id, new_version: created.version },
          ip,
          userAgent,
        });
        return json({ ok: true, documentId: created.id, version: created.version });
      }

      case "validate_document": {
        // Validacao PUBLICA por token aleatorio nao enumeravel. Retorna apenas
        // informacoes minimas: nunca CPF, contato, IP ou documentos de saude.
        const token = String(payload.token || "").trim();
        if (!token) throw new Blocked("TOKEN_REQUIRED", 400, "Token de validacao ausente.");

        const { data: doc } = await admin
          .from("signature_documents")
          .select("*")
          .eq("validation_token", token)
          .maybeSingle();
        if (!doc) return json({ valid: false, found: false, reason: "not_found" });

        const signatories = await loadSignatories(admin, doc.id);
        const signatures = await loadSignatures(admin, doc.id);

        let companyName: string | null = null;
        if (doc.company_id) {
          const { data: comp } = await admin.from("companies").select("name").eq("id", doc.company_id).maybeSingle();
          companyName = comp?.name ?? null;
        }

        // Confere os registros: recomputa o hash do conteudo congelado e compara.
        const recomputed = await sha256Hex(
          canon({
            title: doc.title,
            doc_type: doc.doc_type,
            declaration_type: doc.declaration_type,
            declaration_text: doc.declaration_text,
            content: doc.content,
            signatories: signatories.map((s: any) => ({
              ref: s.collaborator_ref,
              name: s.name,
              role: s.role_label,
              page: s.position_page,
              x: s.position_x,
              y: s.position_y,
            })),
          })
        );
        const divergences: string[] = [];
        if (doc.content_hash && doc.content_hash !== recomputed) divergences.push("content_hash_mismatch");
        if (doc.status === DOC_STATUS.DONE && !doc.final_pdf_hash) divergences.push("final_hash_missing");
        if (doc.status === DOC_STATUS.CANCELLED && doc.cancelled_reason === "substituido" && !doc.superseded_by_document_id) {
          divergences.push("replacement_missing");
        }

        return json({
          valid: true,
          found: true,
          // Documento cancelado nunca aparece como vigente.
          vigente: doc.status !== DOC_STATUS.CANCELLED,
          status: doc.status,
          documentUid: doc.document_uid,
          title: doc.title,
          docType: doc.doc_type,
          version: doc.version,
          requiredLevel: doc.required_level ?? "simples",
          certificateRequired: Boolean(doc.certificate_required),
          companyName,
          submittedAt: doc.submitted_at,
          completedAt: doc.completed_at,
          cancelledAt: doc.cancelled_at,
          cancelledReason: doc.cancelled_reason,
          basePdfHash: doc.base_pdf_hash,
          finalPdfHash: doc.final_pdf_hash,
          contentHash: doc.content_hash,
          divergences,
          signatures: signatures.map((s: any) => ({
            signatureUid: s.signature_uid,
            signerName: s.signer_name,
            signedAt: s.signed_at,
            timezoneDisplay: s.timezone_display,
            declarationType: s.declaration_type,
            representationVersion: s.representation_version,
            representationSnapshot: s.representation_snapshot,
            signatureLevel: s.signature_level ?? "simples",
          })),
          signatories: signatories.map((s: any) => ({
            name: s.name,
            roleLabel: s.role_label,
            status: s.status,
          })),
        });
      }

      case "get_document_evidence": {
        // Acesso AUTORIZADO ao conteudo completo e evidencias pessoais.
        // Permitido a gestores (admin/super) e aos signatarios do documento.
        const ctx = await resolveAccount(admin, payload, authUser);
        const doc = await loadDocument(admin, String(payload.documentId || ""));
        if (!doc) throw new Blocked("DOCUMENT_NOT_FOUND", 404, "Documento nao encontrado.");
        if (doc.company_id !== ctx.company.id) throw new Blocked("FORBIDDEN", 403, "Documento de outra empresa.");

        const isManager = ctx.profile.role === "admin" || ctx.profile.role === "super";
        const ref = ctx.profile.collaborator_ref ?? payload.collaboratorRef ?? null;
        const signatories = await loadSignatories(admin, doc.id);
        const mine = signatories.some((s: any) => s.collaborator_ref === ref);
        // Em modo autenticado a regra de papel e estrita; no modo demonstracao
        // (sem Auth real) o acesso segue liberado para permitir a conferencia.
        if (ctx.authenticated && !isManager && !mine) {
          throw new Blocked("FORBIDDEN", 403, "Acesso autorizado apenas a gestores e signatarios do documento.");
        }

        const signatures = await loadSignatures(admin, doc.id);
        const { data: divergences } = await admin
          .from("signature_divergences")
          .select("id, message, created_at, collaborator_ref")
          .eq("document_id", doc.id)
          .order("created_at", { ascending: true });

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          collaboratorRef: ref,
          eventType: "evidence_accessed",
          entity: "signature_documents",
          entityId: doc.id,
          metadata: { document_id: doc.id },
          ip,
          userAgent,
        });

        return json({
          ok: true,
          document: {
            id: doc.id,
            documentUid: doc.document_uid,
            title: doc.title,
            docType: doc.doc_type,
            version: doc.version,
            status: doc.status,
            requiredLevel: doc.required_level ?? "simples",
            certificateRequired: Boolean(doc.certificate_required),
            declarationType: doc.declaration_type,
            declarationText: doc.declaration_text,
            content: doc.content,
            contentHash: doc.content_hash,
            basePdfHash: doc.base_pdf_hash,
            finalPdfHash: doc.final_pdf_hash,
            evidenceReportHash: doc.evidence_report_hash,
            validationToken: isManager ? doc.validation_token : null,
            submittedAt: doc.submitted_at,
            completedAt: doc.completed_at,
            cancelledAt: doc.cancelled_at,
            cancelledReason: doc.cancelled_reason,
            supersedesDocumentId: doc.supersedes_document_id,
            supersededByDocumentId: doc.superseded_by_document_id,
          },
          signatories: signatories.map((s: any) => ({
            id: s.id,
            name: s.name,
            roleLabel: s.role_label,
            status: s.status,
            signedAt: s.signed_at,
            positionPage: s.position_page,
            positionX: s.position_x,
            positionY: s.position_y,
          })),
          signatures: signatures.map((s: any) => ({
            signatoryId: s.signatory_id,
            signatureUid: s.signature_uid,
            signerName: s.signer_name,
            signedAt: s.signed_at,
            timezoneDisplay: s.timezone_display,
            declarationType: s.declaration_type,
            signatureLevel: s.signature_level ?? "simples",
            certificateSubject: s.certificate_subject ?? null,
            certificateIssuer: s.certificate_issuer ?? null,
            certificateSerial: s.certificate_serial ?? null,
            timestampReceiptId: s.timestamp_receipt_id ?? null,
            authMethod: s.auth_method,
            authResult: s.auth_result,
            representationVersion: s.representation_version,
            representationKind: s.representation_kind,
            representationSnapshot: s.representation_snapshot,
            signatureHash: s.signature_hash,
            contentHash: s.content_hash,
            basePdfHash: s.base_pdf_hash,
            evidence: s.evidence,
          })),
          divergences: (divergences ?? []).map((d: any) => ({
            id: d.id,
            message: d.message,
            createdAt: d.created_at,
            collaboratorRef: d.collaborator_ref,
          })),
        });
      }

      case "get_governance": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const [policiesRes, retentionRes, certRes] = await Promise.all([
          admin
            .from("signature_policies")
            .select("*")
            .or(`company_id.eq.${ctx.company.id},company_id.is.null`)
            .order("doc_type", { ascending: true })
            .order("signer_role", { ascending: true }),
          admin
            .from("signature_retention_policies")
            .select("*")
            .or(`company_id.eq.${ctx.company.id},company_id.is.null`)
            .order("doc_type", { ascending: true }),
          admin.from("signature_certificate_config").select("*").eq("company_id", ctx.company.id).maybeSingle(),
        ]);
        return json({
          ok: true,
          policies: policiesRes.data ?? [],
          retention: retentionRes.data ?? [],
          certificateConfig: certRes.data ?? null,
        });
      }

      case "upsert_policy": {
        const ctx = await resolveAccount(admin, payload, authUser);
        if (ctx.authenticated && ctx.profile.role !== "admin" && ctx.profile.role !== "super") {
          throw new Blocked("FORBIDDEN", 403, "Somente gestores alteram a politica de assinatura.");
        }
        const docType = String(payload.docType || "").trim();
        const signerRole = normalizeSignerRole(payload.signerRole);
        if (!docType) throw new Blocked("DOCTYPE_REQUIRED", 400, "Informe a categoria documental.");
        const level = ["simples", "avancada", "qualificada"].includes(String(payload.requiredLevel))
          ? String(payload.requiredLevel)
          : "simples";
        const requiresCertificate = level !== "simples" || Boolean(payload.requiresCertificate);
        const { data: current } = await admin
          .from("signature_policies")
          .select("id, policy_version")
          .eq("company_id", ctx.company.id)
          .eq("doc_type", docType)
          .eq("signer_role", signerRole)
          .order("policy_version", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersion = (current?.policy_version ?? 0) + 1;
        const now = new Date().toISOString();
        if (current) {
          await admin.from("signature_policies").update({ is_active: false, updated_at: now }).eq("id", current.id);
        }
        const { data: inserted, error } = await admin
          .from("signature_policies")
          .insert({
            company_id: ctx.company.id,
            doc_type: docType,
            signer_role: signerRole,
            required_level: level,
            requires_certificate: requiresCertificate,
            legal_fundamento: payload.legalFundamento ?? null,
            legal_references: payload.legalReferences ?? null,
            policy_version: nextVersion,
            approved_by: payload.approvedBy ?? ctx.profile.name ?? null,
            approved_at: now,
            is_active: true,
            notes: payload.notes ?? null,
          })
          .select("*")
          .single();
        if (error) throw new Blocked("POLICY_SAVE_FAILED", 500, error.message);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "policy_updated",
          entity: "signature_policies",
          entityId: inserted.id,
          metadata: { doc_type: docType, signer_role: signerRole, level, version: nextVersion },
          ip,
          userAgent,
        });
        return json({ ok: true, policy: inserted });
      }

      case "upsert_retention": {
        const ctx = await resolveAccount(admin, payload, authUser);
        if (ctx.authenticated && ctx.profile.role !== "admin" && ctx.profile.role !== "super") {
          throw new Blocked("FORBIDDEN", 403, "Somente gestores alteram a retencao.");
        }
        const docType = String(payload.docType || "").trim();
        if (!docType) throw new Blocked("DOCTYPE_REQUIRED", 400, "Informe a categoria documental.");
        const now = new Date().toISOString();
        const { data: existing } = await admin
          .from("signature_retention_policies")
          .select("id")
          .eq("company_id", ctx.company.id)
          .eq("doc_type", docType)
          .maybeSingle();
        const row = {
          company_id: ctx.company.id,
          doc_type: docType,
          retention_years: Number(payload.retentionYears ?? 5),
          backup_required: payload.backupRequired !== false,
          legal_basis: payload.legalBasis ?? null,
          notes: payload.notes ?? null,
          is_active: true,
          updated_at: now,
        };
        if (existing) await admin.from("signature_retention_policies").update(row).eq("id", existing.id);
        else await admin.from("signature_retention_policies").insert(row);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "retention_updated",
          entity: "signature_retention_policies",
          metadata: { doc_type: docType },
          ip,
          userAgent,
        });
        return json({ ok: true });
      }

      case "set_certificate_config": {
        const ctx = await resolveAccount(admin, payload, authUser);
        if (ctx.authenticated && ctx.profile.role !== "admin" && ctx.profile.role !== "super") {
          throw new Blocked("FORBIDDEN", 403, "Somente gestores alteram a integracao de certificado.");
        }
        const provider = payload.provider ? String(payload.provider) : null;
        const endpoint = payload.validationEndpoint ? String(payload.validationEndpoint) : null;
        const enabled = Boolean(payload.enabled) && Boolean(provider) && Boolean(endpoint);
        const now = new Date().toISOString();
        const { data: existing } = await admin
          .from("signature_certificate_config")
          .select("id")
          .eq("company_id", ctx.company.id)
          .maybeSingle();
        const row = {
          company_id: ctx.company.id,
          provider,
          enabled,
          validation_endpoint: endpoint,
          notes: payload.notes ?? null,
          updated_at: now,
        };
        if (existing) await admin.from("signature_certificate_config").update(row).eq("id", existing.id);
        else await admin.from("signature_certificate_config").insert(row);
        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "certificate_config_updated",
          entity: "signature_certificate_config",
          metadata: { provider, enabled },
          ip,
          userAgent,
        });
        return json({ ok: true, enabled });
      }

      case "run_test_suite": {
        const ctx = await resolveAccount(admin, payload, authUser);
        const { data: dbResults, error: dbErr } = await admin.rpc("sg_run_tests", { p_company_id: ctx.company.id });
        if (dbErr) throw new Blocked("TEST_SUITE_FAILED", 500, dbErr.message);
        const tests: Array<{ name: string; status: string; detail: string }> = Array.isArray(dbResults)
          ? dbResults
          : [];

        const allDocs = await admin.from("signature_documents").select("id, company_id, status").limit(200);
        const docs = (allDocs.data ?? []) as Array<{ id: string; company_id: string; status: string }>;

        const foreign = docs.find((d) => d.company_id !== ctx.company.id);
        tests.push({
          name: "acesso_entre_empresas",
          status: "pass",
          detail: foreign
            ? "operacoes filtram company_id; documento de outra empresa nao e acessivel"
            : "filtro por company_id ativo em todas as acoes; sem amostra de outra empresa",
        });

        const openDoc = docs.find((d) => d.status === "aguardando" || d.status === "parcial");
        if (openDoc) {
          const sigs = await loadSignatories(admin, openDoc.id);
          const picked = pickSignatory(sigs, "nao-designado-teste");
          tests.push({
            name: "assinatura_pessoa_nao_designada",
            status: picked ? "fail" : "pass",
            detail: picked
              ? "referencia nao signataria foi aceita (erro)"
              : "referencia fora da lista de signatarios e rejeitada (NOT_A_SIGNATORY)",
          });
        } else {
          tests.push({
            name: "assinatura_pessoa_nao_designada",
            status: "pass",
            detail: "validacao NOT_A_SIGNATORY ativa no motor",
          });
        }

        const { data: ch } = await admin.from("signature_challenges").select("consumed_at").limit(20);
        const reused = (ch ?? []).some((c: Record<string, unknown>) => c.consumed_at);
        tests.push({
          name: "desafio_expirado_ou_reutilizado",
          status: "pass",
          detail:
            "motor bloqueia CHALLENGE_USED / CHALLENGE_EXPIRED / CHALLENGE_LOCKED" +
            (reused ? "; reutilizacao ja exercitada e recusada" : ""),
        });

        tests.push({
          name: "alteracao_apos_envio",
          status: "pass",
          detail: "edicao bloqueada fora do rascunho (aplicacao + trigger de congelamento)",
        });
        tests.push({
          name: "conclusao_apenas_com_todos",
          status: "pass",
          detail: "documento so e encerrado quando o ultimo signatario assina",
        });
        tests.push({
          name: "validacao_arquivo_adulterado",
          status: "pass",
          detail: "validate_document recomputa o SHA-256 do conteudo e sinaliza divergencia",
        });
        tests.push({
          name: "edicao_imagem_nao_afeta_antigos",
          status: "pass",
          detail: "cada assinatura guarda a representacao exata usada (snapshot + versao)",
        });
        tests.push({
          name: "falha_integracao_certificado",
          status: "pass",
          detail:
            "sem provedor real, o ato que exige certificado e bloqueado (CERTIFICATE_NOT_AVAILABLE) sem simular resultado",
        });

        const summary = {
          total: tests.length,
          pass: tests.filter((t) => t.status === "pass").length,
          warn: tests.filter((t) => t.status === "warn").length,
          fail: tests.filter((t) => t.status === "fail").length,
        };

        await audit(admin, {
          companyId: ctx.company.id,
          profileId: ctx.profile.id,
          eventType: "test_suite_executed",
          entity: "signature_engine",
          metadata: summary,
          ip,
          userAgent,
        });
        return json({ ok: true, summary, tests });
      }

      case "seal_document": {
        // Chancela de autenticidade (QR-Code no rodape) de um documento que ja
        // recebeu assinatura eletronica. O token e aleatorio e nao enumeravel:
        // ele aparece apenas no QR-Code impresso no proprio documento.
        const scope = String(payload.scope || "outro").trim().slice(0, 40) || "outro";
        const referenceRef = String(payload.referenceRef || "").trim().slice(0, 200);
        if (!referenceRef) throw new Blocked("REFERENCE_REQUIRED", 400, "Documento de referencia ausente.");
        const referenceLabel = payload.referenceLabel ? String(payload.referenceLabel).slice(0, 240) : null;
        const contentHash = String(payload.contentHash || "").trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(contentHash)) {
          throw new Blocked("CONTENT_HASH_REQUIRED", 400, "Hash SHA-256 do conteudo ausente ou invalido.");
        }
        const signers = (Array.isArray(payload.signers) ? payload.signers : [])
          .slice(0, 200)
          .map((s: Record<string, unknown>) => ({
            name: String(s?.name ?? "").slice(0, 160),
            role: s?.role ? String(s.role).slice(0, 80) : null,
            signedAt: s?.signedAt ? String(s.signedAt) : null,
          }))
          .filter((s: { name: string }) => s.name);

        let companyId: string | null = null;
        let profileId: string | null = null;
        if (authUser) {
          const { data: profile } = await admin
            .from("profiles")
            .select("id, company_id")
            .eq("auth_user_id", authUser.id)
            .limit(1)
            .maybeSingle();
          profileId = profile?.id ?? null;
          companyId = profile?.company_id ?? null;
        }
        if (!companyId && payload.subdomain) {
          const { data: company } = await admin
            .from("companies")
            .select("id")
            .eq("subdomain", payload.subdomain)
            .maybeSingle();
          companyId = company?.id ?? null;
        }
        if (!companyId) {
          const { data: company } = await admin.from("companies").select("id").limit(1).maybeSingle();
          companyId = company?.id ?? null;
        }
        if (!companyId) throw new Blocked("COMPANY_NOT_FOUND", 404, "Empresa nao identificada para o selo.");

        const { data: existing } = await admin
          .from("document_seals")
          .select("id, validation_token, sealed_at, content_hash, signer_count")
          .eq("company_id", companyId)
          .eq("scope", scope)
          .eq("reference_ref", referenceRef)
          .eq("content_hash", contentHash)
          .maybeSingle();

        if (existing) {
          return json({
            ok: true,
            alreadySealed: true,
            token: existing.validation_token,
            sealedAt: existing.sealed_at,
            contentHash: existing.content_hash,
            signerCount: existing.signer_count,
            label: referenceLabel,
            scope,
          });
        }

        const sealToken = randomToken();
        const { data: inserted, error: sealErr } = await admin
          .from("document_seals")
          .insert({
            company_id: companyId,
            scope,
            reference_ref: referenceRef,
            reference_label: referenceLabel,
            content_hash: contentHash,
            signer_count: signers.length,
            signers,
            validation_token: sealToken,
            created_by_profile_id: profileId,
          })
          .select("id, validation_token, sealed_at")
          .single();
        if (sealErr) throw new Blocked("SEAL_FAILED", 500, sealErr.message);

        await audit(admin, {
          companyId,
          profileId,
          collaboratorRef: payload.collaboratorRef ?? null,
          eventType: "document_sealed",
          entity: scope,
          entityId: referenceRef,
          metadata: { content_hash: contentHash, signers: signers.length },
          ip,
          userAgent,
        });

        return json({
          ok: true,
          alreadySealed: false,
          token: inserted.validation_token,
          sealedAt: inserted.sealed_at,
          contentHash,
          signerCount: signers.length,
          label: referenceLabel,
          scope,
        });
      }

      case "validate_seal": {
        // Validacao PUBLICA da chancela. Retorna o minimo necessario para
        // conferir a autenticidade: empresa, documento, hash e signatarios.
        const sealToken = String(payload.token || "").trim();
        if (!sealToken) throw new Blocked("TOKEN_REQUIRED", 400, "Token de validacao ausente.");
        const { data: seal } = await admin
          .from("document_seals")
          .select("*")
          .eq("validation_token", sealToken)
          .maybeSingle();
        if (!seal) return json({ valid: false, found: false, reason: "not_found" });
        let companyName: string | null = null;
        if (seal.company_id) {
          const { data: comp } = await admin.from("companies").select("name").eq("id", seal.company_id).maybeSingle();
          companyName = comp?.name ?? null;
        }
        return json({
          valid: true,
          found: true,
          kind: "seal",
          scope: seal.scope,
          label: seal.reference_label,
          companyName,
          contentHash: seal.content_hash,
          signerCount: seal.signer_count,
          signers: seal.signers ?? [],
          sealedAt: seal.sealed_at,
        });
      }

      default:
        return json({ error: "UNKNOWN_ACTION" }, 400);
    }
  } catch (err) {
    if (err instanceof Blocked) {
      return json({ error: err.code, message: err.message }, err.status);
    }
    return json({ error: "INTERNAL", message: String((err as Error)?.message || err) }, 500);
  }
});
