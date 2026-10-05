import { describe, expect, it } from "vitest";
import { HoraSchema, horaDeAbrir } from "../src/hora";

describe("horaDeAbrir", () => {
  it.each([
    ["20:00", 45, "19:15"],
    ["20:00", 0, "20:00"],
    ["20:00", 120, "18:00"],
    ["00:30", 45, "23:45"],
    ["08:05", 5, "08:00"],
  ])(
    "jantar às %s com %i min de decantação → abrir às %s",
    (hora, minutos, esperado) => {
      expect(horaDeAbrir(hora, minutos)).toBe(esperado);
    },
  );

  it("sem decantação devolve null", () => {
    expect(horaDeAbrir("20:00", null)).toBeNull();
  });

  it.each(["24:00", "7:30", "20:60", "abc", ""])(
    "rejeita a hora %j",
    (hora) => {
      expect(() => horaDeAbrir(hora, 30)).toThrow(RangeError);
    },
  );
});

describe("HoraSchema", () => {
  it("aceita HH:MM e rejeita o resto", () => {
    expect(HoraSchema.safeParse("19:30").success).toBe(true);
    expect(HoraSchema.safeParse("19h30").success).toBe(false);
  });
});
