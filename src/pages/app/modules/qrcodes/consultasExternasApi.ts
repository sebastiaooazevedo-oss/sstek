import { supabase } from "@/lib/supabase";
import { formatCpf } from "@/pages/fiscalizacao/cpf";
import { protocoloDaConsulta } from "@shared/consulta";

/**
 * Leitura das consultas externas registradas pelo QR-Code.
 *
 * A tabela `fiscalizacao_consultas` só aceita INSERT pela Edge Function
 * `fiscalizacao-consulta` (chave de serviço). Aqui o navegador só LÊ, e o RLS
 * limita as linhas à empresa do usuário logado (`is_company_member`).
 */

export interface ConsultaExterna {
  id: string;
  /** Protocolo mostrado ao consultante (mesma regra do servidor). */
  protocolo: string;
  /** Código do QR lido — nunca a URL completa. */
  codigoQr: string;
  colaboradorRef: string | null;
  nome: string;
  orgao: string;
  /** CPF do consultante como gravado (somente dígitos). */
  cpf: string;
  finalidade: string;
  /** `true` quando a empresa já usava termo próprio no momento do aceite. */
  termoPersonalizado: boolean;
  createdAt: string;
}

const CONSULTAS_COLUMNS =
  "id, codigo_qr, colaborador_ref, consultante_nome, consultante_orgao, consultante_cpf, finalidade, termo_personalizado, created_at";

interface ConsultaRow {
  id: string;
  codigo_qr: string | null;
  colaborador_ref: string | null;
  consultante_nome: string | null;
  consultante_orgao: string | null;
  consultante_cpf: string | null;
  finalidade: string | null;
  termo_personalizado: boolean | null;
  created_at: string | null;
}

function mapRow(row: ConsultaRow): ConsultaExterna {
  return {
    id: String(row.id),
    protocolo: protocoloDaConsulta(String(row.id)),
    codigoQr: String(row.codigo_qr ?? ""),
    colaboradorRef: row.colaborador_ref ? String(row.colaborador_ref) : null,
    nome: String(row.consultante_nome ?? ""),
    orgao: String(row.consultante_orgao ?? ""),
    cpf: String(row.consultante_cpf ?? ""),
    finalidade: String(row.finalidade ?? ""),
    termoPersonalizado: row.termo_personalizado === true,
    createdAt: String(row.created_at ?? ""),
  };
}

export interface ConsultasResult {
  data: ConsultaExterna[];
  error: string | null;
}

export async function fetchConsultasExternas(limit = 800): Promise<ConsultasResult> {
  try {
    const { data, error } = await supabase
      .from("fiscalizacao_consultas")
      .select(CONSULTAS_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return { data: (data ?? []).map((row) => mapRow(row as ConsultaRow)), error: null };
  } catch (error) {
    return {
      data: [],
      error:
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível carregar as consultas externas.",
    };
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** ISO → DD/MM/AAAA HH:mm. */
export function formatConsultaDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/** ISO → DD/MM/AAAA. */
export function formatConsultaDate(value: string): string {
  const full = formatConsultaDateTime(value);
  return full === "—" ? full : full.slice(0, 10);
}

/** CPF do consultante no formato 000.000.000-00. */
export function formatConsultaCpf(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "—";
  return formatCpf(digits);
}

/** `true` quando a data ISO cai no dia de hoje (fuso do navegador). */
export function isToday(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

// Período e paginação vêm do núcleo compartilhado (também usados por Veículos).
export {
  dentroDoPeriodo,
  paginar,
  periodoInicio,
  periodoLabels,
  TAMANHOS_PAGINA,
  type ConsultaPeriodo,
  type Pagina,
  type TamanhoPagina,
} from "@/core/listing";

export interface TotalPorOrgao {
  orgao: string;
  total: number;
}

/** Contagem de consultas por órgão, da maior para a menor. */
export function totalPorOrgao(consultas: ConsultaExterna[]): TotalPorOrgao[] {
  const mapa = new Map<string, number>();
  consultas.forEach((consulta) => {
    const chave = consulta.orgao.trim() || "Não informado";
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  });
  return Array.from(mapa.entries())
    .map(([orgao, total]) => ({ orgao, total }))
    .sort((a, b) => b.total - a.total || a.orgao.localeCompare(b.orgao));
}
