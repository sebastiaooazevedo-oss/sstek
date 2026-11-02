import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppBrandLogo from "@/components/base/AppBrandLogo";
import { useAuth } from "@/pages/app/auth/authProvider";
import { getInitials, useAppSession } from "@/pages/app/context";
import { roleLabels } from "@/mocks/app";
import { collaborators } from "@/mocks/collaborators";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { useMedicalCertificates } from "@/pages/app/modules/meusdocumentos/medicalCertificateStore";
import { useAprs } from "@/pages/app/modules/apr/aprStore";
import { useActions, useAtas, useCipas, useElections, useInspections, useMeetings } from "@/pages/app/modules/cipa/cipaStore";
import { buildCipaAlerts } from "@/pages/app/modules/cipa/cipaAlerts";
import { ensureRequiredApprovers } from "@/pages/app/modules/cipa/cipaUtils";
import { useTechnicalResponsible } from "@/pages/app/modules/cipa/technicalResponsible";
import { useTechnicalSignatures } from "@/pages/app/modules/cipa/technicalSignatureStore";
import { useEpis } from "@/pages/app/modules/epi/epiStore";
import { useEpiReplacementRequests } from "@/pages/app/modules/epi/replacementStore";
import { replacementDeadline } from "@/pages/app/modules/epi/replacementSla";
import { useSignatures } from "@/pages/app/signature/signatureStore";
import { useSignatureDocuments } from "@/pages/app/signature/documentStore";
import { useDocuments } from "@/pages/app/modules/documentos/documentsStore";
import { useStructuredDocuments } from "@/pages/app/modules/documentos/structured/structuredStore";
import { catPendingItems } from "@/pages/app/modules/documentos/structured/cat/catInvestigation";
import { onlyDigits } from "@/pages/app/modules/documentos/structured/cat/catData";
import { subordinatesOf, useLeadership } from "@/pages/app/modules/leadership/leadershipStore";
import type { CatPayload } from "@/pages/app/modules/documentos/structured/structuredTypes";
import {
  renewalDueSoonInfo,
  renewalIdleInfo,
  renewalSlaInfo,
  useRenewalRequests,
} from "@/pages/app/modules/documentos/renewalStore";
import { daysUntilExpiry } from "@/pages/app/modules/documentos/documentUtils";
import { useDocumentExpiryAlertConfig } from "@/pages/app/modules/documentos/documentExpiryAlertStore";
import {
  directedDocumentsFor,
  useDocumentAcknowledgements,
} from "@/pages/app/modules/documentos/documentAckStore";
import {
  useCurrentRegulation,
  useRegulationSignatures,
} from "@/pages/app/modules/regulamento/regulationStore";
import { resolveMoodActor, todayIso } from "@/pages/app/mood/moodUtils";
import { teamMoods, useMoodState } from "@/pages/app/mood/moodStore";
import { pendingMoodAlerts } from "@/pages/app/mood/moodAttention";
import { useMoodFollowups } from "@/pages/app/mood/moodFollowupStore";
import { clearExportHistory, useExportHistory } from "@/pages/app/utils/exportHistory";
import { isModuleEnabled, useSystemSettings } from "@/pages/app/settings/settingsStore";
import {
  openSurveysFor,
  useSurveyResponses,
  useSurveys,
} from "@/pages/app/modules/pesquisas/surveyStore";
import {
  daysUntilEnd,
  isReminderDue,
  useSurveyReminderDays,
} from "@/pages/app/modules/pesquisas/surveyReminders";
import { formatSurveyDateTime } from "@/pages/app/modules/pesquisas/surveyTypes";
import { setThemePreference, toggleTheme, useThemePreference, type ThemePreference } from "@/pages/app/utils/theme";
import {
  markNotificationsRead,
  useReadNotificationIds,
} from "@/pages/app/components/notificationReadStore";

interface AppTopbarProps {
  onOpenMenu: () => void;
}

interface TopbarNotification {
  id: string;
  icon: string;
  tone: string;
  title: string;
  when: string;
  to?: string;
  /**
   * Aviso que exige uma ação do usuário (assinar, dar aceite, responder
   * pesquisa, ler o regulamento...). Estes NÃO desaparecem ao abrir o sino:
   * só saem quando a ação é realmente concluída.
   */
  actionRequired?: boolean;
}

const themeModes: { id: ThemePreference; label: string; icon: string }[] = [
  { id: "light", label: "Claro", icon: "ri-sun-line" },
  { id: "dark", label: "Escuro", icon: "ri-moon-line" },
  { id: "system", label: "Automático", icon: "ri-contrast-2-line" },
];

const baseNotifications: TopbarNotification[] = [];

