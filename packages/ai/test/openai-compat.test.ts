import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { OpenAICompativelLLM } from "../src/openai-compat";
import {
  contratoModeloLLM,
  type Bancada,
  type PedidoVisto,
} from "./contrato-llm";
import { usarServidor } from "./msw";

const URL_COMPAT = "https://compat.test/v1";
type Parte = { type: string; text?: string };
type CorpoOpenAI = {
  model: string;
  response_format?: { type: string; json_schema: { name: string } };
  messages: Array<{ role: string; content: string | Parte[] }>;
};

const corpos: CorpoOpenAI[] = [];
let usarJsonSchema = true;
const bancada: Bancada = {
  criar: ({ suportaImagem }) =>
    new OpenAICompativelLLM({
      apiKey: "chave-teste",
      baseURL: URL_COMPAT,
      modelo: "modelo-compat",
      usarJsonSchema,
      suportaImagem,
      maxRetries: 2,
    }),
  aceitaModeloSemVisao: true,
  fila: [],
  pedidos: [],
};

function verPedido(corpo: CorpoOpenAI): PedidoVisto {
  const partes = (c: string | Parte[]): Parte[] =>
    typeof c === "string" ? [{ type: "text", text: c }] : c;
  const ultima = corpo.messages.at(-1)!;
  return {
    texto: partes(ultima.content)
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n"),
    temImagem: corpo.messages.some((m) =>
      partes(m.content).some((p) => p.type === "image_url"),
    ),
  };
}

function erroOpenAI(status: number) {
  return HttpResponse.json(
    { error: { message: "falha simulada", type: "server_error" } },
    { status, headers: { "retry-after-ms": "10" } },
  );
}

usarServidor(
  http.post(`${URL_COMPAT}/chat/completions`, async ({ request }) => {
    const corpo = (await request.json()) as CorpoOpenAI;
    corpos.push(corpo);
    bancada.pedidos.push(verPedido(corpo));
    const resposta = bancada.fila.shift();
    if (!resposta) return erroOpenAI(500);
    if ("status" in resposta) return erroOpenAI(resposta.status);
    if (resposta.demoraMs) await delay(resposta.demoraMs);
    return HttpResponse.json({
      id: "c",
      object: "chat.completion",
      created: 0,
      model: "modelo-compat",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: resposta.json },
        },
      ],
      usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
    });
  }),
);

contratoModeloLLM("OpenAICompativelLLM", bancada);

describe("OpenAICompativelLLM", () => {
  const pedido = {
    tipo: "prato" as const,
    instrucoes: "Instruções",
    texto: "Oi",
    schema: z.object({ vinho: z.string() }),
    timeoutMs: 5_000,
  };

  beforeEach(() => {
    corpos.length = 0;
    bancada.fila.length = 0;
    bancada.pedidos.length = 0;
    usarJsonSchema = true;
  });

  it("usa response_format json_schema quando o provedor aceita", async () => {
    bancada.fila.push({ json: '{"vinho":"Malbec"}' });
    await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(corpos[0]?.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "resposta" },
    });
    expect(corpos[0]?.messages[0]).toEqual({
      role: "system",
      content: "Instruções",
    });
  });

  it("sem json_schema, manda o schema nas instruções", async () => {
    usarJsonSchema = false;
    bancada.fila.push({ json: '```json\n{"vinho":"Malbec"}\n```' });
    const r = await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(r.dados).toEqual({ vinho: "Malbec" });
    expect(corpos[0]?.response_format).toBeUndefined();
    expect(corpos[0]?.messages[0]?.content).toContain("JSON Schema");
  });

  it("registra tokens e deixa o custo desconhecido", async () => {
    bancada.fila.push({ json: '{"vinho":"Malbec"}' });
    const r = await bancada.criar({ suportaImagem: true }).gerarJson(pedido);
    expect(r.usos[0]).toEqual({
      tipo: "prato",
      provedor: "openai-compat",
      modelo: "modelo-compat",
      tokensEntrada: 30,
      tokensSaida: 10,
      custoUsd: null,
    });
  });
});
