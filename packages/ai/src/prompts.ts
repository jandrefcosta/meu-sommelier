import { readFileSync } from "node:fs";

// URLs estáticas para que o bundler do Next (Plano 4) encontre os arquivos.
const ARQUIVOS = {
  rotulo: new URL("../prompts/rotulo.md", import.meta.url),
  nome: new URL("../prompts/nome.md", import.meta.url),
  prato: new URL("../prompts/prato.md", import.meta.url),
  preco: new URL("../prompts/preco.md", import.meta.url),
};

export type NomePrompt = keyof typeof ARQUIVOS;

const cache = new Map<NomePrompt, string>();

export function carregarPrompt(nome: NomePrompt): string {
  let texto = cache.get(nome);
  if (texto === undefined) {
    texto = readFileSync(ARQUIVOS[nome], "utf8").trim();
    cache.set(nome, texto);
  }
  return texto;
}
