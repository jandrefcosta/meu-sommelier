import { describe, expect, it } from "vitest";
import { avaliarLeitura, mimeDoArquivo } from "../src/avaliacao";
import { FICHA_FAKE } from "../src/fakes";
import type { UsoIA } from "../src/tipos";

const uso = (custoUsd: number | null): UsoIA => ({
  tipo: "rotulo",
  provedor: "anthropic",
  modelo: "claude-opus-5-5",
  tokensEntrada: 1,
  tokensSaida: 1,
  custoUsd,
});

describe("avaliarLeitura", () => {
  const esperado = {
    arquivo: "labadie.jpg",
    nome: "Chateau Labadie",
    safra: 2020,
  };

  it("acerta o nome quando um contém o outro, ignorando acentos e caixa", () => {
    const r = avaliarLeitura(esperado, {
      ok: true,
      ficha: FICHA_FAKE,
      precoConsultado: true,
      usos: [uso(0.01), uso(0.02)],
    });
    expect(r.acertouNome).toBe(true);
    expect(r.acertouSafra).toBe(true);
    expect(r.custoUsd).toBeCloseTo(0.03);
  });

  it("erra a safra quando ela é diferente", () => {
    const r = avaliarLeitura(
      { ...esperado, safra: 2019 },
      { ok: true, ficha: FICHA_FAKE, precoConsultado: false, usos: [] },
    );
    expect(r).toEqual({ acertouNome: true, acertouSafra: false, custoUsd: 0 });
  });

  it.each([
    ["o nome lido", { nome: " ", esperado: "Chateau Labadie" }],
    ["o nome esperado", { nome: FICHA_FAKE.nome, esperado: " " }],
  ])(
    "erra o nome quando %s normaliza para vazio",
    (_caso, { nome, esperado: alvo }) => {
      const r = avaliarLeitura(
        { ...esperado, nome: alvo },
        {
          ok: true,
          ficha: { ...FICHA_FAKE, nome },
          precoConsultado: false,
          usos: [],
        },
      );
      expect(r.acertouNome).toBe(false);
    },
  );

  it("leitura que falhou erra tudo e soma custo desconhecido como zero", () => {
    expect(
      avaliarLeitura(esperado, {
        ok: false,
        motivo: "ilegivel",
        usos: [uso(null)],
      }),
    ).toEqual({
      acertouNome: false,
      acertouSafra: false,
      custoUsd: 0,
    });
  });
});

describe("mimeDoArquivo", () => {
  it.each([
    ["a.jpg", "image/jpeg"],
    ["a.JPEG", "image/jpeg"],
    ["a.png", "image/png"],
    ["a.webp", "image/webp"],
    ["a.heic", null],
  ])("%s → %s", (arquivo, mime) => {
    expect(mimeDoArquivo(arquivo)).toBe(mime);
  });
});
