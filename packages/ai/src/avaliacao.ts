import { chaveDuplicata } from "@meu-sommelier/core";
import { z } from "zod";
import type { MimeImagem, ResultadoFicha } from "./tipos";

export const GabaritoSchema = z.array(
  z.object({
    arquivo: z.string().min(1),
    nome: z.string().min(1),
    safra: z.number().int().nullable(),
  }),
);
export type ItemGabarito = z.infer<typeof GabaritoSchema>[number];

const normalizar = (nome: string) =>
  chaveDuplicata(nome, null).replace(/\|nv$/, "");

export function avaliarLeitura(
  esperado: ItemGabarito,
  resultado: ResultadoFicha,
): { acertouNome: boolean; acertouSafra: boolean; custoUsd: number } {
  const custoUsd = resultado.usos.reduce(
    (total, uso) => total + (uso.custoUsd ?? 0),
    0,
  );
  if (!resultado.ok)
    return { acertouNome: false, acertouSafra: false, custoUsd };
  const lido = normalizar(resultado.ficha.nome);
  const alvo = normalizar(esperado.nome);
  return {
    acertouNome:
      lido !== "" &&
      alvo !== "" &&
      (lido.includes(alvo) || alvo.includes(lido)),
    acertouSafra: resultado.ficha.safra === esperado.safra,
    custoUsd,
  };
}

const MIMES: Record<string, MimeImagem> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function mimeDoArquivo(arquivo: string): MimeImagem | null {
  const extensao = arquivo.split(".").pop()?.toLowerCase() ?? "";
  return MIMES[extensao] ?? null;
}
