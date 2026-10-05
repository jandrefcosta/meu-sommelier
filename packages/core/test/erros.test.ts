import { describe, expect, it } from "vitest";
import { CODIGOS_ERRO, HTTP_POR_CODIGO, type CodigoErro } from "../src/erros";

describe("CodigoErro", () => {
  it.each([
    ["NAO_AUTENTICADO", 401],
    ["NAO_ENCONTRADO", 404],
    ["ENTRADA_INVALIDA", 400],
    ["FOTO_INVALIDA", 400],
    ["ROTULO_NAO_RECONHECIDO", 422],
    ["DUPLICADO", 409],
    ["LIMITE_IA_MES", 429],
    ["MUITAS_REQUISICOES", 429],
    ["IA_ORCAMENTO_ESGOTADO", 503],
    ["IA_INDISPONIVEL", 503],
  ])("%s responde HTTP %i", (codigo, status) => {
    expect(HTTP_POR_CODIGO[codigo as CodigoErro]).toBe(status);
  });

  it("todo código tem um status HTTP, e só esses códigos existem", () => {
    expect(Object.keys(HTTP_POR_CODIGO).sort()).toEqual(
      [...CODIGOS_ERRO].sort(),
    );
    expect(CODIGOS_ERRO).toHaveLength(10);
  });
});
