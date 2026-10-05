import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { BuscaPrecosAnthropic, SemBuscaPrecos } from "../src/busca-precos";
import {
  blocoTexto,
  erroAnthropic,
  mensagemAnthropic,
  URL_ANTHROPIC,
} from "./anthropic-falso";
import { usarServidor } from "./msw";

type CorpoBusca = {
  tools: unknown[];
  messages: Array<{ content: string }>;
  fallbacks: unknown;
};
const corpos: CorpoBusca[] = [];
let proxima: () => Response = () => erroAnthropic(500);

usarServidor(
  http.post(URL_ANTHROPIC, async ({ request }) => {
    corpos.push((await request.json()) as CorpoBusca);
    return proxima();
  }),
);

const JSON_PRECO =
  '{"encontrado":true,"precoMinReais":220,"precoMaxReais":280,"fontes":[{"loja":"Loja","url":"https://loja.example/v","precoReais":249.9}]}';
const buscaOk = {
  type: "server_tool_use",
  id: "srvtoolu_1",
  name: "web_search",
  input: { query: "q" },
};
const resultadoOk = {
  type: "web_search_tool_result",
  tool_use_id: "srvtoolu_1",
  content: [
    {
      type: "web_search_result",
      url: "https://loja.example/v",
      title: "Loja",
      encrypted_content: "x",
      page_age: null,
    },
  ],
};
const comBusca = (
  extras: Record<string, unknown> = {},
  conteudo: unknown[] = [
    buscaOk,
    resultadoOk,
    blocoTexto(`Achei.\n${JSON_PRECO}`),
  ],
) =>
  HttpResponse.json(
    mensagemAnthropic(conteudo, {
      usage: {
        input_tokens: 1000,
        output_tokens: 100,
        server_tool_use: { web_search_requests: 2 },
      },
      ...extras,
    }),
  );

const busca = () =>
  new BuscaPrecosAnthropic({
    apiKey: "chave-teste",
    modelo: "claude-opus-5-5",
    maxRetries: 0,
  });
const pedido = { nome: "Château Labadie", safra: 2020, timeoutMs: 5_000 };

describe("BuscaPrecosAnthropic", () => {
  beforeEach(() => {
    corpos.length = 0;
  });

  it("devolve a faixa em centavos, as fontes e o uso com as buscas", async () => {
    proxima = () => comBusca();
    const r = await busca().buscar(pedido);
    expect(r).toMatchObject({
      ok: true,
      min: 22000,
      max: 28000,
      fontes: [
        { loja: "Loja", url: "https://loja.example/v", precoCentavos: 24990 },
      ],
    });
    expect(r.usos[0]).toMatchObject({ tipo: "preco", tokensEntrada: 1000 });
    expect(r.usos[0]!.custoUsd).toBeCloseTo(0.004 + 0.002 + 0.02);
  });

  it("usa web_search no Brasil com no máximo 3 buscas e fallback padrão", async () => {
    proxima = () => comBusca();
    await busca().buscar(pedido);
    expect(corpos[0]?.tools).toEqual([
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: 3,
        user_location: {
          type: "approximate",
          country: "BR",
          timezone: "America/Sao_Paulo",
        },
      },
    ]);
    expect(corpos[0]?.fallbacks).toBe("default");
    expect(corpos[0]?.messages[0]?.content).toContain(
      "<vinho>Château Labadie</vinho>",
    );
  });

  it("erro da busca devolvido com HTTP 200 vira ok:false", async () => {
    const erroBusca = {
      type: "web_search_tool_result",
      tool_use_id: "srvtoolu_1",
      content: {
        type: "web_search_tool_result_error",
        error_code: "unavailable",
      },
    };
    proxima = () => comBusca({}, [buscaOk, erroBusca, blocoTexto(JSON_PRECO)]);
    const r = await busca().buscar(pedido);
    expect(r.ok).toBe(false);
    expect(r.usos).toHaveLength(1);
  });

  it.each([
    ["turno pausado", () => comBusca({ stop_reason: "pause_turn" })],
    ["resposta sem JSON", () => comBusca({}, [blocoTexto("Não sei.")])],
    [
      "preço como texto",
      () =>
        comBusca({}, [
          blocoTexto(
            '{"encontrado":true,"precoMinReais":"R$ 220","precoMaxReais":280,"fontes":[]}',
          ),
        ]),
    ],
    [
      "preço não encontrado",
      () =>
        comBusca({}, [
          blocoTexto(
            '{"encontrado":false,"precoMinReais":null,"precoMaxReais":null,"fontes":[]}',
          ),
        ]),
    ],
  ])("%s vira ok:false", async (_caso, resposta) => {
    proxima = resposta;
    expect((await busca().buscar(pedido)).ok).toBe(false);
  });

  it("falha HTTP vira ok:false sem usos", async () => {
    proxima = () => erroAnthropic(500);
    expect(await busca().buscar(pedido)).toEqual({ ok: false, usos: [] });
  });
});

describe("SemBuscaPrecos", () => {
  it("nunca consulta preço", async () => {
    expect(await new SemBuscaPrecos().buscar()).toEqual({
      ok: false,
      usos: [],
    });
  });
});
