import { z } from "zod";
import { ErroIA, type RespostaJson, type UsoIA } from "./tipos";

export interface Tentativa {
  texto: string;
  uso: UsoIA;
}

export interface Correcao {
  respostaAnterior: string;
  erro: string;
}

// Fim do objeto balanceado que começa em `inicio` (um "{"), ignorando chaves
// dentro de strings JSON; -1 se o objeto não fecha.
function fimDoObjeto(texto: string, inicio: number): number {
  let profundidade = 0;
  let emString = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (emString) {
      if (c === "\\") i++;
      else if (c === '"') emString = false;
    } else if (c === '"') emString = true;
    else if (c === "{") profundidade++;
    else if (c === "}" && --profundidade === 0) return i;
  }
  return -1;
}

export function extrairJson(texto: string): string {
  for (
    let inicio = texto.indexOf("{");
    inicio >= 0;
    inicio = texto.indexOf("{", inicio + 1)
  ) {
    const fim = fimDoObjeto(texto, inicio);
    if (fim < 0) continue;
    const candidato = texto.slice(inicio, fim + 1);
    try {
      JSON.parse(candidato);
      return candidato;
    } catch {
      // tenta o próximo "{"
    }
  }
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  return inicio >= 0 && fim > inicio
    ? texto.slice(inicio, fim + 1)
    : texto.trim();
}

export function validarJson<T>(
  texto: string,
  schema: z.ZodType<T>,
): { ok: true; dados: T } | { ok: false; erro: string } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(extrairJson(texto));
  } catch {
    return { ok: false, erro: "a resposta não é um JSON válido" };
  }
  const resultado = schema.safeParse(bruto);
  return resultado.success
    ? { ok: true, dados: resultado.data }
    : { ok: false, erro: z.prettifyError(resultado.error) };
}

export function mensagemCorrecao(c: Correcao): string {
  return [
    "Sua resposta anterior foi:",
    c.respostaAnterior,
    "",
    "Ela não passou na validação:",
    c.erro,
    "",
    "Responda de novo, somente com o JSON corrigido.",
  ].join("\n");
}

export async function gerarComRetentativa<T>(
  schema: z.ZodType<T>,
  chamar: (correcao: Correcao | null) => Promise<Tentativa>,
): Promise<RespostaJson<T>> {
  const usos: UsoIA[] = [];
  let correcao: Correcao | null = null;

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let resposta: Tentativa;
    try {
      resposta = await chamar(correcao);
    } catch (erro) {
      if (erro instanceof ErroIA) {
        throw new ErroIA(erro.motivo, erro.message, [...usos, ...erro.usos], {
          cause: erro.cause,
        });
      }
      throw new ErroIA(
        "indisponivel",
        "falha ao chamar o provedor de IA",
        usos,
        { cause: erro },
      );
    }
    usos.push(resposta.uso);
    const validacao = validarJson(resposta.texto, schema);
    if (validacao.ok) return { dados: validacao.dados, usos };
    correcao = { respostaAnterior: resposta.texto, erro: validacao.erro };
  }
  throw new ErroIA(
    "indisponivel",
    "a IA respondeu um JSON inválido duas vezes",
    usos,
  );
}
