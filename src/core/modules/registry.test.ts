import { describe, expect, it } from "vitest";
import { appModules, navSectionsFor, screenRules, toggleKeyForPath, toggleableModules } from "./registry";

const allRoutes = appModules.flatMap((m) => m.routes.map((r) => ({ module: m.id, ...r })));

describe("Registro de módulos", () => {
  it("não tem módulos nem rotas duplicados", () => {
    const ids = appModules.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = allRoutes.map((r) => r.path);
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([]);
  });

  it("toda rota tem tela ou redirecionamento", () => {
    allRoutes.forEach((r) => expect(Boolean(r.load || r.redirectTo), r.path).toBe(true));
  });

  it("todo item de menu abre uma rota existente (ou é 'em breve')", () => {
    const paths = new Set(allRoutes.map((r) => r.path));
    appModules
      .flatMap((m) => m.nav ?? [])
      .forEach((item) => {
        const path = item.id === "dashboard" ? "" : item.id;
        expect(paths.has(path) || item.soon === true, `menu "${item.label}" → /app/${path}`).toBe(true);
      });
  });

  it("mantém as chaves históricas de liga/desliga gravadas no banco", () => {
    expect(toggleableModules.map((m) => m.key)).toEqual([
      "cipa",
      "dds",
      "epi",
      "apr",
      "assinaturas",
      "sentimento",
      "veiculos",
      "qrcodes",
      "treinamentos",
    ]);
  });

  it("associa cada endereço ao módulo contratável correto", () => {
    expect(toggleKeyForPath("/app/cipa")).toBe("cipa");
    expect(toggleKeyForPath("/app/minhaepi")).toBe("epi");
    expect(toggleKeyForPath("/app/documentos-assinados")).toBe("assinaturas");
    expect(toggleKeyForPath("/app/qrcodes/renovacoes")).toBe("qrcodes");
    expect(toggleKeyForPath("/app/qrlogs")).toBe("qrcodes");
    expect(toggleKeyForPath("/app/avaliacoes")).toBe("treinamentos");
    expect(toggleKeyForPath("/app/meustreinamentos")).toBe("treinamentos");
    // telas do núcleo nunca são bloqueadas pelo liga/desliga
    expect(toggleKeyForPath("/app")).toBeNull();
    expect(toggleKeyForPath("/app/documentos/lotes")).toBeNull();
    expect(toggleKeyForPath("/app/config")).toBeNull();
  });

  it("toda regra de permissão aponta para uma tela existente", () => {
    const segments = new Set(
      appModules.flatMap((m) => [...m.routes.map((r) => r.path.split("/")[0]), ...(m.nav ?? []).map((n) => n.id)])
    );
    screenRules.forEach((rule) => expect(segments.has(rule.navId), rule.navId).toBe(true));
  });
});

describe("Menu lateral montado pelos manifestos", () => {
  const menu = (role: "super" | "admin" | "colaborador") =>
    navSectionsFor(role).map((s) => [s.title, s.items.map((i) => i.label)]);

  it("Administrador", () => {
    expect(menu("admin")).toEqual([
      ["Operação", ["Dashboard", "Colaboradores", "Documentos", "Veículos", "Assinaturas"]],
      [
        "Conformidade",
        [
          "CIPA",
          "Regulamento Interno",
          "Políticas de assinatura",
          "Sentimento da equipe",
          "Pesquisas",
          "Treinamentos",
          "QR-Codes de fiscalização",
        ],
      ],
      ["Gestão", ["Perfis & permissões", "Configurações da empresa"]],
    ]);
  });

  it("Colaborador", () => {
    expect(menu("colaborador")).toEqual([
      [
        "Meu espaço",
        [
          "Meu painel",
          "Meus dados",
          "Assinaturas",
          "Meus documentos",
          "Regulamento Interno",
          "Minha ficha de EPI",
          "Minha equipe",
        ],
      ],
      ["Desenvolvimento", ["Meus treinamentos", "Pesquisas"]],
      ["Conta", ["Alertas"]],
    ]);
  });

  it("Superadministrador", () => {
    expect(menu("super")).toEqual([
      [
        "Plataforma",
        ["Visão geral", "Empresas & subdomínios", "Base CAEPI central", "Parametrização por perfil", "Perfis & permissões"],
      ],
      ["Comercial", ["Licenças & planos", "Pagamentos"]],
      [
        "Dados",
        [
          "Importar colaboradores",
          "Documentos",
          "Regulamento Interno",
          "CIPA",
          "Assinaturas",
          "Políticas de assinatura",
          "Sentimento da equipe",
          "QR-Codes & logs",
          "Logs por empresa",
        ],
      ],
      ["Sistema", ["Configurações gerais"]],
    ]);
  });
});
