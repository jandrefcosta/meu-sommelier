import { describe, expect, it } from "vitest";
import { filtrarSugestoes } from "../src/sugestoes";

const s = (itemId: string) => ({
  itemId,
  motivo: `motivo ${itemId}`,
  decantarMin: null,
});

describe("filtrarSugestoes", () => {
  it("descarta itens que não foram enviados para a IA", () => {
    expect(
      filtrarSugestoes([s("a"), s("inventado"), s("b")], ["a", "b"]),
    ).toEqual([s("a"), s("b")]);
  });

  it("devolve no máximo 3, mantendo a ordem da IA", () => {
    const ids = ["d", "c", "b", "a"];
    expect(filtrarSugestoes(ids.map(s), ids).map((x) => x.itemId)).toEqual([
      "d",
      "c",
      "b",
    ]);
  });

  it("remove a mesma garrafa sugerida mais de uma vez", () => {
    expect(
      filtrarSugestoes([s("a"), s("a"), s("b")], ["a", "b"]).map(
        (x) => x.itemId,
      ),
    ).toEqual(["a", "b"]);
  });

  it("repetidos e inventados não ocupam vaga das 3", () => {
    const sugestoes = [s("a"), s("x"), s("a"), s("b"), s("c"), s("d")];
    expect(
      filtrarSugestoes(sugestoes, ["a", "b", "c", "d"]).map((x) => x.itemId),
    ).toEqual(["a", "b", "c"]);
  });

  it("sem sugestões válidas devolve lista vazia", () => {
    expect(filtrarSugestoes([s("x")], [])).toEqual([]);
  });
});
