import { useCallback, useEffect, useState } from "react";
import { termoConsultaPadrao } from "@/pages/fiscalizacao/consultaTermo";
import {
  carregarHistoricoTermo,
  salvarTermoConsulta,
  type TermoHistoricoItem,
} from "@/pages/app/modules/config/termoConsultaAdminApi";
import { formatLogDateTime } from "@/pages/app/modules/config/systemLogStore";
import {
  setFiscalizacaoTermoLocal,
  useSystemSettings,
} from "@/pages/app/settings/settingsStore";

/**
 * Parametrização do termo LGPD exibido na consulta externa da ficha de
 * verificação.
 *
 * O texto é gravado em `company_settings.fiscalizacao_termo_lgpd` pela Edge
 * Function `fiscalizacao-termo`, portanto vale para TODOS os visitantes que
 * escanearem um QR-Code desta empresa.
 *
 * Cada alteração fica registrada no log de auditoria do sistema com o autor, a
 * data/hora e o TEXTO ANTERIOR completo — o histórico aparece logo abaixo do
 * campo, para conferência na hora.
 *
 * Campo vazio = texto padrão do sistema em uso.
 */
function HistoricoLinha({ item }: { item: TermoHistoricoItem }) {
  const [aberto, setAberto] = useState(false);
  const restaurou = !item.textoNovo;
  const anterior = item.textoAnterior.trim();

  return (
    <div className="rounded-md border border-background-200 bg-background-50 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            restaurou ? "bg-background-200 text-foreground-700" : "bg-primary-100 text-primary-800"
          }`}
        >
          <i className={restaurou ? "ri-restart-line" : "ri-edit-circle-line"}></i>
          {restaurou ? "Restaurado ao padrão" : "Termo alterado"}
        </span>
        <span className="text-[11.5px] font-semibold text-foreground-900">{item.actorName || "Não identificado"}</span>
        <span className="text-[11px] text-foreground-500">{formatLogDateTime(item.createdAt)}</span>
      </div>
      <button
        type="button"
        onClick={() => setAberto((current) => !current)}
        className="mt-1.5 inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-primary-700 hover:text-primary-800"
      >
        <i className={aberto ? "ri-eye-off-line" : "ri-eye-line"}></i>
        {aberto ? "Ocultar texto anterior" : "Ver texto anterior"}
      </button>
      {aberto && (
        <div className="mt-1.5 rounded-md border border-background-200 bg-background-100 px-3 py-2">
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-foreground-400">Texto anterior</p>
          {anterior ? (
            <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-line break-words text-[11px] leading-relaxed text-foreground-700">
              {anterior}
            </p>
          ) : (
            <p className="mt-1 text-[11px] italic leading-relaxed text-foreground-500">
              Antes desta alteração valia o texto padrão do sistema.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FiscalizacaoConsultaTermoForm() {
  const settings = useSystemSettings();
  const personalizado = settings.fiscalizacaoTermoConsulta.trim().length > 0;

  const [draft, setDraft] = useState(settings.fiscalizacaoTermoConsulta || termoConsultaPadrao);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [historico, setHistorico] = useState<TermoHistoricoItem[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings.fiscalizacaoTermoConsulta || termoConsultaPadrao);
  }, [settings.fiscalizacaoTermoConsulta]);

  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    const resultado = await carregarHistoricoTermo();
    setHistorico(resultado.registros);
    setHistoricoErro(resultado.error);
    setCarregandoHistorico(false);
  }, []);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const alterado = draft.trim() !== (settings.fiscalizacaoTermoConsulta || termoConsultaPadrao).trim();

  const salvar = async (texto: string, mensagemSucesso: string) => {
    const limpo = texto.trim();
    if (limpo.length > 0 && limpo.length < 40) {
      setFeedback({ ok: false, message: "O termo precisa ter pelo menos 40 caracteres para ser compreensível." });
      return;
    }
    setSalvando(true);
    setFeedback(null);
    const resultado = await salvarTermoConsulta(limpo);
    setSalvando(false);
    if (!resultado.ok) {
      setFeedback({ ok: false, message: resultado.error || "Não foi possível salvar o termo." });
      return;
    }

    // O servidor é a fonte da verdade: refletimos o texto gravado na tela.
    setFiscalizacaoTermoLocal(resultado.texto);
    setDraft(resultado.texto || termoConsultaPadrao);
    setFeedback({
      ok: true,
      message:
        resultado.detail ||
        (resultado.auditoria
          ? "Termo salvo e alteração registrada na auditoria."
          : mensagemSucesso),
    });
    if (resultado.alterado) await carregarHistorico();
  };

  const restaurar = async () => {
    setDraft(termoConsultaPadrao);
    await salvar("", "Texto padrão restaurado. A consulta externa volta a exibir o texto do sistema.");
  };

  return (
    <div className="p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-foreground-600">
          Este termo aparece na entrada da consulta externa, antes de qualquer dado pessoal do colaborador. O
          consultante só consegue consultar a ficha depois de ler e aceitar o texto.
        </p>
        <span
          className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
            personalizado ? "bg-primary-100 text-primary-800" : "bg-background-200 text-foreground-600"
          }`}
        >
          <i className={personalizado ? "ri-edit-circle-line" : "ri-file-text-line"}></i>
          {personalizado ? "Termo da empresa" : "Texto padrão do sistema"}
        </span>
      </div>

      <label htmlFor="termo-lgpd-consulta" className="mt-4 block text-xs font-semibold text-foreground-700">
        Termo de tratamento de dados (LGPD)
      </label>
      <textarea
        id="termo-lgpd-consulta"
        value={draft}
        rows={12}
        maxLength={6000}
        onChange={(event) => {
          setDraft(event.target.value);
          setFeedback(null);
        }}
        className="mt-1.5 w-full resize-y rounded-md border border-background-300 bg-background-50 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-foreground-800 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      />

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-foreground-400">
        <span>{draft.trim().length} de 6000 caracteres · mínimo de 40</span>
        <span>Quebras de linha são preservadas na consulta externa.</span>
      </div>

      {feedback && (
        <p
          className={`mt-3 flex items-start gap-1.5 rounded-md px-3 py-2 text-[11px] font-medium leading-relaxed ${
            feedback.ok ? "bg-primary-50 text-primary-800" : "bg-danger-100 text-danger-800"
          }`}
        >
          <i
            className={
              feedback.ok ? "ri-checkbox-circle-line mt-0.5 shrink-0" : "ri-error-warning-line mt-0.5 shrink-0"
            }
          ></i>
          {feedback.message}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-background-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-[10.5px] leading-relaxed text-foreground-400">
          Gravado na configuração da empresa no servidor: o texto vale para qualquer visitante, em qualquer
          dispositivo. Cada aceite é registrado com data/hora e o hash do texto vigente, e cada alteração entra no
          log de auditoria com autor e texto anterior.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void restaurar()}
            disabled={salvando || !personalizado}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ri-restart-line"></i>
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={() =>
              void salvar(draft, "Termo salvo no servidor. A consulta externa passa a exibir este texto.")
            }
            disabled={!alterado || salvando}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-600 px-3.5 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className={salvando ? "ri-loader-4-line animate-spin" : "ri-save-3-line"}></i>
            {salvando ? "Salvando..." : "Salvar termo"}
          </button>
        </div>
      </div>

      {/* Histórico de alterações (auditoria) */}
      <div className="mt-4 rounded-lg border border-background-200 bg-background-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <i className="ri-history-line text-sm text-secondary-800"></i>
            <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-600">
              Histórico de alterações do termo
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregarHistorico()}
            disabled={carregandoHistorico}
            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-semibold text-foreground-600 transition-colors hover:bg-background-200 disabled:opacity-50"
          >
            <i className={`ri-refresh-line ${carregandoHistorico ? "animate-spin" : ""}`}></i>
            Atualizar
          </button>
        </div>

        <div className="space-y-2 p-3">
          {carregandoHistorico ? (
            <p className="flex items-center gap-2 px-1 py-2 text-[11px] text-foreground-500">
              <i className="ri-loader-4-line animate-spin"></i>
              Carregando o histórico do termo...
            </p>
          ) : historicoErro ? (
            <p className="flex items-start gap-1.5 px-1 py-2 text-[11px] leading-relaxed text-foreground-500">
              <i className="ri-information-line mt-0.5 shrink-0"></i>
              {historicoErro}
            </p>
          ) : historico.length === 0 ? (
            <p className="px-1 py-2 text-[11px] leading-relaxed text-foreground-500">
              Nenhuma alteração registrada ainda. Ao salvar um novo texto, aparecem aqui o autor, a data/hora e o
              texto anterior completo.
            </p>
          ) : (
            historico.map((item) => <HistoricoLinha key={item.id} item={item} />)
          )}
        </div>

        <p className="border-t border-background-200 px-4 py-2.5 text-[10.5px] leading-relaxed text-foreground-400">
          O registro é gravado pelo servidor na auditoria do sistema (Configurações → Logs do sistema, tipo
          “QR-Codes e ficha de verificação”). Somente administradores da empresa podem alterar o termo.
        </p>
      </div>
    </div>
  );
}