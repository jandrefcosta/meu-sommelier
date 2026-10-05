import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { BuscaPrecosApiBusca, URL_TAVILY } from "../src/busca-precos";
import { FakeLLM } from "../src/fakes";
import { usarServidor } from "./msw";

const pedidos: Array<{ corpo: { query: string }; autorizacao: string | null }> =
  [];
let resposta: () => Response = () => HttpResponse.json({ results: [] });

usarServidor(
  http.post(URL_TAVILY, async ({ request }) => {
    pedidos.push({
      corpo: (await request.json()) as { query: string },
      autorizacao: request.headers.get("authorization"),
    });
    return resposta();
  }),
);

const RESULTADOS = {
  results: [
    {
      title: "Labadie 2020",
      url: "https://loja.example/v",
      content: "R$ 249,90",
    },
  ],
};
const JSON_PRECO =
  '{"encontrado":true,"precoMinReais":220,"precoMaxReais":280,"fontes":[{"loja":"Loja","url":"https://loja.example/v","precoReais":249.9}]}';
const pedido = { nome: "Château Labadie", safra: 2020, timeoutMs: 5_000 };

describe("BuscaPrecosApiBusca", () => {
  beforeEach(() => {
    pedidos.length = 0;
  });

  it("busca na API e extrai o preço com o modelo", async () => {
    resposta = () => HttpResponse.json(RESULTADOS);
    const llm = new FakeLLM([JSON_PRECO]);
    const r = await new BuscaPrecosApiBusca({
      tavilyApiKey: "tvly-teste",
      llm,
    }).buscar(pedido);
    expect(r).toMatchObject({ ok: true, min: 22000, max: 28000 });
    expect(pedidos[0]?.autorizacao).toBe("Bearer tvly-teste");
    expect(pedidos[0]?.corpo.query).toContain("Château Labadie 2020");
    expect(llm.pedidos[0]).toMatchObject({ tipo: "preco" });
    expect(llm.pedidos[0]?.texto).toContain("<resultados_busca>");
  });

  it("descarta fontes cujo host não veio da busca", async () => {
    resposta = () => HttpResponse.json(RESULTADOS);
    const llm = new FakeLLM([
      '{"encontrado":true,"precoMinReais":220,"precoMaxReais":280,"fontes":[{"loja":"Inventada","url":"https://inventada.example/x","precoReais":230},{"loja":"Loja","url":"https://loja.example/outra","precoReais":249.9}]}',
    ]);
    const r = await new BuscaPrecosApiBusca({ tavilyApiKey: "x", llm }).buscar(
      pedido,
    );
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.fontes).toEqual([
      {
        loja: "Loja",
        url: "https://loja.example/outra",
        precoCentavos: 24990,
      },
    ]);
  });

  it("sem nenhuma fonte vinda da busca, vira ok:false com o uso", async () => {
    resposta = () => HttpResponse.json(RESULTADOS);
    const llm = new FakeLLM([
      '{"encontrado":true,"precoMinReais":220,"precoMaxReais":280,"fontes":[{"loja":"Inventada","url":"https://inventada.example/x","precoReais":230}]}',
    ]);
    const r = await new BuscaPrecosApiBusca({ tavilyApiKey: "x", llm }).buscar(
      pedido,
    );
    expect(r.ok).toBe(false);
    expect(r.usos).toHaveLength(1);
  });

  it("falha da API de busca vira ok:false sem chamar o modelo", async () => {
    resposta = () =>
      HttpResponse.json({ detail: "não autorizado" }, { status: 401 });
    const llm = new FakeLLM([JSON_PRECO]);
    expect(
      await new BuscaPrecosApiBusca({ tavilyApiKey: "x", llm }).buscar(pedido),
    ).toEqual({ ok: false, usos: [] });
    expect(llm.pedidos).toHaveLength(0);
  });

  it("busca sem resultados vira ok:false", async () => {
    resposta = () => HttpResponse.json({ results: [] });
    const llm = new FakeLLM([]);
    expect(
      (await new BuscaPrecosApiBusca({ tavilyApiKey: "x", llm }).buscar(pedido))
        .ok,
    ).toBe(false);
  });

  it("modelo inválido duas vezes vira ok:false com os dois usos", async () => {
    resposta = () => HttpResponse.json(RESULTADOS);
    const llm = new FakeLLM(["lixo", "lixo"]);
    const r = await new BuscaPrecosApiBusca({ tavilyApiKey: "x", llm }).buscar(
      pedido,
    );
    expect(r.ok).toBe(false);
    expect(r.usos).toHaveLength(2);
  });
});
