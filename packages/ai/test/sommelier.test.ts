import { relogioFixo, type Relogio } from "@meu-sommelier/core";
import { describe, expect, it } from "vitest";
import { FakeBuscaPrecos, FakeLLM, usoFake } from "../src/fakes";
import {
  ESTILO_SEM_SUGESTAO,
  SommelierPadrao,
  TIMEOUT_FICHA_MS,
  TIMEOUT_PRATO_MS,
} from "../src/sommelier";
import type { ItemResumo, ResultadoBuscaPrecos } from "../src/tipos";

const FICHA = {
  nome: "Château Labadie Médoc Cru Bourgeois",
  produtor: null,
  safra: 2020,
  tipo: "tinto",
  uvas: [],
  pais: "França",
  regiao: "Médoc",
  abrirDe: 2026,
  abrirAte: null,
  guardaAte: 2030,
  decantarMin: 30,
  decantarMax: 45,
  harmonizacoes: ["Estrogonofe de carne"],
};
const fichaOk = JSON.stringify({ status: "ok", ficha: FICHA });
const PRECO_OK: ResultadoBuscaPrecos = {
  ok: true,
  min: 22000,
  max: 28000,
  fontes: [
    { loja: "Loja", url: "https://loja.example/v", precoCentavos: 24990 },
  ],
  usos: [usoFake("preco")],
};
const IMAGEM = { bytes: new Uint8Array([1]), mime: "image/jpeg" as const };
const AGORA = "2026-10-05T20:00:00-03:00";

function montar(
  respostas: string[],
  preco: ResultadoBuscaPrecos = PRECO_OK,
  relogio: Relogio = relogioFixo(AGORA),
) {
  const llmRotulo = new FakeLLM([...respostas]);
  const llmPrato = new FakeLLM([...respostas]);
  const buscaPrecos = new FakeBuscaPrecos(preco);
  return {
    sommelier: new SommelierPadrao({
      llmRotulo,
      llmPrato,
      buscaPrecos,
      relogio,
    }),
    llmRotulo,
    llmPrato,
    buscaPrecos,
  };
}

function relogioQueAvanca(passosMs: number[]): Relogio {
  let atual = new Date(AGORA).getTime();
  return {
    agora: () => {
      const instante = new Date(atual);
      atual += passosMs.shift() ?? 0;
      return instante;
    },
  };
}

describe("SommelierPadrao.lerRotulo", () => {
  it("lê o rótulo, busca o preço e devolve a ficha completa", async () => {
    const { sommelier, llmRotulo, buscaPrecos } = montar([fichaOk]);
    const r = await sommelier.lerRotulo(IMAGEM);
    expect(r).toMatchObject({
      ok: true,
      precoConsultado: true,
      ficha: {
        nome: FICHA.nome,
        precoMinCentavos: 22000,
        precoMaxCentavos: 28000,
        precoConsultadoEm: "2026-10-05T23:00:00.000Z",
      },
    });
    expect(r.usos.map((u) => u.tipo)).toEqual(["rotulo", "preco"]);
    expect(llmRotulo.pedidos[0]).toMatchObject({
      tipo: "rotulo",
      imagem: IMAGEM,
      timeoutMs: TIMEOUT_FICHA_MS,
    });
    expect(llmRotulo.pedidos[0]?.texto).toContain("Ano atual: 2026");
    expect(buscaPrecos.chamadas[0]).toEqual({
      nome: FICHA.nome,
      safra: 2020,
      timeoutMs: TIMEOUT_FICHA_MS,
    });
  });

  it("sem preço, devolve a ficha com precoConsultado false", async () => {
    const { sommelier } = montar([fichaOk], { ok: false, usos: [] });
    const r = await sommelier.lerRotulo(IMAGEM);
    expect(r).toMatchObject({
      ok: true,
      precoConsultado: false,
      ficha: { precoMinCentavos: null },
    });
  });

  it.each(["nao_e_vinho", "ilegivel"] as const)(
    "%s não busca preço",
    async (status) => {
      const { sommelier, buscaPrecos } = montar([
        JSON.stringify({ status, ficha: null }),
      ]);
      expect(await sommelier.lerRotulo(IMAGEM)).toMatchObject({
        ok: false,
        motivo: status,
      });
      expect(buscaPrecos.chamadas).toHaveLength(0);
    },
  );

  it("IA indisponível devolve os usos das tentativas", async () => {
    const { sommelier, buscaPrecos } = montar(["lixo", "lixo"]);
    const r = await sommelier.lerRotulo(IMAGEM);
    expect(r).toMatchObject({ ok: false, motivo: "indisponivel" });
    expect(r.usos).toHaveLength(2);
    expect(buscaPrecos.chamadas).toHaveLength(0);
  });

  it("a busca de preço só recebe o tempo que sobrou dos 45 s", async () => {
    const { sommelier, buscaPrecos } = montar(
      [fichaOk],
      PRECO_OK,
      relogioQueAvanca([40_000]),
    );
    await sommelier.lerRotulo(IMAGEM);
    expect(buscaPrecos.chamadas[0]?.timeoutMs).toBe(5_000);
  });

  it("se a ficha consumiu os 45 s, não busca preço", async () => {
    const { sommelier, buscaPrecos } = montar(
      [fichaOk],
      PRECO_OK,
      relogioQueAvanca([45_000]),
    );
    expect(await sommelier.lerRotulo(IMAGEM)).toMatchObject({
      ok: true,
      precoConsultado: false,
    });
    expect(buscaPrecos.chamadas).toHaveLength(0);
  });
});

