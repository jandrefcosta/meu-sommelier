import { describe, expect, it } from "vitest";
import * as ai from "../src/index";

describe("@meu-sommelier/ai", () => {
  it.each([
    "ErroIA",
    "SommelierPadrao",
    "FakeSommelier",
    "FakeLLM",
    "FakeBuscaPrecos",
    "AnthropicLLM",
    "OpenAICompativelLLM",
    "BuscaPrecosAnthropic",
    "BuscaPrecosApiBusca",
    "SemBuscaPrecos",
    "carregarConfigIA",
    "criarSommelier",
    "avaliarLeitura",
  ])("exporta %s", (nome) => {
    expect(ai).toHaveProperty(nome);
  });
});
