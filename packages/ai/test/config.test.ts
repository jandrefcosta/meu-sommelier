import { describe, expect, it } from "vitest";
import { carregarConfigIA, criarSommelier } from "../src/config";
import { FakeSommelier } from "../src/fakes";
import { SommelierPadrao } from "../src/sommelier";

const BASE = { ANTHROPIC_API_KEY: "sk-ant-teste" };

describe("carregarConfigIA", () => {
  it("usa os padrões da spec", () => {
    expect(carregarConfigIA(BASE)).toMatchObject({
      IA_ROTULO: { provedor: "anthropic", modelo: "claude-opus-5-5" },
      IA_PRATO: { provedor: "anthropic", modelo: "claude-opus-5-5" },
      IA_PRECO_BUSCA: "anthropic",
      IA_PRECO_MODELO: "claude-opus-5-5",
      OPENAI_COMPAT_JSON_SCHEMA: true,
      OPENAI_COMPAT_SUPORTA_IMAGEM: true,
    });
  });

  it("aceita openai-compat com as chaves e lê os booleanos", () => {
    const config = carregarConfigIA({
      IA_ROTULO: "openai-compat:gpt-visao",
      IA_PRATO: "openai-compat:llama",
      IA_PRECO_BUSCA: "nenhuma",
      OPENAI_COMPAT_BASE_URL: "https://omnirouter.exemplo/v1",
      OPENAI_COMPAT_API_KEY: "chave",
      OPENAI_COMPAT_JSON_SCHEMA: "false",
    });
    expect(config.IA_PRATO).toEqual({
      provedor: "openai-compat",
      modelo: "llama",
    });
    expect(config.OPENAI_COMPAT_JSON_SCHEMA).toBe(false);
  });

  it("tira espaços das pontas dos valores", () => {
    const config = carregarConfigIA({
      ANTHROPIC_API_KEY: " sk-ant-teste ",
      IA_ROTULO: "anthropic:claude-opus-5-5 ",
      IA_PRECO_BUSCA: "nenhuma\n",
      OPENAI_COMPAT_JSON_SCHEMA: " false",
    });
    expect(config).toMatchObject({
      ANTHROPIC_API_KEY: "sk-ant-teste",
      IA_ROTULO: { provedor: "anthropic", modelo: "claude-opus-5-5" },
      IA_PRECO_BUSCA: "nenhuma",
      OPENAI_COMPAT_JSON_SCHEMA: false,
    });
  });

  it.each([
    ["sem chave da Anthropic", {}, /ANTHROPIC_API_KEY/],
    [
      "chave vazia conta como ausente",
      { ANTHROPIC_API_KEY: "" },
      /ANTHROPIC_API_KEY/,
    ],
    [
      "provedor desconhecido",
      { ...BASE, IA_PRATO: "gemini:pro" },
      /provedor:modelo/,
    ],
    [
      "openai-compat sem URL",
      { ...BASE, IA_PRATO: "openai-compat:m", OPENAI_COMPAT_API_KEY: "k" },
      /OPENAI_COMPAT_BASE_URL/,
    ],
    [
      "rótulo num modelo sem visão",
      {
        ...BASE,
        IA_ROTULO: "openai-compat:m",
        OPENAI_COMPAT_BASE_URL: "https://x.exemplo/v1",
        OPENAI_COMPAT_API_KEY: "k",
        OPENAI_COMPAT_SUPORTA_IMAGEM: "false",
      },
      /precisa aceitar imagem/,
    ],
    [
      "api-busca sem Tavily",
      { ...BASE, IA_PRECO_BUSCA: "api-busca" },
      /TAVILY_API_KEY/,
    ],
    ["fake misturado", { ...BASE, IA_ROTULO: "fake:fake" }, /modo fake/],
  ])("falha na subida: %s", (_caso, env, mensagem) => {
    expect(() => carregarConfigIA(env)).toThrow(mensagem);
  });
});

describe("criarSommelier", () => {
  it("modo fake devolve o FakeSommelier", () => {
    const config = carregarConfigIA({
      IA_ROTULO: "fake:fake",
      IA_PRATO: "fake:fake",
      IA_PRECO_BUSCA: "fake",
    });
    expect(criarSommelier(config)).toBeInstanceOf(FakeSommelier);
  });

  it.each([
    BASE,
    { ...BASE, IA_PRECO_BUSCA: "api-busca", TAVILY_API_KEY: "tvly" },
    {
      ...BASE,
      IA_PRECO_BUSCA: "nenhuma",
      IA_PRATO: "openai-compat:m",
      OPENAI_COMPAT_BASE_URL: "https://x.exemplo/v1",
      OPENAI_COMPAT_API_KEY: "k",
    },
  ])("provedores reais montam o SommelierPadrao (%#)", (env) => {
    expect(criarSommelier(carregarConfigIA(env))).toBeInstanceOf(
      SommelierPadrao,
    );
  });
});
