import { describe, expect, it } from "vitest";
import { statusConsumo } from "../src/status";

describe("statusConsumo", () => {
  const ano = { abrirDe: 2026, guardaAte: 2030 };

  it.each([
    [2025, "aguardar"],
    [2026, "no_ponto"],
    [2028, "no_ponto"],
    [2029, "no_ponto"],
    [2030, "abrir_logo"],
    [2031, "passou"],
  ])("em %i fica %s (🎯 2026, ⏳ 2030)", (anoAtual, esperado) => {
    expect(statusConsumo(ano, anoAtual)).toBe(esperado);
  });

  it.each([
    [2026, "aguardar"],
    [2027, "no_ponto"],
    [2028, "no_ponto"],
  ])("faixa 🎯 2027–2028 (⏳ 2033): em %i fica %s", (anoAtual, esperado) => {
    expect(statusConsumo({ abrirDe: 2027, guardaAte: 2033 }, anoAtual)).toBe(
      esperado,
    );
  });

  it("guarda no mesmo ano da abertura: abrir logo vence", () => {
    expect(statusConsumo({ abrirDe: 2026, guardaAte: 2026 }, 2026)).toBe(
      "abrir_logo",
    );
  });
});
