import { z } from "zod";

export const TIPOS_VINHO = [
  "tinto",
  "branco",
  "rose",
  "espumante",
  "sobremesa",
  "fortificado",
] as const;
export const TipoVinhoSchema = z.enum(TIPOS_VINHO);
export type TipoVinho = z.infer<typeof TipoVinhoSchema>;

const ano = z
  .number()
  .int()
  .min(1000, "ano deve ter 4 dígitos")
  .max(9999, "ano deve ter 4 dígitos");
const centavos = z.number().int().min(0, "preço não pode ser negativo");
const minutos = z.number().int().min(0, "minutos não podem ser negativos");
const textoOpcional = z.string().trim().min(1).max(200).nullable();

export const FontePrecoSchema = z.object({
  loja: z.string().trim().min(1).max(200),
  url: z.url({
    protocol: /^https?$/,
    error: "a fonte precisa ser um link http(s)",
  }),
  precoCentavos: centavos,
});
export type FontePreco = z.infer<typeof FontePrecoSchema>;

export const FichaVinhoCamposSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "nome é obrigatório")
    .max(200, "nome tem no máximo 200 caracteres"),
  produtor: textoOpcional,
  safra: ano.nullable(),
  tipo: TipoVinhoSchema,
  uvas: z.array(z.string().trim().min(1).max(100)),
  pais: textoOpcional,
  regiao: textoOpcional,
  precoMinCentavos: centavos.nullable(),
  precoMaxCentavos: centavos.nullable(),
  precoFontes: z.array(FontePrecoSchema),
  precoConsultadoEm: z.iso.datetime({ offset: true }).nullable(),
  abrirDe: ano,
  abrirAte: ano.nullable(),
  guardaAte: ano,
  decantarMin: minutos.nullable(),
  decantarMax: minutos.nullable(),
  harmonizacoes: z
    .array(z.string().trim().min(1).max(200))
    .min(1, "informe ao menos 1 harmonização")
    .max(5, "no máximo 5 harmonizações"),
});
export type FichaVinhoCampos = z.infer<typeof FichaVinhoCamposSchema>;

export function validarRegrasFicha(
  f: FichaVinhoCampos,
  ctx: z.RefinementCtx<FichaVinhoCampos>,
): void {
  if ((f.precoMinCentavos === null) !== (f.precoMaxCentavos === null)) {
    ctx.addIssue({
      code: "custom",
      path: ["precoMaxCentavos"],
      message: "informe o preço mínimo e o máximo juntos",
    });
  } else if (
    f.precoMinCentavos !== null &&
    f.precoMaxCentavos !== null &&
    f.precoMinCentavos > f.precoMaxCentavos
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["precoMinCentavos"],
      message: "preço mínimo maior que o máximo",
    });
  }

  if (f.abrirAte !== null && f.abrirAte < f.abrirDe) {
    ctx.addIssue({
      code: "custom",
      path: ["abrirAte"],
      message: "fim da janela de abertura antes do início",
    });
  }
  if (f.guardaAte < (f.abrirAte ?? f.abrirDe)) {
    ctx.addIssue({
      code: "custom",
      path: ["guardaAte"],
      message: "guarda máxima antes da janela de abertura",
    });
  }

  if ((f.decantarMin === null) !== (f.decantarMax === null)) {
    ctx.addIssue({
      code: "custom",
      path: ["decantarMax"],
      message: "informe a decantação mínima e a máxima juntas",
    });
  } else if (
    f.decantarMin !== null &&
    f.decantarMax !== null &&
    f.decantarMin > f.decantarMax
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["decantarMin"],
      message: "decantação mínima maior que a máxima",
    });
  }
}

export const FichaVinhoSchema =
  FichaVinhoCamposSchema.superRefine(validarRegrasFicha);
export type FichaVinho = z.infer<typeof FichaVinhoSchema>;
