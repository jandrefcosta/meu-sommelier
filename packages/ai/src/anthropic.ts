import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { custoAnthropicUsd, USD_POR_BUSCA_WEB } from "./custos";
import { gerarComRetentativa, mensagemCorrecao } from "./retentativa";
import {
  ErroIA,
  type ModeloLLM,
  type PedidoJson,
  type RespostaJson,
  type TipoUso,
  type UsoIA,
} from "./tipos";

export const BETA_FALLBACK = "server-side-fallback-2026-07-01";

export type Esforco = "low" | "medium" | "high";

export interface OpcoesAnthropic {
  apiKey: string;
  modelo: string;
  esforco?: Esforco;
  maxRetries?: number;
  baseURL?: string;
}

interface Cobranca {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
}

function cobranca(
  modelo: string,
  uso: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number | null;
    cache_read_input_tokens: number | null;
  },
): Cobranca {
  return {
    modelo,
    tokensEntrada:
      uso.input_tokens +
      (uso.cache_creation_input_tokens ?? 0) +
      (uso.cache_read_input_tokens ?? 0),
    tokensSaida: uso.output_tokens,
  };
}

// Com `fallbacks`, o usage de topo cobre só a tentativa que respondeu; as
// `iterations` trazem cada tentativa cobrada (inclusive a recusada).
export function usoAnthropic(
  tipo: TipoUso,
  modelo: string,
  usage: Anthropic.Beta.BetaUsage,
): UsoIA {
  const cobrancas = usage.iterations?.length
    ? usage.iterations.map((it) =>
        cobranca(("model" in it ? it.model : null) ?? modelo, it),
      )
    : [cobranca(modelo, usage)];
  const buscasWeb = usage.server_tool_use?.web_search_requests ?? 0;

  let custoUsd: number | null = buscasWeb * USD_POR_BUSCA_WEB;
  for (const c of cobrancas) {
    const custo = custoAnthropicUsd(c.modelo, c.tokensEntrada, c.tokensSaida);
    custoUsd = custo === null || custoUsd === null ? null : custoUsd + custo;
  }
  return {
    tipo,
    provedor: "anthropic",
    modelo,
    tokensEntrada: cobrancas.reduce((t, c) => t + c.tokensEntrada, 0),
    tokensSaida: cobrancas.reduce((t, c) => t + c.tokensSaida, 0),
    custoUsd,
  };
}

export function textoDaResposta(resposta: Anthropic.Beta.BetaMessage): string {
  return resposta.content
    .flatMap((bloco) => (bloco.type === "text" ? [bloco.text] : []))
    .join("");
}

export class AnthropicLLM implements ModeloLLM {
  readonly suportaImagem = true;
  private readonly cliente: Anthropic;

  constructor(private readonly opcoes: OpcoesAnthropic) {
    this.cliente = new Anthropic({
      apiKey: opcoes.apiKey,
      baseURL: opcoes.baseURL,
      maxRetries: opcoes.maxRetries ?? 2,
    });
  }

  gerarJson<T>(pedido: PedidoJson<T>): Promise<RespostaJson<T>> {
    const formato = betaZodOutputFormat(pedido.schema);
    const sinal = AbortSignal.timeout(pedido.timeoutMs);
    const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (pedido.imagem) {
      conteudo.push({
        type: "image",
        source: {
          type: "base64",
          media_type: pedido.imagem.mime,
          data: Buffer.from(pedido.imagem.bytes).toString("base64"),
        },
      });
    }
    conteudo.push({ type: "text", text: pedido.texto });

    return gerarComRetentativa(pedido.schema, async (correcao) => {
      const mensagens: Anthropic.Beta.BetaMessageParam[] = [
        { role: "user", content: conteudo },
      ];
      if (correcao)
        mensagens.push({ role: "user", content: mensagemCorrecao(correcao) });

      const resposta = await this.cliente.beta.messages.create(
        {
          model: this.opcoes.modelo,
          max_tokens: 16_000,
          betas: [BETA_FALLBACK],
          fallbacks: "default",
          system: pedido.instrucoes,
          output_config: {
            effort: this.opcoes.esforco ?? "medium",
            format: formato,
          },
          messages: mensagens,
        },
        { signal: sinal },
      );
      const uso = usoAnthropic(pedido.tipo, resposta.model, resposta.usage);
      if (resposta.stop_reason === "refusal") {
        throw new ErroIA("indisponivel", "a IA recusou o pedido", [uso]);
      }
      return { texto: textoDaResposta(resposta), uso };
    });
  }
}
