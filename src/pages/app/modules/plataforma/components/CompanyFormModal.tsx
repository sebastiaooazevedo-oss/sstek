import { useMemo, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  platformApi,
  type PlatformCompany,
  type PlatformCompanyAdmin,
} from "@/pages/app/modules/plataforma/platformApi";

interface CompanyFormModalProps {
  open: boolean;
  company: PlatformCompany | null;
  admins: PlatformCompanyAdmin[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function CompanyFormModal({ open, company, admins, onClose, onSaved }: CompanyFormModalProps) {
  const [name, setName] = useState(company?.name ?? "");
  const [legalName, setLegalName] = useState(company?.legal_name ?? "");
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "");
  const [subdomain, setSubdomain] = useState(company?.subdomain ?? "");
  const [plan, setPlan] = useState(company?.plan ?? "S2");
  const [notes, setNotes] = useState(company?.notes ?? "");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const primaryAdmin = useMemo(
    () => admins.find((admin) => admin.company_id === company?.id && admin.is_primary_admin) ?? null,
    [admins, company?.id]
  );

  async function handleSave() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe o nome da empresa.");
      return;
    }
    if (subdomain.trim().length < 3) {
      setError("Informe o subdomínio da empresa (mínimo 3 caracteres).");
      return;
    }

    const creatingAdmin = !primaryAdmin && (adminName.trim() || adminEmail.trim());
    if (!company && (!adminName.trim() || !adminEmail.trim())) {
      setError("Informe o nome e o e-mail do administrador responsável pelo primeiro acesso.");
      return;
    }
    if (creatingAdmin && (!adminName.trim() || !adminEmail.trim())) {
      setError("Para cadastrar o administrador responsável, informe nome e e-mail.");
      return;
    }
    if (creatingAdmin && !adminEmail.includes("@")) {
      setError("Informe um e-mail válido para o administrador responsável.");
      return;
    }
    if (creatingAdmin) {
      if (adminPassword.length < 8) {
        setError("A senha de acesso do administrador precisa ter pelo menos 8 caracteres.");
        return;
      }
      if (adminPassword.length > 72) {
        setError("A senha de acesso pode ter no máximo 72 caracteres.");
        return;
      }
      if (adminPassword !== adminConfirm) {
        setError("A confirmação da senha não confere com a senha informada.");
        return;
      }
    }

    setSaving(true);
    try {
      await platformApi.upsertCompany({
        companyId: company?.id ?? null,
        name: name.trim(),
        legalName: legalName.trim(),
        cnpj: cnpj.trim(),
        subdomain: subdomain.trim(),
        plan,
        notes: notes.trim(),
        primaryAdmin: creatingAdmin
          ? {
              name: adminName.trim(),
              email: adminEmail.trim().toLowerCase(),
              phone: adminPhone.trim(),
              password: adminPassword,
            }
          : undefined,
      });
      onSaved(
        company
          ? "Empresa atualizada."
          : "Empresa cadastrada. O administrador responsável já pode entrar com o e-mail e a senha definidos."
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a empresa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={company ? "Editar empresa" : "Cadastrar empresa"}
      subtitle="Dados cadastrais, subdomínio e o administrador responsável com senha de acesso."
      icon="ri-building-2-line"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>
            Cancelar
          </ModalButton>
          <ModalButton icon="ri-save-3-line" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar empresa"}
          </ModalButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome da empresa" required className="sm:col-span-2">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Metalúrgica Vega" />
        </Field>
        <Field label="Razão social">
          <input className={inputClass} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Vega Metais Ltda." />
        </Field>
        <Field label="CNPJ">
          <input className={inputClass} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Subdomínio" required hint="Somente letras minúsculas, números e hífen (3 a 30).">
          <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-3 focus-within:border-primary-400">
            <input
              className="w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-foreground-900 outline-none"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              placeholder="empresa"
            />
            <span className="whitespace-nowrap text-xs text-foreground-500">.sstek.com</span>
          </div>
        </Field>
        <Field label="Plano">
          <select className={selectClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="S1">S1</option>
            <option value="S2">S2</option>
            <option value="S3">S3</option>
          </select>
        </Field>
        <Field label="Observações internas" className="sm:col-span-2">
          <textarea
            className={`${inputClass} min-h-20`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contrato, contato comercial, particularidades…"
          ></textarea>
        </Field>
      </div>

      <div className="mt-5 border-t border-background-200 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground-900">Administrador responsável pela empresa</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-0.5 text-[11px] font-semibold text-accent-900">
            <i className="ri-lock-2-line"></i>
            protegido
          </span>
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          É o primeiro acesso da empresa: recebe o perfil <strong>Administrador</strong> e já nasce com a senha de acesso
          definida abaixo. Só o superadministrador da plataforma pode alterar ou excluir este usuário — o administrador da
          empresa apenas visualiza.
        </p>

        {primaryAdmin ? (
          <div className="mt-3 rounded-md border border-background-200 bg-background-100 px-3.5 py-3">
            <p className="text-sm font-semibold text-foreground-900">{primaryAdmin.name}</p>
            <p className="mt-0.5 text-xs text-foreground-600">
              {primaryAdmin.email || "sem e-mail"}
              {primaryAdmin.phone ? ` · ${primaryAdmin.phone}` : ""}
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground-500">
              <i className="ri-information-line mt-0.5"></i>
              <span>
                Para alterar ou revogar este vínculo use o botão <strong>Administradores</strong> na lista de empresas.
              </span>
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nome do administrador" required={!company}>
              <input
                className={inputClass}
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Renata Lopes"
              />
            </Field>
            <Field label="E-mail de acesso" required={!company}>
              <input
                className={inputClass}
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value.toLowerCase())}
                placeholder="renata@empresa.com.br"
              />
            </Field>
            <Field label="Telefone" hint="Opcional · usado apenas para contato." className="sm:col-span-2">
              <input
                className={inputClass}
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="(11) 99999-0000"
              />
            </Field>
            <Field label="Senha de acesso" required hint="Mínimo 8 caracteres · não pode conter o e-mail.">
              <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-1.5 focus-within:border-primary-400">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                >
                  <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                </button>
              </div>
            </Field>
            <Field label="Confirmar senha" required hint="Digite a mesma senha para evitar erro de digitação.">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={inputClass}
                value={adminConfirm}
                onChange={(e) => setAdminConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <p className="flex items-start gap-2 rounded-md bg-secondary-100/80 px-3 py-2.5 text-[11px] leading-relaxed text-secondary-900 sm:col-span-2">
              <i className="ri-information-line mt-0.5 text-sm"></i>
              <span>
                Guarde esta senha e entregue ao administrador da empresa. Ele entra em <strong>/login</strong> com o
                e-mail e a senha cadastrados — o fluxo de "primeiro acesso" deixa de ser necessário.
              </span>
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2.5 text-xs text-accent-900">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>{error}</span>
        </p>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-md bg-background-100 px-3 py-2.5 text-[11px] leading-relaxed text-foreground-600">
        <i className="ri-global-line mt-0.5 text-sm"></i>
        <span>
          Cadastrar o subdomínio aqui registra o vínculo no sistema. A configuração real em DNS, hospedagem e HTTPS é
          externa e aparece na aba Subdomínios como pendência até ser confirmada.
        </span>
      </p>
    </Modal>
  );
}