import { FichaVinhoSchema } from "@meu-sommelier/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  FichaIASchema,
  PrecoIASchema,
  RespostaFichaSchema,
  RespostaSugestaoSchema,
  completarFicha,
  precoParaCentavos,
  type FichaIA,
} from "../src/respostas";

const fichaIA: FichaIA = {
  nome: "Château Labadie Médoc Cru Bourgeois",
  produtor: null,
  safra: 2020,
  tipo: "tinto",
  uvas: ["Cabernet Sauvignon", "Merlot"],
  pais: "França",
  regiao: "Médoc",
  abrirDe: 2026,
  abrirAte: null,
  guardaAte: 2030,
  decantarMin: 30,
  decantarMax: 45,
  harmonizacoes: ["Estrogonofe de carne"],
};

const mensagens = (dados: unknown, schema: z.ZodType) => {
  const r = schema.safeParse(dados);
  return r.success
    ? []
    : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("RespostaFichaSchema", () => {
  it("aceita status ok com ficha", () => {
    expect(
      mensagens({ status: "ok", ficha: fichaIA }, RespostaFichaSchema),
    ).toEqual([]);
  });

  it("aceita nao_e_vinho e ilegivel sem ficha", () => {
    expect(
      mensagens({ status: "nao_e_vinho", ficha: null }, RespostaFichaSchema),
    ).toEqual([]);
    expect(
      mensagens({ status: "ilegivel", ficha: null }, RespostaFichaSchema),
    ).toEqual([]);
  });

  it("exige a ficha quando o status é ok", () => {
    expect(
      mensagens({ status: "ok", ficha: null }, RespostaFichaSchema),
    ).toEqual(["ficha: status ok exige a ficha"]);
  });

  it("aplica as regras do core com o caminho dentro de ficha", () => {
    expect(
      mensagens(
        { status: "ok", ficha: { ...fichaIA, guardaAte: 2020 } },
        RespostaFichaSchema,
      ),
    ).toEqual(["ficha.guardaAte: guarda máxima antes da janela de abertura"]);
  });

  it("não pede preço para a IA", () => {
    expect(Object.keys(FichaIASchema.shape)).not.toContain("precoMinCentavos");
    expect(JSON.stringify(z.toJSONSchema(RespostaFichaSchema))).not.toContain(
      "preco",
    );
  });

  it("completarFicha gera uma FichaVinho válida sem preço", () => {
    const ficha = completarFicha(fichaIA);
    expect(FichaVinhoSchema.safeParse(ficha).success).toBe(true);
    expect(ficha).toMatchObject({
      precoMinCentavos: null,
      precoFontes: [],
      precoConsultadoEm: null,
    });
  });
});

describe("RespostaSugestaoSchema", () => {
  it("aceita sugestões e semBoaOpcao nulo", () => {
    const dados = {
      sugestoes: [{ itemId: "a", motivo: "Combina.", decantarMin: 30 }],
      semBoaOpcao: null,
    };
    expect(mensagens(dados, RespostaSugestaoSchema)).toEqual([]);
  });

  it("aceita lista vazia com estilo ideal", () => {
    const dados = {
      sugestoes: [],
      semBoaOpcao: { estiloIdeal: "Um branco leve" },
    };
    expect(mensagens(dados, RespostaSugestaoSchema)).toEqual([]);
  });
});

describe("PrecoIASchema e precoParaCentavos", () => {
  const preco = {
    encontrado: true,
    precoMinReais: 89.9,
    precoMaxReais: 120,
    fontes: [{ loja: "Loja", url: "https://loja.example/v", precoReais: 99.9 }],
  };

  it("converte reais em centavos sem erro de arredondamento", () => {
    expect(precoParaCentavos(PrecoIASchema.parse(preco))).toEqual({
      min: 8990,
      max: 12000,
      fontes: [
        { loja: "Loja", url: "https://loja.example/v", precoCentavos: 9990 },
      ],
    });
  });

  it("devolve null quando não encontrou", () => {
    const naoEncontrado = {
      encontrado: false,
      precoMinReais: null,
      precoMaxReais: null,
      fontes: [],
    };
    expect(precoParaCentavos(PrecoIASchema.parse(naoEncontrado))).toBeNull();
  });

  it.each([
    ["preço como texto", { ...preco, precoMinReais: "R$ 1.234,56" }],
    [
      "link que não é http(s)",
      {
        ...preco,
        fontes: [{ ...preco.fontes[0], url: "javascript:alert(1)" }],
      },
    ],
    ["encontrado sem fonte", { ...preco, fontes: [] }],
    ["encontrado sem faixa", { ...preco, precoMaxReais: null }],
    ["mínimo maior que o máximo", { ...preco, precoMinReais: 200 }],
  ])("rejeita %s", (_caso, dados) => {
    expect(PrecoIASchema.safeParse(dados).success).toBe(false);
  });
});
