import { Link } from "react-router-dom";
import AccessUsersPanel from "@/pages/app/modules/config/AccessUsersPanel";
import BrandingUpload from "@/pages/app/modules/config/BrandingUpload";
import CaepiCatalogReadOnly from "@/pages/app/modules/config/CaepiCatalogReadOnly";
import CompanyDataForm from "@/pages/app/modules/config/CompanyDataForm";
import EpiReplacementSlaForm from "@/pages/app/modules/config/EpiReplacementSlaForm";
import FiscalizacaoConsultaTermoForm from "@/pages/app/modules/config/FiscalizacaoConsultaTermoForm";
import LeadershipForm from "@/pages/app/modules/config/LeadershipForm";
import DocumentPolicyForm from "@/pages/app/modules/config/DocumentPolicyForm";
import DocumentExpiryAlertSettings from "@/pages/app/modules/config/DocumentExpiryAlertSettings";
import DocumentRenewalSlaSettings from "@/pages/app/modules/config/DocumentRenewalSlaSettings";
import ModuleSettings from "@/pages/app/modules/config/ModuleSettings";
import MoodAttentionSettings from "@/pages/app/modules/config/MoodAttentionSettings";
import MedicalCertificateAlertSettings from "@/pages/app/modules/config/MedicalCertificateAlertSettings";
import SystemLogPanel from "@/pages/app/modules/config/SystemLogPanel";
import { updateSetting, useSettingsSaveError, useSystemSettings } from "@/pages/app/settings/settingsStore";

