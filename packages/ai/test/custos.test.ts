import { describe, expect, it } from "vitest";
import { custoAnthropicUsd } from "../src/custos";

describe("custoAnthropicUsd", () => {
  it("usa US$ 4 por milhão de tokens de entrada e US$ 20 de saída no Opus 5.5", () => {
    expect(custoAnthropicUsd("claude-opus-5-5", 1_000_000, 0)).toBeCloseTo(4);
    expect(custoAnthropicUsd("claude-opus-5-5", 0, 1_000)).toBeCloseTo(0.02);
  });

  it("soma US$ 0,01 por busca na web", () => {
    expect(custoAnthropicUsd("claude-opus-5-5", 0, 0, 2)).toBeCloseTo(0.02);
  });

  it("conhece o Opus 4.8, para onde o fallback pode mandar o pedido", () => {
    expect(custoAnthropicUsd("claude-opus-4-8", 1_000_000, 0)).toBeCloseTo(5);
  });

  it("devolve null para modelo sem preço conhecido", () => {
    expect(custoAnthropicUsd("modelo-desconhecido", 10, 10)).toBeNull();
  });
});
