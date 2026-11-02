import { Link, useLocation } from "react-router-dom";
import AppBrandLogo from "@/components/base/AppBrandLogo";
import type { RoleId } from "@/mocks/app";
import { navSectionsFor } from "@/core/modules/registry";
import { tenantHost } from "@/core/domain";
import { isModuleEnabled, useSystemSettings } from "@/pages/app/settings/settingsStore";
import { moduleIdByNavId } from "@/pages/app/settings/modules";
import { permissionForNav } from "@/pages/app/permissions/accessControl";
import { isPermissionGranted, useEffectiveAccess } from "@/pages/app/permissions/permissionStore";
import { useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import {
  directedDocumentsFor,
  useDocumentAcknowledgements,
} from "@/pages/app/modules/documentos/documentAckStore";
import {
  useCurrentRegulation,
  useRegulationSignatures,
} from "@/pages/app/modules/regulamento/regulationStore";
import {
  openSurveysFor,
  useSurveyResponses,
  useSurveys,
} from "@/pages/app/modules/pesquisas/surveyStore";

interface AppSidebarProps {
  role: RoleId;
  subdomain: string;
  company: string;
  open: boolean;
  onClose: () => void;
}

export default function AppSidebar({ role, subdomain, company, open, onClose }: AppSidebarProps) {
  const location = useLocation();
  const settings = useSystemSettings();
  const { access } = useEffectiveAccess();
  const session = useAppSession();
  const documents = useDocuments();
  const currentCollaborator = collaborators.find((c) => c.name === session.name);
  const acknowledgedDocIds = useDocumentAcknowledgements(
    session.subdomain,
    currentCollaborator?.id ?? null
  );
  const unreadDirectedDocs = directedDocumentsFor(documents, currentCollaborator?.id).filter(
    (doc) => !acknowledgedDocIds.includes(doc.id)
  ).length;
  // Regulamento vigente ainda sem a assinatura de ciência do colaborador.
  const currentRegulation = useCurrentRegulation();
  const regulationSignatures = useRegulationSignatures();
  const pendingRegulation = Boolean(
    currentRegulation &&
      currentCollaborator &&
      !regulationSignatures.some(
        (sig) =>
          sig.regulationId === currentRegulation.id &&
          sig.collaboratorId === currentCollaborator.id
      )
  );
  // Pesquisas vigentes direcionadas ao colaborador que ainda não foram respondidas.
  const surveys = useSurveys();
  const surveyResponses = useSurveyResponses();
  const pendingSurveys = currentCollaborator
    ? openSurveysFor(surveys, surveyResponses, currentCollaborator, session.subdomain).length
    : 0;
  // Remove do menu os itens de módulos não contratados pela empresa e as telas
  // que a matriz "Perfis & permissões" não libera para o perfil logado.
  const sections = navSectionsFor(role)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const moduleId = moduleIdByNavId[item.id];
        if (moduleId && !isModuleEnabled(settings, moduleId)) return false;
        return isPermissionGranted(access, permissionForNav(item.id, role));
      }),
    }))
    .filter((section) => section.items.length > 0);
  const current = location.pathname === "/app" ? "dashboard" : location.pathname.replace("/app/", "");

  const isActive = (id: string) => current === id;
  const to = (id: string) => (id === "dashboard" ? "/app" : `/app/${id}`);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-foreground-950/50 lg:hidden"
        ></button>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-primary-200 bg-primary-50 transition-transform duration-300 dark:border-primary-900 dark:bg-primary-950 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex shrink-0 items-center justify-center border-b border-primary-200 px-6 py-5 dark:border-primary-900">
          <Link
            to="/app"
            onClick={onClose}
            aria-label="Ir para o painel"
            className="flex items-center justify-center transition-opacity hover:opacity-80"
          >
            <AppBrandLogo className="h-12 max-w-[190px] lg:h-14" />
          </Link>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={onClose}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-primary-700 hover:bg-primary-100 dark:text-primary-200 dark:hover:bg-primary-900 lg:hidden"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="border-b border-primary-200 px-5 py-4 dark:border-primary-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200">
              <i className="ri-building-2-line text-lg"></i>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary-900 dark:text-primary-50">{company}</p>
              <p className="flex items-center gap-1 truncate text-xs text-primary-600 dark:text-primary-300">
                <i className="ri-global-line"></i>
                {tenantHost(subdomain)}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                {section.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.id);
                  // O badge de Alertas reflete os documentos novos direcionados
                  // ao colaborador (some conforme ele visualiza).
                  const badge =
                    item.id === "alertas" && role === "colaborador"
                      ? unreadDirectedDocs > 0
                        ? String(unreadDirectedDocs)
                        : undefined
                      : item.id === "regulamento" && role === "colaborador"
                        ? pendingRegulation
                          ? "1"
                          : undefined
                        : item.id === "pesquisas" && role === "colaborador"
                          ? pendingSurveys > 0
                            ? String(pendingSurveys)
                            : undefined
                          : undefined;
                  return (
                    <li key={item.id}>
                      <Link
                        to={to(item.id)}
                        onClick={onClose}
                        className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary-600 text-primary-50"
                            : "text-foreground-700 hover:bg-primary-100 hover:text-primary-900 dark:text-primary-100 dark:hover:bg-primary-900 dark:hover:text-primary-50"
                        }`}
                      >
                        <i
                          className={`${item.icon} text-lg ${
                            active
                              ? "text-primary-50"
                              : "text-primary-600 group-hover:text-primary-800 dark:text-primary-300 dark:group-hover:text-primary-100"
                          }`}
                        ></i>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge && (
                          <span
                            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                              active ? "bg-primary-50 text-primary-700" : "bg-accent-500 text-accent-950"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-primary-200 p-4 dark:border-primary-900">
          <div className="rounded-lg border border-primary-200 bg-primary-100 p-4 dark:border-primary-900 dark:bg-primary-900/60">
            <p className="flex items-center gap-2 text-xs font-semibold text-primary-900 dark:text-primary-50">
              <i className="ri-shield-check-line text-primary-600 dark:text-primary-300"></i>
              Sessão verificada
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-primary-700 dark:text-primary-300">
              Perfil e empresa validados no servidor. Você vê apenas os dados da sua empresa.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}