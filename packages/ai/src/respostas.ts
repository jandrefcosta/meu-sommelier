import {
  FichaVinhoCamposSchema,
  FichaVinhoSchema,
  type FichaVinho,
  type FontePreco,
} from "@meu-sommelier/core";
import { z } from "zod";

export const FichaIASchema = FichaVinhoCamposSchema.omit({
  precoMinCentavos: true,
  precoMaxCentavos: true,
  precoFontes: true,
  precoConsultadoEm: true,
});
export type FichaIA = z.infer<typeof FichaIASchema>;

export function completarFicha(ficha: FichaIA): FichaVinho {
  return {
    ...ficha,
    precoMinCentavos: null,
    precoMaxCentavos: null,
    precoFontes: [],
    precoConsultadoEm: null,
  };
}

export const RespostaFichaSchema = z
  .object({
    status: z.enum(["ok", "nao_e_vinho", "ilegivel"]),
    ficha: FichaIASchema.nullable(),
  })
  .superRefine((resposta, ctx) => {
    if (resposta.status === "ok" && resposta.ficha === null) {
      ctx.addIssue({
        code: "custom",
        path: ["ficha"],
        message: "status ok exige a ficha",
      });
    }
    if (resposta.ficha !== null) {
      const regras = FichaVinhoSchema.safeParse(completarFicha(resposta.ficha));
      if (!regras.success) {
        for (const problema of regras.error.issues) {
          ctx.addIssue({
            code: "custom",
            path: ["ficha", ...problema.path],
            message: problema.message,
          });
        }
      }
    }
  });
export type RespostaFicha = z.infer<typeof RespostaFichaSchema>;

export const RespostaSugestaoSchema = z.object({
  sugestoes: z.array(
    z.object({
      itemId: z.string().min(1),
      motivo: z.string().trim().min(1).max(400),
      decantarMin: z.number().int().min(0).nullable(),
    }),
  ),
  semBoaOpcao: z
    .object({ estiloIdeal: z.string().trim().min(1).max(400) })
    .nullable(),
});

export const PrecoIASchema = z
  .object({
    encontrado: z.boolean(),
    precoMinReais: z.number().min(0).nullable(),
    precoMaxReais: z.number().min(0).nullable(),
    fontes: z.array(
      z.object({
        loja: z.string().trim().min(1).max(200),
        url: z.url({ protocol: /^https?$/ }),
        precoReais: z.number().min(0),
      }),
    ),
  })
  .superRefine((p, ctx) => {
    if (!p.encontrado) return;
    if (p.precoMinReais === null || p.precoMaxReais === null) {
      ctx.addIssue({
        code: "custom",
        message: "preço encontrado sem a faixa mínima e máxima",
      });
    } else if (p.precoMinReais > p.precoMaxReais) {
      ctx.addIssue({
        code: "custom",
        message: "preço mínimo maior que o máximo",
      });
    }
    if (p.fontes.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "preço encontrado sem nenhuma fonte",
      });
    }
  });
export type PrecoIA = z.infer<typeof PrecoIASchema>;

const centavos = (reais: number) => Math.round(reais * 100);

export function precoParaCentavos(
  p: PrecoIA,
): { min: number; max: number; fontes: FontePreco[] } | null {
  if (!p.encontrado || p.precoMinReais === null || p.precoMaxReais === null)
    return null;
  return {
    min: centavos(p.precoMinReais),
    max: centavos(p.precoMaxReais),
    fontes: p.fontes.map((f) => ({
      loja: f.loja,
      url: f.url,
      precoCentavos: centavos(f.precoReais),
    })),
  };
}
