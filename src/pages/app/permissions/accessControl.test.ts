import { describe, expect, it } from "vitest";
import { permissionForNav, permissionForPath } from "./accessControl";

describe("Permissão exigida por tela", () => {
  it("liga cada tela de gestão à sua permissão", () => {
    expect(permissionForPath("/app/documentos", "admin")).toBe("tenant.documents");
    expect(permissionForPath("/app/cipa/eleicoes", "admin")).toBe("tenant.cipa");
    expect(permissionForPath("/app/config", "admin")).toBe("tenant.settings");
  });

  it("não governa telas de dados próprios do colaborador", () => {
    expect(permissionForPath("/app/meusdados", "colaborador")).toBeNull();
    expect(permissionForPath("/app", "admin")).toBeNull();
  });

  it("aplica a regra só aos perfis previstos", () => {
    expect(permissionForNav("documentos", "colaborador")).toBeNull();
    expect(permissionForNav("assinaturas", "colaborador")).toBe("tenant.signature");
  });
});
