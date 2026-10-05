import type { FichaVinho } from "./ficha";

const TRACO_SAIDA = "–";

function formatarReais(centavos: number): string {
  const reais = Math.floor(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = centavos % 100;
  return resto === 0 ? reais : `${reais},${String(resto).padStart(2, "0")}`;
}

function faixa(
  min: number,
  max: number,
  formatar: (n: number) => string,
): string {
  return min === max
    ? formatar(min)
    : `${formatar(min)}${TRACO_SAIDA}${formatar(max)}`;
}

export function formatarLinhaKeep(ficha: FichaVinho): string {
  const safra = ficha.safra === null ? "NV" : String(ficha.safra);
  const preco =
    ficha.precoMinCentavos === null || ficha.precoMaxCentavos === null
      ? "Não consultado"
      : `R$ ${faixa(ficha.precoMinCentavos, ficha.precoMaxCentavos, formatarReais)}`;
  const abrir =
    ficha.abrirAte === null
      ? String(ficha.abrirDe)
      : `${ficha.abrirDe}${TRACO_SAIDA}${ficha.abrirAte}`;
  const decantar =
    ficha.decantarMin === null || ficha.decantarMax === null
      ? "Não necessário"
      : `${faixa(ficha.decantarMin, ficha.decantarMax, String)} min`;

  return [
    `${ficha.nome} (${safra})`,
    `💵 ${preco}`,
    `🎯 ${abrir} (⏳ ${ficha.guardaAte})`,
    `🍷 Decantar: ${decantar}`,
    `🥩 ${ficha.harmonizacoes.join(", ")}`,
  ].join(" | ");
}
