import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  extrairJson,
  gerarComRetentativa,
  validarJson,
  type Correcao,
  type Tentativa,
} from "../src/retentativa";
import { ErroIA, type UsoIA } from "../src/tipos";

const Schema = z.object({ vinho: z.string().min(1) });
const uso = (n: number): UsoIA => ({
  tipo: "nome",
  provedor: "teste",
  modelo: "teste",
  tokensEntrada: n,
  tokensSaida: n,
  custoUsd: 0,
});

function roteiro(respostas: Array<string | Error>) {
  const correcoes: (Correcao | null)[] = [];
  let n = 0;
  const chamar = async (c: Correcao | null): Promise<Tentativa> => {
    correcoes.push(c);
    const r = respostas[n++];
    if (r instanceof Error) throw r;
    return { texto: r ?? "", uso: uso(n) };
  };
  return { chamar, correcoes };
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

describe("extrairJson", () => {
  it.each([
    ['{"a":1}', '{"a":1}'],
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['Aqui está:\n{"a":1}\nAbraços', '{"a":1}'],
    ["sem json", "sem json"],
    ['Pesquisei em {3} lojas.\n{"a":1}', '{"a":1}'],
    ['{"a":1} Espero ter ajudado {:)}', '{"a":1}'],
    [
      'Veja: {"a":"chave } dentro","b":{"c":2}} {fim}',
      '{"a":"chave } dentro","b":{"c":2}}',
    ],
  ])("%j → %j", (entrada, esperado) => {
    expect(extrairJson(entrada)).toBe(esperado);
  });
});

describe("validarJson", () => {
  it("aceita JSON válido", () => {
    expect(validarJson('{"vinho":"Malbec"}', Schema)).toEqual({
      ok: true,
      dados: { vinho: "Malbec" },
    });
  });

  it("explica quando não é JSON", () => {
    expect(validarJson("oi", Schema)).toEqual({
      ok: false,
      erro: "a resposta não é um JSON válido",
    });
  });

  it("explica quando o JSON não segue o schema", () => {
    const r = validarJson('{"vinho":""}', Schema);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toContain("vinho");
  });
});

describe("gerarComRetentativa", () => {
  it("devolve os dados na primeira resposta válida", async () => {
    const { chamar, correcoes } = roteiro(['{"vinho":"Malbec"}']);
    await expect(gerarComRetentativa(Schema, chamar)).resolves.toEqual({
      dados: { vinho: "Malbec" },
      usos: [uso(1)],
    });
    expect(correcoes).toEqual([null]);
  });

  it("faz uma nova tentativa com a resposta anterior e o erro", async () => {
    const { chamar, correcoes } = roteiro([
      '{"vinho":""}',
      '{"vinho":"Malbec"}',
    ]);
    const r = await gerarComRetentativa(Schema, chamar);
    expect(r.usos).toHaveLength(2);
    expect(correcoes[1]).toMatchObject({ respostaAnterior: '{"vinho":""}' });
    expect(correcoes[1]?.erro).toContain("vinho");
  });

  it("falha como indisponivel depois de duas respostas inválidas, com os dois usos", async () => {
    const { chamar } = roteiro(["lixo", "lixo"]);
    const erro = await falha(gerarComRetentativa(Schema, chamar));
    expect(erro.motivo).toBe("indisponivel");
    expect(erro.usos).toEqual([uso(1), uso(2)]);
  });

  it("converte erro de rede em indisponivel, guardando a causa e os usos até ali", async () => {
    const rede = new Error("ECONNRESET");
    const { chamar } = roteiro(["lixo", rede]);
    const erro = await falha(gerarComRetentativa(Schema, chamar));
    expect(erro.cause).toBe(rede);
    expect(erro.usos).toEqual([uso(1)]);
  });

  it("junta os usos de um ErroIA lançado pelo provedor", async () => {
    const { chamar } = roteiro([
      "lixo",
      new ErroIA("indisponivel", "recusou", [uso(9)]),
    ]);
    const erro = await falha(gerarComRetentativa(Schema, chamar));
    expect(erro.usos).toEqual([uso(1), uso(9)]);
  });
});
