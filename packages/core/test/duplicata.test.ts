import { describe, expect, it } from "vitest";
import { chaveDuplicata } from "../src/duplicata";

describe("chaveDuplicata", () => {
  it("usa minúsculas, sem acentos, e a safra", () => {
    expect(chaveDuplicata("Château Labadie", 2020)).toBe(
      "chateau labadie|2020",
    );
  });

  it("ignora caixa, acentos e espaços extras", () => {
    expect(chaveDuplicata("  CHÂTEAU   labadie ", 2020)).toBe(
      chaveDuplicata("Chateau Labadie", 2020),
    );
  });

  it("usa 'nv' quando não há safra", () => {
    expect(chaveDuplicata("Espumante Brut", null)).toBe("espumante brut|nv");
  });

  it("separa safras diferentes do mesmo vinho", () => {
    expect(chaveDuplicata("Malbec", 2020)).not.toBe(
      chaveDuplicata("Malbec", 2021),
    );
  });

  it("trata ç e ñ", () => {
    expect(chaveDuplicata("Ñandú Açaí", 2019)).toBe("nandu acai|2019");
  });
});
