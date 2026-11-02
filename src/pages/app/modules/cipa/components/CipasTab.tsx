import { useMemo, useState } from "react";
import { addCipa, updateCipa, useCipas } from "@/pages/app/modules/cipa/cipaStore";
import CipaFormModal from "@/pages/app/modules/cipa/components/CipaFormModal";
import { cipaStatusClass, memberRoleClass, nrsDimensioning } from "@/pages/app/modules/cipa/cipaUtils";
import { getInitials } from "@/pages/app/context";
import { usePermissions } from "@/pages/app/permissions/permissionStore";
import { PermissionLockNote } from "@/pages/app/components/PermissionGate";
import type { Cipa } from "@/mocks/cipa";

export default function CipasTab() {
  const cipas = useCipas();
  const { can } = usePermissions();
  const canCreate = can("cipa.create");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cipa | null>(null);
  const [expanded, setExpanded] = useState<string | null>(cipas[0]?.id ?? null);

  const ordered = useMemo(() => cipas, [cipas]);

  const handleSave = (cipa: Cipa) => {
    if (!canCreate) return;
    if (cipas.some((c) => c.id === cipa.id)) {
      updateCipa(cipa);
    } else {
      addCipa(cipa);
    }
  };

  const openNew = () => {
    if (!canCreate) return;
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (cipa: Cipa) => {
    if (!canCreate) return;
    setEditing(cipa);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground-950">Comissões da empresa</h2>
          <p className="mt-0.5 text-sm text-foreground-600">Cada estabelecimento (matriz ou filial) possui sua própria CIPA, com mandato e composição próprios.</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
          >
            <i className="ri-add-line text-base"></i>
            Nova CIPA
          </button>
        ) : (
          <PermissionLockNote text="Criar CIPA bloqueado" />
        )}
      </div>

      {ordered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-background-200 bg-background-50 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-background-100 text-foreground-400">
            <i className="ri-government-line text-2xl"></i>
          </span>
          <p className="text-sm font-semibold text-foreground-800">Nenhuma CIPA cadastrada</p>
          {canCreate && (
            <button type="button" onClick={openNew} className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary-500 px-3.5 py-2 text-xs font-semibold text-background-50 hover:bg-primary-600">
              <i className="ri-add-line"></i>
              Criar primeira CIPA
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {ordered.map((cipa) => {
          const isOpen = expanded === cipa.id;
          const president = cipa.members.find((m) => m.memberRole === "Presidente");
          const vice = cipa.members.find((m) => m.memberRole === "Vice-Presidente");

          // Enquadramento no Quadro I da NR-5: compara os representantes dos
          // empregados lançados com o nº esperado de titulares/suplentes.
          const suggestion = cipa.employeesCount ? nrsDimensioning(cipa.employeesCount, cipa.riskGrade) : null;
          const empTitulares = cipa.members.filter(
            (m) => m.name.trim() && m.representation === "Empregado" && m.memberRole === "Titular"
          ).length;
          const empSuplentes = cipa.members.filter(
            (m) => m.name.trim() && m.representation === "Empregado" && m.memberRole === "Suplente"
          ).length;
          const conforme = suggestion
            ? !suggestion.required
              ? "dispensa"
              : empTitulares === suggestion.titulares && empSuplentes === suggestion.suplentes
                ? "conforme"
                : "fora"
            : null;
          const nrsBadge =
            conforme === "conforme"
              ? { label: "Conforme", icon: "ri-shield-check-line", cls: "bg-secondary-100 text-secondary-800" }
              : conforme === "fora"
                ? { label: "Fora do Quadro I", icon: "ri-alert-line", cls: "bg-accent-100 text-accent-800" }
                : { label: "Dispensa de CIPA", icon: "ri-information-line", cls: "bg-background-200 text-foreground-600" };
          return (
            <div key={cipa.id} className="rounded-lg border border-background-200 bg-background-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <i className="ri-government-line text-xl"></i>
                  </span>
                  <div>
                    <h3 className="font-heading text-base font-bold text-foreground-950">{cipa.name}</h3>
                    <p className="mt-0.5 text-xs text-foreground-500">{cipa.unit}</p>
                    <p className="mt-0.5 text-xs text-foreground-400">
                      {cipa.city} {cipa.cnpj && `· ${cipa.cnpj}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${cipaStatusClass(cipa.status)}`}>{cipa.status}</span>
                  {suggestion && nrsBadge && (
                    <span
                      title={
                        conforme === "dispensa"
                          ? `Quadro I da NR-5: ${suggestion.rangeLabel} · ${suggestion.group} dispensa a constituição de CIPA.`
                          : conforme === "conforme"
                            ? `Quadro I da NR-5: ${suggestion.rangeLabel} · ${suggestion.group} — composição conforme (${suggestion.titulares} titular(es) e ${suggestion.suplentes} suplente(s) por parte).`
                            : `Quadro I da NR-5: ${suggestion.rangeLabel} · ${suggestion.group} — esperado ${suggestion.titulares} titular(es) e ${suggestion.suplentes} suplente(s); atual ${empTitulares} titular(es) e ${empSuplentes} suplente(s).`
                      }
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${nrsBadge.cls}`}
                    >
                      <i className={`${nrsBadge.icon} text-[11px]`}></i>
                      NR-5: {nrsBadge.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Mandato</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{cipa.mandateNumber}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Grau de risco</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{cipa.riskGrade || "—"}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Empregados</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{cipa.employeesCount || "—"}</p>
                </div>
                <div className="rounded-md bg-background-100 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Membros</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground-900">{cipa.members.length}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-foreground-500">
                {president && (
                  <span className="flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1">
                    <i className="ri-user-star-line text-primary-700"></i>
                    Pres.: <strong className="font-semibold text-foreground-800">{president.name}</strong>
                  </span>
                )}
                {vice && (
                  <span className="flex items-center gap-1.5 rounded-full bg-background-100 px-2.5 py-1">
                    <i className="ri-user-voice-line text-secondary-700"></i>
                    Vice: <strong className="font-semibold text-foreground-800">{vice.name}</strong>
                  </span>
                )}
              </div>

              {isOpen && (
                <div className="mt-4 border-t border-background-200 pt-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-foreground-400">Composição do mandato</p>
                  <div className="flex flex-col gap-2">
                    {cipa.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-md bg-background-100/60 px-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[10px] font-bold text-secondary-900">
                          {getInitials(m.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground-900">{m.name}</p>
                          <p className="truncate text-[11px] text-foreground-500">
                            {m.roleFunction || "—"} · {m.area || "—"} {m.registration && `· mat. ${m.registration}`}
                          </p>
                        </div>
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${memberRoleClass(m.memberRole)}`}>
                          {m.memberRole}
                        </span>
                        <span className="hidden whitespace-nowrap rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-semibold text-foreground-600 sm:inline">
                          {m.representation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-background-200 pt-4">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : cipa.id)}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-foreground-600 transition-colors hover:bg-background-100"
                >
                  <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                  {isOpen ? "Ocultar composição" : "Ver composição"}
                </button>
                {canCreate ? (
                  <button
                    type="button"
                    onClick={() => openEdit(cipa)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 transition-colors hover:bg-background-100"
                  >
                    <i className="ri-edit-line text-base"></i>
                    Editar CIPA
                  </button>
                ) : (
                  <span
                    title="Edição não liberada para o seu perfil"
                    className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 py-2 text-xs font-semibold text-foreground-300"
                  >
                    <i className="ri-lock-2-line text-base"></i>
                    Editar CIPA
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CipaFormModal open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} editing={editing} />
    </div>
  );
}