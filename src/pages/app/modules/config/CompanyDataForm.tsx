import { useEffect, useState } from "react";
import { useAppSession } from "@/pages/app/context";
import { updateSetting, useSystemSettings, type SystemSettings } from "@/pages/app/settings/settingsStore";

interface FieldConfig {
  key: keyof SystemSettings;
  label: string;
  placeholder: string;
  hint?: string;
  maxLength?: number;
  full?: boolean;
}

const FIELDS: FieldConfig[] = [
  {
    key: "companyLegalName",
    label: "Razão social",
    placeholder: "Ex.: Metalúrgica Vega Ltda.",
    maxLength: 120,
    full: true,
  },
  {
    key: "companyCnpj",
    label: "CNPJ",
    placeholder: "00.000.000/0000-00",
    maxLength: 18,
  },
  {
    key: "technicalRegistration",
    label: "Registro profissional",
    placeholder: "Ex.: CREA-SP 5070123456",
    maxLength: 40,
  },
  {
    key: "technicalResponsible",
    label: "Responsável técnico",
    placeholder: "Ex.: Eng.ª Marina Alves",
    hint: "Nome exibido como responsável nas assinaturas dos relatórios.",
    full: true,
  },
  {
    key: "sesmtPhone",
    label: "Telefone do SESMT",
    placeholder: "Ex.: (11) 4002-8922",
    hint: "Aparece no selo do capacete e no comprovante do QR-Code quando a CIPA não tem membro de SESMT.",
    maxLength: 20,
    full: true,
  },
];

/**
 * Dados cadastrais da empresa usados no cabeçalho e nas assinaturas de todos
 * os relatórios do sistema. A gravação ocorre ao sair do campo, evitando uma
 * requisição a cada tecla digitada.
 */
export default function CompanyDataForm() {
  const session = useAppSession();
  const settings = useSystemSettings();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft({
      companyLegalName: settings.companyLegalName,
      companyCnpj: settings.companyCnpj,
      technicalResponsible: settings.technicalResponsible,
      technicalRegistration: settings.technicalRegistration,
      sesmtPhone: settings.sesmtPhone,
    });
  }, [
    settings.companyLegalName,
    settings.companyCnpj,
    settings.technicalResponsible,
    settings.technicalRegistration,
    settings.sesmtPhone,
  ]);

  const commit = async (key: keyof SystemSettings) => {
    const value = (draft[key] ?? "").trim();
    if (value === settings[key]) return;
    setError("");
    const result = await updateSetting(key, value as SystemSettings[typeof key], { name: session.name });
    if (!result.ok) {
      setError(result.error || "Não foi possível salvar este campo.");
      setDraft((prev) => ({ ...prev, [key]: settings[key] as string }));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
      {FIELDS.map((field) => (
        <div key={field.key} className={field.full ? "md:col-span-2" : ""}>
          <label className="text-xs font-semibold text-foreground-800" htmlFor={`company-${field.key}`}>
            {field.label}
          </label>
          <input
            id={`company-${field.key}`}
            type="text"
            value={draft[field.key] ?? ""}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
            onBlur={() => void commit(field.key)}
            className="mt-1.5 w-full rounded-md border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition-colors placeholder:text-foreground-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          {field.hint && <p className="mt-1.5 text-[11px] text-foreground-500">{field.hint}</p>}
        </div>
      ))}

      <div className="flex items-start gap-2.5 rounded-md border border-background-200 bg-background-100 px-3.5 py-3 text-xs text-foreground-600 md:col-span-2">
        <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
        <span>
          Esses dados aparecem no cabeçalho e nas assinaturas de todos os relatórios em PDF, além do comprovante público
          de fiscalização aberto pelo QR-Code.
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-300 bg-accent-50 px-3.5 py-3 text-xs text-accent-900 md:col-span-2 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
          <i className="ri-error-warning-line mt-0.5 text-base"></i>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}