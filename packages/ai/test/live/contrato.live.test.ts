import { describe, expect, it } from "vitest";
import { carregarConfigIA, criarSommelier } from "../../src/config";

// Chama os provedores reais configurados no .env. Tem custo: rode só à mão, com `pnpm test:live`.
const sommelier = criarSommelier(carregarConfigIA(process.env));

describe("contrato com os provedores reais", () => {
  it("fichaPorNome devolve uma ficha válida", async () => {
    const r = await sommelier.fichaPorNome(
      "Perez Cruz Gran Reserva Cabernet Sauvignon 2024",
    );
    expect(r.ok).toBe(true);
    expect(r.usos.length).toBeGreaterThan(0);
  });

  it("sugerirParaPrato só usa ids da adega", async () => {
    const r = await sommelier.sugerirParaPrato({
      prato: "churrasco",
      adega: [
        {
          id: "item-1",
          nome: "Perez Cruz Gran Reserva Cabernet Sauvignon",
          safra: 2024,
          tipo: "tinto",
          uvas: ["Cabernet Sauvignon"],
          status: "aguardar",
          decantarMin: 45,
          decantarMax: 45,
          harmonizacoes: ["Churrasco"],
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) for (const s of r.sugestoes) expect(s.itemId).toBe("item-1");
  });
});
