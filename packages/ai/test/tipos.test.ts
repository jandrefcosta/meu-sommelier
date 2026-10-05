import { describe, expect, it } from "vitest";
import { ErroIA, type UsoIA } from "../src/tipos";

describe("ErroIA", () => {
  it("guarda motivo, usos e causa", () => {
    const uso: UsoIA = {
      tipo: "nome",
      provedor: "fake",
      modelo: "fake",
      tokensEntrada: 1,
      tokensSaida: 1,
      custoUsd: 0,
    };
    const causa = new Error("rede");
    const erro = new ErroIA("indisponivel", "falhou", [uso], { cause: causa });
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toMatchObject({
      name: "ErroIA",
      motivo: "indisponivel",
      usos: [uso],
    });
    expect(erro.cause).toBe(causa);
  });

  it("começa sem usos", () => {
    expect(new ErroIA("indisponivel", "x").usos).toEqual([]);
  });
});
