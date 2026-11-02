import { supabase } from "@/lib/supabase";

/**
 * Cliente da ficha pública de fiscalização.
 *
 * A página é aberta sem login, e o RLS bloqueia leitura anônima das tabelas.
 * Por isso os dados chegam por uma função do backend que devolve apenas o
 * necessário para a fiscalização em campo (com CPF mascarado).
 */

export type FiscalizacaoEpiStatus = "Ativo" | "Vencendo" | "Vencido";

export interface FiscalizacaoPublicEpi {
  id: string;
  epi: string;
  ca: string;
  delivered: string;
  expires: string;
  status: FiscalizacaoEpiStatus;
}

export interface FiscalizacaoPublicCompany {
  name: string;
  subdomain: string;
  cnpj: string;
  legalName: string;
  technicalResponsible: string;
  technicalRegistration: string;
  sesmtPhone: string;
  letterheadUrl: string;
}

export interface FiscalizacaoPublicCollaborator {
  ref: string;
  name: string;
  role: string;
  area: string;
  establishment: string;
  status: string;
  photo: string;
  admissionDate: string;
  cpfMasked: string;
  documentsOk: number;
  documentsTotal: number;
  trainingsActive: number;
  trainingsExpired: number;
  episInUse: number;
}

export interface FiscalizacaoPublicPayload {
  company: FiscalizacaoPublicCompany;
  collaborator: FiscalizacaoPublicCollaborator | null;
  epis: FiscalizacaoPublicEpi[];
}

interface RawResponse {
  ok?: boolean;
  error?: string;
  company?: FiscalizacaoPublicCompany;
  collaborator?: FiscalizacaoPublicCollaborator | null;
  epis?: FiscalizacaoPublicEpi[];
}

function isMissing(error: { message?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("failed to send") || message.includes("not found") || message.includes("fetch");
}

/**
 * Busca a ficha do colaborador pelo QR-Code.
 * Devolve `null` quando a empresa existe mas o colaborador não.
 */
export async function fetchFiscalizacaoPublica(
  subdomain: string,
  ref: string,
): Promise<FiscalizacaoPublicPayload | null> {
  const cleanSubdomain = (subdomain || "").trim().toLowerCase();
  const cleanRef = (ref || "").trim();
  if (!cleanSubdomain || !cleanRef) throw new Error("QR-Code sem empresa identificada.");

  const { data, error } = await supabase.functions.invoke("fiscalizacao-publica", {
    body: { subdomain: cleanSubdomain, ref: cleanRef },
  });

  if (error) {
    // A função responde 503 com um código estável quando a consulta pública
    // está temporariamente travada. Lemos o corpo para exibir a mensagem
    // correta em vez de um erro genérico.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.clone === "function") {
      try {
        const body = (await context.clone().json()) as RawResponse | null;
        if (body?.error === "public_access_temporarily_disabled") {
          throw new Error(
            "A consulta pública por QR-Code está temporariamente indisponível. O adesivo continua válido e nenhum cadastro foi apagado.",
          );
        }
      } catch (cause) {
        if (cause instanceof Error && cause.message.startsWith("A consulta pública")) throw cause;
      }
    }
    if (isMissing(error)) throw new Error("Não foi possível consultar a ficha agora.");
    throw new Error("Não foi possível consultar a ficha agora.");
  }

  const payload = (data ?? null) as RawResponse | null;
  if (!payload?.ok) {
    if (payload?.error === "public_access_temporarily_disabled") {
      throw new Error(
        "A consulta pública por QR-Code está temporariamente indisponível. O adesivo continua válido e nenhum cadastro foi apagado.",
      );
    }
    if (payload?.error === "company_not_found") {
      throw new Error("Empresa não encontrada para este QR-Code.");
    }
    throw new Error("Não foi possível consultar a ficha agora.");
  }

  const company = payload.company;
  if (!company) throw new Error("Não foi possível consultar a ficha agora.");

  if (!payload.collaborator) return null;

  return {
    company,
    collaborator: payload.collaborator,
    epis: Array.isArray(payload.epis) ? payload.epis : [],
  };
}