import OpenAI from "openai";
import { z } from "zod";
import { gerarComRetentativa, mensagemCorrecao } from "./retentativa";
import {
  ErroIA,
  type ModeloLLM,
  type PedidoJson,
  type RespostaJson,
  type UsoIA,
} from "./tipos";

export interface OpcoesOpenAICompat {
  apiKey: string;
  baseURL: string;
  modelo: string;
  usarJsonSchema: boolean;
  suportaImagem: boolean;
  maxRetries?: number;
}

export class OpenAICompativelLLM implements ModeloLLM {
  readonly suportaImagem: boolean;
  private readonly cliente: OpenAI;

  constructor(private readonly opcoes: OpcoesOpenAICompat) {
    this.suportaImagem = opcoes.suportaImagem;
    this.cliente = new OpenAI({
      apiKey: opcoes.apiKey,
      baseURL: opcoes.baseURL,
      maxRetries: opcoes.maxRetries ?? 2,
    });
  }

  async gerarJson<T>(pedido: PedidoJson<T>): Promise<RespostaJson<T>> {
    if (pedido.imagem && !this.suportaImagem) {
      throw new ErroIA(
        "indisponivel",
        `o modelo ${this.opcoes.modelo} não aceita imagem`,
      );
    }
    // Alguns provedores recusam a chave `$schema` dentro de response_format.
    const jsonSchema = z.toJSONSchema(pedido.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    const sistema = this.opcoes.usarJsonSchema
      ? pedido.instrucoes
      : `${pedido.instrucoes}\n\nResponda somente com um objeto JSON que siga este JSON Schema:\n${JSON.stringify(jsonSchema)}`;
    const conteudo: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: pedido.texto },
    ];
    if (pedido.imagem) {
      const base64 = Buffer.from(pedido.imagem.bytes).toString("base64");
      conteudo.push({
        type: "image_url",
        image_url: { url: `data:${pedido.imagem.mime};base64,${base64}` },
      });
    }
    const sinal = AbortSignal.timeout(pedido.timeoutMs);

    return gerarComRetentativa(pedido.schema, async (correcao) => {
      const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: sistema },
        { role: "user", content: conteudo },
      ];
      if (correcao)
        mensagens.push({ role: "user", content: mensagemCorrecao(correcao) });

      const parametros: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
        model: this.opcoes.modelo,
        messages: mensagens,
      };
      if (this.opcoes.usarJsonSchema) {
        parametros.response_format = {
          type: "json_schema",
          json_schema: { name: "resposta", schema: jsonSchema, strict: false },
        };
      }
      const resposta = await this.cliente.chat.completions.create(parametros, {
        signal: sinal,
      });
      const uso: UsoIA = {
        tipo: pedido.tipo,
        provedor: "openai-compat",
        modelo: resposta.model || this.opcoes.modelo,
        tokensEntrada: resposta.usage?.prompt_tokens ?? 0,
        tokensSaida: resposta.usage?.completion_tokens ?? 0,
        custoUsd: null,
      };
      return { texto: resposta.choices[0]?.message.content ?? "", uso };
    });
  }
}
