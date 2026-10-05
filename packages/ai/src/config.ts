import type { Relogio } from "@meu-sommelier/core";
import { z } from "zod";
import { AnthropicLLM } from "./anthropic";
import {
  BuscaPrecosAnthropic,
  BuscaPrecosApiBusca,
  SemBuscaPrecos,
} from "./busca-precos";
import { FakeSommelier } from "./fakes";
import { OpenAICompativelLLM } from "./openai-compat";
import { SommelierPadrao } from "./sommelier";
import type { BuscaPrecos, ModeloLLM, Sommelier } from "./tipos";

export type Provedor = "anthropic" | "openai-compat" | "fake";
export interface AlvoIA {
  provedor: Provedor;
  modelo: string;
}

const MODELO_PADRAO = "claude-opus-5-5";
const ALVO = /^(anthropic|openai-compat|fake):(.+)$/;

const alvo = (padrao: string) =>
  z
    .string()
    .default(padrao)
    .transform((valor, ctx): AlvoIA => {
      const partes = ALVO.exec(valor);
      if (!partes) {
        ctx.addIssue({
          code: "custom",
          message: `"${valor}" não está no formato provedor:modelo (provedores: anthropic, openai-compat, fake)`,
        });
        return z.NEVER;
      }
      return { provedor: partes[1] as Provedor, modelo: partes[2]! };
    });

const booleano = z
  .enum(["true", "false"])
  .default("true")
  .transform((valor) => valor === "true");

export const EnvIASchema = z
  .object({
    IA_ROTULO: alvo(`anthropic:${MODELO_PADRAO}`),
    IA_PRATO: alvo(`anthropic:${MODELO_PADRAO}`),
    IA_PRECO_BUSCA: z
      .enum(["anthropic", "api-busca", "nenhuma", "fake"])
      .default("anthropic"),
    IA_PRECO_MODELO: z.string().default(MODELO_PADRAO),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_COMPAT_BASE_URL: z.url().optional(),
    OPENAI_COMPAT_API_KEY: z.string().optional(),
    OPENAI_COMPAT_JSON_SCHEMA: booleano,
    OPENAI_COMPAT_SUPORTA_IMAGEM: booleano,
    TAVILY_API_KEY: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    const exigir = (campo: string, mensagem: string) =>
      ctx.addIssue({ code: "custom", path: [campo], message: mensagem });
    const provedores = [e.IA_ROTULO.provedor, e.IA_PRATO.provedor];

    if (provedores.includes("fake") || e.IA_PRECO_BUSCA === "fake") {
      const tudoFake =
        provedores.every((p) => p === "fake") &&
        (e.IA_PRECO_BUSCA === "fake" || e.IA_PRECO_BUSCA === "nenhuma");
      if (!tudoFake) {
        exigir(
          "IA_ROTULO",
          "o modo fake vale para tudo: use IA_ROTULO e IA_PRATO fake e IA_PRECO_BUSCA fake ou nenhuma",
        );
      }
      return;
    }
    if (
      (provedores.includes("anthropic") || e.IA_PRECO_BUSCA === "anthropic") &&
      !e.ANTHROPIC_API_KEY
    ) {
      exigir(
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_API_KEY é obrigatória quando algum provedor é anthropic",
      );
    }
    if (provedores.includes("openai-compat")) {
      if (!e.OPENAI_COMPAT_BASE_URL) {
        exigir(
          "OPENAI_COMPAT_BASE_URL",
          "OPENAI_COMPAT_BASE_URL é obrigatória para openai-compat",
        );
      }
      if (!e.OPENAI_COMPAT_API_KEY) {
        exigir(
          "OPENAI_COMPAT_API_KEY",
          "OPENAI_COMPAT_API_KEY é obrigatória para openai-compat",
        );
      }
    }
    if (
      e.IA_ROTULO.provedor === "openai-compat" &&
      !e.OPENAI_COMPAT_SUPORTA_IMAGEM
    ) {
      exigir(
        "IA_ROTULO",
        "o modelo de IA_ROTULO precisa aceitar imagem (OPENAI_COMPAT_SUPORTA_IMAGEM=false)",
      );
    }
    if (e.IA_PRECO_BUSCA === "api-busca" && !e.TAVILY_API_KEY) {
      exigir(
        "TAVILY_API_KEY",
        "TAVILY_API_KEY é obrigatória com IA_PRECO_BUSCA=api-busca",
      );
    }
  });

export type ConfigIA = z.output<typeof EnvIASchema>;

export function carregarConfigIA(
  env: Record<string, string | undefined>,
): ConfigIA {
  const semVazios = Object.fromEntries(
    Object.entries(env).flatMap(([chave, valor]) => {
      const limpo = valor?.trim();
      return limpo ? [[chave, limpo]] : [];
    }),
  );
  const resultado = EnvIASchema.safeParse(semVazios);
  if (!resultado.success) {
    throw new Error(
      `Configuração de IA inválida:\n${z.prettifyError(resultado.error)}`,
    );
  }
  return resultado.data;
}

function criarLLM(alvoIA: AlvoIA, config: ConfigIA): ModeloLLM {
  switch (alvoIA.provedor) {
    case "anthropic":
      return new AnthropicLLM({
        apiKey: config.ANTHROPIC_API_KEY!,
        modelo: alvoIA.modelo,
      });
    case "openai-compat":
      return new OpenAICompativelLLM({
        apiKey: config.OPENAI_COMPAT_API_KEY!,
        baseURL: config.OPENAI_COMPAT_BASE_URL!,
        modelo: alvoIA.modelo,
        usarJsonSchema: config.OPENAI_COMPAT_JSON_SCHEMA,
        suportaImagem: config.OPENAI_COMPAT_SUPORTA_IMAGEM,
      });
    case "fake":
      throw new Error("o provedor fake só existe no modo fake completo");
  }
}

function criarBuscaPrecos(config: ConfigIA, llmPrato: ModeloLLM): BuscaPrecos {
  switch (config.IA_PRECO_BUSCA) {
    case "anthropic":
      return new BuscaPrecosAnthropic({
        apiKey: config.ANTHROPIC_API_KEY!,
        modelo: config.IA_PRECO_MODELO,
      });
    case "api-busca":
      return new BuscaPrecosApiBusca({
        tavilyApiKey: config.TAVILY_API_KEY!,
        llm: llmPrato,
      });
    case "nenhuma":
    case "fake":
      return new SemBuscaPrecos();
  }
}

export function criarSommelier(
  config: ConfigIA,
  opcoes: { relogio?: Relogio } = {},
): Sommelier {
  if (config.IA_ROTULO.provedor === "fake") return new FakeSommelier();
  const llmRotulo = criarLLM(config.IA_ROTULO, config);
  const llmPrato = criarLLM(config.IA_PRATO, config);
  return new SommelierPadrao({
    llmRotulo,
    llmPrato,
    buscaPrecos: criarBuscaPrecos(config, llmPrato),
    relogio: opcoes.relogio,
  });
}
