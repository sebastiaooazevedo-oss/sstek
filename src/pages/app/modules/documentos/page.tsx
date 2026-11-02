import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatusPill } from "@/pages/app/components/ui";
import { useAppSession } from "@/pages/app/context";
import { isModuleEnabled, useSystemSettings } from "@/pages/app/settings/settingsStore";
import BatchPrintModal from "@/pages/app/modules/documentos/components/BatchPrintModal";
import UploadDocumentModal from "@/pages/app/modules/documentos/components/UploadDocumentModal";
import AttendanceSheetModal from "@/pages/app/modules/documentos/components/AttendanceSheetModal";
import FieldInspectionModal from "@/pages/app/modules/documentos/components/FieldInspectionModal";
import FieldInspectionReportModal from "@/pages/app/modules/documentos/components/FieldInspectionReportModal";
import {
  EXPIRY_WARNING_DAYS,
  canBeReplaced,
  canRequestRenewal,
  computeStatus,
  daysUntilExpiry,
  expiryDaysLabel,
  fileIcon,
  fileIconTone,
  isElectionDossierDocument,
  isPermanentDocument,
  isTypeWithoutValidity,
} from "@/pages/app/modules/documentos/documentUtils";
import {
  addDocuments,
  batchPdfForDocument,
  replaceDocument,
  resolveDocumentUrl,
  updateDocumentValidity,
  useDocuments,
} from "@/pages/app/modules/documentos/documentsStore";
import ExpiryAlertsPanel from "@/pages/app/modules/documentos/components/ExpiryAlertsPanel";
import {
  buildReplacementChain,
  buildReplacementChainIndex,
  formatSwapDay,
  formatSwapMoment,
} from "@/pages/app/modules/documentos/documentChain";
import DocumentsHeader, { type ModuleCreateKind } from "@/pages/app/modules/documentos/components/DocumentsHeader";
import DocumentsSummaryBar from "@/pages/app/modules/documentos/components/DocumentsSummaryBar";
import UnitCompliancePanel from "@/pages/app/modules/documentos/components/UnitCompliancePanel";
import CatOpenPanel from "@/pages/app/modules/documentos/components/CatOpenPanel";
import DocumentPreviewDrawer from "@/pages/app/modules/documentos/components/DocumentPreviewDrawer";
import DocumentFileViewerModal from "@/pages/app/modules/documentos/components/DocumentFileViewerModal";
import QuickReviewPanel from "@/pages/app/modules/documentos/components/QuickReviewPanel";
import SortHeader, { type SortDirection } from "@/pages/app/modules/documentos/components/SortHeader";
import ValidityModal from "@/pages/app/modules/documentos/components/ValidityModal";
import RenewalRequestsPanel from "@/pages/app/modules/documentos/components/RenewalRequestsPanel";
import NewRenewalRequestModal from "@/pages/app/modules/documentos/components/NewRenewalRequestModal";
import RenewalRequestModal from "@/pages/app/modules/documentos/components/RenewalRequestModal";
import RenewalReportModal from "@/pages/app/modules/documentos/components/RenewalReportModal";
import {
  concludeRenewalByReplacement,
  createRenewalRequest,
  enrichRenewalContacts,
  ensureRenewalRequestsForExpired,
  getRenewalForDocument,
  useRenewalRequests,
  useRenewalSync,
  type RenewalRequest,
} from "@/pages/app/modules/documentos/renewalStore";
import {
  alertRecipients,
  useDocumentExpiryAlertConfig,
} from "@/pages/app/modules/documentos/documentExpiryAlertStore";
import { sendDocumentExpiryAlerts } from "@/pages/app/modules/documentos/expiryEmailNotifier";
import { sendRenewalDeadlineAlerts } from "@/pages/app/modules/documentos/renewalDeadlineNotifier";
import {
  isWeeklySummaryDue,
  sendWeeklyExpirySummary,
} from "@/pages/app/modules/documentos/weeklyExpirySummary";
import {
  saveAttendanceSheet,
  useAttendanceSheets,
  type AttendanceSheet,
} from "@/pages/app/modules/documentos/attendanceStore";
import {
  saveFieldInspection,
  useFieldInspections,
  type FieldInspectionRecord,
} from "@/pages/app/modules/documentos/fieldInspectionStore";
import { PeriodFilterBar, periodLabel, usePeriodFilter, type PeriodValue } from "@/pages/app/components/PeriodFilter";
import AccidentInvestigationModal from "@/pages/app/modules/documentos/structured/AccidentInvestigationModal";
import CatModal from "@/pages/app/modules/documentos/structured/CatModal";
import MeasurementModal from "@/pages/app/modules/documentos/structured/MeasurementModal";
import WorkPermitModal from "@/pages/app/modules/documentos/structured/WorkPermitModal";
import { saveStructuredDocument, useStructuredDocuments } from "@/pages/app/modules/documentos/structured/structuredStore";
import { buildInvestigationFromCat } from "@/pages/app/modules/documentos/structured/cat/catInvestigation";
import { catActionPlanSummary } from "@/pages/app/modules/documentos/structured/cat/catActionPlan";
import type { CatPayload, StructuredRecord } from "@/pages/app/modules/documentos/structured/structuredTypes";
import { useCollaboratorsList } from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { collaboratorEstablishments } from "@/mocks/collaborators";
import DdsPage from "@/pages/app/modules/dds/page";
import EpiPage from "@/pages/app/modules/epi/page";
import AprPage from "@/pages/app/modules/apr/page";
import AssinadosPage from "@/pages/app/modules/assinados/page";
import { escapeHtml, pdfFooter, pdfHeader, printHtml, todayBr } from "@/pages/app/utils/exportPdf";
import { downloadCsv, tableHtml } from "@/pages/app/utils/exportTable";
import {
  documentTypes,
  type DocumentRecord,
  type DocumentScope,
} from "@/mocks/documents";

type TabId = "todos" | DocumentScope;

/** Colunas que permitem ordenação por clique no cabeçalho. */
type SortKey = "tipo" | "unidade" | "validade";

// Seções documentais que antes ficavam soltas no menu lateral e agora vivem
// dentro de Documentos.
const documentSections: {
  id: string;
  label: string;
  description: string;
  icon: string;
  moduleId?: string;
  /** Seção sem aba na barra visível: entra apenas pelo menu "Criar documento". */
  menuOnly?: boolean;
}[] = [
  {
    id: "documentos",
    label: "Todos os documentos",
    description: "Arquivos da empresa e dos colaboradores",
    icon: "ri-file-list-3-line",
  },
  {
    id: "dds",
    label: "DDS",
    description: "Diálogos diários e relatórios",
    icon: "ri-presentation-line",
    moduleId: "dds",
    menuOnly: true,
  },
  {
    id: "epi",
    label: "Ficha de EPI",
    description: "Entregas, CA e termos assinados",
    icon: "ri-shirt-line",
    moduleId: "epi",
    menuOnly: true,
  },
  {
    id: "apr",
    label: "APR",
    description: "Análises preliminares de risco",
    icon: "ri-clipboard-line",
    moduleId: "apr",
    menuOnly: true,
  },
  {
    id: "documentos-assinados",
    label: "Documentos assinados",
    description: "Assinaturas concluídas e evidências",
    icon: "ri-folder-shield-2-line",
    moduleId: "assinaturas",
  },
];

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "todos", label: "Todos", icon: "ri-stack-line" },
  { id: "empresa", label: "Da empresa", icon: "ri-building-2-line" },
  { id: "colaborador", label: "Do colaborador", icon: "ri-user-line" },
];

