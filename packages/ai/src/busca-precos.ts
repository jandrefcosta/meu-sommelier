import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BETA_FALLBACK, usoAnthropic, type OpcoesAnthropic } from "./anthropic";
import { carregarPrompt } from "./prompts";
import { PrecoIASchema, precoParaCentavos, type PrecoIA } from "./respostas";
import { validarJson } from "./retentativa";
import {
  ErroIA,
  type BuscaPrecos,
  type ModeloLLM,
  type ResultadoBuscaPrecos,
  type UsoIA,
} from "./tipos";

type PedidoPreco = Parameters<BuscaPrecos["buscar"]>[0];

export function descreverVinho(nome: string, safra: number | null): string {
  return `<vinho>${nome}</vinho>\n<safra>${safra ?? "sem safra (NV)"}</safra>`;
}

function resultado(preco: PrecoIA, usos: UsoIA[]): ResultadoBuscaPrecos {
  const emCentavos = precoParaCentavos(preco);
  return emCentavos ? { ok: true, ...emCentavos, usos } : { ok: false, usos };
}

export class SemBuscaPrecos implements BuscaPrecos {
  async buscar(): Promise<ResultadoBuscaPrecos> {
    return { ok: false, usos: [] };
  }
}

export class BuscaPrecosAnthropic implements BuscaPrecos {
  private readonly cliente: Anthropic;

  constructor(private readonly opcoes: Omit<OpcoesAnthropic, "esforco">) {
    this.cliente = new Anthropic({
      apiKey: opcoes.apiKey,
      baseURL: opcoes.baseURL,
      maxRetries: opcoes.maxRetries ?? 2,
    });
  }

  async buscar({
    nome,
    safra,
    timeoutMs,
  }: PedidoPreco): Promise<ResultadoBuscaPrecos> {
    let resposta: Anthropic.Beta.BetaMessage;
    try {
      resposta = await this.cliente.beta.messages.create(
        {
          model: this.opcoes.modelo,
          max_tokens: 16_000,
          betas: [BETA_FALLBACK],
          fallbacks: "default",
          system: carregarPrompt("preco"),
          output_config: { effort: "medium" },
          tools: [
            {
              type: "web_search_20260209",
              name: "web_search",
              max_uses: 3,
              user_location: {
                type: "approximate",
                country: "BR",
                timezone: "America/Sao_Paulo",
              },
            },
          ],
          messages: [{ role: "user", content: descreverVinho(nome, safra) }],
        },
        { signal: AbortSignal.timeout(timeoutMs) },
      );
    } catch {
      return { ok: false, usos: [] };
    }

    const usos = [usoAnthropic("preco", resposta.model, resposta.usage)];
    const buscaFalhou = resposta.content.some(
      (bloco) =>
        bloco.type === "web_search_tool_result" &&
        !Array.isArray(bloco.content),
    );
    if (resposta.stop_reason !== "end_turn" || buscaFalhou)
      return { ok: false, usos };

    const ultimoTexto = resposta.content.findLast(
      (bloco) => bloco.type === "text",
    );
    if (!ultimoTexto || ultimoTexto.type !== "text") return { ok: false, usos };
    const validacao = validarJson(ultimoTexto.text, PrecoIASchema);
    return validacao.ok
      ? resultado(validacao.dados, usos)
      : { ok: false, usos };
  }
}

export const URL_TAVILY = "https://api.tavily.com/search";

const ResultadosBuscaSchema = z.object({
  results: z.array(
    z.object({ title: z.string(), url: z.string(), content: z.string() }),
  ),
});

export interface OpcoesApiBusca {
  tavilyApiKey: string;
  llm: ModeloLLM;
  url?: string;
}

export class BuscaPrecosApiBusca implements BuscaPrecos {
  constructor(private readonly opcoes: OpcoesApiBusca) {}

  async buscar({
    nome,
    safra,
    timeoutMs,
  }: PedidoPreco): Promise<ResultadoBuscaPrecos> {
    const prazo = Date.now() + timeoutMs;
    let resultados: z.infer<typeof ResultadosBuscaSchema>["results"];
    try {
      const resposta = await fetch(this.opcoes.url ?? URL_TAVILY, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opcoes.tavilyApiKey}`,
        },
        body: JSON.stringify({
          query: `${nome} ${safra ?? ""} vinho preço comprar`
            .replace(/\s+/g, " ")
            .trim(),
          max_results: 8,
          search_depth: "basic",
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!resposta.ok) return { ok: false, usos: [] };
      const corpo = ResultadosBuscaSchema.safeParse(await resposta.json());
      if (!corpo.success || corpo.data.results.length === 0)
        return { ok: false, usos: [] };
      resultados = corpo.data.results;
    } catch {
      return { ok: false, usos: [] };
    }

    try {
      const { dados, usos } = await this.opcoes.llm.gerarJson({
        tipo: "preco",
        instrucoes: carregarPrompt("preco"),
        texto: `${descreverVinho(nome, safra)}\n<resultados_busca>${JSON.stringify(resultados)}</resultados_busca>`,
        schema: PrecoIASchema,
        timeoutMs: Math.max(1, prazo - Date.now()),
      });
      return resultado(dados, usos);
    } catch (erro) {
      return { ok: false, usos: erro instanceof ErroIA ? erro.usos : [] };
    }
  }
}
