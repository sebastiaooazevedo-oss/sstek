import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import { formatCnpj, isValidCnpj, normalizeSubdomain, validateOnboarding } from "@shared/onboarding";
import { toggleableModules } from "@/core/modules/registry";
import { PLAN_IDS, PLAN_PRESETS, type PlanId } from "@/core/plans";
import { ROOT_DOMAIN, tenantHost } from "@/core/domain";
import { accessProfileTemplates, templatePermissions } from "@/pages/app/permissions/accessProfileTemplates";
import {
  PlatformApiError,
  platformApi,
  type OnboardingPayload,
  type OnboardingResponse,
  type SubdomainCheck,
} from "@/pages/app/modules/plataforma/platformApi";

/**
 * Assistente de nova empresa.
 *
 * Cria, numa única operação no servidor, tudo o que uma empresa precisa para o
 * primeiro acesso: cadastro, endereço, módulos do plano, licença, unidade
 * principal, dados do responsável técnico, perfis de acesso e o administrador
 * (por convite ou senha). Se qualquer passo falhar, nada fica gravado.
 */

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (message: string) => Promise<void> | void;
}

const STEPS = [
  { id: "empresa", label: "Empresa", icon: "ri-building-2-line" },
  { id: "plano", label: "Plano", icon: "ri-stack-line" },
  { id: "unidade", label: "Unidade", icon: "ri-map-pin-2-line" },
  { id: "perfis", label: "Perfis", icon: "ri-shield-user-line" },
  { id: "admin", label: "Administrador", icon: "ri-user-star-line" },
  { id: "revisao", label: "Revisão", icon: "ri-checkbox-circle-line" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/** Campos de cada etapa, para levar o usuário à etapa com erro. */
const FIELD_STEP: Record<string, StepId> = {
  "company.name": "empresa",
  "company.legalName": "empresa",
  "company.cnpj": "empresa",
  "company.subdomain": "empresa",
  "license.monthlyValue": "plano",
  "license.seats": "plano",
  "establishment.riskGrade": "unidade",
  "establishment.state": "unidade",
  "admin.name": "admin",
  "admin.email": "admin",
  "admin.password": "admin",
};

function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const money = (value: number) =>
  value > 0 ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Sob consulta";

export default function OnboardingWizard({ open, onClose, onCreated }: OnboardingWizardProps) {
  const [step, setStep] = useState<StepId>("empresa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<OnboardingResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Empresa
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [subTouched, setSubTouched] = useState(false);
  const [subCheck, setSubCheck] = useState<SubdomainCheck | null>(null);
  const [notes, setNotes] = useState("");

  // Plano
  const [plan, setPlan] = useState<PlanId>("S2");
  const [modules, setModules] = useState<Record<string, boolean>>(PLAN_PRESETS.S2.modules);
  const [monthlyValue, setMonthlyValue] = useState(String(PLAN_PRESETS.S2.monthlyValue));
  const [seats, setSeats] = useState(String(PLAN_PRESETS.S2.seats));
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Unidade e responsável técnico
  const [estName, setEstName] = useState("Matriz");
  const [estCode, setEstCode] = useState("MATRIZ");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [riskGrade, setRiskGrade] = useState("");
  const [techName, setTechName] = useState("");
  const [techRegistration, setTechRegistration] = useState("");
  const [sesmtPhone, setSesmtPhone] = useState("");

  // Perfis
  const [profileKeys, setProfileKeys] = useState<string[]>(accessProfileTemplates.map((t) => t.key));

  // Administrador
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminMode, setAdminMode] = useState<"invite" | "password">("invite");
  const [adminPassword, setAdminPassword] = useState("");

  // Subdomínio sugerido a partir do nome, até o usuário editar à mão.
  useEffect(() => {
    if (!subTouched) setSubdomain(normalizeSubdomain(name).slice(0, 30));
  }, [name, subTouched]);

  // Conferência de disponibilidade com pausa de digitação.
  useEffect(() => {
    const value = normalizeSubdomain(subdomain);
    setSubCheck(null);
    if (value.length < 3) return;
    let active = true;
    const timer = setTimeout(() => {
      platformApi
        .checkSubdomain(value)
        .then((r) => active && setSubCheck(r))
        .catch(() => active && setSubCheck(null));
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [subdomain]);

  const choosePlan = (id: PlanId) => {
    setPlan(id);
    setModules(PLAN_PRESETS[id].modules);
    setMonthlyValue(String(PLAN_PRESETS[id].monthlyValue));
    setSeats(String(PLAN_PRESETS[id].seats));
  };

  const payload: OnboardingPayload = useMemo(
    () => ({
      template: "padrao",
      company: { name, legalName, cnpj, subdomain: normalizeSubdomain(subdomain), plan, notes },
      modules,
      establishment: { name: estName, code: estCode, city, state, riskGrade },
      settings: { technicalResponsible: techName, technicalRegistration: techRegistration, sesmtPhone },
      profiles: accessProfileTemplates
        .filter((t) => profileKeys.includes(t.key))
        .map((t) => ({ name: t.name, description: t.description, icon: t.icon, permissions: templatePermissions(t) })),
      admin: { name: adminName, email: adminEmail, phone: adminPhone, mode: adminMode, password: adminPassword },
      license: { monthlyValue: Number(monthlyValue.replace(",", ".")) || 0, seats: Number(seats) || 0, billingCycle },
    }),
    [name, legalName, cnpj, subdomain, plan, notes, modules, estName, estCode, city, state, riskGrade, techName,
      techRegistration, sesmtPhone, profileKeys, adminName, adminEmail, adminPhone, adminMode, adminPassword,
      monthlyValue, seats, billingCycle]
  );

  /** Erros locais (mesmas regras do servidor) da etapa informada. */
  const stepErrors = (target: StepId): Record<string, string> => {
    const r = validateOnboarding(payload);
    const errs: Record<string, string> = r.ok ? {} : (r as { errors: Record<string, string> }).errors;
    if (target === "empresa" && subCheck && !subCheck.available && !errs["company.subdomain"]) {
      errs["company.subdomain"] = subCheck.detail;
    }
    return Object.fromEntries(Object.entries(errs).filter(([field]) => FIELD_STEP[field] === target));
  };

  const index = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    const errs = stepErrors(step);
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setError(null);
    setStep(STEPS[Math.min(index + 1, STEPS.length - 1)].id);
  };

  const goBack = () => {
    setFieldErrors({});
    setError(null);
    setStep(STEPS[Math.max(index - 1, 0)].id);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await platformApi.onboardCompany(payload);
      setResult(response);
      await onCreated(`Empresa ${name} criada em ${response.host}.`);
    } catch (err) {
      if (err instanceof PlatformApiError && Object.keys(err.fields).length) {
        setFieldErrors(err.fields);
        const first = Object.keys(err.fields)[0];
        setStep(FIELD_STEP[first] ?? "empresa");
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível criar a empresa.");
      }
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!result?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const err = (field: string) =>
    fieldErrors[field] ? <span className="text-[11px] font-medium text-accent-700">{fieldErrors[field]}</span> : null;

  if (result) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Empresa criada"
        subtitle={`${name} já pode fazer o primeiro acesso.`}
        icon="ri-checkbox-circle-line"
        size="xl"
        footer={
          <ModalButton onClick={onClose} icon="ri-check-line">
            Concluir
          </ModalButton>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Endereço da empresa</p>
            <p className="mt-1 font-mono text-base font-semibold text-primary-900">https://{result.host}</p>
          </div>
          {result.inviteLink ? (
            <div className="rounded-lg border border-background-200 bg-background-50 p-4">
              <p className="text-sm font-semibold text-foreground-900">Convite do administrador</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground-600">
                Envie este link para <strong>{adminEmail}</strong> (e-mail ou WhatsApp). Ao abrir, a pessoa cria a própria senha.
                O link vale por tempo limitado; se expirar, gere outro no botão Link de acesso, na lista de empresas.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={result.inviteLink} className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.target.select()} />
                <ModalButton onClick={() => void copyInvite()} icon={copied ? "ri-check-line" : "ri-file-copy-line"}>
                  {copied ? "Copiado" : "Copiar link"}
                </ModalButton>
              </div>
            </div>
          ) : (
            <p className="rounded-md bg-background-100 px-3 py-2.5 text-xs text-foreground-600">
              O administrador entra com o e-mail <strong>{adminEmail}</strong> e a senha definida no cadastro.
            </p>
          )}
          <div className="rounded-lg border border-background-200 p-4">
            <p className="text-sm font-semibold text-foreground-900">Próximos passos</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-foreground-700">
              <li>
                Importe a planilha de colaboradores em{" "}
                <Link to="/app/plataforma/importacao" className="font-semibold text-primary-700 underline" onClick={onClose}>
                  Importar colaboradores
                </Link>
                .
              </li>
              <li>O administrador envia a logo e o papel timbrado em Configurações da empresa.</li>
              <li>Cadastre as filiais (se houver) e os documentos obrigatórios da empresa (PGR, PCMSO, LTCAT).</li>
            </ol>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova empresa"
      subtitle="Cadastro completo em uma única operação: se algo falhar, nada fica gravado."
      icon="ri-building-2-line"
      size="2xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          {index > 0 && (
            <ModalButton variant="ghost" onClick={goBack} icon="ri-arrow-left-line" disabled={busy}>
              Voltar
            </ModalButton>
          )}
          {step === "revisao" ? (
            <ModalButton onClick={() => void submit()} icon={busy ? "ri-loader-4-line" : "ri-rocket-line"} disabled={busy}>
              {busy ? "Criando…" : "Criar empresa"}
            </ModalButton>
          ) : (
            <ModalButton onClick={goNext} icon="ri-arrow-right-line">
              Continuar
            </ModalButton>
          )}
        </>
      }
    >
      <ol className="mb-5 flex flex-wrap gap-1.5" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            aria-current={s.id === step ? "step" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              s.id === step
                ? "bg-primary-600 text-primary-50"
                : i < index
                  ? "bg-primary-100 text-primary-800"
                  : "bg-background-200 text-foreground-600"
            }`}
          >
            <i className={i < index ? "ri-check-line" : s.icon}></i>
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {step === "empresa" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome da empresa (como aparece no sistema)" required>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Construtora Alfa" />
            {err("company.name")}
          </Field>
          <Field label="Razão social" required>
            <input className={inputClass} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Construtora Alfa Ltda" />
            {err("company.legalName")}
          </Field>
          <Field label="CNPJ" required>
            <input
              className={inputClass}
              inputMode="numeric"
              value={cnpj}
              onChange={(e) => setCnpj(maskCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
            {err("company.cnpj") ??
              (cnpj.replace(/\D/g, "").length === 14 && !isValidCnpj(cnpj) ? (
                <span className="text-[11px] font-medium text-accent-700">CNPJ inválido. Confira os números.</span>
              ) : null)}
          </Field>
          <Field label="Endereço de acesso (subdomínio)" required>
            <div className="flex items-stretch overflow-hidden rounded-md border border-background-300 focus-within:border-primary-400">
              <input
                className="w-full min-w-0 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none"
                value={subdomain}
                onChange={(e) => {
                  setSubTouched(true);
                  setSubdomain(e.target.value.toLowerCase());
                }}
                placeholder="construtora-alfa"
              />
              <span className="flex items-center whitespace-nowrap bg-background-100 px-2.5 text-xs text-foreground-500">.{ROOT_DOMAIN}</span>
            </div>
            {err("company.subdomain") ??
              (subCheck ? (
                <span className={`text-[11px] font-medium ${subCheck.available ? "text-primary-700" : "text-accent-700"}`}>
                  <i className={subCheck.available ? "ri-check-line" : "ri-close-line"}></i> {subCheck.available ? `${tenantHost(subCheck.subdomain)} está livre.` : subCheck.detail}
                </span>
              ) : null)}
          </Field>
          <Field label="Observações internas" className="sm:col-span-2" hint="Visível só para a equipe da plataforma.">
            <textarea className={`${inputClass} min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      )}

      {step === "plano" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PLAN_IDS.map((id) => {
              const preset = PLAN_PRESETS[id];
              const active = plan === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => choosePlan(id)}
                  aria-pressed={active}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors ${
                    active ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500" : "border-background-300 hover:border-primary-300"
                  }`}
                >
                  <span className="text-sm font-bold text-foreground-950">{preset.name}</span>
                  <span className="text-xs font-semibold text-primary-700">{money(preset.monthlyValue)}</span>
                  <span className="text-[11px] leading-relaxed text-foreground-600">{preset.description}</span>
                </button>
              );
            })}
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground-700">Módulos contratados</p>
            <p className="text-[11px] text-foreground-500">Pré-marcados pelo plano. Ajuste se a negociação for diferente.</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {toggleableModules.map((m) => {
                const on = modules[m.key] !== false;
                return (
                  <label
                    key={m.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 ${on ? "border-primary-300 bg-primary-50/60" : "border-background-300"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary-600"
                      checked={on}
                      onChange={(e) => setModules((prev) => ({ ...prev, [m.key]: e.target.checked }))}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
                        <i className={`${m.icon} text-primary-600`}></i>
                        {m.name}
                      </span>
                      <span className="block text-[11px] leading-snug text-foreground-500">{m.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Valor mensal (R$)" hint="0 = sob consulta">
              <input className={inputClass} inputMode="decimal" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} />
              {err("license.monthlyValue")}
            </Field>
            <Field label="Limite de colaboradores" hint="0 = ilimitado">
              <input className={inputClass} inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} />
              {err("license.seats")}
            </Field>
            <Field label="Cobrança">
              <select className={selectClass} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as "monthly" | "yearly")}>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      {step === "unidade" && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-foreground-700">Unidade principal</p>
            <p className="text-[11px] text-foreground-500">Filiais podem ser cadastradas depois. O CNPJ da unidade principal é o da empresa.</p>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Nome da unidade" className="sm:col-span-2">
                <input className={inputClass} value={estName} onChange={(e) => setEstName(e.target.value)} />
              </Field>
              <Field label="Código" hint="Ex.: MATRIZ, CAMPINAS">
                <input className={inputClass} value={estCode} onChange={(e) => setEstCode(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Grau de risco (NR-4)" hint="Define a sugestão de vagas da CIPA">
                <select className={selectClass} value={riskGrade} onChange={(e) => setRiskGrade(e.target.value)}>
                  <option value="">Não informado</option>
                  {[1, 2, 3, 4].map((g) => (
                    <option key={g} value={String(g)}>
                      Grau {g}
                    </option>
                  ))}
                </select>
                {err("establishment.riskGrade")}
              </Field>
              <Field label="Cidade" className="sm:col-span-3">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="UF">
                <input className={inputClass} maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="SP" />
                {err("establishment.state")}
              </Field>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground-700">Responsável técnico de SST</p>
            <p className="text-[11px] text-foreground-500">Aparece na assinatura dos relatórios. Pode ser preenchido depois pelo administrador.</p>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Nome">
                <input className={inputClass} value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="Eng. Ana Souza" />
              </Field>
              <Field label="Registro profissional">
                <input className={inputClass} value={techRegistration} onChange={(e) => setTechRegistration(e.target.value)} placeholder="CREA-SP 000000" />
              </Field>
              <Field label="Telefone do SESMT">
                <input className={inputClass} value={sesmtPhone} onChange={(e) => setSesmtPhone(e.target.value)} placeholder="(11) 0000-0000" />
              </Field>
            </div>
          </div>
        </div>
      )}

      {step === "perfis" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-foreground-600">
            Além dos perfis Administrador e Colaborador (sempre presentes), a empresa já nasce com estes perfis prontos. Ela pode
            renomear, ajustar ou excluir depois em Perfis &amp; permissões.
          </p>
          {accessProfileTemplates.map((t) => {
            const checked = profileKeys.includes(t.key);
            return (
              <label key={t.key} className={`flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 ${checked ? "border-primary-300 bg-primary-50/60" : "border-background-300"}`}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary-600"
                  checked={checked}
                  onChange={(e) =>
                    setProfileKeys((prev) => (e.target.checked ? [...prev, t.key] : prev.filter((k) => k !== t.key)))
                  }
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
                    <i className={`${t.icon} text-primary-600`}></i>
                    {t.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-foreground-600">{t.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {step === "admin" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do administrador da empresa" required>
            <input className={inputClass} value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            {err("admin.name")}
          </Field>
          <Field label="E-mail de acesso" required>
            <input className={inputClass} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            {err("admin.email")}
          </Field>
          <Field label="Telefone">
            <input className={inputClass} value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-xs font-semibold text-foreground-700">Como o administrador vai entrar</span>
            {[
              {
                id: "invite" as const,
                title: "Enviar convite (recomendado)",
                text: "Gera um link para a própria pessoa criar a senha. Ninguém além dela conhece a senha.",
              },
              {
                id: "password" as const,
                title: "Definir uma senha agora",
                text: "Use só quando não der para enviar o convite. Peça para a pessoa trocar a senha no primeiro acesso.",
              },
            ].map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 ${adminMode === option.id ? "border-primary-300 bg-primary-50/60" : "border-background-300"}`}
              >
                <input
                  type="radio"
                  name="admin-mode"
                  className="mt-1 accent-primary-600"
                  checked={adminMode === option.id}
                  onChange={() => setAdminMode(option.id)}
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground-900">{option.title}</span>
                  <span className="block text-xs text-foreground-600">{option.text}</span>
                </span>
              </label>
            ))}
          </div>
          {adminMode === "password" && (
            <Field label="Senha inicial" required hint="Mínimo de 8 caracteres, sem conter o e-mail.">
              <input className={inputClass} type="password" autoComplete="new-password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
              {err("admin.password")}
            </Field>
          )}
        </div>
      )}

      {step === "revisao" && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {[
            ["Empresa", `${name} · ${legalName}`],
            ["CNPJ", formatCnpj(cnpj)],
            ["Endereço", `https://${tenantHost(normalizeSubdomain(subdomain))}`],
            ["Plano", `${PLAN_PRESETS[plan].name} · ${money(Number(monthlyValue) || 0)} · ${Number(seats) ? `${seats} colaboradores` : "ilimitado"}`],
            [
              "Módulos",
              toggleableModules
                .filter((m) => modules[m.key] !== false)
                .map((m) => m.name)
                .join(", ") || "Nenhum módulo opcional",
            ],
            ["Unidade principal", `${estName} (${estCode})${city ? ` · ${city}${state ? `/${state}` : ""}` : ""}${riskGrade ? ` · grau ${riskGrade}` : ""}`],
            ["Responsável técnico", techName ? `${techName}${techRegistration ? ` · ${techRegistration}` : ""}` : "A definir pelo administrador"],
            ["Perfis extras", accessProfileTemplates.filter((t) => profileKeys.includes(t.key)).map((t) => t.name).join(", ") || "Nenhum"],
            ["Administrador", `${adminName} · ${adminEmail} · ${adminMode === "invite" ? "por convite" : "com senha definida agora"}`],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">{label}</dt>
              <dd className="mt-0.5 break-words text-foreground-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  );
}
