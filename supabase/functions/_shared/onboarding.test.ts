import { describe, expect, it } from "vitest";
import {
  formatCnpj,
  isValidCnpj,
  normalizeSubdomain,
  sanitizeModules,
  sanitizePermissions,
  validateOnboarding,
  validateSubdomain,
} from "./onboarding";

const validBody = {
  company: { name: "Construtora Alfa", legalName: "Construtora Alfa Ltda", cnpj: "11.222.333/0001-81", subdomain: "Construtora Alfa", plan: "S2" },
  modules: { cipa: true, veiculos: false, hacker: true },
  establishment: { name: "Matriz", code: "matriz", city: "Campinas", state: "sp", riskGrade: "3" },
  settings: { technicalResponsible: "Eng. Ana", technicalRegistration: "CREA 123", sesmtPhone: "(19) 3333-0000" },
  profiles: [{ name: "Técnico de Segurança", description: "SESMT", icon: "ri-stethoscope-line", permissions: { "tenant.documents": true, "bad key": true } }],
  admin: { name: "Maria Gestora", email: "Maria@Alfa.com.br", mode: "invite" },
  license: { monthlyValue: "449", seats: 50, billingCycle: "monthly" },
};

describe("CNPJ", () => {
  it("aceita CNPJ válido com ou sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });
  it("recusa dígito verificador errado, tamanho errado e sequências repetidas", () => {
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
  it("formata com máscara", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("Subdomínio", () => {
  it("normaliza nome para endereço", () => {
    expect(normalizeSubdomain("Construção Ágil  S/A")).toBe("construcao-agil-s-a");
    expect(normalizeSubdomain("--Vega--")).toBe("vega");
  });
  it("recusa reservados, curtos e com hífen nas pontas", () => {
    expect(validateSubdomain("www")).not.toBeNull();
    expect(validateSubdomain("plataforma")).not.toBeNull();
    expect(validateSubdomain("ab")).not.toBeNull();
    expect(validateSubdomain("-abc")).not.toBeNull();
    expect(validateSubdomain("vega-industria")).toBeNull();
  });
});

describe("Saneamento", () => {
  it("só aceita módulos conhecidos com valor booleano", () => {
    expect(sanitizeModules({ cipa: false, dds: "sim", inventado: true })).toEqual({ cipa: false });
  });
  it("só aceita permissões no formato area.acao", () => {
    expect(sanitizePermissions({ "tenant.cipa": true, "x": true, "a.b.c": true, "epi.deliver": "true" })).toEqual({ "tenant.cipa": true });
  });
});

describe("Assistente de nova empresa — validação", () => {
  it("normaliza um pedido válido", () => {
    const r = validateOnboarding(validBody);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.company.subdomain).toBe("construtora-alfa");
    expect(r.value.company.cnpj).toBe("11.222.333/0001-81");
    expect(r.value.modules).toEqual({ cipa: true, veiculos: false });
    expect(r.value.establishment).toMatchObject({ code: "MATRIZ", state: "SP", riskGrade: "3" });
    expect(r.value.admin).toMatchObject({ email: "maria@alfa.com.br", mode: "invite" });
    expect(r.value.profiles[0].permissions).toEqual({ "tenant.documents": true });
    expect(r.value.license).toEqual({ monthlyValue: 449, seats: 50, billingCycle: "monthly" });
  });

  it("devolve todos os erros de uma vez, por campo", () => {
    const r = validateOnboarding({
      company: { name: "", legalName: "", cnpj: "123", subdomain: "www" },
      establishment: { riskGrade: "7", state: "São Paulo" },
      admin: { name: "", email: "sem-arroba", mode: "password", password: "123" },
      license: { monthlyValue: -1 },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual([
      "admin.email",
      "admin.name",
      "admin.password",
      "company.cnpj",
      "company.legalName",
      "company.name",
      "company.subdomain",
      "establishment.riskGrade",
      "establishment.state",
      "license.monthlyValue",
    ]);
  });

  it("no modo convite não exige senha", () => {
    const r = validateOnboarding({ ...validBody, admin: { name: "Maria", email: "m@alfa.com.br", mode: "invite" } });
    expect(r.ok).toBe(true);
  });

  it("usa a regra de senha do servidor quando fornecida", () => {
    const r = validateOnboarding(
      { ...validBody, admin: { name: "Maria", email: "maria@alfa.com.br", mode: "password", password: "maria2026x" } },
      (pwd, email) => (pwd.includes(email.split("@")[0]) ? "A senha não pode conter o e-mail." : null)
    );
    expect(r.ok).toBe(false);
  });
});
