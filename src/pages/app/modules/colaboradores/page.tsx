import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { StatusPill } from "@/pages/app/components/ui";
import ModuleHeader, {
  ModuleToolbar,
  moduleGhostAction,
  modulePrimaryAction,
  moduleToolbarDivider,
} from "@/pages/app/components/ModuleHeader";
import { useAppSession } from "@/pages/app/context";
import QrFichaModal from "@/pages/app/modules/qrcodes/components/QrFichaModal";
import { qrScanStatus } from "@/pages/app/modules/qrcodes/qrScanStatus";
import { defaultQrProfile, qrProfiles, scanLogs } from "@/mocks/qrcodes";
import CollaboratorFormModal from "@/pages/app/modules/colaboradores/components/CollaboratorFormModal";
import CollaboratorDetailModal from "@/pages/app/modules/colaboradores/components/CollaboratorDetailModal";
import ImportCollaboratorsModal from "@/pages/app/modules/colaboradores/components/ImportCollaboratorsModal";
import {
  addCollaborator,
  importCollaborators,
  reloadCollaborators,
  removeCollaborator,
  updateCollaborator,
  useCollaborators,
} from "@/pages/app/modules/colaboradores/collaboratorsStore";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { PermissionLockNote } from "@/pages/app/components/PermissionGate";
import {
  collaboratorAreas,
  collaboratorEstablishments,
  collaboratorStatuses,
  type Collaborator,
} from "@/mocks/collaborators";

const PAGE_SIZE_OPTIONS = [10, 50, 100];

