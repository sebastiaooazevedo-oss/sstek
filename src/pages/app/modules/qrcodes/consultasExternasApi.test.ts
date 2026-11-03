import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSULTA_SESSAO_MINUTOS, protocoloDaConsulta, tempoRestante } from "@shared/consulta";
import { dentroDoPeriodo, paginar } from "./consultasExternasApi";

describe("Consulta pública — regras compartilhadas", () => {
  it("a ficha fica visível por 5 minutos", () => {
    expect(CONSULTA_SESSAO_MINUTOS).toBe(5);
  });

  it("protocolo = 8 primeiros caracteres do id, sem hífen, em maiúsculas", () => {
    expect(protocoloDaConsulta("3f9a1c07-2b4d-4e1a-9c3b-0d5e6f7a8b9c")).toBe("3F9A1C07");
    expect(protocoloDaConsulta("")).toBe("");
  });

  it("mostra o tempo restante e para em zero", () => {
    const agora = Date.UTC(2026, 10, 3, 12, 0, 0);
    expect(tempoRestante(agora + 5 * 60000, agora)).toBe("5:00");
    expect(tempoRestante(agora + 61000, agora)).toBe("1:01");
    expect(tempoRestante(agora - 1000, agora)).toBe("0:00");
    expect(tempoRestante("inválido", agora)).toBe("0:00");
  });
});

describe("Relatório de consultas — período", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 3, 15, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  const em = (d: number, h = 10) => new Date(2026, 10, d, h, 0, 0).toISOString();

  it("intervalo escolhido inclui o dia inteiro do início e do fim", () => {
    expect(dentroDoPeriodo(em(1, 0), "custom", "2026-11-01", "2026-11-02")).toBe(true);
    expect(dentroDoPeriodo(new Date(2026, 10, 2, 23, 59, 59).toISOString(), "custom", "2026-11-01", "2026-11-02")).toBe(true);
    expect(dentroDoPeriodo(em(3), "custom", "2026-11-01", "2026-11-02")).toBe(false);
    expect(dentroDoPeriodo(em(31 - 31 + 1), "custom", "2026-11-02", "")).toBe(false);
  });

  it("aceita só início ou só fim", () => {
    expect(dentroDoPeriodo(em(3), "custom", "2026-11-02", "")).toBe(true);
    expect(dentroDoPeriodo(em(1), "custom", "", "2026-11-01")).toBe(true);
    expect(dentroDoPeriodo(em(2), "custom", "", "2026-11-01")).toBe(false);
  });

  it("atalhos continuam funcionando", () => {
    expect(dentroDoPeriodo(em(3, 8), "today")).toBe(true);
    expect(dentroDoPeriodo(em(2), "today")).toBe(false);
    expect(dentroDoPeriodo(em(1), "7d")).toBe(true);
  });
});

describe("Relatório de consultas — paginação", () => {
  const lista = Array.from({ length: 73 }, (_, i) => i + 1);

  it("divide em páginas de 10, 30 ou 50", () => {
    expect(paginar(lista, 1, 30)).toMatchObject({ pagina: 1, totalPaginas: 3, de: 1, ate: 30, total: 73 });
    expect(paginar(lista, 3, 30).itens).toEqual(lista.slice(60));
    expect(paginar(lista, 2, 50)).toMatchObject({ de: 51, ate: 73, totalPaginas: 2 });
    expect(paginar(lista, 8, 10)).toMatchObject({ de: 71, ate: 73, totalPaginas: 8 });
  });

  it("corrige página fora do intervalo (ex.: depois de filtrar)", () => {
    expect(paginar(lista, 99, 10).pagina).toBe(8);
    expect(paginar(lista, 0, 10).pagina).toBe(1);
    expect(paginar([], 3, 10)).toMatchObject({ pagina: 1, totalPaginas: 1, de: 0, ate: 0, total: 0, itens: [] });
  });
});
