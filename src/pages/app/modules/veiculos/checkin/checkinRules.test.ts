import { describe, expect, it } from "vitest";
import type { VehicleCheckin, VehicleRepairRequest } from "@/pages/app/modules/veiculos/vehicleTypes";
import {
  avariasPreexistentes,
  checkinsParaCsv,
  filtrarCheckins,
  filtroVazio,
  fuelLabel,
  kmDoCheckin,
  resumoCheckins,
  temAvaria,
} from "./checkinRules";
import { DIAGRAM_KINDS, diagramFor, diagramKindFor, zoneLabelOf } from "./vehicleDiagrams";

const ck = (over: Partial<VehicleCheckin>): VehicleCheckin => ({
  ref: "c1",
  vehicleRef: "v1",
  kind: "entrega",
  status: "aberta",
  plateSnapshot: "ABC1D23",
  vehicleCategory: "Leve",
  plateConfirmed: true,
  damages: [],
  repairRequests: [],
  responsibleName: "João Silva",
  responsibleDocument: "",
  responsibleRole: "",
  conferenteName: "Ana",
  odometer: 1000,
  fuelLevel: 50,
  items: [],
  photos: [],
  notes: "",
  linkedRef: "",
  performedByName: "João Silva",
  performedAt: "2026-10-01T10:00:00.000Z",
  closedAt: null,
  ...over,
});
const dano = { id: "d1", zone: "capo", zoneLabel: "Capô", type: "risco" as const, severity: "leve" as const, description: "", photo: "p", preexisting: false, repair: true };

describe("desenhos", () => {
  it("categoria do cadastro vira o desenho certo", () => {
    expect(diagramKindFor("Leve")).toBe("carro");
    expect(diagramKindFor("Utilitário")).toBe("utilitario");
    expect(diagramKindFor("Van")).toBe("van");
    expect(diagramKindFor("Caminhão")).toBe("caminhao");
    expect(diagramKindFor("Carreta")).toBe("caminhao");
    expect(diagramKindFor("Ônibus")).toBe("onibus");
    expect(diagramKindFor("Moto")).toBe("moto");
    expect(diagramKindFor("Máquina")).toBe("maquina");
    expect(diagramKindFor("")).toBe("carro");
  });
  it("cada desenho tem áreas com ids únicos e dentro do quadro", () => {
    for (const kind of DIAGRAM_KINDS) {
      const zones = diagramFor(kind).zones;
      expect(new Set(zones.map((z) => z.id)).size).toBe(zones.length);
      for (const z of zones) {
        expect(z.x).toBeGreaterThanOrEqual(0);
        expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.w).toBeLessThanOrEqual(240);
        expect(z.y + z.h).toBeLessThanOrEqual(440);
      }
    }
    expect(zoneLabelOf("carro", "porta_de")).toBe("Porta dianteira esquerda");
    expect(zoneLabelOf("carro", "zzz")).toBe("zzz");
  });
});

describe("check-ins", () => {
  const retirada = ck({ ref: "r1", status: "encerrada", odometer: 1000 });
  const devolucao = ck({
    ref: "d1",
    kind: "devolucao",
    status: "registrada",
    linkedRef: "r1",
    odometer: 1180,
    performedAt: "2026-10-02T18:00:00.000Z",
    damages: [dano],
  });
  const outra = ck({ ref: "r2", vehicleRef: "v2", plateSnapshot: "XYZ9A88", responsibleName: "Márcia Souza", performedAt: "2026-09-10T08:00:00.000Z" });
  const todos = [retirada, devolucao, outra];

  it("km rodados e avaria", () => {
    expect(kmDoCheckin(devolucao, todos)).toBe(180);
    expect(kmDoCheckin(retirada, todos)).toBeNull();
    expect(temAvaria(devolucao)).toBe(true);
    expect(temAvaria(retirada)).toBe(false);
    expect(temAvaria(ck({ items: [{ key: "a", label: "a", result: "avaria", observation: "x" }] }))).toBe(true);
    expect(temAvaria(ck({ damages: [{ ...dano, preexisting: true }] }))).toBe(false);
  });

  it("filtra por condutor (sem acento), placa, tipo, avaria e período", () => {
    expect(filtrarCheckins(todos, { ...filtroVazio, condutor: "marcia" }).map((c) => c.ref)).toEqual(["r2"]);
    expect(filtrarCheckins(todos, { ...filtroVazio, placa: "abc-1d" }).map((c) => c.ref)).toEqual(["d1", "r1"]);
    expect(filtrarCheckins(todos, { ...filtroVazio, tipo: "devolucao" }).map((c) => c.ref)).toEqual(["d1"]);
    expect(filtrarCheckins(todos, { ...filtroVazio, somenteAvaria: true }).map((c) => c.ref)).toEqual(["d1"]);
    expect(
      filtrarCheckins(todos, { ...filtroVazio, periodo: "custom", de: "2026-09-01", ate: "2026-09-30" }).map((c) => c.ref)
    ).toEqual(["r2"]);
  });

  it("avarias passam para o próximo check-in até o reparo ser concluído", () => {
    expect(avariasPreexistentes(todos, "v1")).toEqual([{ ...dano, preexisting: true, repair: false }]);
    const reparo = { vehicleRef: "v1", damageId: "d1", status: "concluida" } as VehicleRepairRequest;
    expect(avariasPreexistentes(todos, "v1", [reparo])).toEqual([]);
    expect(avariasPreexistentes(todos, "v9")).toEqual([]);
  });

  it("resumo e CSV", () => {
    const resumo = resumoCheckins(todos, todos, [{ status: "aberta" } as VehicleRepairRequest]);
    expect(resumo).toMatchObject({ total: 3, retiradas: 2, devolucoes: 1, emUso: 1, comAvaria: 1, kmRodados: 180, reparosAbertos: 1 });
    const csv = checkinsParaCsv([devolucao], todos).split("\r\n");
    expect(csv[0]).toMatch(/^Data;Hora;Tipo;Placa/);
    expect(csv[1]).toContain("Devolução;ABC1D23");
    expect(csv[1]).toContain(";180;");
    expect(fuelLabel(50)).toBe("1/2 (50%)");
    expect(fuelLabel(100)).toBe("Cheio");
    expect(fuelLabel(null)).toBe("—");
  });
});
