# Plano 1 — Monorepo e `packages/core` · Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** criar o monorepo pnpm com lint, formatação, typecheck, testes e CI, e implementar todo o domínio puro do Meu Sommelier em `@meu-sommelier/core`.

**Architecture:** monorepo pnpm com `apps/*` e `packages/*`. Os pacotes internos expõem o código TypeScript direto (`exports: ./src/index.ts`), sem build. O `core` não faz I/O e só depende de `zod`. Cada regra fica num arquivo próprio com seu teste em `packages/core/test/`.

**Tech Stack:** Node 24, pnpm (workspaces), TypeScript strict, zod 4, Vitest + @vitest/coverage-v8, fast-check, ESLint (flat config + typescript-eslint) + Prettier, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-sommelier-mvp-design.md` (seções 2, 3.4, 6 e 7). Backlog: `docs/produto/backlog-mvp.md`.

### Sequência dos planos

| # | Plano | Entrega |
|---|---|---|
| **1** | **Monorepo + core** (este) | domínio puro testado, CI verde |
| 2 | `packages/ai` | portas, adaptadores Anthropic/OpenAI-compatível, busca de preços, fakes, config |
| 3 | `packages/db` | schema Drizzle, migrations, repositórios com escopo de adega (PGlite) |
| 4 | `apps/web` — API + login | Better Auth, route handlers, limites e custos, guarda de acesso |
| 5 | `apps/web` — telas + E2E + deploy | PWA, Playwright, Railway |

Cada plano seguinte é escrito quando o anterior estiver pronto.

## Global Constraints

- Gerenciador: **pnpm** com workspaces `apps/*` e `packages/*`. Nomes de pacote: `@meu-sommelier/web`, `@meu-sommelier/core`, `@meu-sommelier/ai`, `@meu-sommelier/db`.
- `core` é **domínio puro, sem I/O** e não depende de nenhum pacote do projeto. Única dependência de runtime: `zod`.
- `FichaVinhoSchema` é o **único schema** da ficha.
- Idioma pt-BR (nomes de domínio, mensagens). Moeda BRL guardada em **centavos inteiros**.
- "Ano atual" e "agora" sempre no fuso **`America/Sao_Paulo`**, vindos de um `Relogio` injetável.
- Cobertura do `core` **≥ 90%**.
- Nenhum teste automatizado chama IA real nem a internet. TDD.
- Lint: **ESLint + Prettier** (decidido em 2026-10-05).
- Node **24** (versão local; a spec não fixa versão).
- **Commits e push só com aceite explícito do usuário.** Todo passo "Commit" começa pedindo esse aceite.

## Review Focus

1. **Texto colado do Keep no Windows**: quebras `\r\n`, marcadores de checklist `☐`/`☑` no começo da linha e o seletor de variação `U+FE0F` depois dos emojis. A pessoa espera que a importação funcione igual. → testes na Tarefa 9.
2. **Preço com milhar ou centavos** (`R$ 1.200–1.500`, `R$ 89,90`): deve virar 120000–150000 e 8990 centavos, e não falhar nem errar por um fator de 100. → testes nas Tarefas 8 e 9.
3. **Fonte de preço com link `javascript:`** vinda da IA ou da web: as fontes são clicáveis na tela, então o schema precisa recusar tudo que não for http(s). → teste na Tarefa 3.
4. **IA repete o mesmo `itemId`** nas sugestões: o casal não pode receber a mesma garrafa três vezes. `filtrarSugestoes` remove repetidos. → teste na Tarefa 7.
5. **Virada de ano**: 31/12 às 23h30 em São Paulo ainda é o ano anterior, embora em UTC já seja 1º/01. O status de consumo não pode mudar antes da hora. → teste na Tarefa 2.

---

### Tarefa 1: Monorepo, ferramentas, CI e `CodigoErro`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`, `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`, `.github/workflows/ci.yml`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Create: `packages/core/src/erros.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/erros.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `CODIGOS_ERRO: readonly CodigoErro[]`, `type CodigoErro`, `HTTP_POR_CODIGO: Record<CodigoErro, number>`. Scripts na raiz: `pnpm lint`, `pnpm format`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`.

- [ ] **Passo 1: Pré-requisito pnpm**

Rode `pnpm -v`. Se não existir, **pergunte ao usuário** como instalar, pois isso altera o ambiente global: `corepack enable` (pode exigir terminal de administrador no Windows) ou `npm install -g pnpm`. Não instale sem o aceite.

- [ ] **Passo 2: Arquivos da raiz**

`package.json`:
```json
{
  "name": "meu-sommelier",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:coverage": "pnpm -r test:coverage"
  }
}
```
Depois rode `npm pkg set packageManager="pnpm@$(pnpm -v)"` para fixar a versão do pnpm (o `pnpm/action-setup` da CI lê esse campo).

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`.nvmrc`:
```
24
```

`.gitignore`:
```
node_modules/
coverage/
.next/
dist/
.env
.env.*
!.env.example
*.log
```

`.prettierrc.json`:
```json
{}
```

`.prettierignore` (docs fica de fora para o Prettier não reescrever spec e backlog):
```
pnpm-lock.yaml
coverage/
docs/
```

`eslint.config.mjs`:
```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["**/node_modules/**", "**/coverage/**", "**/dist/**", "**/.next/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
```

- [ ] **Passo 3: Pacote `core`**

`packages/core/package.json`:
```json
{
  "name": "@meu-sommelier/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
```

- [ ] **Passo 4: Instalar dependências**

```bash
pnpm add -Dw typescript eslint @eslint/js typescript-eslint eslint-config-prettier prettier
pnpm --filter @meu-sommelier/core add -D typescript vitest @vitest/coverage-v8
```
Esperado: `pnpm-lock.yaml` criado. Um aviso de "Ignored build scripts: esbuild" é normal e não atrapalha.

- [ ] **Passo 5: Escrever o teste que falha**

`packages/core/test/erros.test.ts`:
```ts
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
    expect(Object.keys(HTTP_POR_CODIGO).sort()).toEqual([...CODIGOS_ERRO].sort());
    expect(CODIGOS_ERRO).toHaveLength(10);
  });
});
```

- [ ] **Passo 6: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core test`
Expected: FAIL, porque o módulo `../src/erros` não existe.

- [ ] **Passo 7: Implementar**

