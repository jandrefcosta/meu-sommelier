// Preços de tabela da Anthropic em 2026-10, em US$ por milhão de tokens.
const PRECO_POR_MTOK: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-5-5": { entrada: 4, saida: 20 },
  "claude-opus-5": { entrada: 5, saida: 25 },
  "claude-opus-4-8": { entrada: 5, saida: 25 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
};

export const USD_POR_BUSCA_WEB = 0.01;

export function custoAnthropicUsd(
  modelo: string,
  tokensEntrada: number,
  tokensSaida: number,
  buscasWeb = 0,
): number | null {
  const preco = PRECO_POR_MTOK[modelo];
  if (!preco) return null;
  return (
    (tokensEntrada * preco.entrada + tokensSaida * preco.saida) / 1_000_000 +
    buscasWeb * USD_POR_BUSCA_WEB
  );
}
