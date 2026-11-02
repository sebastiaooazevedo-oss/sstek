import { useEffect, useState } from "react";

/**
 * Identificador do QR-Code de fiscalização.
 *
 * Regras que este arquivo garante:
 *
 * 1. O QR-Code é PERSISTENTE. Ele não muda por leitura, por expiração de
 *    sessão, por atualização cadastral nem por publicação do sistema. Só muda
 *    por uma renovação explícita, com permissão, motivo e registro em log.
 * 2. Nenhum código existente é substituído silenciosamente. Os códigos que já
 *    estão impressos em campo (referências legadas, ex.: `c-001`) continuam
 *    valendo exatamente como estão. Só colaboradores que receberem um código
 *    novo passam a usar o identificador opaco.
 * 3. O identificador é aleatório e não deriva de CPF, matrícula, nome ou
 *    qualquer referência previsível.
 *
 * LIMITE HONESTO DESTE MÓDULO: a persistência é local ao navegador
 * administrativo. Rotação atômica, revogação de sessões e registro em log
 * imutável exigem o backend de sessão, que ainda NÃO está implementado. Por
 * isso a rotação aqui é tratada como operação administrativa pendente de
 * confirmação no servidor — nunca como controle de segurança concluído.
 */

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 16;

const STORAGE_PREFIX = "sstek:qr:";
const STORAGE_VERSION = "v1";

export interface QrIdentifierRecord {
  /** Valor que aparece na URL do QR (nunca derivado de dado pessoal). */
  code: string;
  /** Versão do código: 1 é o primeiro código opaco emitido. */
  version: number;
  /** Data/hora da emissão (ISO). */
  issuedAt: string;
  /** Quem emitiu (nome do usuário administrativo). */
  issuedBy: string;
  /** Motivo da emissão/renovação. */
  reason: string;
}

export interface QrRenewalLogEntry {
  id: string;
  company: string;
  collaboratorId: string;
  collaboratorName: string;
  actor: string;
  reason: string;
  at: string;
  result: "renovado_neste_ambiente";
  previousCode: string;
  newCode: string;
}

interface TenantState {
  version: number;
  /** colaboradorId → código opaco vigente. */
  identifiers: Record<string, QrIdentifierRecord>;
  /** Histórico de renovações (mais recente primeiro). */
  log: QrRenewalLogEntry[];
}

/** Referências no formato antigo (`c-001`, `colab-12`) — já impressas em campo. */
const LEGACY_PATTERN = /^[a-z]{1,6}-\d{1,6}$/i;

export function isLegacyCollaboratorId(value: string): boolean {
  return LEGACY_PATTERN.test((value || "").trim());
}

/** Código opaco de 16 caracteres (~80 bits) gerado pelo CSPRNG do navegador. */
export function generateOpaqueCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  let out = "";
  for (let index = 0; index < bytes.length; index += 1) {
    out += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return out;
}

const cache = new Map<string, TenantState>();
const listeners = new Map<string, Set<() => void>>();

const EMPTY_STATE: TenantState = { version: 0, identifiers: {}, log: [] };