export default function ConfigPage() {
  const settings = useSystemSettings();
  const saveError = useSettingsSaveError();

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cabeçalho */}
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
          <i className="ri-settings-3-line"></i>
          Sistema
        </p>
        <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
          Configurações
        </h1>
        <p className="mt-1.5 text-sm text-foreground-600">
          Parametrize o comportamento do sistema e a identidade visual da empresa. As alterações valem para os
          usuários desta empresa.
        </p>
      </div>

      {saveError && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent-300 bg-accent-50 px-4 py-3 text-xs text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>
            <strong className="font-semibold">As configurações não foram salvas.</strong> {saveError}
          </span>
        </div>
      )}

      {/* Dados da empresa */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-building-2-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Dados da empresa</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Razão social, CNPJ e responsável técnico aplicados no cabeçalho e nas assinaturas dos relatórios.
            </p>
          </div>
        </div>

        <CompanyDataForm />
      </section>

      {/* Identidade visual */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className="ri-image-2-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Identidade visual</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Logo da empresa e papel timbrado aplicados no sistema e nas exportações.
            </p>
          </div>
        </div>

        <BrandingUpload
          kind="logo"
          title="Logo da empresa"
          description="Exibida no topo do sistema após o acesso. O arquivo fica em uma pasta privada da sua empresa e é aberto por link temporário — não é público na internet."
          hint="PNG, JPG ou SVG · até 5 MB"
          allowedTypes={["image/png", "image/jpeg", "image/svg+xml"]}
          allowedLabel="PNG, JPG ou SVG"
          value={settings.logoUrl}
          previewClass="h-28"
        />

        <div className="border-t border-background-200">
          <BrandingUpload
            kind="letterhead"
            title="Papel timbrado"
            description="Aplicado no cabeçalho de todas as exportações de relatórios em PDF do sistema (relatórios, laudos, fichas e listas). Também fica na pasta privada da empresa."
            hint="PNG ou JPG · recomendado fundo branco, largura mínima de 1200 px"
            allowedTypes={["image/png", "image/jpeg"]}
            allowedLabel="PNG ou JPG"
            value={settings.letterheadUrl}
            previewClass="h-28"
          />
        </div>
      </section>

      {/* Usuários de acesso */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-shield-user-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Usuários de acesso</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Quem pode entrar no sistema pela sua empresa. O administrador principal é gerenciado pelo
              superadministrador da plataforma.
            </p>
          </div>
        </div>

        <AccessUsersPanel />
      </section>

      {/* Perfis & permissões */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-user-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Perfis &amp; permissões</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Crie perfis por função e defina quem pode subir, visualizar ou excluir arquivos, incluir colaboradores,
              criar CIPA, DDS, lista de presença e demais recursos.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-foreground-600">
            Os perfis e as permissões valem somente para esta empresa. Cada usuário com acesso ao sistema pode ser
            alocado em um perfil, e o menu, as telas e os botões passam a obedecer ao que foi liberado.
          </p>
          <Link
            to="/app/perfis"
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-700"
          >
            <i className="ri-equalizer-line"></i>
            Gerenciar perfis
          </Link>
        </div>
      </section>

      {/* Parametrização · Termo da consulta externa (LGPD) */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-keyhole-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">
              Termo da consulta externa (LGPD)
            </h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Texto de aceite exibido a quem consulta a ficha de verificação pelo QR-Code. Vale para todos os
              visitantes.
            </p>
          </div>
        </div>

        <FiscalizacaoConsultaTermoForm />
      </section>

      {/* Parametrização · Ficha de EPI */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shirt-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Ficha de EPI</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Regras aplicadas ao cadastro e à entrega de equipamentos de proteção.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground-900">
                Validar se o CA está ativo no cadastro
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  settings.validarCaAtivoNoEpi
                    ? "bg-primary-100 text-primary-700"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                {settings.validarCaAtivoNoEpi ? "Ativado" : "Desativado"}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
              Quando ativado, o sistema bloqueia a inclusão de um EPI cujo Certificado de Aprovação (CA) esteja
              inativo na Ficha de EPI. Quando desativado, o cadastro é permitido mesmo com o CA inativo.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.validarCaAtivoNoEpi}
            aria-label="Validar se o CA está ativo no cadastro de EPI"
            onClick={() => updateSetting("validarCaAtivoNoEpi", !settings.validarCaAtivoNoEpi)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              settings.validarCaAtivoNoEpi ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform dark:bg-background-950 ${
                settings.validarCaAtivoNoEpi ? "translate-x-6" : "translate-x-1"
              }`}
            ></span>
          </button>
        </div>

        <div className="flex items-start gap-2.5 border-t border-background-200 bg-background-100 px-5 py-3.5 text-xs text-foreground-600">
          <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
          <span>
            Os CAs inativos podem ser consultados normalmente (com emissão do laudo técnico), mas não podem ser
            lançados em novas entregas enquanto esta validação estiver ativada.
          </span>
        </div>

        <div className="flex flex-col gap-4 border-t border-background-200 p-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground-900">
                Permitir adicionar EPI com CA não encontrado
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  settings.permitirCaNaoEncontrado
                    ? "bg-primary-100 text-primary-700"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                {settings.permitirCaNaoEncontrado ? "Ativado" : "Desativado"}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
              Quando o número do CA informado não for localizado na consulta ao portal oficial do CAEPI, o sistema
              bloqueia a inclusão do equipamento na entrega — a menos que esta opção esteja ativada.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.permitirCaNaoEncontrado}
            aria-label="Permitir adicionar EPI com CA não encontrado"
            onClick={() => updateSetting("permitirCaNaoEncontrado", !settings.permitirCaNaoEncontrado)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              settings.permitirCaNaoEncontrado ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform dark:bg-background-950 ${
                settings.permitirCaNaoEncontrado ? "translate-x-6" : "translate-x-1"
              }`}
            ></span>
          </button>
        </div>

        <div className="flex flex-col gap-4 border-t border-background-200 p-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground-900">Permitir adicionar EPI com CA vencido</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  settings.permitirCaVencido
                    ? "bg-primary-100 text-primary-700"
                    : "bg-background-200 text-foreground-600"
                }`}
              >
                {settings.permitirCaVencido ? "Ativado" : "Desativado"}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
              Quando a consulta ao portal oficial indicar que o Certificado de Aprovação está vencido/inativo, o
              sistema bloqueia a inclusão do equipamento na entrega — a menos que esta opção esteja ativada.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.permitirCaVencido}
            aria-label="Permitir adicionar EPI com CA vencido"
            onClick={() => updateSetting("permitirCaVencido", !settings.permitirCaVencido)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              settings.permitirCaVencido ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-background-50 transition-transform dark:bg-background-950 ${
                settings.permitirCaVencido ? "translate-x-6" : "translate-x-1"
              }`}
            ></span>
          </button>
        </div>
      </section>

      <CaepiCatalogReadOnly />

      {/* Parametrização · Prazos de atendimento de EPI */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-timer-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Prazos de atendimento de EPI</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Defina em quantas horas o SESMT deve atender cada tipo de pedido de substituição. Pedidos atrasados
              ficam destacados no painel e no sino do administrador.
            </p>
          </div>
        </div>

        <EpiReplacementSlaForm />
      </section>

      {/* Parametrização · Hierarquia de liderança */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-800">
            <i className="ri-node-tree text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Hierarquia de liderança</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Defina quais perfis podem alocar líderes e o líder responsável por cada área/setor.
            </p>
          </div>
        </div>

        <LeadershipForm />
      </section>

      {/* Parametrização · Exclusão de documentos */}
      <section className="mt-6 overflow-hidden rounded-lg border border-background-200 bg-background-50">
        <div className="flex items-center gap-3 border-b border-background-200 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
            <i className="ri-delete-bin-6-line text-lg"></i>
          </span>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground-950">Exclusão de documentos</h2>
            <p className="mt-0.5 text-xs text-foreground-500">
              Defina quais perfis podem excluir documentos assinados (como as fichas de EPI do colaborador).
            </p>
          </div>
        </div>

        <DocumentPolicyForm />
      </section>

      {/* Parametrização · Alertas de vencimento de documentos */}
      <DocumentExpiryAlertSettings />

      {/* Parametrização · Prazo (SLA) de renovação de documentos */}
      <DocumentRenewalSlaSettings />

      {/* Parametrização · Atenção no sentimento da equipe */}
      <MoodAttentionSettings />

      {/* Parametrização · Alerta de afastamento prolongado */}
      <MedicalCertificateAlertSettings />

      {/* Parametrização · Módulos contratados */}
      <ModuleSettings />

      {/* Auditoria · Logs do sistema */}
      <SystemLogPanel />
    </div>
  );
}