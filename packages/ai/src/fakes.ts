import { gerarComRetentativa, type Correcao } from "./retentativa";
import {
  ErroIA,
  type BuscaPrecos,
  type ModeloLLM,
  type ResultadoBuscaPrecos,
  type PedidoJson,
  type RespostaJson,
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
