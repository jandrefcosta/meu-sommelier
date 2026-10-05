import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ErroIA, type ModeloLLM, type PedidoJson } from "../src/tipos";

export type RespostaFalsa =
  { json: string; demoraMs?: number } | { status: number };
export interface PedidoVisto {
  texto: string;
  temImagem: boolean;
}
export interface Bancada {
  criar(opcoes: { suportaImagem: boolean }): ModeloLLM;
  aceitaModeloSemVisao: boolean;
  fila: RespostaFalsa[];
  pedidos: PedidoVisto[];
}

const Schema = z.object({ vinho: z.string().min(1) });
const IMAGEM = {
  bytes: new Uint8Array([1, 2, 3]),
  mime: "image/jpeg" as const,
};

function pedido(
  extras: Partial<PedidoJson<{ vinho: string }>> = {},
): PedidoJson<{ vinho: string }> {
  return {
    tipo: "nome",
    instrucoes: "Responda em JSON.",
    texto: "Qual vinho?",
    schema: Schema,
    timeoutMs: 5_000,
    ...extras,
  };
}

async function falha(promessa: Promise<unknown>): Promise<ErroIA> {
  try {
    await promessa;
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroIA);
    return erro as ErroIA;
  }
  throw new Error("deveria ter falhado");
}

export function contratoModeloLLM(nome: string, bancada: Bancada) {
  describe(`contrato ModeloLLM: ${nome}`, () => {
    beforeEach(() => {
      bancada.fila.length = 0;
      bancada.pedidos.length = 0;
    });

    it("JSON válido devolve os dados e um uso", async () => {
      bancada.fila.push({ json: '{"vinho":"Malbec"}' });
      const r = await bancada
        .criar({ suportaImagem: true })
        .gerarJson(pedido());
      expect(r.dados).toEqual({ vinho: "Malbec" });
      expect(r.usos).toHaveLength(1);
      expect(r.usos[0]).toMatchObject({ tipo: "nome" });
      expect(r.usos[0]!.tokensEntrada).toBeGreaterThan(0);
    });

    it("JSON inválido gera nova tentativa com o erro, e a segunda resposta vale", async () => {
      bancada.fila.push(
        { json: '{"vinho":""}' },
        { json: '{"vinho":"Malbec"}' },
      );
      const r = await bancada
        .criar({ suportaImagem: true })
        .gerarJson(pedido());
      expect(r.dados).toEqual({ vinho: "Malbec" });
      expect(r.usos).toHaveLength(2);
      expect(bancada.pedidos[1]?.texto).toContain("não passou na validação");
    });

    it("JSON inválido duas vezes vira indisponivel, com os dois usos", async () => {
      bancada.fila.push({ json: "{}" }, { json: "{}" });
      const erro = await falha(
        bancada.criar({ suportaImagem: true }).gerarJson(pedido()),
      );
      expect(erro.motivo).toBe("indisponivel");
      expect(erro.usos).toHaveLength(2);
    });

    it("429 é repetido pelo SDK e depois funciona", async () => {
      bancada.fila.push({ status: 429 }, { json: '{"vinho":"Malbec"}' });
      const r = await bancada
        .criar({ suportaImagem: true })
        .gerarJson(pedido());
      expect(r.dados).toEqual({ vinho: "Malbec" });
      expect(bancada.pedidos).toHaveLength(2);
    });

    it("500 persistente vira indisponivel", async () => {
      bancada.fila.push({ status: 500 }, { status: 500 }, { status: 500 });
      const erro = await falha(
        bancada.criar({ suportaImagem: true }).gerarJson(pedido()),
      );
      expect(erro.motivo).toBe("indisponivel");
    });

    it("timeout vira indisponivel", async () => {
      bancada.fila.push({ json: '{"vinho":"Malbec"}', demoraMs: 1_000 });
      const erro = await falha(
        bancada
          .criar({ suportaImagem: true })
          .gerarJson(pedido({ timeoutMs: 50 })),
      );
      expect(erro.motivo).toBe("indisponivel");
    });

    it("envia a imagem quando o modelo tem visão", async () => {
      bancada.fila.push({ json: '{"vinho":"Malbec"}' });
      await bancada
        .criar({ suportaImagem: true })
        .gerarJson(pedido({ imagem: IMAGEM }));
      expect(bancada.pedidos[0]?.temImagem).toBe(true);
    });

    it.runIf(bancada.aceitaModeloSemVisao)(
      "modelo sem visão recusa imagem sem chamar a API",
      async () => {
        const erro = await falha(
          bancada
            .criar({ suportaImagem: false })
            .gerarJson(pedido({ imagem: IMAGEM })),
        );
        expect(erro.motivo).toBe("indisponivel");
        expect(bancada.pedidos).toHaveLength(0);
      },
    );
  });
}
