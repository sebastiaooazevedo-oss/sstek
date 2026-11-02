import { describe, expect, it } from "vitest";
import { MODULE_KEYS } from "@shared/onboarding";
import { toggleableModules } from "./modules/registry";
import { PLAN_IDS, PLAN_PRESETS } from "./plans";

describe("Planos comerciais", () => {
  it("cada plano define todos os módulos contratáveis do sistema", () => {
    const keys = toggleableModules.map((m) => m.key).sort();
    PLAN_IDS.forEach((id) => expect(Object.keys(PLAN_PRESETS[id].modules).sort(), id).toEqual(keys));
  });

  it("o servidor aceita exatamente as mesmas chaves de módulo que o app usa", () => {
    expect([...MODULE_KEYS].sort()).toEqual(toggleableModules.map((m) => m.key).sort());
  });

  it("planos maiores nunca têm menos módulos que os menores", () => {
    const on = (id: "S1" | "S2" | "S3") => Object.entries(PLAN_PRESETS[id].modules).filter(([, v]) => v).map(([k]) => k);
    expect(on("S2")).toEqual(expect.arrayContaining(on("S1")));
    expect(on("S3")).toEqual(expect.arrayContaining(on("S2")));
  });
});
