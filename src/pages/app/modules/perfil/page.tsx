import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard, StatusPill } from "@/pages/app/components/ui";
import CreateSignatureModal from "@/pages/app/components/CreateSignatureModal";
import SignatureStamp from "@/components/base/SignatureStamp";
import { getInitials, useAppSession } from "@/pages/app/context";
import { collaborators } from "@/mocks/collaborators";
import {
  removeSignature,
  useCollaboratorSignature,
  useSignatureHistory,
  type SignatureHistoryEntry,
} from "@/pages/app/signature/signatureStore";
import { getSignatureFont } from "@/pages/app/signature/signatureFonts";
import { resolveSignatureName } from "@/pages/app/signature/signatureUtils";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modelLabel(entry: SignatureHistoryEntry): string {
  if (entry.kind === "draw") return "Desenhada à mão";
  return `Modelo ${getSignatureFont(entry.fontModel).label}`;
}

export default function MeusDadosPage() {
  const session = useAppSession();
  const me = collaborators.find((c) => c.name === session.name) || collaborators.find((c) => c.email === session.email);
  const config = useCollaboratorSignature(me?.id);
  const history = useSignatureHistory(me?.id);
  const [modalOpen, setModalOpen] = useState(false);

  if (!me) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="rounded-lg border border-background-200 bg-background-50 p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-user-search-line text-2xl"></i>
          </span>
          <p className="mt-4 text-sm font-semibold text-foreground-800">Perfil de colaborador não localizado</p>
          <p className="mt-1 text-xs text-foreground-500">
            Este perfil é exibido para usuários com o papel de Colaborador.
          </p>
        </div>
      </div>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: "Função", value: me.role },
    { label: "Área / Setor", value: me.area },
    { label: "CPF", value: me.cpf },
    { label: "RG", value: me.rg },
    { label: "PIS / PASEP", value: me.pis },
    { label: "CTPS", value: me.ctps },
    { label: "Data de admissão", value: me.admissionDate },
    { label: "Data de nascimento", value: me.birthDate },
    { label: "Celular", value: me.phone },
    { label: "E-mail", value: me.email },
    { label: "Cidade / UF", value: me.city },
  ];

  const handleRemove = () => {
    void removeSignature({ collaboratorId: me.id, collaboratorName: me.name, collaboratorEmail: me.email });
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-user-settings-line"></i>
            Meu espaço
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-foreground-950 md:text-3xl">
            Meus dados
          </h1>
          <p className="mt-1.5 text-sm text-foreground-600">
            Confira seus dados cadastrais e crie a assinatura usada em todos os documentos.
          </p>
        </div>
      </div>

      {/* Cartão do perfil */}
      <div className="mt-7 flex flex-col gap-5 rounded-lg border border-background-200 bg-background-50 p-5 sm:flex-row sm:items-center md:p-6">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-background-200 bg-background-100">
          <img src={me.photo} alt={me.name} className="h-full w-full object-top" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-xl font-extrabold tracking-tight text-foreground-950">{me.name}</h2>
          <p className="mt-0.5 text-sm text-foreground-600">
            {me.role} · {me.area}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusPill status={me.status} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-700">
              <i className="ri-building-2-line"></i>
              {session.company}
            </span>
          </div>
        </div>
      </div>

      {/* Assinatura */}
      <div className="mt-6">
        <SectionCard
          title="Minha assinatura"
          subtitle="Assinatura eletrônica usada em documentos, treinamentos e DDS que você assina"
          action={
            config ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
              >
                <i className="ri-edit-line text-base"></i>
                Editar assinatura
              </button>
            ) : null
          }
        >
          {config ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex min-h-[104px] items-center justify-center rounded-lg border border-dashed border-primary-300 bg-primary-50 px-6 py-4">
                  <SignatureStamp
                    name={me.name}
                    font={config.fontModel}
                    nameStyle={config.nameStyle}
                    imageData={config.imageData}
                    size={48}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
                    <i className="ri-quill-pen-line"></i>
                    {config.kind === "draw" ? "Desenhada à mão" : `Modelo ${getSignatureFont(config.fontModel).label}`}
                  </span>
                  {config.kind === "typographic" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-3 py-1 text-[11px] font-semibold text-foreground-700">
                      <i className="ri-user-line"></i>
                      {config.nameStyle === "full" ? "Nome completo" : "Nome parcial"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold text-primary-700">
                    <i className="ri-verified-badge-line"></i>
                    Ativa · versão {config.version}
                  </span>
                  {config.termAcceptedAt && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-semibold text-accent-800">
                      <i className="ri-shield-check-line"></i>
                      Termo aceito em {formatDateTime(config.termAcceptedAt)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-foreground-400">
                  Representação visual registrada: {resolveSignatureName(me.name, config.nameStyle)}. Esta representação
                  é visual e não substitui a autenticação nem a manifestação de vontade, registradas a cada documento
                  confirmado.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 lg:w-56">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
                >
                  <i className="ri-pen-nib-line text-base"></i>
                  Editar assinatura
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                >
                  <i className="ri-delete-bin-line text-base"></i>
                  Remover assinatura
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-background-300 px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <i className="ri-quill-pen-line text-2xl"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-800">Você ainda não ativou sua assinatura</p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-foreground-500">
                  Desenhe a sua assinatura ou escolha um modelo de escrita do seu nome. Antes de ativar, você lerá e
                  aceitará o termo de adesão à assinatura eletrônica.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-5 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
              >
                <i className="ri-add-line text-base"></i>
                Criar assinatura
              </button>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Histórico de versões */}
      {history.length > 0 && (
        <div className="mt-6">
          <SectionCard
            title="Histórico da assinatura"
            subtitle="Todas as versões ficam preservadas — inclusive as substituídas — com a imagem usada em cada período"
          >
            <ul className="flex flex-col gap-3">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-100 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-background-200 bg-background-50 px-2">
                    <SignatureStamp
                      name={me.name}
                      font={entry.fontModel}
                      nameStyle={entry.nameStyle}
                      imageData={entry.imageData}
                      size={26}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground-950">Versão {entry.version}</span>
                      {entry.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
                          <i className="ri-checkbox-circle-line"></i>
                          Atual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-background-200 px-2.5 py-0.5 text-[11px] font-semibold text-foreground-600">
                          <i className="ri-history-line"></i>
                          Substituída
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-foreground-500">
                      {modelLabel(entry)} · Criada em {formatDateTime(entry.createdAt)}
                      {entry.supersededAt ? ` · Substituída em ${formatDateTime(entry.supersededAt)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}

      {/* Dados cadastrais */}
      <div className="mt-6">
        <SectionCard
          title="Dados cadastrais"
          subtitle="Informações registradas no seu cadastro"
          action={
            <Link
              to="/app/minhaepi"
              className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3.5 py-2 text-xs font-semibold text-foreground-800 transition-colors hover:bg-background-100 sm:flex"
            >
              <i className="ri-shirt-line"></i>
              Minha ficha de EPI
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <div key={row.label} className="rounded-lg border border-background-200 bg-background-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">{row.label}</p>
                <p className="mt-1 text-sm font-medium text-foreground-900">{row.value || "—"}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[11px] text-foreground-400">
            <i className="ri-information-line"></i>
            Precisa ajustar algum dado? Fale com o SESMT/Administrador da sua empresa.
            {" "}
            <span className="hidden sm:inline">Identificação interna: {getInitials(me.name)}-{me.id.toUpperCase()}</span>
          </p>
        </SectionCard>
      </div>

      <CreateSignatureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        collaboratorId={me.id}
        collaboratorName={me.name}
        collaboratorEmail={me.email}
        initial={config}
      />
    </div>
  );
}