import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicLLM } from "../src/anthropic";
import { ErroIA } from "../src/tipos";
import {
  blocoTexto,
  erroAnthropic,
  mensagemAnthropic,
  URL_ANTHROPIC,
} from "./anthropic-falso";
import {
  contratoModeloLLM,
  type Bancada,
  type PedidoVisto,
} from "./contrato-llm";
import { usarServidor } from "./msw";

type Bloco = { type: string; text?: string };
type CorpoAnthropic = {
  model: string;
  system: string;
  fallbacks: unknown;
  output_config: { effort: string; format: { type: string } };
  messages: Array<{ content: string | Bloco[] }>;
};

const corpos: CorpoAnthropic[] = [];
const cabecalhos: Headers[] = [];
const bancada: Bancada = {
  criar: () =>
    new AnthropicLLM({
      apiKey: "chave-teste",
      modelo: "claude-opus-5-5",
      maxRetries: 2,
    }),
  aceitaModeloSemVisao: false,
  fila: [],
  pedidos: [],
};
let extrasResposta: Record<string, unknown> = {};

function verPedido(corpo: CorpoAnthropic): PedidoVisto {
  const blocos = (c: string | Bloco[]): Bloco[] =>
    typeof c === "string" ? [{ type: "text", text: c }] : c;
  const ultima = corpo.messages.at(-1)!;
  return {
    texto: blocos(ultima.content)
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n"),
    temImagem: corpo.messages.some((m) =>
      blocos(m.content).some((b) => b.type === "image"),
    ),
  };
}

usarServidor(
  http.post(URL_ANTHROPIC, async ({ request }) => {
    const corpo = (await request.json()) as CorpoAnthropic;
    corpos.push(corpo);
    cabecalhos.push(request.headers);
    bancada.pedidos.push(verPedido(corpo));
    const resposta = bancada.fila.shift();
    if (!resposta) return erroAnthropic(500);
    if ("status" in resposta) return erroAnthropic(resposta.status);
    if (resposta.demoraMs) await delay(resposta.demoraMs);
    return HttpResponse.json(
      mensagemAnthropic([blocoTexto(resposta.json)], extrasResposta),
    );
  }),
);

contratoModeloLLM("AnthropicLLM", bancada);

describe("AnthropicLLM", () => {
  const Schema = z.object({ vinho: z.string().min(1) });
  const pedido = {
    tipo: "rotulo" as const,
    instrucoes: "Instruções",
    texto: "Oi",
    schema: Schema,
    timeoutMs: 5_000,
  };

  beforeEach(() => {
    corpos.length = 0;
    cabecalhos.length = 0;
    bancada.fila.length = 0;
    bancada.pedidos.length = 0;
    extrasResposta = {};
  });

  it("pede saída estruturada, fallback padrão e esforço médio", async () => {
    bancada.fila.push({ json: '{"vinho":"Malbec"}' });
    await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(corpos[0]).toMatchObject({
      model: "claude-opus-5-5",
      system: "Instruções",
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema" } },
    });
    expect(cabecalhos[0]?.get("anthropic-beta")).toContain(
      "server-side-fallback-2026-07-01",
    );
  });

  it("calcula o custo pelo modelo que respondeu", async () => {
    bancada.fila.push({ json: '{"vinho":"Malbec"}' });
    const r = await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(r.usos[0]).toMatchObject({
      provedor: "anthropic",
      modelo: "claude-opus-5-5",
      tokensEntrada: 100,
      tokensSaida: 20,
    });
    expect(r.usos[0]!.custoUsd).toBeCloseTo(0.0008);
  });

  it("com iterations, soma tokens e custo de todas as tentativas cobradas", async () => {
    bancada.fila.push({ json: '{"vinho":"Malbec"}' });
    const iteracao = (
      type: string,
      model: string | null,
      input_tokens: number,
      output_tokens: number,
    ) => ({
      type,
      model,
      input_tokens,
      output_tokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: null,
    });
    extrasResposta = {
      model: "claude-sonnet-5-5",
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        iterations: [
          iteracao("message", "claude-opus-5-5", 300, 50),
          iteracao("message", null, 40, 10),
          iteracao("fallback_message", "claude-sonnet-5-5", 100, 20),
        ],
      },
    };
    const r = await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(r.usos[0]).toMatchObject({
      modelo: "claude-sonnet-5-5",
      tokensEntrada: 440,
      tokensSaida: 80,
    });
    // opus 5.5: (300*4 + 50*20)/1e6; sem modelo → sonnet 5.5: (40*2 + 10*10)/1e6;
    // sonnet 5.5: (100*2 + 20*10)/1e6
    expect(r.usos[0]!.custoUsd).toBeCloseTo(0.0022 + 0.00018 + 0.0004, 8);
  });

  it("com iterations de modelo sem preço, o custo fica desconhecido", async () => {
    bancada.fila.push({ json: '{"vinho":"Malbec"}' });
    extrasResposta = {
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        iterations: [
          {
            type: "message",
            model: "modelo-desconhecido",
            input_tokens: 10,
            output_tokens: 1,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation: null,
          },
          {
            type: "fallback_message",
            model: "claude-opus-5-5",
            input_tokens: 100,
            output_tokens: 20,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation: null,
          },
        ],
      },
    };
    const r = await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(r.usos[0]).toMatchObject({ tokensEntrada: 110, custoUsd: null });
  });

  it("recusa da IA vira indisponivel", async () => {
    bancada.fila.push({ json: "" });
    extrasResposta = { stop_reason: "refusal" };
    await expect(
      bancada.criar({ suportaImagem: true }).gerarJson(pedido),
    ).rejects.toBeInstanceOf(ErroIA);
  });
});
