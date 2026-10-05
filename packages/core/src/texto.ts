export function semAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}
