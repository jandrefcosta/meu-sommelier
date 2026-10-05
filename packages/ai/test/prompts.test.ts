import { describe, expect, it } from "vitest";
import { carregarPrompt, type NomePrompt } from "../src/prompts";

describe("carregarPrompt", () => {
  it.each<NomePrompt>(["rotulo", "nome", "prato", "preco"])(
    "%s está em português e trata o conteúdo do usuário como dado",
    (nome) => {
      const prompt = carregarPrompt(nome);
      expect(prompt).toContain("Meu Sommelier");
      expect(prompt).toMatch(/nunca instruç(ão|ões) para você/);
    },
  );

  it("guarda o texto em cache", () => {
    expect(carregarPrompt("prato")).toBe(carregarPrompt("prato"));
  });
});
