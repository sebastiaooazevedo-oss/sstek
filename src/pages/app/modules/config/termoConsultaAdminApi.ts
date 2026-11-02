import { supabase } from "@/lib/supabase";

/**
 * Parametrização do termo LGPD da consulta externa — leitura e gravação.
 *
 * A gravação passa pela Edge Function `fiscalizacao-termo`, que:
 * - valida o usuário logado e confere se ele é administrador da empresa;
 * - grava o texto em `company_settings.fiscalizacao_termo_lgpd`;
 * - registra a alteração em `system_audit_logs` com o AUTOR e o TEXTO ANTERIOR
 *   completo.
 *
 * A tabela de auditoria nega escrita direta pelo navegador (é proposital), por
 * isso essa operação não pode ser feita como um `upsert` comum.
 */

export interface TermoHistoricoItem {
  id: string;
  action: string;
  /** Texto que valia antes da alteração (vazio = padrão do sistema). */
  textoAnterior: string;
  /** Texto gravado (vazio = restauração ao padrão). */
  textoNovo: string;
  actorName: string;
  detail: string;
  createdAt: string;
}

export interface SalvarTermoResult {
  ok: boolean;
  texto: string;
  alterado: boolean;
  auditoria: boolean;
  error: string | null;
  detail: string;
}

interface SalvarResponse {
  ok?: boolean;
  texto?: string;
  alterado?: boolean;
  auditoria?: boolean;
  detail?: string;
  error?: string;
}

interface HistoricoResponse {
  ok?: boolean;
  registros?: Array<{
    id?: string;
    action?: string;
    textoAnterior?: string;
    textoNovo?: string;
    actorName?: string;
    detail?: string;
    createdAt?: string;
  }>;
  error?: string;
  detail?: string;
}

async function detalheDoErro(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== "function") return null;
  try {
    const body = (await context.json()) as { detail?: string };
    return body?.detail ? String(body.detail) : null;
  } catch {
    return null;
  }
}

/** Grava o termo no servidor e registra a alteração na auditoria. */
export async function salvarTermoConsulta(texto: string): Promise<SalvarTermoResult> {
  const falha = (mensagem: string): SalvarTermoResult => ({
    ok: false,
    texto: "",
    alterado: false,
    auditoria: false,
    error: mensagem,
    detail: mensagem,
  });

  try {
    const { data, error } = await supabase.functions.invoke<SalvarResponse>("fiscalizacao-termo", {
      body: { acao: "salvar", texto },
    });

    if (error) {
      const detalhe = await detalheDoErro(error);
      return falha(detalhe || "Não foi possível salvar o termo no servidor.");
    }
    if (!data?.ok) {
      return falha(String(data?.detail ?? "Não foi possível salvar o termo no servidor."));
    }

    return {
      ok: true,
      texto: String(data.texto ?? ""),
      alterado: data.alterado === true,
      auditoria: data.auditoria === true,
      error: null,
      detail: String(data.detail ?? ""),
    };
  } catch {
    return falha("Sem conexão com o servidor. Verifique a internet e tente novamente.");
  }
}

/** Últimas alterações do termo, com autor e texto anterior. */
export async function carregarHistoricoTermo(): Promise<{
  registros: TermoHistoricoItem[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke<HistoricoResponse>("fiscalizacao-termo", {
      body: { acao: "historico" },
    });

    if (error) {
      const detalhe = await detalheDoErro(error);
      return { registros: [], error: detalhe || "Não foi possível carregar o histórico do termo." };
    }
    if (!data?.ok) {
      return {
        registros: [],
        error: String(data?.detail ?? "Não foi possível carregar o histórico do termo."),
      };
    }

    const registros = (data.registros ?? []).map((item) => ({
      id: String(item.id ?? ""),
      action: String(item.action ?? ""),
      textoAnterior: String(item.textoAnterior ?? ""),
      textoNovo: String(item.textoNovo ?? ""),
      actorName: String(item.actorName ?? ""),
      detail: String(item.detail ?? ""),
      createdAt: String(item.createdAt ?? ""),
    }));

    return { registros, error: null };
  } catch {
    return { registros: [], error: "Sem conexão com o servidor para carregar o histórico." };
  }
}