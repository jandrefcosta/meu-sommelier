import { semAcentos } from "./texto";

export function chaveDuplicata(nome: string, safra: number | null): string {
  const normalizado = semAcentos(nome)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${normalizado}|${safra ?? "nv"}`;
}