describe("SommelierPadrao.fichaPorNome", () => {
  it("manda o nome como dado, com o modelo de rótulo", async () => {
    const { sommelier, llmRotulo } = montar([fichaOk]);
    expect(await sommelier.fichaPorNome("Labadie 2020")).toMatchObject({
      ok: true,
    });
    expect(llmRotulo.pedidos[0]).toMatchObject({ tipo: "nome" });
    expect(llmRotulo.pedidos[0]?.texto).toContain(
      "<nome_do_vinho>Labadie 2020</nome_do_vinho>",
    );
    expect(llmRotulo.pedidos[0]?.imagem).toBeUndefined();
  });
});

describe("SommelierPadrao.sugerirParaPrato", () => {
  const item = (id: string): ItemResumo => ({
    id,
    nome: `Vinho ${id}`,
    safra: 2020,
    tipo: "tinto",
    uvas: [],
    status: "no_ponto",
    decantarMin: null,
    decantarMax: null,
    harmonizacoes: ["Churrasco"],
  });
  const adega = [item("a"), item("b")];
  const sugestao = (itemId: string) => ({
    itemId,
    motivo: "Combina.",
    decantarMin: null,
  });

  it("filtra ids inventados e repetidos", async () => {
    const resposta = JSON.stringify({
      sugestoes: [sugestao("x"), sugestao("a"), sugestao("a"), sugestao("b")],
      semBoaOpcao: null,
    });
    const { sommelier, llmPrato } = montar([resposta]);
    const r = await sommelier.sugerirParaPrato({ prato: "churrasco", adega });
    expect(r).toMatchObject({
      ok: true,
      sugestoes: [sugestao("a"), sugestao("b")],
      semBoaOpcao: null,
    });
    expect(llmPrato.pedidos[0]).toMatchObject({
      tipo: "prato",
      timeoutMs: TIMEOUT_PRATO_MS,
    });
    expect(llmPrato.pedidos[0]?.texto).toContain("<prato>churrasco</prato>");
  });

  it("se nada sobrar, usa o estilo ideal da IA", async () => {
    const resposta = JSON.stringify({
      sugestoes: [sugestao("x")],
      semBoaOpcao: { estiloIdeal: "Branco leve" },
    });
    const { sommelier } = montar([resposta]);
    expect(
      await sommelier.sugerirParaPrato({ prato: "peixe", adega }),
    ).toMatchObject({
      sugestoes: [],
      semBoaOpcao: { estiloIdeal: "Branco leve" },
    });
  });

  it("se nada sobrar e a IA não deu estilo, semBoaOpcao vem preenchido mesmo assim", async () => {
    const resposta = JSON.stringify({
      sugestoes: [sugestao("x")],
      semBoaOpcao: null,
    });
    const { sommelier } = montar([resposta]);
    expect(
      await sommelier.sugerirParaPrato({ prato: "peixe", adega }),
    ).toMatchObject({
      semBoaOpcao: { estiloIdeal: ESTILO_SEM_SUGESTAO },
    });
  });

  it("adega vazia não chama a IA", async () => {
    const { sommelier, llmPrato } = montar([]);
    expect(
      await sommelier.sugerirParaPrato({ prato: "peixe", adega: [] }),
    ).toEqual({
      ok: true,
      sugestoes: [],
      semBoaOpcao: null,
      usos: [],
    });
    expect(llmPrato.pedidos).toHaveLength(0);
  });

  it("IA indisponível vira ok:false", async () => {
    const { sommelier } = montar(["lixo", "lixo"]);
    expect(
      await sommelier.sugerirParaPrato({ prato: "peixe", adega }),
    ).toMatchObject({ ok: false, motivo: "indisponivel" });
  });
});
