import {
  anoEm,
  FichaVinhoSchema,
  filtrarSugestoes,
  relogioSistema,
  type Relogio,
} from "@meu-sommelier/core";
import { carregarPrompt } from "./prompts";
import {
  completarFicha,
  RespostaFichaSchema,
  RespostaSugestaoSchema,
  type RespostaFicha,
} from "./respostas";
import {
  ErroIA,
  type BuscaPrecos,
  type Imagem,
  type ItemResumo,
  type ModeloLLM,
  type RespostaJson,
  type ResultadoFicha,
  type ResultadoSugestao,
  type Sommelier,
} from "./tipos";

export const TIMEOUT_FICHA_MS = 45_000;
export const TIMEOUT_PRATO_MS = 20_000;
export const ESTILO_SEM_SUGESTAO =
  "Nenhuma garrafa da adega combina bem com este prato.";

export interface DependenciasSommelier {
  llmRotulo: ModeloLLM;
  llmPrato: ModeloLLM;
  buscaPrecos: BuscaPrecos;
  relogio?: Relogio;
}

export class SommelierPadrao implements Sommelier {
  private readonly relogio: Relogio;

  constructor(private readonly deps: DependenciasSommelier) {
    this.relogio = deps.relogio ?? relogioSistema;
  }

  lerRotulo(imagem: Imagem): Promise<ResultadoFicha> {
    return this.gerarFicha("rotulo", "Leia o rótulo desta foto.", imagem);
  }

  fichaPorNome(texto: string): Promise<ResultadoFicha> {
    return this.gerarFicha("nome", `<nome_do_vinho>${texto}</nome_do_vinho>`);
  }

  async sugerirParaPrato({
    prato,
    adega,
  }: {
    prato: string;
    adega: ItemResumo[];
  }): Promise<ResultadoSugestao> {
    if (adega.length === 0)
      return { ok: true, sugestoes: [], semBoaOpcao: null, usos: [] };
    try {
      const { dados, usos } = await this.deps.llmPrato.gerarJson({
        tipo: "prato",
        instrucoes: carregarPrompt("prato"),
        texto: `<prato>${prato}</prato>\n<adega>${JSON.stringify(adega)}</adega>`,
        schema: RespostaSugestaoSchema,
        timeoutMs: TIMEOUT_PRATO_MS,
      });
      const sugestoes = filtrarSugestoes(
        dados.sugestoes,
        adega.map((i) => i.id),
      );
      const semBoaOpcao =
        sugestoes.length === 0
          ? (dados.semBoaOpcao ?? { estiloIdeal: ESTILO_SEM_SUGESTAO })
          : dados.semBoaOpcao;
      return { ok: true, sugestoes, semBoaOpcao, usos };
    } catch (erro) {
      if (erro instanceof ErroIA)
        return { ok: false, motivo: "indisponivel", usos: erro.usos };
      throw erro;
    }
  }

  private async gerarFicha(
    tipo: "rotulo" | "nome",
    texto: string,
    imagem?: Imagem,
  ): Promise<ResultadoFicha> {
    const inicio = this.relogio.agora();
    let resposta: RespostaJson<RespostaFicha>;
    try {
      resposta = await this.deps.llmRotulo.gerarJson({
        tipo,
        instrucoes: carregarPrompt(tipo),
        texto: `Ano atual: ${anoEm(inicio)}\n${texto}`,
        imagem,
        schema: RespostaFichaSchema,
        timeoutMs: TIMEOUT_FICHA_MS,
      });
    } catch (erro) {
      if (erro instanceof ErroIA)
        return { ok: false, motivo: "indisponivel", usos: erro.usos };
      throw erro;
    }

    const { dados, usos } = resposta;
    if (dados.status !== "ok") return { ok: false, motivo: dados.status, usos };
    if (dados.ficha === null)
      return { ok: false, motivo: "indisponivel", usos };
    const ficha = completarFicha(dados.ficha);

    const restante =
      inicio.getTime() + TIMEOUT_FICHA_MS - this.relogio.agora().getTime();
    if (restante <= 0) return { ok: true, ficha, precoConsultado: false, usos };

    const preco = await this.deps.buscaPrecos.buscar({
      nome: ficha.nome,
      safra: ficha.safra,
      timeoutMs: restante,
    });
    const todosUsos = [...usos, ...preco.usos];
    if (!preco.ok)
      return { ok: true, ficha, precoConsultado: false, usos: todosUsos };

    const comPreco = FichaVinhoSchema.safeParse({
      ...ficha,
      precoMinCentavos: preco.min,
      precoMaxCentavos: preco.max,
      precoFontes: preco.fontes,
      precoConsultadoEm: this.relogio.agora().toISOString(),
    });
    return comPreco.success
      ? {
          ok: true,
          ficha: comPreco.data,
          precoConsultado: true,
          usos: todosUsos,
        }
      : { ok: true, ficha, precoConsultado: false, usos: todosUsos };
  }
}
