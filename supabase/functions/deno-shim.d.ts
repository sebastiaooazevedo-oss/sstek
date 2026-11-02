// Tipos mínimos do Deno para checar as funções com o TypeScript do projeto (não é usado em produção).
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
