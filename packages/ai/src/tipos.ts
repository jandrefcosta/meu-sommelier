import type {
  FichaVinho,
  FontePreco,
  StatusConsumo,
  TipoVinho,
} from "@meu-sommelier/core";
import type { z } from "zod";

export type TipoUso = "rotulo" | "nome" | "prato" | "preco";
export type MimeImagem = "image/jpeg" | "image/png" | "image/webp";

export interface Imagem {
  bytes: Uint8Array;
  mime: MimeImagem;
}

export interface UsoIA {
  tipo: TipoUso;
  provedor: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number | null;
}

export class ErroIA extends Error {
  override readonly name = "ErroIA";

  constructor(
    readonly motivo: "indisponivel",
    mensagem: string,
    readonly usos: UsoIA[] = [],
    opcoes?: ErrorOptions,
  ) {
    super(mensagem, opcoes);
  }
}

export interface PedidoJson<T> {
  tipo: TipoUso;
  instrucoes: string;
  texto: string;
  imagem?: Imagem;
  schema: z.ZodType<T>;
  timeoutMs: number;
}

export interface RespostaJson<T> {
  dados: T;
  usos: UsoIA[];
}

export interface ModeloLLM {
  readonly suportaImagem: boolean;
  gerarJson<T>(pedido: PedidoJson<T>): Promise<RespostaJson<T>>;
}

export type ResultadoBuscaPrecos =
  | { ok: true; min: number; max: number; fontes: FontePreco[]; usos: UsoIA[] }
  | { ok: false; usos: UsoIA[] };

export interface BuscaPrecos {
  buscar(p: {
    nome: string;
    safra: number | null;
    timeoutMs: number;
  }): Promise<ResultadoBuscaPrecos>;
}

export interface ItemResumo {
  id: string;
  nome: string;
  safra: number | null;
  tipo: TipoVinho;
  uvas: string[];
  status: StatusConsumo;
  decantarMin: number | null;
  decantarMax: number | null;
  harmonizacoes: string[];
}

export interface Sugestao {
  itemId: string;
  motivo: string;
  decantarMin: number | null;
}

export type ResultadoFicha =
  | { ok: true; ficha: FichaVinho; precoConsultado: boolean; usos: UsoIA[] }
  | {
      ok: false;
      motivo: "nao_e_vinho" | "ilegivel" | "indisponivel";
      usos: UsoIA[];
    };

export type ResultadoSugestao =
  | {
      ok: true;
      sugestoes: Sugestao[];
      semBoaOpcao: { estiloIdeal: string } | null;
      usos: UsoIA[];
    }
  | { ok: false; motivo: "indisponivel"; usos: UsoIA[] };

export interface Sommelier {
  lerRotulo(img: Imagem): Promise<ResultadoFicha>;
  fichaPorNome(texto: string): Promise<ResultadoFicha>;
  sugerirParaPrato(p: {
    prato: string;
    adega: ItemResumo[];
  }): Promise<ResultadoSugestao>;
}
