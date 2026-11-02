import { describe, expect, it } from "vitest";
import type { CipaElection } from "@/mocks/cipa";
import {
  brDateToTime,
  nrsDimensioning,
  parseFlexibleDate,
  parseRiskGrade,
  rankCandidates,
  toBrDate,
  toIsoDate,
} from "./cipaUtils";

describe("NR-5 — Quadro I (dimensionamento da CIPA)", () => {
  it("dispensa a CIPA abaixo do mínimo de cada grau de risco", () => {
    expect(nrsDimensioning(80, "Grau 1").required).toBe(false);
    expect(nrsDimensioning(50, "Grau 2").required).toBe(false);
    expect(nrsDimensioning(19, "Grau 3").required).toBe(false);
    expect(nrsDimensioning(19, "Grau 4").required).toBe(false);
  });

  it("exige a CIPA a partir do mínimo de cada grau de risco", () => {
    expect(nrsDimensioning(81, "Grau 1").required).toBe(true);
    expect(nrsDimensioning(51, "Grau 2").required).toBe(true);
    expect(nrsDimensioning(20, "Grau 3").required).toBe(true);
    expect(nrsDimensioning(20, "Grau 4").required).toBe(true);
  });

  it.each([
    // [empregados, grau, titulares, suplentes]
    [20, 3, 1, 1],
    [50, 3, 1, 1], // exemplo citado em guia de dimensionamento (grau 3, 50 empregados)
    [50, 4, 2, 1],
    [80, 4, 3, 2],
    [100, 1, 1, 1],
    [120, 4, 4, 2],
    [140, 3, 3, 2],
    [200, 3, 4, 2], // exemplo citado: grau 3, 200 empregados → 4 representantes
    [300, 2, 3, 2],
    [500, 1, 2, 2],
    [1000, 4, 6, 5],
    [2500, 3, 8, 6],
    [5000, 4, 11, 8],
    [10000, 1, 8, 6],
  ])("%i empregados, grau %i → %i titulares e %i suplentes", (count, grade, titulares, suplentes) => {
    const r = nrsDimensioning(count, `Grau ${grade}`);
    expect(r.titulares).toBe(titulares);
    expect(r.suplentes).toBe(suplentes);
  });

  it("usa as faixas oficiais 101–120 e 121–140", () => {
    expect(nrsDimensioning(120, "Grau 1").rangeLabel).toBe("101 a 120 empregados");
    expect(nrsDimensioning(121, "Grau 1").rangeLabel).toBe("121 a 140 empregados");
  });

  it("acrescenta membros por grupo completo de 2.500 acima de 10.000", () => {
    expect(nrsDimensioning(12499, "Grau 3")).toMatchObject({ titulares: 12, suplentes: 8 }); // grupo incompleto
    expect(nrsDimensioning(12500, "Grau 3")).toMatchObject({ titulares: 14, suplentes: 10 });
    expect(nrsDimensioning(15000, "Grau 1")).toMatchObject({ titulares: 10, suplentes: 8 });
    expect(nrsDimensioning(15000, "Grau 1").rangeLabel).toBe("acima de 10.000 empregados");
  });

  it("trata entradas inválidas sem quebrar", () => {
    expect(nrsDimensioning(Number.NaN, "Grau 3").required).toBe(false);
    expect(nrsDimensioning(-5, "Grau 3").required).toBe(false);
    expect(parseRiskGrade("sem número")).toBe(3);
    expect(parseRiskGrade("Grau de risco 9")).toBe(3);
    expect(parseRiskGrade("GR 2")).toBe(2);
  });
});

function election(partial: Partial<CipaElection>): CipaElection {
  return {
    id: "e1",
    cipaId: "c1",
    title: "Eleição",
    year: "2026",
    processNumber: "1",
    registrationStart: "",
    registrationEnd: "",
    voteDate: "",
    status: "Apurada",
    eligibleVoters: 100,
    candidates: [],
    ...partial,
  } as CipaElection;
}

const cand = (name: string, votes: number) => ({ id: name, name, roleFunction: "", area: "", votes });

describe("Apuração — classificação dos candidatos", () => {
  it("ordena por votos e separa titulares, suplentes e não eleitos", () => {
    const ranked = rankCandidates(
      election({
        titularVacancies: 2,
        suplenteVacancies: 1,
        candidates: [cand("Ana", 10), cand("Bruno", 30), cand("Carla", 20), cand("Davi", 5)],
      })
    );
    expect(ranked.map((r) => [r.candidate.name, r.position, r.seat])).toEqual([
      ["Bruno", 1, "titular"],
      ["Carla", 2, "titular"],
      ["Ana", 3, "suplente"],
      ["Davi", 4, "nao-eleito"],
    ]);
  });

  it("nunca elege candidato sem votos", () => {
    const ranked = rankCandidates(
      election({ titularVacancies: 3, candidates: [cand("Ana", 4), cand("Bruno", 0)] })
    );
    expect(ranked.find((r) => r.candidate.name === "Bruno")?.seat).toBe("nao-eleito");
  });

  it("sem vagas configuradas, todo candidato com voto é titular (comportamento legado)", () => {
    const ranked = rankCandidates(election({ candidates: [cand("Ana", 1), cand("Bruno", 2)] }));
    expect(ranked.every((r) => r.seat === "titular")).toBe(true);
  });

  it("ignora candidatos sem nome", () => {
    expect(rankCandidates(election({ candidates: [cand("  ", 9), cand("Ana", 1)] }))).toHaveLength(1);
  });
});

describe("Datas no formato brasileiro", () => {
  it("converte entre dd/mm/aaaa e aaaa-mm-dd", () => {
    expect(toBrDate("2026-11-02")).toBe("02/11/2026");
    expect(toBrDate("")).toBe("—");
    expect(toIsoDate("02/11/2026")).toBe("2026-11-02");
    expect(toIsoDate("2026-11-02T10:00:00Z")).toBe("2026-11-02");
  });

  it("interpreta datas brasileiras e ISO como o mesmo dia", () => {
    expect(parseFlexibleDate("02/11/2026")).toBe(parseFlexibleDate("2026-11-02"));
    expect(brDateToTime("02/11/2026")).toBe(new Date(2026, 10, 2).getTime());
  });

  it("devolve 0 para datas inválidas", () => {
    expect(brDateToTime("2026-11-02")).toBe(0);
    expect(parseFlexibleDate("ontem")).toBe(0);
  });
});