`packages/core/src/erros.ts`:
```ts
export const CODIGOS_ERRO = [
  "NAO_AUTENTICADO",
  "NAO_ENCONTRADO",
  "ENTRADA_INVALIDA",
  "FOTO_INVALIDA",
  "ROTULO_NAO_RECONHECIDO",
  "DUPLICADO",
  "LIMITE_IA_MES",
  "MUITAS_REQUISICOES",
  "IA_ORCAMENTO_ESGOTADO",
  "IA_INDISPONIVEL",
] as const;

export type CodigoErro = (typeof CODIGOS_ERRO)[number];

export const HTTP_POR_CODIGO: Record<CodigoErro, number> = {
  NAO_AUTENTICADO: 401,
  NAO_ENCONTRADO: 404,
  ENTRADA_INVALIDA: 400,
  FOTO_INVALIDA: 400,
  ROTULO_NAO_RECONHECIDO: 422,
  DUPLICADO: 409,
  LIMITE_IA_MES: 429,
  MUITAS_REQUISICOES: 429,
  IA_ORCAMENTO_ESGOTADO: 503,
  IA_INDISPONIVEL: 503,
};
```

`packages/core/src/index.ts`:
```ts
export * from "./erros";
```

- [ ] **Passo 8: Rodar tudo**

Run: `pnpm test && pnpm format && pnpm lint && pnpm typecheck`
Expected: testes PASS (11), lint e typecheck sem erros.

- [ ] **Passo 9: CI**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test:coverage
```
Com só `erros.ts` no `core`, a cobertura já fica em 100%, então o limite de 90% passa desde a primeira tarefa.

- [ ] **Passo 10: Commit (pedir aceite do usuário antes)**

```bash
git add -A
git commit -m "chore: monorepo pnpm com lint, testes, CI e CodigoErro no core"
```

---

### Tarefa 2: `Relogio` e ano no fuso de São Paulo

**Files:**
- Create: `packages/core/src/relogio.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/relogio.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `FUSO_PADRAO = "America/Sao_Paulo"`, `interface Relogio { agora(): Date }`, `relogioSistema: Relogio`, `relogioFixo(iso: string): Relogio`, `anoEm(data: Date, fuso?: string): number`.

- [ ] **Passo 1: Escrever o teste que falha**

`packages/core/test/relogio.test.ts`:
```ts
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
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/relogio.test.ts`
Expected: FAIL, porque `../src/relogio` não existe.

- [ ] **Passo 3: Implementar**

`packages/core/src/relogio.ts`:
```ts
export const FUSO_PADRAO = "America/Sao_Paulo";

export interface Relogio {
  agora(): Date;
}

export const relogioSistema: Relogio = { agora: () => new Date() };

export function relogioFixo(iso: string): Relogio {
  const instante = new Date(iso).getTime();
  return { agora: () => new Date(instante) };
}

export function anoEm(data: Date, fuso: string = FUSO_PADRAO): number {
  const ano = new Intl.DateTimeFormat("en-US", { timeZone: fuso, year: "numeric" }).format(data);
  return Number(ano);
}
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./relogio";
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/relogio.test.ts`
Expected: PASS (5).

- [ ] **Passo 5: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 6: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "feat(core): relogio injetavel e ano no fuso de Sao Paulo"
```

---

### Tarefa 3: `FichaVinhoSchema`

**Files:**
- Create: `packages/core/src/ficha.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/ficha.test.ts`, `packages/core/test/fabricas.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `TIPOS_VINHO`, `TipoVinhoSchema`, `type TipoVinho = "tinto" | "branco" | "rose" | "espumante" | "sobremesa" | "fortificado"`, `FontePrecoSchema`, `type FontePreco = { loja: string; url: string; precoCentavos: number }`, `FichaVinhoSchema`, `type FichaVinho` com os campos `nome, produtor, safra, tipo, uvas, pais, regiao, precoMinCentavos, precoMaxCentavos, precoFontes, precoConsultadoEm, abrirDe, abrirAte, guardaAte, decantarMin, decantarMax, harmonizacoes`. Nos testes: `fichaValida(sobrescrever?: Partial<FichaVinho>): FichaVinho`.

Os nomes ficam em camelCase no TypeScript; o `db` (Plano 3) faz o mapeamento para as colunas snake_case da spec.

- [ ] **Passo 1: Adicionar zod**

```bash
pnpm --filter @meu-sommelier/core add zod@^4
```

- [ ] **Passo 2: Fábrica de testes**

`packages/core/test/fabricas.ts`:
```ts
import type { FichaVinho } from "../src/ficha";

export function fichaValida(sobrescrever: Partial<FichaVinho> = {}): FichaVinho {
  return {
    nome: "Château Labadie Médoc Cru Bourgeois",
    produtor: null,
    safra: 2020,
    tipo: "tinto",
    uvas: [],
    pais: null,
    regiao: null,
    precoMinCentavos: 22000,
    precoMaxCentavos: 28000,
    precoFontes: [],
    precoConsultadoEm: null,
    abrirDe: 2026,
    abrirAte: null,
    guardaAte: 2030,
    decantarMin: 30,
    decantarMax: 45,
    harmonizacoes: ["Estrogonofe de carne", "corte de novilho grelhado"],
    ...sobrescrever,
  };
}
```

- [ ] **Passo 3: Escrever o teste que falha**