export default function DocumentosPage() {
  const navigate = useNavigate();
  // O endereço é a fonte da visão: filtros, aba, ordenação e período ficam na
  // query string para o link abrir exatamente igual ao ser compartilhado.
  const [searchParams, setSearchParams] = useSearchParams();
  const session = useAppSession();
  const { can } = usePermissions();
  const canUploadDoc = can("documents.upload");
  const canValidity = can("documents.validity");
  const canReplace = can("documents.replace");
  const canBatchPrint = can("documents.batchPrint");
  const storedDocs = useDocuments();
  // Janela de alerta parametrizada pela gestão (Configurações › Alertas de
  // vencimento de documentos). Também define quando o documento aparece como
  // "Vencendo" na lista.
  const expiryConfig = useDocumentExpiryAlertConfig();
  const expiryRecipients = alertRecipients(expiryConfig);
  const [notifying, setNotifying] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");
  const autoNotified = useRef(false);
  const weeklyNotified = useRef(false);
  const renewalDeadlineNotified = useRef(false);
  // A situação é sempre recalculada a partir da data de validade, para que um
  // documento que vence com o tempo passe a "Vencendo"/"Vencido" sozinho.
  const docs = useMemo(
    () =>
      storedDocs.map((doc) => {
        // Registros datados (atas, editais de resultado, termos de posse,
        // dossiês, ordens de serviço, aferições, DDS, fichas de presença,
        // inspeções de campo e atestados médicos) nunca têm validade — inclusive
        // registros antigos que ainda tenham data gravada.
        const expiresAt = isTypeWithoutValidity(doc.typeId, doc.typeName) ? "—" : doc.expiresAt;
        return {
          ...doc,
          expiresAt,
          // Documento substituído sai do fluxo ativo: fica Vencido e permanece
          // consultável no histórico, independente da data de validade gravada.
          status: doc.supersededByRef
            ? ("Vencido" as const)
            : computeStatus(expiresAt, expiryConfig.daysBefore),
        };
      }),
    [storedDocs, expiryConfig.daysBefore]
  );
  // Dispara o carregamento das Fichas de Presença persistidas (reconstrói os
  // registros correspondentes em Documentos ao recarregar a página).
  useAttendanceSheets();
  // Dispara o carregamento das Inspeções de Campo persistidas (idem).
  useFieldInspections();
  // Reconstrói em Documentos os documentos estruturados salvos
  // (CAT, Investigação de Acidente, Aferições e Permissão de Trabalho).
  const structuredRecords = useStructuredDocuments();
  const [tab, setTab] = useState<TabId>(() => {
    const value = searchParams.get("aba") || "";
    return value === "empresa" || value === "colaborador" ? value : "todos";
  });
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("tipo") || "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("validade") || "");
  const [approvalFilter, setApprovalFilter] = useState(() => searchParams.get("aprovacao") || "");
  const [unitFilter, setUnitFilter] = useState(() => searchParams.get("unidade") || "");
  const [selected, setSelected] = useState<string[]>([]);
  const initialPeriod = useRef<PeriodValue>({
    mode: (() => {
      const mode = searchParams.get("periodo") || "";
      return mode === "semana" || mode === "mes" || mode === "periodo" ? mode : "todos";
    })(),
    month: searchParams.get("mes") || "",
    from: searchParams.get("de") || "",
    to: searchParams.get("ate") || "",
  });
  const periodFilter = usePeriodFilter(docs.map((d) => d.issuedAt), initialPeriod.current);
  const activeFilterCount =
    [typeFilter, statusFilter, approvalFilter, unitFilter].filter(Boolean).length +
    (periodFilter.isActive ? 1 : 0);
  const hasAnyFilter = Boolean(search) || activeFilterCount > 0;
  const collaborators = useCollaboratorsList();
  const settings = useSystemSettings();
  // Solicitações de renovação: documento de segurança só renova com documento
  // novo, então cada vencimento entra como uma tratativa rastreável.
  const renewalRequests = useRenewalRequests();
  const renewalSync = useRenewalSync();
  const canManageRenewals = session.role === "admin" || session.role === "super";
  const [renewalOpenId, setRenewalOpenId] = useState<string | null>(null);
  const [newRenewalOpen, setNewRenewalOpen] = useState(false);
  const [renewalReportOpen, setRenewalReportOpen] = useState(false);
  const renewalRequest = useMemo(
    () => (renewalOpenId ? renewalRequests.find((item) => item.id === renewalOpenId) || null : null),
    [renewalOpenId, renewalRequests]
  );
  const visibleSections = documentSections.filter(
    (section) => !section.moduleId || isModuleEnabled(settings, section.moduleId)
  );
  // Seção ativa das abas: cada aba exibe a lista da seção aqui dentro, sem
  // trocar de página. O parâmetro "secao" mantém o link compartilhável.
  const requestedSection = searchParams.get("secao") || "documentos";
  const activeSection = visibleSections.some((s) => s.id === requestedSection)
    ? requestedSection
    : "documentos";
  // DDS, Ficha de EPI e APR não ocupam mais a barra de abas: são abertos pelo
  // menu "Criar documento". Continuam navegáveis por link (?secao=…).
  const tabSections = visibleSections.filter((section) => !section.menuOnly);
  const activeMenuSection = visibleSections.find(
    (section) => section.menuOnly && section.id === activeSection
  );

  const goSection = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === "documentos") next.delete("secao");
    else next.set("secao", id);
    setSearchParams(next, { replace: true });
  };

  // Criação a partir do menu "Criar documento": abre a seção do módulo já com
  // o formulário de criação aberto (o módulo avisa quando atendeu o pedido).
  const [moduleCreate, setModuleCreate] = useState<ModuleCreateKind | null>(null);
  const handleCreateModule = (kind: ModuleCreateKind) => {
    setModuleCreate(kind);
    goSection(kind);
  };

  // Unidade efetiva de cada documento: usa a unidade própria (inspeções, fichas,
  // EPI) ou, para documentos de colaborador, a unidade do cadastro. Documentos
  // sem unidade são corporativos e aparecem em qualquer filtro.
  const unitByDoc = useMemo(() => {
    const byCollab = new Map<string, string>();
    collaborators.forEach((c) => {
      if (c.establishment) byCollab.set(c.id, c.establishment);
    });
    return new Map(
      docs.map((d) => [
        d.id,
        d.establishment || (d.collaboratorId ? byCollab.get(d.collaboratorId) || "" : ""),
      ])
    );
  }, [docs, collaborators]);

  const docUnit = (d: DocumentRecord) => unitByDoc.get(d.id) || "";

  /** Solicitação em andamento de um documento (para sinalizar nos alertas). */
  const requestFor = (documentId: string): RenewalRequest | null =>
    renewalRequests.find(
      (request) => request.documentId === documentId && request.status !== "concluida"
    ) || getRenewalForDocument(documentId);

  /**
   * Abre a solicitação de renovação. Documento de segurança não renova por
   * edição de data: o responsável assume a tratativa e só conclui quando o
   * documento novo (e os exames) estiverem anexados.
   */
  const handleRequestRenewal = (doc: DocumentRecord) => {
    if (!canValidity) {
      setPreviewId(null);
      setReviewOpen(false);
      setNotice("Seu perfil não tem permissão para solicitar renovação ou alterar a validade de documentos.");
      return;
    }
    // Peças de um processo eleitoral da CIPA (edital de convocação) não renovam:
    // o pleito tem data e hora para terminar. A próxima edição é um novo edital,
    // dentro de um novo processo eleitoral.
    if (!canRequestRenewal(doc)) {
      setPreviewId(null);
      setReviewOpen(false);
      setNotice(
        `"${doc.name}" é uma peça de processo eleitoral da CIPA e não entra na renovação de documentos. Encerrado o pleito, abra um novo processo eleitoral da CIPA e emita um novo edital.`
      );
      return;
    }
    const collaborator = doc.collaboratorId
      ? collaborators.find((item) => item.id === doc.collaboratorId)
      : undefined;
    const manager = collaborator?.managerId
      ? collaborators.find((item) => item.id === collaborator.managerId)
      : undefined;
    const request = createRenewalRequest(doc, {
      createdBy: session.name || "SESMT",
      ownerName: session.name || "SESMT",
      unit: docUnit(doc),
      collaboratorCpf: collaborator?.cpf,
      collaboratorEmail: collaborator?.email,
      managerName: manager?.name,
      managerEmail: manager?.email,
    });
    enrichRenewalContacts(request.id, {
      collaboratorCpf: collaborator?.cpf,
      collaboratorEmail: collaborator?.email,
      managerName: manager?.name,
      managerEmail: manager?.email,
    });
    setPreviewId(null);
    setReviewOpen(false);
    setRenewalOpenId(request.id);
  };

  const unitOptions = useMemo(() => {
    const units = new Set<string>(collaboratorEstablishments);
    unitByDoc.forEach((unit) => {
      if (unit) units.add(unit);
    });
    return Array.from(units);
  }, [unitByDoc]);

  // Conformidade por unidade: percentual de documentos em dia em cada
  // estabelecimento. Documentos sem unidade entram como "Corporativo".
  // A ordem vai do pior para o melhor resultado (o que precisa de atenção primeiro).
  const unitCompliance = useMemo(() => {
    const map = new Map<string, { total: number; ok: number; expiring: number; expired: number }>();
    docs.forEach((d) => {
      const key = unitByDoc.get(d.id) || "Corporativo";
      const entry = map.get(key) || { total: 0, ok: 0, expiring: 0, expired: 0 };
      entry.total += 1;
      if (d.status === "Vencido") entry.expired += 1;
      else if (d.status === "Vencendo") entry.expiring += 1;
      else entry.ok += 1;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([unit, entry]) => ({
        unit,
        ...entry,
        percent: entry.total > 0 ? Math.round((entry.ok / entry.total) * 100) : 0,
      }))
      .sort((a, b) => a.percent - b.percent || b.total - a.total);
  }, [docs, unitByDoc]);

  const overallCompliance = useMemo(() => {
    if (docs.length === 0) return 100;
    const ok = docs.filter((d) => d.status === "Em dia").length;
    return Math.round((ok / docs.length) * 100);
  }, [docs]);

  const [uploadOpen, setUploadOpen] = useState(false);
  // Alvo pré-selecionado ao abrir o envio pelo atalho "Substituir este documento".
  const [uploadReplacementId, setUploadReplacementId] = useState<string | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [accidentOpen, setAccidentOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [permitOpen, setPermitOpen] = useState(false);
  const [validityDoc, setValidityDoc] = useState<DocumentRecord | null>(null);

  /** Abre a correção de validade somente para quem tem a permissão. */
  const openValidity = (doc: DocumentRecord) => {
    if (!canValidity) {
      setNotice("Seu perfil pode visualizar, mas não pode definir ou corrigir a validade dos documentos.");
      return;
    }
    setValidityDoc(doc);
  };

  // Painel de filtros: fechado por padrão para deixar a lista mais limpa.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Pré-visualização lateral: abre ao clicar na linha, sem sair da lista.
  // Guarda só o id — o registro é sempre relido da lista para refletir
  // renovações de validade feitas na própria gaveta.
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Documento aberto no visualizador de arquivo (zoom, download e impressão).
  const [fileViewerDoc, setFileViewerDoc] = useState<DocumentRecord | null>(null);
  // Conferência rápida: percorre apenas os documentos vencidos, um por um.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRenewed, setReviewRenewed] = useState<string[]>([]);
  // Ordenação da tabela pelos cabeçalhos (tipo, unidade e validade).
  const [sortKey, setSortKey] = useState<SortKey | null>(() => {
    const value = searchParams.get("ordem") || "";
    return value === "tipo" || value === "unidade" || value === "validade" ? value : null;
  });
  const [sortDir, setSortDir] = useState<SortDirection>(() =>
    searchParams.get("dir") === "desc" ? "desc" : "asc"
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sortIndicator = (key: SortKey) => ({
    active: sortKey === key,
    direction: sortDir,
  });

  // Espelha a visão escolhida no endereço (?aba=…&tipo=…&ordem=…). Usa replace
  // para não poluir o histórico e preserva parâmetros de outras telas (secao, lote).
  const viewSignature = [
    tab,
    search,
    typeFilter,
    statusFilter,
    approvalFilter,
    unitFilter,
    sortKey || "",
    sortDir,
    periodFilter.value.mode,
    periodFilter.value.month,
    periodFilter.value.from,
    periodFilter.value.to,
  ].join("|");
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;

  useEffect(() => {
    const next = new URLSearchParams(paramsRef.current);
    const setOrDelete = (key: string, value: string) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    setOrDelete("aba", tab === "todos" ? "" : tab);
    setOrDelete("q", search.trim());
    setOrDelete("tipo", typeFilter);
    setOrDelete("validade", statusFilter);
    setOrDelete("aprovacao", approvalFilter);
    setOrDelete("unidade", unitFilter);
    setOrDelete("ordem", sortKey || "");
    setOrDelete("dir", sortKey && sortDir === "desc" ? "desc" : "");
    const period = periodFilter.value;
    setOrDelete("periodo", period.mode === "todos" ? "" : period.mode);
    setOrDelete("mes", period.mode === "mes" ? period.month : "");
    setOrDelete("de", period.mode === "periodo" ? period.from : "");
    setOrDelete("ate", period.mode === "periodo" ? period.to : "");
    const target = next.toString();
    if (target === paramsRef.current.toString()) return;
    setSearchParams(next, { replace: true });
  }, [viewSignature, setSearchParams]);

  // Volta da Conferência da Impressão em Lote com "?lote=ajustar": reabre a
  // seleção já preenchida, sem alterar nenhum documento original.
  useEffect(() => {
    if (searchParams.get("lote") !== "ajustar") return;
    setBatchOpen(true);
  }, [searchParams]);

  // Aviso de vencimento por e-mail: dispara uma verificação ao abrir a área de
  // Documentos (a gestão acompanha a base inteira). Cada documento é avisado
  // uma única vez por validade, então reabrir a tela não duplica e-mails.
  useEffect(() => {
    if (autoNotified.current) return;
    if (!expiryConfig.loaded || storedDocs.length === 0) return;
    if (session.role !== "admin" && session.role !== "super") return;
    if (!expiryConfig.enabled || expiryRecipients.length === 0) return;
    autoNotified.current = true;
    void sendDocumentExpiryAlerts({
      documents: storedDocs.filter(
        (doc) => !doc.supersededByRef && canRequestRenewal(doc)
      ),
      config: expiryConfig,
      companyName: session.company || "Sua empresa",
      collaborators,
    }).then((result) => {
      if (result.status === "sent") setEmailFeedback(result.message);
    });
  }, [expiryConfig, expiryRecipients.length, storedDocs, session.role, session.company, collaborators]);

  // Resumo semanal ao SESMT: vencidos + vencendo nos próximos 7 dias. Dispara no
  // primeiro acesso da gestão a partir do dia da semana parametrizado, com
  // intervalo mínimo de 6 dias entre um resumo e outro.
  useEffect(() => {
    if (weeklyNotified.current) return;
    if (!expiryConfig.loaded || storedDocs.length === 0) return;
    if (session.role !== "admin" && session.role !== "super") return;
    if (!isWeeklySummaryDue(expiryConfig)) return;
    if (expiryRecipients.length === 0) return;
    weeklyNotified.current = true;
    void sendWeeklyExpirySummary({
      documents: storedDocs.filter(
        (doc) => !doc.supersededByRef && canRequestRenewal(doc)
      ),
      config: expiryConfig,
      companyName: session.company || "Sua empresa",
    }).then((result) => {
      if (result.status === "sent") setEmailFeedback(result.message);
    });
  }, [expiryConfig, expiryRecipients.length, storedDocs, session.role, session.company]);

  const handleNotifyByEmail = async () => {
    setNotifying(true);
    const result = await sendDocumentExpiryAlerts({
      documents: storedDocs.filter(
        (doc) => !doc.supersededByRef && canRequestRenewal(doc)
      ),
      config: expiryConfig,
      companyName: session.company || "Sua empresa",
      collaborators,
    });
    setEmailFeedback(result.message);
    setNotifying(false);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return docs.filter((d) => {
      const matchTab = tab === "todos" || d.scope === tab;
      const matchTerm =
        !term ||
        d.name.toLowerCase().includes(term) ||
        d.typeName.toLowerCase().includes(term) ||
        (d.collaboratorName || "").toLowerCase().includes(term);
      const matchType = !typeFilter || d.typeId === typeFilter;
      // "Substituído" é um recorte do histórico (não é uma situação de
      // validade): mostra só documentos que já foram trocados. Por simetria,
      // "Vencido" lista apenas os vencidos ativos, sem os já substituídos.
      const matchStatus = !statusFilter
        ? true
        : statusFilter === "Substituído"
          ? Boolean(d.supersededByRef)
          : statusFilter === "Vencido"
            ? d.status === "Vencido" && !d.supersededByRef
            : d.status === statusFilter;
      const matchApproval = !approvalFilter || d.approvalStatus === approvalFilter;
      const matchPeriod = periodFilter.matches(d.issuedAt);
      const unit = docUnit(d);
      const matchUnit = !unitFilter || !unit || unit === unitFilter;
      return matchTab && matchTerm && matchType && matchStatus && matchApproval && matchPeriod && matchUnit;
    });
  }, [docs, tab, search, typeFilter, statusFilter, approvalFilter, unitFilter, periodFilter.value, periodFilter.effectiveMonth, unitByDoc]);

  // Ordenação aplicada sobre o resultado dos filtros. Documentos sem validade
  // (permanentes) ficam sempre no fim, independente da direção escolhida.
  const sortedDocs = useMemo(() => {
    if (!sortKey) return filtered;
    const factor = sortDir === "asc" ? 1 : -1;
    const list = [...filtered];

    if (sortKey === "validade") {
      return list.sort((a, b) => {
        const da = daysUntilExpiry(a.expiresAt);
        const db = daysUntilExpiry(b.expiresAt);
        if (da === null && db === null) return a.name.localeCompare(b.name, "pt-BR");
        if (da === null) return 1;
        if (db === null) return -1;
        return (da - db) * factor;
      });
    }

    return list.sort((a, b) => {
      const va = sortKey === "tipo" ? a.typeName : docUnit(a) || "Corporativo";
      const vb = sortKey === "tipo" ? b.typeName : docUnit(b) || "Corporativo";
      const compare = va.localeCompare(vb, "pt-BR", { sensitivity: "base" });
      if (compare !== 0) return compare * factor;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [filtered, sortKey, sortDir, unitByDoc]);

  // Registro atual da pré-visualização, relido da lista a cada alteração de
  // validade feita na própria gaveta.
  const previewDoc = useMemo(
    () => (previewId ? docs.find((d) => d.id === previewId) || null : null),
    [docs, previewId]
  );
  const previewIndex = previewDoc ? sortedDocs.findIndex((d) => d.id === previewDoc.id) : -1;

  const movePreview = (direction: 1 | -1) => {
    if (previewIndex < 0) return;
    const target = sortedDocs[previewIndex + direction];
    if (target) setPreviewId(target.id);
  };

  // Navegação do visualizador de arquivo: usa a lista filtrada/ordenada da tela
  // e, se o documento tiver sido aberto fora dela (ex.: conferência rápida),
  // cai para a base completa — sempre sem fechar e reabrir.
  const fileViewerList = useMemo(() => {
    if (!fileViewerDoc) return [];
    return sortedDocs.some((d) => d.id === fileViewerDoc.id) ? sortedDocs : docs;
  }, [fileViewerDoc, sortedDocs, docs]);
  const fileViewerIndex = fileViewerDoc
    ? fileViewerList.findIndex((d) => d.id === fileViewerDoc.id)
    : -1;
  const moveFileViewer = (direction: 1 | -1) => {
    if (fileViewerIndex < 0) return;
    const target = fileViewerList[fileViewerIndex + direction];
    if (target) setFileViewerDoc(target);
  };

  // Cadeias de substituição (documento antigo ↔ documento novo) para a gaveta
  // e para o visualizador.
  const previewChain = useMemo(
    () => (previewDoc ? buildReplacementChain(previewDoc, docs).docs : []),
    [previewDoc, docs]
  );
  const fileViewerChain = useMemo(
    () => (fileViewerDoc ? buildReplacementChain(fileViewerDoc, docs).docs : []),
    [fileViewerDoc, docs]
  );

  // Resumo de cada cadeia (elo vigente + data da última troca), para mostrar o
  // histórico direto na linha da lista sem precisar abrir a gaveta.
  const chainIndex = useMemo(() => buildReplacementChainIndex(docs), [docs]);

  // Vencidos do mais atrasado para o menos atrasado: a ordem da conferência.
  // Documentos substituídos não entram na conferência de renovação — eles já
  // foram trocados e seguem apenas no histórico.
  const expiredDocs = useMemo(
    () =>
      docs
        .filter((d) => d.status === "Vencido" && !d.supersededByRef)
        .sort((a, b) => (daysUntilExpiry(a.expiresAt) ?? 0) - (daysUntilExpiry(b.expiresAt) ?? 0)),
    [docs]
  );

  // Todo documento vencido ganha automaticamente uma solicitação aberta, para
  // que a tratativa não dependa de alguém lembrar de criá-la. É idempotente.
  useEffect(() => {
    if (docs.length === 0) return;
    if (!canManageRenewals) return;
    if (!renewalSync.loaded) return;
    ensureRenewalRequestsForExpired(docs.filter((doc) => !doc.supersededByRef && canRequestRenewal(doc)), (doc) => {
      const collaborator = doc.collaboratorId
        ? collaborators.find((item) => item.id === doc.collaboratorId)
        : undefined;
      const manager = collaborator?.managerId
        ? collaborators.find((item) => item.id === collaborator.managerId)
        : undefined;
      return {
        createdBy: session.name || "Sistema",
        ownerName: session.name || "Sistema",
        unit: docUnit(doc),
        collaboratorCpf: collaborator?.cpf,
        collaboratorEmail: collaborator?.email,
        managerName: manager?.name,
        managerEmail: manager?.email,
      };
    });
  }, [docs, canManageRenewals, collaborators, session.name, unitByDoc, renewalSync.loaded]);

  // Aviso automático de prazo por e-mail: dispara no primeiro acesso da gestão
  // quando alguma tratativa entra na janela de vencimento. Gestor e responsável
  // usam janelas próprias; o registro no banco evita e-mail repetido para a
  // mesma data-limite.
  useEffect(() => {
    if (renewalDeadlineNotified.current) return;
    if (!renewalSync.loaded || renewalRequests.length === 0) return;
    if (!canManageRenewals) return;
    renewalDeadlineNotified.current = true;
    void sendRenewalDeadlineAlerts({
      requests: renewalRequests,
      companyName: session.company || "Sua empresa",
      managerWarningDays: settings.documentRenewalManagerWarningDays,
      ownerWarningDays: settings.documentRenewalSlaWarningDays,
      escalationDays: settings.documentRenewalEscalationDays,
    }).then((result) => {
      if (result.status === "sent") setEmailFeedback(result.message);
    });
  }, [
    renewalSync.loaded,
    renewalRequests,
    canManageRenewals,
    session.company,
    settings.documentRenewalManagerWarningDays,
    settings.documentRenewalSlaWarningDays,
    settings.documentRenewalEscalationDays,
  ]);

  // Lista fixa montada ao abrir a conferência: renovar não embaralha a sequência.
  const reviewDocuments = useMemo(
    () =>
      reviewIds
        .map((id) => docs.find((d) => d.id === id))
        .filter((d): d is DocumentRecord => Boolean(d)),
    [reviewIds, docs]
  );

  const startQuickReview = () => {
    if (!canValidity) {
      setNotice("Seu perfil pode visualizar, mas não pode conduzir a conferência de validade.");
      return;
    }
    setReviewIds(expiredDocs.map((d) => d.id));
    setReviewIndex(0);
    setReviewRenewed([]);
    setPreviewId(null);
    setReviewOpen(true);
  };

  // Link de conferência: ?conferencia=1 abre a página já filtrada pelos
  // vencidos e inicia a conferência rápida automaticamente. O ref impede que
  // fechar o painel o reabra sozinho na mesma visita.
  const autoReviewStarted = useRef(false);
  useEffect(() => {
    if (autoReviewStarted.current) return;
    if (searchParams.get("conferencia") !== "1") return;
    if (docs.length === 0) return;
    autoReviewStarted.current = true;
    setStatusFilter("Vencido");
    if (expiredDocs.length === 0) {
      setNotice("Link de conferência aberto: nenhum documento vencido na base atual.");
      return;
    }
    startQuickReview();
  }, [searchParams, docs, expiredDocs]);

  // Copia um endereço limpo que já abre a visão de conferência (vencidos
  // filtrados + conferência rápida iniciada).
  const copyReviewLink = async () => {
    const url = new URL(window.location.href);
    url.search = "?conferencia=1&validade=Vencido";
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice(
        "Link de conferência copiado. Quem abrir cai direto nos documentos vencidos, com a conferência rápida já iniciada."
      );
    } catch {
      setNotice(`Não foi possível copiar automaticamente. Link de conferência: ${url.toString()}`);
    }
  };

  const periodDocs = useMemo(
    () => docs.filter((d) => periodFilter.matches(d.issuedAt)),
    [docs, periodFilter.value, periodFilter.effectiveMonth]
  );

  const allSelected = filtered.length > 0 && filtered.every((d) => selected.includes(d.id));

  // Contagem por situação para os atalhos de filtro (respeita a aba atual).
  const statusCounts = useMemo(() => {
    const base = tab === "todos" ? docs : docs.filter((d) => d.scope === tab);
    return {
      todos: base.length,
      emDia: base.filter((d) => d.status === "Em dia").length,
      vencendo: base.filter((d) => d.status === "Vencendo").length,
      vencido: base.filter((d) => d.status === "Vencido" && !d.supersededByRef).length,
      substituido: base.filter((d) => Boolean(d.supersededByRef)).length,
    };
  }, [docs, tab]);

  /** Abre o envio já no modo substituição, com o documento alvo preenchido. */
  const handleReplaceDocument = (doc: DocumentRecord) => {
    if (!canReplace) {
      setNotice("Seu perfil não tem permissão para substituir documentos.");
      return;
    }
    // Registros datados (atas, editais de resultado, termos de posse, dossiês,
    // ordens de serviço, aferições, DDS, fichas de presença, inspeções de campo
    // e atestados médicos) não podem ser substituídos.
    if (!canBeReplaced(doc)) {
      setNotice(
        isElectionDossierDocument(doc.typeId, doc.typeName)
          ? `"${doc.name}" pertence a um processo eleitoral da CIPA e não pode ser substituído. Encerrado o pleito, emita um novo edital em um novo processo eleitoral.`
          : `"${doc.name}" registra um fato datado e não pode ser substituído. Emita um novo documento do mesmo tipo para registrar a próxima ocorrência.`
      );
      return;
    }
    setUploadReplacementId(doc.id);
    setFileViewerDoc(null);
    setUploadOpen(true);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !filtered.some((d) => d.id === id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...filtered.map((d) => d.id)])));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleUploaded = (
    uploaded: DocumentRecord[],
    replacement?: { id: string; name: string }
  ) => {
    if (replacement && uploaded[0]) {
      const registered: DocumentRecord = {
        ...uploaded[0],
        replacesRef: replacement.id,
        replacesName: replacement.name,
      };
      replaceDocument(replacement.id, uploaded[0]);
      concludeRenewalByReplacement(replacement.id, uploaded[0].name, session.name || "SESMT");
      // Dentro da conferência rápida a troca já resolve o documento: emenda no
      // próximo vencido em vez de deixar a pessoa repetir a navegação.
      if (reviewOpen) {
        setReviewRenewed((prev) =>
          prev.includes(replacement.id) ? prev : [...prev, replacement.id]
        );
        setReviewIndex((prev) => prev + 1);
      }
      // Conferência final: o arquivo recém-registrado abre por cima da lista
      // (ou da conferência rápida) para validar o que entrou como vigente.
      setPreviewId(registered.id);
      setFileViewerDoc(registered);
      setNotice(
        `"${uploaded[0].name}" registrado como substituição de "${replacement.name}". O documento novo assumiu o mesmo vínculo, tipo, colaborador e unidade, e passa a ser o vigente. O anterior segue como Vencido no histórico.`
      );
      return;
    }
    addDocuments(uploaded);
    setNotice(`${uploaded.length} arquivo(s) enviado(s) e vinculado(s) com sucesso.`);
  };

  const handleAttendance = async (sheet: AttendanceSheet) => {
    const ok = await saveAttendanceSheet(sheet);
    setNotice(
      ok
        ? `Ficha de presença "Ficha de Presença — ${sheet.title}" gerada e salva com sucesso.`
        : "Não foi possível salvar a ficha de presença. Tente novamente."
    );
  };

  const handleInspection = async (record: FieldInspectionRecord) => {
    const ok = await saveFieldInspection(record);
    setNotice(
      ok
        ? `Inspeção de campo "${record.title}" gerada e salva com sucesso.`
        : "Não foi possível salvar a inspeção de campo. Tente novamente."
    );
  };

  const handleStructuredSave = async (record: StructuredRecord) => {
    const ok = await saveStructuredDocument(record);
    if (!ok) {
      setNotice("Não foi possível salvar o documento. Tente novamente.");
      return;
    }

    // Ao salvar a CAT, a investigação de acidente nasce preenchida com os
    // mesmos dados do evento, do acidentado e das comunicações legais.
    if (record.kind === "cat") {
      const investigation = buildInvestigationFromCat(record);
      if (investigation) {
        const investigationOk = await saveStructuredDocument(investigation);
        setNotice(
          investigationOk
            ? `CAT "${record.title}" salva e a Investigação de Acidente "${investigation.title}" foi criada automaticamente com os mesmos dados. ${catActionPlanSummary(
                record.payload as CatPayload
              )}`
            : `CAT "${record.title}" salva, mas não foi possível criar a Investigação de Acidente automática.`
        );
        return;
      }
    }

    setNotice(`Documento "${record.title}" gerado e salvo. Ele já está disponível na lista de documentos.`);
  };

  const handleValiditySave = (documentId: string, expiresAt: string) => {
    const target = docs.find((d) => d.id === documentId);
    if (target && isTypeWithoutValidity(target.typeId, target.typeName)) {
      setValidityDoc(null);
      setNotice(
        `"${target.name}" é um registro datado: este tipo de documento não possui data de validade.`
      );
      return;
    }
    updateDocumentValidity(documentId, expiresAt);
    setValidityDoc(null);
    setNotice(
      expiresAt
        ? `Validade de "${target?.name || "documento"}" definida para ${expiresAt}.`
        : `"${target?.name || "Documento"}" marcado como permanente (sem validade).`
    );
    // Dentro da conferência rápida, renovar já emenda no próximo documento.
    if (reviewOpen) {
      setReviewRenewed((prev) => (prev.includes(documentId) ? prev : [...prev, documentId]));
      setReviewIndex((prev) => prev + 1);
    }
  };

  const handleOpenAttached = async (doc: DocumentRecord, download = false) => {
    if (doc.attachedPdfHtml) {
      printHtml(doc.name, doc.attachedPdfHtml);
      return;
    }
    // Arquivo enviado ao Storage: gera o link assinado na hora e abre/baixa.
    const url = await resolveDocumentUrl(doc);
    if (!url) {
      setNotice(`Documento "${doc.name}" não possui arquivo anexado para visualização.`);
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    if (download) link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleBatchPrint = () => {
    if (!canBatchPrint) {
      setNotice("Seu perfil não tem permissão para imprimir documentos em lote.");
      return;
    }
    const chosen = docs.filter((d) => selected.includes(d.id));
    const withPdf = chosen.filter((d) => d.attachedPdfHtml);
    if (withPdf.length === 0) {
      setNotice(
        "Nenhum dos documentos selecionados possui PDF anexado para impressão em lote."
      );
      return;
    }

    // Capa de resumo por unidade (rastreabilidade por estabelecimento): os
    // documentos selecionados são agrupados pela unidade efetiva, com totais
    // por estabelecimento antes das páginas individuais.
    const groups = new Map<string, number>();
    withPdf.forEach((d) => {
      const unit = docUnit(d) || "Corporativo (todas as unidades)";
      groups.set(unit, (groups.get(unit) || 0) + 1);
    });
    const corporateCount = withPdf.filter((d) => !docUnit(d)).length;
    const groupRows = Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([unit, count]) => `<tr><td>${escapeHtml(unit)}</td><td>${count}</td></tr>`)
      .join("");

    const cover = `<div class="cover">
      ${pdfHeader(unitFilter ? `Impressão em lote · ${unitFilter}` : "Impressão em lote de documentos")}
      <div class="cover-hero">
        <p class="cover-eyebrow">Impressão em lote</p>
        <h1 class="cover-title">Resumo por unidade</h1>
        <p class="cover-sub">Consolidação dos documentos selecionados por estabelecimento, antes das páginas individuais de cada documento.</p>
        <p class="cover-date">Unidade: ${escapeHtml(unitFilter || "Todas as unidades")} · Emitido em ${todayBr()}</p>
      </div>
      <div class="cover-kpis">
        <div class="cover-kpi"><b>${withPdf.length}</b><span>Documentos no lote</span></div>
        <div class="cover-kpi"><b>${groups.size}</b><span>Unidades envolvidas</span></div>
        <div class="cover-kpi is-alert"><b>${corporateCount}</b><span>Documentos corporativos</span></div>
      </div>
      <h2>Totais por unidade (${groups.size})</h2>
      <table>
        <thead><tr><th>Unidade</th><th>Documentos</th></tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
      <div class="cover-note">Este lote reúne <strong>${withPdf.length}</strong> documento(s) distribuído(s) em <strong>${groups.size}</strong> unidade(s). Documentos corporativos (sem unidade) valem para toda a organização. As páginas a seguir trazem cada documento na íntegra.</div>
      <div class="cover-meta"><span>SSTEK · Gestão Inteligente em Segurança do Trabalho</span><span>Emitido em ${todayBr()}</span></div>
    </div>`;

    const pages = withPdf
      .map((d) => `<div class="batch-page">${batchPdfForDocument(d)}</div>`)
      .join("");
    printHtml(`Impressão em lote · ${withPdf.length} documento(s)`, cover + pages);
    const skipped = chosen.length - withPdf.length;
    setNotice(
      skipped > 0
        ? `Reunindo ${withPdf.length} PDF(s) para impressão em lote. ${skipped} selecionado(s) sem PDF anexado foram ignorados.`
        : `Reunindo ${withPdf.length} PDF(s) para impressão em lote...`
    );
  };

  const stats = useMemo(
    () => [
      { label: "Documentos no período", value: periodDocs.length, icon: "ri-file-list-3-line", tone: "primary" as const },
      { label: "Da empresa", value: periodDocs.filter((d) => d.scope === "empresa").length, icon: "ri-building-2-line", tone: "secondary" as const },
      { label: "Do colaborador", value: periodDocs.filter((d) => d.scope === "colaborador").length, icon: "ri-user-line", tone: "secondary" as const },
      { label: "Vencendo / vencidos", value: periodDocs.filter((d) => d.status !== "Em dia").length, icon: "ri-alarm-warning-line", tone: "danger" as const },
    ],
    [periodDocs]
  );

  const exportHeaders = ["Documento", "Tipo", "Vínculo", "Unidade", "Colaborador", "Emissão", "Validade", "Situação", "Aprovação"];
  const buildExportRows = () =>
    filtered.map((d) => [
      d.name,
      d.typeName,
      d.scope === "empresa" ? "Empresa" : "Colaborador",
      docUnit(d) || "Corporativo",
      d.collaboratorName || "—",
      d.issuedAt,
      d.expiresAt,
      d.status,
      d.approvalStatus === "aprovada" ? "Aprovada" : d.approvalStatus === "aguardando" ? "Aguardando aprovação" : "—",
    ]);

  const handleExportPdf = () => {
    const label = periodLabel(periodFilter.value, periodFilter.months);
    const rows = buildExportRows();
    const body = `
      ${pdfHeader(`Documentos · ${label}`)}
      <h2>Resumo</h2>
      <div class="kpis">
        <div class="kpi"><b>${filtered.length}</b><span>Documentos no período</span></div>
        <div class="kpi"><b>${filtered.filter((d) => d.scope === "empresa").length}</b><span>Da empresa</span></div>
        <div class="kpi"><b>${filtered.filter((d) => d.scope === "colaborador").length}</b><span>Do colaborador</span></div>
        <div class="kpi"><b>${filtered.filter((d) => d.status !== "Em dia").length}</b><span>Vencendo / vencidos</span></div>
      </div>
      <h2>Documentos (${filtered.length})</h2>
      ${tableHtml(exportHeaders, rows)}
      ${pdfFooter()}
    `;
    printHtml("Documentos — SSTEK", body);
  };

  const handleExportCsv = () => {
    downloadCsv("documentos-sstek.csv", exportHeaders, buildExportRows());
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho: título, ações e abas no mesmo painel */}
      <section className="relative z-30 rounded-2xl border border-background-200 bg-background-50 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-32px_rgba(15,23,42,0.35)]">
        <div
          aria-hidden="true"
          className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500"
        ></div>

        <div className="flex flex-col gap-5 bg-gradient-to-br from-background-50 via-background-50 to-background-100 px-5 py-5 md:px-6 md:py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-800">
              <i className="ri-shield-check-line text-xs"></i>
              Conformidade documental
            </span>
            <h1 className="mt-3 font-heading text-3xl font-extrabold leading-none tracking-tight text-foreground-950 md:text-[34px]">
              Documentos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-600">
              {activeSection === "documentos"
                ? "Documentos da empresa e dos colaboradores, com filtros e impressão em lote."
                : documentSections.find((s) => s.id === activeSection)?.description || ""}
            </p>
          </div>

          {activeSection === "documentos" && (
            <div className="shrink-0 lg:pl-4">
              <DocumentsHeader
                can={can}
                onCreateStructured={(kind) => {
                  if (kind === "cat") setCatOpen(true);
                  if (kind === "accident") setAccidentOpen(true);
                  if (kind === "measurement") setMeasurementOpen(true);
                  if (kind === "permit") setPermitOpen(true);
                }}
                onCreateModule={handleCreateModule}
                onAttendance={() => setAttendanceOpen(true)}
                onInspection={() => setReportOpen(true)}
                onUpload={() => setUploadOpen(true)}
                onBatch={() => setBatchOpen(true)}
                onHistory={() => navigate("/app/documentos/lotes")}
                onExportPdf={handleExportPdf}
                onExportCsv={handleExportCsv}
              />
            </div>
          )}
        </div>

        {/* Abas de seções — cada aba mostra a lista da seção aqui dentro */}
        <div className="overflow-x-auto rounded-b-2xl border-t border-background-200 bg-background-50 px-2 md:px-4">
          <div role="tablist" aria-label="Seções de documentos" className="flex min-w-max items-stretch">
            {tabSections.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={section.description}
                  onClick={() => goSection(section.id)}
                  className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors md:px-4 ${
                    active
                      ? "border-primary-600 text-primary-800"
                      : "border-transparent text-foreground-500 hover:border-background-300 hover:text-foreground-900"
                  }`}
                >
                  <i className={`${section.icon} text-base ${active ? "text-primary-600" : "text-foreground-400"}`}></i>
                  {section.label}
                </button>
              );
            })}

            {activeMenuSection && (
              <span className="inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-primary-600 px-3.5 py-3 text-sm font-semibold text-primary-800 md:px-4">
                <i className={`${activeMenuSection.icon} text-base text-primary-600`}></i>
                {activeMenuSection.label}
                <button
                  type="button"
                  onClick={() => goSection("documentos")}
                  title="Voltar para a lista de documentos"
                  aria-label="Voltar para a lista de documentos"
                  className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-background-100 text-foreground-500 transition-colors hover:bg-background-200 hover:text-foreground-900"
                >
                  <i className="ri-close-line text-xs"></i>
                </button>
              </span>
            )}
          </div>
        </div>
      </section>

      {activeSection !== "documentos" ? (
        <div className="mt-6">
          {activeSection === "dds" && (
            <DdsPage
              embedded
              openCreate={moduleCreate === "dds"}
              onCreateConsumed={() => setModuleCreate(null)}
            />
          )}
          {activeSection === "epi" && (
            <EpiPage
              embedded
              openCreate={moduleCreate === "epi"}
              onCreateConsumed={() => setModuleCreate(null)}
            />
          )}
          {activeSection === "apr" && (
            <AprPage
              embedded
              openCreate={moduleCreate === "apr"}
              onCreateConsumed={() => setModuleCreate(null)}
            />
          )}
          {activeSection === "documentos-assinados" && <AssinadosPage embedded />}
        </div>
      ) : (
        <>
      {notice && (
        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          <i className="ri-checkbox-circle-line mt-0.5 text-base"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {/* Visão geral compacta: um painel único em vez de quatro cartões soltos */}
      <DocumentsSummaryBar
        stats={stats}
        periodLabel={periodFilter.isActive ? periodLabel(periodFilter.value, periodFilter.months) : undefined}
      />

      <UnitCompliancePanel
        entries={unitCompliance}
        overallPercent={overallCompliance}
        activeUnit={unitFilter}
        onSelectUnit={(unit) => setUnitFilter((prev) => (prev === unit ? "" : unit))}
      />

      <CatOpenPanel records={structuredRecords} className="mt-4" />

      <RenewalRequestsPanel
        requests={renewalRequests}
        onOpen={(request) => setRenewalOpenId(request.id)}
        onOpenReport={() => setRenewalReportOpen(true)}
        onCreateNew={() => setNewRenewalOpen(true)}
      />

      <ExpiryAlertsPanel
        documents={docs}
        onEditValidity={openValidity}
        onRequestRenewal={handleRequestRenewal}
        requestFor={requestFor}
        alertDays={expiryConfig.daysBefore}
        recipientCount={expiryRecipients.length}
        onNotifyByEmail={handleNotifyByEmail}
        notifying={notifying}
        emailFeedback={emailFeedback}
      />

      {/* Atalho de upload discreto — a ação principal já está no topo */}
      {canUploadDoc ? (
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-background-300 bg-background-50 px-4 py-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-drag-drop-line text-base"></i>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground-900">
              Arraste arquivos aqui ou clique para enviar
            </span>
            <span className="hidden text-[11px] text-foreground-500 sm:block">
              Selecione o vínculo (Empresa ou Colaborador) e o tipo no momento do envio
            </span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-primary-700 sm:inline-flex">
            Escolher arquivos
            <i className="ri-arrow-right-line"></i>
          </span>
        </button>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-background-300 bg-background-100 px-4 py-3 text-xs font-medium text-foreground-500">
          <i className="ri-lock-2-line text-base"></i>
          Seu perfil tem acesso de leitura ao acervo — o envio de arquivos está bloqueado em Perfis &amp; permissões.
        </p>
      )}

      {/* Lista */}
      <div className="mt-4 overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-sm">
        {/* Barra de comando: busca, filtros e seleção */}
        <div className="border-b border-background-200 p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-full items-center gap-1 rounded-full bg-background-100 p-1 lg:w-auto">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`inline-flex cursor-pointer flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors lg:flex-none ${
                      active ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
                    }`}
                  >
                    <i className={`${t.icon} text-base`}></i>
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center rounded-lg border border-background-300 bg-background-50 pl-1 pr-2 transition-colors focus-within:border-primary-400 sm:w-80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground-400">
                  <i className="ri-search-line text-sm"></i>
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar documento, tipo ou colaborador..."
                  className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => setSearch("")}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-foreground-700"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                )}
              </div>

              {expiredDocs.length > 0 && canValidity && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={startQuickReview}
                    title="Conferir os documentos vencidos, um por um, renovando a validade ali mesmo"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-accent-300 bg-accent-50 px-3.5 py-2.5 text-sm font-semibold text-accent-900 transition-colors hover:bg-accent-100"
                  >
                    <i className="ri-play-list-2-line text-base"></i>
                    Conferência rápida
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 text-[10px] font-bold text-background-50">
                      {expiredDocs.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyReviewLink()}
                    aria-label="Copiar link de conferência"
                    title="Copiar link que já abre os vencidos filtrados e inicia a conferência rápida"
                    className="flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-background-300 bg-background-50 text-foreground-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                  >
                    <i className="ri-link text-base"></i>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                aria-expanded={filtersOpen}
                className={`inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  filtersOpen || activeFilterCount > 0
                    ? "border-primary-300 bg-primary-50 text-primary-800"
                    : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className="ri-filter-3-line text-base"></i>
                Filtros
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-background-50">
                    {activeFilterCount}
                  </span>
                )}
                <i className={`ri-arrow-down-s-line text-base transition-transform ${filtersOpen ? "rotate-180" : ""}`}></i>
              </button>
            </div>
          </div>

          {/* Atalhos de situação: "Vencido" em um clique, com a contagem atual */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground-400 sm:inline-flex">
              <i className="ri-filter-3-line text-xs"></i>
              Situação
            </span>
            {[
              { id: "", label: "Todos", icon: "ri-stack-line", count: statusCounts.todos },
              { id: "Em dia", label: "Em dia", icon: "ri-checkbox-circle-line", count: statusCounts.emDia },
              { id: "Vencendo", label: "Vencendo", icon: "ri-timer-line", count: statusCounts.vencendo },
              { id: "Vencido", label: "Vencido", icon: "ri-error-warning-line", count: statusCounts.vencido },
              {
                id: "Substituído",
                label: "Substituídos",
                icon: "ri-swap-box-line",
                count: statusCounts.substituido,
              },
            ].map((chip) => {
              const active = statusFilter === chip.id;
              return (
                <button
                  key={chip.id || "todos"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(chip.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary-500 bg-primary-500 text-background-50"
                      : "border-background-300 bg-background-50 text-foreground-600 hover:border-primary-300 hover:bg-background-100"
                  }`}
                >
                  <i className={`${chip.icon} text-sm`}></i>
                  {chip.label}
                  <span
                    className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      active ? "bg-foreground-950/25 text-background-50" : "bg-background-100 text-foreground-600"
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {(filtersOpen || activeFilterCount > 0) && (
            <div className="mt-3 rounded-lg border border-background-200 bg-background-100/70 p-3.5">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <div className="relative min-w-0">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Todos os tipos</option>
                    {documentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>

                <div className="relative min-w-0">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Todas as validades</option>
                    <option value="Em dia">Em dia</option>
                    <option value="Vencendo">Vencendo</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Substituído">Substituídos</option>
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>

                <div className="relative min-w-0">
                  <select
                    value={approvalFilter}
                    onChange={(e) => setApprovalFilter(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Todas as aprovações</option>
                    <option value="aprovada">Aprovadas</option>
                    <option value="aguardando">Aguardando aprovação</option>
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>

                <div className="relative min-w-0">
                  <select
                    value={unitFilter}
                    onChange={(e) => setUnitFilter(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Todas as unidades</option>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3 border-t border-background-200 pt-3 xl:flex-row xl:items-center xl:justify-between">
                <PeriodFilterBar
                  value={periodFilter.value}
                  onChange={periodFilter.setValue}
                  months={periodFilter.months}
                  effectiveMonth={periodFilter.effectiveMonth}
                  className="min-w-0"
                />
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("");
                      setStatusFilter("");
                      setApprovalFilter("");
                      setUnitFilter("");
                      periodFilter.reset();
                    }}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-200 hover:text-foreground-900"
                  >
                    <i className="ri-close-circle-line text-sm"></i>
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-primary-200 bg-primary-50 px-4 py-2.5 md:px-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-900">
              <i className="ri-checkbox-multiple-line text-sm"></i>
              {selected.length} documento(s) selecionado(s)
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected([])}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-close-line text-sm"></i>
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={handleBatchPrint}
                aria-disabled={!canBatchPrint}
                title={canBatchPrint ? "Imprimir os documentos selecionados em lote" : "Impressão em lote bloqueada para o seu perfil"}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  canBatchPrint
                    ? "cursor-pointer bg-secondary-500 text-background-50 hover:bg-secondary-600"
                    : "cursor-not-allowed bg-background-200 text-foreground-500"
                }`}
              >
                <i className={canBatchPrint ? "ri-printer-line text-base" : "ri-lock-2-line text-base"}></i>
                Imprimir selecionados
              </button>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 bg-background-100/60 text-left">
                <th className="px-5 py-3.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Selecionar todos"
                    className="h-4 w-4 accent-primary-500"
                  />
                </th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Documento</th>
                <SortHeader
                  label="Tipo"
                  {...sortIndicator("tipo")}
                  onSort={() => toggleSort("tipo")}
                  title="Ordenar por tipo de documento"
                />
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Vínculo</th>
                <SortHeader
                  label="Unidade"
                  {...sortIndicator("unidade")}
                  onSort={() => toggleSort("unidade")}
                  title="Ordenar por unidade"
                />
                <SortHeader
                  label="Validade"
                  {...sortIndicator("validade")}
                  onSort={() => toggleSort("validade")}
                  title="Ordenar por validade (mais próximo do vencimento primeiro)"
                />
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Situação</th>
                <th className="sticky right-0 z-20 border-l border-background-200 bg-background-100 px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedDocs.map((d) => {
                const checked = selected.includes(d.id);
                return (
                  <tr
                    key={d.id}
                    onClick={() => setPreviewId(d.id)}
                    title="Clique para ver os detalhes"
                    className={`group cursor-pointer border-b border-background-100 transition-colors last:border-0 ${
                      checked ? "bg-primary-50" : "bg-background-50 hover:bg-background-100"
                    }`}
                  >
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(d.id)}
                        aria-label={`Selecionar ${d.name}`}
                        className="h-4 w-4 cursor-pointer accent-primary-500"
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {d.previewDataUrl ? (
                          <button
                            type="button"
                            aria-label={`Ampliar imagem de ${d.name}`}
                            onClick={() => setPreviewId(d.id)}
                            className="group/img relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-background-200 bg-background-100"
                          >
                            <img src={d.previewDataUrl} alt={d.name} className="h-full w-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-foreground-950/40 opacity-0 transition-opacity group-hover/img:opacity-100">
                              <i className="ri-zoom-in-line text-sm text-background-50"></i>
                            </span>
                          </button>
                        ) : (
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${fileIconTone[d.fileType]}`}>
                            <i className={`${fileIcon[d.fileType]} text-lg`}></i>
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground-950">{d.name}</p>
                          <p className="truncate text-xs text-foreground-500">
                            {d.size} · Emitido em {d.issuedAt}
                            {!d.visibleToCollaborator && " · interno"}
                            {d.attachedPdfHtml && " · PDF anexado"}
                            {d.previewDataUrl && " · imagem"}
                          </p>
                          {(d.supersededByRef || d.replacesRef) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {d.supersededByRef ? (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-semibold text-danger-800">
                                  <i className="ri-arrow-go-back-line"></i>
                                  Substituído
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-background-50"
                                  title={
                                    d.replacesName
                                      ? `Vigente — substituiu: ${d.replacesName}`
                                      : "Documento vigente da cadeia"
                                  }
                                >
                                  <i className="ri-verified-badge-line"></i>
                                  Vigente
                                </span>
                              )}
                              {d.replacesRef && d.supersededByRef && (
                                <span
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-800"
                                  title={d.replacesName ? `Substituiu: ${d.replacesName}` : undefined}
                                >
                                  <i className="ri-swap-box-line"></i>
                                  Substituição
                                </span>
                              )}
                            </div>
                          )}
                          {chainIndex.get(d.id)?.lastSwapAt && (
                            <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] font-medium text-foreground-500">
                              <i className="ri-history-line text-xs text-foreground-400"></i>
                              Última troca em{" "}
                              <span
                                className="font-semibold text-foreground-700"
                                title={`Registrada em ${formatSwapMoment(chainIndex.get(d.id)?.lastSwapAt)}`}
                              >
                                {formatSwapDay(chainIndex.get(d.id)?.lastSwapAt)}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="rounded-md bg-background-100 px-2 py-1 text-xs font-medium text-foreground-700">
                          {d.typeName}
                        </span>
                        {d.approvalStatus && (
                          <span
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              d.approvalStatus === "aprovada"
                                ? "bg-primary-100 text-primary-700"
                                : "bg-secondary-100 text-secondary-800"
                            }`}
                          >
                            <i className={d.approvalStatus === "aprovada" ? "ri-verified-badge-line" : "ri-timer-line"}></i>
                            {d.approvalStatus === "aprovada" ? "Aprovada" : "Aguardando aprovação"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {d.scope === "empresa" ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground-700">
                          <i className="ri-building-2-line text-secondary-700"></i>
                          Empresa
                        </span>
                      ) : (
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground-800">{d.collaboratorName}</p>
                          <p className="truncate text-xs text-foreground-400">{d.collaboratorRole}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {docUnit(d) ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                          <i className="ri-building-line"></i>
                          {docUnit(d)}
                        </span>
                      ) : (
                        <span className="whitespace-nowrap rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-medium text-foreground-500">
                          Corporativo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {isTypeWithoutValidity(d.typeId, d.typeName) ? (
                        <span
                          title="Registro datado: este tipo de documento não possui data de validade nem substituição"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 bg-background-100 px-2.5 py-1.5 text-[11px] font-medium text-foreground-500"
                        >
                          <i className="ri-file-shield-2-line"></i>
                          Sem validade
                        </span>
                      ) : isPermanentDocument(d.expiresAt) ? (
                        <button
                          type="button"
                          onClick={() => openValidity(d)}
                          title="Este documento está sem validade — clique para cadastrar a data de vencimento"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-primary-400 bg-primary-50 px-2.5 py-1.5 text-[11px] font-semibold text-primary-800 transition-colors hover:bg-primary-100"
                        >
                          <i className="ri-calendar-check-line"></i>
                          Definir validade
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span className="whitespace-nowrap text-sm text-foreground-700">{d.expiresAt}</span>
                            <button
                              type="button"
                              title="Corrigir a data de validade cadastrada (a renovação é feita pela solicitação)"
                              aria-label={`Corrigir data de validade de ${d.name}`}
                              onClick={() => openValidity(d)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-400 transition-colors hover:bg-background-100 hover:text-primary-700"
                            >
                              <i className="ri-edit-line text-xs"></i>
                            </button>
                          </div>
                          {(() => {
                            const days = daysUntilExpiry(d.expiresAt);
                            if (days === null) return null;
                            const tone =
                              days < 0
                                ? "bg-danger-100 text-danger-800 ring-1 ring-danger-200"
                                : days <= EXPIRY_WARNING_DAYS
                                  ? "bg-accent-100 text-accent-800"
                                  : "bg-background-200 text-foreground-600";
                            return (
                              <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
                                <i className={days < 0 ? "ri-error-warning-line" : "ri-timer-line"}></i>
                                {expiryDaysLabel(days)}
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={d.status} />
                    </td>
                    <td
                      className={`sticky right-0 z-10 border-l border-background-200 px-5 py-3.5 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)] ${
                        checked ? "bg-primary-50" : "bg-background-50 group-hover:bg-background-100"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Visualizar"
                          onClick={() => setFileViewerDoc(d)}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 hover:text-primary-600"
                        >
                          <i className="ri-eye-line text-base"></i>
                        </button>
                        <button
                          type="button"
                          title={d.attachedPdfHtml ? "Baixar PDF anexado" : "Baixar"}
                          onClick={() => handleOpenAttached(d, true)}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 hover:text-secondary-700"
                        >
                          <i className="ri-download-2-line text-base"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
              <i className="ri-folder-open-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhum documento encontrado</p>
            <p className="text-xs text-foreground-500">Ajuste os filtros, envie um arquivo ou registre um novo documento.</p>
            <button
              type="button"
              onClick={() => {
                setTab("todos");
                setSearch("");
                setTypeFilter("");
                setStatusFilter("");
                setApprovalFilter("");
                setUnitFilter("");
                periodFilter.reset();
              }}
              className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-refresh-line"></i>
              Limpar filtros
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-background-200 px-5 py-4">
            <p className="text-xs text-foreground-500">
              Mostrando <strong className="font-semibold text-foreground-800">{filtered.length}</strong> documento(s)
            </p>
            <p className="text-xs text-foreground-400">Impressão em lote disponível ao selecionar documentos</p>
          </div>
        )}
      </div>

      <UploadDocumentModal
        open={uploadOpen}
        initialReplacementId={uploadReplacementId ?? undefined}
        onClose={() => {
          setUploadOpen(false);
          setUploadReplacementId(null);
        }}
        onUpload={handleUploaded}
      />
      <BatchPrintModal
        open={batchOpen}
        onClose={() => {
          setBatchOpen(false);
          if (searchParams.get("lote") === "ajustar") {
            const next = new URLSearchParams(searchParams);
            next.delete("lote");
            navigate(`/app/documentos${next.toString() ? `?${next.toString()}` : ""}`, { replace: true });
          }
        }}
        documents={docs}
        onGenerated={() => {
          setBatchOpen(false);
          navigate("/app/documentos/impressao-em-lote");
        }}
      />
      <AttendanceSheetModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)} onSave={handleAttendance} />
      <FieldInspectionReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onCreate={() => {
          setReportOpen(false);
          setInspectionOpen(true);
        }}
      />
      <FieldInspectionModal
        open={inspectionOpen}
        onClose={() => {
          setInspectionOpen(false);
          setReportOpen(true);
        }}
        onSave={handleInspection}
      />

      <CatModal
        open={catOpen}
        onClose={() => setCatOpen(false)}
        onSave={handleStructuredSave}
        existingRecords={structuredRecords}
      />

      <AccidentInvestigationModal
        open={accidentOpen}
        onClose={() => setAccidentOpen(false)}
        onSave={handleStructuredSave}
      />
      <MeasurementModal
        open={measurementOpen}
        onClose={() => setMeasurementOpen(false)}
        onSave={handleStructuredSave}
      />
      <WorkPermitModal
        open={permitOpen}
        onClose={() => setPermitOpen(false)}
        onSave={handleStructuredSave}
      />

      <ValidityModal
        open={Boolean(validityDoc)}
        document={validityDoc}
        onClose={() => setValidityDoc(null)}
        onSave={handleValiditySave}
      />

      <NewRenewalRequestModal
        open={newRenewalOpen}
          documents={docs.filter(canRequestRenewal)}
        collaborators={collaborators.map((person) => ({
          id: person.id,
          name: person.name,
          cpf: person.cpf,
        }))}
        openRequestDocumentIds={renewalRequests
          .filter((request) => request.status !== "concluida")
          .map((request) => request.documentId)}
        onClose={() => setNewRenewalOpen(false)}
        onCreate={(doc) => {
          setNewRenewalOpen(false);
          handleRequestRenewal(doc);
        }}
      />

      <RenewalRequestModal
        open={Boolean(renewalRequest)}
        request={renewalRequest}
        canEdit={canManageRenewals}
        userName={session.name || "SESMT"}
        companyName={session.company || "Sua empresa"}
        team={collaborators
          .filter((person) => Boolean(person.email))
          .map((person) => ({ name: person.name, email: person.email }))}
        onClose={() => setRenewalOpenId(null)}
      />

      <RenewalReportModal
        open={renewalReportOpen}
        requests={renewalRequests}
        companyName={session.company || "Sua empresa"}
        onClose={() => setRenewalReportOpen(false)}
      />

      <DocumentPreviewDrawer
        record={previewDoc}
        unit={previewDoc ? docUnit(previewDoc) : ""}
        warningDays={expiryConfig.daysBefore}
        position={previewIndex >= 0 ? { index: previewIndex, total: sortedDocs.length } : undefined}
        onNavigate={movePreview}
        onClose={() => setPreviewId(null)}
        onOpenFile={(doc, download) => {
          if (download) {
            void handleOpenAttached(doc, true);
            return;
          }
          setFileViewerDoc(doc);
        }}
        onEditValidity={(doc) => {
          setPreviewId(null);
          openValidity(doc);
        }}
        onRequestRenewal={handleRequestRenewal}
        renewalRequest={previewDoc ? requestFor(previewDoc.id) : null}
        onPrintQr={(doc) =>
          setNotice(`QR-Code de ${doc.collaboratorName || "empresa"} enviado para impressão.`)
        }
        chain={previewChain}
        onOpenChainDoc={(doc) => setPreviewId(doc.id)}
        onReplace={handleReplaceDocument}
      />

      {/* A conferência some enquanto o diálogo de validade está aberto para as
          teclas Esc/setas não brigarem entre as duas camadas. */}
      {!validityDoc && (
        <QuickReviewPanel
          open={reviewOpen}
          documents={reviewDocuments}
          index={reviewIndex}
          renewedIds={reviewRenewed}
          unitOf={docUnit}
          warningDays={expiryConfig.daysBefore}
          onIndexChange={setReviewIndex}
          onClose={() => setReviewOpen(false)}
          onRenew={handleRequestRenewal}
          onReplace={handleReplaceDocument}
          onOpenFile={(doc) => setFileViewerDoc(doc)}
        />
      )}

      <DocumentFileViewerModal
        record={fileViewerDoc}
        unit={fileViewerDoc ? docUnit(fileViewerDoc) : ""}
        position={
          fileViewerDoc && fileViewerIndex >= 0
            ? { index: fileViewerIndex, total: fileViewerList.length }
            : undefined
        }
        onNavigate={moveFileViewer}
        chain={fileViewerChain}
        onOpenChainDoc={(doc) => setFileViewerDoc(doc)}
        onReplace={handleReplaceDocument}
        onClose={() => setFileViewerDoc(null)}
      />
        </>
      )}
    </div>
  );
}