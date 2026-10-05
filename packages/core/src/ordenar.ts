import { STATUS_CONSUMO, statusConsumo, type JanelaConsumo } from "./status";

export interface ItemOrdenavel extends JanelaConsumo {
  nome: string;
  quantidade: number;
  atualizadoEm: Date;
}

const compararNomes = new Intl.Collator("pt-BR", { sensitivity: "base" })
  .compare;

export function ordenarAdega<T extends ItemOrdenavel>(
  itens: readonly T[],
  anoAtual: number,
): T[] {
  const peso = (i: T) => STATUS_CONSUMO.indexOf(statusConsumo(i, anoAtual));

  const naAdega = itens
    .filter((i) => i.quantidade > 0)
    .sort(
      (a, b) =>
        peso(a) - peso(b) ||
        a.abrirDe - b.abrirDe ||
        compararNomes(a.nome, b.nome),
    );
  const bebidos = itens
    .filter((i) => i.quantidade <= 0)
    .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime());

  return [...naAdega, ...bebidos];
}
