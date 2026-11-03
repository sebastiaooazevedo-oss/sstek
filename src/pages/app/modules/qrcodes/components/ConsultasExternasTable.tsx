import {
  formatConsultaCpf,
  formatConsultaDateTime,
  type ConsultaExterna,
} from "@/pages/app/modules/qrcodes/consultasExternasApi";

interface ConsultasExternasTableProps {
  consultas: ConsultaExterna[];
  /** Quantidade total carregada (para diferenciar "sem dados" de "filtro vazio"). */
  total: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Nome do colaborador dono da ficha consultada. */
  nomeColaborador: (ref: string | null) => string;
}

function dataHora(value: string): { data: string; hora: string } {
  const full = formatConsultaDateTime(value);
  return full === "—" ? { data: "—", hora: "" } : { data: full.slice(0, 10), hora: full.slice(11) };
}

export default function ConsultasExternasTable({
  consultas,
  total,
  loading,
  error,
  onRetry,
  nomeColaborador,
}: ConsultasExternasTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
        <p className="text-xs font-medium text-foreground-500">Carregando consultas registradas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-danger-100 text-danger-700">
          <i className="ri-error-warning-line text-2xl"></i>
        </span>
        <p className="text-sm font-semibold text-foreground-900">Não foi possível carregar as consultas</p>
        <p className="max-w-[56ch] text-xs leading-relaxed text-foreground-500">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3.5 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
        >
          <i className="ri-refresh-line"></i>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (consultas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
          <i className="ri-file-search-line text-2xl"></i>
        </span>
        <p className="text-sm font-semibold text-foreground-800">
          {total === 0 ? "Nenhuma consulta externa registrada" : "Nenhuma consulta encontrada"}
        </p>
        <p className="max-w-[56ch] text-xs leading-relaxed text-foreground-500">
          {total === 0
            ? "Cada leitura do QR-Code que passar pela identificação do consultante e pelo aceite do termo LGPD fica registrada aqui, com nome, órgão, CPF, finalidade e data/hora."
            : "Ajuste a busca, o período ou os filtros de colaborador e órgão para localizar o registro."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left">
        <thead>
          <tr className="border-b border-background-200 bg-background-100">
            {["Protocolo", "Data", "Hora", "Colaborador (ficha)", "Quem consultou", "CPF", "Órgão / empresa", "Finalidade", "Termo"].map((title) => (
              <th
                key={title}
                className="whitespace-nowrap px-4 py-3 text-[10.5px] font-bold uppercase tracking-wide text-foreground-500"
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {consultas.map((consulta) => (
            <tr
              key={consulta.id}
              className="border-b border-background-200/70 last:border-b-0 hover:bg-background-100/60"
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] font-bold text-foreground-900">
                {consulta.protocolo || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-foreground-700">
                {dataHora(consulta.createdAt).data}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-foreground-700">
                {dataHora(consulta.createdAt).hora}
              </td>
              <td className="px-4 py-3">
                <p className={`text-xs font-semibold ${consulta.colaboradorRef ? "text-foreground-950" : "text-accent-800"}`}>
                  {nomeColaborador(consulta.colaboradorRef)}
                </p>
                <p className="font-mono text-[10px] text-foreground-400">QR {consulta.codigoQr}</p>
              </td>
              <td className="px-4 py-3 text-xs font-semibold text-foreground-950">{consulta.nome || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] font-semibold text-foreground-800">
                {formatConsultaCpf(consulta.cpf)}
              </td>
              <td className="max-w-[220px] px-4 py-3 text-xs text-foreground-700">{consulta.orgao || "—"}</td>
              <td className="max-w-[260px] px-4 py-3 text-xs leading-relaxed text-foreground-600">
                {consulta.finalidade || <span className="text-foreground-400">Não informada</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    consulta.termoPersonalizado
                      ? "bg-primary-100 text-primary-800"
                      : "bg-background-200 text-foreground-600"
                  }`}
                >
                  <i className={consulta.termoPersonalizado ? "ri-building-4-line" : "ri-file-text-line"}></i>
                  {consulta.termoPersonalizado ? "Empresa" : "Padrão"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}