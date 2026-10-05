import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FakeLLM } from "../src/fakes";
import { ErroIA } from "../src/tipos";

const pedido = {
  tipo: "prato" as const,
  instrucoes: "i",
  texto: "t",
  schema: z.object({ a: z.number() }),
  timeoutMs: 1000,
};

describe("FakeLLM", () => {
  it("responde a fila em ordem, validando e refazendo como um provedor real", async () => {
    const llm = new FakeLLM(['{"a":"x"}', '{"a":1}']);
    const r = await llm.gerarJson(pedido);
    expect(r.dados).toEqual({ a: 1 });
    expect(r.usos).toHaveLength(2);
    expect(r.usos[0]).toMatchObject({
      tipo: "prato",
      provedor: "fake",
      custoUsd: 0,
    });
    expect(llm.pedidos).toHaveLength(1);
    expect(llm.correcoes[0]).toBeNull();
    expect(llm.correcoes[1]).not.toBeNull();
  });

  it("recusa imagem quando configurado sem visão", async () => {
    const llm = new FakeLLM(['{"a":1}'], false);
    await expect(
      llm.gerarJson({
        ...pedido,
        imagem: { bytes: new Uint8Array(), mime: "image/jpeg" },
      }),
    ).rejects.toBeInstanceOf(ErroIA);
  });

  it("vira indisponivel quando a fila acaba", async () => {
    await expect(new FakeLLM([]).gerarJson(pedido)).rejects.toMatchObject({
      motivo: "indisponivel",
    });
  });
});
