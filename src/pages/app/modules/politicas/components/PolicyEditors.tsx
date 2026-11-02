import { useEffect, useState } from "react";
import Modal, { Field, ModalButton, inputClass, selectClass } from "@/pages/app/components/Modal";
import type { SignatureActor } from "@/pages/app/signature/signatureService";
import {
  documentTypeLabels,
  setCertificateConfig,
  signerRoleLabels,
  upsertPolicy,
  upsertRetention,
  type CertificateConfig,
  type RetentionPolicyRow,
  type SignatureDocType,
  type SignatureLevel,
  type SignaturePolicyRow,
} from "@/pages/app/signature/documentService";

const typeOptions = Object.keys(documentTypeLabels) as SignatureDocType[];
const roleOptions = Object.keys(signerRoleLabels);
const levelOptions: SignatureLevel[] = ["simples", "avancada", "qualificada"];

/* ---------------------------------------------------------------- */

interface PolicyEditModalProps {
  open: boolean;
  onClose: () => void;
  actor: SignatureActor;
  policy: SignaturePolicyRow | null;
  onSaved: (message: string) => void;
}

export function PolicyEditModal({ open, onClose, actor, policy, onSaved }: PolicyEditModalProps) {
  const [docType, setDocType] = useState<SignatureDocType>("epi");
  const [signerRole, setSignerRole] = useState("colaborador");
  const [requiredLevel, setRequiredLevel] = useState<SignatureLevel>("simples");
  const [legalFundamento, setLegalFundamento] = useState("");
  const [legalReferences, setLegalReferences] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    setDocType(policy?.doc_type ?? "epi");
    setSignerRole(policy?.signer_role ?? "colaborador");
    setRequiredLevel(policy?.required_level ?? "simples");
    setLegalFundamento(policy?.legal_fundamento ?? "");
    setLegalReferences((policy?.legal_references ?? []).join("\n"));
    setApprovedBy(policy?.approved_by ?? "");
    setNotes(policy?.notes ?? "");
  }, [open, policy]);

  const handleSave = async () => {
    if (!legalFundamento.trim()) {
      setError("Informe o fundamento legal da política.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await upsertPolicy(actor, {
        docType,
        signerRole,
        requiredLevel,
        requiresCertificate: requiredLevel !== "simples",
        legalFundamento: legalFundamento.trim(),
        legalReferences: legalReferences
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        approvedBy: approvedBy.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSaved(
        "Política salva. Uma nova versão foi registrada com fundamento, referências e aprovação responsável."
      );
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível salvar a política.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-shield-keyhole-line"
      title={policy ? "Editar política de assinatura" : "Nova política de assinatura"}
      subtitle="Categoria documental × papel do signatário, com fundamento legal, versão e aprovação responsável."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSave} icon="ri-save-3-line">
            {saving ? "Salvando..." : "Salvar política"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Categoria documental" required>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as SignatureDocType)}
              disabled={!!policy}
              className={selectClass}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {documentTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Papel do signatário" required>
            <select
              value={signerRole}
              onChange={(e) => setSignerRole(e.target.value)}
              disabled={!!policy}
              className={selectClass}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {signerRoleLabels[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Nível exigido"
          required
          hint="Simples é o método atual (representação visual + código de uso único). Avançada/Qualificada exigem certificado real e bloqueiam a conclusão sem validação ICP-Brasil."
        >
          <select
            value={requiredLevel}
            onChange={(e) => setRequiredLevel(e.target.value as SignatureLevel)}
            className={selectClass}
          >
            {levelOptions.map((l) => (
              <option key={l} value={l}>
                {l === "simples"
                  ? "Assinatura eletrônica simples"
                  : l === "avancada"
                    ? "Assinatura eletrônica avançada"
                    : "Assinatura eletrônica qualificada (ICP-Brasil)"}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Fundamento legal"
          required
          hint="Base normativa que justifica o nível escolhido para esta categoria/papel."
        >
          <textarea
            value={legalFundamento}
            onChange={(e) => setLegalFundamento(e.target.value)}
            maxLength={500}
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Ex.: Assinatura eletrônica simples (Lei 14.063/2020, art. 4º), admitida para registro de entrega de EPI (NR-6)."
          />
        </Field>

        <Field label="Referências normativas" hint="Uma por linha. Ex.: NR-6, itens 6.5.1(d) e 6.5.1.1">
          <textarea
            value={legalReferences}
            onChange={(e) => setLegalReferences(e.target.value)}
            rows={4}
            className={`${inputClass} resize-none`}
            placeholder={"Lei 14.063/2020, art. 4º\nMP 2.200-2/2001, art. 10\nNR-6, itens 6.5.1(d) e 6.5.1.1\nLGPD (Lei 13.709/2018)"}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Aprovada por" hint="Responsável pela aprovação da política">
            <input
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              className={inputClass}
              placeholder="Ex.: Marina Alves · Eng. de Segurança"
            />
          </Field>
          <Field label="Observações">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */

interface RetentionEditModalProps {
  open: boolean;
  onClose: () => void;
  actor: SignatureActor;
  retention: RetentionPolicyRow | null;
  onSaved: (message: string) => void;
}

export function RetentionEditModal({ open, onClose, actor, retention, onSaved }: RetentionEditModalProps) {
  const [docType, setDocType] = useState<SignatureDocType>("epi");
  const [retentionYears, setRetentionYears] = useState(5);
  const [backupRequired, setBackupRequired] = useState(true);
  const [legalBasis, setLegalBasis] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    setDocType(retention?.doc_type ?? "epi");
    setRetentionYears(retention?.retention_years ?? 5);
    setBackupRequired(retention?.backup_required ?? true);
    setLegalBasis(retention?.legal_basis ?? "");
    setNotes(retention?.notes ?? "");
  }, [open, retention]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await upsertRetention(actor, {
        docType,
        retentionYears: Number(retentionYears) || 5,
        backupRequired,
        legalBasis: legalBasis.trim(),
        notes: notes.trim() || undefined,
      });
      onSaved("Retenção e backup atualizados para a categoria documental.");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível salvar a retenção.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-archive-2-line"
      title="Retenção e backup por categoria"
      subtitle="Prazo de guarda e exigência de backup por categoria documental. Sujeito a revisão jurídica."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSave} icon="ri-save-3-line">
            {saving ? "Salvando..." : "Salvar"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Categoria documental" required>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as SignatureDocType)}
              disabled={!!retention}
              className={selectClass}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {documentTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prazo de guarda (anos)" required>
            <input
              type="number"
              min={1}
              value={retentionYears}
              onChange={(e) => setRetentionYears(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Base legal da retenção">
          <input value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2.5 rounded-md border border-background-200 bg-background-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={backupRequired}
            onChange={(e) => setBackupRequired(e.target.checked)}
            className="h-4 w-4 accent-primary-500"
          />
          <span className="text-sm text-foreground-800">Exigir backup desta categoria</span>
        </label>
        <Field label="Observações">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */

interface CertificateConfigModalProps {
  open: boolean;
  onClose: () => void;
  actor: SignatureActor;
  config: CertificateConfig | null;
  onSaved: (message: string) => void;
}

export function CertificateConfigModal({ open, onClose, actor, config, onSaved }: CertificateConfigModalProps) {
  const [provider, setProvider] = useState("");
  const [validationEndpoint, setValidationEndpoint] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSaving(false);
    setProvider(config?.provider ?? "");
    setValidationEndpoint(config?.validation_endpoint ?? "");
    setEnabled(config?.enabled ?? false);
    setNotes(config?.notes ?? "");
  }, [open, config]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await setCertificateConfig(actor, {
        provider: provider.trim(),
        validationEndpoint: validationEndpoint.trim(),
        enabled,
        notes: notes.trim() || undefined,
      });
      onSaved(
        enabled && provider.trim() && validationEndpoint.trim()
          ? "Integração de certificado registrada. A validação real da cadeia ainda depende do provedor."
          : "Integração de certificado mantida como não configurada. Documentos que exijam certificado permanecem bloqueados."
      );
      onClose();
    } catch (err) {
      setError((err as Error).message || "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon="ri-award-line"
      title="Integração de certificado ICP-Brasil"
      subtitle="O sistema não simula certificados, selos ou resultados. Sem provedor e validação reais, o que exige certificado fica bloqueado."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-accent-700">{error}</p>}
          <ModalButton variant="ghost" onClick={onClose} icon="ri-close-line">
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSave} icon="ri-save-3-line">
            {saving ? "Salvando..." : "Salvar"}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-3.5 py-3 text-[11px] leading-relaxed text-accent-900">
          <i className="ri-alert-line mt-0.5 text-base"></i>
          <span>
            O certificado da empresa protegendo o arquivo não equivale à assinatura qualificada do trabalhador. A
            integração exige certificado por signatário e validação da cadeia ICP-Brasil no servidor.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Provedor" hint="Ex.: provedor de assinatura ICP-Brasil">
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={inputClass}
              placeholder="icp-brasil"
            />
          </Field>
          <Field label="Endpoint de validação" hint="Endpoint real de validação da cadeia">
            <input
              value={validationEndpoint}
              onChange={(e) => setValidationEndpoint(e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 rounded-md border border-background-200 bg-background-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary-500"
          />
          <span className="text-sm text-foreground-800">
            Habilitar assinatura com certificado (somente com provedor e endpoint reais)
          </span>
        </label>

        <Field label="Observações">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Modal>
  );
}