`packages/core/test/ficha.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { FichaVinhoSchema, type FichaVinho } from "../src/ficha";
import { fichaValida } from "./fabricas";

function erros(dados: unknown): string[] {
  const resultado = FichaVinhoSchema.safeParse(dados);
  return resultado.success ? [] : resultado.error.issues.map((i) => i.message);
}

describe("FichaVinhoSchema", () => {
  it("aceita a ficha da lista da PO", () => {
    expect(erros(fichaValida())).toEqual([]);
  });

  it("aceita safra NV, preço não consultado e decantação não necessária", () => {
    const ficha = fichaValida({
      safra: null,
      precoMinCentavos: null,
      precoMaxCentavos: null,
      decantarMin: null,
      decantarMax: null,
    });
    expect(erros(ficha)).toEqual([]);
  });

  it("aceita faixa de abertura e guarda igual ao fim da faixa", () => {
    expect(erros(fichaValida({ abrirDe: 2027, abrirAte: 2028, guardaAte: 2028 }))).toEqual([]);
  });

  it("aceita fontes de preço com link https e data da consulta", () => {
    const ficha = fichaValida({
      precoFontes: [{ loja: "Loja X", url: "https://loja.example/vinho", precoCentavos: 25000 }],
      precoConsultadoEm: "2026-10-05T12:00:00-03:00",
    });
    expect(erros(ficha)).toEqual([]);
  });

  it("remove espaços das pontas do nome", () => {
    expect(FichaVinhoSchema.parse(fichaValida({ nome: "  Malbec  " })).nome).toBe("Malbec");
  });

  it.each<[string, Partial<FichaVinho>, string]>([
    ["nome vazio", { nome: "   " }, "nome é obrigatório"],
    ["nome com 201 caracteres", { nome: "a".repeat(201) }, "nome tem no máximo 200 caracteres"],
    ["só o preço mínimo", { precoMaxCentavos: null }, "informe o preço mínimo e o máximo juntos"],
    [
      "preço mínimo maior que o máximo",
      { precoMinCentavos: 30000, precoMaxCentavos: 20000 },
      "preço mínimo maior que o máximo",
    ],
    ["preço negativo", { precoMinCentavos: -1 }, "preço não pode ser negativo"],
    [
      "fim da janela antes do início",
      { abrirDe: 2027, abrirAte: 2026, guardaAte: 2030 },
      "fim da janela de abertura antes do início",
    ],
    [
      "guarda antes do fim da janela",
      { abrirDe: 2027, abrirAte: 2028, guardaAte: 2027 },
      "guarda máxima antes da janela de abertura",
    ],
    [
      "guarda antes do início da janela",
      { abrirDe: 2027, guardaAte: 2026 },
      "guarda máxima antes da janela de abertura",
    ],
    ["só a decantação mínima", { decantarMax: null }, "informe a decantação mínima e a máxima juntas"],
    [
      "decantação mínima maior que a máxima",
      { decantarMin: 60, decantarMax: 30 },
      "decantação mínima maior que a máxima",
    ],
    ["sem harmonização", { harmonizacoes: [] }, "informe ao menos 1 harmonização"],
    ["6 harmonizações", { harmonizacoes: ["a", "b", "c", "d", "e", "f"] }, "no máximo 5 harmonizações"],
    ["safra com 2 dígitos", { safra: 20 }, "ano deve ter 4 dígitos"],
  ])("rejeita %s", (_caso, sobrescrever, mensagem) => {
    expect(erros(fichaValida(sobrescrever))).toContain(mensagem);
  });

  it("rejeita tipo fora da lista", () => {
    expect(FichaVinhoSchema.safeParse({ ...fichaValida(), tipo: "laranja" }).success).toBe(false);
  });

  it("rejeita fonte de preço com link que não é http(s)", () => {
    const ficha = fichaValida({
      precoFontes: [{ loja: "X", url: "javascript:alert(1)", precoCentavos: 100 }],
    });
    expect(erros(ficha)).toContain("a fonte precisa ser um link http(s)");
  });
});
```

- [ ] **Passo 4: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/ficha.test.ts`
Expected: FAIL, porque `../src/ficha` não existe.

- [ ] **Passo 5: Implementar**

`packages/core/src/ficha.ts`:
```ts
import { z } from "zod";

export const TIPOS_VINHO = [
  "tinto",
  "branco",
  "rose",
  "espumante",
  "sobremesa",
  "fortificado",
] as const;
export const TipoVinhoSchema = z.enum(TIPOS_VINHO);
export type TipoVinho = z.infer<typeof TipoVinhoSchema>;

const ano = z
  .number()
  .int()
  .min(1000, "ano deve ter 4 dígitos")
  .max(9999, "ano deve ter 4 dígitos");
const centavos = z.number().int().min(0, "preço não pode ser negativo");
const minutos = z.number().int().min(0, "minutos não podem ser negativos");
const textoOpcional = z.string().trim().min(1).max(200).nullable();

export const FontePrecoSchema = z.object({
  loja: z.string().trim().min(1).max(200),
  url: z.url({ protocol: /^https?$/, error: "a fonte precisa ser um link http(s)" }),
  precoCentavos: centavos,
});
export type FontePreco = z.infer<typeof FontePrecoSchema>;

export const FichaVinhoSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, "nome é obrigatório")
      .max(200, "nome tem no máximo 200 caracteres"),
    produtor: textoOpcional,
    safra: ano.nullable(),
    tipo: TipoVinhoSchema,
    uvas: z.array(z.string().trim().min(1).max(100)),
    pais: textoOpcional,
    regiao: textoOpcional,
    precoMinCentavos: centavos.nullable(),
    precoMaxCentavos: centavos.nullable(),
    precoFontes: z.array(FontePrecoSchema),
    precoConsultadoEm: z.iso.datetime({ offset: true }).nullable(),
    abrirDe: ano,
    abrirAte: ano.nullable(),
    guardaAte: ano,
    decantarMin: minutos.nullable(),
    decantarMax: minutos.nullable(),
    harmonizacoes: z
      .array(z.string().trim().min(1).max(200))
      .min(1, "informe ao menos 1 harmonização")
      .max(5, "no máximo 5 harmonizações"),
  })
  .superRefine((f, ctx) => {
    if ((f.precoMinCentavos === null) !== (f.precoMaxCentavos === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["precoMaxCentavos"],
        message: "informe o preço mínimo e o máximo juntos",
      });
    } else if (
      f.precoMinCentavos !== null &&
      f.precoMaxCentavos !== null &&
      f.precoMinCentavos > f.precoMaxCentavos
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["precoMinCentavos"],
        message: "preço mínimo maior que o máximo",
      });
    }

    if (f.abrirAte !== null && f.abrirAte < f.abrirDe) {
      ctx.addIssue({
        code: "custom",
        path: ["abrirAte"],
        message: "fim da janela de abertura antes do início",
      });
    }
    if (f.guardaAte < (f.abrirAte ?? f.abrirDe)) {
      ctx.addIssue({
        code: "custom",
        path: ["guardaAte"],
        message: "guarda máxima antes da janela de abertura",
      });
    }

    if ((f.decantarMin === null) !== (f.decantarMax === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["decantarMax"],
        message: "informe a decantação mínima e a máxima juntas",
      });
    } else if (
      f.decantarMin !== null &&
      f.decantarMax !== null &&
      f.decantarMin > f.decantarMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["decantarMin"],
        message: "decantação mínima maior que a máxima",
      });
    }
  });
export type FichaVinho = z.infer<typeof FichaVinhoSchema>;
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./ficha";
```

- [ ] **Passo 6: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/ficha.test.ts`
Expected: PASS (20).

- [ ] **Passo 7: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 8: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): FichaVinhoSchema com regras de preco, janela e decantacao"
```

---

### Tarefa 4: `statusConsumo` e `ordenarAdega`

**Files:**
- Create: `packages/core/src/status.ts`, `packages/core/src/ordenar.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/status.test.ts`, `packages/core/test/ordenar.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `STATUS_CONSUMO = ["passou", "abrir_logo", "no_ponto", "aguardar"]`, `type StatusConsumo`, `interface JanelaConsumo { abrirDe: number; guardaAte: number }`, `statusConsumo(item: JanelaConsumo, anoAtual: number): StatusConsumo`, `interface ItemOrdenavel extends JanelaConsumo { nome: string; quantidade: number; atualizadoEm: Date }`, `ordenarAdega<T extends ItemOrdenavel>(itens: readonly T[], anoAtual: number): T[]`.

