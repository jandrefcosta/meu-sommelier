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

export const LINHAS_KEEP_PO = [
  "Château Labadie Médoc Cru Bourgeois (2020) | 💵 R$ 220–280 | 🎯 2026 (⏳ 2030) | 🍷 Decantar: 30–45 min | 🥩 Estrogonofe de carne, corte de novilho grelhado",
  "Perez Cruz Gran Reserva Cabernet Sauvignon (2024) | 💵 R$ 130–180 | 🎯 2027–2028 (⏳ 2033) | 🍷 Decantar: 45 min | 🥩 Churrasco, bife de tira, carnes vermelhas grelhadas",
  "Salentein Reserva Pinot Noir (2023) | 💵 R$ 160–220 | 🎯 2026 (⏳ 2029) | 🍷 Decantar: Não necessário | 🥩 Capellini com cogumelos e ricota, frango assado com ervas",
];

export const FICHAS_KEEP_PO: FichaVinho[] = [
  fichaValida(),
  fichaValida({
    nome: "Perez Cruz Gran Reserva Cabernet Sauvignon",
    safra: 2024,
    precoMinCentavos: 13000,
    precoMaxCentavos: 18000,
    abrirDe: 2027,
    abrirAte: 2028,
    guardaAte: 2033,
    decantarMin: 45,
    decantarMax: 45,
    harmonizacoes: ["Churrasco", "bife de tira", "carnes vermelhas grelhadas"],
  }),
  fichaValida({
    nome: "Salentein Reserva Pinot Noir",
    safra: 2023,
    precoMinCentavos: 16000,
    precoMaxCentavos: 22000,
    abrirDe: 2026,
    guardaAte: 2029,
    decantarMin: null,
    decantarMax: null,
    harmonizacoes: [
      "Capellini com cogumelos e ricota",
      "frango assado com ervas",
    ],
  }),
];
