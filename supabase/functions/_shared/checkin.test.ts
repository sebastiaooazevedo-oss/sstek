import { describe, expect, it } from "vitest";
import {
  checkinPhotoSlotOf,
  fotosObrigatoriasFaltando,
  kmRodados,
  normalizarPlaca,
  placaConfere,
  sanitizarAvaria,
  sanitizarReparo,
  transicaoReparoPermitida,
  validarAvaria,
  validarHodometro,
  validarReparo,
} from "./checkin";

describe("placa", () => {
  it("normaliza e confere placa antiga e Mercosul", () => {
    expect(normalizarPlaca(" abc-1d23 ")).toBe("ABC1D23");
    expect(placaConfere("abc1d23", "ABC-1D23")).toBe(true);
    expect(placaConfere("ABC-1234", "ABC1234")).toBe(true);
    expect(placaConfere("ABC1D2", "ABC1D2")).toBe(false); // incompleta
    expect(placaConfere("XYZ1D23", "ABC1D23")).toBe(false);
  });
});

describe("hodômetro", () => {
  it("exige inteiro e não aceita regressão", () => {
    expect(validarHodometro(null, null, "entrega")).toMatch(/Informe/);
    expect(validarHodometro(1.5, null, "entrega")).toMatch(/Informe/);
    expect(validarHodometro(1000, 1200, "devolucao")).toMatch(/retirada/);
    expect(validarHodometro(1000, 1200, "entrega")).toMatch(/último/);
    expect(validarHodometro(1200, 1200, "devolucao")).toBeNull();
    expect(kmRodados(1000, 1250)).toBe(250);
    expect(kmRodados(1000, 900)).toBeNull();
    expect(kmRodados(null, 900)).toBeNull();
  });
});

describe("fotos obrigatórias", () => {
  it("reconhece a posição pelo caminho do arquivo", () => {
    const p = (slot: string) => `emp/veiculos/ck-${slot}-1730000000000-foto.jpg`;
    expect(checkinPhotoSlotOf(p("lateral-esquerda"))).toBe("lateral_esquerda");
    expect(checkinPhotoSlotOf("emp/veiculos/frente-1730000000000-x.jpg")).toBeNull();
    expect(fotosObrigatoriasFaltando([p("frente"), p("traseira")])).toEqual([
      "Lateral esquerda",
      "Lateral direita",
      "Painel",
    ]);
    expect(
      fotosObrigatoriasFaltando(["frente", "traseira", "lateral-esquerda", "lateral-direita", "painel"].map(p))
    ).toEqual([]);
  });
});

describe("avarias e reparos", () => {
  const base = { zone: "porta_de", zoneLabel: "Porta", type: "risco", severity: "leve", photo: "a.jpg" };
  it("avaria nova exige foto; pré-existente não", () => {
    expect(validarAvaria(base, 1)).toBeNull();
    expect(validarAvaria({ ...base, photo: "" }, 2)).toMatch(/foto/);
    expect(validarAvaria({ ...base, photo: "", preexisting: true }, 2)).toBeNull();
    expect(validarAvaria({ ...base, zone: "" }, 1)).toMatch(/desenho/);
    expect(validarAvaria({ ...base, severity: "grave" }, 1)).toMatch(/descreva/);
    expect(validarAvaria({ ...base, type: "x" }, 1)).toMatch(/tipo/);
  });
  it("reparo exige o que reparar e foto", () => {
    expect(validarReparo({ title: "Trocar retrovisor", priority: "alta", photos: ["r.jpg"] }, 1)).toBeNull();
    expect(validarReparo({ title: "ab", priority: "alta", photos: ["r.jpg"] }, 1)).toMatch(/informe/);
    expect(validarReparo({ title: "Trocar", priority: "alta", photos: [] }, 1)).toMatch(/foto/);
    expect(validarReparo({ title: "Trocar", priority: "zzz", photos: ["r"] }, 1)).toMatch(/prioridade/);
  });
  it("sanitiza valores fora da lista", () => {
    expect(sanitizarAvaria({ zone: "capo", type: "x", severity: "y" }, 0)).toMatchObject({
      id: "av-1",
      type: "outro",
      severity: "leve",
      preexisting: false,
    });
    expect(sanitizarReparo({ title: "t", photos: ["a", "", "b", "c", "d", "e"] }, 2)).toMatchObject({
      id: "rp-3",
      priority: "media",
      photos: ["a", "b", "c", "d"],
    });
  });
  it("transições de status do reparo", () => {
    expect(transicaoReparoPermitida("aberta", "em_andamento")).toBe(true);
    expect(transicaoReparoPermitida("aberta", "aberta")).toBe(false);
    expect(transicaoReparoPermitida("concluida", "cancelada")).toBe(false);
    expect(transicaoReparoPermitida("concluida", "aberta")).toBe(true);
    expect(transicaoReparoPermitida("aberta", "x")).toBe(false);
  });
});
