import AppBrandLogo from "@/components/base/AppBrandLogo";

interface AppLoadingScreenProps {
  /** Mensagem exibida abaixo do indicador (é aplicada em caixa alta pelo CSS). */
  label?: string;
  /** "full" ocupa a tela inteira · "panel" fica dentro da área de conteúdo. */
  variant?: "full" | "panel";
}

/**
 * Tela de carregamento do sistema.
 *
 * Usada enquanto a sessão, a empresa ou as permissões ainda estão sendo
 * validadas. Mantém a marca no centro, um anel girando em degradê e a
 * mensagem "CARREGANDO…" — evitando a sensação de tela travada ou vazia.
 */
export default function AppLoadingScreen({ label = "Carregando…", variant = "full" }: AppLoadingScreenProps) {
  const wrapper =
    variant === "full"
      ? "flex min-h-screen w-full items-center justify-center bg-background-50 px-4 py-12"
      : "flex w-full items-center justify-center rounded-lg border border-background-200 bg-background-50 px-4 py-20";

  return (
    <div className={wrapper}>
      <div className="flex w-full max-w-md flex-col items-center">
        <AppBrandLogo className="h-10 md:h-12" />

        <div className="relative mt-12 flex h-[74px] w-[74px] items-center justify-center">
          <span className="absolute inset-0 rounded-full border-[6px] border-background-200" />
          <span className="app-loading-spinner absolute inset-0 rounded-full" />
          <span className="pointer-events-none absolute -bottom-4 h-3 w-16 rounded-full bg-foreground-950/10 blur-md" />
        </div>

        <p className="mt-9 text-[11px] font-semibold uppercase leading-none tracking-[0.32em] text-foreground-500">
          {label}
        </p>
      </div>
    </div>
  );
}