function formatExportTime(at: number): string {
  return new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatIsoDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

interface SearchResult {
  id: string;
  label: string;
  meta: string;
  icon: string;
  to: string;
}

export default function AppTopbar({ onOpenMenu }: AppTopbarProps) {
  const session = useAppSession();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const preference = useThemePreference();
  const activeThemeMode = themeModes.find((m) => m.id === preference) ?? themeModes[2];
  const exportHistory = useExportHistory();
  const aprs = useAprs();
  const epis = useEpis();
  const replacementRequests = useEpiReplacementRequests();
  const cipas = useCipas();
  const cipaMeetings = useMeetings();
  const cipaActions = useActions();
  const cipaAtas = useAtas();
  const cipaElections = useElections();
  const cipaInspections = useInspections();
  const technicalResponsible = useTechnicalResponsible();
  const technicalSignatures = useTechnicalSignatures();
  const signatures = useSignatures();
  const signatureDocuments = useSignatureDocuments();
  const documents = useDocuments();
  // CATs emitidas: o sino cobra o nº oficial e o recibo de entrega ao trabalhador.
  const structuredRecords = useStructuredDocuments();
  const renewalRequests = useRenewalRequests();
  const registeredCollaborators = useCollaboratorsList();
  const leadership = useLeadership();
  const medicalCertificates = useMedicalCertificates();
  const currentCollaborator = useMemo(
    () =>
      registeredCollaborators.find((c) => c.name === session.name) ||
      registeredCollaborators.find(
        (c) => c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()
      ) ||
      collaborators.find((c) => c.name === session.name),
    [registeredCollaborators, session.name, session.email]
  );
  // Documentos direcionados ao colaborador que ainda não foram visualizados.
  // Ao abrir o documento, a ciência é registrada e a notificação desaparece.
  const acknowledgedDocIds = useDocumentAcknowledgements(
    session.subdomain,
    currentCollaborator?.id ?? null
  );
  const unreadDirectedDocs = useMemo(
    () =>
      directedDocumentsFor(documents, currentCollaborator?.id).filter(
        (doc) => !acknowledgedDocIds.includes(doc.id)
      ),
    [documents, currentCollaborator?.id, acknowledgedDocIds]
  );
  // Pesquisas vigentes direcionadas ao colaborador e ainda não respondidas.
  const surveys = useSurveys();
  const surveyResponses = useSurveyResponses();
  const pendingSurveys = useMemo(
    () =>
      currentCollaborator
        ? openSurveysFor(surveys, surveyResponses, currentCollaborator, session.subdomain)
        : [],
    [surveys, surveyResponses, currentCollaborator, session.subdomain]
  );
  const currentRegulation = useCurrentRegulation();
  const regulationSignatures = useRegulationSignatures();
  const regulationPending = Boolean(
    currentRegulation &&
      currentCollaborator &&
      !regulationSignatures.some(
        (sig) =>
          sig.regulationId === currentRegulation.id &&
          sig.collaboratorId === currentCollaborator.id
      )
  );
  // Liderança: quem está sob a responsabilidade do usuário (por nome no
  // cadastro ou por área/setor). O sino também cobra as pendências da equipe.
  const leaderTeam = useMemo(() => {
    const me =
      collaborators.find((c) => c.name === session.name) ||
      collaborators.find(
        (c) => c.email && session.email && c.email.toLowerCase() === session.email.toLowerCase()
      );
    return me ? subordinatesOf(me.id) : [];
  }, [session.name, session.email, leadership]);
  // Identidades dos liderados: id do cadastro (demo e banco) e CPF, para casar
  // a CAT mesmo quando ela foi preenchida com o nome digitado à mão.
  const leaderCatScope = useMemo(() => {
    const ids = new Set<string>();
    const cpfs = new Set<string>();
    const push = (id?: string, cpf?: string) => {
      if (id) ids.add(id);
      const digits = onlyDigits(cpf || "");
      if (digits.length === 11) cpfs.add(digits);
    };
    leaderTeam.forEach((member) => {
      push(member.id, member.cpf);
      const match = registeredCollaborators.find(
        (c) =>
          (c.email && member.email && c.email.toLowerCase() === member.email.toLowerCase()) ||
          (c.cpf && member.cpf && onlyDigits(c.cpf) === onlyDigits(member.cpf)) ||
          c.name === member.name
      );
      if (match) push(match.id, match.cpf);
    });
    return { ids, cpfs };
  }, [leaderTeam, registeredCollaborators]);
  const [openMenu, setOpenMenu] = useState<"none" | "notif" | "history" | "profile">("none");
  // Guarda a lista exibida no momento da abertura do sino, para que os avisos
  // informativos não sumam na frente do usuário enquanto ele lê.
  const [notifSnapshot, setNotifSnapshot] = useState<TopbarNotification[] | null>(null);
  const surveyReminderDays = useSurveyReminderDays();
  const settings = useSystemSettings();
  const expiryAlertConfig = useDocumentExpiryAlertConfig();
  // Janela de antecedência definida na parametrização de documentos.
  const expiryAlertDays = Math.max(1, Math.round(expiryAlertConfig.daysBefore));
  // Dias sem movimentação para a tratativa ser considerada parada.
  const renewalIdleDays = Math.max(1, Math.round(settings.documentRenewalIdleDays));
  // Antecedência do aviso de prazo próximo ao responsável da tratativa (0 = desligado).
  const renewalWarningDays = Math.max(0, Math.round(settings.documentRenewalSlaWarningDays));
  // Antecedência do aviso de prazo próximo ao gestor (janela independente).
  const renewalManagerWarningDays = Math.max(
    0,
    Math.round(settings.documentRenewalManagerWarningDays)
  );
  const cipaEnabled = isModuleEnabled(settings, "cipa");
  const wrapRef = useRef<HTMLDivElement>(null);

  const moodActor = useMemo(() => resolveMoodActor(session), [session]);
  const moodState = useMoodState();
  const moodFollowups = useMoodFollowups();

  // Busca do topo: no perfil do colaborador ela procura os documentos ligados
  // a ele (contrato, ficha, atestados e documentos emitidos no seu nome).
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const collaboratorSearchResults = useMemo<SearchResult[]>(() => {
    if (session.role !== "colaborador" || !currentCollaborator) return [];
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 2) return [];

    const candidates: SearchResult[] = [
      {
        id: "contrato",
        label: "Contrato de Trabalho",
        meta: "Documento pessoal · consulta e download",
        icon: "ri-file-user-line",
        to: "/app/meusdocumentos?doc=contrato",
      },
      {
        id: "ficha",
        label: "Ficha Cadastral",
        meta: "Documento pessoal · dados e vínculo",
        icon: "ri-id-card-line",
        to: "/app/meusdocumentos?doc=ficha",
      },
      ...medicalCertificates
        .filter((cert) => cert.collaboratorId === currentCollaborator.id)
        .map((cert) => ({
          id: `cert-${cert.id}`,
          label: cert.certificateType,
          meta: `Atestado de ${formatIsoDate(cert.issuedOn)} · CID ${cert.cid || "—"}`,
          icon: "ri-stethoscope-line",
          to: `/app/meusdocumentos?cert=${cert.id}`,
        })),
      ...documents
        .filter((doc) => doc.collaboratorId === currentCollaborator.id && doc.visibleToCollaborator)
        .map((doc) => ({
          id: `doc-${doc.id}`,
          label: doc.name,
          meta: `${doc.typeName} · emitido em ${doc.issuedAt || "—"}`,
          icon: "ri-file-text-line",
          to: `/app/meusdocumentos?document=${doc.id}`,
        })),
    ];

    return candidates
      .filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [session.role, currentCollaborator, searchTerm, medicalCertificates, documents]);

  const notifications = useMemo<TopbarNotification[]>(() => {
    // Alerta operacional: sentimento negativo no último registro sem
    // acolhimento registrado pelo gestor. Some sozinho quando o
    // acompanhamento é salvo na ficha do colaborador.
    const pendingMoodCases = pendingMoodAlerts(
      teamMoods(moodState.rows, moodActor),
      moodFollowups.rows,
      todayIso()
    );
    const moodAlerts: TopbarNotification[] =
      pendingMoodCases.length > 0
        ? [
            {
              id: "sentimento-atencao",
              icon: "ri-user-heart-line",
              tone: "text-accent-700 dark:text-accent-300",
              title: `${pendingMoodCases.length} colaborador(es) com sentimento negativo sem acolhimento`,
              when:
                pendingMoodCases.length === 1
                  ? `${pendingMoodCases[0].person.userName} · aguardando acolhimento`
                  : "Últimos 7 dias · requer atenção",
              to:
                pendingMoodCases.length === 1
                  ? `/app/sentimento?pessoa=${encodeURIComponent(pendingMoodCases[0].person.userKey)}`
                  : "/app/sentimento?tab=attention",
              actionRequired: true,
            },
          ]
        : [];

    // Aviso informativo para a gestão: atestado médico cadastrado pelo
    // colaborador. Atestados com afastamento igual ou acima do limite
    // configurado saem desta lista e viram o alerta dedicado abaixo, para não
    // duplicar o mesmo fato no sino.
    const leaveAlertDays = Math.max(1, settings.certificateLeaveAlertDays);
    const isLongLeave = (cert: { leaveDays: number }) => (cert.leaveDays || 0) >= leaveAlertDays;
    const isManagement = session.role === "admin" || session.role === "super";

    const certificateNotifications: TopbarNotification[] = isManagement
      ? medicalCertificates
          .filter((cert) => !isLongLeave(cert))
          .slice(0, 5)
          .map((cert) => ({
            id: `atestado-${cert.id}`,
            icon: "ri-stethoscope-line",
            tone: "text-primary-600 dark:text-primary-300",
            title: `Atestado médico cadastrado · ${cert.collaboratorName}`,
            when: `${cert.certificateType} · ${formatIsoDate(cert.issuedOn)}${
              cert.leaveDays > 0 ? ` · ${cert.leaveDays} dia(s) de afastamento` : ""
            }`,
            to: `/app/colaboradores?colaborador=${encodeURIComponent(cert.collaboratorId)}`,
          }))
      : [];

    // Alerta operacional de afastamento prolongado: a partir do limite
    // parametrizado, a gestão precisa se planejar (cobertura da função,
    // retorno previsto e acompanhamento do caso).
    const longLeaveNotifications: TopbarNotification[] = isManagement
      ? medicalCertificates
          .filter(isLongLeave)
          .slice(0, 5)
          .map((cert) => ({
            id: `atestado-longo-${cert.id}`,
            icon: "ri-alarm-warning-line",
            tone: "text-accent-700 dark:text-accent-300",
            title: `Afastamento prolongado · ${cert.collaboratorName} · ${cert.leaveDays} dias`,
            when: `${cert.certificateType} · ${formatIsoDate(cert.issuedOn)}${
              cert.establishment ? ` · ${cert.establishment}` : ""
            } · acima de ${leaveAlertDays} dia(s)`,
            to: `/app/colaboradores?colaborador=${encodeURIComponent(cert.collaboratorId)}`,
          }))
      : [];

    // Alerta de vencimento dos documentos: a gestão acompanha toda a base; o
    // colaborador acompanha apenas os documentos emitidos no nome dele.
    const scopedDocs = isManagement
      ? documents
      : documents.filter((doc) => doc.collaboratorId === currentCollaborator?.id);
    const expiredDocs = scopedDocs.filter((doc) => {
      const days = daysUntilExpiry(doc.expiresAt);
      return days !== null && days < 0;
    });
    const soonDocs = scopedDocs.filter((doc) => {
      const days = daysUntilExpiry(doc.expiresAt);
      return days !== null && days >= 0 && days <= expiryAlertDays;
    });
    const expiryNotifications: TopbarNotification[] = [];
    if (expiredDocs.length > 0) {
      expiryNotifications.push({
        id: "documentos-vencidos",
        icon: "ri-alarm-warning-line",
        tone: "text-accent-700 dark:text-accent-300",
        title: `${expiredDocs.length} documento(s) com validade vencida`,
        when: expiredDocs
          .slice(0, 2)
          .map((doc) => doc.typeName)
          .join(" · "),
        to: isManagement ? "/app/documentos" : "/app/meusdocumentos",
        actionRequired: true,
      });
    }
    if (soonDocs.length > 0) {
      expiryNotifications.push({
        id: "documentos-vencendo",
        icon: "ri-timer-line",
        tone: "text-accent-700 dark:text-accent-300",
        title: `${soonDocs.length} documento(s) vencendo em até ${expiryAlertDays} dias`,
        when: soonDocs
          .slice(0, 2)
          .map((doc) => doc.typeName)
          .join(" · "),
        to: isManagement ? "/app/documentos" : "/app/meusdocumentos",
        actionRequired: true,
      });
    }

    const directedNotifications: TopbarNotification[] =
      session.role === "colaborador"
        ? unreadDirectedDocs.map((doc) => ({
            id: `doc-direcionado-${doc.id}`,
            icon: "ri-file-text-line",
            tone: "text-primary-600 dark:text-primary-300",
            title: `Novo documento para você: ${doc.name}`,
            when: `emitido em ${doc.issuedAt || "hoje"}`,
            to: `/app/alertas?doc=${encodeURIComponent(doc.id)}`,
            actionRequired: true,
          }))
        : [];

    const surveyNotifications: TopbarNotification[] =
      session.role === "colaborador"
        ? pendingSurveys.map((survey) => ({
            id: `pesquisa-${survey.id}`,
            icon: "ri-survey-line",
            tone: "text-secondary-700 dark:text-secondary-300",
            title: `Nova pesquisa para você: ${survey.title}`,
            when: `disponível até ${formatSurveyDateTime(survey.endAt)}`,
            to: "/app/pesquisas",
            actionRequired: true,
          }))
        : [];

    // Lembrete automático: avisa quem ainda não respondeu quando o prazo se aproxima.
    const surveyReminderNotifications: TopbarNotification[] =
      session.role === "colaborador"
        ? pendingSurveys
            .filter((survey) => isReminderDue(survey, surveyReminderDays))
            .map((survey) => {
              const left = daysUntilEnd(survey.endAt);
              return {
                id: `pesquisa-lembrete-${survey.id}`,
                icon: "ri-alarm-warning-line",
                tone: "text-accent-700 dark:text-accent-300",
                title:
                  left <= 0
                    ? `Último dia para responder: ${survey.title}`
                    : `Faltam ${left} dia(s) para responder: ${survey.title}`,
                when: `encerra em ${formatSurveyDateTime(survey.endAt)}`,
                to: "/app/pesquisas",
                actionRequired: true,
              };
            })
        : [];

    const regulationNotifications: TopbarNotification[] =
      session.role === "colaborador" && regulationPending && currentRegulation
        ? [
            {
              id: "regulamento-pendente",
              icon: "ri-book-read-line",
              tone: "text-primary-600 dark:text-primary-300",
              title: `Regulamento Interno v${currentRegulation.version} aguardando sua leitura e assinatura`,
              when: "requer atenção",
              to: "/app/regulamento",
              actionRequired: true,
            },
          ]
        : [];

    const roleAlerts: TopbarNotification[] = [];

    // Pendências de assinatura do Responsável Técnico: atas e documentos
    // técnicos (ficha da CIPA, inspeções e dossiê eleitoral). O administrador
    // acompanha; o próprio RT recebe o aviso como ação obrigatória.
    const signedByRt = (
      scope: "ficha-cipa" | "inspecao-cipa" | "dossie-eleicao",
      ref: string
    ) => technicalSignatures.some((s) => s.scope === scope && s.referenceRef === ref);

    const rtPendingAtas = technicalResponsible
      ? cipaAtas.filter((ata) => {
          const prepared = ensureRequiredApprovers(ata, cipas.find((c) => c.id === ata.cipaId), {
            role: "Responsável Técnico",
            name: technicalResponsible.name,
            collaboratorId: technicalResponsible.collaboratorId,
          });
          const rt = prepared.approvals.find((a) => a.role === "Responsável Técnico");
          return Boolean(rt) && !rt.signedAt && !rt.representationSnapshot;
        })
      : [];

    const rtPendingDocuments = technicalResponsible
      ? [
          ...cipas.filter((c) => !signedByRt("ficha-cipa", c.id)).map((c) => c.name),
          ...cipaInspections.filter((i) => !signedByRt("inspecao-cipa", i.id)).map((i) => i.title),
          ...cipaElections
            .filter(
              (e) =>
                (e.status === "Apurada" || e.status === "Publicada") &&
                !signedByRt("dossie-eleicao", e.id)
            )
            .map((e) => e.title),
        ]
      : [];

    if (technicalResponsible && rtPendingAtas.length > 0) {
      const isRt = session.name.trim().toLowerCase() === technicalResponsible.name.trim().toLowerCase();
      roleAlerts.push({
        id: "rt-atas-pendentes",
        icon: "ri-quill-pen-line",
        tone: "text-accent-700 dark:text-accent-300",
        title: isRt
          ? `${rtPendingAtas.length} ata(s) aguardando a sua assinatura como Responsável Técnico`
          : `${rtPendingAtas.length} ata(s) aguardando a assinatura do Responsável Técnico`,
        when: isRt ? "requer a sua assinatura" : `${technicalResponsible.name} · pendente`,
        to: isRt ? "/app" : "/app/cipa",
        actionRequired: true,
      });
    }

    if (technicalResponsible && rtPendingDocuments.length > 0) {
      const isRt = session.name.trim().toLowerCase() === technicalResponsible.name.trim().toLowerCase();
      roleAlerts.push({
        id: "rt-documentos-pendentes",
        icon: "ri-shield-check-line",
        tone: "text-accent-700 dark:text-accent-300",
        title: isRt
          ? `${rtPendingDocuments.length} documento(s) técnico(s) aguardando a sua assinatura`
          : `${rtPendingDocuments.length} documento(s) técnico(s) aguardando a assinatura do Responsável Técnico`,
        when: isRt
          ? "ficha da CIPA, inspeções e dossiê — emissão bloqueada"
          : `${technicalResponsible.name} · emissão bloqueada`,
        to: isRt ? "/app" : "/app/cipa",
        actionRequired: true,
      });
    }

    const cipaNotifications: TopbarNotification[] = cipaEnabled
      ? buildCipaAlerts(cipas, cipaMeetings, cipaActions, cipaAtas, cipaElections).map((a) => ({
          id: a.id,
          icon: a.icon,
          tone: a.tone,
          title: a.title,
          when: a.when,
          to: a.to,
          // Aprovações de ata e ações atrasadas exigem uma providência real.
          actionRequired: a.kind === "approval" || a.kind === "action",
        }))
      : [];

    if (session.role === "admin") {
      // Pedidos de substituição de EPI em aberto (abertos pelo SESMT ou pelo
      // colaborador). O sino acompanha o painel de gestão e destaca os atrasos.
      const openReplacements = replacementRequests.filter(
        (request) => request.status === "Pendente" || request.status === "Em andamento"
      );
      if (openReplacements.length > 0) {
        const overdueReplacements = openReplacements.filter(
          (request) =>
            replacementDeadline(request.createdAt, request.reason, settings.replacementSlaHours)?.overdue
        );
        roleAlerts.push({
          id: "epi-substituicoes-abertas",
          icon: "ri-loop-left-line",
          tone: "text-primary-600 dark:text-primary-300",
          title: `${openReplacements.length} pedido(s) de substituição de EPI aguardando atendimento`,
          when: overdueReplacements.length
            ? `${overdueReplacements.length} fora do prazo de atendimento`
            : "Abertos pelo SESMT ou pelo colaborador",
          to: "/app/epi",
          actionRequired: true,
        });
        if (overdueReplacements.length > 0) {
          roleAlerts.push({
            id: "epi-substituicoes-atrasadas",
            icon: "ri-alarm-warning-line",
            tone: "text-accent-700 dark:text-accent-300",
            title: `${overdueReplacements.length} pedido(s) de substituição de EPI fora do prazo`,
            when: "requer providência imediata",
            to: "/app/epi",
            actionRequired: true,
          });
        }
      }

      const pendingSignatures = collaborators.filter((c) => !signatures[c.id]).length;
      if (pendingSignatures > 0) {
        roleAlerts.push({
          id: "assinaturas-pendentes",
          icon: "ri-quill-pen-line",
          tone: "text-accent-700 dark:text-accent-300",
          title: `${pendingSignatures} colaborador(es) ainda sem assinatura pessoal criada`,
          when: "requer atenção",
          to: "/app",
          actionRequired: true,
        });
      }
    } else if (session.role === "colaborador") {
      const me = currentCollaborator;
      if (me) {
        const pendingAprs = aprs.filter(
          (a) =>
            a.createdByRef !== me.id &&
            a.signatures.some((s) => s.collaboratorId === me.id && !s.signature)
        ).length;
        const pendingEpis = epis.filter((d) => d.collaboratorId === me.id && d.status === "Pendente").length;
        const pendingDocs = signatureDocuments.filter(
          (d) =>
            (d.status === "aguardando" || d.status === "parcial") &&
            d.signatories.some((s) => s.collaboratorRef === me.id && s.status === "pendente")
        ).length;
        const pending = pendingAprs + pendingEpis + pendingDocs;
        if (pending > 0) {
          roleAlerts.push({
            id: "pendentes",
            icon: "ri-pen-nib-line",
            tone: "text-primary-600 dark:text-primary-300",
            title: `${pending} documento(s) aguardando a sua assinatura`,
            when: "agora",
            to: "/app/alertas",
            actionRequired: true,
          });
        }
      }
    }

    // Solicitações de renovação de documentos: a gestão precisa saber quando
    // uma tratativa estourou o prazo (SLA) ou ficou parada, sem nenhuma
    // movimentação, por mais dias do que o parametrizado.
    const renewalNotifications: TopbarNotification[] = [];
    if (isManagement) {
      const renewalOpen = renewalRequests.filter((request) => request.status !== "concluida");
      const renewalLate = renewalOpen
        .map((request) => ({ request, sla: renewalSlaInfo(request) }))
        .filter((item) => item.sla?.late)
        .sort((a, b) => (a.sla?.remainingDays ?? 0) - (b.sla?.remainingDays ?? 0));
      const renewalStalled = renewalOpen
        .map((request) => ({ request, idle: renewalIdleInfo(request, renewalIdleDays) }))
        .filter((item) => item.idle?.idle)
        .sort((a, b) => (b.idle?.idleDays ?? 0) - (a.idle?.idleDays ?? 0));

      // Aviso antecipado: prazo chegando, mas ainda dá tempo de concluir.
      // O sino é da gestão, então usa a janela configurada para o gestor.
      const renewalDueSoon = renewalOpen
        .map((request) => ({
          request,
          soon: renewalDueSoonInfo(request, renewalManagerWarningDays),
        }))
        .filter((item) => item.soon?.dueSoon)
        .sort((a, b) => (a.soon?.remainingDays ?? 0) - (b.soon?.remainingDays ?? 0));

      if (renewalDueSoon.length > 0) {
        const closest = renewalDueSoon[0];
        renewalNotifications.push({
          id: "renovacoes-prazo-proximo",
          icon: "ri-time-line",
          tone: "text-accent-700 dark:text-accent-300",
          title: `${renewalDueSoon.length} tratativa(s) de renovação vencendo em até ${renewalManagerWarningDays} dia(s)`,
          when: closest?.soon
            ? `${closest.request.documentName} · ${
                closest.soon.remainingDays === 0
                  ? "o prazo vence hoje"
                  : `${closest.soon.remainingDays} dia(s) para o prazo`
              }`
            : `Aviso ao gestor configurado para ${renewalManagerWarningDays} dia(s) antes do prazo`,
          to: "/app/documentos?renovacao=vencendo",
          actionRequired: true,
        });
      }

      if (renewalLate.length > 0) {
        const worst = renewalLate[0];
        renewalNotifications.push({
          id: "renovacoes-sla-estourado",
          icon: "ri-alarm-warning-line",
          tone: "text-danger-700 dark:text-danger-300",
          title: `${renewalLate.length} solicitação(ões) de renovação com SLA estourado`,
          when: worst?.sla
            ? `${worst.request.documentName} · atrasada há ${Math.abs(worst.sla.remainingDays)} dia(s)`
            : "requer providência imediata",
          to: "/app/documentos?renovacao=atrasadas",
          actionRequired: true,
        });
      }

      if (renewalStalled.length > 0) {
        const worst = renewalStalled[0];
        renewalNotifications.push({
          id: "renovacoes-paradas",
          icon: "ri-pause-circle-line",
          tone: "text-accent-700 dark:text-accent-300",
          title: `${renewalStalled.length} tratativa(s) de renovação sem movimentação há ${renewalIdleDays}+ dia(s)`,
          when: worst?.idle
            ? `${worst.request.documentName} · parada há ${worst.idle.idleDays} dia(s)`
            : `Limite de ${renewalIdleDays} dia(s) sem movimentação`,
          to: "/app/documentos?renovacao=paradas",
          actionRequired: true,
        });
      }
    }

    // CAT — Comunicação de Acidente: a obrigação legal só se encerra com o nº
    // oficial (eSocial / Empregador Web) informado e o recibo de entrega ao
    // trabalhador anexado. O sino cobra as duas pendências da gestão.
    const catNotifications: TopbarNotification[] = [];
    if (session.role === "admin" || session.role === "super") {
      const cats = structuredRecords.filter((record) => record.kind === "cat");
      const withoutNumber: CatPayload[] = [];
      const withoutReceipt: CatPayload[] = [];
      cats.forEach((record) => {
        const payload = record.payload as CatPayload;
        const pending = catPendingItems(payload);
        if (pending.missingNumber) withoutNumber.push(payload);
        if (pending.missingReceipt) withoutReceipt.push(payload);
      });

      if (withoutReceipt.length > 0) {
        catNotifications.push({
          id: "cat-sem-recibo",
          icon: "ri-file-warning-line",
          tone: "text-accent-700 dark:text-accent-300",
          title: `${withoutReceipt.length} CAT(s) sem recibo de entrega anexado`,
          when:
            withoutReceipt
              .slice(0, 2)
              .map((cat) => cat.workerName || cat.protocol)
              .join(" · ") || "Lei 8.213/91, art. 22, §2º — entregar ao trabalhador",
          to: "/app/documentos",
          actionRequired: true,
        });
      }

      if (withoutNumber.length > 0) {
        catNotifications.push({
          id: "cat-sem-numero-oficial",
          icon: "ri-hashtag",
          tone: "text-accent-700 dark:text-accent-300",
          title: `${withoutNumber.length} CAT(s) sem o nº oficial informado`,
          when:
            withoutNumber
              .slice(0, 2)
              .map((cat) => cat.protocol)
              .filter(Boolean)
              .join(" · ") || "Informe o número gerado no eSocial / Empregador Web",
          to: "/app/documentos",
          actionRequired: true,
        });
      }
    }

    // CAT de liderado sem recibo de entrega: o líder responde pela entrega da
    // via ao trabalhador (Lei 8.213/91, art. 22, §2º) e recebe o aviso no sino.
    const leaderCatNotifications: TopbarNotification[] = [];
    if (session.role === "colaborador" && leaderTeam.length > 0) {
      const pendingReceipt = structuredRecords
        .filter((record) => record.kind === "cat")
        .map((record) => record.payload as CatPayload)
        .filter((cat) => {
          if (!catPendingItems(cat).missingReceipt) return false;
          const byId = Boolean(
            cat.workerCollaboratorId && leaderCatScope.ids.has(cat.workerCollaboratorId)
          );
          const byCpf = leaderCatScope.cpfs.has(onlyDigits(cat.workerCpf));
          return byId || byCpf;
        });

      if (pendingReceipt.length > 0) {
        leaderCatNotifications.push({
          id: "cat-liderado-sem-recibo",
          icon: "ri-file-warning-line",
          tone: "text-accent-700 dark:text-accent-300",
          title: `${pendingReceipt.length} CAT(s) de liderados sem recibo de entrega`,
          when:
            pendingReceipt
              .slice(0, 2)
              .map((cat) => cat.workerName || cat.protocol)
              .filter(Boolean)
              .join(" · ") || "Entregue a via ao trabalhador e anexe o recibo",
          to: "/app/minhaequipe",
          actionRequired: true,
        });
      }
    }

    return [
      ...expiryNotifications,
      ...catNotifications,
      ...leaderCatNotifications,
      ...renewalNotifications,
      ...longLeaveNotifications,
      ...certificateNotifications,
      ...directedNotifications,
      ...surveyReminderNotifications,
      ...surveyNotifications,
      ...regulationNotifications,
      ...cipaNotifications,
      ...moodAlerts,
      ...roleAlerts,
      ...baseNotifications,
    ];
  }, [session.role, session.name, currentCollaborator, aprs, epis, replacementRequests, cipas, cipaMeetings, cipaActions, cipaAtas, cipaElections, cipaInspections, signatures, signatureDocuments, moodState.rows, moodFollowups.rows, moodActor, cipaEnabled, unreadDirectedDocs, pendingSurveys, regulationPending, currentRegulation, surveyReminderDays, settings.replacementSlaHours, settings.certificateLeaveAlertDays, technicalResponsible, technicalSignatures, medicalCertificates, documents, structuredRecords, expiryAlertDays, renewalRequests, renewalIdleDays, renewalWarningDays, renewalManagerWarningDays, leaderTeam, leaderCatScope]);

  // Avisos informativos somem ao abrir o sino; os que exigem ação continuam
  // na lista até o colaborador concluir o que foi pedido.
  const readNotifIds = useReadNotificationIds(session.subdomain, session.name);
  const visibleNotifications = useMemo(
    () => notifications.filter((n) => n.actionRequired || !readNotifIds.includes(n.id)),
    [notifications, readNotifIds]
  );
  const alertCount = visibleNotifications.length;
  const notifList = notifSnapshot ?? visibleNotifications;

  const handleToggleNotifications = () => {
    if (openMenu === "notif") {
      setOpenMenu("none");
      setNotifSnapshot(null);
      return;
    }
    setNotifSnapshot(visibleNotifications);
    markNotificationsRead(
      session.subdomain,
      session.name,
      visibleNotifications.filter((n) => !n.actionRequired).map((n) => n.id)
    );
    setOpenMenu("notif");
  };

  const closeMenus = () => {
    setOpenMenu("none");
    setNotifSnapshot(null);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenMenu("none");
        setNotifSnapshot(null);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-background-200 bg-background-50/95 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={onOpenMenu}
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-700 hover:bg-background-100 lg:hidden"
        >
          <i className="ri-menu-line text-xl"></i>
        </button>

        <Link
          to="/app"
          aria-label="Ir para o painel"
          className="flex items-center transition-opacity hover:opacity-80 lg:hidden"
        >
          <AppBrandLogo className="h-8 max-w-[128px]" />
        </Link>

        <div ref={searchRef} className="relative hidden sm:block">
          <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-9 w-9 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            {session.role === "colaborador" ? (
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar meus documentos..."
                className="w-48 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-72"
              />
            ) : (
              <input
                type="search"
                placeholder="Buscar colaborador, documento, CA..."
                className="w-48 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400 lg:w-72"
              />
            )}
          </div>

          {session.role === "colaborador" && searchOpen && (
            <div className="absolute left-0 top-12 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-background-200 bg-background-50">
              <div className="border-b border-background-200 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                  Documentos ligados a você
                </p>
              </div>
              {searchTerm.trim().length < 2 ? (
                <p className="px-4 py-4 text-xs leading-relaxed text-foreground-500">
                  Digite ao menos 2 letras para buscar entre contrato, ficha cadastral, atestados médicos e documentos
                  emitidos no seu nome.
                </p>
              ) : collaboratorSearchResults.length === 0 ? (
                <p className="px-4 py-4 text-xs text-foreground-500">
                  Nenhum documento encontrado para “{searchTerm.trim()}”.
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {collaboratorSearchResults.map((result) => (
                    <li key={result.id} className="border-b border-background-100 last:border-0">
                      <Link
                        to={result.to}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchTerm("");
                        }}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-background-100"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-700">
                          <i className={`${result.icon} text-base`}></i>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground-900">{result.label}</span>
                          <span className="block truncate text-[11px] text-foreground-400">{result.meta}</span>
                        </span>
                        <i className="ri-arrow-right-line shrink-0 text-foreground-400"></i>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3" ref={wrapRef}>
        <span className="hidden items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1.5 text-xs font-semibold text-secondary-900 lg:flex">
          <i className="ri-shield-user-line"></i>
          {roleLabels[session.role]}
        </span>

        <button
          type="button"
          aria-label={`Tema: ${activeThemeMode.label}. Clique para alternar`}
          title={`Tema: ${activeThemeMode.label}`}
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className={`${activeThemeMode.icon} text-xl`}></i>
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label="Exportações desta sessão"
            onClick={() => setOpenMenu((v) => (v === "history" ? "none" : "history"))}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-history-line text-xl"></i>
            {exportHistory.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-background-50">
                {exportHistory.length}
              </span>
            )}
          </button>

          {openMenu === "history" && (
            <div className="absolute right-0 top-12 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-background-200 bg-background-50">
              <div className="flex items-center justify-between border-b border-background-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground-950">Exportações desta sessão</p>
                  <p className="mt-0.5 text-[11px] text-foreground-400">Reenvie rapidamente os últimos documentos emitidos.</p>
                </div>
                {exportHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearExportHistory}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-foreground-500 transition-colors hover:text-accent-700"
                  >
                    <i className="ri-delete-bin-line"></i>
                    Limpar
                  </button>
                )}
              </div>

              {exportHistory.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                    <i className="ri-file-list-3-line text-2xl"></i>
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground-800">Nenhuma exportação ainda</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-500">
                    Os PDFs e planilhas que você gerar aparecem aqui para reenvio rápido.
                  </p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {exportHistory.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 border-b border-background-100 px-4 py-3 last:border-0"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                          entry.kind === "pdf" ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700"
                        }`}
                      >
                        <i
                          className={`${entry.kind === "pdf" ? "ri-file-pdf-2-line" : "ri-file-excel-2-line"} text-base`}
                        ></i>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground-900">{entry.label}</p>
                        <p className="truncate text-[11px] text-foreground-400">
                          {entry.kind === "pdf" ? "PDF" : "Planilha"} · {formatExportTime(entry.at)}
                          {entry.actor ? ` · por ${entry.actor}` : ""}
                        </p>
                        {entry.seal && (
                          <span
                            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700"
                            title={entry.seal.url}
                          >
                            <i className="ri-qr-code-line"></i>
                            <span className="truncate">Chancelado · {entry.seal.code}</span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={entry.replay}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                      >
                        <i className="ri-refresh-line"></i>
                        Reenviar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Notificações"
            onClick={handleToggleNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-foreground-700 hover:bg-background-100"
          >
            <i className="ri-notification-3-line text-xl"></i>
            {alertCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-background-50">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>

          {openMenu === "notif" && (
            <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-lg border border-background-200 bg-background-50">
              <div className="flex items-start justify-between gap-3 border-b border-background-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground-950">Notificações</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-foreground-400">
                    Avisos informativos somem ao serem vistos. Itens de assinatura e aceite
                    continuam aqui até você concluir.
                  </p>
                </div>
                {alertCount === 0 && (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <i className="ri-check-line text-xs"></i>
                  </span>
                )}
              </div>
              {notifList.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
                    <i className="ri-notification-off-line text-2xl"></i>
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground-800">Nenhuma notificação</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-500">
                    Você está em dia. Novos avisos aparecem aqui.
                  </p>
                </div>
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {notifList.map((n) => {
                    const inner = (
                      <>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background-100 ${n.tone}`}>
                          <i className={`${n.icon} text-base`}></i>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground-800">{n.title}</p>
                          <p className="mt-0.5 text-xs text-foreground-400">{n.when}</p>
                          {n.actionRequired && (
                            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-900">
                              <i className="ri-alert-line"></i>
                              aguardando sua ação
                            </span>
                          )}
                        </div>
                      </>
                    );
                    return (
                      <li key={n.id} className="border-b border-background-100 last:border-0">
                        {n.to ? (
                          <Link
                            to={n.to}
                            onClick={closeMenus}
                            className="flex gap-3 px-4 py-3 transition-colors hover:bg-background-100"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-background-100">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((v) => (v === "profile" ? "none" : "profile"))}
            className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-background-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-background-50">
              {getInitials(session.name)}
            </span>
            <span className="hidden text-left md:block">
              <span className="block max-w-[140px] truncate text-sm font-semibold leading-tight text-foreground-950">
                {session.name}
              </span>
              <span className="block text-xs text-foreground-500">{roleLabels[session.role]}</span>
            </span>
            <i className="ri-arrow-down-s-line text-foreground-500"></i>
          </button>

          {openMenu === "profile" && (
            <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-lg border border-background-200 bg-background-50">
              <div className="border-b border-background-200 px-4 py-3">
                <p className="truncate text-sm font-semibold text-foreground-950">{session.name}</p>
                <p className="truncate text-xs text-foreground-500">{session.email}</p>
              </div>
              <ul className="py-1">
                <li>
                  <Link to="/app/meusdados" className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100">
                    <i className="ri-user-settings-line text-base"></i> Meu perfil
                  </Link>
                </li>
                <li>
                  <Link to="/app/seguranca" className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100">
                    <i className="ri-lock-password-line text-base"></i> Segurança e senha
                  </Link>
                </li>
                <li>
                  <Link to="/app/config" className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground-700 hover:bg-background-100">
                    <i className="ri-settings-3-line text-base"></i> Configurações
                  </Link>
                </li>
              </ul>
              <div className="border-t border-background-200 px-3 py-3">
                <p className="flex items-center gap-2 px-1 pb-2 text-xs font-semibold text-foreground-700">
                  <i className="ri-contrast-2-line text-base"></i>
                  Tema do sistema
                </p>
                <div className="flex gap-1 rounded-full border border-background-200 bg-background-100 p-1">
                  {themeModes.map((mode) => {
                    const active = preference === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setThemePreference(mode.id)}
                        className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                          active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-50"
                        }`}
                      >
                        <i className={`${mode.icon} text-sm`}></i>
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-background-200 p-1">
                <button
                  type="button"
                  onClick={() => {
                    void signOut().then(() => navigate("/login", { replace: true }));
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium text-accent-800 hover:bg-accent-50"
                >
                  <i className="ri-logout-box-r-line text-base"></i> Sair do sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}