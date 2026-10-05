import { describe, expect, it } from "vitest";
import { ordenarAdega, type ItemOrdenavel } from "../src/ordenar";

function item(
  nome: string,
  campos: Partial<ItemOrdenavel> = {},
): ItemOrdenavel {
  return {
    nome,
    abrirDe: 2026,
    guardaAte: 2030,
    quantidade: 1,
    atualizadoEm: new Date("2026-01-01T00:00:00Z"),
    ...campos,
  };
}

const ANO = 2026;

describe("ordenarAdega", () => {
  it("ordena por status: passou, abrir logo, no ponto, aguardar", () => {
    const itens = [
      item("Aguardar", { abrirDe: 2028, guardaAte: 2035 }),
      item("No ponto", { abrirDe: 2025, guardaAte: 2030 }),
      item("Passou", { abrirDe: 2020, guardaAte: 2025 }),
      item("Abrir logo", { abrirDe: 2022, guardaAte: 2026 }),
    ];
    expect(ordenarAdega(itens, ANO).map((i) => i.nome)).toEqual([
      "Passou",
      "Abrir logo",
      "No ponto",
      "Aguardar",
    ]);
  });

  it("desempata por abrirDe e depois por nome, ignorando acentos e caixa", () => {
    const itens = [
      item("bodega", { abrirDe: 2025 }),
      item("Zeta", { abrirDe: 2024 }),
      item("Álamos", { abrirDe: 2025 }),
    ];
    expect(ordenarAdega(itens, ANO).map((i) => i.nome)).toEqual([
      "Zeta",
      "Álamos",
      "bodega",
    ]);
  });

  it("põe 'Já bebemos' no fim, do mais recente para o mais antigo", () => {
    const itens = [
      item("Bebido antigo", {
        quantidade: 0,
        atualizadoEm: new Date("2026-01-01T00:00:00Z"),
      }),
      item("Na adega", { abrirDe: 2028, guardaAte: 2035 }),
      item("Bebido recente", {
        quantidade: 0,
        atualizadoEm: new Date("2026-06-01T00:00:00Z"),
      }),
    ];
    expect(ordenarAdega(itens, ANO).map((i) => i.nome)).toEqual([
      "Na adega",
      "Bebido recente",
      "Bebido antigo",
    ]);
  });

  it("não altera o array recebido e preserva campos extras", () => {
    const itens = [item("B", { abrirDe: 2027 }), { ...item("A"), id: "x" }];
    const copia = [...itens];
    const ordenados = ordenarAdega(itens, ANO);
    expect(itens).toEqual(copia);
    expect(ordenados[0]).toMatchObject({ nome: "A", id: "x" });
  });
});
