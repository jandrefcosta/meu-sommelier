import type { FichaVinho } from "../src/ficha";

export function fichaValida(
  sobrescrever: Partial<FichaVinho> = {},
): FichaVinho {
  return {
    nome: "Château Labadie Médoc Cru Bourgeois",
    produtor: null,
    safra: 2020,
    tipo: "tinto",
    uvas: [],
    pais: null,
    regiao: null,
    precoMinCentavos: 22000,
    precoMaxCentavos: 28000,
    precoFontes: [],
    precoConsultadoEm: null,
    abrirDe: 2026,
    abrirAte: null,
    guardaAte: 2030,
    decantarMin: 30,
    decantarMax: 45,
    harmonizacoes: ["Estrogonofe de carne", "corte de novilho grelhado"],
    ...sobrescrever,
  };
}
