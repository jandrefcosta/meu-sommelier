import { FichaVinhoSchema } from "@meu-sommelier/core";
import { describe, expect, it } from "vitest";
import { FICHA_FAKE, FakeSommelier } from "../src/fakes";
import { ESTILO_SEM_SUGESTAO } from "../src/sommelier";
import type { ItemResumo } from "../src/tipos";

const sommelier = new FakeSommelier();
const item = (id: string, status: ItemResumo["status"]): ItemResumo => ({
  id,
  nome: id,
  safra: 2020,
  tipo: "tinto",
  uvas: [],
  status,
  decantarMin: 20,
  decantarMax: 30,
  harmonizacoes: [],
});

describe("FakeSommelier", () => {
  it("a ficha da fixture é válida", () => {
    expect(FichaVinhoSchema.safeParse(FICHA_FAKE).success).toBe(true);
  });

  it("lê qualquer foto como a ficha da fixture, com preço", async () => {
    expect(
      await sommelier.lerRotulo({
        bytes: new Uint8Array([1]),
        mime: "image/jpeg",
      }),
    ).toMatchObject({
      ok: true,
      ficha: FICHA_FAKE,
      precoConsultado: true,
      usos: [{ tipo: "rotulo", provedor: "fake" }],
    });
  });

  it("foto vazia é ilegível", async () => {
    expect(
      await sommelier.lerRotulo({
        bytes: new Uint8Array(),
        mime: "image/jpeg",
      }),
    ).toMatchObject({
      ok: false,
      motivo: "ilegivel",
    });
  });

  it("ficha por nome usa o nome digitado", async () => {
    expect(await sommelier.fichaPorNome("  Malbec Reserva  ")).toMatchObject({
      ok: true,
      ficha: { nome: "Malbec Reserva" },
    });
    expect(await sommelier.fichaPorNome("   ")).toMatchObject({
      ok: false,
      motivo: "nao_e_vinho",
    });
  });

  it("sugere até 3 garrafas, preferindo as que estão no ponto", async () => {
    const adega = [
      item("a", "aguardar"),
      item("b", "no_ponto"),
      item("c", "passou"),
      item("d", "abrir_logo"),
    ];
    const r = await sommelier.sugerirParaPrato({ prato: "churrasco", adega });
    expect(r).toMatchObject({
      ok: true,
      sugestoes: [
        { itemId: "d", motivo: "Combina com churrasco.", decantarMin: 20 },
        { itemId: "b" },
        { itemId: "c" },
      ],
      semBoaOpcao: null,
    });
  });

  it("adega vazia não sugere nada e não gasta uso", async () => {
    expect(
      await sommelier.sugerirParaPrato({ prato: "peixe", adega: [] }),
    ).toEqual({
      ok: true,
      sugestoes: [],
      semBoaOpcao: { estiloIdeal: ESTILO_SEM_SUGESTAO },
      usos: [],
    });
  });
});