export default function ColaboradoresPage() {
  const session = useAppSession();
  const { can } = usePermissions();
  const canCreate = can("collaborators.create");
  const canEdit = can("collaborators.edit");
  const canDelete = can("collaborators.delete");
  const canImport = can("collaborators.import");
  const store = useCollaborators(session.subdomain);
  const list = store.collaborators;
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [establishmentFilter, setEstablishmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Collaborator | null>(null);
  const [detail, setDetail] = useState<Collaborator | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<Collaborator | null>(null);
  const [notice, setNotice] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  // Atalho usado pelo aviso de atestado no sino: abre a ficha da pessoa.
  useEffect(() => {
    const ref = searchParams.get("colaborador");
    if (!ref) return;
    const found = list.find((c) => c.id === ref);
    if (!found) return;
    setDetail(found);
    const next = new URLSearchParams(searchParams);
    next.delete("colaborador");
    setSearchParams(next, { replace: true });
  }, [searchParams, list, setSearchParams]);

  // Aviso temporário (ex.: adesivo do QR-Code enviado para impressão).
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((c) => {
      const matchTerm =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.role.toLowerCase().includes(term) ||
        c.cpf.includes(term);
      const matchArea = !areaFilter || c.area === areaFilter;
      const matchEstablishment = !establishmentFilter || c.establishment === establishmentFilter;
      const matchStatus = !statusFilter || c.status === statusFilter;
      return matchTerm && matchArea && matchEstablishment && matchStatus;
    });
  }, [list, search, areaFilter, establishmentFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const stats = useMemo(
    () => [
      { label: "Total de colaboradores", value: list.length, icon: "ri-team-line", tone: "primary" },
      { label: "Ativos", value: list.filter((c) => c.status === "Ativo").length, icon: "ri-user-follow-line", tone: "primary" },
      { label: "Afastados", value: list.filter((c) => c.status === "Afastado").length, icon: "ri-user-forbid-line", tone: "secondary" },
      {
        label: "Documentos pendentes",
        value: list.reduce((acc, c) => acc + (c.documentsTotal - c.documentsOk), 0),
        icon: "ri-file-warning-line",
        tone: "accent",
      },
    ],
    [list]
  );

  const toneIcon: Record<string, string> = {
    primary: "bg-primary-100 text-primary-700",
    secondary: "bg-secondary-100 text-secondary-800",
    accent: "bg-accent-100 text-accent-800",
  };

  const handleSave = async (collaborator: Collaborator): Promise<boolean> => {
    const exists = list.some((c) => c.id === collaborator.id);
    if (exists && !canEdit) {
      setNotice("Seu perfil não tem permissão para editar colaboradores.");
      return false;
    }
    if (!exists && !canCreate) {
      setNotice("Seu perfil não tem permissão para incluir colaboradores.");
      return false;
    }
    const saved = exists ? await updateCollaborator(collaborator) : await addCollaborator(collaborator);
    if (!saved) return false;
    setNotice(
      exists
        ? `Cadastro de ${collaborator.name} atualizado.`
        : `${collaborator.name} cadastrado. O QR-Code dele já está disponível na lista e na tela de QR-Codes.`,
    );
    setEditing(null);
    setPage(1);
    return true;
  };

  const openNew = () => {
    if (!canCreate) {
      setNotice("Seu perfil não tem permissão para incluir colaboradores.");
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (collaborator: Collaborator) => {
    if (!canEdit) {
      setNotice("Seu perfil não tem permissão para editar colaboradores.");
      return;
    }
    setEditing(collaborator);
    setDetail(null);
    setFormOpen(true);
  };

  const handleDelete = async (collaborator: Collaborator) => {
    if (!canDelete) {
      setNotice("Seu perfil não tem permissão para excluir colaboradores.");
      return;
    }
    const ok = await removeCollaborator(collaborator.id);
    setConfirmDeleteId(null);
    setNotice(
      ok
        ? `Colaborador "${collaborator.name}" excluído da empresa.`
        : "Não foi possível excluir o colaborador. Tente novamente."
    );
  };

  const openImport = () => {
    if (!canImport) {
      setNotice("Seu perfil não tem permissão para importar planilha de colaboradores.");
      return;
    }
    setImportOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setAreaFilter("");
    setEstablishmentFilter("");
    setStatusFilter("");
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho no padrão único do portal */}
      <ModuleHeader
        badgeIcon="ri-team-line"
        badgeLabel="Gestão de pessoas"
        title="Colaboradores"
        subtitle="Cadastro completo, documentação vinculada e QR-Code de fiscalização."
        actions={
          <ModuleToolbar>
            {canCreate ? (
              <button type="button" onClick={openNew} className={modulePrimaryAction}>
                <i className="ri-user-add-line text-base"></i>
                Novo colaborador
              </button>
            ) : (
              <PermissionLockNote text="Incluir colaboradores bloqueado" />
            )}
            {canImport && (
              <>
                <span className={moduleToolbarDivider} aria-hidden="true"></span>
                <button type="button" onClick={openImport} className={moduleGhostAction}>
                  <i className="ri-file-excel-2-line text-base"></i>
                  Importar .xlsx
                </button>
              </>
            )}
          </ModuleToolbar>
        }
      />

      {/* KPIs */}
      <div className="mt-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-background-200 bg-background-50 p-4 md:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneIcon[stat.tone]}`}>
              <i className={`${stat.icon} text-lg`}></i>
            </span>
            <p className="mt-4 font-heading text-2xl font-extrabold tracking-tight text-foreground-950">{stat.value}</p>
            <p className="mt-0.5 text-xs font-medium text-foreground-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {store.loading && !store.loaded && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-5 py-6 text-sm text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-lg text-primary-500"></i>
          Carregando colaboradores...
        </div>
      )}
      {store.error && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-accent-200 bg-accent-50 px-5 py-4 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
          <i className="ri-error-warning-line text-lg"></i>
          <span className="flex-1">{store.error}</span>
          <button
            type="button"
            onClick={() => void reloadCollaborators()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent-300 px-3.5 py-2 text-xs font-semibold text-accent-800 transition-colors hover:bg-accent-100 dark:border-accent-700 dark:text-accent-100 dark:hover:bg-accent-900"
          >
            <i className="ri-refresh-line"></i>
            Tentar novamente
          </button>
        </div>
      )}

      {notice && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 px-5 py-4 text-sm text-primary-900">
          <i className="ri-checkbox-circle-line mt-0.5 text-lg text-primary-600"></i>
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Fechar aviso"
            className="flex h-6 w-6 items-center justify-center rounded-md text-primary-700 transition-colors hover:bg-primary-100"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="mt-6 rounded-lg border border-background-200 bg-background-50">
        <div className="flex flex-col gap-3 border-b border-background-200 p-4 md:flex-row md:items-center md:p-5">
          <div className="flex flex-1 items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <span className="flex h-10 w-10 items-center justify-center text-foreground-400">
              <i className="ri-search-line text-base"></i>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrar por nome, função ou CPF..."
              className="w-full bg-transparent py-2 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <select
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-48"
              >
                <option value="">Todas as áreas</option>
                {collaboratorAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>

            <div className="relative">
              <select
                value={establishmentFilter}
                onChange={(e) => {
                  setEstablishmentFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-52"
              >
                <option value="">Todos os estabelecimentos</option>
                {collaboratorEstablishments.map((est) => (
                  <option key={est} value={est}>
                    {est}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-40"
              >
                <option value="">Todas as situações</option>
                {collaboratorStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>

            <div className="relative flex items-center">
              <i className="ri-list-check-2 pointer-events-none absolute left-3 text-foreground-400"></i>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Colaboradores por página"
                title="Colaboradores por página"
                className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-9 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400 sm:w-44"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
            </div>

            {(search || areaFilter || statusFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-foreground-600 transition-colors hover:bg-background-100"
              >
                <i className="ri-close-circle-line text-base"></i>
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-background-200 text-left">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Colaborador</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Função / Área</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Estabelecimento</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">CPF</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Admissão</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Documentos</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Situação</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wide text-foreground-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => {
                const docPct = Math.round((c.documentsOk / c.documentsTotal) * 100);
                const qr = qrScanStatus(c.id);
                return (
                  <tr key={c.id} className="border-b border-background-100 transition-colors last:border-0 hover:bg-background-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-background-200 bg-background-100">
                          <img src={c.photo} alt={c.name} className="h-full w-full object-top" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground-950">{c.name}</p>
                          <p className="truncate text-xs text-foreground-500">{c.email}</p>
                          <span
                            title={
                              qr.hasScans && qr.lastLog
                                ? `QR-Code ativo · último escaneamento em ${qr.lastDateFull} · ${qr.lastLog.source}`
                                : "QR-Code ativo · nenhum escaneamento registrado até agora"
                            }
                            className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              qr.hasScans
                                ? "bg-primary-100 text-primary-700"
                                : "bg-background-200 text-foreground-600"
                            }`}
                          >
                            <i className={qr.hasScans ? "ri-qr-scan-2-line" : "ri-eye-off-line"}></i>
                            QR ativo
                            <span className="font-normal opacity-60">·</span>
                            {qr.hasScans ? qr.lastDate : "sem leitura"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-foreground-800">{c.role}</p>
                      <p className="text-xs text-foreground-400">{c.area}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.establishment ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-100 px-2.5 py-1 text-[11px] font-semibold text-secondary-900">
                          <i className="ri-building-line"></i>
                          {c.establishment}
                        </span>
                      ) : (
                        <span className="text-xs text-foreground-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-foreground-700">{c.cpf}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-sm text-foreground-700">{c.admissionDate}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-background-200">
                          <div
                            className={`h-full rounded-full ${docPct === 100 ? "bg-primary-500" : "bg-accent-500"}`}
                            style={{ width: `${docPct}%` }}
                          ></div>
                        </div>
                        <span className="whitespace-nowrap text-xs font-medium text-foreground-600">
                          {c.documentsOk}/{c.documentsTotal}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetail(c)}
                          title="Ver ficha"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 hover:text-primary-600"
                        >
                          <i className="ri-id-card-line text-base"></i>
                        </button>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            title="Editar"
                            className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 hover:text-secondary-700"
                          >
                            <i className="ri-edit-line text-base"></i>
                          </button>
                        ) : (
                          <span
                            title="Edição não liberada para o seu perfil"
                            className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md text-foreground-300"
                          >
                            <i className="ri-lock-2-line text-base"></i>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setQrTarget(c)}
                          title="QR-Code de fiscalização"
                          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-background-100 hover:text-accent-700"
                        >
                          <i className="ri-qr-code-line text-base"></i>
                        </button>
                        {canDelete &&
                          (confirmDeleteId === c.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleDelete(c)}
                                title="Confirmar exclusão"
                                className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-2.5 text-[11px] font-semibold text-background-50 transition-colors hover:bg-accent-600"
                              >
                                <i className="ri-check-line"></i>
                                Excluir
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                aria-label="Cancelar exclusão"
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 transition-colors hover:bg-background-100"
                              >
                                <i className="ri-close-line"></i>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(c.id)}
                              title="Excluir colaborador"
                              className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-600 transition-colors hover:bg-accent-50 hover:text-accent-700"
                            >
                              <i className="ri-delete-bin-line text-base"></i>
                            </button>
                          ))}
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
              <i className="ri-search-eye-line text-2xl"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">Nenhum colaborador encontrado</p>
            <p className="text-xs text-foreground-500">Ajuste os filtros ou cadastre um novo colaborador.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
            >
              <i className="ri-refresh-line"></i>
              Limpar filtros
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-background-200 px-5 py-4 sm:flex-row">
            <p className="text-xs text-foreground-500">
              Mostrando <strong className="font-semibold text-foreground-800">{pageItems.length}</strong> de{" "}
              <strong className="font-semibold text-foreground-800">{filtered.length}</strong> colaboradores
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="ri-arrow-left-s-line"></i>
                Anterior
              </button>
              <span className="text-xs font-medium text-foreground-600">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      <QrFichaModal
        open={!!qrTarget}
        collaborator={qrTarget}
        profile={(qrTarget && qrProfiles[qrTarget.id]) || defaultQrProfile}
        companyName={session.company}
        subdomain={session.subdomain}
        actorName={session.name}
        logs={qrTarget ? scanLogs.filter((log) => log.collaboratorId === qrTarget.id) : []}
        onClose={() => setQrTarget(null)}
        onNotice={setNotice}
      />

      <CollaboratorFormModal
        open={formOpen}
        initial={editing}
        team={list}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <CollaboratorDetailModal
        open={!!detail}
        collaborator={detail}
        canEdit={canEdit}
        onClose={() => setDetail(null)}
        onEdit={openEdit}
      />

      <ImportCollaboratorsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(imported) => void importCollaborators(imported)}
      />
    </div>
  );
}