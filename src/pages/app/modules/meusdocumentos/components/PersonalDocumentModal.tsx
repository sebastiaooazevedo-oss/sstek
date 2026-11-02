import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { escapeHtml, pdfFooter, pdfHeader, printHtml } from "@/pages/app/utils/exportPdf";
import type { Collaborator } from "@/mocks/collaborators";

export type PersonalDocumentKind = "contrato" | "ficha";

interface PersonalDocumentModalProps {
  kind: PersonalDocumentKind | null;
  collaborator: Collaborator | null;
  companyName: string;
  onClose: () => void;
}

const titleOf: Record<PersonalDocumentKind, string> = {
  contrato: "Contrato de Trabalho",
  ficha: "Ficha Cadastral",
};

function contractBody(collaborator: Collaborator, companyName: string): string {
  return `${pdfHeader("Contrato de Trabalho · cópia digital")}
    <h1>Contrato Individual de Trabalho</h1>
    <p class="muted">Cópia digital disponibilizada ao colaborador para consulta. O documento original assinado fica arquivado sob a responsabilidade do empregador.</p>
    <h2>Empregador</h2>
    <div class="grid">
      <div><strong>Empresa:</strong> ${escapeHtml(companyName)}</div>
      <div><strong>Local de trabalho:</strong> ${escapeHtml(collaborator.establishment) || "—"}</div>
    </div>
    <h2>Empregado</h2>
    <div class="grid">
      <div><strong>Nome:</strong> ${escapeHtml(collaborator.name)}</div>
      <div><strong>CPF:</strong> ${escapeHtml(collaborator.cpf) || "—"}</div>
      <div><strong>RG:</strong> ${escapeHtml(collaborator.rg) || "—"}</div>
      <div><strong>PIS/PASEP:</strong> ${escapeHtml(collaborator.pis) || "—"}</div>
      <div><strong>CTPS:</strong> ${escapeHtml(collaborator.ctps) || "—"}</div>
      <div><strong>Admissão:</strong> ${escapeHtml(collaborator.admissionDate) || "—"}</div>
    </div>
    <h2>Condições contratuais</h2>
    <div class="grid">
      <div><strong>Função:</strong> ${escapeHtml(collaborator.role) || "—"}</div>
      <div><strong>Setor:</strong> ${escapeHtml(collaborator.area) || "—"}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(collaborator.establishment) || "—"}</div>
      <div><strong>Matrícula:</strong> ${escapeHtml(collaborator.matricula) || "—"}</div>
    </div>
    <h2>Cláusulas resumidas</h2>
    <p>O empregado exercerá as atribuições da função contratada, cumprindo a jornada e o regime de trabalho definidos pelo empregador, observadas as normas de segurança e saúde ocupacional da empresa.</p>
    <p>O uso correto dos Equipamentos de Proteção Individual, a participação em treinamentos, o cumprimento das Análises Preliminares de Risco (APR) e das Ordens de Serviço são condições indispensáveis para o exercício da atividade.</p>
    <p>Alterações de função, jornada ou local de trabalho serão formalizadas por termo próprio e refletidas nesta cópia digital.</p>
    ${pdfFooter()}`;
}

function fichaBody(collaborator: Collaborator, companyName: string): string {
  return `${pdfHeader("Ficha Cadastral · cópia digital")}
    <h1>Ficha Cadastral do Colaborador</h1>
    <p class="muted">Dados cadastrais registrados pela gestão de pessoas. Solicite ao SESMT qualquer correção necessária.</p>
    <h2>Identificação</h2>
    <div class="grid">
      <div><strong>Nome:</strong> ${escapeHtml(collaborator.name)}</div>
      <div><strong>Matrícula:</strong> ${escapeHtml(collaborator.matricula) || "—"}</div>
      <div><strong>CPF:</strong> ${escapeHtml(collaborator.cpf) || "—"}</div>
      <div><strong>RG:</strong> ${escapeHtml(collaborator.rg) || "—"}</div>
      <div><strong>PIS/PASEP:</strong> ${escapeHtml(collaborator.pis) || "—"}</div>
      <div><strong>CTPS:</strong> ${escapeHtml(collaborator.ctps) || "—"}</div>
      <div><strong>Nascimento:</strong> ${escapeHtml(collaborator.birthDate) || "—"}</div>
      <div><strong>Admissão:</strong> ${escapeHtml(collaborator.admissionDate) || "—"}</div>
    </div>
    <h2>Vínculo</h2>
    <div class="grid">
      <div><strong>Empresa:</strong> ${escapeHtml(companyName)}</div>
      <div><strong>Função:</strong> ${escapeHtml(collaborator.role) || "—"}</div>
      <div><strong>Setor:</strong> ${escapeHtml(collaborator.area) || "—"}</div>
      <div><strong>Unidade:</strong> ${escapeHtml(collaborator.establishment) || "—"}</div>
      <div><strong>Situação:</strong> ${escapeHtml(collaborator.status)}</div>
    </div>
    <h2>Contato</h2>
    <div class="grid">
      <div><strong>Celular:</strong> ${escapeHtml(collaborator.phone) || "—"}</div>
      <div><strong>E-mail:</strong> ${escapeHtml(collaborator.email) || "—"}</div>
      <div><strong>Cidade / UF:</strong> ${escapeHtml(collaborator.city) || "—"}</div>
    </div>
    ${pdfFooter()}`;
}

