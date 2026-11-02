import { useEffect, useState } from "react";
import Modal, { ModalButton } from "@/pages/app/components/Modal";
import { collaboratorEstablishments, type Collaborator } from "@/mocks/collaborators";

interface ImportCollaboratorsModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (collaborators: Collaborator[]) => void;
}

const columns = ["Nome", "CPF", "Matrícula", "RG", "PIS", "CTPS", "Função", "Admissão", "Nascimento", "Celular", "E-mail", "Estabelecimento"];

interface ImportRow {
  name: string;
  role: string;
  area: string;
  cpf: string;
  establishment: string;
}

/** Linhas de exemplo simulando o conteúdo de um arquivo .xlsx já validado. */
const sampleRows: ImportRow[] = [
  { name: "Bruno Camargo", role: "Operador de Prensa", area: "Produção", cpf: "301.774.220-88", establishment: collaboratorEstablishments[0] },
  { name: "Simone Alves", role: "Auxiliar de Expedição", area: "Logística", cpf: "288.551.007-13", establishment: collaboratorEstablishments[1] },
  { name: "Alexandre Pires", role: "Soldador", area: "Produção", cpf: "199.220.845-40", establishment: collaboratorEstablishments[2] },
];

export default function ImportCollaboratorsModal({ open, onClose, onImport }: ImportCollaboratorsModalProps) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>(sampleRows);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFileName("");
      setRows(sampleRows);
      setError("");
    }
  }, [open]);

  const reset = () => {
    setFileName("");
    setRows(sampleRows);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const setRowUnit = (index: number, establishment: string) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, establishment } : row)));

  const handleImport = () => {
    if (!fileName) {
      setError("Selecione um arquivo .xlsx antes de importar.");
      return;
    }
    const imported: Collaborator[] = rows.map((item, index) => ({
      id: `c-imp-${Date.now()}-${index}`,
      name: item.name,
      role: item.role,
      area: item.area,
      establishment: item.establishment || undefined,
      cpf: item.cpf,
      matricula: `9${String(index + 1).padStart(4, "0")}`,
      rg: "—",
      pis: "—",
      ctps: "—",
      admissionDate: "01/09/2026",
      birthDate: "—",
      phone: "—",
      email: `${item.name.split(" ")[0].toLowerCase()}@vega.com.br`,
      city: "São Paulo/SP",
      status: "Ativo",
      photo:
        "/images/0fb07bd0da.jpg",
      documentsOk: 0,
      documentsTotal: 9,
      trainingsActive: 0,
      trainingsExpired: 0,
      episInUse: 0,
    }));
    onImport(imported);
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      icon="ri-file-excel-2-line"
      title="Importar colaboradores por planilha"
      subtitle="Envie um arquivo .xlsx com as colunas do banco de dados"
      footer={
        <>
          <ModalButton variant="ghost" onClick={handleClose}>
            Cancelar
          </ModalButton>
          <ModalButton icon="ri-upload-2-line" onClick={handleImport}>
            Importar {fileName ? "planilha" : ""}
          </ModalButton>
        </>
      }
    >
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-background-300 bg-background-100 px-6 py-10 text-center transition-colors hover:border-primary-400">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-file-excel-2-line text-2xl"></i>
        </span>
        <span className="mt-1 text-sm font-semibold text-foreground-900">
          {fileName || "Clique para selecionar a planilha .xlsx"}
        </span>
        <span className="text-xs text-foreground-500">Somente arquivos .xlsx exportados no modelo do SSTEK</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setFileName(file.name);
              setError("");
            }
          }}
        />
      </label>

      {fileName && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">
              Colaboradores identificados na planilha
            </p>
            <p className="text-[11px] text-foreground-400">Ajuste a unidade de cada linha, se necessário</p>
          </div>
          <div className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <div
                key={`${row.cpf}-${index}`}
                className="flex flex-col gap-3 rounded-lg border border-background-200 bg-background-50 p-3 sm:flex-row sm:items-center"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-xs font-bold text-secondary-900">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground-900">{row.name}</p>
                  <p className="truncate text-xs text-foreground-500">
                    {row.role} · {row.area}
                  </p>
                </div>
                <div className="relative sm:w-64">
                  <select
                    value={row.establishment}
                    onChange={(e) => setRowUnit(index, e.target.value)}
                    className="w-full appearance-none rounded-md border border-background-300 bg-background-50 py-2.5 pl-3 pr-9 text-sm text-foreground-900 outline-none focus:border-primary-400"
                  >
                    <option value="">Sem unidade</option>
                    {collaboratorEstablishments.map((est) => (
                      <option key={est} value={est}>
                        {est}
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400"></i>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Colunas esperadas no arquivo</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {columns.map((col) => (
            <span key={col} className="rounded-md bg-secondary-100 px-2.5 py-1 text-xs font-medium text-secondary-900">
              {col}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-background-200 bg-background-50 p-4">
        <i className="ri-information-line mt-0.5 text-lg text-secondary-700"></i>
        <p className="text-xs leading-relaxed text-foreground-600">
          Os colaboradores importados entram como <strong className="font-semibold text-foreground-800">Ativos</strong> e sem
          documentação, cada um com a unidade indicada na planilha (que você pode ajustar acima). Depois você pode vincular
          documentos e a ficha de EPI de cada um.
        </p>
      </div>
    </Modal>
  );
}