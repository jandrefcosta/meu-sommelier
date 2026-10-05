import {
  FichaVinhoSchema,
  MAX_SUGESTOES,
  type StatusConsumo,
} from "@meu-sommelier/core";
import fichaRotulo from "../fixtures/ficha-rotulo.json" with { type: "json" };
import { gerarComRetentativa, type Correcao } from "./retentativa";
import { ESTILO_SEM_SUGESTAO } from "./sommelier";
import {
  ErroIA,
  type BuscaPrecos,
  type Imagem,
  type ItemResumo,
  type ModeloLLM,
  type ResultadoBuscaPrecos,
  type ResultadoFicha,
  type ResultadoSugestao,
  type PedidoJson,
  type RespostaJson,
  type Sommelier,
  type TipoUso,
  type UsoIA,
} from "./tipos";

export function usoFake(tipo: TipoUso): UsoIA {
  return {
    tipo,
    provedor: "fake",
    modelo: "fake",
    tokensEntrada: 0,
    tokensSaida: 0,
    custoUsd: 0,
  };
}

export class FakeLLM implements ModeloLLM {
  readonly pedidos: PedidoJson<unknown>[] = [];
  readonly correcoes: (Correcao | null)[] = [];

  constructor(
    private readonly respostas: Array<string | Error>,
    readonly suportaImagem = true,
  ) {}

  async gerarJson<T>(pedido: PedidoJson<T>): Promise<RespostaJson<T>> {
    this.pedidos.push(pedido as unknown as PedidoJson<unknown>);
    if (pedido.imagem && !this.suportaImagem) {
      throw new ErroIA("indisponivel", "o modelo fake não aceita imagem");
    }
    return gerarComRetentativa(pedido.schema, async (correcao) => {
      this.correcoes.push(correcao);
      const proxima = this.respostas.shift();
      if (proxima === undefined)
        throw new Error("FakeLLM sem respostas na fila");
      if (proxima instanceof Error) throw proxima;
      return { texto: proxima, uso: usoFake(pedido.tipo) };
    });
  }
}

export class FakeBuscaPrecos implements BuscaPrecos {
  readonly chamadas: Array<{
    nome: string;
    safra: number | null;
    timeoutMs: number;
  }> = [];

  constructor(
    private readonly resultado: ResultadoBuscaPrecos = { ok: false, usos: [] },
  ) {}

  async buscar(p: {
    nome: string;
    safra: number | null;
    timeoutMs: number;
  }): Promise<ResultadoBuscaPrecos> {
    this.chamadas.push(p);
    return this.resultado;
  }
}

export const FICHA_FAKE = FichaVinhoSchema.parse(fichaRotulo);

const PREFERENCIA: StatusConsumo[] = [
  "abrir_logo",
  "no_ponto",
  "passou",
  "aguardar",
];

export class FakeSommelier implements Sommelier {
  async lerRotulo(imagem: Imagem): Promise<ResultadoFicha> {
    if (imagem.bytes.length === 0)
      return { ok: false, motivo: "ilegivel", usos: [usoFake("rotulo")] };
    return {
      ok: true,
      ficha: FICHA_FAKE,
      precoConsultado: true,
      usos: [usoFake("rotulo")],
    };
  }

  async fichaPorNome(texto: string): Promise<ResultadoFicha> {
    const nome = texto.trim();
    if (nome === "")
      return { ok: false, motivo: "nao_e_vinho", usos: [usoFake("nome")] };
    return {
      ok: true,
      ficha: { ...FICHA_FAKE, nome },
      precoConsultado: true,
      usos: [usoFake("nome")],
    };
  }

  async sugerirParaPrato({
    prato,
    adega,
  }: {
    prato: string;
    adega: ItemResumo[];
  }): Promise<ResultadoSugestao> {
    const escolhidas = [...adega]
      .sort(
        (a, b) => PREFERENCIA.indexOf(a.status) - PREFERENCIA.indexOf(b.status),
      )
      .slice(0, MAX_SUGESTOES);
    return {
      ok: true,
      sugestoes: escolhidas.map((i) => ({
        itemId: i.id,
        motivo: `Combina com ${prato}.`,
        decantarMin: i.decantarMin,
      })),
      semBoaOpcao:
        escolhidas.length === 0 ? { estiloIdeal: ESTILO_SEM_SUGESTAO } : null,
      usos: adega.length === 0 ? [] : [usoFake("prato")],
    };
  }
}