- [ ] **Passo 1: Escrever os testes que falham**

`packages/core/test/status.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { statusConsumo } from "../src/status";

describe("statusConsumo", () => {
  const ano = { abrirDe: 2026, guardaAte: 2030 };

  it.each([
    [2025, "aguardar"],
    [2026, "no_ponto"],
    [2028, "no_ponto"],
    [2029, "no_ponto"],
    [2030, "abrir_logo"],
    [2031, "passou"],
  ])("em %i fica %s (🎯 2026, ⏳ 2030)", (anoAtual, esperado) => {
    expect(statusConsumo(ano, anoAtual)).toBe(esperado);
  });

  it.each([
    [2026, "aguardar"],
    [2027, "no_ponto"],
    [2028, "no_ponto"],
  ])("faixa 🎯 2027–2028 (⏳ 2033): em %i fica %s", (anoAtual, esperado) => {
    expect(statusConsumo({ abrirDe: 2027, guardaAte: 2033 }, anoAtual)).toBe(esperado);
  });

  it("guarda no mesmo ano da abertura: abrir logo vence", () => {
    expect(statusConsumo({ abrirDe: 2026, guardaAte: 2026 }, 2026)).toBe("abrir_logo");
  });
});
```

`packages/core/test/ordenar.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ordenarAdega, type ItemOrdenavel } from "../src/ordenar";

function item(nome: string, campos: Partial<ItemOrdenavel> = {}): ItemOrdenavel {
  return {
    nome,
    abrirDe: 2026,
    guardaAte: 2030,
    quantidade: 1,
    atualizadoEm: new Date("2026-01-01T00:00:00Z"),
    ...campos,
  };
}

const ANO = 2026;

describe("ordenarAdega", () => {
  it("ordena por status: passou, abrir logo, no ponto, aguardar", () => {
    const itens = [
      item("Aguardar", { abrirDe: 2028, guardaAte: 2035 }),
      item("No ponto", { abrirDe: 2025, guardaAte: 2030 }),
      item("Passou", { abrirDe: 2020, guardaAte: 2025 }),
      item("Abrir logo", { abrirDe: 2022, guardaAte: 2026 }),
    ];
    expect(ordenarAdega(itens, ANO).map((i) => i.nome)).toEqual([
      "Passou",
      "Abrir logo",
      "No ponto",
      "Aguardar",
    ]);
  });

  it("desempata por abrirDe e depois por nome, ignorando acentos e caixa", () => {
    const itens = [
      item("bodega", { abrirDe: 2025 }),
      item("Zeta", { abrirDe: 2024 }),
      item("Álamos", { abrirDe: 2025 }),
    ];
    expect(ordenarAdega(itens, ANO).map((i) => i.nome)).toEqual(["Zeta", "Álamos", "bodega"]);
  });

  it("põe 'Já bebemos' no fim, do mais recente para o mais antigo", () => {
    const itens = [
      item("Bebido antigo", { quantidade: 0, atualizadoEm: new Date("2026-01-01T00:00:00Z") }),
      item("Na adega", { abrirDe: 2028, guardaAte: 2035 }),
      item("Bebido recente", { quantidade: 0, atualizadoEm: new Date("2026-06-01T00:00:00Z") }),
    ];
    expect(ordenarAdega(itens, ANO).map((i) => i.nome)).toEqual([
      "Na adega",
      "Bebido recente",
      "Bebido antigo",
    ]);
  });

  it("não altera o array recebido e preserva campos extras", () => {
    const itens = [item("B", { abrirDe: 2027 }), { ...item("A"), id: "x" }];
    const copia = [...itens];
    const ordenados = ordenarAdega(itens, ANO);
    expect(itens).toEqual(copia);
    expect(ordenados[0]).toMatchObject({ nome: "A", id: "x" });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/status.test.ts test/ordenar.test.ts`
Expected: FAIL, porque os módulos não existem.

- [ ] **Passo 3: Implementar**

`packages/core/src/status.ts`:
```ts
export const STATUS_CONSUMO = ["passou", "abrir_logo", "no_ponto", "aguardar"] as const;
export type StatusConsumo = (typeof STATUS_CONSUMO)[number];

export interface JanelaConsumo {
  abrirDe: number;
  guardaAte: number;
}

export function statusConsumo(item: JanelaConsumo, anoAtual: number): StatusConsumo {
  if (anoAtual > item.guardaAte) return "passou";
  if (anoAtual === item.guardaAte) return "abrir_logo";
  if (anoAtual < item.abrirDe) return "aguardar";
  return "no_ponto";
}
```

`packages/core/src/ordenar.ts`:
```ts
import { STATUS_CONSUMO, statusConsumo, type JanelaConsumo } from "./status";

export interface ItemOrdenavel extends JanelaConsumo {
  nome: string;
  quantidade: number;
  atualizadoEm: Date;
}

const compararNomes = new Intl.Collator("pt-BR", { sensitivity: "base" }).compare;

export function ordenarAdega<T extends ItemOrdenavel>(itens: readonly T[], anoAtual: number): T[] {
  const peso = (i: T) => STATUS_CONSUMO.indexOf(statusConsumo(i, anoAtual));

  const naAdega = itens
    .filter((i) => i.quantidade > 0)
    .sort((a, b) => peso(a) - peso(b) || a.abrirDe - b.abrirDe || compararNomes(a.nome, b.nome));
  const bebidos = itens
    .filter((i) => i.quantidade <= 0)
    .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime());

  return [...naAdega, ...bebidos];
}
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./status";
export * from "./ordenar";
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/status.test.ts test/ordenar.test.ts`
Expected: PASS (14).

- [ ] **Passo 5: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 6: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "feat(core): status de consumo e ordenacao da adega"
```

---

### Tarefa 5: `chaveDuplicata`

**Files:**
- Create: `packages/core/src/texto.ts`, `packages/core/src/duplicata.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/duplicata.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `chaveDuplicata(nome: string, safra: number | null): string`. Interno (não exportado no `index`): `semAcentos(texto: string): string`, reutilizado na Tarefa 9.

- [ ] **Passo 1: Escrever o teste que falha**

