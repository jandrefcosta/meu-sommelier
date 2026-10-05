import { describe, expect, it } from "vitest";
import * as core from "../src/index";

describe("@meu-sommelier/core", () => {
  it("exporta toda a API usada pelos outros pacotes", () => {
    expect(Object.keys(core).sort()).toEqual(
      [
        "CODIGOS_ERRO",
        "HTTP_POR_CODIGO",
        "FUSO_PADRAO",
        "relogioSistema",
        "relogioFixo",
        "anoEm",
        "TIPOS_VINHO",
        "TipoVinhoSchema",
        "FontePrecoSchema",
        "FichaVinhoCamposSchema",
        "validarRegrasFicha",
        "FichaVinhoSchema",
        "STATUS_CONSUMO",
        "statusConsumo",
        "ordenarAdega",
        "chaveDuplicata",
        "HoraSchema",
        "horaDeAbrir",
        "MAX_SUGESTOES",
        "filtrarSugestoes",
        "formatarLinhaKeep",
        "parseListaKeep",
      ].sort(),
    );
  });
});
