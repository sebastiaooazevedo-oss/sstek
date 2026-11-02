import { useState } from "react";

const profiles = [
  {
    id: "super",
    name: "Super Administrador",
    icon: "ri-shield-star-line",
    color: "accent",
    summary:
      "Controla toda a plataforma SSTEK: empresas, subdomínios, licenças e a parametrização de cada recurso por perfil.",
    abilities: [
      "Parametrizar o sistema, ativando ou desativando recursos por perfil",
      "Cadastrar empresas e subir a logomarca que será aplicada ao tenant",
      "Importar base de colaboradores por upload de arquivo .xlsx",
      "Gerenciar licenças S1/S2/S3, mensalidades e bloqueio por inadimplência",
      "Criar perfis personalizados e definir o que cada um pode acessar",
    ],
  },
  {
    id: "admin",
    name: "Administrador",
    icon: "ri-admin-line",
    color: "primary",
    summary:
      "Opera a rotina de SST da empresa: colaboradores, documentos, treinamentos, EPIs e relatórios.",
    abilities: [
      "Cadastrar colaboradores com dados cadastrais completos e foto",
      "Anexar documentos do colaborador (ASO, PPP, EPC, certificados, atestados)",
      "Anexar documentos da empresa (PCMSO, LTCAT, PGR, AET, Mapa de Risco, APR)",
      "Filtrar documentos por nome e função e imprimir em lotes",
      "Imprimir QR-Codes de colaboradores de forma individual ou em lote",
    ],
  },
  {
    id: "colab",
    name: "Colaborador",
    icon: "ri-user-line",
    color: "secondary",
    summary:
      "Acompanha a própria vida funcional em segurança, com autonomia e transparência sobre seus documentos.",
    abilities: [
      "Editar os próprios dados cadastrais",
      "Alterar a senha de acesso",
      "Baixar todos os documentos registrados",
      "Receber alertas de vencimento de documentos e exames",
      "Visualizar todos os documentos cadastrados (sem permissão de exclusão)",
    ],
  },
];

const colorMap: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  accent: { bg: "bg-accent-100", text: "text-accent-900", ring: "border-accent-300", dot: "bg-accent-500" },
  primary: { bg: "bg-primary-100", text: "text-primary-800", ring: "border-primary-300", dot: "bg-primary-500" },
  secondary: {
    bg: "bg-secondary-100",
    text: "text-secondary-900",
    ring: "border-secondary-300",
    dot: "bg-secondary-500",
  },
};

export default function Profiles() {
  const [activeId, setActiveId] = useState("super");
  const active = profiles.find((p) => p.id === activeId) || profiles[0];
  const colors = colorMap[active.color];

  return (
    <section id="perfis" className="bg-background-50 px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
            Perfis de acesso
          </span>
          <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-4xl">
            Cada pessoa vê exatamente o que precisa
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground-600 md:text-base">
            Permissões granulares por perfil. Você decide o que é liberado, e o sistema garante que ninguém
            acesse além do permitido.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setActiveId(profile.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeId === profile.id
                  ? "bg-foreground-950 text-background-50"
                  : "bg-background-100 text-foreground-700 hover:bg-background-200"
              }`}
            >
              <i className={`${profile.icon} text-base`}></i>
              {profile.name}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 rounded-lg border border-background-200 bg-background-100 p-6 md:p-10 lg:grid-cols-2">
          <div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-lg ${colors.bg} ${colors.text}`}>
              <i className={`${active.icon} text-3xl`}></i>
            </div>
            <h3 className="mt-5 font-heading text-xl font-extrabold text-foreground-950 md:text-2xl">
              {active.name}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground-600 md:text-base">{active.summary}</p>
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3">
              <i className="ri-lock-2-line text-lg text-primary-600"></i>
              <span className="text-xs text-foreground-600 md:text-sm">
                Permissões configuráveis pelo Super Administrador
              </span>
            </div>
          </div>

          <ul className="flex flex-col gap-3.5">
            {active.abilities.map((ability) => (
              <li
                key={ability}
                className="flex items-start gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3.5"
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${colors.dot}`}>
                  <i className="ri-check-line text-xs text-background-50"></i>
                </span>
                <span className="text-sm leading-relaxed text-foreground-700">{ability}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}