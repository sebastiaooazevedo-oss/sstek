import type { ReactNode } from "react";

interface PermissionGateProps {
  /** Resultado de `can("<chave>")` do hook de permissões. */
  allowed: boolean;
  children: ReactNode;
  /** Conteúdo exibido quando a permissão não está liberada. */
  fallback?: ReactNode;
}

/**
 * Mostra um bloco somente quando o perfil logado tem a permissão.
 * Usado para esconder/mascarar ações (botões, linhas de menu, atalhos).
 */
export function PermissionGate({ allowed, children, fallback = null }: PermissionGateProps) {
  return <>{allowed ? children : fallback}</>;
}

interface PermissionLockNoteProps {
  /** Texto curto do que está bloqueado, ex.: "Incluir colaboradores". */
  text: string;
  className?: string;
}

/**
 * Selo discreto usado no lugar de uma ação que o perfil não pode executar.
 * Não é um botão: deixa claro que a restrição vem do perfil, não do sistema.
 */
export function PermissionLockNote({ text, className = "" }: PermissionLockNoteProps) {
  return (
    <span
      title={`Ação não liberada para o seu perfil. Um administrador pode liberar em Perfis & permissões.`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-background-300 bg-background-100 px-3 py-2 text-xs font-semibold text-foreground-500 ${className}`}
    >
      <i className="ri-lock-2-line text-sm"></i>
      {text}
    </span>
  );
}

/**
 * Classe utilitária para transformar um botão existente em "bloqueado":
 * mantém o desenho do botão, mas sem cursor de clique e com opacidade reduzida.
 */
export function lockedActionClass(baseClass: string): string {
  return `${baseClass} cursor-not-allowed opacity-45 hover:bg-transparent active:translate-y-0`;
}