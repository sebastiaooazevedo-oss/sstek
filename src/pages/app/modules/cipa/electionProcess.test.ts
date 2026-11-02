import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAdvance, nextProcessStatus, scheduleCompliance } from "./electionProcess";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 2, 12, 0, 0)); // 02/11/2026
});
afterEach(() => vi.useRealTimers());

describe("Cronograma eleitoral — situação dos prazos", () => {
  it("nunca marca como atendido sem evidência", () => {
    expect(scheduleCompliance({ dueDate: "2026-12-31" })).toBe("proximo");
    expect(scheduleCompliance({ dueDate: "2026-12-31", done: true })).toBe("atendido");
  });

  it("marca vencido quando a data passou sem comprovação", () => {
    expect(scheduleCompliance({ dueDate: "2026-11-01" })).toBe("vencido");
    expect(scheduleCompliance({ dueDate: "2026-11-02" })).toBe("proximo"); // vence hoje: ainda no prazo
  });

  it("respeita marcos dispensados e aceita data brasileira", () => {
    expect(scheduleCompliance({ dueDate: "2026-01-01", notApplicable: true })).toBe("nao-aplicavel");
    expect(scheduleCompliance({ dueDate: "01/11/2026" })).toBe("vencido");
  });
});

describe("Máquina de estados do processo eleitoral", () => {
  it("só avança para a fase seguinte", () => {
    expect(nextProcessStatus("planejamento")).toBe("convocacao");
    expect(nextProcessStatus("processo-concluido")).toBeNull();
    const skip = checkAdvance({ currentStatus: "planejamento", target: "inscricoes", schedule: [] });
    expect(skip.allowed).toBe(false);
  });

  it("bloqueia a abertura da votação sem convocação, sindicato e inscrições cumpridos", () => {
    const r = checkAdvance({
      currentStatus: "eleicao-programada",
      target: "votacao-aberta",
      schedule: [
        { itemKey: "convocacao", done: true },
        { itemKey: "sindicato", dueDate: "2026-12-01" },
        { itemKey: "inscricoes", done: true },
      ],
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers.join(" ")).toContain("Comunicação ao sindicato");
  });

  it("bloqueia qualquer avanço com marco vencido", () => {
    const r = checkAdvance({
      currentStatus: "planejamento",
      target: "convocacao",
      schedule: [{ itemKey: "convocacao", dueDate: "2026-10-01" }],
    });
    expect(r.allowed).toBe(false);
    expect(r.blockers[0]).toMatch(/prazo vencido/);
  });

  it("libera quando os marcos exigidos estão cumpridos ou dispensados", () => {
    const r = checkAdvance({
      currentStatus: "eleicao-programada",
      target: "votacao-aberta",
      schedule: [
        { itemKey: "convocacao", done: true },
        { itemKey: "sindicato", notApplicable: true },
        { itemKey: "inscricoes", done: true },
      ],
    });
    expect(r).toEqual({ allowed: true, blockers: [] });
  });
});
