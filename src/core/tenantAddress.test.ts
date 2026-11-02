import { describe, expect, it } from "vitest";
import { RESERVED_SUBDOMAINS } from "@shared/onboarding";
import { classifyAddress } from "./tenantAddress";

const ROOT = "sstek.com.br";

describe("Endereço → empresa", () => {
  it("reconhece o subdomínio de uma empresa", () => {
    expect(classifyAddress("alfa.sstek.com.br", ROOT)).toEqual({ kind: "tenant", subdomain: "alfa", domain: null });
    expect(classifyAddress("ALFA.SSTEK.COM.BR.", ROOT)).toEqual({ kind: "tenant", subdomain: "alfa", domain: null });
  });

  it("trata o domínio raiz e os subdomínios da plataforma como plataforma", () => {
    expect(classifyAddress("sstek.com.br", ROOT)).toEqual({ kind: "root" });
    expect(classifyAddress("www.sstek.com.br", ROOT)).toEqual({ kind: "root" });
    expect(classifyAddress("app.sstek.com.br", ROOT)).toEqual({ kind: "root" });
    expect(classifyAddress("admin.sstek.com.br", ROOT)).toEqual({ kind: "root" });
  });

  it("não aceita mais de um nível como empresa", () => {
    expect(classifyAddress("x.alfa.sstek.com.br", ROOT)).toEqual({ kind: "root" });
  });

  it("trata outro domínio como domínio próprio de uma empresa", () => {
    expect(classifyAddress("sst.alfa.com.br", ROOT)).toEqual({ kind: "tenant", subdomain: null, domain: "sst.alfa.com.br" });
  });

  it("não amarra endereço em desenvolvimento e pré-visualização", () => {
    ["localhost", "127.0.0.1", "sstek-git-main.vercel.app", "app.localhost", ""].forEach((h) =>
      expect(classifyAddress(h, ROOT), h).toEqual({ kind: "dev" })
    );
  });

  it("um domínio parecido não engana a regra", () => {
    expect(classifyAddress("alfa.sstek.com.br.golpe.com", ROOT)).toEqual({
      kind: "tenant",
      subdomain: null,
      domain: "alfa.sstek.com.br.golpe.com",
    });
    expect(classifyAddress("falsosstek.com.br", ROOT).kind).toBe("tenant");
  });

  it("usa a mesma lista de subdomínios reservados do servidor", () => {
    RESERVED_SUBDOMAINS.forEach((label) => expect(classifyAddress(`${label}.${ROOT}`, ROOT), label).toEqual({ kind: "root" }));
  });
});
