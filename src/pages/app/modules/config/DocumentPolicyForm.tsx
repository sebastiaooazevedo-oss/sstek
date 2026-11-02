import { useAppSession } from "@/pages/app/context";
import { roleLabels } from "@/mocks/app";
import {
  canDeleteDocuments,
  canPublishRegulation,
  toggleDeleteRole,
  toggleRegulationUploadRole,
  useDocumentPermissions,
} from "@/pages/app/modules/documentos/documentPermissionsStore";

/**
 * Parametrização da exclusão de documentos (perfil Administrador).
 * Define QUAIS perfis podem excluir documentos assinados — como as fichas de
 * EPI arquivadas no perfil do colaborador. Fora desses perfis, o documento
 * assinado fica bloqueado para exclusão (permanece como registro de conformidade).
 */
export default function DocumentPolicyForm() {
  const session = useAppSession();
  const permissions = useDocumentPermissions();
  const allowedHere = canDeleteDocuments(session.role);
  const canPublishHere = canPublishRegulation(session.role);

  return (
    <div className="flex flex-col">
      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground-900">Quem pode excluir documentos</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Marque os perfis autorizados a excluir documentos assinados — por exemplo, as fichas de EPI arquivadas no
          perfil de cada colaborador. Documentos assinados ficam bloqueados para os perfis que não estiverem marcados.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["super", "admin", "colaborador"] as const).map((role) => {
            const active = permissions.deleteRoles.includes(role);
            return (
              <button
                key={role}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleDeleteRole(role)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary-300 bg-primary-500 text-background-50"
                    : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className={active ? "ri-checkbox-circle-line" : "ri-checkbox-blank-circle-line"}></i>
                {roleLabels[role]}
              </button>
            );
          })}
        </div>

        {!allowedHere && (
          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-information-line mt-0.5 text-base"></i>
            <span>
              O seu perfil atual não está autorizado a excluir documentos. Você pode ajustar a lista acima, mas a ação
              de exclusão fica bloqueada enquanto o seu perfil não for marcado.
            </span>
          </div>
        )}

        <div className="mt-5 flex items-start gap-2.5 rounded-md border border-background-200 bg-background-100 px-4 py-3 text-xs text-foreground-600">
          <i className="ri-information-line mt-0.5 text-base text-secondary-700"></i>
          <span>
            Nesta fase a permissão fica na sessão (modo demonstração). Quando a autenticação real entrar, esta mesma
            parametrização passa a valer direto do banco, sem mudar a tela.
          </span>
        </div>
      </div>

      <div className="border-t border-background-200 p-5">
        <h3 className="text-sm font-semibold text-foreground-900">Quem pode publicar o Regulamento Interno</h3>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-600">
          Marque os perfis autorizados a subir um novo PDF do Regulamento Interno. Ao publicar uma nova versão, a
          anterior permanece no histórico sinalizada como <strong className="font-semibold">não vigente</strong> e todos
          os colaboradores passam a ter nova pendência de leitura e assinatura.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["super", "admin", "colaborador"] as const).map((role) => {
            const active = permissions.regulationUploadRoles.includes(role);
            return (
              <button
                key={role}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleRegulationUploadRole(role)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary-300 bg-primary-500 text-background-50"
                    : "border-background-300 bg-background-50 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <i className={active ? "ri-checkbox-circle-line" : "ri-checkbox-blank-circle-line"}></i>
                {roleLabels[role]}
              </button>
            );
          })}
        </div>

        {!canPublishHere && (
          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-50 px-4 py-3 text-xs text-accent-900 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-100">
            <i className="ri-information-line mt-0.5 text-base"></i>
            <span>
              O seu perfil atual não está autorizado a publicar o Regulamento Interno. Na tela do regulamento o envio
              de um novo PDF fica bloqueado enquanto o seu perfil não for marcado acima.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}