`packages/core/test/duplicata.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { chaveDuplicata } from "../src/duplicata";

describe("chaveDuplicata", () => {
  it("usa minúsculas, sem acentos, e a safra", () => {
    expect(chaveDuplicata("Château Labadie", 2020)).toBe("chateau labadie|2020");
  });

  it("ignora caixa, acentos e espaços extras", () => {
    expect(chaveDuplicata("  CHÂTEAU   labadie ", 2020)).toBe(
      chaveDuplicata("Chateau Labadie", 2020),
    );
  });

  it("usa 'nv' quando não há safra", () => {
    expect(chaveDuplicata("Espumante Brut", null)).toBe("espumante brut|nv");
  });

  it("separa safras diferentes do mesmo vinho", () => {
    expect(chaveDuplicata("Malbec", 2020)).not.toBe(chaveDuplicata("Malbec", 2021));
  });

  it("trata ç e ñ", () => {
    expect(chaveDuplicata("Ñandú Açaí", 2019)).toBe("nandu acai|2019");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/duplicata.test.ts`
Expected: FAIL, porque `../src/duplicata` não existe.

- [ ] **Passo 3: Implementar**

`packages/core/src/texto.ts`:
```ts
export function semAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}
```

`packages/core/src/duplicata.ts`:
```ts
import { semAcentos } from "./texto";

export function chaveDuplicata(nome: string, safra: number | null): string {
  const normalizado = semAcentos(nome).toLowerCase().replace(/\s+/g, " ").trim();
  return `${normalizado}|${safra ?? "nv"}`;
}
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./duplicata";
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/duplicata.test.ts`
Expected: PASS (5).

- [ ] **Passo 5: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 6: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "feat(core): chave de duplicata por nome normalizado e safra"
```

---

### Tarefa 6: `horaDeAbrir`

**Files:**
- Create: `packages/core/src/hora.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/hora.test.ts`

**Interfaces:**
- Consumes: `zod`.
- Produces: `HoraSchema` (zod, string `"HH:MM"`, usado na API do Plano 4), `horaDeAbrir(horaRefeicao: string, decantarMax: number | null): string | null`. Lança `RangeError` se a hora não estiver em `HH:MM` 00:00–23:59.

- [ ] **Passo 1: Escrever o teste que falha**

`packages/core/test/hora.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { HoraSchema, horaDeAbrir } from "../src/hora";

describe("horaDeAbrir", () => {
  it.each([
    ["20:00", 45, "19:15"],
    ["20:00", 0, "20:00"],
    ["20:00", 120, "18:00"],
    ["00:30", 45, "23:45"],
    ["08:05", 5, "08:00"],
  ])("jantar às %s com %i min de decantação → abrir às %s", (hora, minutos, esperado) => {
    expect(horaDeAbrir(hora, minutos)).toBe(esperado);
  });

  it("sem decantação devolve null", () => {
    expect(horaDeAbrir("20:00", null)).toBeNull();
  });

  it.each(["24:00", "7:30", "20:60", "abc", ""])("rejeita a hora %j", (hora) => {
    expect(() => horaDeAbrir(hora, 30)).toThrow(RangeError);
  });
});

