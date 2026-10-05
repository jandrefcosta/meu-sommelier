import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FichaVinho } from "../src/ficha";
import { formatarLinhaKeep, parseListaKeep } from "../src/keep";
import { FICHAS_KEEP_PO, LINHAS_KEEP_PO } from "./fabricas";

const BASE =
  "| 💵 R$ 100–150 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩 Pizza";

describe("parseListaKeep", () => {
  it("lê as linhas reais da PO", () => {
    expect(parseListaKeep(LINHAS_KEEP_PO.join("\n"))).toEqual({
      importados: FICHAS_KEEP_PO,
      falhas: [],
    });
  });

  it("aceita hífen comum nas faixas", () => {
    const { importados } = parseListaKeep(
      "Vinho X (2019) | 💵 R$ 100-150 | 🎯 2024-2025 (⏳ 2028) | 🍷 Decantar: 20-30 min | 🥩 Pizza",
    );
    expect(importados[0]).toMatchObject({
      precoMinCentavos: 10000,
      precoMaxCentavos: 15000,
      abrirDe: 2024,
      abrirAte: 2025,
      decantarMin: 20,
      decantarMax: 30,
    });
  });

  it("aceita espaços variáveis", () => {
    const { importados, falhas } = parseListaKeep(
      "Vinho X(2019)|💵R$100–150|🎯2024(⏳2028)|🍷Decantar:20 min|🥩 Pizza ,  Massa ",
    );
    expect(falhas).toEqual([]);
    expect(importados[0]).toMatchObject({
      nome: "Vinho X",
      harmonizacoes: ["Pizza", "Massa"],
    });
  });

  it.each(["[ ]", "[x]", "- [ ]", "- [X]"])(
    "remove o marcador %s do começo da linha e não o leva para o nome",
    (marcador) => {
      const { importados, falhas } = parseListaKeep(
        `${marcador} Vinho (2019) ${BASE}`,
      );
      expect(falhas).toEqual([]);
      expect(importados[0]?.nome).toBe("Vinho");
    },
  );

  it("aceita texto colado do Windows, marcadores do Keep e U+FE0F", () => {
    const texto = [
      `☐ Vinho A (2019) ${BASE}`,
      "",
      `☑ Vinho B (2018) ${BASE}`,
      `Vinho C (2017) | 💵️ R$ 100 | 🎯 2024 (⏳ 2028) | 🍷️ Decantar: 20 min | 🥩 Pizza`,
    ].join("\r\n");
    const { importados, falhas } = parseListaKeep(texto);
    expect(falhas).toEqual([]);
    expect(importados.map((f) => f.nome)).toEqual([
      "Vinho A",
      "Vinho B",
      "Vinho C",
    ]);
  });

  it("lê milhar, centavos, preço único e 'Não consultado'", () => {
    const linha = (preco: string) =>
      `Vinho (2019) | 💵 ${preco} | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩 Pizza`;
    const { importados } = parseListaKeep(
      [
        linha("R$ 1.200–1.500"),
        linha("R$ 89,90"),
        linha("NÃO CONSULTADO"),
      ].join("\n"),
    );
    expect(
      importados.map((f) => [f.precoMinCentavos, f.precoMaxCentavos]),
    ).toEqual([
      [120000, 150000],
      [8990, 8990],
      [null, null],
    ]);
  });

  it("lê NV como safra nula", () => {
    const { importados } = parseListaKeep(`Espumante Brut (NV) ${BASE}`);
    expect(importados[0]).toMatchObject({ safra: null, tipo: "espumante" });
  });

  it.each([
    ["Casa Sauvignon Blanc", "branco"],
    ["Miolo Rosé", "rose"],
    ["Porto Tawny", "fortificado"],
    ["Late Harvest Moscatel", "sobremesa"],
    ["Cabernet Sauvignon", "tinto"],
  ])("infere o tipo de %s como %s", (nome, tipo) => {
    expect(parseListaKeep(`${nome} (2019) ${BASE}`).importados[0]?.tipo).toBe(
      tipo,
    );
  });

  it("manda para falhas o que não reconhece, com número da linha e texto original", () => {
    const texto = [
      "",
      "Comprar mais vinho",
      `Vinho sem safra ${BASE}`,
      `Vinho (2019) ${BASE}`,
    ].join("\n");
    const { importados, falhas } = parseListaKeep(texto);
    expect(importados).toHaveLength(1);
    expect(falhas).toEqual([
      {
        linha: 2,
        texto: "Comprar mais vinho",
        motivo: expect.stringContaining('5 partes separadas por "|"'),
      },
      {
        linha: 3,
        texto: `Vinho sem safra ${BASE}`,
        motivo: expect.stringContaining("safra entre parênteses"),
      },
    ]);
  });

  it.each([
    [
      "sem 💵",
      "Vinho (2019) | R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩 Pizza",
      "💵 preço",
    ],
    [
      "sem 🍷",
      "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | Decantar: 20 min | 🥩 Pizza",
      "🍷 decantação",
    ],
    [
      "sem 🥩",
      "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | Pizza",
      "🥩 harmonização",
    ],
    [
      "janela ilegível",
      "Vinho (2019) | 💵 R$ 100 | 🎯 logo | 🍷 Decantar: 20 min | 🥩 Pizza",
      "🎯 ano ideal",
    ],
    [
      "decantação ilegível",
      "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 um pouco | 🥩 Pizza",
      "🍷 decantação",
    ],
    [
      "sem harmonização",
      "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩  ",
      "harmonização",
    ],
    [
      "guarda antes da abertura",
      "Vinho (2019) | 💵 R$ 100 | 🎯 2026 (⏳ 2020) | 🍷 Decantar: 20 min | 🥩 Pizza",
      "guarda máxima",
    ],
  ])("explica a falha: %s", (_caso, linha, trecho) => {
    const { falhas } = parseListaKeep(linha);
    expect(falhas[0]?.motivo).toContain(trecho);
  });

  it("ida e volta: parse(formatar(ficha)) devolve a mesma ficha", () => {
    const PALAVRAS = [
      "Château",
      "Quinta",
      "Reserva",
      "Gran",
      "Malbec",
      "Vale",
      "Alto",
      "Tannat",
      "São",
      "Ñandú",
    ];
    const PRATOS = [
      "Churrasco",
      "frango assado com ervas",
      "Queijos curados",
      "Risoto de cogumelos",
    ];
    const fichaKeep = fc
      .record({
        nome: fc
          .array(fc.constantFrom(...PALAVRAS), { minLength: 1, maxLength: 5 })
          .map((p) => p.join(" ")),
        safra: fc.option(fc.integer({ min: 1950, max: 2090 }), { nil: null }),
        abrirDe: fc.integer({ min: 1950, max: 2090 }),
        extraAbrir: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
        extraGuarda: fc.integer({ min: 0, max: 20 }),
        preco: fc.option(
          fc.tuple(
            fc.integer({ min: 0, max: 500_000 }),
            fc.integer({ min: 0, max: 200_000 }),
          ),
          { nil: null },
        ),
        decantar: fc.option(
          fc.tuple(
            fc.integer({ min: 0, max: 180 }),
            fc.integer({ min: 0, max: 120 }),
          ),
          { nil: null },
        ),
        harmonizacoes: fc.array(fc.constantFrom(...PRATOS), {
          minLength: 1,
          maxLength: 5,
        }),
      })
      .map((g): FichaVinho => {
        const abrirAte =
          g.extraAbrir === null ? null : g.abrirDe + g.extraAbrir;
        return {
          nome: g.nome,
          produtor: null,
          safra: g.safra,
          tipo: "tinto",
          uvas: [],
          pais: null,
          regiao: null,
          precoMinCentavos: g.preco ? g.preco[0] : null,
          precoMaxCentavos: g.preco ? g.preco[0] + g.preco[1] : null,
          precoFontes: [],
          precoConsultadoEm: null,
          abrirDe: g.abrirDe,
          abrirAte,
          guardaAte: (abrirAte ?? g.abrirDe) + g.extraGuarda,
          decantarMin: g.decantar ? g.decantar[0] : null,
          decantarMax: g.decantar ? g.decantar[0] + g.decantar[1] : null,
          harmonizacoes: g.harmonizacoes,
        };
      });

    fc.assert(
      fc.property(
        fc.array(fichaKeep, { minLength: 1, maxLength: 5 }),
        (fichas) => {
          const texto = fichas.map(formatarLinhaKeep).join("\n");
          expect(parseListaKeep(texto)).toEqual({
            importados: fichas,
            falhas: [],
          });
        },
      ),
    );
  });
});
