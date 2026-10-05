import { describe, expect, it } from "vitest";
import { anoEm, relogioFixo, relogioSistema } from "../src/relogio";

describe("anoEm", () => {
  it("31/12 às 23h30 em São Paulo ainda é o ano anterior, mesmo já sendo 1º/01 em UTC", () => {
    expect(anoEm(new Date("2027-01-01T02:30:00Z"))).toBe(2026);
  });

  it("vira o ano à meia-noite de São Paulo", () => {
    expect(anoEm(new Date("2027-01-01T03:00:00Z"))).toBe(2027);
  });

  it("aceita outro fuso", () => {
    expect(anoEm(new Date("2027-01-01T02:30:00Z"), "UTC")).toBe(2027);
  });
});

describe("Relogio", () => {
  it("relogioFixo sempre devolve o instante informado", () => {
    const relogio = relogioFixo("2026-10-05T12:00:00-03:00");
    expect(relogio.agora().toISOString()).toBe("2026-10-05T15:00:00.000Z");
    expect(relogio.agora().getTime()).toBe(relogio.agora().getTime());
  });

  it("relogioSistema usa a hora atual", () => {
    const antes = Date.now();
    const agora = relogioSistema.agora().getTime();
    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora).toBeLessThanOrEqual(Date.now());
  });
});