function storageKey(tenant: string): string {
  return `${STORAGE_PREFIX}${STORAGE_VERSION}:${(tenant || "sem-empresa").toLowerCase()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseState(raw: unknown): TenantState {
  if (!isRecord(raw)) return { ...EMPTY_STATE };
  const identifiers: Record<string, QrIdentifierRecord> = {};
  if (isRecord(raw.identifiers)) {
    Object.entries(raw.identifiers).forEach(([key, value]) => {
      if (!isRecord(value)) return;
      const code = typeof value.code === "string" ? value.code : "";
      if (!code) return;
      identifiers[key] = {
        code,
        version: Number(value.version) || 1,
        issuedAt: typeof value.issuedAt === "string" ? value.issuedAt : "",
        issuedBy: typeof value.issuedBy === "string" ? value.issuedBy : "",
        reason: typeof value.reason === "string" ? value.reason : "",
      };
    });
  }
  const log: QrRenewalLogEntry[] = Array.isArray(raw.log)
    ? raw.log.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const newCode = typeof entry.newCode === "string" ? entry.newCode : "";
        if (!newCode) return [];
        return [
          {
            id: typeof entry.id === "string" ? entry.id : newCode,
            company: typeof entry.company === "string" ? entry.company : "",
            collaboratorId: typeof entry.collaboratorId === "string" ? entry.collaboratorId : "",
            collaboratorName: typeof entry.collaboratorName === "string" ? entry.collaboratorName : "",
            actor: typeof entry.actor === "string" ? entry.actor : "",
            reason: typeof entry.reason === "string" ? entry.reason : "",
            at: typeof entry.at === "string" ? entry.at : "",
            result: "renovado_neste_ambiente",
            previousCode: typeof entry.previousCode === "string" ? entry.previousCode : "",
            newCode,
          },
        ];
      })
    : [];
  const version = Number(raw.version) || 0;
  return { version, identifiers, log };
}

/** Lê o estado do tenant (memória → armazenamento local). */
export function readQrState(tenant: string): TenantState {
  const key = (tenant || "").toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  let state: TenantState = { ...EMPTY_STATE };
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (raw) state = parseState(JSON.parse(raw) as unknown);
  } catch {
    state = { ...EMPTY_STATE };
  }
  cache.set(key, state);
  return state;
}

function persist(tenant: string, state: TenantState): void {
  const key = (tenant || "").toLowerCase();
  cache.set(key, state);
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(state));
  } catch {
    // Sem armazenamento disponível a sessão continua em memória.
  }
  const set = listeners.get(key);
  if (set) set.forEach((listener) => listener());
}

export function subscribeQrState(tenant: string, listener: () => void): () => void {
  const key = (tenant || "").toLowerCase();
  const set = listeners.get(key) ?? new Set<() => void>();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
  };
}

export interface ResolvedQrCode {
  code: string;
  /** `true` quando o código é o identificador opaco novo. */
  opaque: boolean;
  kind: "legacy" | "opaque";
  version: number;
  issuedAt: string;
  issuedBy: string;
  reason: string;
}

/**
 * Resolve o código que vai dentro do QR.
 *
 * Sem registro de identificador opaco, devolve a referência original SEM
 * alterar nada — é o que mantém os adesivos já impressos válidos.
 */
export function resolveQrCode(tenant: string, collaboratorId: string): ResolvedQrCode {
  const record = readQrState(tenant).identifiers[collaboratorId];
  if (record) {
    return {
      code: record.code,
      opaque: true,
      kind: "opaque",
      version: record.version,
      issuedAt: record.issuedAt,
      issuedBy: record.issuedBy,
      reason: record.reason,
    };
  }
  return {
    code: collaboratorId,
    opaque: false,
    kind: "legacy",
    version: 0,
    issuedAt: "",
    issuedBy: "",
    reason: "",
  };
}

/** Quantos colaboradores já usam identificador opaco nesta empresa. */
export function countOpaqueIdentifiers(tenant: string): number {
  return Object.keys(readQrState(tenant).identifiers).length;
}

export interface RenewQrInput {
  tenant: string;
  collaboratorId: string;
  collaboratorName: string;
  /** Nome do usuário administrativo autenticado. */
  actor: string;
  /** Motivo obrigatório — a renovação nunca é anônima. */
  reason: string;
}

export class QrRenewalError extends Error {}

/**
 * Renova o código do colaborador.
 *
 * Substitui o identificador de forma atômica no armazenamento local: o código
 * anterior deixa de ser o vigente e só existe UM código por colaborador. O
 * histórico guarda os identificadores internos anterior e novo, quem renovou,
 * quando e por quê — nunca URLs completas ou tokens.
 */
export function renewQrCode(input: RenewQrInput): QrIdentifierRecord {
  const reason = (input.reason || "").trim();
  if (reason.length < 10) {
    throw new QrRenewalError("Informe o motivo da renovação com pelo menos 10 caracteres.");
  }
  const actor = (input.actor || "").trim();
  if (!actor) {
    throw new QrRenewalError("Não foi possível identificar o usuário responsável pela renovação.");
  }

  const state = readQrState(input.tenant);
  const previous = resolveQrCode(input.tenant, input.collaboratorId);
  const record: QrIdentifierRecord = {
    code: generateOpaqueCode(),
    version: previous.version + 1,
    issuedAt: new Date().toISOString(),
    issuedBy: actor,
    reason,
  };

  const logEntry: QrRenewalLogEntry = {
    id: `${input.collaboratorId}-${record.code}`,
    company: input.tenant,
    collaboratorId: input.collaboratorId,
    collaboratorName: input.collaboratorName,
    actor,
    reason,
    at: record.issuedAt,
    result: "renovado_neste_ambiente",
    previousCode: previous.code,
    newCode: record.code,
  };

  persist(input.tenant, {
    version: state.version + 1,
    identifiers: { ...state.identifiers, [input.collaboratorId]: record },
    log: [logEntry, ...state.log].slice(0, 500),
  });

  return record;
}

/** Hook reativo: atualiza todos os QR-Codes quando um código é renovado. */
export function useQrIdentifiers(tenant: string): { version: number; log: QrRenewalLogEntry[] } {
  const [snapshot, setSnapshot] = useState(() => readQrState(tenant));

  useEffect(() => {
    setSnapshot(readQrState(tenant));
    return subscribeQrState(tenant, () => setSnapshot(readQrState(tenant)));
  }, [tenant]);

  return { version: snapshot.version, log: snapshot.log };
}