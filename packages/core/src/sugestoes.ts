export const MAX_SUGESTOES = 3;

export function filtrarSugestoes<T extends { itemId: string }>(
  sugestoesIA: readonly T[],
  idsEnviados: Iterable<string>,
): T[] {
  const permitidos = new Set(idsEnviados);
  const vistos = new Set<string>();
  const resultado: T[] = [];

  for (const sugestao of sugestoesIA) {
    if (!permitidos.has(sugestao.itemId) || vistos.has(sugestao.itemId))
      continue;
    vistos.add(sugestao.itemId);
    resultado.push(sugestao);
    if (resultado.length === MAX_SUGESTOES) break;
  }
  return resultado;
}
