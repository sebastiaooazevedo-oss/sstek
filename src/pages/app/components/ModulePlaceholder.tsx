import { useParams } from "react-router-dom";
import { roleLabels } from "@/mocks/app";
import { navSectionsFor } from "@/core/modules/registry";
import { useAppSession } from "@/pages/app/context";
import { tenantHost } from "@/core/domain";

const moduleInfo: Record<string, { icon: string; title: string; text: string }> = {
  empresas: { icon: "ri-building-2-line", title: "Empresas & subdomínios", text: "Cadastro de tenants, aplicação da logomarca, subdomínio exclusivo e gestão de contratos." },
  parametrizacao: { icon: "ri-equalizer-line", title: "Parametrização por perfil", text: "Ative ou desative recursos do sistema para cada perfil de acesso da plataforma." },
  perfis: { icon: "ri-shield-user-line", title: "Perfis & permissões", text: "Crie perfis personalizados e defina exatamente o que cada um pode acessar." },
  licencas: { icon: "ri-bank-card-line", title: "Licenças & planos", text: "Planos S1, S2 e S3, cobrança recorrente e adicional por usuário extra." },
  pagamentos: { icon: "ri-wallet-3-line", title: "Pagamentos", text: "Histórico de mensalidades, faturas e controle financeiro por empresa." },
  inadimplencia: { icon: "ri-alarm-warning-line", title: "Inadimplência", text: "Dias de atraso configuráveis e bloqueio automático de acesso por inadimplência." },
  bases: { icon: "ri-file-upload-line", title: "Bases de colaboradores", text: "Importação em massa por planilha .xlsx com as colunas do banco de dados." },
  qrlogs: { icon: "ri-qr-scan-2-line", title: "QR-Codes & logs", text: "Histórico de escaneamentos com data, hora e dados do aparelho leitor." },
  auditoria: { icon: "ri-history-line", title: "Auditoria do sistema", text: "Trilha completa de ações realizadas na plataforma." },
  config: { icon: "ri-settings-3-line", title: "Configurações", text: "Parâmetros gerais do sistema e da empresa contratante." },
  colaboradores: { icon: "ri-team-line", title: "Colaboradores", text: "Cadastro completo, ficha do colaborador, função, PIS, CTPS e importação por .xlsx." },
  documentos: { icon: "ri-file-list-3-line", title: "Documentos", text: "Documentos da empresa e do colaborador, filtros e impressão em lote." },
  epi: { icon: "ri-shirt-line", title: "Ficha de EPI", text: "Entrega de EPI com CA, registro por foto opcional e aceite por assinatura." },
  apr: { icon: "ri-clipboard-line", title: "APR", text: "Análise Preliminar de Risco com parametrização e aceite digital." },
  treinamentos: { icon: "ri-award-line", title: "Treinamentos", text: "Certificados de treinamento, validade e alertas de reciclagem." },
  qrcodes: { icon: "ri-qr-scan-2-line", title: "QR-Codes de fiscalização", text: "Impressão individual ou em lote dos QR-Codes dos colaboradores." },
  relatorios: { icon: "ri-bar-chart-box-line", title: "Relatórios", text: "Relatórios estratégicos de conformidade, documentos e indicadores." },
  meusdados: { icon: "ri-user-settings-line", title: "Meus dados", text: "Edite seus dados cadastrais e mantenha suas informações atualizadas." },
  meusdocumentos: { icon: "ri-file-list-3-line", title: "Meus documentos", text: "Visualize e baixe todos os documentos registrados no seu nome." },
  minhaepi: { icon: "ri-shirt-line", title: "Minha ficha de EPI", text: "Consulte os EPIs recebidos, o CA e a validade de cada item." },
  meustreinamentos: { icon: "ri-award-line", title: "Meus treinamentos", text: "Acompanhe seus treinamentos ativos, vencidos e a validade." },
  alertas: { icon: "ri-notification-3-line", title: "Alertas", text: "Receba avisos de vencimento de documentos, exames e treinamentos." },
  seguranca: { icon: "ri-lock-password-line", title: "Segurança e senha", text: "Altere sua senha de acesso e revise as configurações de segurança." },
};

export default function ModulePlaceholder() {
  const { module } = useParams();
  const session = useAppSession();
  const key = module || "";
  const info = moduleInfo[key];

  const fallbackSection = navSectionsFor(session.role)
    .flatMap((s) => s.items)
    .find((i) => i.id === key);

  const icon = info?.icon || fallbackSection?.icon || "ri-layout-grid-line";
  const title = info?.title || fallbackSection?.label || "Módulo";
  const text = info?.text || "Este módulo faz parte do sistema SSTEK e será construído em breve.";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-lg border border-background-200 bg-background-50 p-8 md:p-12">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className={`${icon} text-3xl`}></i>
          </span>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-600">{text}</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: "ri-shield-check-line", text: "Permissões herdadas do perfil" },
            { icon: "ri-database-2-line", text: "Dados isolados por empresa" },
            { icon: "ri-smartphone-line", text: "Responsivo e acessível" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 rounded-lg border border-background-200 bg-background-100 px-4 py-3.5">
              <i className={`${item.icon} text-lg text-secondary-700`}></i>
              <span className="text-sm text-foreground-700">{item.text}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-foreground-500">
          Você está acessando como <strong className="font-semibold text-foreground-700">{roleLabels[session.role]}</strong> ·{" "}
          {tenantHost(session.subdomain)}
        </p>
      </div>
    </div>
  );
}