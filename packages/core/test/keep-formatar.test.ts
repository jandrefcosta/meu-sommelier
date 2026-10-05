import { describe, expect, it } from "vitest";
import type { FichaVinho } from "../src/ficha";
import { formatarLinhaKeep } from "../src/keep";
import { FICHAS_KEEP_PO, LINHAS_KEEP_PO, fichaValida } from "./fabricas";

describe("formatarLinhaKeep", () => {
  it.each<[string, FichaVinho, string]>(
    FICHAS_KEEP_PO.map((ficha, i) => [ficha.nome, ficha, LINHAS_KEEP_PO[i]!]),
  )("reproduz a linha real da PO: %s", (_nome, ficha, linha) => {
    expect(formatarLinhaKeep(ficha)).toBe(linha);
  });

  it("usa NV quando não há safra", () => {
    expect(formatarLinhaKeep(fichaValida({ safra: null }))).toMatch(
      /^Château .+ \(NV\) \|/,
    );
  });

  it("formata milhar e centavos no preço", () => {
    const ficha = fichaValida({
      precoMinCentavos: 8990,
      precoMaxCentavos: 120050,
    });
    expect(formatarLinhaKeep(ficha)).toContain("| 💵 R$ 89,90–1.200,50 |");
  });

  it("mostra preço único quando mínimo e máximo são iguais", () => {
    const ficha = fichaValida({
      precoMinCentavos: 15000,
      precoMaxCentavos: 15000,
    });
    expect(formatarLinhaKeep(ficha)).toContain("| 💵 R$ 150 |");
  });

  it("mostra 'Não consultado' quando o preço não foi buscado", () => {
    const ficha = fichaValida({
      precoMinCentavos: null,
      precoMaxCentavos: null,
    });
    expect(formatarLinhaKeep(ficha)).toContain("| 💵 Não consultado |");
  });
});
