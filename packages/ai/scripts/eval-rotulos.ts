import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  avaliarLeitura,
  GabaritoSchema,
  mimeDoArquivo,
} from "../src/avaliacao";
import { carregarConfigIA, criarSommelier } from "../src/config";

// Lê as fotos reais de fixtures/rotulos com os modelos configurados. Tem custo: rode só à mão.
// Com --gravar, salva cada resultado em fixtures/gravadas/ para virar fixture de teste.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // sem .env: usa as variáveis do ambiente
}

const pastaRotulos = fileURLToPath(
  new URL("../fixtures/rotulos/", import.meta.url),
);
const pastaGravadas = fileURLToPath(
  new URL("../fixtures/gravadas/", import.meta.url),
);
const caminhoGabarito = `${pastaRotulos}gabarito.json`;
const gravar = process.argv.includes("--gravar");

if (!existsSync(caminhoGabarito)) {
  console.log(`Gabarito não encontrado. Veja ${pastaRotulos}LEIA-ME.md`);
  process.exit(0);
}

const gabarito = GabaritoSchema.parse(
  JSON.parse(readFileSync(caminhoGabarito, "utf8")),
);
const config = carregarConfigIA(process.env);
const sommelier = criarSommelier(config);
console.log(
  `Rótulo: ${config.IA_ROTULO.provedor}:${config.IA_ROTULO.modelo} · preço: ${config.IA_PRECO_BUSCA}\n`,
);

let acertosNome = 0;
let acertosSafra = 0;
let custoTotal = 0;
const latencias: number[] = [];

for (const item of gabarito) {
  const mime = mimeDoArquivo(item.arquivo);
  if (!mime) {
    console.log(
      `${item.arquivo}: formato não suportado (use jpg, png ou webp)`,
    );
    continue;
  }
  const bytes = new Uint8Array(readFileSync(`${pastaRotulos}${item.arquivo}`));
  const inicio = performance.now();
  const resultado = await sommelier.lerRotulo({ bytes, mime });
  const segundos = (performance.now() - inicio) / 1000;
  const avaliacao = avaliarLeitura(item, resultado);

  latencias.push(segundos);
  custoTotal += avaliacao.custoUsd;
  if (avaliacao.acertouNome) acertosNome++;
  if (avaliacao.acertouSafra) acertosSafra++;
  console.log(
    `${item.arquivo}: nome ${avaliacao.acertouNome ? "ok" : "ERRO"} · safra ${avaliacao.acertouSafra ? "ok" : "ERRO"} · ${segundos.toFixed(1)} s · US$ ${avaliacao.custoUsd.toFixed(4)}`,
  );
  if (gravar) {
    mkdirSync(pastaGravadas, { recursive: true });
    writeFileSync(
      `${pastaGravadas}${item.arquivo}.json`,
      `${JSON.stringify(resultado, null, 2)}\n`,
    );
  }
}

const total = latencias.length;
if (total > 0) {
  const media = latencias.reduce((a, b) => a + b, 0) / total;
  console.log(
    `\nNome: ${acertosNome}/${total} · Safra: ${acertosSafra}/${total} · Latência média: ${media.toFixed(1)} s · Custo total: US$ ${custoTotal.toFixed(4)}`,
  );
}