describe("HoraSchema", () => {
  it("aceita HH:MM e rejeita o resto", () => {
    expect(HoraSchema.safeParse("19:30").success).toBe(true);
    expect(HoraSchema.safeParse("19h30").success).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/hora.test.ts`
Expected: FAIL, porque `../src/hora` não existe.

- [ ] **Passo 3: Implementar**

`packages/core/src/hora.ts`:
```ts
import { z } from "zod";

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTOS_NO_DIA = 24 * 60;

export const HoraSchema = z.string().regex(HORA, "use o formato HH:MM");

export function horaDeAbrir(horaRefeicao: string, decantarMax: number | null): string | null {
  const partes = HORA.exec(horaRefeicao);
  if (!partes) throw new RangeError(`hora inválida: ${horaRefeicao}`);
  if (decantarMax === null) return null;

  const total = Number(partes[1]) * 60 + Number(partes[2]) - decantarMax;
  const ajustado = ((total % MINUTOS_NO_DIA) + MINUTOS_NO_DIA) % MINUTOS_NO_DIA;
  const horas = String(Math.floor(ajustado / 60)).padStart(2, "0");
  const minutos = String(ajustado % 60).padStart(2, "0");
  return `${horas}:${minutos}`;
}
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./hora";
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/hora.test.ts`
Expected: PASS (12).

- [ ] **Passo 5: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 6: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "feat(core): hora de abrir a garrafa a partir da decantacao"
```

---

### Tarefa 7: `filtrarSugestoes`

**Files:**
- Create: `packages/core/src/sugestoes.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/sugestoes.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `MAX_SUGESTOES = 3`, `filtrarSugestoes<T extends { itemId: string }>(sugestoesIA: readonly T[], idsEnviados: Iterable<string>): T[]`, que preserva a ordem da IA, descarta ids desconhecidos e repetidos e devolve no máximo 3.

- [ ] **Passo 1: Escrever o teste que falha**

`packages/core/test/sugestoes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filtrarSugestoes } from "../src/sugestoes";

const s = (itemId: string) => ({ itemId, motivo: `motivo ${itemId}`, decantarMin: null });

describe("filtrarSugestoes", () => {
  it("descarta itens que não foram enviados para a IA", () => {
    expect(filtrarSugestoes([s("a"), s("inventado"), s("b")], ["a", "b"])).toEqual([s("a"), s("b")]);
  });

  it("devolve no máximo 3, mantendo a ordem da IA", () => {
    const ids = ["d", "c", "b", "a"];
    expect(filtrarSugestoes(ids.map(s), ids).map((x) => x.itemId)).toEqual(["d", "c", "b"]);
  });

  it("remove a mesma garrafa sugerida mais de uma vez", () => {
    expect(filtrarSugestoes([s("a"), s("a"), s("b")], ["a", "b"]).map((x) => x.itemId)).toEqual([
      "a",
      "b",
    ]);
  });

  it("repetidos e inventados não ocupam vaga das 3", () => {
    const sugestoes = [s("a"), s("x"), s("a"), s("b"), s("c"), s("d")];
    expect(filtrarSugestoes(sugestoes, ["a", "b", "c", "d"]).map((x) => x.itemId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("sem sugestões válidas devolve lista vazia", () => {
    expect(filtrarSugestoes([s("x")], [])).toEqual([]);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/sugestoes.test.ts`
Expected: FAIL, porque `../src/sugestoes` não existe.

- [ ] **Passo 3: Implementar**

`packages/core/src/sugestoes.ts`:
```ts
export const MAX_SUGESTOES = 3;

export function filtrarSugestoes<T extends { itemId: string }>(
  sugestoesIA: readonly T[],
  idsEnviados: Iterable<string>,
): T[] {
  const permitidos = new Set(idsEnviados);
  const vistos = new Set<string>();
  const resultado: T[] = [];

  for (const sugestao of sugestoesIA) {
    if (!permitidos.has(sugestao.itemId) || vistos.has(sugestao.itemId)) continue;
    vistos.add(sugestao.itemId);
    resultado.push(sugestao);
    if (resultado.length === MAX_SUGESTOES) break;
  }
  return resultado;
}
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./sugestoes";
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/sugestoes.test.ts`
Expected: PASS (5).

- [ ] **Passo 5: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 6: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "feat(core): filtro das sugestoes da IA"
```

---

### Tarefa 8: `formatarLinhaKeep`

**Files:**
- Create: `packages/core/src/keep.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/test/fabricas.ts`
- Test: `packages/core/test/keep-formatar.test.ts`

**Interfaces:**
- Consumes: `type FichaVinho` (Tarefa 3).
- Produces: `formatarLinhaKeep(ficha: FichaVinho): string` no formato `Nome (safra|NV) | 💵 R$ x–y | 🎯 ano[–ano] (⏳ ano) | 🍷 Decantar: x[–y] min | 🥩 a, b`. Preço nulo vira `💵 Não consultado`; decantação nula vira `Decantar: Não necessário`. Nos testes: `LINHAS_KEEP_PO: string[]` e `FICHAS_KEEP_PO: FichaVinho[]`, na mesma ordem.

- [ ] **Passo 1: Linhas reais da PO na fábrica**

Acrescente em `packages/core/test/fabricas.ts`:
```ts
export const LINHAS_KEEP_PO = [
  "Château Labadie Médoc Cru Bourgeois (2020) | 💵 R$ 220–280 | 🎯 2026 (⏳ 2030) | 🍷 Decantar: 30–45 min | 🥩 Estrogonofe de carne, corte de novilho grelhado",
  "Perez Cruz Gran Reserva Cabernet Sauvignon (2024) | 💵 R$ 130–180 | 🎯 2027–2028 (⏳ 2033) | 🍷 Decantar: 45 min | 🥩 Churrasco, bife de tira, carnes vermelhas grelhadas",
  "Salentein Reserva Pinot Noir (2023) | 💵 R$ 160–220 | 🎯 2026 (⏳ 2029) | 🍷 Decantar: Não necessário | 🥩 Capellini com cogumelos e ricota, frango assado com ervas",
];

export const FICHAS_KEEP_PO: FichaVinho[] = [
  fichaValida(),
  fichaValida({
    nome: "Perez Cruz Gran Reserva Cabernet Sauvignon",
    safra: 2024,
    precoMinCentavos: 13000,
    precoMaxCentavos: 18000,
    abrirDe: 2027,
    abrirAte: 2028,
    guardaAte: 2033,
    decantarMin: 45,
    decantarMax: 45,
    harmonizacoes: ["Churrasco", "bife de tira", "carnes vermelhas grelhadas"],
  }),
  fichaValida({
    nome: "Salentein Reserva Pinot Noir",
    safra: 2023,
    precoMinCentavos: 16000,
    precoMaxCentavos: 22000,
    abrirDe: 2026,
    guardaAte: 2029,
    decantarMin: null,
    decantarMax: null,
    harmonizacoes: ["Capellini com cogumelos e ricota", "frango assado com ervas"],
  }),
];
```

- [ ] **Passo 2: Escrever o teste que falha**

`packages/core/test/keep-formatar.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { FichaVinho } from "../src/ficha";
import { formatarLinhaKeep } from "../src/keep";
import { FICHAS_KEEP_PO, LINHAS_KEEP_PO, fichaValida } from "./fabricas";

describe("formatarLinhaKeep", () => {
  it.each<[string, FichaVinho, string]>(
    FICHAS_KEEP_PO.map((ficha, i) => [ficha.nome, ficha, LINHAS_KEEP_PO[i]!]),
  )(
    "reproduz a linha real da PO: %s",
    (_nome, ficha, linha) => {
      expect(formatarLinhaKeep(ficha)).toBe(linha);
    },
  );

  it("usa NV quando não há safra", () => {
    expect(formatarLinhaKeep(fichaValida({ safra: null }))).toMatch(/^Château .+ \(NV\) \|/);
  });

  it("formata milhar e centavos no preço", () => {
    const ficha = fichaValida({ precoMinCentavos: 8990, precoMaxCentavos: 120050 });
    expect(formatarLinhaKeep(ficha)).toContain("| 💵 R$ 89,90–1.200,50 |");
  });

  it("mostra preço único quando mínimo e máximo são iguais", () => {
    const ficha = fichaValida({ precoMinCentavos: 15000, precoMaxCentavos: 15000 });
    expect(formatarLinhaKeep(ficha)).toContain("| 💵 R$ 150 |");
  });

  it("mostra 'Não consultado' quando o preço não foi buscado", () => {
    const ficha = fichaValida({ precoMinCentavos: null, precoMaxCentavos: null });
    expect(formatarLinhaKeep(ficha)).toContain("| 💵 Não consultado |");
  });
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/keep-formatar.test.ts`
Expected: FAIL, porque `../src/keep` não existe.

- [ ] **Passo 4: Implementar**

`packages/core/src/keep.ts`:
```ts
import type { FichaVinho } from "./ficha";

const TRACO_SAIDA = "–";

function formatarReais(centavos: number): string {
  const reais = Math.floor(centavos / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const resto = centavos % 100;
  return resto === 0 ? reais : `${reais},${String(resto).padStart(2, "0")}`;
}

function faixa(min: number, max: number, formatar: (n: number) => string): string {
  return min === max ? formatar(min) : `${formatar(min)}${TRACO_SAIDA}${formatar(max)}`;
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
```

Acrescente em `packages/core/src/index.ts`:
```ts
export * from "./keep";
```

- [ ] **Passo 5: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/keep-formatar.test.ts`
Expected: PASS (7).

- [ ] **Passo 6: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 7: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "feat(core): formatar ficha no formato da lista do Keep"
```

---

### Tarefa 9: `parseListaKeep`

**Files:**
- Modify: `packages/core/src/keep.ts`
- Test: `packages/core/test/keep-parse.test.ts`

**Interfaces:**
- Consumes: `FichaVinhoSchema`, `type FichaVinho`, `type TipoVinho` (Tarefa 3); `semAcentos` (Tarefa 5); `formatarLinhaKeep` (Tarefa 8, no teste de ida e volta).
- Produces: `interface FalhaImportacao { linha: number; texto: string; motivo: string }`, `interface ResultadoImportacao { importados: FichaVinho[]; falhas: FalhaImportacao[] }`, `parseListaKeep(texto: string): ResultadoImportacao`. `linha` começa em 1 e conta as linhas vazias; `texto` é a linha original. Itens importados saem com `produtor/pais/regiao: null`, `uvas: []`, `precoFontes: []`, `precoConsultadoEm: null` e `tipo` inferido pelo nome (`tinto` quando não dá para inferir). A `quantidade` 1 e a `origem: "importacao"` ficam por conta de quem grava (Plano 4), porque não fazem parte da ficha.

- [ ] **Passo 1: Escrever o teste que falha**

`packages/core/test/keep-parse.test.ts`:
```ts
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FichaVinho } from "../src/ficha";
import { formatarLinhaKeep, parseListaKeep } from "../src/keep";
import { FICHAS_KEEP_PO, LINHAS_KEEP_PO } from "./fabricas";

const BASE = "| 💵 R$ 100–150 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩 Pizza";

describe("parseListaKeep", () => {
  it("lê as linhas reais da PO", () => {
    expect(parseListaKeep(LINHAS_KEEP_PO.join("\n"))).toEqual({
      importados: FICHAS_KEEP_PO,
      falhas: [],
    });
  });

  it("aceita hífen comum nas faixas", () => {
    const { importados } = parseListaKeep(
      "Vinho X (2019) | 💵 R$ 100-150 | 🎯 2024-2025 (⏳ 2028) | 🍷 Decantar: 20-30 min | 🥩 Pizza",
    );
    expect(importados[0]).toMatchObject({
      precoMinCentavos: 10000,
      precoMaxCentavos: 15000,
      abrirDe: 2024,
      abrirAte: 2025,
      decantarMin: 20,
      decantarMax: 30,
    });
  });

  it("aceita espaços variáveis", () => {
    const { importados, falhas } = parseListaKeep(
      "Vinho X(2019)|💵R$100–150|🎯2024(⏳2028)|🍷Decantar:20 min|🥩 Pizza ,  Massa ",
    );
    expect(falhas).toEqual([]);
    expect(importados[0]).toMatchObject({ nome: "Vinho X", harmonizacoes: ["Pizza", "Massa"] });
  });

  it("aceita texto colado do Windows, marcadores do Keep e U+FE0F", () => {
    const texto = [
      `☐ Vinho A (2019) ${BASE}`,
      "",
      `☑ Vinho B (2018) ${BASE}`,
      `Vinho C (2017) | 💵️ R$ 100 | 🎯 2024 (⏳ 2028) | 🍷️ Decantar: 20 min | 🥩 Pizza`,
    ].join("\r\n");
    const { importados, falhas } = parseListaKeep(texto);
    expect(falhas).toEqual([]);
    expect(importados.map((f) => f.nome)).toEqual(["Vinho A", "Vinho B", "Vinho C"]);
  });

  it("lê milhar, centavos, preço único e 'Não consultado'", () => {
    const linha = (preco: string) =>
      `Vinho (2019) | 💵 ${preco} | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩 Pizza`;
    const { importados } = parseListaKeep(
      [linha("R$ 1.200–1.500"), linha("R$ 89,90"), linha("NÃO CONSULTADO")].join("\n"),
    );
    expect(importados.map((f) => [f.precoMinCentavos, f.precoMaxCentavos])).toEqual([
      [120000, 150000],
      [8990, 8990],
      [null, null],
    ]);
  });

  it("lê NV como safra nula", () => {
    const { importados } = parseListaKeep(`Espumante Brut (NV) ${BASE}`);
    expect(importados[0]).toMatchObject({ safra: null, tipo: "espumante" });
  });

  it.each([
    ["Casa Sauvignon Blanc", "branco"],
    ["Miolo Rosé", "rose"],
    ["Porto Tawny", "fortificado"],
    ["Late Harvest Moscatel", "sobremesa"],
    ["Cabernet Sauvignon", "tinto"],
  ])("infere o tipo de %s como %s", (nome, tipo) => {
    expect(parseListaKeep(`${nome} (2019) ${BASE}`).importados[0]?.tipo).toBe(tipo);
  });

  it("manda para falhas o que não reconhece, com número da linha e texto original", () => {
    const texto = ["", "Comprar mais vinho", `Vinho sem safra ${BASE}`, `Vinho (2019) ${BASE}`].join(
      "\n",
    );
    const { importados, falhas } = parseListaKeep(texto);
    expect(importados).toHaveLength(1);
    expect(falhas).toEqual([
      { linha: 2, texto: "Comprar mais vinho", motivo: expect.stringContaining('5 partes separadas por "|"') },
      { linha: 3, texto: `Vinho sem safra ${BASE}`, motivo: expect.stringContaining("safra entre parênteses") },
    ]);
  });

  it.each([
    ["sem 💵", "Vinho (2019) | R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩 Pizza", "💵 preço"],
    ["sem 🍷", "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | Decantar: 20 min | 🥩 Pizza", "🍷 decantação"],
    ["sem 🥩", "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | Pizza", "🥩 harmonização"],
    ["janela ilegível", "Vinho (2019) | 💵 R$ 100 | 🎯 logo | 🍷 Decantar: 20 min | 🥩 Pizza", "🎯 ano ideal"],
    ["decantação ilegível", "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 um pouco | 🥩 Pizza", "🍷 decantação"],
    ["sem harmonização", "Vinho (2019) | 💵 R$ 100 | 🎯 2024 (⏳ 2028) | 🍷 Decantar: 20 min | 🥩  ", "harmonização"],
    ["guarda antes da abertura", "Vinho (2019) | 💵 R$ 100 | 🎯 2026 (⏳ 2020) | 🍷 Decantar: 20 min | 🥩 Pizza", "guarda máxima"],
  ])("explica a falha: %s", (_caso, linha, trecho) => {
    const { falhas } = parseListaKeep(linha);
    expect(falhas[0]?.motivo).toContain(trecho);
  });

  it("ida e volta: parse(formatar(ficha)) devolve a mesma ficha", () => {
    const PALAVRAS = ["Château", "Quinta", "Reserva", "Gran", "Malbec", "Vale", "Alto", "Tannat", "São", "Ñandú"];
    const PRATOS = ["Churrasco", "frango assado com ervas", "Queijos curados", "Risoto de cogumelos"];
    const fichaKeep = fc
      .record({
        nome: fc.array(fc.constantFrom(...PALAVRAS), { minLength: 1, maxLength: 5 }).map((p) => p.join(" ")),
        safra: fc.option(fc.integer({ min: 1950, max: 2090 }), { nil: null }),
        abrirDe: fc.integer({ min: 1950, max: 2090 }),
        extraAbrir: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
        extraGuarda: fc.integer({ min: 0, max: 20 }),
        preco: fc.option(fc.tuple(fc.integer({ min: 0, max: 500_000 }), fc.integer({ min: 0, max: 200_000 })), { nil: null }),
        decantar: fc.option(fc.tuple(fc.integer({ min: 0, max: 180 }), fc.integer({ min: 0, max: 120 })), { nil: null }),
        harmonizacoes: fc.array(fc.constantFrom(...PRATOS), { minLength: 1, maxLength: 5 }),
      })
      .map((g): FichaVinho => {
        const abrirAte = g.extraAbrir === null ? null : g.abrirDe + g.extraAbrir;
        return {
          nome: g.nome,
          produtor: null,
          safra: g.safra,
          tipo: "tinto",
          uvas: [],
          pais: null,
          regiao: null,
          precoMinCentavos: g.preco ? g.preco[0] : null,
          precoMaxCentavos: g.preco ? g.preco[0] + g.preco[1] : null,
          precoFontes: [],
          precoConsultadoEm: null,
          abrirDe: g.abrirDe,
          abrirAte,
          guardaAte: (abrirAte ?? g.abrirDe) + g.extraGuarda,
          decantarMin: g.decantar ? g.decantar[0] : null,
          decantarMax: g.decantar ? g.decantar[0] + g.decantar[1] : null,
          harmonizacoes: g.harmonizacoes,
        };
      });

    fc.assert(
      fc.property(fc.array(fichaKeep, { minLength: 1, maxLength: 5 }), (fichas) => {
        const texto = fichas.map(formatarLinhaKeep).join("\n");
        expect(parseListaKeep(texto)).toEqual({ importados: fichas, falhas: [] });
      }),
    );
  });
});
```

- [ ] **Passo 2: Adicionar fast-check e rodar para ver falhar**

```bash
pnpm --filter @meu-sommelier/core add -D fast-check
pnpm --filter @meu-sommelier/core exec vitest run test/keep-parse.test.ts
```
Expected: FAIL, porque `parseListaKeep` não é exportado por `../src/keep`.

- [ ] **Passo 3: Implementar**

Em `packages/core/src/keep.ts`, troque a primeira linha (`import type { FichaVinho } from "./ficha";`) por:
```ts
import { FichaVinhoSchema, type FichaVinho, type TipoVinho } from "./ficha";
import { semAcentos } from "./texto";
```

E acrescente no fim do arquivo:
```ts
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
const SELETOR_VARIACAO = /️/gu;
const MARCADOR_CHECKLIST = /^(?:[☐☑✅✔]|-\s*\[[ xX]\])\s*/u;
const CABECALHO = /^(.*\S)\s*\(\s*(\d{4}|NV)\s*\)$/iu;
const VALOR = "(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d{2}))?";
const PRECO = new RegExp(`^R\\$\\s*${VALOR}(?:\\s*${TRACO}\\s*(?:R\\$\\s*)?${VALOR})?$`, "iu");
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
  if (semAcentos(texto).toLowerCase() === "nao consultado") return { min: null, max: null };
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
  const limpo = texto.replace(SELETOR_VARIACAO, "").trim().replace(MARCADOR_CHECKLIST, "");
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
    return { ok: false, motivo: "não encontrei a safra entre parênteses, ex.: (2020) ou (NV)" };
  }
  const preco = lerPreco(semPrefixo(parteP, "💵"));
  if (!preco) return { ok: false, motivo: "não entendi o 💵 preço, ex.: 💵 R$ 220–280" };
  const janela = JANELA.exec(semPrefixo(parteJ, "🎯") ?? "");
  if (!janela) {
    return { ok: false, motivo: "não entendi o 🎯 ano ideal e a ⏳ guarda, ex.: 🎯 2026 (⏳ 2030)" };
  }
  const decantar = lerDecantar(semPrefixo(parteD, "🍷"));
  if (!decantar) {
    return {
      ok: false,
      motivo: "não entendi a 🍷 decantação, ex.: 🍷 Decantar: 30–45 min ou Não necessário",
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
    return { ok: false, motivo: resultado.error.issues.map((i) => i.message).join("; ") };
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
    else falhas.push({ linha: indice + 1, texto: linha, motivo: leitura.motivo });
  });

  return { importados, falhas };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/keep-parse.test.ts`
Expected: PASS (20). Se a propriedade de ida e volta falhar, o fast-check mostra o contraexemplo mínimo. Corrija o parser ou o formatador; **não** restrinja o gerador para esconder o caso.

- [ ] **Passo 5: Lint e formatação**

Run: `pnpm format && pnpm lint && pnpm typecheck`

- [ ] **Passo 6: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): importador da lista do Keep com teste de ida e volta"
```

---

### Tarefa 10: API pública do `core` e verificação final

**Files:**
- Test: `packages/core/test/index.test.ts`

**Interfaces:**
- Consumes: tudo das Tarefas 1–9.
- Produces: `@meu-sommelier/core` exportando `CODIGOS_ERRO, HTTP_POR_CODIGO, FUSO_PADRAO, relogioSistema, relogioFixo, anoEm, TIPOS_VINHO, TipoVinhoSchema, FontePrecoSchema, FichaVinhoSchema, STATUS_CONSUMO, statusConsumo, ordenarAdega, chaveDuplicata, HoraSchema, horaDeAbrir, MAX_SUGESTOES, filtrarSugestoes, formatarLinhaKeep, parseListaKeep`, além dos tipos correspondentes.

- [ ] **Passo 1: Escrever o teste da API pública**

`packages/core/test/index.test.ts`:
```ts
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
```

- [ ] **Passo 2: Rodar**

Run: `pnpm --filter @meu-sommelier/core exec vitest run test/index.test.ts`
Expected: PASS. Se aparecer um export a mais ou a menos, ajuste o `src/index.ts`, e não o teste. O `semAcentos` não pode vazar.

- [ ] **Passo 3: Verificação completa, igual à da CI**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage`
Expected: tudo verde e cobertura ≥ 90% em linhas, funções, branches e statements. Se algum branch ficar descoberto, escreva o teste que falta no arquivo da tarefa correspondente.

- [ ] **Passo 4: Commit (pedir aceite do usuário antes)**

```bash
git add packages/core
git commit -m "test(core): contrato da API publica do core"
```

- [ ] **Passo 5: Push (pedir aceite do usuário antes)**

```bash
git push origin main
```
Confira se o workflow **CI** fica verde no GitHub. Se o push der 403, veja a memória `git-repo-pessoal` e **proponha** a correção ao usuário, sem executar.
