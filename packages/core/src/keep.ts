import { FichaVinhoSchema, type FichaVinho, type TipoVinho } from "./ficha";
import { semAcentos } from "./texto";

const TRACO_SAIDA = "–";

function formatarReais(centavos: number): string {
  const reais = Math.floor(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = centavos % 100;
  return resto === 0 ? reais : `${reais},${String(resto).padStart(2, "0")}`;
}

function faixa(
  min: number,
  max: number,
  formatar: (n: number) => string,
): string {
  return min === max
    ? formatar(min)
    : `${formatar(min)}${TRACO_SAIDA}${formatar(max)}`;
}

export function formatarLinhaKeep(ficha: FichaVinho): string {
  const safra = ficha.safra === null ? "NV" : String(ficha.safra);
  const preco =
    ficha.precoMinCentavos === null || ficha.precoMaxCentavos === null
      ? "Não consultado"
      : `R$ ${faixa(ficha.precoMinCentavos, ficha.precoMaxCentavos, formatarReais)}`;
  const abrir =
    ficha.abrirAte === null
      ? String(ficha.abrirDe)
      : `${ficha.abrirDe}${TRACO_SAIDA}${ficha.abrirAte}`;
  const decantar =
    ficha.decantarMin === null || ficha.decantarMax === null
      ? "Não necessário"
      : `${faixa(ficha.decantarMin, ficha.decantarMax, String)} min`;

  return [
    `${ficha.nome} (${safra})`,
    `💵 ${preco}`,
    `🎯 ${abrir} (⏳ ${ficha.guardaAte})`,
    `🍷 Decantar: ${decantar}`,
    `🥩 ${ficha.harmonizacoes.join(", ")}`,
  ].join(" | ");
}

export interface FalhaImportacao {
  linha: number;
  texto: string;
  motivo: string;
}

export interface ResultadoImportacao {
  importados: FichaVinho[];
  falhas: FalhaImportacao[];
}

type Leitura = { ok: true; ficha: FichaVinho } | { ok: false; motivo: string };
type Faixa = { min: number | null; max: number | null };

const TRACO = "[–—-]";
const SELETOR_VARIACAO = new RegExp("\\uFE0F", "gu");
const MARCADOR_CHECKLIST = /^(?:[☐☑✅✔]|(?:-\s*)?\[[ xX]\])\s*/u;
const CABECALHO = /^(.*\S)\s*\(\s*(\d{4}|NV)\s*\)$/iu;
const VALOR = "(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d{2}))?";
const PRECO = new RegExp(
  `^R\\$\\s*${VALOR}(?:\\s*${TRACO}\\s*(?:R\\$\\s*)?${VALOR})?$`,
  "iu",
);
const JANELA = new RegExp(
  `^(\\d{4})(?:\\s*${TRACO}\\s*(\\d{4}))?\\s*\\(\\s*⏳\\s*(\\d{4})\\s*\\)$`,
  "u",
);
const DECANTAR = new RegExp(
  `^decantar:\\s*(?:(\\d+)(?:\\s*${TRACO}\\s*(\\d+))?\\s*min|nao necessario)$`,
  "iu",
);

const REGRAS_TIPO: [TipoVinho, RegExp][] = [
  ["espumante", /\b(espumante|brut|champagne|cava|prosecco|cremant)\b/],
  ["fortificado", /\b(porto|port|jerez|sherry|madeira|marsala)\b/],
  ["sobremesa", /\b(late harvest|colheita tardia|sauternes|tokaji|moscatel)\b/],
  ["rose", /\brose\b/],
  [
    "branco",
    /\b(branco|blanc|bianco|chardonnay|riesling|alvarinho|albarino|torrontes|viognier|gewurztraminer|pinot grigio|pinot gris)\b/,
  ],
];

function inferirTipo(nome: string): TipoVinho {
  const texto = semAcentos(nome).toLowerCase();
  return REGRAS_TIPO.find(([, regra]) => regra.test(texto))?.[0] ?? "tinto";
}

function semPrefixo(parte: string, emoji: string): string | null {
  return parte.startsWith(emoji) ? parte.slice(emoji.length).trim() : null;
}

function centavos(reais: string, resto: string | undefined): number {
  return Number(reais.replaceAll(".", "")) * 100 + Number(resto ?? "0");
}

function lerPreco(texto: string | null): Faixa | null {
  if (texto === null) return null;
  if (semAcentos(texto).toLowerCase() === "nao consultado")
    return { min: null, max: null };
  const m = PRECO.exec(texto);
  if (!m) return null;
  const min = centavos(m[1]!, m[2]);
  return { min, max: m[3] === undefined ? min : centavos(m[3], m[4]) };
}

function lerDecantar(texto: string | null): Faixa | null {
  if (texto === null) return null;
  const m = DECANTAR.exec(semAcentos(texto));
  if (!m) return null;
  if (m[1] === undefined) return { min: null, max: null };
  const min = Number(m[1]);
  return { min, max: m[2] === undefined ? min : Number(m[2]) };
}

function lerLinha(texto: string): Leitura {
  const limpo = texto
    .replace(SELETOR_VARIACAO, "")
    .trim()
    .replace(MARCADOR_CHECKLIST, "");
  const partes = limpo.split("|").map((p) => p.trim());
  if (partes.length !== 5) {
    return {
      ok: false,
      motivo: `esperava 5 partes separadas por "|", encontrei ${partes.length}`,
    };
  }
  const [cabecalho, parteP, parteJ, parteD, parteH] = partes as [
    string,
    string,
    string,
    string,
    string,
  ];

  const cab = CABECALHO.exec(cabecalho);
  if (!cab) {
    return {
      ok: false,
      motivo: "não encontrei a safra entre parênteses, ex.: (2020) ou (NV)",
    };
  }
  const preco = lerPreco(semPrefixo(parteP, "💵"));
  if (!preco)
    return { ok: false, motivo: "não entendi o 💵 preço, ex.: 💵 R$ 220–280" };
  const janela = JANELA.exec(semPrefixo(parteJ, "🎯") ?? "");
  if (!janela) {
    return {
      ok: false,
      motivo:
        "não entendi o 🎯 ano ideal e a ⏳ guarda, ex.: 🎯 2026 (⏳ 2030)",
    };
  }
  const decantar = lerDecantar(semPrefixo(parteD, "🍷"));
  if (!decantar) {
    return {
      ok: false,
      motivo:
        "não entendi a 🍷 decantação, ex.: 🍷 Decantar: 30–45 min ou Não necessário",
    };
  }
  const harmonizacao = semPrefixo(parteH, "🥩");
  if (harmonizacao === null) {
    return { ok: false, motivo: "não encontrei a 🥩 harmonização" };
  }

  const nome = cab[1]!;
  const safra = cab[2]!;
  const resultado = FichaVinhoSchema.safeParse({
    nome,
    produtor: null,
    safra: safra.toUpperCase() === "NV" ? null : Number(safra),
    tipo: inferirTipo(nome),
    uvas: [],
    pais: null,
    regiao: null,
    precoMinCentavos: preco.min,
    precoMaxCentavos: preco.max,
    precoFontes: [],
    precoConsultadoEm: null,
    abrirDe: Number(janela[1]),
    abrirAte: janela[2] === undefined ? null : Number(janela[2]),
    guardaAte: Number(janela[3]),
    decantarMin: decantar.min,
    decantarMax: decantar.max,
    harmonizacoes: harmonizacao
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h.length > 0),
  });
  if (!resultado.success) {
    return {
      ok: false,
      motivo: resultado.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { ok: true, ficha: resultado.data };
}

export function parseListaKeep(texto: string): ResultadoImportacao {
  const importados: FichaVinho[] = [];
  const falhas: FalhaImportacao[] = [];

  texto.split(/\r?\n/).forEach((linha, indice) => {
    if (linha.trim() === "") return;
    const leitura = lerLinha(linha);
    if (leitura.ok) importados.push(leitura.ficha);
    else
      falhas.push({ linha: indice + 1, texto: linha, motivo: leitura.motivo });
  });

  return { importados, falhas };
}
