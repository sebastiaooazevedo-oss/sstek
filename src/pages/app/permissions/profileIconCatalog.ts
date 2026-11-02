/**
 * Catálogo visual de ícones de perfil.
 *
 * `value` é o conjunto de classes aplicado direto no <i>, então aceita tanto
 * Remix Icon (ri-*-line) quanto Font Awesome (fa-solid fa-...). Assim dá para
 * usar, por exemplo, o capacete de obra do Font Awesome, que o Remix Icon não
 * possui, mantendo o restante no traço linear do sistema.
 */
export interface ProfileIconOption {
  value: string;
  label: string;
}

export interface ProfileIconGroup {
  id: string;
  label: string;
  options: ProfileIconOption[];
}

export const profileIconGroups: ProfileIconGroup[] = [
  {
    id: "governanca",
    label: "Governança e acessos",
    options: [
      { value: "ri-shield-user-line", label: "Acessos e perfis" },
      { value: "ri-user-star-line", label: "Gestão" },
      { value: "ri-user-settings-line", label: "Administração" },
      { value: "ri-lock-2-line", label: "Acesso restrito" },
      { value: "ri-eye-line", label: "Somente visualização" },
      { value: "ri-shield-check-line", label: "Auditoria e conformidade" },
    ],
  },
  {
    id: "saude",
    label: "Saúde e segurança do trabalho",
    options: [
      { value: "fa-solid fa-helmet-safety", label: "Capacete — obra e indústria" },
      { value: "ri-stethoscope-line", label: "Saúde ocupacional / SESMT" },
      { value: "ri-heart-pulse-line", label: "Medicina do trabalho" },
      { value: "ri-first-aid-kit-line", label: "Primeiros socorros" },
      { value: "ri-shield-cross-line", label: "Técnico de segurança" },
      { value: "ri-fire-line", label: "Brigada de incêndio" },
      { value: "ri-alarm-warning-line", label: "Emergência" },
    ],
  },
  {
    id: "operacao",
    label: "Operação e campo",
    options: [
      { value: "ri-tools-line", label: "Manutenção" },
      { value: "ri-hammer-line", label: "Obra civil" },
      { value: "ri-building-2-line", label: "Indústria / fábrica" },
      { value: "ri-truck-line", label: "Transporte e logística" },
      { value: "ri-flask-line", label: "Laboratório e química" },
      { value: "ri-restaurant-line", label: "Alimentação" },
      { value: "ri-leaf-line", label: "Meio ambiente" },
      { value: "ri-clipboard-line", label: "Inspeção de campo" },
      { value: "ri-file-list-3-line", label: "Documentos" },
      { value: "ri-computer-line", label: "Tecnologia" },
      { value: "ri-bar-chart-box-line", label: "Indicadores e relatórios" },
      { value: "ri-briefcase-line", label: "Administrativo / RH" },
      { value: "ri-user-follow-line", label: "Liderança" },
      { value: "ri-team-line", label: "Equipe" },
      { value: "ri-user-heart-line", label: "Pessoas e atendimento" },
      { value: "ri-medal-line", label: "Responsável técnico" },
      { value: "ri-police-badge-line", label: "Fiscalização" },
    ],
  },
];

export const profileIconOptions: ProfileIconOption[] = profileIconGroups.flatMap(
  (group) => group.options
);

export const defaultProfileIcon = profileIconOptions[0].value;

/** Rótulo humano de um ícone já salvo (perfis antigos continuam válidos). */
export function profileIconLabel(value: string): string {
  const found = profileIconOptions.find((option) => option.value === value);
  if (found) return found.label;
  return "Ícone personalizado";
}