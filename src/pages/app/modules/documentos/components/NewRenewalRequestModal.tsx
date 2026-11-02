import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import {
  canRequestRenewal,
  daysUntilExpiry,
  expiryDaysLabel,
  fileIcon,
  fileIconTone,
} from "@/pages/app/modules/documentos/documentUtils";
import type { DocumentRecord } from "@/mocks/documents";

interface NewRenewalRequestModalProps {
  open: boolean;
  /** Documentos da empresa (a lista já vem com a situação recalculada). */
  documents: DocumentRecord[];
  /** Colaboradores, para resolver o CPF na busca e na exibição. */
  collaborators: { id: string; name: string; cpf: string }[];
  /** Documentos que já têm solicitação em andamento (não podem ser repetidos). */
  openRequestDocumentIds: string[];
  onClose: () => void;
  onCreate: (document: DocumentRecord) => void;
}

/**
 * Escolha do documento para uma solicitação de renovação antecipada.
 *
 * Aqui só entram documentos que ainda NÃO venceram e que não têm solicitação
 * em andamento — os vencidos já ganham tratativa automática e não podem ser
 * duplicados. A busca cobre nome, tipo, colaborador e CPF.
 */
export default function NewRenewalRequestModal({
  open,
  documents,
  collaborators,
  openRequestDocumentIds,
  onClose,
  onCreate,
}: NewRenewalRequestModalProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const cpfByCollaborator = useMemo(() => {
    const map = new Map<string, string>();
    collaborators.forEach((person) => {
      if (person.id) map.set(person.id, person.cpf || "");
    });
    return map;
  }, [collaborators]);

  const openIds = useMemo(() => new Set(openRequestDocumentIds), [openRequestDocumentIds]);

  const alreadyRequested = useMemo(
    () => documents.filter((doc) => openIds.has(doc.id)).length,
    [documents, openIds]
  );
  const expiredWithoutRequest = useMemo(
    () => documents.filter((doc) => doc.status === "Vencido" && !openIds.has(doc.id)).length,
    [documents, openIds]
  );

  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();
    documents.forEach((doc) => {
      if (!map.has(doc.typeId)) map.set(doc.typeId, doc.typeName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [documents]);

  const eligible = useMemo(
    () =>
      documents.filter(
        (doc) => doc.status !== "Vencido" && !openIds.has(doc.id) && canRequestRenewal(doc)
      ),
    [documents, openIds]
  );

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = search.replace(/\D/g, "");
    return eligible
      .filter((doc) => (typeFilter ? doc.typeId === typeFilter : true))
      .filter((doc) => {
        if (!term) return true;
        const cpf = doc.collaboratorId ? cpfByCollaborator.get(doc.collaboratorId) || "" : "";
        const matchText = [
          doc.name,
          doc.typeName,
          doc.collaboratorName,
          doc.collaboratorRole,
          doc.establishment,
          cpf,
        ].some((value) => (value || "").toLowerCase().includes(term));
        const matchCpf = digits.length >= 3 && cpf.replace(/\D/g, "").includes(digits);
        return matchText || matchCpf;
      })
      .sort((a, b) => {
        const da = daysUntilExpiry(a.expiresAt);
        const db = daysUntilExpiry(b.expiresAt);
        if (da === null && db === null) return a.name.localeCompare(b.name, "pt-BR");
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
  }, [eligible, search, typeFilter, cpfByCollaborator]);

  const handleClose = () => {
    setSearch("");
    setTypeFilter("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      icon="ri-add-circle-line"
      title="Nova solicitação de renovação"
      subtitle="Antecipe a renovação de um documento que ainda vai vencer."
      footer={
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-close-line"></i>
          Fechar
        </button>
      }
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-secondary-200 bg-secondary-50 px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
          <i className="ri-information-line text-base"></i>
        </span>
        <p className="text-[11px] leading-relaxed text-foreground-700">
          A solicitação nasce com <strong className="font-semibold">número próprio</strong>, responsável,
          prazo (SLA) do tipo de documento e checklist de tarefas. Documentos já vencidos abrem tratativa
          automaticamente e documentos com solicitação em aberto não aparecem nesta lista.
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center rounded-lg border border-background-300 bg-background-50 pl-1 pr-2 transition-colors focus-within:border-primary-400">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground-400">
            <i className="ri-search-line text-sm"></i>
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por documento, tipo, colaborador ou CPF..."
            aria-label="Buscar documento por nome, tipo, colaborador ou CPF"
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

        <div className="relative min-w-0 sm:w-64">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filtrar por tipo de documento"
            className="w-full appearance-none rounded-lg border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
          >
            <option value="">Todos os tipos</option>
            {typeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-100 px-2 py-1 text-foreground-600">
          <i className="ri-checkbox-blank-circle-line"></i>
          {eligible.length} disponível(is)
        </span>
        {alreadyRequested > 0 && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-100 px-2 py-1 text-secondary-900">
            <i className="ri-loop-right-line"></i>
            {alreadyRequested} já com solicitação aberta
          </span>
        )}
        {expiredWithoutRequest > 0 && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-100 px-2 py-1 text-accent-900">
            <i className="ri-alarm-warning-line"></i>
            {expiredWithoutRequest} vencido(s) aguardando abertura automática
          </span>
        )}
      </div>

      <div className="mt-3 max-h-[420px] overflow-y-auto rounded-xl border border-background-200">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-background-100 text-foreground-500">
              <i className="ri-file-search-line text-lg"></i>
            </span>
            <p className="text-sm font-semibold text-foreground-800">
              Nenhum documento disponível para nova solicitação
            </p>
            <p className="max-w-md text-xs leading-relaxed text-foreground-500">
              Todos os documentos que ainda não venceram já possuem solicitação em andamento, ou a busca não
              encontrou nenhum resultado. Ajuste o termo ou o tipo de documento.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-background-200">
            {list.map((doc) => {
              const days = daysUntilExpiry(doc.expiresAt);
              const cpf = doc.collaboratorId ? cpfByCollaborator.get(doc.collaboratorId) || "" : "";
              return (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2.5 px-3.5 py-3 transition-colors hover:bg-background-100/60 sm:flex-row sm:items-center"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${fileIconTone[doc.fileType]}`}
                  >
                    <i className={`${fileIcon[doc.fileType]} text-base`}></i>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground-950">{doc.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-foreground-500">
                      {doc.typeName}
                      {doc.collaboratorName ? ` · ${doc.collaboratorName}` : " · documento da empresa"}
                      {cpf ? ` · CPF ${cpf}` : ""}
                      {doc.establishment ? ` · ${doc.establishment}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-background-100 px-2 py-0.5 text-[10px] font-semibold text-foreground-600">
                        <i className="ri-calendar-line"></i>
                        Validade {doc.expiresAt}
                      </span>
                      {days !== null && (
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            days <= 30 ? "bg-accent-100 text-accent-900" : "bg-secondary-100 text-secondary-900"
                          }`}
                        >
                          <i className="ri-timer-line"></i>
                          {expiryDaysLabel(days)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("");
                      onCreate(doc);
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary-500 px-3 py-2 text-xs font-semibold text-background-50 transition-colors hover:bg-primary-600"
                  >
                    <i className="ri-add-line"></i>
                    Solicitar renovação
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-foreground-500">
        Mostrando <strong className="font-semibold text-foreground-800">{list.length}</strong> documento(s) ·
        a lista é ordenada pelo vencimento mais próximo.
      </p>
    </Modal>
  );
}