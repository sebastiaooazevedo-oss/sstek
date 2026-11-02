import { useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import {
  platformApi,
  type PlatformCompany,
  type PlatformCompanyAdmin,
} from "@/pages/app/modules/plataforma/platformApi";

interface CompanyAdminsModalProps {
  open: boolean;
  company: PlatformCompany | null;
  admins: PlatformCompanyAdmin[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function CompanyAdminsModal({ open, company, admins, onClose, onSaved }: CompanyAdminsModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [primaryName, setPrimaryName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [primaryPassword, setPrimaryPassword] = useState("");
  const [showPrimaryPassword, setShowPrimaryPassword] = useState(false);
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [primarySaving, setPrimarySaving] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const linked = company ? admins.filter((admin) => admin.company_id === company.id) : [];
  const primary = linked.find((admin) => admin.is_primary_admin) ?? null;
  const others = linked.filter((admin) => !admin.is_primary_admin);

  function startEditPrimary() {
    if (!primary) return;
    setPrimaryName(primary.name);
    setPrimaryEmail(primary.email ?? "");
    setPrimaryPhone(primary.phone ?? "");
    setPrimaryPassword("");
    setShowPrimaryPassword(false);
    setPrimaryError(null);
    setPrimaryOpen(true);
    setRevokeOpen(false);
  }

  async function savePrimary() {
    if (!company || !primary) return;
    setPrimaryError(null);
    if (primaryName.trim().length < 2) {
      setPrimaryError("Informe o nome do administrador principal.");
      return;
    }
    if (!primaryEmail.includes("@")) {
      setPrimaryError("Informe um e-mail válido.");
      return;
    }
    if (primaryPassword && primaryPassword.length < 8) {
      setPrimaryError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setPrimarySaving(true);
    try {
      const result = await platformApi.updatePrimaryAdmin({
        companyId: company.id,
        profileId: primary.id,
        name: primaryName.trim(),
        email: primaryEmail.trim().toLowerCase(),
        phone: primaryPhone.trim(),
        password: primaryPassword,
      });
      setPrimaryOpen(false);
      onSaved(result.detail || "Administrador principal atualizado.");
    } catch (err) {
      setPrimaryError(err instanceof Error ? err.message : "Não foi possível atualizar o administrador principal.");
    } finally {
      setPrimarySaving(false);
    }
  }

  async function revokePrimary() {
    if (!company || !primary) return;
    setPrimaryError(null);
    setPrimarySaving(true);
    try {
      const result = await platformApi.revokePrimaryAdmin(company.id, primary.id);
      setRevokeOpen(false);
      setPrimaryOpen(false);
      onSaved(result.detail || "Acesso do administrador principal revogado.");
    } catch (err) {
      setPrimaryError(err instanceof Error ? err.message : "Não foi possível revogar o acesso.");
    } finally {
      setPrimarySaving(false);
    }
  }

  async function handleLink() {
    if (!company) return;
    setError(null);
    if (!name.trim() || !email.includes("@")) {
      setError("Informe nome e e-mail do usuário.");
      return;
    }
    if (password.length < 8) {
      setError("Defina a senha de acesso do usuário (mínimo 8 caracteres).");
      return;
    }
    setSaving(true);
    try {
      await platformApi.upsertCompanyAdmin({
        companyId: company.id,
        name: name.trim(),
        email: email.trim(),
        role,
        password,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("admin");
      onSaved("Usuário vinculado. Ele já pode entrar com o e-mail e a senha definidos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível vincular o administrador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Administradores da empresa"
      subtitle={company ? `${company.name} · ${company.subdomain}.sstek.com` : "Selecione uma empresa"}
      icon="ri-shield-user-line"
      footer={
        <ModalButton variant="ghost" onClick={onClose}>
          Fechar
        </ModalButton>
      }
    >
      {/* Administrador principal */}
      <div className="rounded-lg border border-accent-200 bg-accent-50 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-foreground-950">Administrador principal</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-200 px-2 py-0.5 text-[11px] font-semibold text-accent-900">
                <i className="ri-lock-2-line"></i>
                protegido
              </span>
            </div>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-foreground-700">
              Vínculo criado junto com a empresa. Somente o superadministrador da plataforma pode alterar, revogar ou
              excluir este usuário — o administrador da empresa apenas visualiza.
            </p>
          </div>
        </div>

        {primary ? (
          <div className="mt-3 rounded-md bg-background-50 px-3.5 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground-900">{primary.name}</p>
                <p className="truncate text-xs text-foreground-600">
                  {primary.email || "sem e-mail"}
                  {primary.phone ? ` · ${primary.phone}` : ""}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-foreground-500">
                  <span className="rounded-full bg-secondary-100 px-2 py-0.5 font-semibold text-secondary-900">
                    Administrador
                  </span>
                  <span className="rounded-full bg-background-200 px-2 py-0.5 font-semibold text-foreground-600">
                    {primary.status === "active" ? "Ativo" : primary.status}
                  </span>
                  <span>
                    {primary.auth_user_id ? "Conta ativada" : "Primeiro acesso pendente"}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startEditPrimary}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 bg-background-50 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"
                >
                  <i className="ri-edit-line"></i>
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRevokeOpen(true);
                    setPrimaryOpen(false);
                    setPrimaryError(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-accent-500 px-3 py-2 text-xs font-semibold text-accent-950 hover:bg-accent-600"
                >
                  <i className="ri-user-forbid-line"></i>
                  Revogar acesso
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-background-50 px-3.5 py-3 text-xs text-foreground-600">
            Esta empresa ainda não tem administrador principal. Edite a empresa para cadastrar o responsável pelo
            primeiro acesso.
          </p>
        )}

        {primaryOpen && primary && (
          <div className="mt-3 rounded-md border border-background-200 bg-background-50 p-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Editar administrador principal</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome" required>
                <input className={inputClass} value={primaryName} onChange={(e) => setPrimaryName(e.target.value)} />
              </Field>
              <Field label="E-mail" required hint="Após a ativação da conta, o e-mail de login não pode ser trocado.">
                <input className={inputClass} value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value.toLowerCase())} />
              </Field>
              <Field label="Telefone" className="sm:col-span-2">
                <input className={inputClass} value={primaryPhone} onChange={(e) => setPrimaryPhone(e.target.value)} />
              </Field>
              <Field
                label="Nova senha de acesso"
                className="sm:col-span-2"
                hint="Deixe em branco para manter a senha atual. Mínimo de 8 caracteres."
              >
                <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-1.5 focus-within:border-primary-400">
                  <input
                    type={showPrimaryPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                    value={primaryPassword}
                    onChange={(e) => setPrimaryPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrimaryPassword((value) => !value)}
                    aria-label={showPrimaryPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-500 hover:bg-background-100 hover:text-foreground-800"
                  >
                    <i className={showPrimaryPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                  </button>
                </div>
              </Field>
            </div>
            {primaryError && (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{primaryError}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <ModalButton icon="ri-save-3-line" onClick={() => void savePrimary()} disabled={primarySaving}>
                {primarySaving ? "Salvando…" : "Salvar administrador principal"}
              </ModalButton>
              <ModalButton variant="ghost" onClick={() => setPrimaryOpen(false)}>
                Cancelar
              </ModalButton>
            </div>
          </div>
        )}

        {revokeOpen && primary && (
          <div className="mt-3 rounded-md border border-accent-300 bg-background-50 p-3.5">
            <p className="text-xs leading-relaxed text-foreground-700">
              Revogar o acesso de <strong>{primary.name}</strong> inativa o vínculo e encerra a sessão. Nenhum dado da
              empresa é excluído. Você poderá cadastrar um novo administrador principal depois.
            </p>
            {primaryError && (
              <p className="mt-2 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{primaryError}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <ModalButton icon="ri-user-forbid-line" onClick={() => void revokePrimary()} disabled={primarySaving}>
                {primarySaving ? "Revogando…" : "Confirmar revogação"}
              </ModalButton>
              <ModalButton variant="ghost" onClick={() => setRevokeOpen(false)}>
                Cancelar
              </ModalButton>
            </div>
          </div>
        )}
      </div>

      {/* Demais usuários */}
      <div className="mt-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Outros usuários vinculados</h3>
        {others.length === 0 && (
          <p className="rounded-md bg-background-100 px-3 py-3 text-xs text-foreground-600">
            Nenhum outro usuário vinculado a esta empresa.
          </p>
        )}
        {others.map((admin) => (
          <div
            key={admin.id}
            className="flex flex-col gap-1 rounded-md border border-background-200 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground-900">{admin.name}</p>
              <p className="truncate text-xs text-foreground-500">{admin.email || "sem e-mail"}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] font-semibold text-secondary-900">
                {admin.role === "admin" ? "Administrador" : "Colaborador"}
              </span>
              <span className="rounded-full bg-background-200 px-2 py-0.5 text-[11px] font-semibold text-foreground-600">
                {admin.status === "active" ? "Ativo" : admin.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-background-200 pt-5">
        <h3 className="text-sm font-semibold text-foreground-900">Vincular outro administrador</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground-500">
          O vínculo usa o e-mail informado e exige que ele ainda não pertença a outra empresa. O papel máximo permitido
          aqui é <strong>Administrador</strong>. A senha definida abaixo já cria a conta de login — a pessoa entra
          direto com e-mail e senha. O administrador principal não é alterado por este formulário.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome" required>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Marina Alves" />
          </Field>
          <Field label="E-mail" required>
            <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marina@empresa.com.br" />
          </Field>
          <Field label="Papel">
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Administrador</option>
              <option value="collaborator">Colaborador</option>
            </select>
          </Field>
          <Field label="Senha de acesso" required hint="Mínimo 8 caracteres.">
            <div className="flex items-center rounded-md border border-background-300 bg-background-50 pr-1.5 focus-within:border-primary-400">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="w-full rounded-md bg-transparent px-3 py-2.5 text-sm text-foreground-900 outline-none placeholder:text-foreground-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          <div className="flex items-end">
            <ModalButton icon="ri-user-add-line" onClick={() => void handleLink()} disabled={saving}>
              {saving ? "Vinculando…" : "Vincular"}
            </ModalButton>
          </div>
        </div>
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-accent-300 bg-accent-50 px-3 py-2 text-xs text-accent-900">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{error}</span>
          </p>
        )}
      </div>
    </Modal>
  );
}