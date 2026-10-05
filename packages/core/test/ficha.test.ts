import { describe, expect, it } from "vitest";
import {
  FichaVinhoCamposSchema,
  FichaVinhoSchema,
  type FichaVinho,
} from "../src/ficha";
import { fichaValida } from "./fabricas";

function erros(dados: unknown): string[] {
  const resultado = FichaVinhoSchema.safeParse(dados);
  return resultado.success ? [] : resultado.error.issues.map((i) => i.message);
}

describe("FichaVinhoSchema", () => {
  it("aceita a ficha da lista da PO", () => {
    expect(erros(fichaValida())).toEqual([]);
  });

  it("aceita safra NV, preço não consultado e decantação não necessária", () => {
    const ficha = fichaValida({
      safra: null,
      precoMinCentavos: null,
      precoMaxCentavos: null,
      decantarMin: null,
      decantarMax: null,
    });
    expect(erros(ficha)).toEqual([]);
  });

  it("aceita faixa de abertura e guarda igual ao fim da faixa", () => {
    expect(
      erros(fichaValida({ abrirDe: 2027, abrirAte: 2028, guardaAte: 2028 })),
    ).toEqual([]);
  });

  it("aceita fontes de preço com link https e data da consulta", () => {
    const ficha = fichaValida({
      precoFontes: [
        {
          loja: "Loja X",
          url: "https://loja.example/vinho",
          precoCentavos: 25000,
        },
      ],
      precoConsultadoEm: "2026-10-05T12:00:00-03:00",
    });
    expect(erros(ficha)).toEqual([]);
  });

  it("remove espaços das pontas do nome", () => {
    expect(
      FichaVinhoSchema.parse(fichaValida({ nome: "  Malbec  " })).nome,
    ).toBe("Malbec");
  });

  it.each<[string, Partial<FichaVinho>, string]>([
    ["nome vazio", { nome: "   " }, "nome é obrigatório"],
    [
      "nome com 201 caracteres",
      { nome: "a".repeat(201) },
      "nome tem no máximo 200 caracteres",
    ],
    [
      "só o preço mínimo",
      { precoMaxCentavos: null },
      "informe o preço mínimo e o máximo juntos",
    ],
    [
      "preço mínimo maior que o máximo",
      { precoMinCentavos: 30000, precoMaxCentavos: 20000 },
      "preço mínimo maior que o máximo",
    ],
    ["preço negativo", { precoMinCentavos: -1 }, "preço não pode ser negativo"],
    [
      "fim da janela antes do início",
      { abrirDe: 2027, abrirAte: 2026, guardaAte: 2030 },
      "fim da janela de abertura antes do início",
    ],
    [
      "guarda antes do fim da janela",
      { abrirDe: 2027, abrirAte: 2028, guardaAte: 2027 },
      "guarda máxima antes da janela de abertura",
    ],
    [
      "guarda antes do início da janela",
      { abrirDe: 2027, guardaAte: 2026 },
      "guarda máxima antes da janela de abertura",
    ],
    [
      "só a decantação mínima",
      { decantarMax: null },
      "informe a decantação mínima e a máxima juntas",
    ],
    [
      "decantação mínima maior que a máxima",
      { decantarMin: 60, decantarMax: 30 },
      "decantação mínima maior que a máxima",
    ],
    [
      "sem harmonização",
      { harmonizacoes: [] },
      "informe ao menos 1 harmonização",
    ],
    [
      "6 harmonizações",
      { harmonizacoes: ["a", "b", "c", "d", "e", "f"] },
      "no máximo 5 harmonizações",
    ],
    ["safra com 2 dígitos", { safra: 20 }, "ano deve ter 4 dígitos"],
  ])("rejeita %s", (_caso, sobrescrever, mensagem) => {
    expect(erros(fichaValida(sobrescrever))).toContain(mensagem);
  });

  it("rejeita tipo fora da lista", () => {
    expect(
      FichaVinhoSchema.safeParse({ ...fichaValida(), tipo: "laranja" }).success,
    ).toBe(false);
  });

  it("rejeita fonte de preço com link que não é http(s)", () => {
    const ficha = fichaValida({
      precoFontes: [
        { loja: "X", url: "javascript:alert(1)", precoCentavos: 100 },
      ],
    });
    expect(erros(ficha)).toContain("a fonte precisa ser um link http(s)");
  });

  it("expõe os campos sem regras para que outros pacotes possam usar omit", () => {
    const semPreco = FichaVinhoCamposSchema.omit({
      precoMinCentavos: true,
      precoMaxCentavos: true,
      precoFontes: true,
      precoConsultadoEm: true,
    });
    const {
      precoMinCentavos,
      precoMaxCentavos,
      precoFontes,
      precoConsultadoEm,
      ...resto
    } = fichaValida();
    void [precoMinCentavos, precoMaxCentavos, precoFontes, precoConsultadoEm];
    expect(semPreco.safeParse(resto).success).toBe(true);
  });

  it("os campos sozinhos não aplicam as regras entre campos", () => {
    const invalida = fichaValida({ abrirDe: 2027, guardaAte: 2026 });
    expect(FichaVinhoCamposSchema.safeParse(invalida).success).toBe(true);
    expect(FichaVinhoSchema.safeParse(invalida).success).toBe(false);
  });
});