export default function PersonalDocumentModal({
  kind,
  collaborator,
  companyName,
  onClose,
}: PersonalDocumentModalProps) {
  if (!kind || !collaborator) return null;

  const rows: { label: string; value: string }[] =
    kind === "contrato"
      ? [
          { label: "Empresa", value: companyName },
          { label: "Colaborador", value: collaborator.name },
          { label: "Função", value: collaborator.role },
          { label: "Setor", value: collaborator.area },
          { label: "Unidade", value: collaborator.establishment },
          { label: "Admissão", value: collaborator.admissionDate },
          { label: "CPF", value: collaborator.cpf },
          { label: "CTPS", value: collaborator.ctps },
        ]
      : [
          { label: "Nome", value: collaborator.name },
          { label: "Matrícula", value: collaborator.matricula },
          { label: "CPF", value: collaborator.cpf },
          { label: "RG", value: collaborator.rg },
          { label: "PIS/PASEP", value: collaborator.pis },
          { label: "Nascimento", value: collaborator.birthDate },
          { label: "Admissão", value: collaborator.admissionDate },
          { label: "Função", value: collaborator.role },
          { label: "Setor", value: collaborator.area },
          { label: "Unidade", value: collaborator.establishment },
          { label: "Celular", value: collaborator.phone },
          { label: "E-mail", value: collaborator.email },
          { label: "Cidade / UF", value: collaborator.city },
        ];

  const handlePrint = () => {
    const body =
      kind === "contrato"
        ? contractBody(collaborator, companyName)
        : fichaBody(collaborator, companyName);
    printHtml(`${titleOf[kind]} — ${collaborator.name}`, body);
  };

  return (
    <Modal
      open={!!kind}
      onClose={onClose}
      title={titleOf[kind]}
      subtitle="Cópia digital para consulta e download. Não é possível excluir o documento original."
      icon={kind === "contrato" ? "ri-file-user-line" : "ri-id-card-line"}
      size="lg"
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-semibold text-secondary-900">
            <i className="ri-shield-check-line"></i>
            Documento oficial da empresa
          </span>
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Fechar
          </ModalButton>
          <ModalButton onClick={handlePrint} icon="ri-printer-line">
            Imprimir / salvar PDF
          </ModalButton>
        </>
      }
    >
      <div className="rounded-lg border border-background-200 bg-background-50 p-5">
        <div className="border-b border-background-200 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">{companyName}</p>
          <h4 className="mt-1 font-heading text-lg font-extrabold tracking-tight text-foreground-950">
            {titleOf[kind]}
          </h4>
          <p className="mt-0.5 text-xs text-foreground-500">{collaborator.name}</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-md bg-background-100 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">{row.label}</p>
              <p className="mt-0.5 text-sm font-medium text-foreground-900">{row.value || "—"}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-md bg-primary-50 px-3 py-2.5 text-[11px] leading-relaxed text-primary-800">
          <i className="ri-information-line mt-0.5 text-sm"></i>
          {kind === "contrato"
            ? "Esta é uma cópia digital do seu contrato. O documento assinado permanece arquivado com a empresa e não pode ser apagado."
            : "Confira seus dados. Se algo estiver incorreto, fale com o SESMT/Administrador da sua empresa para corrigir o cadastro."}
        </p>
      </div>
    </Modal>
  );
}