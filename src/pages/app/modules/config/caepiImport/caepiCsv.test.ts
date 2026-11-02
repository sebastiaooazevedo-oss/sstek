import { describe, expect, it } from "vitest";
import { detectDelimiter, detectEncoding, parseCsvLine } from "./caepiCsv";

describe("Leitura do CSV do CAEPI", () => {
  it("separa campos respeitando aspas e aspas escapadas", () => {
    expect(parseCsvLine('12345;"Luva; nitrílica";"Marca ""X"""', ";")).toEqual([
      "12345",
      "Luva; nitrílica",
      'Marca "X"',
    ]);
  });

  it("mantém campos vazios", () => {
    expect(parseCsvLine("a;;c;", ";")).toEqual(["a", "", "c", ""]);
  });

  it("detecta o delimitador pelo cabeçalho", () => {
    expect(detectDelimiter("NR_CA;DATA_VALIDADE;SITUACAO")).toBe(";");
    expect(detectDelimiter("NR_CA,DATA_VALIDADE,SITUACAO")).toBe(",");
    expect(detectDelimiter('"A;B",C,D')).toBe(",");
    expect(detectDelimiter("SEMSEPARADOR")).toBe(";");
  });

  it("reconhece UTF-8 e avisa quando o arquivo está em Windows-1252", () => {
    expect(detectEncoding(new TextEncoder().encode("Proteção")).encoding).toBe("utf-8");
    const latin1 = new Uint8Array([0x50, 0x72, 0x6f, 0x74, 0x65, 0xe7, 0xe3, 0x6f, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20]);
    const r = detectEncoding(latin1);
    expect(r.encoding).toBe("windows-1252");
    expect(r.warning).toBeTruthy();
  });
});
